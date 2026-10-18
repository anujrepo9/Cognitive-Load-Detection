/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#6366f1",
          light:   "#818cf8",
          dark:    "#4f46e5",
          50:  "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
        },
        accent: {
          DEFAULT: "#8b5cf6",
          light:   "#a78bfa",
          dark:    "#7c3aed",
        },
        secondary: { DEFAULT: "#6366f1", light: "#818cf8", dark: "#4f46e5" },
        success:   { DEFAULT: "#10b981", light: "#34d399", dark: "#059669" },
        warning:   { DEFAULT: "#f59e0b", light: "#fbbf24", dark: "#d97706" },
        danger:    { DEFAULT: "#ef4444", light: "#f87171", dark: "#dc2626" },
        surface: {
          light: "#ffffff",
          dark:  "#080b14",
        },
        brand: { DEFAULT: "#6366f1", dark: "#4f46e5", light: "#818cf8" },
        load: { low: "#10b981", medium: "#f59e0b", high: "#ef4444" },
      },
      fontFamily: {
        sans:    ["'Inter'", "system-ui", "-apple-system", "sans-serif"],
        display: ["'Inter'", "system-ui", "-apple-system", "sans-serif"],
        mono:    ["'JetBrains Mono'", "'Fira Code'", "monospace"],
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "1rem" }],
      },
      borderRadius: {
        DEFAULT: "8px",
        sm:  "4px",
        md:  "8px",
        lg:  "12px",
        xl:  "16px",
        "2xl": "20px",
        "3xl": "24px",
        full: "9999px",
      },
      boxShadow: {
        sm:  "0 1px 2px rgba(0,0,0,0.05)",
        DEFAULT: "0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)",
        md:  "0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.06)",
        lg:  "0 10px 15px rgba(0,0,0,0.07), 0 4px 6px rgba(0,0,0,0.05)",
        xl:  "0 20px 25px rgba(0,0,0,0.07), 0 10px 10px rgba(0,0,0,0.04)",
        "glow-primary": "0 0 20px rgba(99,102,241,0.3), 0 4px 16px rgba(99,102,241,0.15)",
        "glow-accent":  "0 0 20px rgba(139,92,246,0.3), 0 4px 16px rgba(139,92,246,0.15)",
        "glow-success": "0 0 16px rgba(16,185,129,0.3)",
        "glow-danger":  "0 0 16px rgba(239,68,68,0.3)",
      },
      spacing: {
        18: "4.5rem",
        22: "5.5rem",
      },
      keyframes: {
        "fade-in": {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "fade-in-up": {
          "0%":   { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition:  "200% 0" },
        },
        "pulse-ring": {
          "0%":   { transform: "scale(1)",   opacity: "0.6" },
          "100%": { transform: "scale(2.2)", opacity: "0" },
        },
      },
      animation: {
        "fade-in":    "fade-in 0.2s ease-out",
        "fade-in-up": "fade-in-up 0.25s ease-out",
        shimmer:      "shimmer 1.5s linear infinite",
        "pulse-ring": "pulse-ring 1.4s ease-out infinite",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "indigo-mesh": `
          radial-gradient(at 40% 20%, rgba(99,102,241,0.12) 0px, transparent 50%),
          radial-gradient(at 80% 0%, rgba(139,92,246,0.08) 0px, transparent 50%)
        `,
      },
    },
  },
  plugins: [],
}
