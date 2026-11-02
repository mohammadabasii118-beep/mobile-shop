import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dark Luxury palette
        ink: {
          950: "#050506",
          900: "#0a0a0c",
          850: "#0f0f12",
          800: "#141418",
          700: "#1c1c22",
          600: "#26262e",
        },
        silver: {
          50: "#f7f8fa",
          100: "#e9ebef",
          200: "#d2d6dd",
          300: "#b4bac4",
          400: "#8f97a6",
          500: "#6f7686",
        },
        accent: {
          // metallic platinum/ice highlight
          DEFAULT: "#cfd6e4",
          glow: "#aeb9d6",
        },
      },
      fontFamily: {
        sans: ["var(--font-vazir)", "system-ui", "sans-serif"],
        display: ["var(--font-vazir)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        luxe: "0 24px 60px -20px rgba(0,0,0,0.75)",
        "inner-top": "inset 0 1px 0 0 rgba(255,255,255,0.06)",
        glow: "0 0 40px -8px rgba(174,185,214,0.35)",
      },
      backgroundImage: {
        "metal": "linear-gradient(135deg,#f7f8fa 0%,#b4bac4 35%,#6f7686 55%,#e9ebef 80%,#8f97a6 100%)",
        "radial-fade": "radial-gradient(ellipse at top,rgba(174,185,214,0.12),transparent 60%)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.7s cubic-bezier(0.22,1,0.36,1) both",
        float: "float 6s ease-in-out infinite",
        shimmer: "shimmer 3s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
