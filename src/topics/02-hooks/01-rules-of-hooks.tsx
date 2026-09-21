import { useEffect, useState } from 'react'
import type { TopicMeta } from '../../types'
import { Callout, Panel } from '../../lib/ui'

export const meta = {
  title: 'The rules of hooks (and why they exist)',
  summary:
    'Hooks are matched to their state by call order, not by name. Every rule follows from that one implementation detail.',
  notes: [
    '<b>Rule 1: only call hooks at the top level.</b> Never inside a condition, a loop, a nested function, or after an early <code>return</code>.',
    '<b>Rule 2: only call hooks from React function components or from other hooks.</b> Not from plain functions, not from class methods, not from event handlers.',
    '<b>Why:</b> React stores hook state as an ordered list on the fiber. On each render it walks your hook calls in sequence and hands back slot 1, slot 2, slot 3. There is no name to match on — only position.',
    '<b>What breaks:</b> skip a hook on render 2 and every subsequent hook shifts down a slot. Your <code>useEffect</code> now reads the state that belonged to a <code>useState</code>, and React throws “Rendered fewer hooks than expected.”',
    '<b>The fix is always the same shape:</b> move the condition <i>inside</i> the hook, not around it. <code>useEffect(() =&gt; { if (!enabled) return; … }, [enabled])</code>.',
    '<b>Early returns are the sneaky version of the same bug.</b> <code>if (!user) return null</code> above a hook call is a conditional hook.',
    '<b>Custom hooks must start with <code>use</code></b> — that prefix is how the linter knows a function is allowed to call hooks and must itself obey the rules.',
    '<b>Different numbers of hooks in different branches of a component are fine</b> as long as they are in <i>different components</i>. Split the component in two rather than branching around hooks.',
  ],
  questions: [
    {
      q: 'What are the rules of hooks and why do they exist?',
      a: 'Two rules: call hooks only at the top level of a component or another hook, and call them only from React functions.\n\nThe reason is the implementation. React has no way to associate a hook call with a name — <code>useState</code> does not know you assigned it to <code>count</code>. It keeps a linked list of hook records on the component\'s fiber and advances a cursor by one on each hook call. Slot order <i>is</i> the identity.\n\nSo if render 1 calls five hooks and render 2 calls four because one was behind an <code>if</code>, every hook after the skipped one is now reading the wrong slot: your effect gets the previous <code>useState</code>\'s memory cell. React detects the count mismatch and throws, which is a mercy — silently reading the wrong state would be far worse.',
    },
    {
      q: 'How would you conditionally run an effect?',
      a: 'Put the condition inside the effect, not around it:\n\n<code>useEffect(() =&gt; { if (!isOpen) return; const id = setInterval(tick, 1000); return () =&gt; clearInterval(id) }, [isOpen])</code>\n\nThe hook is always called — the cursor always advances — but the body no-ops when the condition is false. Because <code>isOpen</code> is in the dependency array, flipping it re-runs the effect, which runs the cleanup from the previous run first. So turning the feature off tears down cleanly.\n\nThe same shape works for <code>useMemo</code> (<code>useMemo(() =&gt; cond ? expensive() : null, [cond])</code>) and for conditional data fetching, where libraries expose it as an <code>enabled</code> option for exactly this reason.',
    },
    {
      q: 'Why must custom hooks start with "use"?',
      a: 'It is a convention that the tooling depends on. <code>eslint-plugin-react-hooks</code> uses the prefix to decide two things: that this function is allowed to call other hooks, and that its own calls must obey the rules of hooks. Without the prefix, a function that calls <code>useState</code> looks like an ordinary function calling a hook illegally, and the lint rule flags it.\n\nIt also serves the reader. Seeing <code>useThing()</code> at a call site tells you immediately that this line is stateful, participates in the render cycle, and cannot be moved into a condition or a callback. <code>getThing()</code> implies none of that.',
    },
    {
      q: 'Can you call a hook inside an event handler?',
      a: 'No. Handlers run outside the render phase, when React is not rendering any component, so there is no fiber and no hook cursor for the call to attach to. React throws "Invalid hook call".\n\nThe usual thing people are reaching for is "I want to fetch/read state only when the user clicks". The answer is to call the hook at the top level and use what it returns inside the handler — call <code>useNavigate()</code> during render and invoke <code>navigate()</code> in the handler, or call <code>useDispatch()</code> during render and <code>dispatch()</code> in the handler. Every hook-based library is designed around that split.',
    },
    {
      q: 'Is it ever legitimate for a component to call a different number of hooks?',
      a: 'Not within the same component instance across renders — that is the rule. But it is completely fine for two <i>different</i> components to call different hooks, and that is usually the right refactor.\n\nIf you find yourself wanting <code>if (isAdmin) { useAdminData() }</code>, the shape you want is a parent that renders <code>{isAdmin ? &lt;AdminPanel /&gt; : &lt;UserPanel /&gt;}</code>, with the hook inside <code>AdminPanel</code>. Each component has a consistent hook order; the branching happens at the component boundary where React handles mounting and unmounting properly.',
    },
  ],
} satisfies TopicMeta

/**
 * A hand-rolled sketch of how React stores hooks. Not the real implementation,
 * but the mental model that makes every rule obvious.
 *
 *   fiber.memoizedState -> [ {state: 0}, {deps: [...]}, {state: ''} ]
 *                            ^cursor 0     ^cursor 1      ^cursor 2
 *
 * Every hook call does `slots[cursor++]`. Nothing else.
 */
const PSEUDO = `// Roughly what React does per component instance:
let slots = []      // persists across renders
let cursor = 0      // reset to 0 at the start of each render

function useState(initial) {
  const i = cursor++                       // <-- position IS the identity
  if (slots[i] === undefined) {
    slots[i] = initial                     // first render: allocate
  }
  const setState = (v) => {
    slots[i] = typeof v === 'function' ? v(slots[i]) : v
    scheduleRerender()
  }
  return [slots[i], setState]
}

function renderComponent(Component) {
  cursor = 0                               // <-- rewind before every render
  return Component()
}`

export default function Demo() {
  const [showExtra, setShowExtra] = useState(false)
  const [a, setA] = useState('slot 0')
  const [b] = useState('slot 1')

  // This effect is ALWAYS called — the hook itself is unconditional. The
  // condition lives inside the body, which is the correct pattern.
  useEffect(() => {
    if (!showExtra) return
    // pretend this subscribes to something
    return () => {
      // …and this tears it down when showExtra flips back to false
    }
  }, [showExtra])

  return (
    <div className="stack">
      <Panel title="Why order matters — React's bookkeeping, roughly">
        <pre>
          <code>{PSEUDO}</code>
        </pre>
        <Callout kind="tip">
          <code>cursor++</code> is the entire explanation. There is no name, no
          key, no registry — just a counter that has to line up on every render.
        </Callout>
      </Panel>

      <div className="grid2">
        <Panel title="❌ Breaks">
          <pre>
            <code>{`function Profile({ user }) {
  // Early return = conditional hooks
  if (!user) return null        // 👈

  const [name, setName] = useState(user.name)
  useEffect(() => { … }, [])
}

function Widget({ enabled }) {
  const [a] = useState(1)

  if (enabled) {
    // slot 1 on some renders,
    // nonexistent on others 💥
    const [b] = useState(2)     // 👈
  }

  useEffect(() => { … })        // now slot 1 OR slot 2
}`}</code>
          </pre>
          <div style={{ fontSize: 13, color: 'var(--bad)', marginTop: 8 }}>
            “Rendered fewer hooks than expected. This may be caused by an
            accidental early return statement.”
          </div>
        </Panel>

        <Panel title="✅ Works">
          <pre>
            <code>{`function Profile({ user }) {
  // Hooks first, unconditionally.
  const [name, setName] = useState(user?.name ?? '')
  useEffect(() => { … }, [])

  // Early return AFTER every hook.
  if (!user) return null
}

function Widget({ enabled }) {
  const [a] = useState(1)
  const [b] = useState(2)       // always called

  useEffect(() => {
    if (!enabled) return        // 👈 condition
    …                           //    moves inside
    return () => cleanup()
  }, [enabled])
}`}</code>
          </pre>
          <div style={{ fontSize: 13, color: 'var(--good)', marginTop: 8 }}>
            Hook count is constant. The behaviour varies, not the call order.
          </div>
        </Panel>
      </div>

      <Panel title="Live: a conditional effect, done correctly">
        <div className="row">
          <button className="primary" onClick={() => setShowExtra((v) => !v)}>
            subscription: {showExtra ? 'ON' : 'OFF'}
          </button>
          <span className="badge">{a}</span>
          <span className="badge">{b}</span>
          <button onClick={() => setA((s) => (s === 'slot 0' ? 'slot 0 (updated)' : 'slot 0'))}>
            touch slot 0
          </button>
        </div>
        <Callout>
          The <code>useEffect</code> above runs on every render regardless.
          Toggling the button changes <code>showExtra</code>, which is in the
          dependency array, so React runs the previous cleanup and then the new
          body — which immediately returns when the flag is off.
        </Callout>
      </Panel>

      <Callout kind="trap">
        <b>The refactor nobody mentions.</b> If a component really needs
        different hooks in different situations, that is two components. Split
        it and let the parent choose — <code>{'{'}isAdmin ? &lt;Admin /&gt; :
        &lt;User /&gt;{'}'}</code>. Each has a stable hook order, and React
        handles mount/unmount for you.
      </Callout>
    </div>
  )
}
