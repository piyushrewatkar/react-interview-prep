import { memo, useState } from 'react'
import type { ReactNode } from 'react'
import type { TopicMeta } from '../../types'
import { Callout, Panel, RenderBadge, burnCpu } from '../../lib/ui'

export const meta = {
  title: 'Structural fixes: colocation & children-as-prop',
  summary:
    'Two techniques that cut re-renders to zero with no memo, no dependency arrays, and no maintenance burden.',
  notes: [
    '<b>Technique 1 — move state down.</b> State placed high re-renders everything below it. If only one subtree uses it, push it into that subtree.',
    '<b>Technique 2 — pass expensive subtrees as <code>children</code>.</b> The element is then created by the <i>grandparent</i>, so it is the same object across the parent&rsquo;s re-renders and React skips it.',
    '<b>Why children-as-prop works:</b> React bails out of re-rendering a child when the element object is referentially identical to last time. A <code>children</code> prop created higher up satisfies that automatically.',
    '<b>Neither costs anything at runtime.</b> No comparison, no cached value, no dependency array that can go stale.',
    '<b>Both are more robust than <code>memo</code></b>, because they cannot be silently defeated by someone later passing an inline object.',
    '<b>Technique 3 — lift only what must be lifted.</b> Instead of moving state up so two components can share it, consider whether one of them can render the other.',
    '<b>Technique 4 — split the component.</b> A "state container" wrapper around a presentational child localises the re-render to the wrapper.',
    '<b>Try these before memoising.</b> They remove the problem rather than papering over it.',
  ],
  questions: [
    {
      q: 'How would you stop a slow component re-rendering, without React.memo?',
      a: 'Two structural moves, both preferable to memo because they cost nothing at runtime and cannot be accidentally defeated later.\n\n<b>Move the state down.</b> If the state causing the re-render is only used by one part of the tree, it does not belong in the common parent. Push it into a small component that wraps only what depends on it. Now the expensive sibling is not below the state at all.\n\n<b>Pass the expensive subtree as <code>children</code>.</b> When a component receives <code>children</code>, that element object was created by its parent\'s parent. When the component re-renders because of its own state, the <code>children</code> prop is the <i>same object reference</i> as before, so React bails out and does not re-render it.\n\nThe second one surprises people and makes a great interview answer, because it achieves memo\'s result with no memo.',
    },
    {
      q: 'Explain exactly why the children-as-prop trick works.',
      a: 'It comes down to where the element object is created.\n\nNormally, <code>&lt;Parent&gt;</code> calling <code>&lt;Expensive /&gt;</code> in its body creates a fresh element object on every render of <code>Parent</code>. Different object, so React re-renders <code>Expensive</code>.\n\nIf instead <code>&lt;Expensive /&gt;</code> is written inside <code>&lt;App&gt;</code> and passed through as <code>&lt;Parent&gt;&lt;Expensive /&gt;&lt;/Parent&gt;</code>, that element is created during <code>App</code>\'s render. When <code>Parent</code> re-renders due to its own state, <code>App</code> has not re-rendered, so <code>props.children</code> holds the exact same element object it held before.\n\nReact compares the old and new elements, sees the same reference and the same type, and skips re-rendering that subtree entirely. It is the same bail-out <code>memo</code> triggers, obtained for free by moving where the JSX is written.',
    },
    {
      q: 'What is state colocation and why does it matter?',
      a: 'Keeping state as close as possible to the components that actually read it — the opposite instinct to "lift state up", which people over-apply.\n\nIt matters because a state update re-renders the component holding it plus everything below. State at the top of a page means every keystroke in a search box re-renders the entire page, even though only the results list cares. Moving it into a <code>SearchSection</code> component confines the re-render to that section.\n\nIt also improves readability: you can see what a piece of state affects by looking at where it lives, rather than tracing props down five levels.\n\nThe rule is to lift state only to the closest common ancestor of the components that genuinely need it, and no higher — and to push it back down when a refactor makes that possible.',
    },
    {
      q: 'When is memo still the right tool?',
      a: 'When the structural fixes do not apply. The clearest case is list rows: <code>items.map(item =&gt; &lt;Row item={item} /&gt;)</code> genuinely does create a new element per item per render, and you cannot hoist them out — the list is the thing that changes. Memoising <code>Row</code> so that only the rows whose data changed re-render is exactly right.\n\nSimilarly, a component that receives props from a parent which legitimately re-renders often, where the props themselves rarely change, is a fair memo candidate.\n\nThe framing I would give: structural fixes remove the re-render from the tree; memo intercepts one that structurally has to happen. Prefer removing, but intercepting is a real tool when you cannot.',
    },
  ],
} satisfies TopicMeta

/* An expensive component. In real code this is a chart, a table, or a
   thousand-node subtree. */
const Expensive = memo(function Expensive({ label }: { label: string }) {
  burnCpu(60)
  return (
    <div className="row">
      <span className="mono">{label}</span>
      <RenderBadge label="renders" />
      <span className="badge warn">60ms per render</span>
    </div>
  )
})

/* Non-memoised version, to prove the structural trick works without memo. */
function ExpensiveNoMemo({ label }: { label: string }) {
  burnCpu(60)
  return (
    <div className="row">
      <span className="mono">{label}</span>
      <RenderBadge label="renders" />
      <span className="badge warn">60ms, NOT memoised</span>
    </div>
  )
}

/* ===========================================================================
   ❌ VERSION A — state at the top. Every keystroke re-renders the expensive
   sibling that has nothing to do with the input.
   =========================================================================== */
function StateAtTop() {
  const [text, setText] = useState('')
  return (
    <div className="col">
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder="type here…" />
      <div className="muted" style={{ fontSize: 13 }}>you typed: {text || '—'}</div>
      <ExpensiveNoMemo label="expensive sibling" />
    </div>
  )
}

/* ===========================================================================
   ✅ VERSION B — state moved down into a small component that wraps only what
   needs it. The expensive component is no longer below the state.
   =========================================================================== */
function SearchField() {
  // The state now lives here, and this component's subtree is just the input
  // and a line of text.
  const [text, setText] = useState('')
  return (
    <>
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder="type here…" />
      <div className="muted" style={{ fontSize: 13 }}>you typed: {text || '—'}</div>
    </>
  )
}

function StateColocated() {
  return (
    <div className="col">
      <SearchField />
      <ExpensiveNoMemo label="expensive sibling" />
    </div>
  )
}

/* ===========================================================================
   ✅ VERSION C — children as a prop. The expensive element is created by the
   GRANDPARENT, so it is referentially stable across this component's renders.
   =========================================================================== */
function CounterShell({ children }: { children: ReactNode }) {
  // This component re-renders on every click…
  const [n, setN] = useState(0)
  return (
    <div className="col">
      <div className="row">
        <button onClick={() => setN((v) => v + 1)}>count: {n}</button>
        <RenderBadge label="shell" />
      </div>
      {/* …but `children` is the SAME element object it was last render,
          because whoever passed it in did not re-render. React compares the
          references, sees they match, and skips the subtree. */}
      {children}
    </div>
  )
}

export default function Demo() {
  const [tick, setTick] = useState(0)

  return (
    <div className="stack">
      <Callout>
        Every &ldquo;expensive&rdquo; component below burns 60ms per render.
        Type in the inputs and watch which ones stutter.
      </Callout>

      <div className="grid2">
        <Panel title="❌ State at the top">
          <StateAtTop />
          <div style={{ fontSize: 13, color: 'var(--bad)', marginTop: 10 }}>
            Every keystroke costs 60ms. The expensive component has nothing to
            do with the text.
          </div>
        </Panel>

        <Panel title="✅ State colocated">
          <StateColocated />
          <div style={{ fontSize: 13, color: 'var(--good)', marginTop: 10 }}>
            Typing is instant. The expensive component rendered once and is not
            below the state any more.
          </div>
        </Panel>
      </div>

      <Panel title="✅ Children as a prop — no memo required">
        <CounterShell>
          {/* Written HERE, in Demo. So this element object is created during
              Demo's render, not CounterShell's. Clicking the counter
              re-renders CounterShell but leaves this reference untouched. */}
          <ExpensiveNoMemo label="passed as children" />
        </CounterShell>
        <Callout kind="tip">
          <code>ExpensiveNoMemo</code> is not wrapped in <code>memo</code>, has
          no <code>useCallback</code> props and no dependency arrays — and it
          still renders exactly once. Moving where the JSX is written did all of
          it.
        </Callout>
      </Panel>

      <Panel title="The same thing, as code">
        <pre>
          <code>{`// ❌ <Expensive /> is created inside Shell's render.
//    New element object every click → re-render.
function Shell() {
  const [n, setN] = useState(0)
  return (
    <div>
      <button onClick={() => setN(n + 1)}>{n}</button>
      <Expensive />          {/* created here */}
    </div>
  )
}

// ✅ <Expensive /> is created inside App's render.
//    Shell re-rendering does not recreate it → React bails out.
function Shell({ children }) {
  const [n, setN] = useState(0)
  return (
    <div>
      <button onClick={() => setN(n + 1)}>{n}</button>
      {children}             {/* same object reference */}
    </div>
  )
}

function App() {
  return <Shell><Expensive /></Shell>   {/* created here */}
}`}</code>
        </pre>
      </Panel>

      <Panel title="For contrast: memo doing the same job">
        <div className="row" style={{ marginBottom: 10 }}>
          <button onClick={() => setTick((t) => t + 1)}>re-render parent ({tick})</button>
        </div>
        <Expensive label="React.memo, stable string prop" />
        <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 8 }}>
          Also works — but now every prop this component ever receives must have
          a stable identity, forever, or it silently stops working.
        </div>
      </Panel>
    </div>
  )
}
