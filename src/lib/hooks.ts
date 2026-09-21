import { useCallback, useEffect, useRef, useState } from 'react'

/* ===========================================================================
   A small library of custom hooks.

   These are the ones that come up by name in interviews ("have you written a
   useDebounce?"), and each one exists to demonstrate a different aspect of
   hook design:

     useToggle               - the trivial case; stable callbacks
     usePrevious             - a ref that lags one render behind
     useDebounce             - cleanup as the mechanism, not an afterthought
     useLocalStorage         - lazy init + syncing to an external system
     useEventListener        - the "latest ref" pattern for stable subscriptions
     useOnClickOutside       - composing two of the above
     useIntersectionObserver - a callback ref, because timing matters
     useMediaQuery           - useSyncExternalStore for a correct first paint

   Read them in that order; the difficulty increases.
   =========================================================================== */

/**
 * The simplest possible custom hook: local state plus a named operation.
 *
 * The `toggle` callback has an empty dependency array, which is only safe
 * because the updater form means it never reads `on` from the closure.
 */
export function useToggle(initial = false) {
  const [on, setOn] = useState(initial)
  const toggle = useCallback(() => setOn((v) => !v), [])
  // `setOn` itself is already stable, so returning it needs no wrapping.
  return [on, toggle, setOn] as const
}

/**
 * Returns the value from the PREVIOUS render.
 *
 * The trick is ordering: the effect runs after the render, so during render
 * `ref.current` still holds the value the effect stored last time.
 * Returns `undefined` on the first render, which is correct — there is no
 * previous value — and the type reflects that.
 */
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined)
  useEffect(() => {
    ref.current = value
  }, [value])
  return ref.current
}

/**
 * Returns a copy of `value` that only updates after `delay` ms of quiet.
 *
 * The whole implementation is the cleanup. Each time `value` changes, the
 * previous timer is cleared before a new one is set — so the state only ever
 * lands if a full `delay` passes with no further changes.
 */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id) // ← this line IS the debounce
  }, [value, delay])

  return debounced
}

/**
 * State that persists to localStorage.
 *
 * Two things to note. The initialiser is lazy, so we read and parse storage
 * once rather than on every render. And every access is wrapped in try/catch,
 * because localStorage throws in private browsing on some browsers, when the
 * quota is exceeded, and when the stored value is not valid JSON.
 */
export function useLocalStorage<T>(key: string, initialValue: T) {
  const [stored, setStored] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : initialValue
    } catch {
      return initialValue
    }
  })

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStored((prev) => {
        const next = value instanceof Function ? value(prev) : value
        try {
          window.localStorage.setItem(key, JSON.stringify(next))
        } catch {
          // Quota exceeded or storage disabled. The in-memory state still
          // updates, so the UI stays correct for this session.
        }
        return next
      })
    },
    [key],
  )

  return [stored, setValue] as const
}

/**
 * Attaches an event listener and keeps the handler fresh without
 * re-subscribing on every render.
 *
 * THE "LATEST REF" PATTERN, which is worth being able to explain:
 * if we put `handler` in the effect's dependency array, an inline arrow at the
 * call site would tear down and re-add the listener on every single render.
 * Instead we store the handler in a ref, update the ref on every render, and
 * have the (stable) listener read `ref.current` when it fires. The subscription
 * is established once; the behaviour is always current.
 *
 * This is exactly what the `useEffectEvent` RFC formalises.
 */
export function useEventListener<K extends keyof WindowEventMap>(
  type: K,
  handler: (event: WindowEventMap[K]) => void,
  element: Window | Document | HTMLElement | null = typeof window !== 'undefined' ? window : null,
) {
  const savedHandler = useRef(handler)

  // Keep the ref current. An effect (not a bare assignment) so that the render
  // itself stays pure.
  useEffect(() => {
    savedHandler.current = handler
  }, [handler])

  useEffect(() => {
    if (!element) return
    const listener = (event: Event) => savedHandler.current(event as WindowEventMap[K])
    element.addEventListener(type, listener)
    return () => element.removeEventListener(type, listener)
    // Note what is NOT here: `handler`. That is the point.
  }, [type, element])
}

/**
 * Calls `handler` when a pointerdown happens outside `ref`.
 *
 * `pointerdown` rather than `click` so the menu closes before a drag starts,
 * which is what native menus do. Note the `contains` check has to cope with
 * the target being removed from the DOM between the event and the check.
 */
export function useOnClickOutside<T extends HTMLElement>(
  ref: React.RefObject<T | null>,
  handler: (event: PointerEvent) => void,
) {
  const saved = useRef(handler)
  useEffect(() => {
    saved.current = handler
  }, [handler])

  useEffect(() => {
    const listener = (event: PointerEvent) => {
      const el = ref.current
      if (!el || el.contains(event.target as Node)) return
      saved.current(event)
    }
    document.addEventListener('pointerdown', listener)
    return () => document.removeEventListener('pointerdown', listener)
  }, [ref])
}

/**
 * Reports whether an element is in the viewport.
 *
 * Uses a CALLBACK REF rather than useRef + useEffect, because we need to
 * observe the node the instant it attaches. With a plain ref the effect might
 * run before the node exists (for conditionally rendered content) and we would
 * silently observe nothing.
 */
export function useIntersectionObserver(options?: IntersectionObserverInit) {
  const [isIntersecting, setIsIntersecting] = useState(false)
  const observerRef = useRef<IntersectionObserver | null>(null)

  const ref = useCallback(
    (node: HTMLElement | null) => {
      observerRef.current?.disconnect()
      if (!node) {
        setIsIntersecting(false)
        return
      }
      observerRef.current = new IntersectionObserver(
        ([entry]) => setIsIntersecting(entry.isIntersecting),
        options,
      )
      observerRef.current.observe(node)
    },
    // `options` is an object; an inline literal at the call site would make
    // this callback unstable. Callers should memoise it or pass a constant.
    [options],
  )

  return [ref, isIntersecting] as const
}
