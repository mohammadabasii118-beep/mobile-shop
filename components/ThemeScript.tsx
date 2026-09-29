// Inline, blocking script that sets `data-theme` on <html> before paint,
// based on a saved preference (localStorage) or the OS setting. This runs
// server-rendered as a plain <script> tag (not "use client") so it executes
// before React hydrates and before the page paints, avoiding a flash of the
// wrong theme.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var saved = localStorage.getItem("caseline_theme");
    if (saved === "dark" || saved === "light") {
      document.documentElement.setAttribute("data-theme", saved);
    }
  } catch (e) {}
})();
`;

export default function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />;
}
