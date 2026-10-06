/* Shop behaviour. The server renders the first page of the current filter (so the page is fast, crawlable and
   works without JS); this script only fetches further pages / other filters from the same /shop URL and swaps the
   product grid. Prices, stock and totals always come from the server-rendered cards. */
(function () {
  var root = document.querySelector("[data-shop]");
  if (!root) return;
  var grid = root.querySelector("[data-grid]");
  var catBtns = [].slice.call(root.querySelectorAll("[data-cat-btn]"));
  var subBtns = [].slice.call(root.querySelectorAll("[data-sub-btn]"));
  var subBoxes = [].slice.call(root.querySelectorAll("[data-subs-of]"));
  var sortBtns = [].slice.call(root.querySelectorAll("[data-sort]"));
  var sortLabel = root.querySelector("[data-sort-label]");
  var sortMenu = root.querySelector("[data-sort-menu]");
  var modelSel = root.querySelector("[data-model]");
  var range = root.querySelector("[data-range]");
  var loader = root.querySelector("[data-loader]");
  var sentinel = root.querySelector("[data-sentinel]");
  var empty = root.querySelector("[data-empty]");
  var fa = function (n) { return Number(n).toLocaleString("fa-IR"); };
  var d = root.dataset;
  var st = { cat: d.cat || "", sub: d.sub || "", model: d.model || "", sort: d.sort || "default", q: d.q || "", page: +d.page || 1, total: +d.total || 0 };
  var loading = false, ticket = 0;

  function qs(page) {
    var p = new URLSearchParams();
    if (st.cat) p.set("cat", st.cat);
    if (st.sub) p.set("sub", st.sub);
    if (st.model) p.set("model", st.model);
    if (st.q) p.set("q", st.q);
    if (st.sort && st.sort !== "default") p.set("sort", st.sort);
    if (page > 1) p.set("page", page);
    var s = p.toString();
    return "/shop" + (s ? "?" + s : "");
  }
  function count() { return grid.querySelectorAll("[data-item]").length; }
  function paint() {
    catBtns.forEach(function (b) { b.dataset.active = String((b.dataset.catBtn === (st.cat || "all")) && !st.sub); });
    subBoxes.forEach(function (x) { x.dataset.open = String(x.dataset.subsOf === st.cat); });
    subBtns.forEach(function (b) { b.dataset.active = String(b.dataset.subBtn === st.sub); });
    sortBtns.forEach(function (x) { x.dataset.active = String(x.dataset.sort === st.sort); });
    var shown = count();
    range.textContent = st.total ? "نمایش ۱–" + fa(shown) + " از " + fa(st.total) + " نتیجه" : "نتیجه‌ای یافت نشد";
    empty.hidden = st.total > 0;
  }
  // Fetches one page of the current filter (as HTML) and returns the product nodes + the total.
  function fetchPage(page) {
    return fetch(qs(page), { credentials: "same-origin", headers: { "x-shop-fragment": "1" } }).then(function (r) { return r.text(); }).then(function (html) {
      var doc = new DOMParser().parseFromString(html, "text/html");
      var g = doc.querySelector("[data-grid]"), r = doc.querySelector("[data-shop]");
      return { nodes: g ? [].slice.call(g.querySelectorAll("[data-item]")) : [], total: r ? +r.dataset.total : 0 };
    });
  }
  function reload() {
    var my = ++ticket; loading = true; loader.hidden = false; st.page = 1;
    history.replaceState(null, "", qs(1));
    fetchPage(1).then(function (res) {
      if (my !== ticket) return;
      grid.textContent = ""; res.nodes.forEach(function (n) { grid.appendChild(document.importNode(n, true)); });
      st.total = res.total; loading = false; loader.hidden = true; paint(); check();
    }).catch(function () { loading = false; loader.hidden = true; });
  }
  function more() {
    if (loading || count() >= st.total) return;
    var my = ++ticket; loading = true; loader.hidden = false;
    fetchPage(st.page + 1).then(function (res) {
      if (my !== ticket) return;
      res.nodes.forEach(function (n) { grid.appendChild(document.importNode(n, true)); });
      st.page += 1; st.total = res.total || st.total; loading = false; loader.hidden = true; paint(); check();
    }).catch(function () { loading = false; loader.hidden = true; });
  }
  function check() {
    if (loading || count() >= st.total) return;
    if (sentinel.getBoundingClientRect().top > (window.innerHeight || 800) + 300) return;
    more();
  }
  function setCat(c, sb) { st.cat = c === "all" ? "" : c; st.sub = sb || ""; reload(); }
  catBtns.forEach(function (b) { b.addEventListener("click", function () { setCat(b.dataset.catBtn); }); });
  subBtns.forEach(function (b) { b.addEventListener("click", function () { setCat(b.parentNode.dataset.subsOf, b.dataset.subBtn); }); });
  sortBtns.forEach(function (b) {
    b.addEventListener("click", function () {
      st.sort = b.dataset.sort; sortLabel.textContent = b.textContent.trim();
      if (sortMenu) sortMenu.open = false;
      reload();
    });
  });
  if (modelSel) modelSel.addEventListener("change", function () { st.model = modelSel.value; reload(); });
  // Links such as /shop#iphone (home page, menus) select a category or sub-category.
  function fromHash() {
    var h = decodeURIComponent((location.hash || "").slice(1));
    if (!h) return;
    if (catBtns.some(function (b) { return b.dataset.catBtn === h; })) return setCat(h);
    var sb = subBtns.filter(function (b) { return b.dataset.subBtn === h; })[0];
    if (sb) setCat(sb.parentNode.dataset.subsOf, h);
  }
  window.addEventListener("hashchange", fromHash);
  window.addEventListener("scroll", check, { passive: true });
  document.addEventListener("scroll", check, true);
  loader.hidden = true;
  paint(); if (location.hash) fromHash(); check();
})();
