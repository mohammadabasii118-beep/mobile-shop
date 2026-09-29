/* Blog list behaviour: category filter + "load more" on scroll (loader shown only while loading). */
(function () {
  var root = document.querySelector("[data-blog]");
  if (!root) return;
  var posts = [].slice.call(root.querySelectorAll("[data-post]"));
  var chips = [].slice.call(root.querySelectorAll("[data-chip]"));
  var loader = root.querySelector("[data-loader]");
  var sentinel = root.querySelector("[data-sentinel]");
  var empty = root.querySelector("[data-empty]");
  var STEP = 3, cat = "all", shown = 9, loading = false;

  function filtered() { return posts.filter(function (p) { return cat === "all" || p.dataset.cat === cat; }); }
  function render() {
    var list = filtered();
    posts.forEach(function (p) { p.hidden = true; });
    list.forEach(function (p, i) { p.hidden = i >= shown; });
    chips.forEach(function (c) { c.dataset.active = String(c.dataset.chip === cat); });
    if (empty) empty.hidden = list.length > 0;
  }
  function more() { return filtered().length > shown; }
  function check() {
    if (loading || !more()) return;
    var r = sentinel.getBoundingClientRect();
    if (r.top > (window.innerHeight || 800) + 200) return;
    loading = true;
    loader.hidden = false;
    setTimeout(function () {
      shown += STEP;
      loading = false;
      loader.hidden = true;
      render();
      check();
    }, 900);
  }
  chips.forEach(function (c) {
    c.addEventListener("click", function () { cat = c.dataset.chip; shown = 9; render(); check(); });
  });
  window.addEventListener("scroll", check, { passive: true });
  document.addEventListener("scroll", check, true);
  window.addEventListener("resize", check);
  loader.hidden = true;
  render();
  check();
})();
