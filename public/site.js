/* Site-wide behaviour: server-backed cart drawer, search overlay, support chat widget.
   Prices and totals are always computed by the server (/api/cart); this file only renders them. */
(function () {
  if (location.pathname.indexOf("/admin") === 0) return; // the admin panel has its own scripts
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var fa = function (n) { return Number(n).toLocaleString("fa-IR"); };
  var toman = function (n) { return fa(n) + " تومان"; };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var thumb = function (h, img) { return '<span class="cl-thumb" style="background:' + (img ? "url(" + encodeURI(img) + ") center/cover" : "linear-gradient(160deg,hsl(" + h + " 80% 56%),hsl(" + ((h + 40) % 360) + " 70% 30%))") + '"></span>'; };
  function J(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function W(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function today() { return new Date().toLocaleDateString("fa-IR", { year: "numeric", month: "2-digit", day: "2-digit" }); }

  function api(method, url, body) {
    return fetch(url, { method: method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined, credentials: "same-origin" })
      .then(function (r) { return r.json().catch(function () { return { ok: false, error: { message: "خطای ارتباط با سرور." } }; }); });
  }

  /* ---------- cart (server is the source of truth) ---------- */
  var cart = { lines: [], count: 0, subtotal: 0, discount: 0, issues: [] };
  var notice = "";
  function setCart(c) { cart = c; refresh(); }
  function loadCart() { return api("GET", "/api/cart").then(function (r) { if (r.ok) setCart(r.data); }); }
  function refresh() {
    $$("[data-cart-count]").forEach(function (b) { b.textContent = fa(cart.count); b.hidden = !cart.count; });
    renderDrawer();
  }
  function cartCall(p) { return p.then(function (r) { if (r.ok) { notice = ""; setCart(r.data); } else { notice = (r.error && r.error.message) || "خطا"; renderDrawer(); } return r; }); }

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
    var body = $("[data-cart-body]", drawer), foot = $("[data-cart-foot]", drawer);
    var msg = notice ? '<div class="cl-note">' + esc(notice) + '</div>' : "";
    if (!cart.lines.length) {
      body.innerHTML = msg + '<p class="cl-empty">سبد خرید شما خالی است.</p>';
      foot.innerHTML = '<a class="cl-btn cl-btn-ghost" href="/shop">مشاهده فروشگاه</a>';
      return;
    }
    body.innerHTML = msg + cart.lines.map(function (l) {
      return '<div class="cl-line">' + thumb(l.hue, l.image) + '<div class="cl-info"><a href="/product/' + encodeURIComponent(l.slug) + '">' + esc(l.name) + '</a>' + (l.option ? '<small>' + esc(l.option) + '</small>' : "") + (l.priceType === "wholesale" ? '<small class="cl-ws">قیمت همکار</small>' : "") + (l.available ? "" : '<small class="cl-bad">موجودی کافی نیست</small>') +
        '<div class="cl-row"><span class="cl-qty"><button data-qty-set="' + l.id + '" data-q="' + (l.quantity + 1) + '" aria-label="افزایش">+</button><i>' + fa(l.quantity) + '</i><button data-qty-set="' + l.id + '" data-q="' + (l.quantity - 1) + '" aria-label="کاهش">−</button></span><b>' + toman(l.lineTotal) + '</b></div></div><button class="cl-rm" data-rm="' + l.id + '" aria-label="حذف">✕</button></div>';
    }).join("");
    foot.innerHTML = '<div class="cl-total"><span>جمع:</span><b>' + toman(cart.subtotal) + '</b></div><a class="cl-btn" href="/checkout">تسویه حساب</a><button class="cl-btn cl-btn-ghost" data-close>ادامه خرید</button>';
  }
  function openCart() { ensureDrawer(); renderDrawer(); drawer.hidden = false; document.documentElement.classList.add("cl-lock"); loadCart(); }
  function closeAll() { if (drawer) drawer.hidden = true; if (search) search.hidden = true; document.documentElement.classList.remove("cl-lock"); }

  function add() {
    var box = $("[data-product]"); if (!box) return;
    var sel = $("[data-model-select]"), v = sel ? sel.value : "";
    var qe = $("[data-qty]"), q = qe ? parseInt(qe.textContent, 10) || 1 : 1;
    var body = { productSlug: box.dataset.id, quantity: q };
    if (v.indexOf("m:") === 0) body.phoneModelId = v.slice(2); else if (v.indexOf("v:") === 0) body.variantId = v.slice(2);
    ensureDrawer(); cartCall(api("POST", "/api/cart/items", body)).then(function () { openCart(); });
  }

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
    fetch("/catalog.json").then(function (r) { return r.json(); }).then(function (j) { data = j; cb(); }).catch(function () { data = []; cb(); });
  }
  function runSearch(q) {
    var out = $("[data-results]", search);
    q = (q || "").trim().toLowerCase();
    if (!q) { out.innerHTML = '<p class="cl-empty">نام محصول یا مدل گوشی را بنویسید.</p>'; return; }
    withData(function () {
      var r = data.filter(function (p) { return (p.name + " " + p.brand + " " + (p.compat || "") + " " + p.catLabel).toLowerCase().indexOf(q) > -1; }).slice(0, 8);
      out.innerHTML = r.length ? r.map(function (p) {
        return '<a class="cl-res" href="' + "/product/" + encodeURIComponent(p.id) + '">' + thumb(p.hue, p.img) + '<span><b>' + esc(p.name) + (p.compat ? " " + esc(p.compat) : "") + '</b><small>' + esc(p.catLabel) + '</small></span><em>' + toman(p.price) + '</em></a>';
      }).join("") : '<p class="cl-empty">محصولی پیدا نشد.</p>';
    });
  }
  function openSearch(q) {
    ensureSearch(); search.hidden = false; document.documentElement.classList.add("cl-lock");
    var i = $("#cl-search-input", search); i.value = q || ""; runSearch(q); setTimeout(function () { i.focus(); }, 30);
  }


  /* ---------- support tickets (Phase 4: still stored in the browser) ---------- */
  function initTickets() {
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


  document.addEventListener("click", function (e) {
    var t = e.target.closest ? e.target : e.target.parentNode, el;
    if ((el = t.closest("[data-cart-btn]"))) { e.preventDefault(); return openCart(); }
    if ((el = t.closest("[data-chat-btn]"))) { e.preventDefault(); return toggleChat(); }
    if ((el = t.closest("[data-chat-close]"))) { chat.hidden = true; return; }
    if ((el = t.closest("[data-search-btn]"))) { e.preventDefault(); return openSearch(); }
    if ((el = t.closest("[data-buy]"))) { if (!el.disabled) add(); return; }
    if ((el = t.closest("[data-close]"))) { return closeAll(); }
    if ((el = t.closest("[data-qty-set]"))) { return cartCall(api("PATCH", "/api/cart/items/" + el.dataset.qtySet, { quantity: +el.dataset.q })); }
    if ((el = t.closest("[data-rm]"))) { return cartCall(api("DELETE", "/api/cart/items/" + el.dataset.rm)); }
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeAll(); });
  document.addEventListener("submit", function (e) {
    var f = e.target;
    if (f.matches && f.matches("[data-search-form]")) { e.preventDefault(); openSearch($("input", f).value); }
  });
  window.addEventListener("cl:cart-changed", loadCart);
  loadCart(); initTickets();
})();
