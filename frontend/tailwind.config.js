/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Refined Apple-inspired palette — keep brand identity (indigo) but
        // pair it with a more sophisticated surface system.
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
        // Apple-style semantic colors (slightly more vivid on dark)
        success: { DEFAULT: "#34c759", light: "#5ad87b", dark: "#28a745" },
        warning: { DEFAULT: "#ff9f0a", light: "#ffb340", dark: "#e08600" },
        danger:  { DEFAULT: "#ff3b30", light: "#ff6961", dark: "#d70015" },
        // Apple-style label & separator tokens (exposed to Tailwind utilities)
        ink: {
          DEFAULT:   "#1d1d1f", // system label (light)
          secondary: "#6e6e73", // secondary label
          tertiary:  "#86868b", // tertiary label
          quaternary:"#c7c7cc", // quaternary label
        },
        // Canvas surfaces (light/dark) — warmer and more refined than gray-50
        canvas: {
          light: "#f5f5f7", // Apple systemGroupedBackground (light)
          dark:  "#08080c", // near-black with cool tint
        },
        surface: {
          light: "#ffffff",
          dark:  "#0e0e14",
        },
        brand: { DEFAULT: "#6366f1", dark: "#4f46e5", light: "#818cf8" },
        load: { low: "#34c759", medium: "#ff9f0a", high: "#ff3b30" },
      },
      fontFamily: {
        // SF Pro / -apple-system first for native macOS/iOS feel; Inter as
        // cross-platform fallback. SF Pro Rounded for numeric displays.
        sans:    ["-apple-system", "BlinkMacSystemFont", "'SF Pro Text'", "'Inter'", "system-ui", "sans-serif"],
        display: ["-apple-system", "BlinkMacSystemFont", "'SF Pro Display'", "'Inter'", "system-ui", "sans-serif"],
        rounded: ["-apple-system", "BlinkMacSystemFont", "'SF Pro Rounded'", "'SF Pro Display'", "'Inter'", "system-ui", "sans-serif"],
        mono:    ["'SF Mono'", "'JetBrains Mono'", "'Fira Code'", "ui-monospace", "monospace"],
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "1rem" }],
      },
      // Unified corner-radius scale (Apple uses 8/10/12/16/20/28)
      borderRadius: {
        DEFAULT: "10px",
        sm:  "6px",
        md:  "10px",
        lg:  "14px",
        xl:  "18px",
        "2xl": "22px",
        "3xl": "28px",
        full: "9999px",
      },
      boxShadow: {
        // Soft, layered, Apple-style — never harsh
        sm:  "0 1px 2px rgba(0,0,0,0.04), 0 0 0 0.5px rgba(0,0,0,0.04)",
        DEFAULT: "0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.04), 0 0 0 0.5px rgba(0,0,0,0.04)",
        md:  "0 2px 4px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06), 0 0 0 0.5px rgba(0,0,0,0.05)",
        lg:  "0 4px 8px rgba(0,0,0,0.04), 0 16px 40px rgba(0,0,0,0.08), 0 0 0 0.5px rgba(0,0,0,0.06)",
        xl:  "0 8px 16px rgba(0,0,0,0.05), 0 24px 56px rgba(0,0,0,0.10), 0 0 0 0.5px rgba(0,0,0,0.07)",
        // Glass-specific highlights — inner light from top + soft outer
        "glass-light": "0 1px 0 rgba(255,255,255,0.9) inset, 0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.04), 0 0 0 0.5px rgba(0,0,0,0.05)",
        "glass-dark":  "0 1px 0 rgba(255,255,255,0.05) inset, 0 1px 2px rgba(0,0,0,0.4), 0 8px 24px rgba(0,0,0,0.3), 0 0 0 0.5px rgba(255,255,255,0.04)",
        "glow-primary": "0 0 24px rgba(99,102,241,0.25), 0 4px 16px rgba(99,102,241,0.12)",
        "glow-accent":  "0 0 24px rgba(139,92,246,0.25), 0 4px 16px rgba(139,92,246,0.12)",
        "glow-success": "0 0 20px rgba(52,199,89,0.25)",
        "glow-danger":  "0 0 20px rgba(255,59,48,0.25)",
      },
      spacing: {
        18: "4.5rem",
        22: "5.5rem",
      },
      keyframes: {
        "fade-in":         { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        "fade-in-up":       { "0%": { opacity: "0", transform: "translateY(8px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        shimmer:           { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition:  "200% 0" } },
        "pulse-ring":      { "0%": { transform: "scale(1)", opacity: "0.6" }, "100%": { transform: "scale(2.2)", opacity: "0" } },
        "gauge-pulse":      { "0%,100%": { opacity: "0.55" }, "50%": { opacity: "0.95" } },
        "spin-slow":        { "0%": { transform: "rotate(0deg)" }, "100%": { transform: "rotate(360deg)" } },
      },
      animation: {
        "fade-in":    "fade-in 0.25s ease-out",
        "fade-in-up": "fade-in-up 0.3s cubic-bezier(0.22, 1, 0.36, 1)",
        shimmer:      "shimmer 1.6s linear infinite",
        "pulse-ring": "pulse-ring 1.6s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "gauge-pulse": "gauge-pulse 2.4s ease-in-out infinite",
        "spin-slow":  "spin-slow 24s linear infinite",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "indigo-mesh": `
          radial-gradient(at 40% 20%, rgba(99,102,241,0.10) 0px, transparent 50%),
          radial-gradient(at 80% 0%, rgba(139,92,246,0.08) 0px, transparent 50%)
        `,
      },
    },
  },
  plugins: [],
}
