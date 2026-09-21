import { useState } from 'react'
import type { TopicMeta } from '../../types'
import { Callout, Panel, useLog, Log } from '../../lib/ui'

export const meta = {
  title: 'Reconciliation & the diffing algorithm',
  summary:
    'How React decides whether to update an existing component instance or throw it away and build a new one — and why that decision destroys your state.',
  notes: [
    '<b>The general problem is O(n³).</b> Comparing two arbitrary trees and finding the minimal edit script is prohibitively expensive, so React uses a heuristic O(n) algorithm built on two assumptions.',
    '<b>Assumption 1: different types produce different trees.</b> If the element type at a position changes (<code>&lt;div&gt;</code> → <code>&lt;span&gt;</code>, or <code>&lt;Profile&gt;</code> → <code>&lt;Settings&gt;</code>), React does not try to diff them. It unmounts the entire old subtree — running cleanups, discarding all state — and mounts the new one from scratch.',
    '<b>Assumption 2: keys tell React which children are the same across renders.</b> Within a list, a stable key lets React match up items that moved instead of rebuilding them.',
    '<b>Identity is position + type + key, never props.</b> React walks the tree position by position. Same position, same type, same key ⇒ same instance, so hooks state and the DOM node survive and only changed props/attributes are patched.',
    '<b>Defining a component inside another component is a bug factory.</b> Every render creates a brand-new function, so the <code>type</code> is a different reference each time, so React unmounts and remounts the subtree — state lost, inputs blurred, effects re-run. Hoist it out, always.',
    '<b>Two elements in the same position but different branches of a ternary are still "the same position"</b> as far as React is concerned. <code>{isOn ? &lt;Input a /&gt; : &lt;Input b /&gt;}</code> reuses one instance. Give them different keys if you want them treated as distinct.',
  ],
  questions: [
    {
      q: 'Explain React’s reconciliation algorithm.',
      a: 'When state changes, React renders a new element tree and compares it with the previous one to work out the smallest set of DOM operations. A general tree-diff is O(n³), which is unusable, so React applies two heuristics to get it down to O(n).\n\nFirst, it compares element types at the same position. Same type ⇒ keep the existing instance and DOM node, patch the changed attributes, recurse into children. Different type ⇒ tear down the whole subtree and build a fresh one, with no attempt to reuse anything inside it.\n\nSecond, for lists it uses <code>key</code> to match children across renders rather than relying on index order, so reordering moves instances instead of recreating them.\n\nThe assumptions are not always optimal — React can miss a reuse a smarter algorithm would find — but they hold for the overwhelming majority of real UIs and they are cheap to evaluate.',
    },
    {
      q: 'I moved a component from a div into a section wrapper and all my form state vanished. Why?',
      a: 'Because changing the element type at a position makes React treat it as a different thing entirely. It unmounts the old subtree — running every effect cleanup, dropping every hook\'s state, destroying the DOM nodes — and mounts a fresh subtree underneath the new wrapper.\n\nState lives on the component instance, and React only preserves an instance when the position, type and key all match. It has no concept of "this is the same component, it just moved".\n\nIf you genuinely need the state to survive a structural change, the state has to live above the point where the structure changes — lift it into a parent, a context, or a store.',
    },
    {
      q: 'Why is defining a component inside another component a problem?',
      a: 'Because the inner function is recreated on every render of the outer component, so its identity — the value React compares as the element\'s <code>type</code> — is a new reference each time. React sees <code>type</code> changed, concludes it is a different component, and unmounts/remounts the entire subtree on every single render of the parent.\n\nSymptoms are distinctive: text inputs lose focus mid-typing, animations restart, state resets constantly, and effects with an empty dependency array fire over and over. The fix is to hoist the component to module scope and pass what it needs as props. If it needs to close over parent state, that is exactly what props are for.',
    },
    {
      q: 'How does React decide whether two elements are "the same"?',
      a: 'Three things, checked in order: the position in the tree, the element <code>type</code>, and the <code>key</code>. Props are not part of the identity check — props are what gets patched <i>after</i> React has decided the element is the same.\n\nThat is why <code>{cond ? &lt;Input placeholder="a" /&gt; : &lt;Input placeholder="b" /&gt;}</code> keeps whatever you typed when <code>cond</code> flips: same position, same type, no keys, so React reuses the instance and just swaps the placeholder attribute. Adding <code>key="a"</code> / <code>key="b"</code> tells React they are different things and forces a remount.',
    },
    {
      q: 'What is the difference between the Stack reconciler and the Fiber reconciler?',
      a: 'The old Stack reconciler recursed through the tree synchronously. Once a render started it ran to completion, so a large update blocked the main thread and dropped frames, and there was no way to abandon work that had become obsolete.\n\nFiber, shipped in React 16, re-implemented the tree walk as a linked list of "fiber" nodes that React traverses with an explicit loop rather than the call stack. Because the position is data rather than stack frames, React can pause after any unit of work, yield to the browser, and resume or discard later. That is the machinery underneath time-slicing, <code>useTransition</code>, Suspense and concurrent rendering — none of which are expressible on a synchronous recursive reconciler.',
    },
  ],
} satisfies TopicMeta

// ---------------------------------------------------------------------------
// A leaf with its own state, so we can SEE whether React preserved the instance
// or built a new one. If the counter resets, the instance was destroyed.
// ---------------------------------------------------------------------------
function Counter({ label }: { label: string }) {
  const [n, setN] = useState(0)
  return (
    <div className="row">
      <span className="mono" style={{ minWidth: 92 }}>
        {label}
      </span>
      <button onClick={() => setN((v) => v + 1)}>clicked {n}×</button>
    </div>
  )
}

export default function Demo() {
  const [wrapInSection, setWrapInSection] = useState(false)
  const [swapped, setSwapped] = useState(false)
  const { lines, push, clear } = useLog()

  // The same <Counter/> element, rendered under two different wrapper types.
  // Flip the toggle and watch its count reset: the TYPE at that position
  // changed, so React tore down everything below it.
  const counter = <Counter label="state:" />

  return (
    <div className="stack">
      <Panel title="1. Changing the wrapper type destroys the subtree">
        <p className="muted" style={{ marginTop: 0, fontSize: 13.5 }}>
          Click the counter a few times, then toggle the wrapper. Same element,
          same props, same place in your source — but a different parent
          <em> type</em>, which React treats as a different tree.
        </p>
        <div className="row" style={{ marginBottom: 12 }}>
          <button onClick={() => setWrapInSection((v) => !v)}>
            wrapper: {wrapInSection ? '<section>' : '<div>'} — click to swap
          </button>
        </div>
        {wrapInSection ? <section>{counter}</section> : <div>{counter}</div>}
        <Callout kind="trap">
          <b>The counter reset.</b> React did not "move" the component. It
          unmounted it (running cleanups, dropping hook state) and mounted a
          brand-new instance under the new wrapper.
        </Callout>
      </Panel>

      <Panel title="2. Same position + same type = same instance, even across a ternary">
        <p className="muted" style={{ marginTop: 0, fontSize: 13.5 }}>
          These two branches render different labels, but both are a{' '}
          <code>&lt;Counter&gt;</code> in the same position with no key. Type your
          count up, then swap — the count survives, because as far as
          reconciliation is concerned nothing changed except one prop.
        </p>
        <div className="row" style={{ marginBottom: 12 }}>
          <button onClick={() => setSwapped((v) => !v)}>
            branch: {swapped ? 'B' : 'A'} — click to swap
          </button>
        </div>
        {swapped ? <Counter label="branch B" /> : <Counter label="branch A" />}
        <Callout kind="tip">
          <b>The count survived.</b> If you wanted these treated as two separate
          things, you would give them different keys —{' '}
          <code>key="a"</code> / <code>key="b"</code> — which forces a remount.
        </Callout>
      </Panel>

      <Panel title="3. What the diff actually decides">
        <table className="data">
          <thead>
            <tr>
              <th>Previous</th>
              <th>Next</th>
              <th>React does</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="mono">&lt;div className="a"&gt;</td>
              <td className="mono">&lt;div className="b"&gt;</td>
              <td>Keeps the DOM node, sets one attribute, recurses into children.</td>
            </tr>
            <tr>
              <td className="mono">&lt;div&gt;</td>
              <td className="mono">&lt;span&gt;</td>
              <td>Destroys the node and everything under it. Builds fresh.</td>
            </tr>
            <tr>
              <td className="mono">&lt;Profile user={'{a}'} /&gt;</td>
              <td className="mono">&lt;Profile user={'{b}'} /&gt;</td>
              <td>Same instance. Re-runs the function with new props. State kept.</td>
            </tr>
            <tr>
              <td className="mono">&lt;Profile /&gt;</td>
              <td className="mono">&lt;Settings /&gt;</td>
              <td>Unmount + mount. Cleanups run, all state lost.</td>
            </tr>
            <tr>
              <td className="mono">&lt;Row key="7" /&gt; at index 0</td>
              <td className="mono">&lt;Row key="7" /&gt; at index 3</td>
              <td>Moves the existing instance. State follows the key.</td>
            </tr>
          </tbody>
        </table>
      </Panel>

      <Panel title="4. Prove it to yourself">
        <p className="muted" style={{ marginTop: 0, fontSize: 13.5 }}>
          <code>Counter</code> could log from an effect cleanup to show the
          unmount. Toggle the wrapper above with the console open and you will
          see mount/unmount pairs rather than a quiet re-render.
        </p>
        <div className="row">
          <button onClick={() => push(`wrapper is now ${wrapInSection ? '<section>' : '<div>'}`)}>
            Log current wrapper
          </button>
          <button onClick={clear}>Clear</button>
        </div>
        <div style={{ marginTop: 10 }}>
          <Log lines={lines} />
        </div>
      </Panel>
    </div>
  )
}
