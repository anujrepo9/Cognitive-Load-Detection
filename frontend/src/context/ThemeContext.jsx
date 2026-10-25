import { createContext, useContext, useEffect } from "react"

const ThemeContext = createContext({ resolvedTheme: "dark", toggleTheme: () => {} })

export function ThemeProvider({ children }) {
  useEffect(() => {
    document.documentElement.classList.add("dark")
    document.documentElement.classList.remove("light")
    localStorage.setItem("theme", "dark")
  }, [])

  return (
    <ThemeContext.Provider value={{ resolvedTheme: "dark", toggleTheme: () => {} }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}