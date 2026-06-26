import { defineConfig } from 'vite'
import type { RollupLog, WarningHandlerWithDefault } from 'rollup'
import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import adonisjs from '@adonisjs/vite/client'
import inertia from '@adonisjs/inertia/vite'
import tailwindcss from '@tailwindcss/vite'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'

function toPosixPath(value: string) {
  return value.replace(/\\/g, '/')
}

function getRendererManualChunk(id: string) {
  const normalizedId = toPosixPath(id)

  if (!normalizedId.includes('/node_modules/')) {
    return undefined
  }

  if (
    normalizedId.includes('/node_modules/reka-ui/') ||
    normalizedId.includes('/node_modules/@internationalized/') ||
    normalizedId.includes('/node_modules/embla-carousel-vue/') ||
    normalizedId.includes('/node_modules/vaul-vue/') ||
    normalizedId.includes('/node_modules/vue-input-otp/')
  ) {
    return 'vendor-ui'
  }

  if (
    normalizedId.includes('/node_modules/@iconify/') ||
    normalizedId.includes('/node_modules/@lucide/') ||
    normalizedId.includes('/node_modules/vue3-flag-icons/')
  ) {
    return 'vendor-icons'
  }

  if (
    normalizedId.includes('/node_modules/date-fns/') ||
    normalizedId.includes('/node_modules/howler/')
  ) {
    return 'vendor-utils'
  }

  if (
    normalizedId.includes('/node_modules/@tanstack/') ||
    normalizedId.includes('/node_modules/@unovis/')
  ) {
    return 'vendor-data'
  }

  return undefined
}

function handleRollupWarning(warning: RollupLog, warn: WarningHandlerWithDefault) {
  const message = warning.message ?? ''
  const warningId =
    typeof warning.id === 'string'
      ? toPosixPath(warning.id)
      : Array.isArray(warning.ids)
        ? warning.ids.map((id) => toPosixPath(String(id))).join('|')
        : ''

  const isVueUsePureAnnotationNoise =
    message.includes('contains an annotation that Rollup cannot interpret') &&
    warningId.includes('/@vueuse/core/dist/index.js')

  if (isVueUsePureAnnotationNoise) {
    return
  }

  warn(warning, (w) => {
    console.warn(w)
  })
}

export default defineConfig(({ command }) => {
  const isDev = command === 'serve'
  const cspContent = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob:",
    "font-src 'self' data: https://fonts.gstatic.com",
    `connect-src 'self' ${[
      'local:',
      'https://api.iconify.design',
      'https://api.simplesvg.com',
      'https://api.unisvg.com',
      // Local API server
      'http://127.0.0.1:*',
      'http://localhost:*',
      // WebSocket for real-time campaign updates
      'ws://127.0.0.1:*',
      'ws://localhost:*',
    ]
      .filter(Boolean)
      .join(' ')}`,
    "media-src 'self' local: blob: data:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ].join('; ')

  return {
    publicDir: 'public',
    plugins: [
      vue({
        template: {
          transformAssetUrls: {
            base: null,
            includeAbsolute: false,
          },
        },
      }),
      tailwindcss(),
      {
        name: 'app-csp',
        transformIndexHtml(html) {
          if (isDev) {
            return html
          }

          return html.replace(
            '<meta charset="UTF-8" />',
            `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${cspContent}" />`
          )
        },
      },
      AutoImport({
        include: [/\.[tj]sx?$/, /\.vue$/, /\.vue\?vue/, /\.ts$/],
        imports: [
          'vue',
          'pinia',
          '@vueuse/core',
          '@vueuse/head',
          'vue-router',
          'vue-i18n',
          'pinia',
          '@vueuse/math',
          { '@inertiajs/vue3': ['usePage', 'useForm', 'router'] },
        ],
        dts: 'inertia/auto-imports.d.ts',
        dirs: [
          'inertia/composables',
          'inertia/types',
          'inertia/stores',
          'inertia/utils',
          'inertia/lib',
        ],
        vueTemplate: true,
      }),
      Components({
        dirs: ['inertia/components', 'inertia/layouts'],
        dts: 'inertia/components.d.ts',
        include: [/\.vue$/, /\.vue\?vue/, /\.vue\.[tj]sx?\?vue/],
      }),
      inertia({ ssr: { enabled: false, entrypoint: 'inertia/ssr.ts' } }),
      adonisjs({
        entrypoints: ['inertia/app.ts', 'inertia/css/app.css'],
        reload: ['resources/views/**/*.edge', 'inertia/pages/**/*.vue'],
      }),
    ],
    resolve: {
      alias: [
        {
          find: /^@iconify\/vue$/,
          replacement: fileURLToPath(new URL('./inertia/lib/iconify-offline.ts', import.meta.url)),
        },
        {
          find: '~/',
          replacement: `${import.meta.dirname}/inertia/`,
        },
        {
          find: '@generated',
          replacement: `${import.meta.dirname}/.adonisjs/client/`,
        },
        {
          find: '@/',
          replacement: `${new URL('./inertia/', import.meta.url).pathname}`,
        },
        {
          find: /^chromium-bidi(\/.*)?$/,
          replacement: fileURLToPath(new URL('./inertia/stubs/chromium-bidi.ts', import.meta.url)),
        },
      ],
    },
    server: {
      watch: {
        ignored: ['**/storage/**', '**/tmp/**', '**/.dbg/**', '**/.electron/**'],
      },
    },
    build: {
      assetsInlineLimit: 0,
      rollupOptions: {
        onwarn: handleRollupWarning,
        external: [
          'electron',
          // chromium-bidi is a transitive optional dep of playwright-core.
          // coreBundle.js contains require() calls to it that esbuild can't
          // resolve at build time. Mark it external so rollup leaves the calls
          // intact — they only resolve at runtime in the Electron main process.
          'chromium-bidi',
          /^chromium-bidi\//,
        ],
        output: {
          manualChunks: (id) => getRendererManualChunk(id),
        },
      },
    },
  }
})
