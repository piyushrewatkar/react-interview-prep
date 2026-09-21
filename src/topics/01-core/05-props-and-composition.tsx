import { useState } from 'react'
import type { ReactNode } from 'react'
import type { TopicMeta } from '../../types'
import { Callout, Panel } from '../../lib/ui'

export const meta = {
  title: 'Props, children & composition over inheritance',
  summary:
    'Props are immutable inputs, children is just a prop, and composition is how React solves every problem that class inheritance would solve badly.',
  notes: [
    '<b>Props are read-only.</b> A component must never write to its own props. Doing so breaks the "UI is a pure function of props and state" contract that makes concurrent rendering safe.',
    '<b>One-way data flow.</b> Data goes down via props; changes go up via callbacks. A child that needs to change parent state receives a function to call, not the state setter&rsquo;s permission to mutate.',
    '<b><code>children</code> is an ordinary prop.</b> <code>&lt;Card&gt;x&lt;/Card&gt;</code> and <code>&lt;Card children="x" /&gt;</code> are the same call. Anything you can do with a prop you can do with children.',
    '<b>Slots are just more props.</b> When one <code>children</code> is not enough, pass named element props: <code>&lt;Layout sidebar={&lt;Nav /&gt;} main={&lt;Feed /&gt;} /&gt;</code>. This is React&rsquo;s answer to named slots in other frameworks.',
    '<b>React has no component inheritance story, deliberately.</b> The official guidance is composition, every time. Shared behaviour goes into a custom hook (logic) or a wrapper component (markup), never a base class.',
    '<b>Prop drilling is only a problem at depth.</b> Passing a prop through two layers is fine and explicit. Passing it through six is a smell — reach for composition first (pass the rendered element down instead of the data), then context, then a store.',
    '<b><code>defaultProps</code> is gone for function components</b> as of React 19. Use default parameter values: <code>function Btn({ size = "md" })</code>.',
  ],
  questions: [
    {
      q: 'What is the difference between props and state?',
      a: 'Props are inputs passed in from the parent; state is data the component owns. Props are immutable from the component\'s point of view — only the parent can change them, by re-rendering with different values. State is mutable through its setter and is private to the instance.\n\nThe practical decision is "who is the source of truth?". If two components need the same value, it belongs in state in their closest common parent and flows down as props to both. If only one component cares, keep it local — moving state up unnecessarily is a real performance and complexity cost.',
    },
    {
      q: 'Why does React prefer composition over inheritance?',
      a: 'Because the things people reach for inheritance to share — behaviour and markup — decompose cleanly into two React primitives that do not have inheritance\'s problems.\n\nShared <i>logic</i> goes into a custom hook. Any component can call any number of hooks, so you get multiple inheritance without the diamond problem, and the data flow is explicit: you can see exactly what comes back from the hook call.\n\nShared <i>markup</i> goes into a wrapper component that takes <code>children</code>. A <code>Dialog</code> does not need a <code>WelcomeDialog</code> subclass; it needs a <code>Dialog</code> that renders whatever you put inside it.\n\nInheritance couples the child to the parent\'s internals and creates a hierarchy you have to refactor every time requirements cross-cut it. The React docs have said "we haven\'t found any use cases where we recommend creating component inheritance hierarchies" for the better part of a decade.',
    },
    {
      q: 'What is prop drilling and what are the alternatives?',
      a: 'Threading a prop through components that do not use it, purely to reach a descendant that does. It is noisy, and it means every intermediate component\'s signature changes when a leaf\'s requirements change.\n\nThe alternatives, in the order I would actually try them:\n\n<b>Composition.</b> Often the cleanest fix and the one people forget. Instead of passing <code>user</code> down three levels so a leaf can render <code>&lt;Avatar user={user} /&gt;</code>, render <code>&lt;Avatar user={user} /&gt;</code> at the top and pass it down as <code>children</code>. The intermediate components now pass through an opaque element and never mention <code>user</code>.\n\n<b>Context.</b> Right for genuinely ambient, rarely-changing values — theme, locale, the current user, auth. Wrong for high-frequency values, because every consumer re-renders on every change.\n\n<b>A store</b> (Redux, Zustand, Jotai). Right when the state is shared by distant parts of the app, changes often, and benefits from selector-level subscriptions.\n\nAnd sometimes the answer is "two levels of drilling is fine, leave it alone".',
    },
    {
      q: 'How do you type a component that accepts children?',
      a: 'Add <code>children: ReactNode</code> to the props type. <code>ReactNode</code> is the widest sensible type — it covers elements, strings, numbers, arrays, fragments, <code>null</code> and <code>undefined</code>, which is exactly what JSX can produce.\n\nAvoid <code>React.FC</code>: it used to add <code>children</code> implicitly, which was removed in React 18\'s types precisely because it made every component look like it accepted children whether or not it did. Declaring children explicitly is both clearer and more accurate. If you want to require exactly one element, <code>ReactElement</code> is narrower than <code>ReactNode</code>.',
    },
    {
      q: 'What happened to defaultProps?',
      a: 'It was deprecated for function components and removed in React 19. Default parameter values replace it — <code>function Button({ variant = "primary", size = "md" })</code> — which is plain JavaScript, works with TypeScript inference, and costs nothing at runtime.\n\nClass components still support <code>static defaultProps</code>. The removal was for function components only, and the motivation was that React had to do a resolution pass over every element\'s props to apply them, which is work the language now does for free.',
    },
  ],
} satisfies TopicMeta

/* ---------------------------------------------------------------------------
   Composition pattern 1: the wrapper. `children` is an opaque hole in the
   markup. `Card` knows nothing about what goes inside it, which is exactly
   why it is reusable.
   --------------------------------------------------------------------------- */
function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="panel" style={{ background: 'var(--bg-raised)' }}>
      <div className="panel-title">{title}</div>
      {children}
    </div>
  )
}

/* ---------------------------------------------------------------------------
   Composition pattern 2: named slots. When one hole is not enough, take
   several element-typed props. This is React's equivalent of named slots.
   --------------------------------------------------------------------------- */
function SplitLayout({ left, right }: { left: ReactNode; right: ReactNode }) {
  return (
    <div className="grid2">
      <div>{left}</div>
      <div>{right}</div>
    </div>
  )
}

/* ---------------------------------------------------------------------------
   Composition pattern 3: specialisation. The "inheritance" case. A specific
   component is just a generic one called with particular props — no subclass.
   --------------------------------------------------------------------------- */
function AlertCard({ children }: { children: ReactNode }) {
  return <Card title="⚠ Alert">{children}</Card>
}

/* ---------------------------------------------------------------------------
   One-way data flow. `Child` cannot touch the parent's state. It is handed a
   value to display and a function to call. That asymmetry is the whole model.
   --------------------------------------------------------------------------- */
function Child({ value, onBump }: { value: number; onBump: (by: number) => void }) {
  return (
    <div className="row">
      <span className="mono">child sees: {value}</span>
      <button onClick={() => onBump(1)}>+1</button>
      <button onClick={() => onBump(10)}>+10</button>
    </div>
  )
}

/* ---------------------------------------------------------------------------
   Prop drilling vs. composition, side by side.
   --------------------------------------------------------------------------- */
type User = { name: string; role: string }

// ❌ `user` is threaded through two components that have no interest in it.
function DrillOuter({ user }: { user: User }) {
  return <DrillMiddle user={user} />
}
function DrillMiddle({ user }: { user: User }) {
  return <DrillInner user={user} />
}
function DrillInner({ user }: { user: User }) {
  return (
    <span className="mono">
      {user.name} · {user.role}
    </span>
  )
}

// ✅ The same UI, but the intermediates only know about `children`. They never
//    have to change when the leaf's data requirements change.
function SlotOuter({ children }: { children: ReactNode }) {
  return <SlotMiddle>{children}</SlotMiddle>
}
function SlotMiddle({ children }: { children: ReactNode }) {
  return <>{children}</>
}

export default function Demo() {
  const [count, setCount] = useState(0)
  const user: User = { name: 'Grace H.', role: 'staff engineer' }

  return (
    <div className="stack">
      <Panel title="1. children is just a prop">
        <SplitLayout
          left={<Card title="Passed as children">Anything can go in here.</Card>}
          right={<AlertCard>Specialisation without a subclass.</AlertCard>}
        />
        <Callout kind="tip">
          <code>&lt;Card&gt;hi&lt;/Card&gt;</code> compiles to{' '}
          <code>_jsx(Card, {'{ children: "hi" }'})</code>. The <code>left</code>{' '}
          and <code>right</code> props above are the same idea with names.
        </Callout>
      </Panel>

      <Panel title="2. Data down, events up">
        <div className="row" style={{ marginBottom: 10 }}>
          <span className="mono">parent owns: {count}</span>
          <button onClick={() => setCount(0)}>reset</button>
        </div>
        <Child value={count} onBump={(by) => setCount((c) => c + by)} />
        <Callout>
          The child never sees <code>setCount</code>. It receives{' '}
          <code>onBump</code>, so the parent keeps control of <i>how</i> its own
          state changes — which is what lets it validate, clamp, or log without
          the child knowing.
        </Callout>
      </Panel>

      <Panel title="3. Drilling vs. composition">
        <div className="grid2">
          <div>
            <div className="panel-title" style={{ color: 'var(--bad)' }}>
              ❌ drilled through 2 uninterested layers
            </div>
            <DrillOuter user={user} />
            <pre style={{ marginTop: 8 }}>
              <code>{`<DrillOuter user={user} />\n  <DrillMiddle user={user} />\n    <DrillInner user={user} />`}</code>
            </pre>
          </div>
          <div>
            <div className="panel-title" style={{ color: 'var(--good)' }}>
              ✅ rendered at the top, passed as children
            </div>
            <SlotOuter>
              <DrillInner user={user} />
            </SlotOuter>
            <pre style={{ marginTop: 8 }}>
              <code>{`<SlotOuter>\n  <DrillInner user={user} />\n</SlotOuter>\n// middles never mention user`}</code>
            </pre>
          </div>
        </div>
      </Panel>
    </div>
  )
}
