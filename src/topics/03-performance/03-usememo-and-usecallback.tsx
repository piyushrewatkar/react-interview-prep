import { memo, useCallback, useMemo, useState } from 'react'
import type { TopicMeta } from '../../types'
import { Callout, Panel, RenderBadge, burnCpu } from '../../lib/ui'

export const meta = {
  title: 'useMemo & useCallback: when they earn their keep',
  summary:
    'Two reasons to memoise — expensive computation and reference identity — and the much longer list of times you are just adding noise.',
  notes: [
    '<b><code>useMemo(fn, deps)</code> caches a value. <code>useCallback(fn, deps)</code> caches a function.</b> <code>useCallback(fn, d)</code> is exactly <code>useMemo(() =&gt; fn, d)</code>.',
    '<b>Reason 1 to use them — the computation is expensive.</b> Sorting 10,000 rows, parsing, a layout calculation. Measure before you assume.',
    '<b>Reason 2 — the reference identity matters.</b> The result feeds a <code>React.memo</code> child, a <code>useEffect</code> dependency array, or another memo. This is usually the real reason.',
    '<b>Neither is free.</b> You pay a dependency-array comparison on every render, plus the memory to retain the cached value, plus the ongoing cost of keeping the deps correct.',
    '<b>Memoising a cheap value is a net loss.</b> <code>useMemo(() =&gt; a + b, [a, b])</code> costs more than <code>a + b</code>.',
    '<b>A <code>useCallback</code> passed to a non-memoised child does nothing.</b> The child re-renders regardless, so you have added a hook for zero benefit — this is the most common redundant memoisation in real code.',
    '<b>Both are caches, not guarantees.</b> React may discard memoised values (to free memory, or for future features), so your code must be correct without them.',
    '<b>The React Compiler changes the calculus.</b> It memoises automatically at build time, and when you adopt it most manual <code>useMemo</code>/<code>useCallback</code> should be deleted.',
  ],
  questions: [
    {
      q: 'What is the difference between useMemo and useCallback?',
      a: '<code>useMemo</code> caches the <i>result</i> of calling a function; <code>useCallback</code> caches the <i>function itself</i>. They are the same mechanism — <code>useCallback(fn, deps)</code> is literally <code>useMemo(() =&gt; fn, deps)</code>, and React implements it that way.\n\n<code>useCallback</code> exists purely as sugar, because wrapping a function you want to pass down in <code>useMemo(() =&gt; () =&gt; …)</code> is awkward to read. The use case is different in practice though: <code>useMemo</code> is usually about avoiding expensive work, <code>useCallback</code> is almost always about keeping a reference stable for a memoised child or a dependency array.',
    },
    {
      q: 'When is useMemo actually worth using?',
      a: 'Two situations, and it is worth naming both because people only remember the first.\n\n<b>The computation is genuinely expensive.</b> Sorting or filtering thousands of items, parsing a large payload, building a lookup map. The threshold is lower than you think on a mid-range phone but higher than people assume on a laptop — measure it with <code>performance.now()</code> before deciding.\n\n<b>The reference identity matters.</b> The value is passed to a <code>React.memo</code> child, or used in a <code>useEffect</code> dependency array, or feeds another memo. Here the computation might be trivial — <code>useMemo(() =&gt; ({ a, b }), [a, b])</code> — and you are memoising entirely so that <code>Object.is</code> succeeds downstream. This is the more common reason in real codebases.\n\nOutside those two, it is noise: a hook, a dependency array to maintain, and a comparison cost, for nothing.',
    },
    {
      q: 'Does useCallback prevent re-renders?',
      a: 'By itself, no — and this is a very common misconception. <code>useCallback</code> only stabilises a function\'s identity. If the child receiving it is not wrapped in <code>React.memo</code>, it re-renders whenever the parent does, stable callback or not.\n\nSo <code>useCallback</code> is one half of a two-part mechanism. It is useful when (a) the consumer is memoised, or (b) the function is in a dependency array of an effect or another hook, where a changing identity would cause the effect to re-run.\n\nIf neither is true, you have added a hook that does nothing but cost a dependency comparison. That pattern is everywhere in real code, usually from a well-meaning "let\'s memoise all the handlers" pass.',
    },
    {
      q: 'Can you rely on useMemo caching a value?',
      a: 'No. The React docs are explicit that <code>useMemo</code> is a performance hint, not a semantic guarantee — React may throw the cached value away and recompute. It already does so in some situations (for example, for offscreen content), and reserves the right to do more of it.\n\nThe practical rule: your code must be correct if every <code>useMemo</code> recomputed on every render. So never put a side effect inside one, never use it to guarantee that something runs only once, and never rely on the identity for correctness — only for performance. If you need "exactly once", that is a ref or an effect.',
    },
    {
      q: 'Should you still write these by hand with the React Compiler?',
      a: 'Increasingly not. The React Compiler analyses your components at build time and inserts memoisation automatically — including for values and callbacks you would never have bothered to wrap by hand, and without the risk of a wrong dependency array.\n\nOnce a codebase is on the compiler, the recommendation is to remove manual <code>useMemo</code>/<code>useCallback</code>, because they add noise and can occasionally get in the compiler\'s way.\n\nFor an interview I would frame it as: manual memoisation is a workaround for the fact that React could not previously know which values were stable. The compiler removes that limitation, and that is the direction the ecosystem is moving — but plenty of production code is not there yet, so knowing when each is justified still matters.',
    },
  ],
} satisfies TopicMeta

const NUMBERS = Array.from({ length: 200 }, (_, i) => i)

/* A memoised child. Its ability to skip renders depends on getting a stable
   callback — which is the whole reason useCallback exists. */
const MemoButton = memo(function MemoButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="row">
      <button onClick={onClick}>memoised child</button>
      <RenderBadge label="renders" />
    </div>
  )
})

/* A plain child. Note that useCallback does NOTHING for this one. */
function PlainButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="row">
      <button onClick={onClick}>plain child</button>
      <RenderBadge label="renders" />
    </div>
  )
}

export default function Demo() {
  const [tick, setTick] = useState(0)
  const [multiplier, setMultiplier] = useState(2)
  const [clicks, setClicks] = useState(0)

  // ---------------------------------------------------------------------------
  // REASON 1: expensive computation.
  // Without the memo, this 80ms burn runs on every render — including renders
  // caused by the unrelated `tick` button.
  // ---------------------------------------------------------------------------
  const expensive = useMemo(() => {
    burnCpu(80)
    return NUMBERS.reduce((sum, n) => sum + n * multiplier, 0)
  }, [multiplier])

  // For comparison: the same work, unmemoised. Comment this in to feel the
  // difference — every `tick` click will hitch.
  // const alsoExpensive = (() => { burnCpu(80); return 1 })()

  // ---------------------------------------------------------------------------
  // REASON 2: reference identity, for a memoised consumer.
  // ---------------------------------------------------------------------------
  const stableClick = useCallback(() => setClicks((c) => c + 1), [])

  // Deliberately unstable, for contrast.
  const unstableClick = () => setClicks((c) => c + 1)

  // ---------------------------------------------------------------------------
  // NOT WORTH IT: memoising something cheaper than the comparison.
  // ---------------------------------------------------------------------------
  const pointless = useMemo(() => multiplier * 2, [multiplier]) // just write multiplier * 2

  return (
    <div className="stack">
      <div className="row">
        <button className="primary" onClick={() => setTick((t) => t + 1)}>
          unrelated re-render ({tick})
        </button>
        <button onClick={() => setMultiplier((m) => m + 1)}>
          change the memo&rsquo;s input ({multiplier})
        </button>
        <RenderBadge label="parent" />
      </div>

      <Panel title="1. Expensive computation">
        <div className="row">
          <span className="badge">result: {expensive.toLocaleString()}</span>
          <span className="badge good">80ms burn, skipped on unrelated renders</span>
        </div>
        <Callout>
          Click &ldquo;unrelated re-render&rdquo; repeatedly — instant, because
          the memo holds. Click &ldquo;change the memo&rsquo;s input&rdquo; and
          you feel the 80ms. That gap is the entire value of{' '}
          <code>useMemo</code> here.
        </Callout>
      </Panel>

      <Panel title="2. Reference identity — and where it does nothing">
        <div className="col">
          <div className="grid2">
            <div className="panel">
              <div className="panel-title" style={{ color: 'var(--good)' }}>
                useCallback → memo child
              </div>
              <MemoButton onClick={stableClick} />
              <div style={{ fontSize: 13, color: 'var(--good)', marginTop: 6 }}>
                Skips re-renders. Both halves present.
              </div>
            </div>
            <div className="panel">
              <div className="panel-title" style={{ color: 'var(--bad)' }}>
                inline arrow → memo child
              </div>
              <MemoButton onClick={unstableClick} />
              <div style={{ fontSize: 13, color: 'var(--bad)', marginTop: 6 }}>
                Re-renders every time. The memo is defeated.
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-title" style={{ color: 'var(--warn)' }}>
              useCallback → NON-memo child (pure waste)
            </div>
            <PlainButton onClick={stableClick} />
            <div style={{ fontSize: 13, color: 'var(--warn)', marginTop: 6 }}>
              Re-renders every time regardless. The <code>useCallback</code>{' '}
              buys nothing — this is the most common redundant memoisation in
              real codebases.
            </div>
          </div>

          <span className="badge">clicks: {clicks}</span>
        </div>
      </Panel>

      <Panel title="3. Memoisation that is a net loss">
        <pre>
          <code>{`// ❌ The dependency comparison costs more than the multiply.
const doubled = useMemo(() => multiplier * 2, [multiplier])

// ❌ A hook, a dep array, and a cache — to avoid one string concat.
const label = useMemo(() => first + ' ' + last, [first, last])

// ❌ Stable callback handed to a component that is not memoised.
const onClick = useCallback(() => setOpen(true), [])
return <PlainDialog onOpen={onClick} />

// ✅ Just write it.
const doubled = multiplier * 2
const label = first + ' ' + last`}</code>
        </pre>
        <div className="muted" style={{ fontSize: 13 }}>
          (The <code>pointless</code> variable in this file&rsquo;s source is
          exactly that first case — {pointless} — left in deliberately.)
        </div>
      </Panel>

      <Panel title="The decision rule">
        <pre>
          <code>{`Does the value feed a React.memo child, a useEffect dep array,
or another hook's dep array?
   └─ yes → memoise it. Identity is the point.

Is the computation measurably expensive? (profile it — actually measure)
   └─ yes → memoise it.

Otherwise
   └─ don't. Write the expression inline.

Using the React Compiler?
   └─ delete the manual memos; it does this better than you can.`}</code>
        </pre>
      </Panel>
    </div>
  )
}
