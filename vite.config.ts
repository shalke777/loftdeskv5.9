import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

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
        theme_color: '#111827',
        background_color: '#f5f7fb',
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
    })
  ],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
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
