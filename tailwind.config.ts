import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        surface2: "var(--surface-2)",
        text: "var(--text)",
        muted: "var(--muted)",
        line: "var(--line)",
        ink: "var(--ink)",
      },
      fontFamily: { vazir: ["var(--font-vazir)", "Tahoma", "sans-serif"] },
    },
  },
  plugins: [],
};
export default config;
