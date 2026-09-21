import { useCallback, useEffect, useRef, useState } from 'react'
import type { TopicMeta } from '../../types'
import { Callout, Panel, useLog, Log, sleep } from '../../lib/ui'

export const meta = {
  title: 'useEffect: dependencies, cleanup & races',
  summary:
    'The dependency array is not a list of things to watch — it is a declaration of what the effect reads. Get that backwards and every effect bug follows.',
  notes: [
    '<b>An effect synchronises your component with something outside React</b> — a subscription, a timer, the document title, a non-React widget. It is not a lifecycle callback.',
    '<b>The dependency array declares every reactive value the effect body reads.</b> Props, state, and anything derived from them. If you read it, it goes in the array. The linter is right; your instinct to omit is wrong.',
    '<b>Cleanup runs before every re-run, not only on unmount.</b> Deps change → previous cleanup → new setup. Design the pair together.',
    '<b>Timing:</b> <code>useEffect</code> is asynchronous and runs <i>after</i> the browser paints, so it never blocks visual updates.',
    '<b>Object and array dependencies break memoisation</b> because a fresh literal has a new identity every render. Depend on primitives (<code>user.id</code>, not <code>user</code>) or memoise the object at its source.',
    '<b>Races are the default, not the exception.</b> Two overlapping fetches can resolve out of order. Fix with <code>AbortController</code>, or with an <code>ignore</code> flag closed over by the cleanup.',
    '<b>An empty array means "this effect reads nothing reactive"</b> — not "run on mount". If the linter says a value is missing, adding the array entry is the fix, not silencing the rule.',
    '<b>No async function directly:</b> <code>useEffect(async () =&gt; …)</code> returns a promise where React expects a cleanup function. Define an inner async function and call it.',
  ],
  questions: [
    {
      q: 'How does the dependency array actually work?',
      a: 'After every render React compares the new array to the previous one, element by element, with <code>Object.is</code>. If every element matches, it skips the effect. If any differs, it runs the previous cleanup and then the new setup.\n\nThe framing that fixes most bugs is that the array is not "things to watch for changes". It is a claim you are making to React: "this effect reads exactly these reactive values and nothing else." React trusts you. When the claim is false — you read <code>userId</code> but left it out — the effect keeps running with the value captured by the render it was created in, which is the stale-closure bug.\n\nThat is why the exhaustive-deps lint rule is not pedantry. It verifies your claim against the code.',
    },
    {
      q: 'When does the cleanup function run?',
      a: 'Before every subsequent run of the effect, and once more on unmount. So the sequence for a changing dependency is setup(A) → cleanup(A) → setup(B) → cleanup(B) → unmount.\n\nThe important consequence: cleanup is not "on unmount" logic, it is "undo whatever the previous setup did" logic. Each cleanup closes over the values from <i>its own</i> setup, so it always has exactly the right subscription handle, timer id, or abort controller to tear down.\n\nAnd in development under StrictMode you get an extra setup → cleanup → setup on mount, specifically to verify that this pairing is correct.',
    },
    {
      q: 'What is the race condition in a fetch-on-mount effect and how do you fix it?',
      a: 'The effect re-runs when <code>id</code> changes, firing request B while request A is still in flight. Nothing guarantees they resolve in order — if A is slower, it resolves last and overwrites the correct data with stale data. The user sees the previous item\'s content, and it is intermittent, which makes it miserable to debug.\n\nTwo fixes. The clean one is <code>AbortController</code>: create one in the effect, pass <code>signal</code> to <code>fetch</code>, and call <code>controller.abort()</code> in the cleanup. This also stops the network request, so you save the bandwidth.\n\nThe simpler one, which works for any promise you cannot cancel: a boolean latch.\n\n<code>let ignore = false</code>\n<code>fetchData(id).then(d =&gt; { if (!ignore) setData(d) })</code>\n<code>return () =&gt; { ignore = true }</code>\n\nThe cleanup closes over <i>that run\'s</i> <code>ignore</code>, so each abandoned request silently discards its own result.',
    },
    {
      q: 'Why can’t you pass an async function to useEffect?',
      a: 'Because an async function always returns a promise, and React interprets the return value of an effect as its cleanup function. React would end up trying to call a promise at cleanup time, and you would get a warning plus no cleanup at all.\n\nThe standard shape is to define the async function inside and invoke it:\n\n<code>useEffect(() =&gt; { let ignore = false; async function run() { const d = await fetchThing(); if (!ignore) setData(d) } run(); return () =&gt; { ignore = true } }, [])</code>\n\nThe synchronous outer function can still return a real cleanup, which is the whole point.',
    },
    {
      q: 'An object in my dependency array makes the effect run every render. What do you do?',
      a: 'The object literal has a new identity every render, so <code>Object.is</code> always reports a change. Four options, roughly in order of preference.\n\n<b>Depend on primitives.</b> <code>[user.id, user.name]</code> instead of <code>[user]</code>. Usually the effect only cares about a field or two anyway, and primitives compare by value.\n\n<b>Move the object inside the effect.</b> If it is only used there, constructing it inside removes it from the dependency graph entirely.\n\n<b>Memoise it at the source</b> with <code>useMemo</code>, so the identity is stable for as long as its inputs are.\n\n<b>Hoist it out of the component</b> if it is a constant — a config object that never changes does not belong inside the render function at all.\n\nWhat you do <i>not</i> do is delete it from the array to make the lint warning go away. That converts a performance annoyance into a correctness bug.',
    },
    {
      q: 'When should you not use an effect at all?',
      a: 'More often than people expect. Three cases dominate.\n\n<b>Derived data.</b> If a value can be computed from props and state, compute it during render. An effect that recalculates and stores it in state costs an extra render and is stale for a frame.\n\n<b>Responding to user events.</b> If something should happen because the user clicked, put it in the click handler. Setting a state flag and reacting to it in an effect adds indirection and a render for nothing.\n\n<b>Resetting state when a prop changes.</b> Use a <code>key</code> instead.\n\nEffects are for synchronising with systems <i>outside</i> React: the DOM, the network, a WebSocket, localStorage, a chart library. If both ends of the synchronisation are inside React, you probably do not need one.',
    },
  ],
} satisfies TopicMeta

/* ---------------------------------------------------------------------------
   A deliberately unreliable API. Item 1 is slow, item 2 is fast — so clicking
   1 then 2 reliably produces the out-of-order resolution.
   --------------------------------------------------------------------------- */
async function fetchItem(id: number, signal?: AbortSignal): Promise<string> {
  const delay = id === 1 ? 1200 : 200
  await sleep(delay)
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  return `📦 item ${id} (took ${delay}ms)`
}

function RacyFetcher({ id, log }: { id: number; log: (s: string) => void }) {
  const [data, setData] = useState('—')

  useEffect(() => {
    log(`❌ start fetch ${id}`)
    fetchItem(id).then((d) => {
      // No guard. Whichever promise settles LAST wins, regardless of which
      // request the user actually wants.
      log(`❌ fetch ${id} resolved → setData`)
      setData(d)
    })
  }, [id, log])

  return <span className="mono">{data}</span>
}

function SafeFetcher({ id, log }: { id: number; log: (s: string) => void }) {
  const [data, setData] = useState('—')

  useEffect(() => {
    log(`✅ start fetch ${id}`)

    // The latch. `ignore` belongs to THIS run of the effect. When deps change,
    // the cleanup below sets this run's `ignore` to true, and this run's
    // `.then` becomes a no-op. The next run gets its own fresh `ignore`.
    let ignore = false

    fetchItem(id).then((d) => {
      if (ignore) {
        log(`✅ fetch ${id} resolved but was superseded — discarded`)
        return
      }
      log(`✅ fetch ${id} resolved → setData`)
      setData(d)
    })

    return () => {
      ignore = true
    }
  }, [id, log])

  return <span className="mono">{data}</span>
}

/* ---------------------------------------------------------------------------
   Stale closure: the interval captures `count` from the render that created it.
   --------------------------------------------------------------------------- */
function StaleInterval() {
  const [count, setCount] = useState(0)
  useEffect(() => {
    // ❌ `count` is 0 here, forever. The effect never re-runs (empty deps), so
    //    this closure never sees a newer value. Result: stuck at 1.
    const id = setInterval(() => setCount(count + 1), 500)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return <span className="big-num" style={{ color: 'var(--bad)' }}>{count}</span>
}

function FreshInterval() {
  const [count, setCount] = useState(0)
  useEffect(() => {
    // ✅ The updater form never reads `count` from the closure, so there is
    //    nothing to go stale and the empty dep array is honest.
    const id = setInterval(() => setCount((c) => c + 1), 500)
    return () => clearInterval(id)
  }, [])
  return <span className="big-num" style={{ color: 'var(--good)' }}>{count}</span>
}

export default function Demo() {
  const [id, setId] = useState(2)
  const [runningIntervals, setRunningIntervals] = useState(false)
  const { lines, push, clear } = useLog()

  // Stable identity so it can sit in the fetchers' dependency arrays without
  // re-triggering them. `useLog`'s push is already useCallback'd; this is here
  // to make the dependency honest.
  const log = useCallback((s: string) => push(s), [push])

  // Effect #1: sync the document title. A textbook "synchronise with something
  // outside React" case — and note the cleanup restores the previous value.
  const [title, setTitle] = useState('')
  useEffect(() => {
    if (!title) return
    const prev = document.title
    document.title = title
    return () => {
      document.title = prev
    }
  }, [title])

  const mountedRef = useRef(false)
  useEffect(() => {
    mountedRef.current = true
  }, [])

  return (
    <div className="stack">
      <Panel title="1. The race — click “1” then immediately “2”">
        <div className="row" style={{ marginBottom: 12 }}>
          <button onClick={() => { clear(); setId(1) }} className={id === 1 ? 'primary' : ''}>
            load item 1 (slow, 1200ms)
          </button>
          <button onClick={() => setId(2)} className={id === 2 ? 'primary' : ''}>
            load item 2 (fast, 200ms)
          </button>
        </div>
        <div className="grid2">
          <div className="panel">
            <div className="panel-title" style={{ color: 'var(--bad)' }}>no cleanup</div>
            <RacyFetcher id={id} log={log} />
          </div>
          <div className="panel">
            <div className="panel-title" style={{ color: 'var(--good)' }}>ignore-latch cleanup</div>
            <SafeFetcher id={id} log={log} />
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <Log lines={lines} empty="Click “load item 1” then “load item 2” quickly." />
        </div>
        <Callout kind="trap">
          The left panel ends up showing <b>item 1</b> even though you asked for
          item 2 — the slow response landed last. This is not a rare edge case;
          it happens every time a user clicks two things in a second.
        </Callout>
      </Panel>

      <Panel title="2. Stale closure in an interval">
        <div className="row" style={{ marginBottom: 10 }}>
          <button className="primary" onClick={() => setRunningIntervals((v) => !v)}>
            {runningIntervals ? 'Stop' : 'Start'} both counters
          </button>
        </div>
        {runningIntervals && (
          <div className="grid2">
            <div className="panel">
              <div className="panel-title">setCount(count + 1) — stuck at 1</div>
              <StaleInterval />
            </div>
            <div className="panel">
              <div className="panel-title">setCount(c =&gt; c + 1) — counts</div>
              <FreshInterval />
            </div>
          </div>
        )}
        <Callout>
          Same interval, same deps, same everything — only the updater form
          differs. The left one closed over <code>count === 0</code> on mount and
          has been computing <code>0 + 1</code> ever since.
        </Callout>
      </Panel>

      <Panel title="3. A well-behaved effect: syncing document.title">
        <div className="row">
          <input
            type="text"
            placeholder="type to change the browser tab title…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ width: 300 }}
          />
          <button onClick={() => setTitle('')}>restore</button>
        </div>
        <pre style={{ marginTop: 10 }}>
          <code>{`useEffect(() => {
  if (!title) return
  const prev = document.title   // capture what we are replacing
  document.title = title        // setup
  return () => {                // cleanup: undo exactly this run
    document.title = prev
  }
}, [title])`}</code>
        </pre>
        <Callout kind="tip">
          Note the symmetry: the cleanup undoes <i>this</i> setup using a value
          captured by <i>this</i> run. That is the shape every effect should
          have.
        </Callout>
      </Panel>
    </div>
  )
}
