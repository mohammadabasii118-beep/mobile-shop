/* Shop behaviour: category filter (also via #hash), phone-model filter, sort, load-more on scroll. */
(function () {
  var root = document.querySelector("[data-shop]");
  if (!root) return;
  var grid = root.querySelector("[data-grid]");
  var items = [].slice.call(grid.querySelectorAll("[data-item]"));
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
  var fa = function (n) { return n.toLocaleString("fa-IR"); };
  var STEP = 6, cat = "all", sub = "", sort = "default", model = "", shown = 12, loading = false;

  var sorters = {
    default: function (a, b) { return +a.dataset.idx - +b.dataset.idx; },
    popular: function (a, b) { return +b.dataset.pop - +a.dataset.pop; },
    rating: function (a, b) { return +b.dataset.rating - +a.dataset.rating; },
    newest: function (a, b) { return +b.dataset.new - +a.dataset.new || +a.dataset.idx - +b.dataset.idx; },
    asc: function (a, b) { return +a.dataset.price - +b.dataset.price; },
    desc: function (a, b) { return +b.dataset.price - +a.dataset.price; }
  };
  function matches() {
    return items.filter(function (p) {
      return (cat === "all" || p.dataset.cat === cat) && (!sub || p.dataset.sub === sub) && (!model || p.dataset.compat === model);
    }).sort(sorters[sort]);
  }
  function render() {
    var list = matches();
    items.forEach(function (p) { p.hidden = true; });
    list.forEach(function (p, i) { grid.appendChild(p); p.hidden = i >= shown; });
    catBtns.forEach(function (b) { b.dataset.active = String(b.dataset.catBtn === cat && !sub); });
    subBoxes.forEach(function (x) { x.dataset.open = String(x.dataset.subsOf === cat); });
    subBtns.forEach(function (b) { b.dataset.active = String(b.dataset.subBtn === sub); });
    var vis = Math.min(shown, list.length);
    range.textContent = list.length ? "نمایش ۱–" + fa(vis) + " از " + fa(list.length) + " نتیجه" : "نتیجه‌ای یافت نشد";
    empty.hidden = list.length > 0;
  }
  function check() {
    if (loading || matches().length <= shown) return;
    if (sentinel.getBoundingClientRect().top > (window.innerHeight || 800) + 200) return;
    loading = true; loader.hidden = false;
    setTimeout(function () { shown += STEP; loading = false; loader.hidden = true; render(); check(); }, 900);
  }
  function setCat(c, sb) { cat = c; sub = sb || ""; shown = 12; render(); check(); }
  catBtns.forEach(function (b) { b.addEventListener("click", function () { setCat(b.dataset.catBtn); }); });
  subBtns.forEach(function (b) { b.addEventListener("click", function () { setCat(b.parentNode.dataset.subsOf, b.dataset.subBtn); }); });
  sortBtns.forEach(function (b) {
    b.addEventListener("click", function () {
      sort = b.dataset.sort; sortLabel.textContent = b.textContent.trim();
      sortBtns.forEach(function (x) { x.dataset.active = String(x === b); });
      if (sortMenu) sortMenu.open = false;
      shown = 12; render(); check();
    });
  });
  if (modelSel) modelSel.addEventListener("change", function () { model = modelSel.value; shown = 12; render(); check(); });
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
  items.forEach(function (p, i) { p.dataset.idx = i; });
  render(); fromHash(); check();
})();
