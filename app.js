(() => {
  const $ = s => document.querySelector(s);
  const fmt = n => n.toLocaleString("fa-IR");
  const SHOP = window.SHOP, CATS = window.CATEGORIES, PRODUCTS = window.PRODUCTS;
  let cart = JSON.parse(localStorage.getItem("cart") || "{}");
  let customer = null;
  document.title = SHOP.name + " | فروشگاه لوازم جانبی موبایل";

  // ---- منو ----
  const menu = $("#menuList");
  menu.innerHTML = `<li><a href="#" data-cat="all">🏠 همه محصولات</a></li>` + CATS.map(c => c.subs.length
    ? `<li><button data-toggle>${c.icon} ${c.name} <span>▾</span></button><ul>
        <li><a href="#" data-cat="${c.id}">همه ${c.name}</a></li>
        ${c.subs.map(s => `<li><a href="#" data-cat="${c.id}" data-sub="${s.id}">${s.name}</a></li>`).join("")}</ul></li>`
    : `<li><a href="#" data-cat="${c.id}">${c.icon} ${c.name}</a></li>`).join("");

  const openPanel = (el, on) => {
    el.classList.toggle("open", on);
    el.setAttribute("aria-hidden", !on);
    $("#overlay").hidden = !($("#drawer").classList.contains("open") || $("#cart").classList.contains("open"));
    $("#menuBtn").setAttribute("aria-expanded", $("#drawer").classList.contains("open"));
  };
  $("#menuBtn").onclick = () => openPanel($("#drawer"), true);
  $("#closeMenu").onclick = () => openPanel($("#drawer"), false);
  $("#cartBtn").onclick = () => openPanel($("#cart"), true);
  $("#closeCart").onclick = () => openPanel($("#cart"), false);
  $("#overlay").onclick = () => { openPanel($("#drawer"), false); openPanel($("#cart"), false); };
  document.addEventListener("keydown", e => { if (e.key === "Escape") $("#overlay").click(); });

  document.addEventListener("click", e => {
    const t = e.target.closest("[data-toggle]");
    if (t) return t.parentElement.classList.toggle("open");
    const a = e.target.closest("[data-cat]");
    if (a) { e.preventDefault(); show(a.dataset.cat, a.dataset.sub, a.textContent.trim()); openPanel($("#drawer"), false); scrollTo(0, 0); }
  });

  // ---- محصولات ----
  function show(cat, sub, title) {
    const list = PRODUCTS.filter(p => cat === "all" || (p.cat === cat && (!sub || p.sub === sub)));
    $("#listTitle").textContent = cat === "all" ? "همه محصولات" : title;
    $("#grid").innerHTML = list.map(p => `<div class="product"><div class="img">${p.emoji}</div>
      <h3>${p.name}</h3><div class="price">${fmt(p.price)} تومان</div>
      <button class="btn" data-add="${p.id}">افزودن به سبد</button></div>`).join("") || "<p>محصولی یافت نشد.</p>";
  }
  $("#grid").onclick = e => { const id = e.target.dataset.add; if (id) { cart[id] = (cart[id] || 0) + 1; save(); toast("به سبد اضافه شد"); } };

  // ---- سبد ----
  const total = () => Object.entries(cart).reduce((s, [id, q]) => s + PRODUCTS.find(p => p.id == id).price * q, 0);
  function save() { localStorage.setItem("cart", JSON.stringify(cart)); render(); }
  function render() {
    $("#cartCount").textContent = fmt(Object.values(cart).reduce((a, b) => a + b, 0));
    $("#cartItems").innerHTML = Object.entries(cart).map(([id, q]) => {
      const p = PRODUCTS.find(p => p.id == id);
      return `<div class="ci"><span>${p.name}</span><button data-q="${id}" data-d="-1">−</button><b>${fmt(q)}</b><button data-q="${id}" data-d="1">+</button></div>`;
    }).join("") || "<p>سبد خرید خالی است.</p>";
    $("#cartTotal").textContent = fmt(total());
  }
  $("#cartItems").onclick = e => {
    const id = e.target.dataset.q; if (!id) return;
    cart[id] += +e.target.dataset.d; if (cart[id] <= 0) delete cart[id]; save();
  };

  // ---- پرداخت کارت‌به‌کارت ----
  const step = n => [1, 2, 3].forEach(i => $("#step" + i).hidden = i !== n);
  $("#checkoutBtn").onclick = () => {
    if (!total()) return toast("سبد خرید خالی است");
    step(1); $("#modal").hidden = false; openPanel($("#cart"), false);
  };
  $("#closeModal").onclick = () => $("#modal").hidden = true;
  $("#orderForm").onsubmit = e => {
    e.preventDefault(); customer = Object.fromEntries(new FormData(e.target));
    $("#payAmount").textContent = fmt(total());
    $("#cardNum").textContent = SHOP.card.number;
    $("#cardOwner").textContent = `${SHOP.card.owner} — ${SHOP.card.bank}`;
    step(2);
  };
  $("#copyCard").onclick = () => {
    navigator.clipboard?.writeText(SHOP.card.number.replace(/-/g, "")).then(() => toast("شماره کارت کپی شد"), () => toast("کپی ناموفق بود"));
  };
  $("#payForm").onsubmit = e => {
    e.preventDefault();
    const tracking = new FormData(e.target).get("tracking");
    const code = "ORD-" + Date.now().toString(36).toUpperCase();
    const items = Object.entries(cart).map(([id, q]) => `${PRODUCTS.find(p => p.id == id).name} ×${q}`);
    const order = { code, customer, items, total: total(), tracking, status: "در انتظار تأیید پرداخت", date: new Date().toISOString() };
    const orders = JSON.parse(localStorage.getItem("orders") || "[]"); orders.push(order);
    localStorage.setItem("orders", JSON.stringify(orders));
    $("#orderCode").textContent = code;
    if (SHOP.telegram) {
      const msg = `سفارش ${code}\n${customer.name} - ${customer.phone}\n${customer.address}\n${items.join("\n")}\nمبلغ: ${fmt(order.total)} تومان\nپیگیری پرداخت: ${tracking}`;
      const l = $("#tgLink"); l.href = `https://t.me/${SHOP.telegram}?text=${encodeURIComponent(msg)}`; l.hidden = false;
    }
    cart = {}; save(); e.target.reset(); step(3);
  };

  function toast(m) { const t = $("#toast"); t.textContent = m; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 1800); }
  show("all"); render();
})();
