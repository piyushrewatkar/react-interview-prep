import { useEffect, useState } from 'react'
import type { ComponentType } from 'react'
import type { TopicMeta } from '../../types'
import { Callout, Panel } from '../../lib/ui'

export const meta = {
  title: 'Higher-order components',
  summary:
    'A function that takes a component and returns a wrapped one. Obsolete for new code, unavoidable when reading old code, and a favourite interview question precisely for that reason.',
  notes: [
    '<b>An HOC is <code>(Component) =&gt; Component</code></b> — a function that wraps a component and returns an enhanced one. Not a React feature; just a composition pattern.',
    '<b>You have used several:</b> <code>connect()</code> from react-redux, <code>withRouter()</code> from react-router v5, <code>withTranslation()</code>, <code>memo()</code> and <code>forwardRef()</code>.',
    '<b>Rule: never mutate the wrapped component.</b> Compose, do not modify. Mutating breaks the "same input, same output" contract and leaks across every use site.',
    '<b>Rule: pass unrelated props through.</b> <code>&lt;Wrapped {...rest} /&gt;</code>, or consumers lose every prop the HOC did not anticipate.',
    '<b>Rule: copy statics and set <code>displayName</code>.</b> Otherwise DevTools shows a tree of <code>Anonymous</code> and static properties vanish.',
    '<b>Rule: never apply an HOC inside render.</b> <code>const Enhanced = withX(Foo)</code> in a render body creates a new component type every render, so React unmounts and remounts the subtree every time.',
    '<b>Why hooks won:</b> no wrapper components in the tree, no prop-name collisions when composing several, no <code>ref</code> forwarding ceremony, and vastly simpler types.',
    '<b>HOCs still fit</b> when you need to wrap the render output itself — an error boundary, an auth gate that renders something else entirely, a lazy/Suspense wrapper.',
  ],
  questions: [
    {
      q: 'What is a higher-order component?',
      a: 'A function that takes a component and returns a new component with extra behaviour. It is a plain composition pattern borrowed from higher-order functions — React has no special support for it.\n\nBefore hooks it was the main way to share stateful logic. <code>connect(mapState)(MyComponent)</code> gave you Redux data; <code>withRouter(MyComponent)</code> gave you router props. Both work by rendering the wrapped component with additional props injected.\n\nThe key property is that the wrapped component stays unaware — it just receives props — which is what makes it reusable and testable in isolation.',
    },
    {
      q: 'What problems do HOCs have that hooks solve?',
      a: 'Four, and they compound.\n\n<b>Wrapper hell.</b> Each HOC adds a real component to the tree. Three or four of them and your DevTools inspector is a stack of <code>withRouter(connect(withTheme(withAuth(Page))))</code> before you reach anything you wrote.\n\n<b>Prop collisions.</b> Two HOCs that both inject a prop called <code>data</code> silently overwrite each other, and the order of composition decides the winner. Nothing warns you.\n\n<b>Indirection.</b> Looking at a component, you cannot tell where a prop came from. You have to trace the composition chain.\n\n<b>Types.</b> Typing an HOC generically — "takes a component needing props A, returns one needing A minus B" — is genuinely painful in TypeScript, and the error messages are worse.\n\nA custom hook has none of these: no tree node, explicit naming at the call site (<code>const { data } = useAuth()</code>, and you rename freely), obvious provenance, and trivial types.',
    },
    {
      q: 'What are the rules for writing a well-behaved HOC?',
      a: '<b>Do not mutate the input component.</b> Assigning to <code>Component.prototype</code> or adding properties affects every other use of it. Return a new component that renders the original.\n\n<b>Pass through unknown props.</b> <code>&lt;Wrapped {...rest} /&gt;</code>. If you only forward the props you know about, you break every consumer that wants to pass a <code>className</code> or an <code>onClick</code>.\n\n<b>Set a <code>displayName</code></b> like <code>withAuth(UserProfile)</code>, or DevTools is unreadable.\n\n<b>Copy static methods</b>, or use <code>hoist-non-react-statics</code>. A wrapper does not inherit <code>Page.getLayout</code> or <code>Component.defaultProps</code>.\n\n<b>Forward refs.</b> Without it, a consumer putting a <code>ref</code> on the enhanced component gets the wrapper, not the underlying element.\n\n<b>Apply it outside render.</b> This is the one that causes real bugs — see the next question.',
    },
    {
      q: 'What happens if you apply an HOC inside a component’s render?',
      a: 'You create a brand-new component type on every render, so React sees a different <code>type</code> at that position and unmounts the entire subtree, then mounts a fresh one. All state is lost, all effects re-run, inputs lose focus, animations restart — on every single render.\n\nIt is the same failure mode as defining a component inside another component, because that is effectively what you are doing:\n\n<code>function Page() { const Enhanced = withAuth(Profile); return &lt;Enhanced /&gt; }</code>\n\nHOCs must be applied at module scope, where the result is computed once. If you genuinely need to choose an HOC at runtime, compute the enhanced component with <code>useMemo</code> keyed on whatever decides it — but that is almost always a sign the design should be different.',
    },
    {
      q: 'Is there anything HOCs still do better than hooks?',
      a: 'Yes — anything that needs to control or replace the <i>rendered output</i>, rather than just supply data.\n\nA hook runs inside a component and returns values; it cannot decide "render a login screen instead of this component" or "wrap this in an error boundary". An HOC sits above the component and can do both.\n\nSo the cases that survive are: error boundaries (which must be classes anyway), auth or feature-flag gates that render an entirely different tree, wrapping something in <code>Suspense</code> or a provider, and injecting behaviour into a third-party component you do not control.\n\nAnd of course <code>memo</code> and <code>forwardRef</code> are HOCs, so the pattern is still in React\'s own API. The honest summary is that HOCs lost the <i>logic-sharing</i> job to hooks and kept the <i>rendering-control</i> job.',
    },
  ],
} satisfies TopicMeta

/* ===========================================================================
   A textbook HOC, following all the rules.
   =========================================================================== */

type WithMousePosition = { mouseX: number; mouseY: number }

/**
 * `P` is the wrapped component's full props. The returned component needs
 * everything EXCEPT the props we inject — hence `Omit<P, keyof Injected>`.
 * Note how much type machinery this needs, versus `const {x, y} = useMouse()`.
 */
function withMousePosition<P extends WithMousePosition>(
  Wrapped: ComponentType<P>,
): ComponentType<Omit<P, keyof WithMousePosition>> {
  function WithMousePosition(props: Omit<P, keyof WithMousePosition>) {
    const [pos, setPos] = useState({ x: 0, y: 0 })

    useEffect(() => {
      const onMove = (e: MouseEvent) => setPos({ x: e.clientX, y: e.clientY })
      window.addEventListener('mousemove', onMove)
      return () => window.removeEventListener('mousemove', onMove)
    }, [])

    // RULE: pass every unknown prop through, or consumers lose them.
    // The cast is needed because TypeScript cannot prove that
    // Omit<P, injected> + injected === P. This is the typing pain in a nutshell.
    return <Wrapped {...(props as P)} mouseX={pos.x} mouseY={pos.y} />
  }

  // RULE: a readable name in DevTools.
  WithMousePosition.displayName = `withMousePosition(${Wrapped.displayName || Wrapped.name || 'Component'})`

  return WithMousePosition
}

/** The component being enhanced knows nothing about the HOC. */
function MouseReadout({ mouseX, mouseY, label }: WithMousePosition & { label: string }) {
  return (
    <div className="row">
      <span className="mono" style={{ minWidth: 80 }}>
        {label}
      </span>
      <span className="badge">
        {mouseX}, {mouseY}
      </span>
    </div>
  )
}

// RULE: applied at MODULE SCOPE, once. Never inside a render.
const MouseReadoutWithPosition = withMousePosition(MouseReadout)

/* ===========================================================================
   The same capability as a hook. Compare the two.
   =========================================================================== */

function useMousePosition() {
  const [pos, setPos] = useState({ x: 0, y: 0 })
  useEffect(() => {
    const onMove = (e: MouseEvent) => setPos({ x: e.clientX, y: e.clientY })
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])
  return pos
}

function MouseReadoutHook({ label }: { label: string }) {
  // No wrapper, no injected props, no type gymnastics. And you can see exactly
  // where the values come from.
  const { x, y } = useMousePosition()
  return (
    <div className="row">
      <span className="mono" style={{ minWidth: 80 }}>
        {label}
      </span>
      <span className="badge good">
        {x}, {y}
      </span>
    </div>
  )
}

/* ===========================================================================
   The case where an HOC is still the right tool: controlling what renders.
   =========================================================================== */

function withAuthGate<P extends object>(Wrapped: ComponentType<P>) {
  function WithAuthGate(props: P & { isLoggedIn: boolean }) {
    const { isLoggedIn, ...rest } = props
    // A hook cannot do this — it cannot decide to render something ELSE
    // in place of the component that called it.
    if (!isLoggedIn) {
      return <div className="callout trap">Please sign in to view this panel.</div>
    }
    return <Wrapped {...(rest as P)} />
  }
  WithAuthGate.displayName = `withAuthGate(${Wrapped.displayName || Wrapped.name})`
  return WithAuthGate
}

function SecretPanel() {
  return <div className="callout tip">🔐 The secret content.</div>
}
const GatedPanel = withAuthGate(SecretPanel)

export default function Demo() {
  const [loggedIn, setLoggedIn] = useState(false)

  return (
    <div className="stack">
      <Callout>Move your mouse — both readouts below track it.</Callout>

      <div className="grid2">
        <Panel title="HOC: withMousePosition(MouseReadout)">
          <MouseReadoutWithPosition label="via HOC" />
          <pre style={{ marginTop: 10 }}>
            <code>{`const Enhanced = withMousePosition(Readout)
// DevTools tree:
//   withMousePosition(MouseReadout)
//     └─ MouseReadout`}</code>
          </pre>
        </Panel>

        <Panel title="Hook: useMousePosition()">
          <MouseReadoutHook label="via hook" />
          <pre style={{ marginTop: 10 }}>
            <code>{`const { x, y } = useMousePosition()
// DevTools tree:
//   MouseReadoutHook`}</code>
          </pre>
        </Panel>
      </div>

      <Panel title="Where an HOC still wins: controlling the output">
        <div className="row" style={{ marginBottom: 12 }}>
          <button className="primary" onClick={() => setLoggedIn((v) => !v)}>
            {loggedIn ? 'Sign out' : 'Sign in'}
          </button>
        </div>
        <GatedPanel isLoggedIn={loggedIn} />
        <Callout kind="tip">
          A hook runs <i>inside</i> a component and can only return values. An
          HOC sits <i>above</i> it and can decide to render something else
          entirely — which is why error boundaries, auth gates and Suspense
          wrappers are still written this way.
        </Callout>
      </Panel>

      <Panel title="The fatal mistake">
        <pre>
          <code>{`// ❌ New component TYPE on every render.
//    React unmounts and remounts the subtree every time:
//    state lost, effects re-run, inputs lose focus.
function Page() {
  const Enhanced = withMousePosition(Readout)
  return <Enhanced />
}

// ✅ Module scope. Computed once, stable type forever.
const Enhanced = withMousePosition(Readout)
function Page() {
  return <Enhanced />
}`}</code>
        </pre>
      </Panel>
    </div>
  )
}
