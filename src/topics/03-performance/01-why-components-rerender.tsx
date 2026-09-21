import { memo, useState } from 'react'
import type { TopicMeta } from '../../types'
import { Callout, Panel, RenderBadge } from '../../lib/ui'

export const meta = {
  title: 'Why components re-render',
  summary:
    'There are exactly four reasons. Knowing them turns "my app is slow" from guesswork into a checklist.',
  notes: [
    '<b>Reason 1 — its own state changed.</b> <code>useState</code>/<code>useReducer</code> updated to a value that is not <code>Object.is</code>-equal to the previous one.',
    '<b>Reason 2 — its parent re-rendered.</b> By default a parent re-rendering re-renders <i>all</i> its children, regardless of whether their props changed.',
    '<b>Reason 3 — a context it consumes changed.</b> This bypasses props entirely and cannot be blocked by <code>React.memo</code>.',
    '<b>Reason 4 — a hook it uses triggered an update</b> (<code>useSyncExternalStore</code>, a Redux <code>useSelector</code> whose slice changed, etc.).',
    '<b>Props changing is NOT on the list.</b> That surprises people. Props changing is a <i>consequence</i> of the parent re-rendering; a child with identical props still re-renders unless it is memoised.',
    '<b>A re-render is not a DOM update.</b> React calls your function and diffs the result; if nothing changed, the commit phase does nothing. Re-renders are usually cheap.',
    '<b>Therefore: do not optimise re-renders by default.</b> Measure first. The expensive ones are components rendering thousands of nodes, doing heavy computation, or sitting at the top of a large tree.',
    '<b>The cheapest fix is almost always structural</b> — move state down, or pass children as a prop — not <code>memo</code> everywhere.',
  ],
  questions: [
    {
      q: 'What causes a React component to re-render?',
      a: 'Four things. Its own state changed. Its parent re-rendered. A context it consumes changed. Or a hook it uses signalled an update — a store subscription, for example.\n\nThe one that is <i>not</i> on the list is "its props changed", which catches people out. Props do not have independent agency: they change because the parent re-rendered and passed new values. And the corollary is the important bit — if the parent re-renders and passes <i>identical</i> props, the child still re-renders anyway. React does not compare props by default; you have to opt in with <code>React.memo</code>.',
    },
    {
      q: 'Is re-rendering bad?',
      a: 'Usually not. A re-render means React calls your component function and diffs the returned element tree against the previous one. If the output is the same, the commit phase touches no DOM at all. For a typical component that is well under a millisecond — cheaper than the memoisation machinery you would add to avoid it.\n\nIt becomes bad in specific situations: a component rendering thousands of nodes, one doing genuinely expensive computation in its body, one near the root of a large tree, or one re-rendering many times per second during a drag or an animation.\n\nSo the answer to "how do I stop this re-rendering" is usually "why do you want to?". Profile first, and optimise the render that actually shows up in the flame graph.',
    },
    {
      q: 'If a parent re-renders but a child’s props are unchanged, does the child re-render?',
      a: 'Yes, by default. React re-renders the whole subtree; it does not compare props unless you ask it to.\n\nThat is a deliberate design choice — comparing every prop of every component on every render would cost more than just re-rendering most of the time, and React cannot know which of your components are expensive.\n\nThe opt-ins are <code>React.memo</code>, which wraps a component in a shallow props comparison, and the structural tricks: if the child is passed to the parent as <code>children</code> rather than created inside it, the element object is created by the <i>grandparent</i> and does not change when the parent re-renders — so React bails out of re-rendering it without any memoisation at all.',
    },
    {
      q: 'How do you find out which component is re-rendering and why?',
      a: 'React DevTools, in two modes.\n\nThe Profiler tab: record an interaction, then look at the flame graph. It shows every component that rendered in each commit, how long each took, and — if you enable "Record why each component rendered" in the profiler settings — the specific reason: props changed (and which ones), hooks changed, parent rendered.\n\nThe Components tab has a "Highlight updates when components render" setting, which flashes a border around each re-rendering component in the live app. That is the fastest way to spot a component flashing during an unrelated interaction.\n\nBeyond that, the <code>&lt;Profiler&gt;</code> component lets you record timings programmatically, which is how you would catch regressions in CI.',
    },
  ],
} satisfies TopicMeta

/* --- Children, both plain and memoised ------------------------------------ */

function PlainChild({ label }: { label: string }) {
  return (
    <div className="row">
      <span className="mono" style={{ minWidth: 150 }}>
        {label}
      </span>
      <RenderBadge label="renders" />
    </div>
  )
}

// `memo` adds a shallow props comparison in front of the component. If every
// prop is Object.is-equal to last time, React reuses the previous output.
const MemoChild = memo(function MemoChild({ label }: { label: string }) {
  return (
    <div className="row">
      <span className="mono" style={{ minWidth: 150 }}>
        {label}
      </span>
      <RenderBadge label="renders" />
    </div>
  )
})

// Same memo, but it receives an OBJECT prop. Watch it fail.
const MemoWithObjectProp = memo(function MemoWithObjectProp({
  config,
}: {
  config: { label: string }
}) {
  return (
    <div className="row">
      <span className="mono" style={{ minWidth: 150 }}>
        {config.label}
      </span>
      <RenderBadge label="renders" />
    </div>
  )
})

export default function Demo() {
  const [tick, setTick] = useState(0)
  const [unrelated, setUnrelated] = useState(0)

  return (
    <div className="stack">
      <div className="row">
        <button className="primary" onClick={() => setTick((t) => t + 1)}>
          re-render the parent ({tick})
        </button>
        <button onClick={() => setUnrelated((u) => u + 1)}>
          change unrelated state ({unrelated})
        </button>
        <RenderBadge label="parent" />
      </div>

      <Panel title="Children, with the parent's state changing">
        <div className="col">
          <PlainChild label="plain child" />
          <MemoChild label="memo, string prop" />
          {/* ❌ A fresh object literal every render. memo's shallow compare
              sees a different reference and re-renders anyway. */}
          <MemoWithObjectProp config={{ label: 'memo, object prop ❌' }} />
        </div>
        <Callout kind="trap">
          The third one is memoised and still re-renders every time, because{' '}
          <code>{'{ label: "…" }'}</code> is a new object on every render of the
          parent. <code>memo</code> compares with <code>Object.is</code>; two
          identical-looking objects are never equal.
        </Callout>
      </Panel>

      <Panel title="The four reasons, as a checklist">
        <table className="data">
          <thead>
            <tr>
              <th>Reason</th>
              <th>Can React.memo stop it?</th>
              <th>What actually fixes it</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Its own state changed</td>
              <td className="mono">no</td>
              <td>Nothing — this is the render you asked for. Move the state down so fewer things sit below it.</td>
            </tr>
            <tr>
              <td>Its parent re-rendered</td>
              <td className="mono">yes</td>
              <td>
                <code>memo</code> + stable props, or pass the child as{' '}
                <code>children</code> so its element is created higher up.
              </td>
            </tr>
            <tr>
              <td>A context it consumes changed</td>
              <td className="mono">no</td>
              <td>Split the context, memoise the provider value, or use a store with selectors.</td>
            </tr>
            <tr>
              <td>A hook signalled an update</td>
              <td className="mono">no</td>
              <td>Narrow the subscription — a selector that returns a primitive, or a smaller slice.</td>
            </tr>
          </tbody>
        </table>
      </Panel>

      <Callout kind="tip">
        <b>The order to try things in.</b> 1. Move state down so it sits closer
        to what actually uses it. 2. Pass expensive subtrees as{' '}
        <code>children</code>. 3. Split contexts. 4. Only then reach for{' '}
        <code>memo</code>/<code>useMemo</code>/<code>useCallback</code>. The
        first two cost nothing at runtime; the last one is code you have to keep
        correct forever.
      </Callout>
    </div>
  )
}
