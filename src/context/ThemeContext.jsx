import { createContext, useContext, useState, useEffect } from 'react'

const ThemeContext = createContext()

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('ain_theme')
    return saved || 'dark'
  })

  const [customTheme, setCustomTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('ain_custom_theme')
      return saved ? JSON.parse(saved) : null
    } catch { return null }
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('ain_theme', theme)

    // Apply or clear custom palette CSS variables
    const root = document.documentElement
    if (theme === 'custom' && customTheme?.palette) {
      for (const [prop, value] of Object.entries(customTheme.palette)) {
        root.style.setProperty(prop, value)
      }
    } else {
      // Clear any custom properties when switching away
      const customProps = ['--bg-primary', '--bg-secondary', '--bg-tertiary', '--bg-hover',
        '--text-primary', '--text-secondary', '--text-muted', '--border-color',
        '--accent-primary', '--accent-hover', '--accent-primary-faded', '--accent-bg']
      for (const prop of customProps) {
        root.style.removeProperty(prop)
      }
    }
  }, [theme, customTheme])

  const applyCustomTheme = (themeData) => {
    setCustomTheme(themeData)
    localStorage.setItem('ain_custom_theme', JSON.stringify(themeData))
    setTheme('custom')
  }

  const removeCustomTheme = () => {
    setCustomTheme(null)
    localStorage.removeItem('ain_custom_theme')
    if (theme === 'custom') setTheme('dark')
  }

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark')
  }

  const value = {
    theme,
    setTheme,
    toggleTheme,
    customTheme,
    applyCustomTheme,
    removeCustomTheme,
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}
