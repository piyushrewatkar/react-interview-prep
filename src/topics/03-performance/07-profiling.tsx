import { Profiler, memo, useEffect, useRef, useState } from 'react'
import type { ProfilerOnRenderCallback } from 'react'
import type { TopicMeta } from '../../types'
import { Callout, Panel, burnCpu, Log } from '../../lib/ui'

export const meta = {
  title: 'Measuring: DevTools Profiler & the Profiler API',
  summary:
    'How to find the slow component instead of guessing — and the numbers you should be able to quote about what "slow" means.',
  notes: [
    '<b>React DevTools &rarr; Profiler tab.</b> Record an interaction, then read the flame graph: width is time, and grey means the component did not render in that commit.',
    '<b>Turn on "Record why each component rendered"</b> in the Profiler settings. It names the changed prop, hook or context for every render — this is the single most useful setting in the tool.',
    '<b>The ranked chart</b> sorts components by time spent in a commit. Start at the top; that is where the wins are.',
    '<b>"Highlight updates when components render"</b> in the Components tab flashes borders in the live app. Fastest way to spot something re-rendering during an unrelated interaction.',
    '<b>The <code>&lt;Profiler&gt;</code> component</b> gives you the same timings programmatically: <code>onRender(id, phase, actualDuration, baseDuration, startTime, commitTime)</code>.',
    '<b><code>actualDuration</code></b> is the time this commit took. <code>baseDuration</code> is the estimated time to render the whole subtree with no memoisation — the gap between them is what your memoisation bought you.',
    '<b>Profile a production build.</b> Development React is several times slower and includes checks that never ship. Use the <code>profiling</code> build to keep the hooks.',
    '<b>Budgets worth quoting:</b> 16ms per frame for 60fps, ~50ms for an interaction to feel instant, and INP under 200ms as the Core Web Vitals threshold.',
  ],
  questions: [
    {
      q: 'How do you find out why a React app is slow?',
      a: 'Measure before touching anything. In order:\n\n<b>React DevTools Profiler.</b> Record the interaction that feels slow, then look at the commits. The flame graph shows which components rendered and how long each took; the ranked view sorts them so the worst offender is at the top. Enable "record why each component rendered" and it will tell you which prop or hook changed.\n\n<b>The browser Performance panel</b> for everything React cannot see — long tasks, layout thrashing, expensive style recalculation, main-thread blocking from non-React code.\n\n<b>The Network panel and a bundle analyser</b> if the problem is initial load rather than interaction. Often "the app is slow" means 2MB of JavaScript, not a slow render.\n\nOnly then do I form a hypothesis and change something — and re-measure to confirm it actually helped, because optimisation intuitions are wrong surprisingly often.',
    },
    {
      q: 'What is the difference between actualDuration and baseDuration?',
      a: '<code>actualDuration</code> is how long this particular commit took, given whatever memoisation was in effect. <code>baseDuration</code> is React\'s estimate of how long it would have taken to render the entire subtree from scratch, with no bail-outs.\n\nThe gap between them is the value your memoisation delivered. If <code>actualDuration</code> is consistently close to <code>baseDuration</code>, your <code>memo</code> and <code>useMemo</code> calls are not doing anything — which is the most common outcome when people memoise without measuring.\n\nIf <code>actualDuration</code> is a small fraction of <code>baseDuration</code>, the optimisation is working and you can see exactly how much it is worth.',
    },
    {
      q: 'Should you profile a development build?',
      a: 'Not for the numbers. Development React runs extra validation, keeps component stacks, double-invokes under StrictMode and skips production optimisations — it is commonly several times slower, and the ratio is not uniform across components, so the profile can be actively misleading about <i>which</i> component is the problem.\n\nBut the profiler hooks are stripped from the production build. The answer is the profiling build: <code>react-dom/profiling</code>, which most bundlers can alias in, or the framework\'s built-in flag — Next.js has <code>reactProductionProfiling</code>. You get production performance with the instrumentation intact.\n\nDevelopment profiling is still fine for the <i>qualitative</i> question — "which components are re-rendering and why" — which is usually what you actually need.',
    },
    {
      q: 'What performance numbers should a React developer know?',
      a: 'A handful, and they anchor most conversations.\n\n<b>16.7ms</b> is the budget for one frame at 60Hz. Anything longer drops a frame; in practice you want React\'s share well under that because the browser also needs to do style, layout and paint.\n\n<b>50ms</b> is the threshold where an interaction stops feeling instant, and <b>200ms</b> is the "good" bar for INP, the Core Web Vitals interaction metric that replaced FID.\n\n<b>2.5s</b> for Largest Contentful Paint and a CLS under <b>0.1</b> are the other two Core Web Vitals thresholds.\n\n<b>Long task</b> is the formal name for any main-thread block over 50ms, which is what shows up as jank.\n\nAnd for bundles, a rough working figure: on a mid-tier phone over 4G, every 100kB of compressed JavaScript costs roughly a second of parse-plus-execute time before anything is interactive.',
    },
  ],
} satisfies TopicMeta

const SlowChild = memo(function SlowChild({ cost }: { cost: number }) {
  burnCpu(cost)
  return <span className="mono">child rendered ({cost}ms of work)</span>
})

export default function Demo() {
  const [cost, setCost] = useState(30)
  const [tick, setTick] = useState(0)

  /* -------------------------------------------------------------------------
     A HAZARD WORTH UNDERSTANDING, because it is easy to hit for real.

     `onRender` fires during the commit phase. If it calls setState directly,
     that schedules a render, which commits, which fires `onRender`, which
     calls setState… React detects it and throws "Maximum update depth
     exceeded". The same trap exists in `componentDidUpdate` and in any effect
     that sets state unconditionally.

     The fix here has two halves:
       1. Buffer into a REF (no render), and flush to state on a timeout, so a
          burst of commits produces one state update rather than one each.
       2. A suppression flag, cleared by an effect, so the commit caused by our
          own flush is not itself logged — which is what closes the loop.
     ------------------------------------------------------------------------- */
  const bufferRef = useRef<string[]>([])
  const suppressRef = useRef(false)
  const flushTimerRef = useRef<number | null>(null)
  const [lines, setLines] = useState<string[]>([])

  // Runs after every commit, including the one our own flush caused — which is
  // exactly when we want to re-arm.
  useEffect(() => {
    suppressRef.current = false
  })

  useEffect(() => () => {
    if (flushTimerRef.current !== null) clearTimeout(flushTimerRef.current)
  }, [])

  // The Profiler API. React calls this after every commit in the wrapped tree.
  // In a real app you would sample this and ship it to your metrics backend —
  // it is how you catch a render regression in CI rather than in production.
  const onRender: ProfilerOnRenderCallback = (id, phase, actualDuration, baseDuration) => {
    // Ignore the commit that our own flush produced.
    if (suppressRef.current) return

    bufferRef.current = [
      ...bufferRef.current,
      `${id} · ${phase.padEnd(6)} · actual ${actualDuration.toFixed(1)}ms · base ${baseDuration.toFixed(1)}ms` +
        (actualDuration < baseDuration * 0.9 ? '  ← memoisation paid off' : ''),
    ].slice(-12)

    if (flushTimerRef.current === null) {
      flushTimerRef.current = window.setTimeout(() => {
        flushTimerRef.current = null
        suppressRef.current = true
        setLines(bufferRef.current)
      }, 0)
    }
  }

  const clear = () => {
    bufferRef.current = []
    setLines([])
  }

  return (
    <div className="stack">
      <Panel title="1. The Profiler component">
        <div className="row" style={{ marginBottom: 12 }}>
          <button className="primary" onClick={() => setTick((t) => t + 1)}>
            re-render parent ({tick}) — child is memoised, so it should skip
          </button>
          <button onClick={() => setCost((c) => (c === 30 ? 80 : 30))}>
            change the child&rsquo;s prop ({cost}ms)
          </button>
          <button onClick={clear}>clear</button>
        </div>

        {/* `id` shows up in the callback, so you can wrap several regions and
            tell them apart. Nesting Profilers is fine and often useful. */}
        <Profiler id="demo-tree" onRender={onRender}>
          <div className="panel">
            <SlowChild cost={cost} />
          </div>
        </Profiler>

        <div style={{ marginTop: 12 }}>
          <Log lines={lines} empty="Press a button to record a commit." />
        </div>

        <Callout kind="tip">
          Press the first button: <code>actual</code> drops well below{' '}
          <code>base</code>, because <code>memo</code> skipped the child. Press
          the second: they converge, because the child genuinely had to render.
          That gap is the only honest measure of whether a memo is earning its
          place.
        </Callout>

        <Callout kind="trap">
          <b>Read this file&rsquo;s <code>onRender</code>.</b> Calling{' '}
          <code>setState</code> straight from <code>onRender</code> is an
          infinite loop — the state update causes a commit, which fires{' '}
          <code>onRender</code>, which updates state. React throws
          &ldquo;Maximum update depth exceeded&rdquo;. The buffer-in-a-ref plus
          suppression flag above is how you break it, and the same shape applies
          to <code>componentDidUpdate</code> and to any effect that sets state
          unconditionally.
        </Callout>
      </Panel>

      <Panel title="2. The onRender arguments">
        <table className="data">
          <thead>
            <tr>
              <th>Argument</th>
              <th>Meaning</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="mono">id</td>
              <td>The <code>id</code> prop of the Profiler that fired. Lets you attribute a commit to a region.</td>
            </tr>
            <tr>
              <td className="mono">phase</td>
              <td>
                <code>"mount"</code>, <code>"update"</code>, or{' '}
                <code>"nested-update"</code>. Mounts are naturally slower; compare like with like.
              </td>
            </tr>
            <tr>
              <td className="mono">actualDuration</td>
              <td>Time spent rendering this commit, after bail-outs. The number you optimise.</td>
            </tr>
            <tr>
              <td className="mono">baseDuration</td>
              <td>Estimated time with no memoisation at all. The ceiling.</td>
            </tr>
            <tr>
              <td className="mono">startTime / commitTime</td>
              <td>Timestamps. Useful for correlating with a browser performance trace.</td>
            </tr>
          </tbody>
        </table>
      </Panel>

      <Panel title="3. The DevTools workflow">
        <pre>
          <code>{`1. Install React DevTools. Open the Profiler tab.
2. Settings (gear) → Profiler → tick "Record why each component rendered".
3. Press ⏺, perform the slow interaction, press ⏹.
4. Read the COMMITS bar at the top — tall bars are slow commits.
5. Switch to the RANKED chart. The top row is your problem.
6. Click a component → the right panel names what changed:
      "Props changed: (items)"      → unstable array identity
      "Hook 3 changed"              → some useState/useContext fired
      "The parent component rendered" → nothing about this component changed;
                                        it just sits under a busy parent
7. Fix ONE thing. Re-record. Confirm the number moved.`}</code>
        </pre>
      </Panel>

      <Panel title="4. The budgets">
        <table className="data">
          <thead>
            <tr>
              <th>Number</th>
              <th>What it is</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="mono">16.7ms</td>
              <td>One frame at 60Hz. React should use well under this.</td>
            </tr>
            <tr>
              <td className="mono">50ms</td>
              <td>A “long task”. Above this the main thread visibly blocks.</td>
            </tr>
            <tr>
              <td className="mono">200ms</td>
              <td>INP threshold for “good” in Core Web Vitals.</td>
            </tr>
            <tr>
              <td className="mono">2.5s</td>
              <td>LCP threshold for “good”.</td>
            </tr>
            <tr>
              <td className="mono">0.1</td>
              <td>CLS threshold for “good”.</td>
            </tr>
            <tr>
              <td className="mono">~1s / 100kB</td>
              <td>Rough parse + execute cost of compressed JS on a mid-tier phone.</td>
            </tr>
          </tbody>
        </table>
      </Panel>
    </div>
  )
}
