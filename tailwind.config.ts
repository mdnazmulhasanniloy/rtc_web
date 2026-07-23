import type { Config } from "tailwindcss";
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: { extend: {
    colors: { ink: "#080b12", panel: "#10141f", line: "#232838", lime: "#c8ff5a", violet: "#8b5cf6" },
    fontFamily: { sans: ["var(--font-jakarta)", "sans-serif"] },
    boxShadow: { soft: "0 18px 60px rgba(0,0,0,.28)" }
  }}, plugins: []
} satisfies Config;
