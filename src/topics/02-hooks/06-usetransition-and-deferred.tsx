import { useDeferredValue, useMemo, useState, useTransition } from 'react'
import type { TopicMeta } from '../../types'
import { Callout, Panel, burnCpu } from '../../lib/ui'

export const meta = {
  title: 'useTransition & useDeferredValue',
  summary:
    'Concurrent React in practice: marking an update as interruptible so a slow render never blocks typing.',
  notes: [
    '<b>The problem they solve:</b> one state update drives two things — a fast one (the input you are typing in) and a slow one (a 10,000-row filtered list). Without help, every keystroke waits for the slow render.',
    '<b><code>useTransition</code></b> returns <code>[isPending, startTransition]</code>. Updates inside <code>startTransition</code> are low priority: React can interrupt and restart them so urgent updates (typing, clicking) go first.',
    '<b><code>useDeferredValue</code></b> takes a value and returns a lagging copy. React renders with the old value immediately, then re-renders with the new one at low priority.',
    '<b>Which to use:</b> <code>useTransition</code> when you own the <code>setState</code> call. <code>useDeferredValue</code> when you only receive the value as a prop and cannot wrap the update.',
    '<b>They do not make anything faster.</b> The slow render still takes the same time. They change <i>scheduling</i>, so the expensive work stops blocking the responsive work.',
    '<b><code>isPending</code> is the UX payoff</b> — you can grey out the stale results instead of freezing the page.',
    '<b>Do not wrap controlled-input updates in a transition.</b> The input value must be urgent or typing feels laggy. Wrap the <i>derived</i> update.',
    '<b>Memoise the expensive child.</b> Deferring only helps if the slow component actually skips re-rendering when its input has not changed — so it needs <code>React.memo</code> or a <code>useMemo</code>&rsquo;d subtree.',
  ],
  questions: [
    {
      q: 'What problem do concurrent features solve?',
      a: 'Before React 18, rendering was one uninterruptible unit of work. Once a render started it ran to completion, so a component that took 300ms to render blocked the main thread for 300ms — during which typing, clicking and scrolling all queued up behind it.\n\nThe classic manifestation is a search box over a large list: you type a character, React re-renders the list synchronously, and the character appears a third of a second later. Debouncing helps but is a blunt instrument — it delays everything by a fixed amount whether or not it was needed.\n\nConcurrent rendering makes the render phase interruptible. React can start rendering the list, notice a keystroke arrived, abandon that work, render the input immediately, and restart the list render from scratch. The user is never waiting on work they have already superseded.',
    },
    {
      q: 'What is the difference between useTransition and useDeferredValue?',
      a: 'They achieve the same scheduling outcome from opposite ends.\n\n<code>useTransition</code> marks an <i>update</i> as non-urgent: you wrap the <code>setState</code> call in <code>startTransition</code>. You need to own that call site.\n\n<code>useDeferredValue</code> marks a <i>value</i> as allowed to lag: you pass it in and get back a version that may be one render behind. You use it when the value arrives as a prop and you have no access to the setter — a shared component receiving <code>query</code> from a parent, for instance.\n\n<code>useTransition</code> also gives you <code>isPending</code> directly. With <code>useDeferredValue</code> you derive the equivalent by comparing <code>value !== deferredValue</code>.',
    },
    {
      q: 'Is useTransition just a debounce?',
      a: 'No, and the difference matters. A debounce delays <i>starting</i> the work by a fixed timeout — 300ms of nothing happening, whether the device is a flagship phone or a decade-old laptop. If the work turns out to be fast, you wasted 300ms; if it is slow, you still block for its full duration once it starts.\n\nA transition starts the work immediately and makes it <i>interruptible</i>. On a fast machine the result appears with no delay at all. On a slow one, React abandons and restarts the render whenever something more urgent arrives, so typing stays responsive regardless.\n\nThey also compose: debouncing the network request and transitioning the render are solving two different problems, and a serious search UI often does both.',
    },
    {
      q: 'Why does my transition not seem to help?',
      a: 'Almost always because the expensive component re-renders anyway. Deferring an update only pays off if the slow subtree can <i>skip</i> rendering while the value is stale — if it re-renders on every parent render regardless, you have changed the priority of work that still has to happen every time.\n\nSo the expensive child needs <code>React.memo</code>, and the props you pass it need stable identities. A common miss is passing a fresh object or an inline arrow, which defeats the memo.\n\nThe other frequent cause is wrapping the wrong update. If you put the controlled input\'s own <code>setQuery</code> inside <code>startTransition</code>, the input itself becomes low-priority and typing feels worse, not better. Keep the input urgent; defer the derived list.',
    },
    {
      q: 'What does isPending actually tell you?',
      a: 'That React has accepted a transition update but has not finished rendering it yet — so what is on screen is the previous, stale result.\n\nIt exists for UX. Without it the user sees old results with no indication that new ones are coming, which reads as "the app ignored me". With it you can dim the list, show a subtle spinner, or disable a sort control, while still keeping the old content visible and interactive rather than replacing it with a skeleton.\n\nThat last part is the real argument: a transition lets you show <i>stale but useful</i> content during the update, where a Suspense fallback would blank the region entirely.',
    },
  ],
} satisfies TopicMeta

const ITEMS = Array.from({ length: 4000 }, (_, i) => `Item ${i} — ${['alpha', 'beta', 'gamma', 'delta'][i % 4]}`)

/**
 * Deliberately slow. `burnCpu` per render makes the blocking obvious; in real
 * code the equivalent is thousands of DOM nodes, or a chart re-layout.
 *
 * The `useMemo` inside matters: without it, even a deferred value would redo
 * the filtering on every render and the transition would buy nothing.
 */
function SlowList({ query }: { query: string }) {
  const results = useMemo(() => {
    burnCpu(120) // pretend this is 4000 rows of real layout work
    return ITEMS.filter((i) => i.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
  }, [query])

  return (
    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }} className="mono">
      {results.length === 0 && <li className="muted">no matches</li>}
      {results.map((r) => (
        <li key={r}>{r}</li>
      ))}
    </ul>
  )
}

/* --- Version A: no concurrency. Typing is blocked by the list render. ------ */
function Blocking() {
  const [query, setQuery] = useState('')
  return (
    <div className="col">
      <input
        type="text"
        placeholder="type fast — it will stutter"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <SlowList query={query} />
    </div>
  )
}

/* --- Version B: useTransition. We own the setState, so we wrap it. --------- */
function WithTransition() {
  // `query` is urgent: it drives the input's value and MUST update instantly.
  const [query, setQuery] = useState('')
  // `listQuery` is the non-urgent copy that drives the expensive render.
  const [listQuery, setListQuery] = useState('')
  const [isPending, startTransition] = useTransition()

  return (
    <div className="col">
      <input
        type="text"
        placeholder="type fast — stays smooth"
        value={query}
        onChange={(e) => {
          // URGENT. Never put the input's own value inside startTransition, or
          // typing itself becomes low-priority and feels worse.
          setQuery(e.target.value)

          // NON-URGENT. React may interrupt and restart this render as many
          // times as it needs to keep the keystrokes flowing.
          startTransition(() => setListQuery(e.target.value))
        }}
      />
      <div className="row">
        <span className={`badge ${isPending ? 'warn' : 'good'}`}>
          {isPending ? 'updating…' : 'up to date'}
        </span>
      </div>
      {/* Dimming stale content beats blanking it — the user can still read it. */}
      <div style={{ opacity: isPending ? 0.45 : 1, transition: 'opacity 120ms' }}>
        <SlowList query={listQuery} />
      </div>
    </div>
  )
}

/* --- Version C: useDeferredValue. For when you only have the value. -------- */
function WithDeferred() {
  const [query, setQuery] = useState('')

  // We do not need to touch the setter at all. React gives us a copy of
  // `query` that is allowed to lag behind by a render.
  const deferredQuery = useDeferredValue(query)

  // The equivalent of isPending: the deferred copy has not caught up yet.
  const isStale = query !== deferredQuery

  return (
    <div className="col">
      <input
        type="text"
        placeholder="same result, different API"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="row">
        <span className={`badge ${isStale ? 'warn' : 'good'}`}>
          {isStale ? 'stale' : 'fresh'}
        </span>
      </div>
      <div style={{ opacity: isStale ? 0.45 : 1, transition: 'opacity 120ms' }}>
        <SlowList query={deferredQuery} />
      </div>
    </div>
  )
}

export default function Demo() {
  const [showBlocking, setShowBlocking] = useState(false)

  return (
    <div className="stack">
      <Callout>
        Each list burns ~120ms of CPU per render. Type quickly in each box and
        feel the difference — this is not a subtle effect.
      </Callout>

      <div className="grid2">
        <Panel title="✅ useTransition — you own the setState">
          <WithTransition />
        </Panel>
        <Panel title="✅ useDeferredValue — you only have the value">
          <WithDeferred />
        </Panel>
      </div>

      <Panel title="❌ The baseline (careful — this one really does block)">
        <div className="row" style={{ marginBottom: 10 }}>
          <button className="danger" onClick={() => setShowBlocking((v) => !v)}>
            {showBlocking ? 'Hide' : 'Show'} the blocking version
          </button>
        </div>
        {showBlocking && <Blocking />}
      </Panel>

      <Panel title="Choosing between them">
        <table className="data">
          <thead>
            <tr>
              <th />
              <th>useTransition</th>
              <th>useDeferredValue</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>You need</td>
              <td>Access to the setState call</td>
              <td>Only the value itself</td>
            </tr>
            <tr>
              <td>Typical place</td>
              <td>The component that owns the state</td>
              <td>A shared component receiving a prop</td>
            </tr>
            <tr>
              <td>Pending signal</td>
              <td className="mono">isPending</td>
              <td className="mono">value !== deferred</td>
            </tr>
            <tr>
              <td>Also works for</td>
              <td>Route changes, tab switches, any non-urgent setState</td>
              <td>Suspense: keeps old content while new data loads</td>
            </tr>
          </tbody>
        </table>
      </Panel>

      <Callout kind="trap">
        <b>The prerequisite people forget.</b> Deferring only helps if the
        expensive subtree can <i>skip</i> work when its input is unchanged. If{' '}
        <code>SlowList</code> had no <code>useMemo</code> (or no{' '}
        <code>React.memo</code>), it would redo the filtering on every render
        and neither hook would buy you anything.
      </Callout>
    </div>
  )
}
