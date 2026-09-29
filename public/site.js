/* Site-wide behaviour: cart (localStorage), cart drawer, search overlay, checkout, demo login. */
(function () {
  var art = !!window.CL_ARTIFACT;
  var cs = document.currentScript, base = "";
  if (!art && cs && cs.src) base = cs.src.replace(/\/site\.js(\?.*)?$/, "").replace(location.origin, "");
  function L(kind, id) {
    if (art) return { product: "product.html", shop: "shop.html", checkout: "checkout.html", account: "account.html", profile: "profile.html", orders: "orders.html", tickets: "tickets.html", edit: "edit.html", support: "support.html", home: "index.html" }[kind];
    return base + { product: "/product/" + id, shop: "/shop", checkout: "/checkout", account: "/account", profile: "/account/profile", orders: "/account/orders", tickets: "/account/tickets", edit: "/account/edit", support: "/support", home: "/" }[kind];
  }
  function J(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function W(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function session() { return J("caseline-session", null); }
  function users() { return J("caseline-users", {}); }
  function me() { return users()[session()] || null; }
  function go(kind) { location.href = L(kind); }
  function today() { return new Date().toLocaleDateString("fa-IR", { year: "numeric", month: "2-digit", day: "2-digit" }); }
  var fa = function (n) { return Number(n).toLocaleString("fa-IR"); };
  var toman = function (n) { return fa(n) + " تومان"; };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var KEY = "caseline-cart";
  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } }
  function store(c) { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) {} refresh(); }
  function count(c) { return c.reduce(function (a, l) { return a + l.qty; }, 0); }
  function sum(c) { return c.reduce(function (a, l) { return a + l.qty * l.price; }, 0); }
  var mem = load();
  function cart() { return mem; }
  function save(c) { mem = c; store(c); }
  var imgUrl = function (i) { return art ? i.replace(/^\//, "") : base + i; };
  var thumb = function (h, img) { return '<span class="cl-thumb" style="background:' + (img ? "url(" + imgUrl(img) + ") center/cover" : "linear-gradient(160deg,hsl(" + h + " 80% 56%),hsl(" + ((h + 40) % 360) + " 70% 30%))") + '"></span>'; };

  /* ---------- drawer ---------- */
  var drawer;
  function ensureDrawer() {
    if (drawer) return drawer;
    drawer = document.createElement("div");
    drawer.className = "cl-layer"; drawer.dir = "rtl"; drawer.hidden = true;
    drawer.innerHTML = '<div class="cl-backdrop" data-close></div><aside class="cl-sheet" role="dialog" aria-label="سبد خرید"><header><b>سبد خرید</b><button class="cl-x" data-close aria-label="بستن">✕</button></header><div class="cl-body" data-cart-body></div><footer data-cart-foot></footer></aside>';
    document.body.appendChild(drawer);
    return drawer;
  }
  function renderDrawer() {
    if (!drawer) return;
    var c = cart(), body = $("[data-cart-body]", drawer), foot = $("[data-cart-foot]", drawer);
    if (!c.length) {
      body.innerHTML = '<p class="cl-empty">سبد خرید شما خالی است.</p>';
      foot.innerHTML = '<a class="cl-btn cl-btn-ghost" href="' + L("shop") + '">مشاهده فروشگاه</a>';
      return;
    }
    body.innerHTML = c.map(function (l, i) {
      return '<div class="cl-line">' + thumb(l.hue, l.img) + '<div class="cl-info"><a href="' + L("product", l.id) + '">' + esc(l.name) + '</a>' + (l.opt ? '<small>' + esc(l.opt) + '</small>' : "") +
        '<div class="cl-row"><span class="cl-qty"><button data-qty-set="' + i + '" data-d="1" aria-label="افزایش">+</button><i>' + fa(l.qty) + '</i><button data-qty-set="' + i + '" data-d="-1" aria-label="کاهش">−</button></span><b>' + toman(l.price * l.qty) + '</b></div></div><button class="cl-rm" data-rm="' + i + '" aria-label="حذف">✕</button></div>';
    }).join("");
    foot.innerHTML = '<div class="cl-total"><span>جمع:</span><b>' + toman(sum(c)) + '</b></div><a class="cl-btn" href="' + L("checkout") + '">تسویه حساب</a><button class="cl-btn cl-btn-ghost" data-close>ادامه خرید</button>';
  }
  function openCart() { ensureDrawer(); renderDrawer(); drawer.hidden = false; document.documentElement.classList.add("cl-lock"); }
  function closeAll() { if (drawer) drawer.hidden = true; if (search) search.hidden = true; document.documentElement.classList.remove("cl-lock"); }

  /* ---------- search ---------- */
  var search, data;
  function ensureSearch() {
    if (search) return search;
    search = document.createElement("div");
    search.className = "cl-layer"; search.dir = "rtl"; search.hidden = true;
    search.innerHTML = '<div class="cl-backdrop" data-close></div><div class="cl-search" role="dialog" aria-label="جستجو"><div class="cl-sbar"><input id="cl-search-input" type="search" placeholder="جستجوی محصول، برند یا مدل گوشی…" autocomplete="off"><button class="cl-x" data-close aria-label="بستن">✕</button></div><div class="cl-results" data-results></div></div>';
    document.body.appendChild(search);
    $("#cl-search-input", search).addEventListener("input", function () { runSearch(this.value); });
    return search;
  }
  function withData(cb) {
    if (data) return cb();
    fetch(art ? "catalog.json" : base + "/catalog.json").then(function (r) { return r.json(); }).then(function (j) { data = j; cb(); }).catch(function () { data = []; cb(); });
  }
  function runSearch(q) {
    var out = $("[data-results]", search);
    q = (q || "").trim().toLowerCase();
    if (!q) { out.innerHTML = '<p class="cl-empty">نام محصول یا مدل گوشی را بنویسید.</p>'; return; }
    withData(function () {
      var r = data.filter(function (p) { return (p.name + " " + p.brand + " " + (p.compat || "") + " " + p.catLabel).toLowerCase().indexOf(q) > -1; }).slice(0, 8);
      out.innerHTML = r.length ? r.map(function (p) {
        return '<a class="cl-res" href="' + L("product", p.id) + '">' + thumb(p.hue, p.img) + '<span><b>' + esc(p.name) + (p.compat ? " " + esc(p.compat) : "") + '</b><small>' + esc(p.catLabel) + '</small></span><em>' + toman(p.price) + '</em></a>';
      }).join("") : '<p class="cl-empty">محصولی پیدا نشد.</p>';
    });
  }
  function openSearch(q) {
    ensureSearch(); search.hidden = false; document.documentElement.classList.add("cl-lock");
    var i = $("#cl-search-input", search); i.value = q || ""; runSearch(q); setTimeout(function () { i.focus(); }, 30);
  }

  /* ---------- badge ---------- */
  function refresh() {
    var n = count(cart());
    $$("[data-cart-count]").forEach(function (b) { b.textContent = fa(n); b.hidden = !n; });
    renderDrawer(); renderCheckout();
  }

  /* ---------- add to cart ---------- */
  function add() {
    var box = $("[data-product]"); if (!box) return;
    var sel = $("[data-model-select]"), opt = sel ? sel.value : "";
    var qe = $("[data-qty]"), q = qe ? parseInt(qe.textContent, 10) || 1 : 1;
    var c = cart().slice(), id = box.dataset.id, hit = null;
    c.forEach(function (l) { if (l.id === id && l.opt === opt) hit = l; });
    if (hit) hit.qty += q; else c.push({ id: id, name: box.dataset.name, price: +box.dataset.price, hue: +box.dataset.hue, img: box.dataset.img || "", opt: opt, qty: q });
    save(c); openCart();
  }

  /* ---------- checkout ---------- */
  var coupon = 0;
  function totals() { var s = sum(cart()), d = Math.round(s * coupon), ship = s - d >= 2000000 || !s ? 0 : 60000; return { s: s, d: d, ship: ship, t: s - d + ship }; }
  function renderCheckout() {
    var root = $("[data-checkout]"); if (!root) return;
    var c = cart(), t = totals(), list = $("[data-order-list]", root);
    list.innerHTML = c.length ? c.map(function (l) { return '<div class="cl-oline">' + thumb(l.hue, l.img) + '<div><b>' + esc(l.name) + '</b>' + (l.opt ? '<small>' + esc(l.opt) + '</small>' : "") + '<small>' + toman(l.price) + ' × ' + fa(l.qty) + '</small></div><em>' + toman(l.price * l.qty) + '</em></div>'; }).join("") : '<p class="cl-empty">سبد خرید شما خالی است. <a href="' + L("shop") + '">مشاهده فروشگاه</a></p>';
    $("[data-order-sub]", root).textContent = toman(t.s);
    $("[data-order-discount]", root).textContent = t.d ? "−" + toman(t.d) : "—";
    $("[data-order-ship]", root).textContent = t.ship ? toman(t.ship) : "رایگان";
    $("[data-order-total]", root).textContent = toman(t.t);
  }
  function initCheckout() {
    var root = $("[data-checkout]"); if (!root) return;
    var msg = $("[data-coupon-msg]", root);
    $("[data-coupon-btn]", root).addEventListener("click", function () {
      var v = $("[data-coupon-input]", root).value.trim().toUpperCase();
      if (v === "CASE10") { coupon = 0.1; msg.textContent = "کد تخفیف ۱۰٪ اعمال شد."; msg.dataset.ok = "1"; }
      else { coupon = 0; msg.textContent = v ? "کد تخفیف معتبر نیست." : ""; msg.dataset.ok = ""; }
      renderCheckout();
    });
    $("[data-checkout-form]", root).addEventListener("submit", function (e) {
      e.preventDefault();
      if (!cart().length) { msg.textContent = "سبد خرید شما خالی است."; msg.dataset.ok = ""; return; }
      var c0 = cart(), oid = Math.floor(30000 + Math.random() * 60000), t0 = totals();
      var ords = J("caseline-orders", []); ords.unshift({ id: oid, date: today(), total: t0.t, title: c0[0].name + (c0.length > 1 ? " و " + fa(c0.length - 1) + " مورد دیگر" : ""), opt: c0[0].opt || "", status: "pending" }); W("caseline-orders", ords);
      var code = "CL-" + oid;
      $("[data-order-code]", root).textContent = code;
      $("[data-checkout-main]", root).hidden = true; $("[data-order-done]", root).hidden = false;
      save([]); window.scrollTo(0, 0);
    });
    var place = $("[data-place-order]", root), form = $("[data-checkout-form]", root);
    if (place) place.addEventListener("click", function () { if (form.requestSubmit) form.requestSubmit(); else form.dispatchEvent(new Event("submit", { cancelable: true })); });
    renderCheckout();
  }

  /* ---------- demo login ---------- */
  function initLogin() {
    var f = $("[data-login-form]"); if (!f) return;
    var card = $("[data-login-card]"), s1 = $("[data-step1]", f), s2 = $("[data-step2]", f), done = $("[data-login-done]"), err = $("[data-login-err]", f), btn = $("[data-login-btn]", f), timer = $("[data-login-timer]", f), otp = $$("[data-otp] input", f), tick;
    function latin(v) { return v.replace(/[۰-۹]/g, function (d) { return "۰۱۲۳۴۵۶۷۸۹".indexOf(d); }).trim(); }
    function busy(on) { card.dataset.loading = String(on); btn.disabled = on; }
    function startTimer() {
      var n = 120; clearInterval(tick);
      function draw() { timer.innerHTML = n > 0 ? '<b class="cl-num">' + fa(n) + '</b> ثانیه مانده تا پایان اعتبار این کد' : '<button type="button" data-login-resend class="cl-link">ارسال مجدد کد</button>'; }
      draw(); tick = setInterval(function () { n--; draw(); if (n <= 0) clearInterval(tick); }, 1000);
    }
    function back() { s2.hidden = true; s1.hidden = false; btn.textContent = "ارسال کد"; err.textContent = ""; clearInterval(tick); otp.forEach(function (i) { i.value = ""; }); $("[name=phone]", f).focus(); }
    otp.forEach(function (inp, i) {
      inp.addEventListener("input", function () {
        var d = latin(inp.value).replace(/\D/g, "");
        inp.value = d.slice(-1);
        if (d && otp[i + 1]) otp[i + 1].focus();
      });
      inp.addEventListener("keydown", function (e) { if (e.key === "Backspace" && !inp.value && otp[i - 1]) { otp[i - 1].focus(); otp[i - 1].value = ""; } });
      inp.addEventListener("paste", function (e) {
        var t = latin((e.clipboardData || window.clipboardData).getData("text")).replace(/\D/g, "");
        if (!t) return; e.preventDefault();
        otp.forEach(function (o, k) { o.value = t[k] || ""; });
        otp[Math.min(t.length, otp.length) - 1].focus();
      });
    });
    f.addEventListener("click", function (e) {
      if (e.target.closest("[data-login-edit]")) back();
      if (e.target.closest("[data-login-resend]")) startTimer();
    });
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      if (card.dataset.loading === "true") return;
      if (!s2.hidden) {
        var code = otp.map(function (o) { return o.value; }).join("");
        if (code.length < otp.length) { err.textContent = "کد تایید ۴ رقمی را کامل وارد کنید."; return; }
        err.textContent = ""; busy(true);
        setTimeout(function () {
          var ph = latin($("[name=phone]", f).value), us = users();
          W("caseline-session", ph); if (!us[ph]) { us[ph] = {}; W("caseline-users", us); }
          go(us[ph].first ? "orders" : "profile");
        }, 1200);
        return;
      }
      var v = latin($("[name=phone]", f).value);
      if (!/^09\d{9}$/.test(v)) { err.textContent = "شماره موبایل را به‌صورت ۰۹۱۲۳۴۵۶۷۸۹ وارد کنید."; return; }
      err.textContent = ""; busy(true);
      setTimeout(function () {
        busy(false); s1.hidden = true; s2.hidden = false;
        $("[data-login-phone]", f).textContent = v; btn.textContent = "تایید"; startTimer(); otp[0].focus();
      }, 1200);
    });
  }


  /* ---------- account panel ---------- */
  function initAccount() {
    var page = $("[data-account-page]"); if (!page) return;
    if (!session()) { go("account"); return; }
    var lo = $("[data-logout]"); if (lo) lo.addEventListener("click", function () { W("caseline-session", null); go("home"); });

    var pf = $("[data-profile-form]");
    if (pf) {
      var m = me() || {};
      pf.first.value = m.first || ""; pf.last.value = m.last || "";
      pf.addEventListener("submit", function (e) {
        e.preventDefault();
        var us = users(), cur = us[session()] || {};
        cur.first = pf.first.value.trim(); cur.last = pf.last.value.trim(); cur.display = cur.display || (cur.first + " " + cur.last);
        us[session()] = cur; W("caseline-users", us); go("orders");
      });
      $("[data-profile-later]").addEventListener("click", function () { go("orders"); });
    }

    var oroot = $("[data-orders-root]");
    if (oroot) {
      var orders = J("caseline-orders", null);
      if (orders === null) { orders = [{ id: 30654, date: today(), total: 448000, title: "قاب سیلیکونی MagSafe iPhone 15 Pro Max", opt: "iPhone 15 Pro Max", status: "pending", sample: true }]; W("caseline-orders", orders); }
      var ST = { pending: "در انتظار پرداخت", processing: "در حال آماده‌سازی", done: "تحویل شد" };
      var card = function (o) {
        var btns = o.status === "pending" ? '<button class="cl-btn ord-pay" data-pay="' + o.id + '">پرداخت</button>' : o.status === "processing" ? '<button class="cl-btn ord-pay" data-recv="' + o.id + '">تایید دریافت</button>' : "";
        var note = o.status === "pending" ? '<div class="ord-note ord-warn">این سفارش هنوز پرداخت نشده است.</div>' : o.status === "processing" ? '<div class="ord-note ord-info">پرداخت انجام شد و سفارش شما در حال آماده‌سازی است.</div>' : "";
        return '<article class="ord" data-s="' + o.status + '"><header><div><h3>سفارش <b>#' + esc(o.id) + '</b>' + (o.sample ? '<em class="ord-tag">نمونه</em>' : "") + '</h3><div class="ord-meta"><span>' + o.date + '</span><span>' + toman(o.total) + '</span></div></div><span class="ord-st">' + ST[o.status] + '</span></header><p class="ord-title">' + esc(o.title) + '</p>' + (o.opt ? '<span class="ord-chip">' + esc(o.opt) + '</span>' : "") + note +
          '<div class="ord-btns">' + btns + '<a class="cl-btn cl-btn-ghost ord-sup" href="' + L("support") + '">پشتیبانی این سفارش</a></div></article>';
      };
      var drawOrders = function () {
        var act = orders.filter(function (o) { return o.status !== "done"; }), dn = orders.filter(function (o) { return o.status === "done"; });
        $("[data-orders-count]").textContent = fa(act.length);
        $("[data-orders-active]").innerHTML = act.length ? act.map(card).join("") : '<div class="cl-empty">سفارش فعالی ندارید. <a href="' + L("shop") + '">مشاهده فروشگاه</a></div>';
        var d = $("[data-orders-done]"); d.innerHTML = dn.length ? dn.map(card).join("") : "سفارش تمام‌شده‌ای ندارید.";
        d.classList.toggle("ord-list", dn.length > 0);
      };
      oroot.addEventListener("click", function (e) {
        var b = e.target.closest("[data-pay],[data-recv]"); if (!b) return;
        var id = +(b.dataset.pay || b.dataset.recv);
        orders.forEach(function (o) { if (o.id === id) o.status = b.dataset.pay ? "processing" : "done"; });
        W("caseline-orders", orders); drawOrders();
      });
      drawOrders();
    }

    var troot = $("[data-tickets-root]");
    if (troot) {
      var tickets = J("caseline-tickets", []), tf = $("[data-ticket-form]", troot);
      var drawTickets = function () {
        $("[data-ticket-list]", troot).innerHTML = tickets.map(function (t) { return '<article class="ord"><header><div><h3>' + esc(t.subject) + '</h3><div class="ord-meta"><span>' + t.date + '</span><span>تیکت #' + esc(t.id) + '</span></div></div><span class="ord-st" data-tk="1">در انتظار پاسخ</span></header><p class="ord-title" style="font-weight:400;color:var(--muted)">' + esc(t.message) + '</p></article>'; }).join("");
        $("[data-ticket-empty]", troot).hidden = tickets.length > 0;
      };
      $("[data-ticket-new]", troot).addEventListener("click", function () { tf.hidden = !tf.hidden; if (!tf.hidden) tf.subject.focus(); });
      $("[data-ticket-cancel]", troot).addEventListener("click", function () { tf.hidden = true; });
      tf.addEventListener("submit", function (e) {
        e.preventDefault();
        tickets.unshift({ id: Math.floor(1000 + Math.random() * 9000), subject: tf.subject.value.trim(), message: tf.message.value.trim(), date: today() });
        W("caseline-tickets", tickets); tf.reset(); tf.hidden = true; drawTickets();
      });
      drawTickets();
    }

    var ef = $("[data-edit-form]");
    if (ef) {
      var m2 = me() || {};
      ef.first.value = m2.first || ""; ef.last.value = m2.last || ""; ef.display.value = m2.display || ""; ef.email.value = m2.email || "";
      var msg = $("[data-edit-msg]", ef);
      $$("[data-eye]", ef).forEach(function (b) { b.addEventListener("click", function () { var i = b.parentNode.querySelector("input"); i.type = i.type === "password" ? "text" : "password"; }); });
      ef.addEventListener("submit", function (e) {
        e.preventDefault(); msg.dataset.ok = "";
        if (!ef.first.value.trim() || !ef.last.value.trim() || !ef.display.value.trim() || !ef.email.value.trim()) { msg.textContent = "لطفاً همه فیلدهای الزامی را پر کنید."; return; }
        if (ef.new.value || ef.new2.value) {
          if (ef.new.value.length < 6) { msg.textContent = "رمز عبور جدید باید حداقل ۶ کاراکتر باشد."; return; }
          if (ef.new.value !== ef.new2.value) { msg.textContent = "تکرار رمز عبور جدید یکسان نیست."; return; }
        }
        var us = users(); us[session()] = { first: ef.first.value.trim(), last: ef.last.value.trim(), display: ef.display.value.trim(), email: ef.email.value.trim() };
        W("caseline-users", us); ef.old.value = ef.new.value = ef.new2.value = "";
        msg.textContent = "تغییرات با موفقیت ذخیره شد."; msg.dataset.ok = "1";
      });
    }
  }
  function initHeaderUser() {
    $$("[data-user-dot]").forEach(function (d) { d.hidden = !session(); });
  }

  /* ---------- support chat widget ---------- */
  var chat, chatMsgs = [];
  var EMOJI = "\u{1F60A}";
  function ensureChat() {
    if (chat) return chat;
    chat = document.createElement("div");
    chat.className = "cl-chat"; chat.dir = "rtl"; chat.hidden = true;
    chat.innerHTML = '<header><span class="cl-av"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/></svg></span><div><b>پشتیبانی سایت</b><small>پاسخگوی سوالات شما هستیم</small></div><button class="cl-chat-x" data-chat-close aria-label="بستن">✕</button></header>' +
      '<div class="cl-chat-body" data-chat-body></div>' +
      '<form class="cl-chat-form" data-chat-form><button type="submit" class="cl-send" aria-label="ارسال" hidden>➤</button><input id="cl-chat-input" placeholder="پیامی بنویسید…" autocomplete="off"><button type="button" class="cl-ico" data-chat-emoji aria-label="ایموجی">☺</button><button type="button" class="cl-ico" data-chat-attach aria-label="پیوست">📎</button></form>';
    document.body.appendChild(chat);
    chatMsgs = [{ from: "bot", text: "سلام! 👋 به پشتیبانی کیس‌لاین خوش آمدید. چطور می‌توانیم کمکتان کنیم؟" }];
    var input = $("#cl-chat-input", chat), send = $(".cl-send", chat);
    input.addEventListener("input", function () { send.hidden = !input.value.trim(); });
    $("[data-chat-emoji]", chat).addEventListener("click", function () { input.value += EMOJI; send.hidden = false; input.focus(); });
    $("[data-chat-form]", chat).addEventListener("submit", function (e) {
      e.preventDefault();
      var v = input.value.trim(); if (!v) return;
      chatMsgs.push({ from: "me", text: v }); input.value = ""; send.hidden = true; renderChat();
      setTimeout(function () {
        chatMsgs.push({ from: "bot", text: "پیام شما دریافت شد. برای پاسخ سریع‌تر می‌توانید از تلگرام پشتیبانی هم استفاده کنید: @caseline_support" }); renderChat();
      }, 900);
    });
    return chat;
  }
  function renderChat() {
    var b = $("[data-chat-body]", chat);
    b.innerHTML = chatMsgs.map(function (m) { return '<div class="cl-msg cl-' + m.from + '">' + esc(m.text) + '</div>'; }).join("");
    b.scrollTop = b.scrollHeight;
  }
  function toggleChat() {
    ensureChat();
    chat.hidden = !chat.hidden;
    if (!chat.hidden) { renderChat(); setTimeout(function () { $("#cl-chat-input", chat).focus(); }, 30); }
  }

  /* ---------- delegation ---------- */
  document.addEventListener("click", function (e) {
    var t = e.target.closest ? e.target : e.target.parentNode, el;
    if ((el = t.closest("[data-cart-btn]"))) { e.preventDefault(); return openCart(); }
    if ((el = t.closest("[data-chat-btn]"))) { e.preventDefault(); return toggleChat(); }
    if ((el = t.closest("[data-chat-close]"))) { chat.hidden = true; return; }
    if ((el = t.closest("[data-search-btn]"))) { e.preventDefault(); return openSearch(); }
    if ((el = t.closest("[data-buy]"))) { if (!el.disabled) add(); return; }
    if ((el = t.closest("[data-close]"))) { return closeAll(); }
    if ((el = t.closest("[data-qty-set]"))) {
      var c = cart().slice(), i = +el.dataset.qtySet; c[i] = Object.assign({}, c[i], { qty: Math.max(1, c[i].qty + +el.dataset.d) }); return save(c);
    }
    if ((el = t.closest("[data-rm]"))) { var c2 = cart().slice(); c2.splice(+el.dataset.rm, 1); return save(c2); }
  });
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("[data-account-link]");
    if (a && session()) { e.preventDefault(); e.stopPropagation(); go(me() && me().first ? "orders" : "profile"); }
  }, true);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeAll(); });
  document.addEventListener("submit", function (e) {
    var f = e.target;
    if (f.matches && f.matches("[data-search-form]")) { e.preventDefault(); openSearch($("input", f).value); }
  });
  window.addEventListener("storage", function () { mem = load(); refresh(); });
  refresh(); initCheckout(); initLogin(); initAccount(); initHeaderUser();
})();
