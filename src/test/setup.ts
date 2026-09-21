/**
 * Global test setup, referenced by `vite.config.ts` -> `test.setupFiles`.
 *
 * INTERVIEW NOTE
 * --------------
 * "What does your test setup file do?" is a common warm-up. Two things:
 *
 * 1. `@testing-library/jest-dom` adds DOM-aware assertions such as
 *    `toBeInTheDocument()`, `toBeDisabled()`, `toHaveAccessibleName()`.
 *    Without it you would be writing `expect(el !== null).toBe(true)`, which
 *    produces useless failure messages.
 *
 * 2. `cleanup()` unmounts anything React Testing Library rendered. RTL calls
 *    it automatically via `afterEach` when a global `afterEach` exists (which
 *    it does under Vitest with `globals: true`), but wiring it explicitly is
 *    clearer and is what you want if you ever set `globals: false`. Skipping
 *    cleanup is the #1 cause of "my second test sees two buttons" bugs.
 */
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
})
