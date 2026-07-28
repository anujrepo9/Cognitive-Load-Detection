/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#6C63FF", dark: "#4f48c4" },
        load: { low: "#22c55e", medium: "#f59e0b", high: "#ef4444" },
      },
    },
  },
  plugins: [],
}
