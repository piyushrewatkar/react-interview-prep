import { useEffect, useMemo, useState } from 'react'
import type { TopicMeta } from '../../types'
import { Callout, Panel, RenderBadge } from '../../lib/ui'

export const meta = {
  title: 'You might not need an effect',
  summary:
    'The four things people reach for useEffect to do that should not be effects at all — and what to do instead.',
  notes: [
    '<b>Effects synchronise React with systems outside React.</b> If both ends of what you are syncing are inside React, you probably do not want an effect.',
    '<b>Anti-pattern 1 — derived state.</b> Storing <code>fullName</code> in state and updating it in an effect. Just compute it during render. Wrap in <code>useMemo</code> only if it is genuinely expensive.',
    '<b>Anti-pattern 2 — resetting state on a prop change.</b> Use a <code>key</code> instead; it is one line and there is no stale frame.',
    '<b>Anti-pattern 3 — reacting to a user event.</b> If it happens because the user clicked, put it in the click handler. An effect watching a flag adds an extra render and hides the causality.',
    '<b>Anti-pattern 4 — chained effects.</b> Effect A sets state, which triggers effect B, which sets more state. Each link is a full render pass and the order is implicit. Compute it all in one place.',
    '<b>Anti-pattern 5 — notifying the parent.</b> <code>useEffect(() =&gt; onChange(value), [value])</code> fires a render late. Call <code>onChange</code> in the same handler that changes the value.',
    '<b>The cost of an unnecessary effect</b> is a second render, a frame of stale UI, a dependency array to keep correct, and a cleanup you probably did not write.',
    '<b>Legitimate effects</b> subscribe to browser APIs, set up non-React widgets, sync with the network, or write to <code>document</code>/storage.',
  ],
  questions: [
    {
      q: 'When should you NOT use useEffect?',
      a: 'Whenever the thing you are synchronising is already inside React. Three specific cases dominate.\n\n<b>Derived data.</b> If a value can be computed from props and state, compute it during render. Storing it separately gives you two sources of truth, an extra render every time it updates, and a frame where the UI shows the old value.\n\n<b>Event responses.</b> If the trigger is "the user clicked", the logic belongs in the click handler. Setting a flag and having an effect watch it is indirection that hides why something happened.\n\n<b>Resetting state when props change.</b> A <code>key</code> does this declaratively, for free, with no intermediate render.\n\nThe framing I would use: an effect is an escape hatch <i>out of</i> React. If you never leave React, you did not need the hatch.',
    },
    {
      q: 'What is wrong with chaining effects?',
      a: 'Each link costs a complete render pass. Effect A sets state, React commits and paints, then effect B sees the change and sets more state, React commits and paints again. A three-link chain is three renders and three frames of intermediate, inconsistent UI before the result settles.\n\nIt is also very hard to read. The control flow is implicit in dependency arrays scattered across the component, so the only way to know what happens after A is to grep for everything depending on what A wrote. Adding a fourth piece of state can silently re-order the whole thing.\n\nAnd it is fragile: it is easy to create a cycle where B updates something A depends on, and now you have an infinite loop that only shows up under certain data.\n\nThe fix is almost always to do the work in one place — either compute everything during render, or perform the whole sequence inside the event handler that started it.',
    },
    {
      q: 'How do you reset state when a prop changes, without an effect?',
      a: 'Change the <code>key</code>. <code>&lt;Editor key={draftId} draftId={draftId} /&gt;</code> — when <code>draftId</code> changes React sees a different key at that position, unmounts the old instance and mounts a fresh one. All internal state resets automatically, and it keeps working when you add new state later.\n\nThe effect version — watch the prop, call four setters — has to be updated every time you add a piece of state, and it runs <i>after</i> a render, so there is one frame where the new draft is displayed with the previous draft\'s unsaved text in the textarea.\n\nIf only part of the state should reset, the React docs describe adjusting state during render: compare the prop to a stored copy and call the setter in the render body. React restarts the render immediately without painting the intermediate result. It is narrow, but it is documented and it is still better than an effect.',
    },
    {
      q: 'Is useMemo the answer to derived state?',
      a: 'It is the answer to <i>expensive</i> derived state, which is much rarer than people assume. The default answer is to just compute the value inline.\n\n<code>const fullName = firstName + " " + lastName</code> does not need memoising — the comparison of the dependency array costs about as much as the concatenation, and you have added a hook plus a dependency array to maintain.\n\n<code>useMemo</code> earns its place when the computation is genuinely heavy (sorting or filtering thousands of items, a parse, a layout calculation) or when the <i>reference identity</i> of the result matters because it feeds a <code>React.memo</code> child or another hook\'s dependency array. That second reason is often the real one.\n\nEither way: compute during render, do not store in state. Memoising is an optimisation on top of the correct pattern, not an alternative to it.',
    },
    {
      q: 'What effects are legitimate, then?',
      a: 'Ones that touch something React does not own.\n\nSubscribing to a browser API — <code>resize</code>, <code>online</code>/<code>offline</code>, <code>matchMedia</code>, <code>IntersectionObserver</code>. Setting up a non-React widget such as a map or a chart library and tearing it down on unmount. Writing to <code>document.title</code>, <code>localStorage</code>, or a cookie. Opening and closing a WebSocket. Firing analytics on mount.\n\nData fetching is the interesting middle case: it is a genuine external system, so an effect is <i>correct</i>, but doing it by hand means you own the race conditions, caching, deduplication, retries and refetch-on-focus. In a real app that is why you use React Query or the framework\'s loader instead — not because the effect is wrong in principle, but because there is a lot to get right.',
    },
  ],
} satisfies TopicMeta

type Item = { id: number; label: string; price: number }
const CATALOGUE: Item[] = [
  { id: 1, label: 'Keyboard', price: 89 },
  { id: 2, label: 'Monitor', price: 340 },
  { id: 3, label: 'Mouse', price: 45 },
  { id: 4, label: 'Desk lamp', price: 28 },
  { id: 5, label: 'Webcam', price: 120 },
]

/* ===========================================================================
   1. Derived state
   =========================================================================== */

function DerivedWithEffect() {
  const [query, setQuery] = useState('')
  // ❌ A second source of truth for something fully determined by `query`.
  const [results, setResults] = useState<Item[]>(CATALOGUE)
  const [total, setTotal] = useState(0)

  // ❌ Effect #1. Runs AFTER the render that changed `query`, so there is one
  //    frame where the input shows the new text and the list shows the old
  //    results.
  useEffect(() => {
    setResults(CATALOGUE.filter((i) => i.label.toLowerCase().includes(query.toLowerCase())))
  }, [query])

  // ❌ Effect #2, CHAINED off the first. A whole extra render pass just to sum
  //    a list we already have. And the order is implicit — nothing in the code
  //    says this must run after the one above.
  useEffect(() => {
    setTotal(results.reduce((sum, i) => sum + i.price, 0))
  }, [results])

  return (
    <div className="col">
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="filter…" />
      <div className="row">
        <RenderBadge label="renders" />
        <span className="badge">total £{total}</span>
      </div>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
        {results.map((i) => (
          <li key={i.id}>{i.label}</li>
        ))}
      </ul>
    </div>
  )
}

function DerivedDuringRender() {
  const [query, setQuery] = useState('')

  // ✅ One source of truth. Everything else is computed from it, in the same
  //    render, so the screen is never internally inconsistent.
  const results = useMemo(
    () => CATALOGUE.filter((i) => i.label.toLowerCase().includes(query.toLowerCase())),
    [query],
  )
  // ✅ No useMemo here — summing five numbers is cheaper than comparing a
  //    dependency array. Memoise for expense or for reference identity, not
  //    out of habit.
  const total = results.reduce((sum, i) => sum + i.price, 0)

  return (
    <div className="col">
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="filter…" />
      <div className="row">
        <RenderBadge label="renders" />
        <span className="badge good">total £{total}</span>
      </div>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
        {results.map((i) => (
          <li key={i.id}>{i.label}</li>
        ))}
      </ul>
    </div>
  )
}

/* ===========================================================================
   2. Resetting on a prop change
   =========================================================================== */

function EditorWithEffect({ draftId }: { draftId: number }) {
  const [text, setText] = useState('')

  // ❌ Runs after the render, so for one frame the heading says "Draft 2"
  //    while the textarea still holds draft 1's text. And every new piece of
  //    state means another line here, forever.
  useEffect(() => {
    setText('')
  }, [draftId])

  return (
    <div className="col">
      <div className="panel-title">Draft {draftId}</div>
      <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} />
    </div>
  )
}

function EditorWithKey({ draftId }: { draftId: number }) {
  // ✅ No effect at all. The parent renders <EditorWithKey key={draftId} />,
  //    so React remounts this component and every piece of state resets —
  //    including state added next year.
  const [text, setText] = useState('')

  return (
    <div className="col">
      <div className="panel-title">Draft {draftId}</div>
      <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} />
    </div>
  )
}

/* ===========================================================================
   3. Reacting to an event
   =========================================================================== */

function EventWithEffect({ log }: { log: (s: string) => void }) {
  const [submitted, setSubmitted] = useState(false)

  // ❌ A flag in state purely to trigger an effect. Extra render, and the
  //    reason "why did this fire?" is now two places away from the button.
  useEffect(() => {
    if (!submitted) return
    log('❌ effect: sent analytics (one render late)')
    setSubmitted(false)
  }, [submitted, log])

  return <button className="danger" onClick={() => setSubmitted(true)}>submit via flag</button>
}

function EventInHandler({ log }: { log: (s: string) => void }) {
  return (
    <button
      className="primary"
      onClick={() => {
        // ✅ It happened because the user clicked. Say so, right here.
        log('✅ handler: sent analytics immediately')
      }}
    >
      submit in handler
    </button>
  )
}

export default function Demo() {
  const [draftId, setDraftId] = useState(1)
  const [logs, setLogs] = useState<string[]>([])
  const log = (s: string) => setLogs((l) => [...l, s].slice(-6))

  return (
    <div className="stack">
      <Panel title="1. Derived state — two effects vs. none">
        <div className="grid2">
          <div className="panel">
            <div className="panel-title" style={{ color: 'var(--bad)' }}>
              state + 2 chained effects
            </div>
            <DerivedWithEffect />
          </div>
          <div className="panel">
            <div className="panel-title" style={{ color: 'var(--good)' }}>
              computed during render
            </div>
            <DerivedDuringRender />
          </div>
        </div>
        <Callout kind="trap">
          Type one character and compare the render counts. The left column
          renders three times — once for the keystroke, once for the filter
          effect, once for the total effect — and shows an inconsistent total in
          between.
        </Callout>
      </Panel>

      <Panel title="2. Resetting on a prop change — effect vs. key">
        <div className="row" style={{ marginBottom: 12 }}>
          <button className="primary" onClick={() => setDraftId((d) => d + 1)}>
            next draft (now {draftId})
          </button>
          <span className="muted" style={{ fontSize: 13 }}>
            Type in both boxes, then switch drafts.
          </span>
        </div>
        <div className="grid2">
          <div className="panel">
            <div className="panel-title" style={{ color: 'var(--bad)' }}>
              useEffect(() =&gt; setText(&apos;&apos;), [draftId])
            </div>
            <EditorWithEffect draftId={draftId} />
          </div>
          <div className="panel">
            <div className="panel-title" style={{ color: 'var(--good)' }}>
              &lt;Editor key={'{'}draftId{'}'} /&gt;
            </div>
            {/* THE ENTIRE FIX IS THE key PROP. */}
            <EditorWithKey key={draftId} draftId={draftId} />
          </div>
        </div>
      </Panel>

      <Panel title="3. Reacting to an event">
        <div className="row">
          <EventWithEffect log={log} />
          <EventInHandler log={log} />
          <button onClick={() => setLogs([])}>clear</button>
        </div>
        <pre className="log" style={{ marginTop: 10 }}>
          {logs.length === 0 ? 'Press a button.' : logs.join('\n')}
        </pre>
      </Panel>

      <Panel title="The decision tree">
        <pre>
          <code>{`Can I compute this from props/state during render?
   └─ yes → do that. (useMemo only if expensive, or if identity matters)

Does this happen because the user did something?
   └─ yes → put it in the event handler.

Should this state reset when a prop changes?
   └─ yes → give the component a key.

Am I synchronising with something outside React?
   (DOM, network, storage, a subscription, a third-party widget)
   └─ yes → useEffect. Write the cleanup first.`}</code>
        </pre>
      </Panel>
    </div>
  )
}
