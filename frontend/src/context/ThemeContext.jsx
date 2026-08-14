import { createContext, useContext, useState, useEffect } from "react"

const ThemeContext = createContext(null)

const getInitialTheme = () => {
  const saved = localStorage.getItem("theme")
  if (["light", "dark", "system"].includes(saved)) return saved
  return "system"
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme)
  const [systemTheme, setSystemTheme] = useState(() => (
    window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light"
  ))
  const resolvedTheme = theme === "system" ? systemTheme : theme

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-color-scheme: dark)")
    if (!media) return undefined

    const syncSystemTheme = (event) => setSystemTheme(event.matches ? "dark" : "light")
    media.addEventListener("change", syncSystemTheme)
    return () => media.removeEventListener("change", syncSystemTheme)
  }, [])

  useEffect(() => {
    const root = document.documentElement
    if (resolvedTheme === "dark") {
      root.classList.add("dark")
      root.style.colorScheme = "dark"
    } else {
      root.classList.remove("dark")
      root.style.colorScheme = "light"
    }
    localStorage.setItem("theme", theme)
  }, [theme, resolvedTheme])

  const toggleTheme = () => setTheme(resolvedTheme === "dark" ? "light" : "dark")

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
