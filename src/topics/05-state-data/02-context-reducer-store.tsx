import { createContext, useContext, useReducer } from 'react'
import type { Dispatch, ReactNode } from 'react'
import type { TopicMeta } from '../../types'
import { Callout, Panel, RenderBadge } from '../../lib/ui'

export const meta = {
  title: 'A store from useReducer + Context',
  summary:
    'The built-in alternative to Redux for medium-sized state — how to build it correctly, and the exact point at which it stops scaling.',
  notes: [
    '<b>The shape:</b> <code>useReducer</code> for the transitions, two contexts to publish them — one for state, one for <code>dispatch</code>.',
    '<b>Splitting the contexts is the whole trick.</b> <code>dispatch</code> is referentially stable forever, so a component that only dispatches never re-renders when the state changes.',
    '<b>Memoise the state context value</b> if you build an object around it. Passing the reducer state directly is already stable between updates, so often no <code>useMemo</code> is needed.',
    '<b>Export guarded hooks, not the contexts.</b> <code>useCart()</code> that throws outside the provider gives a precise error and narrows the type.',
    '<b>Action creators are optional</b> but pay for themselves: they name the transitions and keep the action shapes in one place.',
    '<b>The ceiling:</b> every consumer of the state context re-renders on every action, because <code>useContext</code> has no selector. With a handful of consumers that is free; with two hundred it is not.',
    '<b>Workarounds before reaching for a library:</b> split into several narrower contexts, push state down, or wrap leaf components in <code>memo</code> and pass primitives.',
    '<b>Use it when</b> the state is scoped to a feature subtree, has a handful of consumers, and you want zero dependencies.',
  ],
  questions: [
    {
      q: 'How do you build a store with useReducer and Context?',
      a: 'Put the reducer in a provider component, then publish the result through <i>two</i> contexts: one carrying the state, one carrying <code>dispatch</code>. Wrap the subtree in both, and export a guarded hook for each.\n\nThe two-context split is the part that matters. <code>dispatch</code> is guaranteed stable by React, so its context value never changes — which means every component that only <i>triggers</i> actions, like a button, never re-renders when the data changes. If you put state and dispatch in one object, that button re-renders on every action for no reason.\n\nAnd export hooks rather than the context objects: <code>useCartState()</code> and <code>useCartDispatch()</code>, each throwing a clear error if used outside the provider. That gives good failure messages and lets TypeScript narrow away the <code>undefined</code>.',
    },
    {
      q: 'When does this pattern stop scaling?',
      a: 'When you have many consumers and frequent updates, because <code>useContext</code> cannot subscribe to part of a value. Every component reading the state context re-renders on every single action, even if the slice it cares about did not change.\n\nWith ten consumers and a handful of updates per interaction, that is genuinely free. With a list of two hundred rows each reading the store, and updates firing on every keystroke, it is a measurable problem — and you cannot fix it from the consumer side, because <code>React.memo</code> does not block context updates.\n\nBefore switching libraries I would try splitting into narrower contexts so components subscribe only to what they need, and pushing state down so fewer components are under the provider at all. When those stop being enough, that is the honest signal to move to something with selectors.',
    },
    {
      q: 'Why not just use one context with { state, dispatch }?',
      a: 'Because you have then coupled every dispatcher to every state change. The object <code>{ state, dispatch }</code> gets a new identity whenever <code>state</code> changes, so every consumer re-renders — including components that only ever call <code>dispatch</code> and render nothing derived from the state.\n\nIn a real app that is the majority of consumers: buttons, form controls, menu items. Splitting means they subscribe to a value that is created once and never changes again.\n\nIt costs one extra provider and one extra hook, and it is the recommended shape in the React docs for exactly this reason.',
    },
    {
      q: 'How does this compare with Redux Toolkit or Zustand?',
      a: 'It gives you the core idea — a reducer, named actions, a single source of truth — with zero dependencies and no bundle cost, which is a genuine advantage for feature-scoped state.\n\nWhat it does not give you: selector-based subscriptions, so no fine-grained re-rendering; devtools with action logging and time travel; middleware for logging, persistence or async; or a way to read and update the store from outside React.\n\nZustand is interesting as a comparison because it is barely larger than this pattern but fixes the selector problem, since it uses <code>useSyncExternalStore</code> under the hood rather than context. Redux Toolkit adds the devtools and middleware ecosystem on top.\n\nThe decision I would articulate: context+reducer for state owned by one feature, a real store for state that is genuinely application-wide.',
    },
  ],
} satisfies TopicMeta

/* ===========================================================================
   The state and the reducer. Pure, testable, no React.
   =========================================================================== */

type CartItem = { id: string; name: string; price: number; qty: number }
type CartState = { items: CartItem[]; discountCode: string | null }

type CartAction =
  | { type: 'cart/added'; item: Omit<CartItem, 'qty'> }
  | { type: 'cart/removed'; id: string }
  | { type: 'cart/qtyChanged'; id: string; delta: number }
  | { type: 'cart/discountApplied'; code: string }
  | { type: 'cart/cleared' }

const initialState: CartState = { items: [], discountCode: null }

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'cart/added': {
      const existing = state.items.find((i) => i.id === action.item.id)
      if (existing) {
        // Immutably bump the quantity. Note the map — mutating `existing.qty`
        // would leave the array reference identical and React would skip the
        // render entirely.
        return {
          ...state,
          items: state.items.map((i) =>
            i.id === action.item.id ? { ...i, qty: i.qty + 1 } : i,
          ),
        }
      }
      return { ...state, items: [...state.items, { ...action.item, qty: 1 }] }
    }

    case 'cart/removed':
      return { ...state, items: state.items.filter((i) => i.id !== action.id) }

    case 'cart/qtyChanged':
      return {
        ...state,
        items: state.items
          .map((i) => (i.id === action.id ? { ...i, qty: i.qty + action.delta } : i))
          .filter((i) => i.qty > 0), // removing at qty 0 is a transition, not a UI concern
      }

    case 'cart/discountApplied':
      return { ...state, discountCode: action.code }

    case 'cart/cleared':
      return initialState

    default: {
      const _exhaustive: never = action
      return state
    }
  }
}

/* ===========================================================================
   TWO contexts. This split is the entire performance story.
   =========================================================================== */

const CartStateContext = createContext<CartState | undefined>(undefined)
const CartDispatchContext = createContext<Dispatch<CartAction> | undefined>(undefined)

function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, initialState)

  return (
    // `dispatch` is stable for the provider's entire lifetime, so this
    // context's value literally never changes after mount.
    <CartDispatchContext.Provider value={dispatch}>
      {/* `state` is a new object only when an action actually changed it — the
          reducer returns the same reference otherwise — so no useMemo needed. */}
      <CartStateContext.Provider value={state}>{children}</CartStateContext.Provider>
    </CartDispatchContext.Provider>
  )
}

// Guarded hooks. The contexts themselves are NOT exported, so there is no way
// to read them without going through the check.
function useCartState(): CartState {
  const ctx = useContext(CartStateContext)
  if (!ctx) throw new Error('useCartState must be used within <CartProvider>')
  return ctx
}
function useCartDispatch(): Dispatch<CartAction> {
  const ctx = useContext(CartDispatchContext)
  if (!ctx) throw new Error('useCartDispatch must be used within <CartProvider>')
  return ctx
}

// Derived values belong here, next to the state — not duplicated at each
// call site and not stored in the reducer.
function useCartTotals() {
  const { items, discountCode } = useCartState()
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0)
  const discount = discountCode === 'SAVE10' ? subtotal * 0.1 : 0
  return { subtotal, discount, total: subtotal - discount, count: items.reduce((s, i) => s + i.qty, 0) }
}

/* ===========================================================================
   Consumers
   =========================================================================== */

const CATALOGUE = [
  { id: 'kbd', name: 'Keyboard', price: 89 },
  { id: 'mon', name: 'Monitor', price: 340 },
  { id: 'mse', name: 'Mouse', price: 45 },
]

/** Dispatch only. Watch its render count stay at zero as the cart changes. */
function AddButtons() {
  const dispatch = useCartDispatch()
  return (
    <div className="col">
      <div className="row">
        {CATALOGUE.map((p) => (
          <button key={p.id} onClick={() => dispatch({ type: 'cart/added', item: p })}>
            + {p.name}
          </button>
        ))}
      </div>
      <div className="row">
        <RenderBadge label="AddButtons (dispatch only)" />
      </div>
    </div>
  )
}

/** Reads state, so it re-renders on every action. That is correct here. */
function CartList() {
  const { items } = useCartState()
  const dispatch = useCartDispatch()

  if (items.length === 0) return <div className="muted">Cart is empty.</div>

  return (
    <div className="col">
      {items.map((i) => (
        <div key={i.id} className="row">
          <span className="mono" style={{ minWidth: 88 }}>
            {i.name}
          </span>
          <button onClick={() => dispatch({ type: 'cart/qtyChanged', id: i.id, delta: -1 })}>
            −
          </button>
          <span className="mono" style={{ minWidth: 20, textAlign: 'center' }}>
            {i.qty}
          </span>
          <button onClick={() => dispatch({ type: 'cart/qtyChanged', id: i.id, delta: 1 })}>+</button>
          <span className="mono muted">£{(i.price * i.qty).toFixed(2)}</span>
        </div>
      ))}
      <div className="row">
        <RenderBadge label="CartList (reads state)" />
      </div>
    </div>
  )
}

function CartSummary() {
  const { subtotal, discount, total, count } = useCartTotals()
  const dispatch = useCartDispatch()

  return (
    <div className="col">
      <div className="row">
        <span className="badge">{count} items</span>
        <span className="badge">subtotal £{subtotal.toFixed(2)}</span>
        {discount > 0 && <span className="badge good">−£{discount.toFixed(2)}</span>}
        <span className="badge good">total £{total.toFixed(2)}</span>
      </div>
      <div className="row">
        <button onClick={() => dispatch({ type: 'cart/discountApplied', code: 'SAVE10' })}>
          apply SAVE10
        </button>
        <button className="danger" onClick={() => dispatch({ type: 'cart/cleared' })}>
          clear
        </button>
      </div>
    </div>
  )
}

export default function Demo() {
  return (
    <div className="stack">
      <CartProvider>
        <Panel title="A working store, no dependencies">
          <div className="col">
            <AddButtons />
            <hr style={{ border: 0, borderTop: '1px solid var(--border-soft)', margin: '4px 0' }} />
            <CartList />
            <hr style={{ border: 0, borderTop: '1px solid var(--border-soft)', margin: '4px 0' }} />
            <CartSummary />
          </div>
        </Panel>
      </CartProvider>

      <Callout kind="tip">
        <b>Watch the two render badges.</b> <code>AddButtons</code> dispatches
        but never reads state — because <code>dispatch</code> lives in its own
        context whose value never changes, it renders once and stays there while
        you fill the cart.
      </Callout>

      <Panel title="The structure">
        <pre>
          <code>{`// cart-store.tsx — the whole public API is four exports
const CartStateContext    = createContext<CartState | undefined>(undefined)
const CartDispatchContext = createContext<Dispatch<CartAction> | undefined>(undefined)

export function CartProvider({ children }) {
  const [state, dispatch] = useReducer(cartReducer, initialState)
  return (
    <CartDispatchContext.Provider value={dispatch}>
      <CartStateContext.Provider value={state}>
        {children}
      </CartStateContext.Provider>
    </CartDispatchContext.Provider>
  )
}

export function useCartState()    { /* guarded useContext */ }
export function useCartDispatch() { /* guarded useContext */ }
export function useCartTotals()   { /* derived values live here */ }

// The context objects are NOT exported. The only way in is through the hooks,
// so the "must be inside a provider" guard cannot be bypassed.`}</code>
        </pre>
      </Panel>

      <Panel title="Where the ceiling is">
        <table className="data">
          <thead>
            <tr>
              <th />
              <th>Context + useReducer</th>
              <th>Zustand</th>
              <th>Redux Toolkit</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Bundle cost</td>
              <td className="mono">0</td>
              <td className="mono">~1kB</td>
              <td className="mono">~12kB</td>
            </tr>
            <tr>
              <td>Selector subscriptions</td>
              <td className="mono">no</td>
              <td className="mono">yes</td>
              <td className="mono">yes</td>
            </tr>
            <tr>
              <td>Devtools / time travel</td>
              <td className="mono">no</td>
              <td>via middleware</td>
              <td className="mono">yes</td>
            </tr>
            <tr>
              <td>Middleware</td>
              <td className="mono">no</td>
              <td>limited</td>
              <td className="mono">yes</td>
            </tr>
            <tr>
              <td>Usable outside React</td>
              <td className="mono">no</td>
              <td className="mono">yes</td>
              <td className="mono">yes</td>
            </tr>
            <tr>
              <td>Best for</td>
              <td>Feature-scoped state</td>
              <td>App-wide, minimal ceremony</td>
              <td>Large apps, many teams</td>
            </tr>
          </tbody>
        </table>
      </Panel>
    </div>
  )
}
