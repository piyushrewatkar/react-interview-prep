import { useState } from 'react'
import { flushSync } from 'react-dom'
import type { TopicMeta } from '../../types'
import { Callout, Panel, RenderBadge, useLog, Log } from '../../lib/ui'

export const meta = {
  title: 'State, batching & the stale closure',
  summary:
    'Why setState looks asynchronous, why three increments only add one, and what React 18 changed about batching outside event handlers.',
  notes: [
    '<b>State is a snapshot.</b> Each render captures its own <code>count</code> as a const. Calling <code>setCount</code> does not mutate that const — it schedules a new render whose function body will see a new one.',
    '<b>Updates are batched.</b> Multiple <code>setState</code> calls in the same tick are collected and flushed as one re-render. That is why <code>setCount(count+1)</code> three times in a row adds one, not three: all three read the same snapshot value.',
    '<b>The updater form fixes it.</b> <code>setCount(c =&gt; c + 1)</code> queues a <i>function</i>. React applies the queued functions in order against the latest value, so three of them add three.',
    '<b>React 18 made batching automatic everywhere.</b> Before 18, React only batched inside its own event handlers; updates in <code>setTimeout</code>, promises, or native listeners each caused their own render. With <code>createRoot</code>, everything is batched.',
    '<b><code>flushSync</code> is the opt-out.</b> It forces React to render and commit synchronously before continuing, which you need when you must read the updated DOM immediately (measuring, then scrolling). It costs you a synchronous re-render, so it is a scalpel, not a default.',
    '<b>Never mutate state.</b> <code>arr.push(x); setArr(arr)</code> passes the same reference, so <code>Object.is</code> says nothing changed and React may bail out of the render entirely. Always produce a new object or array.',
    '<b>React bails out on identical state.</b> Setting state to a value that is <code>Object.is</code>-equal to the current one skips the re-render — though React may still render <i>once</i> more before deciding to bail, so do not rely on it for correctness.',
  ],
  questions: [
    {
      q: 'Is setState synchronous or asynchronous?',
      a: 'Neither word is quite right, which is why the question is asked. <code>setState</code> returns immediately, but the state variable in the current scope does not change — it cannot, it is a <code>const</code> captured by that render. What <code>setState</code> does is enqueue an update and schedule a re-render.\n\nSo it is not asynchronous in the sense of returning a promise or going through the event loop; within a React event handler in React 18 the re-render is flushed synchronously at the end of the handler. It is better described as <i>deferred</i>: the value you read after calling it is the value from the render you are currently in, and you will see the new one on the next render.',
    },
    {
      q: 'Why does calling setCount(count + 1) three times only increment by one?',
      a: 'Because all three calls read <code>count</code> from the same render snapshot. If <code>count</code> is 0, you have queued "set to 1", "set to 1", "set to 1". React batches them into a single re-render, applies them in order, and lands on 1.\n\nThe fix is the updater form: <code>setCount(c =&gt; c + 1)</code> queues a function instead of a value. React applies each function to the result of the previous one — 0→1→2→3 — so you get 3. The rule of thumb: if the next state depends on the current state, use the updater form.',
    },
    {
      q: 'What changed about batching in React 18?',
      a: 'Batching became automatic everywhere. In React 17 and earlier, React only batched updates that originated inside its own synthetic event handlers. An update inside a <code>setTimeout</code>, a <code>.then()</code>, a <code>fetch</code> callback or a native DOM listener was flushed on its own, so two setStates in a promise meant two renders.\n\nReact 18 batches all of them, provided you mount with <code>createRoot</code> — that is the opt-in. It is a behavioural change, and the one place it bites is code that relied on an intermediate render being committed. <code>flushSync</code> is the documented escape hatch for those cases.',
    },
    {
      q: 'What is a stale closure and how do you avoid it?',
      a: 'It is when a function captures a value from a render that has since been superseded, and then runs later using that outdated value. The classic case is an interval: <code>useEffect(() =&gt; { setInterval(() =&gt; setCount(count + 1), 1000) }, [])</code>. The effect runs once, so its callback closes over <code>count</code> from the first render forever — the counter sticks at 1.\n\nThree ways out, in order of preference. Use the updater form, <code>setCount(c =&gt; c + 1)</code>, so the callback never needs to read the value. Or add the value to the dependency array so the effect re-subscribes with a fresh closure. Or, if you need the latest value without re-subscribing, keep it in a ref and read <code>ref.current</code>.\n\nThe underlying point is that this is not a React quirk — it is how JavaScript closures work. React just creates a lot of them.',
    },
    {
      q: 'When would you use flushSync?',
      a: 'When you need the DOM to reflect a state update before the next line of code runs. The canonical example is adding an item to a list and immediately scrolling to it: without <code>flushSync</code> the new node does not exist yet, so <code>scrollIntoView</code> has nothing to scroll to. Same for focusing a newly rendered input, or measuring an element you just revealed.\n\nThe cost is real: it forces a synchronous render and commit, discarding React\'s ability to batch or prioritise, and it will warn if called during an existing render. Treat it as a last resort — often a layout effect or a ref callback solves the problem without it.',
    },
    {
      q: 'Why is mutating state directly a problem if you call setState afterwards?',
      a: 'Because React decides whether to re-render by comparing the new state to the old with <code>Object.is</code>. If you push onto the existing array and hand the same array back, the references are identical, so React concludes nothing changed and can skip the render entirely.\n\nIt also breaks every optimisation downstream: <code>React.memo</code>, <code>useMemo</code> dependencies and <code>useSelector</code> equality checks all rely on reference changes to detect updates. And it makes concurrent rendering unsafe, because React may render a component twice off the same state and your mutation would apply twice. Produce a new array or object — <code>[...arr, x]</code>, <code>{...obj, k: v}</code> — every time.',
    },
  ],
} satisfies TopicMeta

export default function Demo() {
  const [count, setCount] = useState(0)
  const [a, setA] = useState(0)
  const [b, setB] = useState(0)
  const { lines, push, clear } = useLog()

  // ---------------------------------------------------------------------------
  // THE BUG. All three calls read `count` from THIS render's snapshot.
  // If count is 0, we have queued: set→1, set→1, set→1.
  // ---------------------------------------------------------------------------
  const tripleWrong = () => {
    setCount(count + 1)
    setCount(count + 1)
    setCount(count + 1)
    // `count` is still the OLD value on this line. It is a const. It cannot change.
    push(`tripleWrong(): count read as ${count} three times → queued ${count + 1} ×3`)
  }

  // ---------------------------------------------------------------------------
  // THE FIX. Each call queues a FUNCTION. React applies them in sequence against
  // the running result: 0→1→2→3.
  // ---------------------------------------------------------------------------
  const tripleRight = () => {
    setCount((c) => c + 1)
    setCount((c) => c + 1)
    setCount((c) => c + 1)
    push(`tripleRight(): queued 3 updater functions → ${count} + 3`)
  }

  // Two different pieces of state, one event handler. React 18 renders ONCE.
  // Watch the render badge — it goes up by one, not two.
  const batched = () => {
    setA((v) => v + 1)
    setB((v) => v + 1)
    push('batched(): two setStates in one handler → one render')
  }

  // Pre-React-18 this would have caused TWO renders because it is outside a
  // React event handler. With createRoot it is batched like everything else.
  const batchedInTimeout = () => {
    setTimeout(() => {
      setA((v) => v + 1)
      setB((v) => v + 1)
      push('setTimeout: still ONE render in React 18 (two in React 17)')
    }, 0)
  }

  // flushSync forces the commit to happen before the next statement.
  const withFlushSync = () => {
    flushSync(() => {
      setA((v) => v + 1)
    })
    // By this line the DOM is already updated — which is the whole point.
    const el = document.getElementById('flush-target')
    push(`flushSync: DOM already reads "${el?.textContent}" on the very next line`)
  }

  return (
    <div className="stack">
      <div className="row">
        <RenderBadge label="Demo" />
        <span className="badge">count: {count}</span>
        <span className="badge" id="flush-target">
          a: {a}
        </span>
        <span className="badge">b: {b}</span>
      </div>

      <div className="grid2">
        <Panel title="Snapshot vs. updater">
          <div className="col">
            <button className="danger" onClick={tripleWrong}>
              setCount(count + 1) ×3 → adds 1
            </button>
            <button className="primary" onClick={tripleRight}>
              setCount(c =&gt; c + 1) ×3 → adds 3
            </button>
            <button onClick={() => setCount(0)}>reset count</button>
          </div>
        </Panel>

        <Panel title="Batching">
          <div className="col">
            <button onClick={batched}>two setStates, one handler</button>
            <button onClick={batchedInTimeout}>two setStates, inside setTimeout</button>
            <button onClick={withFlushSync}>flushSync(() =&gt; setA(...))</button>
          </div>
        </Panel>
      </div>

      <Panel title="What happened">
        <Log lines={lines} empty="Press a button above." />
        <div className="row" style={{ marginTop: 10 }}>
          <button onClick={clear}>Clear log</button>
        </div>
      </Panel>

      <Callout kind="trap">
        <b>The mental model that makes this obvious:</b> each render is a
        photograph. <code>count</code> inside a handler is whatever was in the
        photograph that handler was created in. <code>setCount</code> does not
        edit the photograph — it asks for a new one to be taken.
      </Callout>
    </div>
  )
}
