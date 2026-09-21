import { useReducer, useState } from 'react'
import type { TopicMeta } from '../../types'
import { Callout, Panel, useLog, Log } from '../../lib/ui'

export const meta = {
  title: 'useReducer & state machines',
  summary:
    'When several pieces of state change together, name the transitions instead of the fields — and make impossible states unrepresentable.',
  notes: [
    '<b><code>useReducer(reducer, initialState)</code></b> returns <code>[state, dispatch]</code>. The reducer is <code>(state, action) =&gt; newState</code> and must be pure.',
    '<b>Reach for it when</b> the next state depends on several fields at once, when the same transition is triggered from multiple places, or when you keep writing the same three <code>setX</code> calls together.',
    '<b><code>dispatch</code> has a stable identity</b> — guaranteed by React, like a state setter. That means you can pass it deep without memoising and leave it out of dependency arrays.',
    '<b>Lazy init:</b> <code>useReducer(reducer, arg, init)</code> calls <code>init(arg)</code> once. Useful for expensive setup and for expressing a <code>RESET</code> action as <code>init(arg)</code>.',
    '<b>Reducers are trivially testable</b> — a pure function with no React in sight. That alone often justifies the move.',
    '<b>Discriminated unions turn it into a state machine.</b> Model <code>{ status: "idle" } | { status: "loading" } | { status: "success", data: T }</code> so <code>data</code> only exists where it makes sense.',
    '<b>Never mutate the state argument.</b> Return a new object. Mutating gives you the same reference and React bails out of the render.',
    '<b>It is not Redux.</b> No middleware, no devtools, no global store — just local state with named transitions.',
  ],
  questions: [
    {
      q: 'When would you choose useReducer over useState?',
      a: 'Three signals, any one of which is enough.\n\n<b>Coupled state.</b> When an action always updates several fields together — a fetch setting <code>loading</code>, <code>data</code> and <code>error</code> in one go — a reducer expresses that as a single atomic transition instead of three setter calls you have to remember to keep in sync.\n\n<b>Complex transitions.</b> When the next state depends on the current state in non-trivial ways, the logic wants to live in one named place rather than scattered across handlers.\n\n<b>Repeated logic.</b> When the same update happens from three different buttons, <code>dispatch({ type: "removeItem", id })</code> beats copy-pasting the setter logic.\n\nThe bonus is testability: a reducer is a pure function, so you can assert on transitions without rendering anything.',
    },
    {
      q: 'Is dispatch stable across renders?',
      a: 'Yes. React guarantees that the <code>dispatch</code> function from <code>useReducer</code> — like the setter from <code>useState</code> — keeps the same identity for the lifetime of the component.\n\nThat has real consequences. You can pass <code>dispatch</code> through context without memoising the value and consumers will not re-render. You can omit it from <code>useEffect</code> and <code>useCallback</code> dependency arrays (the lint rule knows this too). And a deeply nested component can trigger updates without the parent having to thread down a new callback on every render.\n\nThis is a large part of why "reducer in context, dispatch in a separate context" is the recommended shape for medium-sized state.',
    },
    {
      q: 'How do you make impossible states unrepresentable with a reducer?',
      a: 'Use a discriminated union for the state rather than a flat object of flags.\n\nA flat <code>{ isLoading, data, error }</code> allows sixteen combinations, most of which are nonsense — loading <i>and</i> error, success with null data, and so on. Every consumer then has to defensively check all three.\n\nInstead: <code>type State = { status: "idle" } | { status: "loading" } | { status: "success"; data: Item } | { status: "error"; error: string }</code>. Now <code>data</code> only exists on the success branch, TypeScript narrows it after a <code>status</code> check, and it is impossible to construct a loading state that also has an error.\n\nThe reducer then reads as a state machine — each case says which statuses a transition is legal from — and you can reject impossible transitions explicitly instead of half-applying them.',
    },
    {
      q: 'What is the third argument to useReducer?',
      a: 'A lazy initialiser. <code>useReducer(reducer, initialArg, init)</code> calls <code>init(initialArg)</code> once, on mount, and uses the result as the initial state — exactly like passing a function to <code>useState</code>, so expensive setup does not run on every render.\n\nThe second, less obvious use is reset. Because <code>init</code> is a named function you also have available inside the reducer, a <code>RESET</code> action can simply <code>return init(action.payload)</code>, which keeps "what does a fresh state look like" defined in one place instead of duplicated between the initial value and the reset case.',
    },
    {
      q: 'Does useReducer replace Redux?',
      a: 'For local and mid-sized state, yes — and that is most state. Combined with context it covers a component subtree cleanly, and it is built in.\n\nWhat it does not give you: a single global store, middleware for async and side effects, time-travel devtools, selector-based subscriptions that avoid re-rendering every consumer, or the ecosystem of persistence and sync tooling. Because context has no selectors, a large reducer-in-context store re-renders every consumer on every action, which is the wall people hit.\n\nSo the honest answer is "useReducer replaced the <i>reason</i> most apps reached for Redux". When you genuinely need cross-cutting global state with granular subscriptions, Redux Toolkit or Zustand is still less code than reimplementing them.',
    },
  ],
} satisfies TopicMeta

/* ===========================================================================
   A fetch state machine. Compare the two models.
   =========================================================================== */

// ❌ The flat-flags version: 2 × 2 × 2 = 8 combinations, 4 of which are
//    nonsense. Every consumer has to check all three fields.
type FlagState = { isLoading: boolean; data: string | null; error: string | null }

// ✅ The discriminated union: exactly four legal states, and `data` only exists
//    where it is meaningful. TypeScript narrows on `status`.
type MachineState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: string }
  | { status: 'error'; error: string }

type Action =
  | { type: 'FETCH' }
  | { type: 'RESOLVE'; data: string }
  | { type: 'REJECT'; error: string }
  | { type: 'RESET' }

/**
 * A pure function. No React, no closures, no `this` — which is why you can
 * unit-test every transition in three lines with no test renderer.
 *
 * Note how the switch also encodes which transitions are LEGAL: you cannot
 * RESOLVE from idle, because that case is not handled there.
 */
function reducer(state: MachineState, action: Action): MachineState {
  switch (action.type) {
    case 'FETCH':
      // Legal only from idle or error or success — i.e. always. Refetching is fine.
      return { status: 'loading' }

    case 'RESOLVE':
      // Ignore a resolve that arrives when we are not loading. This single line
      // is a race-condition guard you get for free from modelling states.
      if (state.status !== 'loading') return state
      return { status: 'success', data: action.data }

    case 'REJECT':
      if (state.status !== 'loading') return state
      return { status: 'error', error: action.error }

    case 'RESET':
      return init()

    default: {
      // Exhaustiveness check. If someone adds a new action type and forgets a
      // case, `action` is not `never` here and TypeScript fails the build.
      const _exhaustive: never = action
      return state
    }
  }
}

function init(): MachineState {
  return { status: 'idle' }
}

function MachineVersion({ log }: { log: (s: string) => void }) {
  // Third argument = lazy initialiser. Also reused by the RESET case above.
  const [state, dispatch] = useReducer(reducer, undefined, init)

  const run = (shouldFail: boolean) => {
    dispatch({ type: 'FETCH' })
    log('dispatch FETCH → loading')
    setTimeout(() => {
      if (shouldFail) {
        dispatch({ type: 'REJECT', error: 'HTTP 503' })
        log('dispatch REJECT → error')
      } else {
        dispatch({ type: 'RESOLVE', data: '{ "id": 42, "name": "Ada" }' })
        log('dispatch RESOLVE → success')
      }
    }, 700)
  }

  return (
    <div className="col">
      <div className="row">
        <button className="primary" onClick={() => run(false)} disabled={state.status === 'loading'}>
          fetch (ok)
        </button>
        <button className="danger" onClick={() => run(true)} disabled={state.status === 'loading'}>
          fetch (fail)
        </button>
        <button onClick={() => dispatch({ type: 'RESET' })}>reset</button>
      </div>

      <div className="row">
        <span className="badge">status: {state.status}</span>
      </div>

      {/* TypeScript narrows on `state.status`. Try adding `state.data` to the
          error branch — it will not compile, because it does not exist there. */}
      {state.status === 'idle' && <span className="muted">Nothing requested yet.</span>}
      {state.status === 'loading' && <span className="muted">Loading…</span>}
      {state.status === 'success' && (
        <pre>
          <code>{state.data}</code>
        </pre>
      )}
      {state.status === 'error' && <div className="callout trap">{state.error}</div>}
    </div>
  )
}

function FlagsVersion() {
  const [s, setS] = useState<FlagState>({ isLoading: false, data: null, error: null })

  const run = (shouldFail: boolean) => {
    // Three fields to remember, every time. Forget to clear `error` here and
    // you get a success screen with a stale error banner underneath it.
    setS({ isLoading: true, data: null, error: null })
    setTimeout(() => {
      if (shouldFail) setS({ isLoading: false, data: null, error: 'HTTP 503' })
      else setS({ isLoading: false, data: '{ "id": 42 }', error: null })
    }, 700)
  }

  return (
    <div className="col">
      <div className="row">
        <button onClick={() => run(false)} disabled={s.isLoading}>
          fetch (ok)
        </button>
        <button onClick={() => run(true)} disabled={s.isLoading}>
          fetch (fail)
        </button>
      </div>
      <pre>
        <code>{JSON.stringify(s, null, 2)}</code>
      </pre>
      <div style={{ fontSize: 13, color: 'var(--bad)' }}>
        Representable but meaningless: <code>{'{ isLoading: true, error: "x" }'}</code>,{' '}
        <code>{'{ isLoading: false, data: null, error: null }'}</code> — is that
        idle, or a successful empty response?
      </div>
    </div>
  )
}

export default function Demo() {
  const { lines, push, clear } = useLog()

  return (
    <div className="stack">
      <div className="grid2">
        <Panel title="✅ useReducer + discriminated union">
          <MachineVersion log={push} />
        </Panel>
        <Panel title="❌ useState + boolean flags">
          <FlagsVersion />
        </Panel>
      </div>

      <Panel title="Dispatch log">
        <Log lines={lines} empty="Press a fetch button." />
        <div className="row" style={{ marginTop: 10 }}>
          <button onClick={clear}>Clear</button>
        </div>
      </Panel>

      <Panel title="Why reducers are easy to test">
        <pre>
          <code>{`// No render, no act(), no testing library. Just a function.
it('ignores a RESOLVE that arrives when not loading', () => {
  const state = { status: 'idle' } as const
  expect(reducer(state, { type: 'RESOLVE', data: 'x' })).toBe(state)
})

it('moves idle -> loading on FETCH', () => {
  expect(reducer({ status: 'idle' }, { type: 'FETCH' }))
    .toEqual({ status: 'loading' })
})`}</code>
        </pre>
      </Panel>

      <Callout kind="tip">
        <b>The line that sells it.</b> With <code>useState</code> you name the{' '}
        <i>fields</i>. With <code>useReducer</code> you name the{' '}
        <i>transitions</i> — and named transitions are what you can test, log,
        replay and reason about.
      </Callout>
    </div>
  )
}
