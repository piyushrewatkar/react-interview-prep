import { useId, useSyncExternalStore } from 'react'
import type { TopicMeta } from '../../types'
import { Callout, Panel, RenderBadge } from '../../lib/ui'

export const meta = {
  title: 'useId, useSyncExternalStore & the rest',
  summary:
    'The hooks that come up in senior interviews precisely because most candidates have never needed them: stable ids for SSR, and subscribing to non-React state safely.',
  notes: [
    '<b><code>useId</code></b> generates an identifier that is stable across a render and — crucially — identical on the server and the client, so SSR hydration does not mismatch.',
    '<b>Do not use <code>useId</code> for list keys.</b> It is per-component-instance, not per-item. It is for linking <code>&lt;label htmlFor&gt;</code> to <code>&lt;input id&gt;</code>, and for <code>aria-describedby</code>.',
    '<b>One <code>useId</code> can serve several elements:</b> <code>{`${id}-email`}</code>, <code>{`${id}-password`}</code>. Calling it once per field is wasteful.',
    '<b><code>useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)</code></b> is the official way to read state that lives outside React — a Redux store, a Zustand store, <code>window.matchMedia</code>, <code>navigator.onLine</code>, <code>localStorage</code>.',
    '<b>It exists to prevent tearing.</b> Under concurrent rendering, a render can be paused; if the external store changes mid-render, two components could read different values and paint an inconsistent frame. This hook makes React re-check and restart instead.',
    '<b><code>getSnapshot</code> must return a cached value.</b> Returning a fresh object each call causes an infinite render loop, because React compares with <code>Object.is</code>.',
    '<b><code>subscribe</code> must be a stable function.</b> A new one each render makes React resubscribe every time.',
    '<b><code>useDebugValue</code></b> labels a custom hook in React DevTools. Only useful in shared libraries; skip it in app code.',
  ],
  questions: [
    {
      q: 'What is useId for and what is it not for?',
      a: 'It produces a unique, stable string you can use as a DOM <code>id</code>. Its whole reason to exist is server-side rendering: if you generate ids with a module-level counter or <code>Math.random()</code>, the server and the client produce different values, hydration reports a mismatch, and accessibility relationships silently break.\n\n<code>useId</code> derives the id from the component\'s position in the tree, so both environments agree.\n\nWhat it is <i>not</i> for is list keys. It returns one id per component instance, not per item — every row rendered by the same component in a <code>.map</code> would get the same one. Keys need to come from your data.',
    },
    {
      q: 'What is tearing, and how does useSyncExternalStore prevent it?',
      a: 'Tearing is when a single render pass paints inconsistent data: two components read the same external store at different moments and get different values, so the screen shows a total that does not match its own line items.\n\nIt became possible in React 18 because concurrent rendering can pause a render partway and resume it later. Before that, rendering was synchronous — nothing could change in between — so the naive pattern of <code>useState</code> plus a <code>useEffect</code> subscription happened to work.\n\n<code>useSyncExternalStore</code> gives React a way to detect it: React calls <code>getSnapshot</code> during render and again before committing. If the value changed, it knows the render was based on stale data and re-renders instead of committing a torn frame. That is why every store library — Redux, Zustand, Jotai — moved onto this hook for React 18.',
    },
    {
      q: 'Why does my useSyncExternalStore cause an infinite loop?',
      a: 'Because <code>getSnapshot</code> is returning a new object or array every call. React compares the previous snapshot to the new one with <code>Object.is</code> to decide whether to re-render; a fresh reference is never equal, so it re-renders, calls <code>getSnapshot</code> again, gets another fresh reference, and so on. React actually detects this and throws "The result of getSnapshot should be cached".\n\nThe fix is to return a stable reference — the store must hold the snapshot object and only replace it when the data genuinely changes, and <code>getSnapshot</code> just returns it.\n\nIf you need a derived slice, use <code>useSyncExternalStoreWithSelector</code> from <code>use-sync-external-store/shim/with-selector</code>, which lets you pass a selector plus an equality function, so <code>state =&gt; ({ a, b })</code> does not re-render on every check.',
    },
    {
      q: 'Would you use useSyncExternalStore in application code?',
      a: 'Rarely and deliberately. It is primarily a library-author API — if you are using Redux or Zustand, they already call it for you.\n\nWhere it earns its place in app code is subscribing to browser APIs that are genuinely external state: <code>window.matchMedia</code> for a media query, <code>navigator.onLine</code> for connectivity, <code>document.visibilityState</code>, <code>localStorage</code> synced across tabs via the <code>storage</code> event. All of those written with <code>useState</code> + <code>useEffect</code> have a real bug — the value can change between the initial render and the effect firing, so the first paint is wrong.\n\n<code>useSyncExternalStore</code> reads the current value during render, so the first paint is correct. That is a good reason to reach for it even in app code.',
    },
    {
      q: 'What is the third argument, getServerSnapshot?',
      a: 'The value to use during server-side rendering and during hydration. It is required if your app is server-rendered; without it React throws when it tries to render on the server, because <code>getSnapshot</code> typically touches a browser API that does not exist there.\n\nIt should return whatever is safe and neutral on the server — <code>false</code> for <code>navigator.onLine</code>, a default theme for a media query. React uses it for the server HTML <i>and</i> for the first client render, so that hydration matches; the real value is picked up on the subsequent render.\n\nThat means a media-query hook will briefly render the default on the client too, which is correct behaviour rather than a bug: the server had no way to know the viewport size.',
    },
  ],
} satisfies TopicMeta

/* ===========================================================================
   A tiny external store. This is, in miniature, exactly what Zustand is.
   =========================================================================== */

type CartState = { items: string[]; total: number }

function createCartStore() {
  // The snapshot object. `getSnapshot` returns THIS reference, and it is only
  // replaced when the data actually changes. That cached reference is what
  // keeps useSyncExternalStore from looping forever.
  let snapshot: CartState = { items: [], total: 0 }
  const listeners = new Set<() => void>()

  return {
    // React calls this with a callback. Return an unsubscribe function.
    // IMPORTANT: this must be a stable function reference across renders, or
    // React tears down and re-establishes the subscription every time.
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },

    // Must return the SAME reference when nothing changed.
    getSnapshot() {
      return snapshot
    },

    // Used during SSR and the first hydration render.
    getServerSnapshot(): CartState {
      return { items: [], total: 0 }
    },

    add(item: string, price: number) {
      // New object = new reference = React notices. Mutating `snapshot.items`
      // in place would leave the reference identical and React would skip the
      // render entirely.
      snapshot = { items: [...snapshot.items, item], total: snapshot.total + price }
      listeners.forEach((l) => l())
    },

    clear() {
      if (snapshot.items.length === 0) return // avoid a pointless notify
      snapshot = { items: [], total: 0 }
      listeners.forEach((l) => l())
    },
  }
}

// Module-level: lives entirely outside React, like any real store.
const cartStore = createCartStore()

function useCart(): CartState {
  return useSyncExternalStore(
    cartStore.subscribe,
    cartStore.getSnapshot,
    cartStore.getServerSnapshot,
  )
}

/* Two independent components reading the same store. Neither has a parent
   passing props down; both stay in sync because both subscribe. */
function CartCount() {
  const cart = useCart()
  return (
    <div className="row">
      <span className="mono">{cart.items.length} items</span>
      <RenderBadge label="CartCount" />
    </div>
  )
}

function CartTotal() {
  const cart = useCart()
  return (
    <div className="row">
      <span className="mono">£{cart.total.toFixed(2)}</span>
      <RenderBadge label="CartTotal" />
    </div>
  )
}

/* ===========================================================================
   A browser API as an external store — the case where you genuinely want this
   hook in application code.
   =========================================================================== */

function subscribeToOnline(callback: () => void) {
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)
  return () => {
    window.removeEventListener('online', callback)
    window.removeEventListener('offline', callback)
  }
}

function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    subscribeToOnline,
    // Reads the CURRENT value during render, so the very first paint is
    // correct. A useState+useEffect version paints `true` first and corrects
    // itself a frame later.
    () => navigator.onLine,
    // On the server there is no navigator. Assume online.
    () => true,
  )
}

/* ===========================================================================
   useId
   =========================================================================== */

function LoginFields() {
  // ONE call, several derived ids. Calling useId per field also works but is
  // unnecessary — the point is a unique namespace for this instance.
  const id = useId()

  return (
    <div className="col">
      <div className="col" style={{ gap: 4 }}>
        <label htmlFor={`${id}-email`} style={{ fontSize: 12, color: 'var(--text-faint)' }}>
          Email
        </label>
        <input id={`${id}-email`} type="email" aria-describedby={`${id}-email-hint`} />
        <span id={`${id}-email-hint`} style={{ fontSize: 12, color: 'var(--text-faint)' }}>
          Screen readers announce this because of aria-describedby.
        </span>
      </div>
      <div className="mono" style={{ fontSize: 12, color: 'var(--text-faint)' }}>
        useId() returned <b>{id}</b> — identical on server and client.
      </div>
    </div>
  )
}

export default function Demo() {
  const online = useOnlineStatus()

  return (
    <div className="stack">
      <Panel title="1. useSyncExternalStore — a store outside React">
        <div className="row" style={{ marginBottom: 12 }}>
          <button className="primary" onClick={() => cartStore.add('Widget', 9.99)}>
            add Widget (£9.99)
          </button>
          <button className="primary" onClick={() => cartStore.add('Gadget', 24.5)}>
            add Gadget (£24.50)
          </button>
          <button onClick={() => cartStore.clear()}>clear</button>
        </div>
        <div className="grid2">
          <div className="panel">
            <div className="panel-title">CartCount</div>
            <CartCount />
          </div>
          <div className="panel">
            <div className="panel-title">CartTotal</div>
            <CartTotal />
          </div>
        </div>
        <Callout kind="tip">
          Neither component has a provider above it or a prop passed in. The
          store is a plain module-level object; React is just subscribing to it
          safely. This is Zustand in about forty lines.
        </Callout>
      </Panel>

      <Panel title="2. A browser API as an external store">
        <div className="row">
          <span className={`badge ${online ? 'good' : 'bad'}`}>
            navigator.onLine → {String(online)}
          </span>
          <span className="muted" style={{ fontSize: 13 }}>
            Turn your wifi off to see it flip.
          </span>
        </div>
        <pre style={{ marginTop: 10 }}>
          <code>{`// ❌ Wrong first paint: renders true, then corrects a frame later.
const [online, setOnline] = useState(true)
useEffect(() => {
  const on = () => setOnline(true), off = () => setOnline(false)
  window.addEventListener('online', on)
  window.addEventListener('offline', off)
  return () => { /* remove both listeners */ }
}, [])

// ✅ Correct on the very first paint, and tearing-safe.
useSyncExternalStore(subscribe, () => navigator.onLine, () => true)`}</code>
        </pre>
      </Panel>

      <Panel title="3. useId — SSR-stable ids for accessibility">
        <LoginFields />
        <Callout kind="trap">
          <b>Not for keys.</b> <code>useId</code> is one id per component
          instance. Every row produced by the same component in a{' '}
          <code>.map()</code> would receive the same value. Keys come from your
          data.
        </Callout>
      </Panel>
    </div>
  )
}
