/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#2563EB",
          light: "#3B82F6",
          dark: "#1D4ED8",
          50: "#EFF6FF",
          100: "#DBEAFE",
          200: "#BFDBFE",
          300: "#93C5FD",
          400: "#60A5FA",
          500: "#3B82F6",
          600: "#2563EB",
          700: "#1D4ED8",
          800: "#1E40AF",
          900: "#1E3A8A",
        },
        secondary: { DEFAULT: "#3B82F6", light: "#60A5FA", dark: "#2563EB" },
        accent: { DEFAULT: "#14B8A6", light: "#2DD4BF", dark: "#0D9488" },
        success: { DEFAULT: "#10B981", light: "#34D399", dark: "#059669" },
        warning: { DEFAULT: "#F59E0B", light: "#FBBF24", dark: "#D97706" },
        danger: { DEFAULT: "#EF4444", light: "#F87171", dark: "#DC2626" },
        surface: {
          light: "#F8FAFC",
          dark: "#0F172A",
        },
        brand: { DEFAULT: "#2563EB", dark: "#1D4ED8", light: "#3B82F6" },
        load: { low: "#10B981", medium: "#F59E0B", high: "#EF4444" },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        display: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
      borderRadius: {
        xl: "0.75rem",
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        sm: "0 1px 2px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04)",
        DEFAULT: "0 1px 3px rgba(15, 23, 42, 0.08), 0 4px 12px rgba(15, 23, 42, 0.05)",
        md: "0 2px 4px rgba(15, 23, 42, 0.08), 0 8px 24px rgba(15, 23, 42, 0.06)",
        lg: "0 4px 8px rgba(15, 23, 42, 0.08), 0 12px 40px rgba(15, 23, 42, 0.08)",
        xl: "0 8px 16px rgba(15, 23, 42, 0.08), 0 24px 64px rgba(15, 23, 42, 0.10)",
        "glow-primary": "0 0 0 1px rgba(37, 99, 235, 0.12), 0 4px 24px rgba(37, 99, 235, 0.15)",
        "glow-accent": "0 0 0 1px rgba(20, 184, 166, 0.12), 0 4px 24px rgba(20, 184, 166, 0.15)",
      },
      backdropBlur: {
        xs: "2px",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "pulse-slow": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.4s ease-out",
        "fade-in-up": "fade-in-up 0.5s ease-out",
        "scale-in": "scale-in 0.3s ease-out",
        shimmer: "shimmer 2s linear infinite",
        "pulse-slow": "pulse-slow 3s ease-in-out infinite",
        float: "float 4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
}
