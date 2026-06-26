import './css/app.css'
import 'vue-sonner/style.css'
import { client } from '~/client'
import { createPinia } from 'pinia'
import Layout from '~/layouts/default.vue'
import { createInertiaApp } from '@inertiajs/vue3'
import { TuyauProvider } from '@adonisjs/inertia/vue'
import { createApp, type DefineComponent, h } from 'vue'
import { resolvePageComponent } from '@adonisjs/inertia/helpers'
import Vue3Toastify, { type ToastContainerOptions } from 'vue3-toastify'
import { VueDatePicker } from '@vuepic/vue-datepicker'
import VueTelInput from 'vue-tel-input'
import themePlugin from './lib/theme'

import 'vue3-toastify/dist/index.css'
import '@vuepic/vue-datepicker/dist/main.css'
import 'vue-tel-input/vue-tel-input.css'

const appName = import.meta.env.VITE_APP_NAME || 'Chunk Pipit Tool'

createInertiaApp({
  title: (title) => (title ? `${title} - ${appName}` : appName),
  resolve: (name) => {
    return resolvePageComponent(
      `./pages/${name}.vue`,
      import.meta.glob<DefineComponent>('./pages/**/*.vue'),
      Layout
    )
  },
  setup({ el, App, props, plugin }) {
    const app = createApp({
      render: () => h(TuyauProvider, { client }, { default: () => h(App, props) }),
    })
    app.use(plugin)
    app.use(createPinia())
    app.use(themePlugin)
    app.use(Vue3Toastify, {
      autoClose: 3000,
      theme: 'auto',
      transition: 'slide',
      position: 'top-right',
      newestOnTop: true,
      multiple: true,
    } as ToastContainerOptions)
    app.use(VueTelInput)
    app.component('VueDatePicker', VueDatePicker)

    const themeStore = useThemeStore()
    const initialTheme = (props.initialPage?.props as any)?.theme || 'light'
    if (!themeStore.darkMode) {
      themeStore.setTheme(initialTheme)
    }

    app.mount(el)
  },
  progress: {
    color: '#4B5563',
  },
})
