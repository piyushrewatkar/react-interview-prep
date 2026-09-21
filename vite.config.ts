import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Note: we import `defineConfig` from `vitest/config` rather than `vite` so
// that the extra `test` key below is type-checked. This is the standard way
// to co-locate Vitest config with Vite config in a single file.
export default defineConfig({
  plugins: [react()],
  test: {
    // `globals: true` exposes describe/it/expect without importing them.
    // Real projects often set `globals: false` and import explicitly; we use
    // globals here so the test files read like Jest, which is what you are
    // most likely to be shown in an interview.
    globals: true,
    // React Testing Library needs a DOM. jsdom provides one in Node.
    environment: 'jsdom',
    // Runs before every test file: installs the jest-dom matchers and the
    // automatic cleanup between tests.
    setupFiles: ['./src/test/setup.ts'],
    // Only pick up tests, never the demo modules.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
