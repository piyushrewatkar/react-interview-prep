import { memo, useCallback, useMemo, useState } from 'react'
import type { TopicMeta } from '../../types'
import { Callout, Panel, RenderBadge } from '../../lib/ui'

export const meta = {
  title: 'React.memo and why it silently fails',
  summary:
    'memo does a shallow prop comparison. Almost every "memo is not working" bug is a new object, array or function identity being passed in.',
  notes: [
    '<b><code>memo(Component)</code> adds a shallow props check</b> before rendering. Equal props ⇒ React reuses the previous output and skips the subtree.',
    '<b>Shallow means <code>Object.is</code> per prop.</b> <code>{}</code> !== <code>{}</code>, <code>[]</code> !== <code>[]</code>, and every inline arrow is a brand-new function.',
    '<b>So memo needs stable props to work.</b> Objects and arrays need <code>useMemo</code>; functions need <code>useCallback</code>. Miss one and the memo does nothing but add overhead.',
    '<b>memo cannot stop a re-render caused by context or by the component&rsquo;s own state.</b> It only guards the props path.',
    '<b><code>children</code> is a prop too</b> — and JSX creates a new element object every render, so <code>&lt;Memoised&gt;&lt;Child /&gt;&lt;/Memoised&gt;</code> defeats the memo unless the children element itself is stable.',
    '<b>The second argument is a custom comparator</b> <code>(prev, next) =&gt; boolean</code>. It returns <code>true</code> to <i>skip</i> the render — the opposite polarity to <code>shouldComponentUpdate</code>. Use it rarely; a deep comparison can cost more than the render.',
    '<b>Do not wrap everything in memo.</b> Each one costs a comparison on every render plus the memory to retain the previous props and output, and it makes every prop’s identity a thing you must now maintain.',
    '<b>Good candidates:</b> list rows, a component rendering a big subtree, anything expensive sitting under a frequently re-rendering parent.',
  ],
  questions: [
    {
      q: 'What does React.memo do?',
      a: 'It wraps a component in a shallow props comparison. Before rendering, React compares each prop of the new element with the corresponding prop from the previous render using <code>Object.is</code>. If every one matches, it skips the render entirely and reuses the previous output — including the whole subtree beneath it.\n\nIt is the function-component equivalent of <code>PureComponent</code>, and, like <code>PureComponent</code>, it only guards against re-renders caused by the parent. State changes inside the component and context updates both go straight past it.',
    },
    {
      q: 'I wrapped my component in memo and it still re-renders. Why?',
      a: 'In order of likelihood:\n\n<b>You are passing a new object, array or function every render.</b> <code>style={{ margin: 8 }}</code>, <code>items={data.filter(...)}</code>, <code>onClick={() =&gt; …}</code> — all fresh references, all fail the shallow check. This is the answer nine times out of ten.\n\n<b>It consumes a context that changed.</b> Memo cannot block that.\n\n<b>Its own state or a hook updated.</b> Also not memo\'s business.\n\n<b>You are passing <code>children</code>.</b> JSX children are new element objects every render, so the check fails unless the element itself is stable.\n\nThe diagnostic is the React DevTools profiler with "record why each component rendered" enabled — it names the prop that differed.',
    },
    {
      q: 'When is memo worth it, and when is it harmful?',
      a: 'Worth it when the render you are skipping is genuinely expensive and the props are genuinely stable: rows in a long list, a chart, a large subtree under a parent that re-renders on every keystroke.\n\nHarmful — or at least net negative — when the component is cheap. You have added a props comparison on every render plus the memory to retain previous props and output, to avoid a render that took 0.02ms. And you have created an ongoing obligation: every future prop passed to this component now has to have a stable identity, or the memo silently stops working and nobody notices.\n\nThe honest position: memo is a targeted fix for a measured problem, not a default. If you find yourself adding it "just in case", that is the signal to profile instead.',
    },
    {
      q: 'How does the second argument to memo differ from shouldComponentUpdate?',
      a: 'The polarity is inverted, which is a genuine footgun when migrating.\n\n<code>shouldComponentUpdate(nextProps)</code> returns <code>true</code> to <b>re-render</b>. <code>memo(C, areEqual)</code>\'s comparator returns <code>true</code> to <b>skip</b> the render — it is asking "are these equal?", not "should I update?".\n\nGetting it backwards produces a component that either never updates or never memoises, and both fail quietly.\n\nBeyond that they are equivalent in purpose. And the same caution applies to both: a custom comparator that deep-compares a large object can easily cost more than the render it is avoiding.',
    },
    {
      q: 'Does memo help if the component’s children change?',
      a: 'Not on its own. <code>children</code> is an ordinary prop, and JSX produces a new element object on every render of the parent — so <code>&lt;Memoised&gt;&lt;Row /&gt;&lt;/Memoised&gt;</code> fails the shallow check every time.\n\nThe way around it is to make the children element itself stable. If the children are created by a component <i>above</i> the one that re-renders, the element object is not recreated — which is the "pass children as a prop" trick covered in the next topic, and it works without any memo at all.\n\nOtherwise you can memoise the children with <code>useMemo</code>, though at that point it is usually worth asking whether the component boundary is in the right place.',
    },
  ],
} satisfies TopicMeta

type Row = { id: number; label: string }
const ROWS: Row[] = Array.from({ length: 4 }, (_, i) => ({ id: i, label: `Row ${i}` }))

/* A memoised row. Whether it actually skips renders depends entirely on what
   the parent passes it. */
const MemoRow = memo(function MemoRow({
  row,
  onSelect,
  style,
}: {
  row: Row
  onSelect: (id: number) => void
  style?: React.CSSProperties
}) {
  return (
    <div className="row" style={style}>
      <button onClick={() => onSelect(row.id)}>{row.label}</button>
      <RenderBadge label="renders" />
    </div>
  )
})

/* --- ❌ Every prop is a fresh reference every render ----------------------- */
function BrokenList({ tick }: { tick: number }) {
  const [selected, setSelected] = useState<number | null>(null)

  return (
    <div className="col">
      <div className="muted" style={{ fontSize: 13 }}>
        parent render #{tick} · selected: {selected ?? '—'}
      </div>
      {ROWS.map((row) => (
        <MemoRow
          key={row.id}
          row={row}
          // ❌ new function identity on every render
          onSelect={(id) => setSelected(id)}
          // ❌ new object identity on every render
          style={{ opacity: selected === row.id ? 1 : 0.7 }}
        />
      ))}
    </div>
  )
}

/* --- ✅ Stable references, so the memo actually bites ---------------------- */
function WorkingList({ tick }: { tick: number }) {
  const [selected, setSelected] = useState<number | null>(null)

  // ✅ Stable for the component's lifetime. The updater form means it never
  //    needs to read `selected`, so the dep array can genuinely be empty.
  const onSelect = useCallback((id: number) => setSelected(id), [])

  // ✅ Two stable objects instead of one new one per row per render.
  const styles = useMemo(
    () => ({ on: { opacity: 1 }, off: { opacity: 0.7 } }) as const,
    [],
  )

  return (
    <div className="col">
      <div className="muted" style={{ fontSize: 13 }}>
        parent render #{tick} · selected: {selected ?? '—'}
      </div>
      {ROWS.map((row) => (
        <MemoRow
          key={row.id}
          row={row}
          onSelect={onSelect}
          style={selected === row.id ? styles.on : styles.off}
        />
      ))}
    </div>
  )
}

export default function Demo() {
  const [tick, setTick] = useState(0)

  return (
    <div className="stack">
      <div className="row">
        <button className="primary" onClick={() => setTick((t) => t + 1)}>
          force a parent re-render ({tick})
        </button>
        <span className="muted" style={{ fontSize: 13 }}>
          Both columns use the identical <code>MemoRow</code>.
        </span>
      </div>

      <div className="grid2">
        <Panel title="❌ memo defeated by unstable props">
          <BrokenList tick={tick} />
          <div style={{ fontSize: 13, color: 'var(--bad)', marginTop: 10 }}>
            Every row re-renders. The <code>memo</code> is pure overhead here —
            a comparison that can never succeed.
          </div>
        </Panel>

        <Panel title="✅ memo with stable props">
          <WorkingList tick={tick} />
          <div style={{ fontSize: 13, color: 'var(--good)', marginTop: 10 }}>
            Rows render once and then stay put. Only the selected row re-renders
            when the selection changes, because only its <code>style</code>{' '}
            reference changed.
          </div>
        </Panel>
      </div>

      <Panel title="The comparator, and its inverted polarity">
        <pre>
          <code>{`// React.memo — returns true to SKIP the render
const Row = memo(RowImpl, (prev, next) => prev.row.id === next.row.id)
//                          ^ "are these equal?"  → true means DON'T render

// shouldComponentUpdate — returns true to DO the render
shouldComponentUpdate(nextProps) {
  return this.props.row.id !== nextProps.row.id
  //     ^ "should I update?"  → true means DO render
}`}</code>
        </pre>
        <Callout kind="trap">
          Migrating a <code>shouldComponentUpdate</code> to a memo comparator
          without flipping the boolean gives you a component that never updates.
          It fails silently, which is the worst kind.
        </Callout>
      </Panel>
    </div>
  )
}
