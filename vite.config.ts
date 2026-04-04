import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { sentryVitePlugin } from '@sentry/vite-plugin'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'public',
      filename: 'sw.js',
      injectManifest: {
        injectionPoint: undefined
      },
      includeAssets: ['icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'LoftDesk',
        short_name: 'LoftDesk',
        description: 'Branżowy system dla firm budowlanych i wykończeniowych: kosztorysy, umowy, faktury, KSeF, projekty i portal klienta.',
        theme_color: '#202125',
        background_color: '#202125',
        display: 'standalone',
        lang: 'pl',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          { src: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }
        ]
      },
      devOptions: { enabled: false }
    }),
    // Sentry source map upload — only when auth token + org + project are set (Netlify build)
    ...(process.env.SENTRY_AUTH_TOKEN
      ? [sentryVitePlugin({
          org: process.env.SENTRY_ORG,
          project: process.env.SENTRY_PROJECT,
          authToken: process.env.SENTRY_AUTH_TOKEN,
          release: {
            name: process.env.COMMIT_REF
              ? `loftdesk@${process.env.COMMIT_REF.slice(0, 8)}`
              : undefined,
          },
          sourcemaps: {
            filesToDeleteAfterUpload: ['./dist/**/*.map'],
          },
          telemetry: false,
        })]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@docs-legal': path.resolve(__dirname, './docs/legal'),
    },
  },
  define: {
    'import.meta.env.VITE_COMMIT_REF': JSON.stringify(process.env.COMMIT_REF ?? ''),
  },
  // Proxy Netlify Functions so OCR works in dev mode (requires `netlify dev` on :8888)
  server: {
    // strictPort: fail immediately if :5173 is taken instead of silently moving to :5174.
    // This surfaces stale dev-server processes that would otherwise cause split-brain
    // (two Vite instances, each exposing a different code state).
    strictPort: true,
    port: 5173,
    proxy: {
      '/.netlify/functions': {
        target: 'http://localhost:8888',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          router: ['@tanstack/react-router'],
          query: ['@tanstack/react-query'],
          supabase: ['@supabase/supabase-js']
        }
      }
    }
  }
})
