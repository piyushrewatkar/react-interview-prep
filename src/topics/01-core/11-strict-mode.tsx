import { useEffect, useRef, useState } from 'react'
import type { TopicMeta } from '../../types'
import { Callout, Panel, useLog, Log } from '../../lib/ui'

export const meta = {
  title: 'StrictMode & the double invocation',
  summary:
    'Why your effect runs twice in development, why that is a feature, and what it is actually trying to tell you.',
  notes: [
    '<b>StrictMode is development-only.</b> It is stripped from production builds and has zero runtime cost there.',
    '<b>It double-invokes pure functions:</b> component bodies, <code>useState</code>/<code>useMemo</code>/<code>useReducer</code> initialisers, and the class render method. If your output differs between the two calls, your render is impure.',
    '<b>It double-invokes effects:</b> on mount React runs setup → cleanup → setup. If your component breaks, your cleanup is missing or incomplete.',
    '<b>The point is resilience.</b> React reserves the right to unmount and remount a component while preserving its state — that is how Offscreen/Activity and fast refresh work. Surviving a mount-unmount-mount cycle is a correctness requirement, not a nicety.',
    '<b>Do not "fix" it with a ref guard.</b> <code>if (didRun.current) return</code> hides the symptom and leaves the real bug — the missing cleanup — in production, where it shows up as a leak on every genuine remount.',
    '<b>The real fixes:</b> abort in-flight fetches with <code>AbortController</code>, remove every listener you add, clear every timer, unsubscribe every subscription, and make setup idempotent.',
    '<b>React 19 also double-invokes ref callbacks</b> in StrictMode, for the same reason.',
  ],
  questions: [
    {
      q: 'Why does my useEffect run twice on mount?',
      a: 'Because you are in development with <code>&lt;StrictMode&gt;</code> enabled. React deliberately mounts the component, runs the effect, runs its cleanup, then runs the effect again — simulating a remount.\n\nIt is a diagnostic. React wants to verify that your effect can be torn down and set up again without breaking, because React reserves the right to actually do that: fast refresh does it, and features like Activity/Offscreen (hiding and restoring a subtree with its state intact) depend on it.\n\nIt does not happen in production. If the double run breaks something, the double run is not the bug — the missing or incomplete cleanup is.',
    },
    {
      q: 'Should you use a ref to prevent the effect running twice?',
      a: 'No, and this is the answer interviewers are listening for. A <code>hasRun</code> ref makes the symptom go away in development while leaving the actual defect — an effect that cannot be cleaned up — shipped to production.\n\nIt also breaks the moment the component is genuinely remounted, which happens on every route revisit, every key change, every fast refresh, and any future use of Activity. Now your effect never re-runs and you have a subtly dead component.\n\nWrite the cleanup instead. If the effect subscribes, unsubscribe. If it fetches, abort or ignore the stale response. If it starts a timer, clear it. An effect with a correct cleanup is indifferent to being run twice.',
    },
    {
      q: 'What does StrictMode do besides running effects twice?',
      a: 'It double-invokes anything that is supposed to be pure: the component function body itself, <code>useState</code> and <code>useReducer</code> initialiser functions, and <code>useMemo</code> factories. If you are mutating a module-level variable, pushing to an array defined outside the component, or incrementing a counter during render, the doubled output makes it obvious immediately instead of at 2am.\n\nIt also warns about deprecated APIs — legacy string refs, <code>findDOMNode</code>, legacy context — and, since React 19, double-invokes ref callbacks for the same cleanup-verification reason.\n\nThe unifying theme: it turns "works by accident" into a visible failure during development.',
    },
    {
      q: 'Does StrictMode affect production?',
      a: 'Not at all. All of the double-invocation behaviour is wrapped in development-only checks that the production build strips out. Leaving <code>&lt;StrictMode&gt;</code> in your entry file costs nothing at runtime and is the recommended default — removing it because the double effects are annoying is trading a development inconvenience for production bugs you will not find.',
    },
    {
      q: 'Give a concrete example of a bug StrictMode catches.',
      a: 'A fetch-on-mount effect with no abort handling. In development you now fire two requests, and if the first one resolves <i>after</i> the second, you set state from the stale response. That is the same race that happens in production whenever a user navigates quickly between two items — StrictMode just makes it reproducible on every single mount instead of one time in fifty.\n\nAnother: <code>window.addEventListener("resize", onResize)</code> with no removal. StrictMode leaves you with two listeners after mount, and every remount adds another. In production the leak is slower but identical.\n\nBoth are fixed by writing the cleanup the effect always needed.',
    },
  ],
} satisfies TopicMeta

/* ---------------------------------------------------------------------------
   Two versions of "fetch on mount". Watch the logs: both run twice, but only
   one of them behaves correctly.
   --------------------------------------------------------------------------- */

function fakeFetch(id: number, ms: number, signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => resolve(`data for item ${id}`), ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(t)
      reject(new DOMException('Aborted', 'AbortError'))
    })
  })
}

function BrokenFetcher({ id, log }: { id: number; log: (s: string) => void }) {
  const [data, setData] = useState('—')

  useEffect(() => {
    log(`❌ setup for id=${id}`)
    // No cleanup at all. Both in-flight requests will call setData, and
    // whichever resolves LAST wins — which is not necessarily the latest one.
    fakeFetch(id, id === 1 ? 900 : 200).then((d) => {
      log(`❌ resolved ${d} → setData (even if stale!)`)
      setData(d)
    })
    // Missing: return () => controller.abort()
  }, [id, log])

  return <span className="mono">{data}</span>
}

function CorrectFetcher({ id, log }: { id: number; log: (s: string) => void }) {
  const [data, setData] = useState('—')

  useEffect(() => {
    log(`✅ setup for id=${id}`)
    const controller = new AbortController()

    fakeFetch(id, id === 1 ? 900 : 200, controller.signal)
      .then((d) => {
        log(`✅ resolved ${d} → setData`)
        setData(d)
      })
      .catch((e) => {
        if ((e as Error).name === 'AbortError') log(`✅ aborted the request for id=${id}`)
      })

    // THE WHOLE FIX. StrictMode's second run calls this first, so the first
    // request is cancelled before the second one starts. Identical protection
    // applies in production when `id` changes rapidly.
    return () => {
      log(`✅ cleanup for id=${id}`)
      controller.abort()
    }
  }, [id, log])

  return <span className="mono">{data}</span>
}

/* Impure render: a module-level counter mutated during render. StrictMode's
   double render makes the bug loudly visible. */
let impureCounter = 0

function ImpureRender() {
  // ❌ Side effect during render. In StrictMode this increments twice per
  //    render, which is exactly the point — React is telling you this is unsafe
  //    under concurrent rendering, where a render may be discarded entirely.
  impureCounter += 1
  return <span className="mono">module counter: {impureCounter}</span>
}

function PureRender() {
  // ✅ Same intent, done with a ref inside an effect. Effects run once per
  //    COMMIT, so the count reflects reality.
  const count = useRef(0)
  useEffect(() => {
    count.current += 1
  })
  return <span className="mono">committed renders: {count.current}</span>
}

export default function Demo() {
  const [id, setId] = useState(1)
  const [mounted, setMounted] = useState(false)
  const { lines, push, clear } = useLog()
  const [, force] = useState(0)

  return (
    <div className="stack">
      <Callout>
        This whole app runs inside <code>&lt;StrictMode&gt;</code> — see{' '}
        <code>src/main.tsx</code>. Everything below is what that does.
      </Callout>

      <Panel title="1. Double effects, and what they expose">
        <div className="row" style={{ marginBottom: 12 }}>
          <button
            className="primary"
            onClick={() => {
              clear()
              setMounted((m) => !m)
            }}
          >
            {mounted ? 'Unmount both fetchers' : 'Mount both fetchers'}
          </button>
          <button onClick={() => setId((v) => (v === 1 ? 2 : 1))} disabled={!mounted}>
            change id (1 ↔ 2) — triggers the race
          </button>
        </div>

        {mounted && (
          <div className="grid2" style={{ marginBottom: 12 }}>
            <div className="panel">
              <div className="panel-title" style={{ color: 'var(--bad)' }}>
                no cleanup
              </div>
              <BrokenFetcher id={id} log={push} />
            </div>
            <div className="panel">
              <div className="panel-title" style={{ color: 'var(--good)' }}>
                AbortController cleanup
              </div>
              <CorrectFetcher id={id} log={push} />
            </div>
          </div>
        )}

        <Log lines={lines} empty="Press “Mount both fetchers”." />
        <Callout kind="trap">
          Both effects ran <b>setup → cleanup → setup</b>. Only the correct one
          cancelled the abandoned request. Now click &ldquo;change id&rdquo;
          quickly — the broken one can land the slow, stale response on top of
          the fresh one.
        </Callout>
      </Panel>

      <Panel title="2. Double render, and what it exposes">
        <div className="row">
          <ImpureRender />
          <PureRender />
          <button onClick={() => force((n) => n + 1)}>re-render</button>
        </div>
        <Callout kind="trap">
          The module counter jumps by <b>two</b> per click. That is StrictMode
          reporting an impure render — a mutation that React may run twice, or
          run and then throw away. The ref-in-effect version counts commits and
          is accurate.
        </Callout>
      </Panel>
    </div>
  )
}
