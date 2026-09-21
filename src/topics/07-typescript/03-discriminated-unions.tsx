import { useState } from 'react'
import type { TopicMeta } from '../../types'
import { Callout, Panel, sleep } from '../../lib/ui'

export const meta = {
  title: 'Discriminated unions & impossible states',
  summary:
    'The single most valuable TypeScript technique in React: model your states so the invalid combinations cannot be written down.',
  notes: [
    '<b>A discriminated union is a union of object types sharing a literal-typed field</b> — the discriminant. Checking it narrows the type in that branch.',
    '<b>The canonical use is async state:</b> <code>{ status: "idle" } | { status: "loading" } | { status: "success"; data: T } | { status: "error"; error: string }</code>.',
    '<b>Four booleans allow sixteen combinations, twelve of which are nonsense.</b> A four-member union allows exactly four.',
    '<b>Narrowing is automatic.</b> Inside <code>if (state.status === "success")</code>, TypeScript knows <code>state.data</code> exists — and outside it, that it does not.',
    '<b>The same applies to props.</b> <code>{ variant: "link"; href: string } | { variant: "button"; onClick: () =&gt; void }</code> makes a link without an href a compile error.',
    '<b>Add an exhaustiveness check:</b> <code>const _: never = state</code> in the <code>default</code> branch. Adding a new member then breaks the build everywhere it needs handling — which is the point.',
    '<b>The discriminant must be a literal type</b>, not <code>string</code>. Use a union of string literals, or <code>as const</code>.',
    '<b>It composes with <code>useReducer</code></b> to give you a genuine state machine with compile-time-verified transitions.',
  ],
  questions: [
    {
      q: 'What is a discriminated union and why is it useful in React?',
      a: 'A union of object types that all share a field with a literal type — the discriminant. Checking that field narrows the whole object to one member.\n\nIn React the killer application is async state. The flat version, <code>{ isLoading: boolean; data: T | null; error: string | null }</code>, allows sixteen combinations, and most of them are meaningless — loading and error at once, success with null data, none of the three set. Every consumer has to defensively handle states that should not exist, and the compiler cannot help.\n\nThe union version — <code>{ status: "loading" } | { status: "success"; data: T } | { status: "error"; error: string }</code> — allows exactly the states that are real. <code>data</code> only exists on the success branch, so after <code>if (state.status === "success")</code> you can access it without a null check, and outside that branch you cannot access it at all.\n\nThe phrase for it is "make impossible states unrepresentable", and it eliminates a whole class of bug rather than catching it.',
    },
    {
      q: 'How do you get exhaustiveness checking?',
      a: 'Assign the narrowed value to a variable of type <code>never</code> in the default branch:\n\n<code>default: { const _exhaustive: never = state; throw new Error(`Unhandled: ${JSON.stringify(state)}`) }</code>\n\nIf every member has been handled above, <code>state</code> is narrowed to <code>never</code> by that point and the assignment compiles. If someone adds a fifth member and forgets a case, <code>state</code> is that fifth type, which is not assignable to <code>never</code>, and the build fails.\n\nThat inversion is the whole value: instead of a new state silently falling through to a default that renders nothing, the compiler points at every place that needs updating. It turns "add a state" from a risky change into a guided one.\n\nAn alternative is a helper — <code>function assertNever(x: never): never { throw … }</code> — which reads slightly better and gives a runtime error too.',
    },
    {
      q: 'Can you use this for component props?',
      a: 'Yes, and it is underused. A union prop type lets you require different props depending on a variant.\n\n<code>type Props = { as: "link"; href: string } | { as: "button"; onClick: () =&gt; void }</code>\n\nNow <code>&lt;Action as="link" /&gt;</code> without an <code>href</code> is a compile error, and passing <code>onClick</code> alongside <code>as="link"</code> is too. The alternative — both props optional, with a runtime check — pushes the error to production.\n\nThe same technique handles "either a label or an aria-label", "either controlled or uncontrolled", and "either single or multi select, which changes whether <code>value</code> is <code>T</code> or <code>T[]</code>".\n\nOne practical caveat: destructuring in the parameter list defeats the narrowing, because TypeScript loses the link between the discriminant and the rest. Take <code>props</code> whole and narrow inside the body.',
    },
    {
      q: 'What are the limitations?',
      a: 'The discriminant has to be a literal type. <code>status: string</code> does not narrow anything — you need <code>status: "idle" | "loading" | …</code>, or an object built with <code>as const</code>.\n\nDestructuring props or state in the parameter list breaks narrowing, because the relationship between the fields is lost once they are separate variables. You keep the object intact and narrow on it.\n\nNarrowing does not survive a closure boundary in some cases: TypeScript will widen inside a callback if the value could have changed, which occasionally means assigning to a local <code>const</code> first.\n\nAnd there is a modelling cost. Four separate states can be more verbose than one object with a few flags, particularly for something genuinely simple. For a two-state toggle, a boolean is fine — the technique earns its place once combinations can be contradictory.',
    },
  ],
} satisfies TopicMeta

/* ===========================================================================
   The flat version. Sixteen representable combinations, four legal ones.
   =========================================================================== */
type FlatState<T> = {
  isLoading: boolean
  isSuccess: boolean
  data: T | null
  error: string | null
}

/* ===========================================================================
   The union version. Exactly four representable states.
   =========================================================================== */
type Result = { id: number; title: string }

type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: string }
//    ^ `status` is the DISCRIMINANT. It must be a literal type — `string`
//      would not narrow. Note `data` exists on exactly one member.

function assertNever(value: never): never {
  throw new Error(`Unhandled state: ${JSON.stringify(value)}`)
}

function UnionVersion() {
  const [state, setState] = useState<AsyncState<Result[]>>({ status: 'idle' })

  const load = async (shouldFail: boolean) => {
    setState({ status: 'loading' })
    await sleep(600)
    if (shouldFail) setState({ status: 'error', error: 'HTTP 503 Service Unavailable' })
    else
      setState({
        status: 'success',
        data: [
          { id: 1, title: 'Reconciliation' },
          { id: 2, title: 'Concurrent rendering' },
        ],
      })
  }

  // The render is a total function over the state. Every branch is handled,
  // and the compiler proves it.
  const body = (() => {
    switch (state.status) {
      case 'idle':
        return <span className="muted">Nothing requested yet.</span>

      case 'loading':
        return <span className="muted">Loading…</span>

      case 'success':
        // `state.data` is `Result[]` here. No null check, no optional chaining,
        // no `!`. Try writing `state.error` — it does not exist on this branch.
        return (
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
            {state.data.map((r) => (
              <li key={r.id}>{r.title}</li>
            ))}
          </ul>
        )

      case 'error':
        // `state.error` is `string`. `state.data` is a compile error here.
        return <div className="callout trap">{state.error}</div>

      default:
        // EXHAUSTIVENESS CHECK. `state` is `never` here today. Add a fifth
        // member to AsyncState and this line stops compiling — pointing you
        // at every switch that needs a new case.
        return assertNever(state)
    }
  })()

  return (
    <div className="col">
      <div className="row">
        <button className="primary" onClick={() => load(false)}>
          load (ok)
        </button>
        <button className="danger" onClick={() => load(true)}>
          load (fail)
        </button>
        <button onClick={() => setState({ status: 'idle' })}>reset</button>
      </div>
      <span className="badge good">status: {state.status}</span>
      {body}
    </div>
  )
}

/* ===========================================================================
   Discriminated unions in PROPS.
   =========================================================================== */

type ActionProps =
  | { kind: 'link'; href: string; label: string }
  | { kind: 'button'; onClick: () => void; label: string }
  | { kind: 'submit'; form: string; label: string }

function Action(props: ActionProps) {
  // NOTE: props is taken WHOLE, not destructured in the parameter list.
  // `function Action({ kind, href, onClick })` would break narrowing, because
  // TypeScript loses the link between `kind` and the other fields.
  switch (props.kind) {
    case 'link':
      // props.href is string. props.onClick does not exist.
      return (
        <a href={props.href} target="_blank" rel="noreferrer">
          {props.label} ↗
        </a>
      )
    case 'button':
      return <button onClick={props.onClick}>{props.label}</button>
    case 'submit':
      return (
        <button type="submit" form={props.form}>
          {props.label}
        </button>
      )
    default:
      return assertNever(props)
  }
}

export default function Demo() {
  const [clicked, setClicked] = useState(0)

  // An illustration of what the flat type PERMITS. Every one of these is
  // nonsense, and every one of them type-checks.
  const impossibleStates: FlatState<Result[]>[] = [
    { isLoading: true, isSuccess: true, data: null, error: 'boom' },
    { isLoading: false, isSuccess: true, data: null, error: null },
    { isLoading: false, isSuccess: false, data: null, error: null },
  ]

  return (
    <div className="stack">
      <div className="grid2">
        <Panel title="✅ Discriminated union — 4 states, all legal">
          <UnionVersion />
        </Panel>

        <Panel title="❌ Flat flags — 16 states, 12 nonsense">
          <div className="col">
            <pre style={{ margin: 0, fontSize: 12 }}>
              <code>{JSON.stringify(impossibleStates, null, 1)}</code>
            </pre>
            <div style={{ fontSize: 13, color: 'var(--bad)' }}>
              All three type-check. The first claims to be loading, successful
              and failed at once. The second is successful with no data. The
              third is — idle, or an empty success? Nobody knows.
            </div>
          </div>
        </Panel>
      </div>

      <Panel title="Unions in props">
        <div className="row" style={{ marginBottom: 10 }}>
          <Action kind="link" href="https://react.dev" label="Docs" />
          <Action kind="button" onClick={() => setClicked((c) => c + 1)} label={`Clicked ${clicked}×`} />
        </div>
        <pre>
          <code>{`type ActionProps =
  | { kind: 'link';   href: string;        label: string }
  | { kind: 'button'; onClick: () => void; label: string }
  | { kind: 'submit'; form: string;        label: string }

<Action kind="link" />                          // ❌ href is required
<Action kind="link" href="/x" onClick={fn} />   // ❌ onClick not allowed here
<Action kind="link" href="/x" label="Docs" />   // ✅

// ⚠️ Take props WHOLE. Destructuring in the parameter list breaks narrowing:
function Action({ kind, href }: ActionProps)    // ❌ href: string | undefined
function Action(props: ActionProps)             // ✅ narrows on props.kind`}</code>
        </pre>
      </Panel>

      <Panel title="Exhaustiveness checking">
        <pre>
          <code>{`function assertNever(value: never): never {
  throw new Error('Unhandled state: ' + JSON.stringify(value))
}

switch (state.status) {
  case 'idle':    return <Idle />
  case 'loading': return <Spinner />
  case 'success': return <List items={state.data} />
  case 'error':   return <Error message={state.error} />
  default:        return assertNever(state)
  //                     ^ compiles only while every member is handled.
}

// Now add a fifth state:
//   | { status: 'refetching'; data: T }
// …and the build fails at assertNever, in EVERY switch that needs it.
// That is the feature: adding a state becomes a guided change instead of
// a silent fall-through to a default that renders nothing.`}</code>
        </pre>
      </Panel>

      <Callout kind="tip">
        <b>Where else this pays off.</b> Form field types (text vs select vs
        checkbox, each with different extra props), API response envelopes (
        <code>{'{ ok: true; data }'}</code> vs{' '}
        <code>{'{ ok: false; error }'}</code>), WebSocket message handling, and
        any <code>useReducer</code> action type — which is a discriminated union
        whether you thought of it that way or not.
      </Callout>
    </div>
  )
}
