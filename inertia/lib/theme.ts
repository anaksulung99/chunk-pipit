import type { App } from 'vue'

export default {
  install(_app: App) {
    if (typeof window !== 'undefined') {
      const themeStore = useThemeStore()

      themeStore.applyTheme(themeStore.darkMode as 'dark' | 'light')
    }
  },
}
