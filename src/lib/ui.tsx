import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

/* ---------------------------------------------------------------------------
   Small helpers shared by the demos. Kept out of `src/topics/` so the registry
   glob never picks them up as topics.
   --------------------------------------------------------------------------- */

/**
 * Counts how many times the calling component has rendered.
 *
 * WHY A REF AND NOT STATE: writing to a ref does not schedule a re-render, so
 * this instrument does not perturb the thing it is measuring. Calling
 * `setState` here would cause an infinite render loop.
 *
 * WHY `useEffect` AND NOT A BARE `count.current++` IN THE BODY: mutating during
 * render is an impure render. Under StrictMode React renders twice in dev, so a
 * bare increment would report double. Incrementing in an effect counts
 * *committed* renders, which is what you actually want to observe — and it is
 * what React DevTools' Profiler shows you too.
 */
export function useRenderCount(): number {
  const count = useRef(0)
  // No dependency array: runs after every committed render.
  useEffect(() => {
    count.current += 1
  })
  // `count.current` is read during render, so the number shown is "renders
  // before this one". That is intentional; the badge label says so.
  return count.current
}

/** Shows a component's committed render count. Drop it inside any demo. */
export function RenderBadge({ label }: { label: string }) {
  const n = useRenderCount()
  return (
    <span className="badge" title="Committed renders since mount">
      {label}: {n} render{n === 1 ? '' : 's'}
    </span>
  )
}

/**
 * An append-only log with a stable `push` identity.
 *
 * `push` is wrapped in `useCallback` with an EMPTY dependency array, which is
 * only safe because the updater form `setLines(prev => ...)` means we never
 * need to read `lines` from the closure. This is the canonical way to get a
 * stable callback: remove the dependency rather than memoise around it.
 */
export function useLog(max = 200) {
  const [lines, setLines] = useState<string[]>([])

  const push = useCallback(
    (line: string) => {
      setLines((prev) => [...prev, line].slice(-max))
    },
    [max],
  )

  const clear = useCallback(() => setLines([]), [])

  return { lines, push, clear }
}

export function Log({ lines, empty = 'Nothing logged yet.' }: { lines: string[]; empty?: string }) {
  const ref = useRef<HTMLPreElement>(null)

  // Auto-scroll to the newest line. `useEffect` (not `useLayoutEffect`) is
  // right here: a one-frame lag in a log pane is invisible, and useEffect does
  // not block paint.
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight
  }, [lines])

  return (
    <pre className="log" ref={ref}>
      {lines.length === 0 ? <span className="ts">{empty}</span> : lines.join('\n')}
    </pre>
  )
}

export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="panel">
      <div className="panel-title">{title}</div>
      {children}
    </div>
  )
}

export function Callout({
  kind = 'note',
  children,
}: {
  kind?: 'note' | 'trap' | 'tip'
  children: ReactNode
}) {
  return <div className={kind === 'note' ? 'callout' : `callout ${kind}`}>{children}</div>
}

/** Blocks the main thread for roughly `ms` milliseconds. Used to make slow renders visible. */
export function burnCpu(ms: number): number {
  const end = performance.now() + ms
  let n = 0
  while (performance.now() < end) n += Math.random()
  return n
}

/** A promise-based sleep, for fake network calls. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
