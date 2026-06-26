export const useThemeStore = defineStore('theme', () => {
  const darkMode = useLocalStorage<'dark' | 'light'>('darkMode', 'light')
  const prefersDark = usePreferredDark()

  if (typeof window !== 'undefined' && !darkMode.value) {
    darkMode.value = prefersDark.value ? 'dark' : 'light'
  }

  function setTheme(theme: 'dark' | 'light') {
    darkMode.value = theme
    applyTheme(theme)
  }

  function toggleTheme() {
    const newTheme = darkMode.value === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)
  }

  function applyTheme(theme: 'dark' | 'light') {
    if (typeof window !== 'undefined') {
      document.documentElement.classList.toggle('dark', theme === 'dark')
      document.documentElement.style.colorScheme = theme

      const meta = document.querySelector('meta[name="theme-color"]')
      if (meta) {
        meta.setAttribute('content', theme === 'dark' ? '#1a1a1a' : '#ffffff')
      }
    }
  }

  watch(
    darkMode,
    (newTheme) => {
      applyTheme(newTheme)
    },
    { immediate: true }
  )

  if (typeof window !== 'undefined') {
    nextTick(() => {
      applyTheme(darkMode.value)
    })
  }

  return {
    darkMode: readonly(darkMode),
    isDark: computed(() => darkMode.value === 'dark'),
    isLight: computed(() => darkMode.value === 'light'),
    applyTheme,
    setTheme,
    toggleTheme,
  }
})
