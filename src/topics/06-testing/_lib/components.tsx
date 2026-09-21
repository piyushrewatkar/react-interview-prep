import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

/* ===========================================================================
   The components and hooks under test.

   Deliberately small and deliberately realistic: each one has the feature that
   makes its category of test interesting — a form with validation, an async
   fetch, a context-dependent component, a hook with a timer.

   The tests live in `../__tests__/` and really do run: `npm test`.
   =========================================================================== */

/* --- 1. A login form. Accessible by design, which is what makes it easy to
       test the way a user experiences it. --------------------------------- */

export function LoginForm({ onSubmit }: { onSubmit: (email: string, password: string) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!email.includes('@')) {
          setError('Please enter a valid email address.')
          return
        }
        if (password.length < 8) {
          setError('Password must be at least 8 characters.')
          return
        }
        setError(null)
        onSubmit(email, password)
      }}
      noValidate
    >
      <label htmlFor="login-email">Email</label>
      <input
        id="login-email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <label htmlFor="login-password">Password</label>
      <input
        id="login-password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      {/* role="alert" means the error is announced by screen readers AND is
          findable in tests with getByRole('alert') — the same affordance
          serving both. */}
      {error && <p role="alert">{error}</p>}

      <button type="submit">Sign in</button>
    </form>
  )
}

/* --- 2. A component that fetches. ---------------------------------------- */

export type Product = { id: number; title: string; price: number }

export function ProductList({ category }: { category: string }) {
  const [products, setProducts] = useState<Product[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false
    setProducts(null)
    setError(null)

    fetch(`/api/products?category=${category}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Request failed with ${r.status}`)
        return r.json() as Promise<Product[]>
      })
      .then((data) => {
        if (!ignore) setProducts(data)
      })
      .catch((e: Error) => {
        if (!ignore) setError(e.message)
      })

    return () => {
      ignore = true
    }
  }, [category])

  if (error) return <p role="alert">{error}</p>
  if (products === null) return <p>Loading products…</p>
  if (products.length === 0) return <p>No products in {category}.</p>

  return (
    <ul aria-label={`${category} products`}>
      {products.map((p) => (
        <li key={p.id}>
          {p.title} — £{p.price.toFixed(2)}
        </li>
      ))}
    </ul>
  )
}

/* --- 3. A context and a component that depends on it. -------------------- */

type Theme = 'light' | 'dark'
type ThemeContextValue = { theme: Theme; toggle: () => void }

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

export function ThemeProvider({
  children,
  initial = 'light',
}: {
  children: ReactNode
  initial?: Theme
}) {
  const [theme, setTheme] = useState<Theme>(initial)
  const toggle = useCallback(() => setTheme((t) => (t === 'light' ? 'dark' : 'light')), [])
  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}

export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  return (
    <button onClick={toggle} aria-pressed={theme === 'dark'}>
      {theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
    </button>
  )
}

/* --- 4. A custom hook with a timer. -------------------------------------- */

export function useCountdown(from: number) {
  const [seconds, setSeconds] = useState(from)
  const [isRunning, setIsRunning] = useState(false)

  useEffect(() => {
    if (!isRunning) return
    const id = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          setIsRunning(false)
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [isRunning])

  const start = useCallback(() => setIsRunning(true), [])
  const reset = useCallback(() => {
    setIsRunning(false)
    setSeconds(from)
  }, [from])

  return { seconds, isRunning, start, reset, isDone: seconds === 0 }
}

/* --- 5. A disclosure, for testing interaction over implementation. ------- */

export function Accordion({ title, children }: { title: string; children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const panelId = `panel-${title.replace(/\s+/g, '-').toLowerCase()}`

  return (
    <div>
      <button aria-expanded={isOpen} aria-controls={panelId} onClick={() => setIsOpen((v) => !v)}>
        {title}
      </button>
      <div id={panelId} hidden={!isOpen}>
        {children}
      </div>
    </div>
  )
}
