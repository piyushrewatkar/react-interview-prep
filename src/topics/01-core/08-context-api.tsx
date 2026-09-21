import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { TopicMeta } from '../../types'
import { Callout, Panel, RenderBadge } from '../../lib/ui'

export const meta = {
  title: 'Context: the API and its re-render trap',
  summary:
    'Context solves prop drilling, not state management. The difference matters, and the performance trap catches almost everyone once.',
  notes: [
    '<b>Context is a transport mechanism.</b> It moves a value down the tree without passing it through every layer. It does not store anything, batch anything, or optimise anything.',
    '<b>Every consumer re-renders when the value changes</b>, with no way to subscribe to part of it. <code>useContext</code> has no selector. This is the single most important fact about context performance.',
    '<b>The classic bug:</b> <code>value={{ user, setUser }}</code> creates a new object every render of the provider, so every consumer re-renders every time the provider renders — even if <code>user</code> is unchanged. Wrap it in <code>useMemo</code>.',
    '<b>Splitting contexts is the real fix.</b> Put rarely-changing data in one context and the stable dispatch functions in another. Components that only dispatch then never re-render when the data changes.',
    '<b><code>React.memo</code> does not shield a context consumer.</b> Memo compares props; context updates bypass props entirely and force the consumer to re-render regardless.',
    '<b>React 19 lets you render <code>&lt;Ctx&gt;</code> directly</b> instead of <code>&lt;Ctx.Provider&gt;</code>. The old form still works.',
    '<b>Reach for context when:</b> the value is ambient and changes rarely — theme, locale, current user, feature flags, a form’s field registry. Reach for a store when the value changes often and consumers care about different slices of it.',
  ],
  questions: [
    {
      q: 'Is Context a state management solution?',
      a: 'No — it is a dependency injection mechanism. It answers "how does this value reach that component" and says nothing about how the value is stored, updated, or who should re-render.\n\nThe state still lives in a <code>useState</code> or <code>useReducer</code> somewhere above. Context just saves you from threading it through the intermediate components. People say "Context replaced Redux" and it genuinely does replace Redux for low-frequency global values like theme and auth — but the moment you want selective subscriptions, middleware, devtools, or updates many times a second, you are re-implementing a store on top of context and a real store would be less code.',
    },
    {
      q: 'Why did wrapping a component in React.memo not stop it re-rendering?',
      a: 'Almost certainly because it consumes a context. <code>React.memo</code> compares the incoming props and skips the render if they are equal — but a context update is not a prop change. React marks every consumer of that context as needing work and re-renders them regardless of what memo says.\n\nThe same is true of a component that calls <code>useState</code> or <code>useReducer</code> and updates its own state: memo only guards the props path.\n\nIf you need to stop the propagation, you have to stop the context value from changing — which means memoising the value and splitting the context so that the parts that change often are separate from the parts your component reads.',
    },
    {
      q: 'What is the most common Context performance mistake?',
      a: 'Passing an object literal as the value: <code>&lt;Ctx.Provider value={{ user, setUser }}&gt;</code>. That object is constructed fresh on every render of the provider component, so its reference changes every time, so React notifies every consumer even when <code>user</code> is identical.\n\nIf the provider sits near the root — which is where providers usually sit — anything that re-renders the root now re-renders every consumer in the app.\n\nThe fix is <code>const value = useMemo(() =&gt; ({ user, setUser }), [user])</code>. <code>setUser</code> is already stable because React guarantees setter identity, so it does not need to be a dependency, though including it is harmless and keeps the lint rule quiet.',
    },
    {
      q: 'How do you avoid re-rendering every consumer when only part of the context changes?',
      a: 'Split the context. The standard shape is two providers: one holding the state and one holding the dispatch or action functions. Components that only need to <i>trigger</i> changes consume the actions context, which never changes identity, so they never re-render when the data does. This is the pattern the React docs recommend for <code>useReducer</code> + context.\n\nIf you need slice-level granularity within one changing value, context alone cannot give it to you — <code>useContext</code> has no selector argument. At that point the answers are: <code>useSyncExternalStore</code> over an external store you own, or a library built for exactly this (Zustand, Jotai, Redux with <code>useSelector</code>). The <code>use-context-selector</code> package exists to bolt selectors onto context, which tells you something about the gap.',
    },
    {
      q: 'What happens if you call useContext with no matching Provider above it?',
      a: 'You get the default value passed to <code>createContext(defaultValue)</code> — and if you passed <code>undefined</code>, or nothing, you get <code>undefined</code>, usually followed by a crash several lines later when something destructures it.\n\nThe defensive pattern everyone converges on is a custom hook that throws with a useful message:\n\n<code>function useTheme() { const ctx = useContext(ThemeCtx); if (!ctx) throw new Error("useTheme must be used within &lt;ThemeProvider&gt;"); return ctx }</code>\n\nIt also gives you a clean place to narrow the type from <code>T | undefined</code> to <code>T</code>, so every call site stops needing optional chaining. Exporting the hook and keeping the context object private is good practice for the same reason.',
    },
  ],
} satisfies TopicMeta

/* ===========================================================================
   VERSION A — the naive one. A single context whose value is an object
   literal. Every consumer re-renders whenever anything in the provider
   re-renders, including the ones that only dispatch.
   =========================================================================== */

type BadCtx = { count: number; theme: string; bump: () => void }
const BadContext = createContext<BadCtx | undefined>(undefined)

function BadProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0)
  const [theme] = useState('dark')

  // ❌ New object identity on EVERY render of BadProvider.
  const value = { count, theme, bump: () => setCount((c) => c + 1) }

  return <BadContext.Provider value={value}>{children}</BadContext.Provider>
}

function BadCounterDisplay() {
  const ctx = useContext(BadContext)!
  return (
    <div className="row">
      <span className="mono">count: {ctx.count}</span>
      <RenderBadge label="display" />
    </div>
  )
}

function BadThemeDisplay() {
  const ctx = useContext(BadContext)!
  // This component reads ONLY `theme`, which never changes — yet it re-renders
  // on every count bump, because it subscribes to the whole context value.
  return (
    <div className="row">
      <span className="mono">theme: {ctx.theme}</span>
      <RenderBadge label="theme (never changes!)" />
    </div>
  )
}

function BadButton() {
  const ctx = useContext(BadContext)!
  return (
    <div className="row">
      <button onClick={ctx.bump}>bump</button>
      <RenderBadge label="button (only dispatches!)" />
    </div>
  )
}

/* ===========================================================================
   VERSION B — split contexts. Data in one, actions in the other, and both
   values memoised. Now the theme reader and the button never re-render.
   =========================================================================== */

type GoodState = { count: number; theme: string }
type GoodActions = { bump: () => void }

const StateContext = createContext<GoodState | undefined>(undefined)
const ActionsContext = createContext<GoodActions | undefined>(undefined)

function GoodProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0)
  const [theme] = useState('dark')

  // ✅ Only changes when `count` actually changes.
  const state = useMemo(() => ({ count, theme }), [count, theme])

  // ✅ Never changes at all. `setCount` has a stable identity guaranteed by
  //    React, so the empty dep array is correct, and the updater form means we
  //    never need to read `count` from the closure.
  const bump = useCallback(() => setCount((c) => c + 1), [])
  const actions = useMemo(() => ({ bump }), [bump])

  return (
    <ActionsContext.Provider value={actions}>
      <StateContext.Provider value={state}>{children}</StateContext.Provider>
    </ActionsContext.Provider>
  )
}

// The guard-rail hooks. Throwing here turns a confusing `undefined is not an
// object` five components away into a precise error at the call site — and it
// narrows the type from `GoodState | undefined` to `GoodState`.
function useGoodState() {
  const ctx = useContext(StateContext)
  if (!ctx) throw new Error('useGoodState must be used inside <GoodProvider>')
  return ctx
}
function useGoodActions() {
  const ctx = useContext(ActionsContext)
  if (!ctx) throw new Error('useGoodActions must be used inside <GoodProvider>')
  return ctx
}

function GoodCounterDisplay() {
  const { count } = useGoodState()
  return (
    <div className="row">
      <span className="mono">count: {count}</span>
      <RenderBadge label="display" />
    </div>
  )
}

function GoodThemeDisplay() {
  // Still subscribes to the whole state object, so it still re-renders —
  // context genuinely cannot do slice-level subscriptions. To fix THIS you
  // would need a third context, or an external store.
  const { theme } = useGoodState()
  return (
    <div className="row">
      <span className="mono">theme: {theme}</span>
      <RenderBadge label="theme" />
    </div>
  )
}

function GoodButton() {
  const { bump } = useGoodActions()
  return (
    <div className="row">
      <button onClick={bump}>bump</button>
      <RenderBadge label="button" />
    </div>
  )
}

export default function Demo() {
  return (
    <div className="stack">
      <Callout>
        Click <b>bump</b> in each column a few times and compare the render
        counts.
      </Callout>

      <div className="grid2">
        <Panel title="❌ One context, object literal value">
          <BadProvider>
            <div className="col">
              <BadCounterDisplay />
              <BadThemeDisplay />
              <BadButton />
            </div>
          </BadProvider>
          <div style={{ marginTop: 10, fontSize: 13, color: 'var(--bad)' }}>
            Everything re-renders on every bump — including the button, which
            reads nothing that changed.
          </div>
        </Panel>

        <Panel title="✅ Split contexts, memoised values">
          <GoodProvider>
            <div className="col">
              <GoodCounterDisplay />
              <GoodThemeDisplay />
              <GoodButton />
            </div>
          </GoodProvider>
          <div style={{ marginTop: 10, fontSize: 13, color: 'var(--good)' }}>
            The button never re-renders: the actions context value is created
            once and never changes.
          </div>
        </Panel>
      </div>

      <Callout kind="trap">
        <b>Notice what is still not fixed.</b> The theme reader on the right
        <i> still</i> re-renders, because it consumes the same state object as
        the counter. <code>useContext</code> has no selector — this is the
        ceiling of what context can do, and the honest answer to “when would you
        use Redux/Zustand instead?”.
      </Callout>
    </div>
  )
}
