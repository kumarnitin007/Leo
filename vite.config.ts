import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Read version from package.json
const packageJson = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf8'))
const appVersion = process.env.APP_VERSION || packageJson.version

// Generate static build time (captured at build time, not runtime)
const buildDate = new Date().toISOString().split('T')[0]
const buildTime = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })

export default defineConfig({
  plugins: [react()],
  server: {
    hmr: {
      overlay: true, // Show errors in browser overlay
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'encryption': [
            './src/utils/asymmetricEncryption',
            './src/utils/groupEncryption',
            './src/storage'
          ]
        }
      }
    }
  },
  define: {
    'import.meta.env.APP_VERSION': JSON.stringify(appVersion),
    'import.meta.env.BUILD_DATE': JSON.stringify(buildDate),
    'import.meta.env.BUILD_TIME': JSON.stringify(buildTime),
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/__tests__/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/types.ts'
      ]
    },
    reporters: ['verbose'],
    testTimeout: 10000,
  },
})
