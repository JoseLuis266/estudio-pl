import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './', // funciona en cualquier subruta (GitHub Pages: /lab/)
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Oposición Policía Local Illes Balears',
        short_name: 'Estudio PL',
        description: 'Memorización y repetición espaciada para Policía Local de Illes Balears',
        lang: 'es', start_url: '.', scope: '.', display: 'standalone',
        background_color: '#0b1220', theme_color: '#0b1220',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,json}'] }
    })
  ],
  test: { environment: 'node', include: ['tests/**/*.test.ts'] }
})
