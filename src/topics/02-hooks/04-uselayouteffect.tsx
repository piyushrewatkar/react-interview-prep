import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { TopicMeta } from '../../types'
import { Callout, Panel } from '../../lib/ui'

export const meta = {
  title: 'useLayoutEffect vs useEffect',
  summary:
    'One runs before the browser paints and blocks it; the other runs after. That single difference decides which one you need.',
  notes: [
    '<b>Order:</b> render → React mutates the DOM → <code>useLayoutEffect</code> (synchronous, blocking) → browser paints → <code>useEffect</code> (asynchronous).',
    '<b>Use <code>useLayoutEffect</code> when you must measure the DOM and change it before the user sees anything</b> — positioning a tooltip, correcting scroll position, measuring text to decide on truncation.',
    '<b>Use <code>useEffect</code> for everything else.</b> Data fetching, subscriptions, logging, timers, analytics. It does not block paint, so it cannot cause jank.',
    '<b>The symptom that tells you which to use:</b> a visible flicker where the element appears in the wrong place for one frame. That is <code>useEffect</code> doing a layout job.',
    '<b>Layout effects block painting</b>, so slow work inside one freezes the UI. Keep them to measurement and a style write.',
    '<b>It warns during SSR</b> — there is no layout on the server. The standard workaround is <code>const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect</code>, which every UI library ships.',
    '<b>Cleanup semantics are identical</b> to <code>useEffect</code>: before each re-run and on unmount.',
  ],
  questions: [
    {
      q: 'What is the difference between useEffect and useLayoutEffect?',
      a: 'Timing, and whether the browser is allowed to paint in between.\n\nBoth run after React has mutated the DOM. <code>useLayoutEffect</code> runs <i>synchronously</i> at that moment, before the browser gets a chance to paint — so anything you change inside it is included in the same frame the user sees. <code>useEffect</code> is deferred: React lets the browser paint first, then runs it.\n\nThe practical consequence is that <code>useLayoutEffect</code> can measure and correct layout invisibly, while <code>useEffect</code> doing the same work produces a visible flash of the uncorrected state. The trade-off is that <code>useLayoutEffect</code> blocks painting, so slow work in it directly delays the frame.',
    },
    {
      q: 'Give a concrete case where useEffect is the wrong choice.',
      a: 'Positioning a tooltip. You render it, measure its height with <code>getBoundingClientRect()</code>, and decide whether it fits above the trigger or has to flip below.\n\nWith <code>useEffect</code>, the browser paints the tooltip at its default position, <i>then</i> your effect measures and moves it. The user sees one frame of the tooltip in the wrong place — a visible jump, and on a slow device more than one frame.\n\nWith <code>useLayoutEffect</code>, the measurement and the correction both happen before the paint, so the tooltip is only ever drawn in its final position.\n\nThe same reasoning applies to restoring scroll position in a chat window and to any "measure, then adjust" pattern.',
    },
    {
      q: 'Why does useLayoutEffect warn during server-side rendering?',
      a: 'Because there is no DOM and no layout on the server, so a layout effect cannot do the one thing it exists for. React never runs effects during <code>renderToString</code>, so your measurement code simply does not happen, and the markup you send will not match what the client produces after it corrects itself.\n\nReact warns rather than silently diverging. The accepted fix is a small wrapper that picks the hook based on environment:\n\n<code>const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect</code>\n\nReact Aria, Radix, Chakra and Framer Motion all ship some version of this. The deeper answer is that layout-dependent rendering is inherently client-side, so anything using it should be behind a mounted check anyway.',
    },
    {
      q: 'Can useLayoutEffect hurt performance?',
      a: 'Yes, directly and measurably. It runs synchronously in the commit phase, so the browser cannot paint until it returns. Expensive work there — a fetch, a heavy loop, a long chain of layout reads and writes — freezes the frame, and on a 60Hz display anything over ~16ms is a dropped frame.\n\nIt is also easy to cause layout thrashing inside one: reading <code>offsetHeight</code>, writing a style, reading again forces the browser to recalculate layout each time. Batch all reads, then all writes.\n\nThe guidance is simple: reach for <code>useEffect</code> first, and only move to <code>useLayoutEffect</code> when you can see the flicker that justifies it.',
    },
  ],
} satisfies TopicMeta

/* ---------------------------------------------------------------------------
   The classic demo: measure a box and reposition it. One version does the work
   before paint, the other after. The difference is a visible jump.

   To make the flicker unmissable, both versions deliberately start the box at
   the wrong offset and correct it in their effect.
   --------------------------------------------------------------------------- */

function Tooltip({ kind, text }: { kind: 'effect' | 'layout'; text: string }) {
  const ref = useRef<HTMLDivElement>(null)
  // Start deliberately mispositioned so the correction is visible.
  const [top, setTop] = useState(0)

  const correct = () => {
    const el = ref.current
    if (!el) return
    // Measure, then decide. In a real tooltip you would compare against the
    // viewport and flip above/below. Here we just centre it on its container.
    const h = el.getBoundingClientRect().height
    setTop(Math.round((60 - h) / 2))
  }

  // THE ONLY DIFFERENCE between the two panels is which hook runs `correct`.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  if (kind === 'layout') {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useLayoutEffect(correct, [text])
  } else {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(correct, [text])
  }

  return (
    <div
      style={{
        position: 'relative',
        height: 60,
        border: '1px dashed var(--border)',
        borderRadius: 6,
        overflow: 'hidden',
      }}
    >
      <div
        ref={ref}
        style={{
          position: 'absolute',
          top,
          left: 10,
          right: 10,
          background: 'var(--accent-dim)',
          color: '#cfe4ff',
          borderRadius: 6,
          padding: '6px 10px',
          fontSize: 13,
        }}
      >
        {text}
      </div>
    </div>
  )
}

export default function Demo() {
  const [n, setN] = useState(0)

  // Two ordinary effects to prove the ordering. Open the console and click.
  useLayoutEffect(() => {
    if (n > 0) console.log(`%c[${n}] useLayoutEffect — before paint`, 'color:#d29922')
  }, [n])

  useEffect(() => {
    if (n > 0) console.log(`%c[${n}] useEffect — after paint`, 'color:#3fb950')
  }, [n])

  const texts = [
    'measure me, then move me',
    'a longer tooltip that wraps onto two lines to change the measured height',
    'short',
  ]

  return (
    <div className="stack">
      <Callout>
        Press the button repeatedly and watch the two boxes. Both measure
        themselves and recentre — one does it before the frame is painted, one
        after.
      </Callout>

      <div className="row">
        <button className="primary" onClick={() => setN((v) => v + 1)}>
          change content ({n})
        </button>
        <span className="muted" style={{ fontSize: 13 }}>
          Open the console to see the ordering logs.
        </span>
      </div>

      <div className="grid2">
        <Panel title="useEffect — corrects AFTER paint">
          <Tooltip kind="effect" text={texts[n % texts.length]} />
          <div style={{ fontSize: 13, color: 'var(--bad)', marginTop: 8 }}>
            One frame at the wrong offset. On a fast machine it is a flicker; on
            a slow one it is a jump.
          </div>
        </Panel>

        <Panel title="useLayoutEffect — corrects BEFORE paint">
          <Tooltip kind="layout" text={texts[n % texts.length]} />
          <div style={{ fontSize: 13, color: 'var(--good)', marginTop: 8 }}>
            The browser never paints the intermediate state.
          </div>
        </Panel>
      </div>

      <Panel title="The commit sequence">
        <pre>
          <code>{`  render()                       // your component function runs
      ↓
  React mutates the DOM          // commit phase
      ↓
  useLayoutEffect                // SYNCHRONOUS — blocks the next line
      ↓
  🖼  browser paints              // the user finally sees something
      ↓
  useEffect                      // ASYNCHRONOUS — scheduled after paint`}</code>
        </pre>
      </Panel>

      <Panel title="The SSR-safe wrapper every UI library ships">
        <pre>
          <code>{`// useIsomorphicLayoutEffect.ts
import { useEffect, useLayoutEffect } from 'react'

// On the server there is no layout to read, and React does not run effects
// during renderToString anyway — so useLayoutEffect would only warn.
export const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect`}</code>
        </pre>
      </Panel>

      <Callout kind="tip">
        <b>The decision rule.</b> Default to <code>useEffect</code>. Switch to{' '}
        <code>useLayoutEffect</code> only when you can point at a visible
        flicker — and when you do, keep the body to a measurement and a write.
      </Callout>
    </div>
  )
}
