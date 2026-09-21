/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#0A0A0A",
          light: "#1A1A1A",
          dark: "#000000",
          50:  "#F7F7F7",
          100: "#EFEFEF",
          200: "#DCDCDC",
          300: "#BDBDBD",
          400: "#989898",
          500: "#7C7C7C",
          600: "#656565",
          700: "#525252",
          800: "#3D3D3D",
          900: "#0A0A0A",
        },
        // Single accent — a precise blue
        accent: {
          DEFAULT: "#0066FF",
          light:   "#3385FF",
          dark:    "#0052CC",
        },
        secondary: { DEFAULT: "#0066FF", light: "#3385FF", dark: "#0052CC" },
        success:   { DEFAULT: "#16A34A", light: "#22C55E", dark: "#15803D" },
        warning:   { DEFAULT: "#CA8A04", light: "#EAB308", dark: "#A16207" },
        danger:    { DEFAULT: "#DC2626", light: "#EF4444", dark: "#B91C1C" },
        surface: {
          light: "#FFFFFF",
          dark:  "#0A0A0A",
        },
        brand: { DEFAULT: "#0066FF", dark: "#0052CC", light: "#3385FF" },
        load: { low: "#16A34A", medium: "#CA8A04", high: "#DC2626" },
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
        DEFAULT: "0px",
        sm:  "2px",
        md:  "4px",
        lg:  "4px",
        xl:  "4px",
        "2xl": "4px",
        "3xl": "4px",
        full: "9999px",
      },
      boxShadow: {
        sm:  "0 1px 0 0 rgba(0,0,0,0.06)",
        DEFAULT: "0 1px 3px rgba(0,0,0,0.08)",
        md:  "0 2px 8px rgba(0,0,0,0.07)",
        lg:  "0 4px 24px rgba(0,0,0,0.06)",
        xl:  "0 8px 48px rgba(0,0,0,0.08)",
        none: "none",
        // No glow shadows — Swiss style
        "glow-primary": "none",
        "glow-accent":  "none",
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
      },
      animation: {
        "fade-in":    "fade-in 0.2s ease-out",
        "fade-in-up": "fade-in-up 0.25s ease-out",
        shimmer:      "shimmer 1.5s linear infinite",
      },
    },
  },
  plugins: [],
}
