import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f2f4ff",
          100: "#e6e9ff",
          200: "#c3caff",
          300: "#9fa9ff",
          400: "#7a86ff",
          500: "#5b63f5",
          600: "#4548d1",
          700: "#3536a3",
          800: "#272877",
          900: "#1a1a50",
        },
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      boxShadow: {
        soft: "0 8px 30px -12px rgb(0 0 0 / 0.15)",
        glow: "0 0 0 1px rgb(91 99 245 / 0.15), 0 8px 24px -8px rgb(91 99 245 / 0.35)",
      },
    },
  },
  plugins: [],
};

export default config;
