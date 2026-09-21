import { useEffect, useMemo, useRef, useState } from 'react'
import type { TopicMeta } from '../../types'
import { Callout, Panel } from '../../lib/ui'

export const meta = {
  title: 'Debounce & throttle, written from scratch',
  summary:
    'Two rate-limiters people confuse constantly. The implementations are eight lines each, and “write debounce” is one of the most common live-coding questions there is.',
  notes: [
    '<b>Debounce: wait for quiet.</b> Every call resets the timer; the function runs only after <code>delay</code> ms with no further calls. Rapid input produces <b>one</b> execution, at the end.',
    '<b>Throttle: enforce a maximum rate.</b> The function runs at most once per <code>limit</code> ms, however often you call it. Rapid input produces a <b>steady stream</b>.',
    '<b>The one-line test:</b> do you want the final value (debounce) or a regular sample (throttle)?',
    '<b>Debounce for:</b> search-as-you-type, autosave, validating a field, resize handlers that recompute layout.',
    '<b>Throttle for:</b> scroll position, mousemove, drag, infinite-scroll checks, analytics on a high-frequency event.',
    '<b>A real implementation returns a <code>cancel</code></b> so the caller can clear a pending run on unmount — without it you have a leak and a setState-after-unmount.',
    '<b>Leading vs trailing edge:</b> leading fires immediately then ignores; trailing waits then fires. Most debounces want trailing; most throttles want both.',
    '<b>In React, memoise the debounced function.</b> Creating it inside the component body makes a new timer on every render, so it never actually debounces.',
  ],
  questions: [
    {
      q: 'What is the difference between debounce and throttle?',
      a: 'Debounce waits for a pause. Every new call cancels the pending one and restarts the timer, so the function only runs once the calls have stopped for <code>delay</code> milliseconds. Type twenty characters quickly and it fires once, at the end.\n\nThrottle enforces a maximum rate. It runs the function, then ignores further calls until <code>limit</code> milliseconds have elapsed, then allows the next one. Scroll continuously for two seconds with a 100ms throttle and it fires about twenty times, evenly.\n\nThe test I use: do you want the <i>final</i> value, or a <i>regular sample</i>? Search input, autosave and validation want the final value — debounce. Scroll position, mouse tracking and drag want a regular sample — throttle.\n\nThe mistake that shows the difference is debouncing a scroll handler: nothing happens at all while the user scrolls, then one update after they stop.',
    },
    {
      q: 'Write a debounce function.',
      a: 'The whole thing is a closed-over timer id:\n\n<code>function debounce(fn, delay) { let timeoutId; return function (...args) { clearTimeout(timeoutId); timeoutId = setTimeout(() =&gt; fn.apply(this, args), delay) } }</code>\n\nEvery call clears the pending timer and schedules a new one, so only the last call in a burst survives.\n\nThree details worth adding unprompted, because they are what the interviewer is usually listening for. Use a regular <code>function</code> and <code>fn.apply(this, args)</code> so the debounced version preserves <code>this</code> — an arrow would break method usage. Attach a <code>cancel</code> method that clears the timer, so a React component can clean up on unmount. And mention leading-edge as an option: a <code>leading</code> flag that fires immediately on the first call then suppresses the rest.',
    },
    {
      q: 'Write a throttle function.',
      a: 'The timestamp version is the simplest:\n\n<code>function throttle(fn, limit) { let last = 0; return function (...args) { const now = Date.now(); if (now - last &gt;= limit) { last = now; fn.apply(this, args) } } }</code>\n\nThat is leading-edge only — it fires immediately and then drops calls until the window passes. The drawback is that the <i>final</i> call in a burst is dropped, so a scroll handler can end up one frame stale.\n\nThe fuller version also schedules a trailing call: if calls came in during the cooldown, run once more when it expires. That is what lodash does by default, with <code>leading</code> and <code>trailing</code> both true.\n\nFor scroll and mousemove specifically, <code>requestAnimationFrame</code> is often better than a time-based throttle: it naturally aligns with the paint cycle, so you never compute a value that will not be displayed.',
    },
    {
      q: 'What goes wrong when you use these in React?',
      a: 'The function gets recreated on every render, so it never debounces anything.\n\n<code>const handleSearch = debounce(doSearch, 300)</code> inside the component body creates a <i>new</i> debounced function each render, each with its own fresh timer. Every keystroke re-renders, which makes a new function, which starts a new 300ms timer — and the previous one is never cancelled, so every keystroke eventually fires.\n\nThe fix is to create it once: <code>useMemo(() =&gt; debounce(doSearch, 300), [])</code>, or store it in a ref.\n\nThen you have the second problem: the memoised closure captures props and state from the render that created it, so it goes stale. Either add the real dependencies and accept re-creation, or use the latest-ref pattern so the debounced wrapper reads current values.\n\nAnd you must cancel on unmount — <code>useEffect(() =&gt; () =&gt; handleSearch.cancel(), [handleSearch])</code> — or a pending call fires after the component is gone.\n\nHonestly, for the common case of debouncing a <i>value</i> rather than a callback, a <code>useDebounce</code> hook built on <code>useEffect</code> plus <code>clearTimeout</code> sidesteps all of this.',
    },
  ],
} satisfies TopicMeta

/* ===========================================================================
   The implementations. These are the ones to be able to write on a whiteboard.
   =========================================================================== */

type AnyFn = (...args: never[]) => void

interface Debounced<F extends AnyFn> {
  (...args: Parameters<F>): void
  cancel: () => void
  flush: () => void
}

/**
 * DEBOUNCE — wait for quiet.
 *
 * Each call clears the pending timer, so only the last call in a burst runs.
 */
function debounce<F extends AnyFn>(fn: F, delay: number, leading = false): Debounced<F> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let lastArgs: Parameters<F> | null = null

  // A regular `function`, not an arrow, so `this` at the call site is
  // preserved and forwarded via `apply`. An arrow would capture `this`
  // lexically and break `obj.debouncedMethod()`.
  const debounced = function (this: unknown, ...args: Parameters<F>) {
    lastArgs = args

    // Leading edge: fire on the FIRST call of a burst, then suppress.
    const shouldCallNow = leading && timeoutId === null

    if (timeoutId !== null) clearTimeout(timeoutId)

    timeoutId = setTimeout(() => {
      timeoutId = null
      // Trailing edge. Skipped when we already fired on the leading edge and
      // no further calls arrived.
      if (!leading && lastArgs) fn.apply(this, lastArgs)
      lastArgs = null
    }, delay)

    if (shouldCallNow) fn.apply(this, args)
  } as Debounced<F>

  // Essential for React: lets a component clear a pending call on unmount.
  debounced.cancel = () => {
    if (timeoutId !== null) clearTimeout(timeoutId)
    timeoutId = null
    lastArgs = null
  }

  // Run the pending call immediately (e.g. on a form submit).
  debounced.flush = () => {
    if (timeoutId !== null && lastArgs) {
      clearTimeout(timeoutId)
      timeoutId = null
      fn(...lastArgs)
      lastArgs = null
    }
  }

  return debounced
}

/**
 * THROTTLE — at most once per `limit` ms.
 *
 * Leading edge fires immediately; the trailing timer makes sure the LAST call
 * of a burst is not dropped, which the naive timestamp-only version loses.
 */
function throttle<F extends AnyFn>(fn: F, limit: number): Debounced<F> {
  let lastRun = 0
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let lastArgs: Parameters<F> | null = null

  const throttled = function (this: unknown, ...args: Parameters<F>) {
    const now = Date.now()
    const remaining = limit - (now - lastRun)
    lastArgs = args

    if (remaining <= 0) {
      // The window has passed — run immediately (leading edge).
      if (timeoutId !== null) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
      lastRun = now
      fn.apply(this, args)
    } else if (timeoutId === null) {
      // Inside the window — schedule one trailing call for when it expires,
      // so the final call of a burst is not silently dropped.
      timeoutId = setTimeout(() => {
        lastRun = Date.now()
        timeoutId = null
        if (lastArgs) fn.apply(this, lastArgs)
      }, remaining)
    }
  } as Debounced<F>

  throttled.cancel = () => {
    if (timeoutId !== null) clearTimeout(timeoutId)
    timeoutId = null
    lastArgs = null
  }
  throttled.flush = () => {
    if (timeoutId !== null && lastArgs) {
      clearTimeout(timeoutId)
      timeoutId = null
      fn(...lastArgs)
    }
  }

  return throttled
}

export default function Demo() {
  const [raw, setRaw] = useState(0)
  const [debouncedCount, setDebouncedCount] = useState(0)
  const [throttledCount, setThrottledCount] = useState(0)
  const [lastDebounced, setLastDebounced] = useState('—')
  const [lastThrottled, setLastThrottled] = useState('—')

  // MEMOISED. Creating these in the render body would produce a new debounced
  // function — and a new timer — on every render, so nothing would ever be
  // debounced. This is the single most common React mistake with these.
  const onDebounced = useMemo(
    () =>
      debounce((value: number) => {
        setDebouncedCount((c) => c + 1)
        setLastDebounced(`fired at value ${value}`)
      }, 500),
    [],
  )

  const onThrottled = useMemo(
    () =>
      throttle((value: number) => {
        setThrottledCount((c) => c + 1)
        setLastThrottled(`fired at value ${value}`)
      }, 500),
    [],
  )

  // Cancel on unmount, or a pending call fires into a dead component.
  useEffect(() => () => onDebounced.cancel(), [onDebounced])
  useEffect(() => () => onThrottled.cancel(), [onThrottled])

  const fire = () => {
    const next = raw + 1
    setRaw(next)
    onDebounced(next)
    onThrottled(next)
  }

  const reset = () => {
    onDebounced.cancel()
    onThrottled.cancel()
    setRaw(0)
    setDebouncedCount(0)
    setThrottledCount(0)
    setLastDebounced('—')
    setLastThrottled('—')
  }

  // A mousemove area, the canonical throttle case.
  const areaRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [moveCount, setMoveCount] = useState({ raw: 0, throttled: 0 })

  const onMoveThrottled = useMemo(
    () =>
      throttle((x: number, y: number) => {
        setPos({ x, y })
        setMoveCount((c) => ({ ...c, throttled: c.throttled + 1 }))
      }, 100),
    [],
  )
  useEffect(() => () => onMoveThrottled.cancel(), [onMoveThrottled])

  return (
    <div className="stack">
      <Panel title="1. Click fast and compare">
        <div className="row" style={{ marginBottom: 12 }}>
          <button className="primary" onClick={fire}>
            click me repeatedly
          </button>
          <button onClick={() => onDebounced.flush()}>flush the debounce</button>
          <button onClick={reset}>reset</button>
        </div>

        <div className="grid2">
          <div className="panel">
            <div className="panel-title">raw calls</div>
            <span className="big-num">{raw}</span>
          </div>
          <div className="panel">
            <div className="panel-title">debounced (500ms) — waits for quiet</div>
            <div className="row">
              <span className="big-num" style={{ color: 'var(--accent)' }}>
                {debouncedCount}
              </span>
              <span className="mono" style={{ fontSize: 12 }}>
                {lastDebounced}
              </span>
            </div>
          </div>
        </div>

        <div className="panel" style={{ marginTop: 12 }}>
          <div className="panel-title">throttled (500ms) — steady rate</div>
          <div className="row">
            <span className="big-num" style={{ color: 'var(--good)' }}>
              {throttledCount}
            </span>
            <span className="mono" style={{ fontSize: 12 }}>
              {lastThrottled}
            </span>
          </div>
        </div>

        <Callout kind="tip">
          Click ten times quickly: <b>debounced</b> fires{' '}
          <b>once</b>, half a second after you stop. <b>Throttled</b> fires
          steadily while you click. Same input, completely different shape.
        </Callout>
      </Panel>

      <Panel title="2. The canonical throttle case — mousemove">
        <div
          ref={areaRef}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            setMoveCount((c) => ({ ...c, raw: c.raw + 1 }))
            onMoveThrottled(
              Math.round(e.clientX - rect.left),
              Math.round(e.clientY - rect.top),
            )
          }}
          style={{
            height: 110,
            border: '1px dashed var(--border)',
            borderRadius: 8,
            position: 'relative',
            cursor: 'crosshair',
            background: 'var(--bg-sunken)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: pos.x - 5,
              top: pos.y - 5,
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: 'var(--accent)',
              pointerEvents: 'none',
            }}
          />
          <div style={{ padding: 10, fontSize: 13, color: 'var(--text-faint)' }}>
            Move your mouse in here.
          </div>
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <span className="badge">{moveCount.raw} raw mousemove events</span>
          <span className="badge good">{moveCount.throttled} throttled updates</span>
          <span className="badge">
            {moveCount.raw > 0
              ? `${Math.round((1 - moveCount.throttled / moveCount.raw) * 100)}% suppressed`
              : '—'}
          </span>
        </div>
        <Callout>
          Debouncing this would be wrong: the dot would not move at all while
          you moved the mouse, then jump to the final position.
        </Callout>
      </Panel>

      <Panel title="3. The implementations">
        <div className="grid2">
          <div>
            <div className="panel-title">debounce — the whiteboard version</div>
            <pre>
              <code>{`function debounce(fn, delay) {
  let timeoutId
  return function (...args) {
    clearTimeout(timeoutId)          // cancel the pending one
    timeoutId = setTimeout(
      () => fn.apply(this, args),    // 'function' + apply
      delay                          //   preserves 'this'
    )
  }
}`}</code>
            </pre>
          </div>
          <div>
            <div className="panel-title">throttle — leading edge</div>
            <pre>
              <code>{`function throttle(fn, limit) {
  let last = 0
  return function (...args) {
    const now = Date.now()
    if (now - last >= limit) {
      last = now
      fn.apply(this, args)
    }
    // calls inside the window are dropped
  }
}`}</code>
            </pre>
          </div>
        </div>
        <Callout kind="tip">
          <b>Say these three things unprompted</b> and you have given a senior
          answer: use <code>function</code> + <code>apply</code> so{' '}
          <code>this</code> survives; attach a <code>cancel</code> so React can
          clean up on unmount; and mention leading vs trailing edge as an
          option.
        </Callout>
      </Panel>

      <Panel title="4. The React trap">
        <pre>
          <code>{`// ❌ A NEW debounced function, with a NEW timer, on every render.
//    Every keystroke re-renders → new function → nothing is ever debounced.
function Search() {
  const handleSearch = debounce(doSearch, 300)
  return <input onChange={e => handleSearch(e.target.value)} />
}

// ✅ Created once.
const handleSearch = useMemo(() => debounce(doSearch, 300), [])
useEffect(() => () => handleSearch.cancel(), [handleSearch])   // clean up!

// ✅✅ Usually simpler: debounce the VALUE, not the callback.
function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)     // ← the cleanup IS the debounce
  }, [value, delay])
  return debounced
}

const query = useDebounce(input, 300)
useEffect(() => { doSearch(query) }, [query])`}</code>
        </pre>
      </Panel>
    </div>
  )
}
