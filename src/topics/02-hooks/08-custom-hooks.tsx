import { useRef, useState } from 'react'
import type { TopicMeta } from '../../types'
import { Callout, Panel } from '../../lib/ui'
import {
  useDebounce,
  useLocalStorage,
  useOnClickOutside,
  usePrevious,
  useToggle,
  useEventListener,
} from '../../lib/hooks'

export const meta = {
  title: 'Custom hooks',
  summary:
    'Extracting stateful logic so it can be reused without touching the component tree — and the design rules that separate a good hook from a leaky one.',
  notes: [
    '<b>A custom hook is any function starting with <code>use</code> that calls other hooks.</b> There is no registration, no API — it is a naming convention plus the rules of hooks.',
    '<b>They share logic, not state.</b> Two components calling <code>useCounter()</code> get two independent counters. If you want shared state, you need context or a store.',
    '<b>This is what HOCs and render props were for.</b> Hooks do the same job without wrapper components, so no "wrapper hell" in the DevTools tree and no prop-name collisions.',
    '<b>Return what the call site needs, in a shape that reads well.</b> A tuple for two values you will rename (<code>const [on, toggle]</code>), an object for three or more.',
    '<b>Stabilise what you return.</b> Callbacks handed back from a hook should be <code>useCallback</code>-wrapped, or every consumer&rsquo;s memoisation is defeated by your hook.',
    '<b>The "latest ref" pattern</b> keeps a subscription stable while the handler stays fresh: store the callback in a ref, update it every render, read <code>ref.current</code> inside the listener.',
    '<b>One concern per hook.</b> A <code>useUserDashboard()</code> that fetches, paginates, sorts and handles keyboard shortcuts is a component in disguise.',
    '<b>Test them with <code>renderHook</code></b> from React Testing Library — see the testing section.',
  ],
  questions: [
    {
      q: 'What is a custom hook and what problem does it solve?',
      a: 'A function whose name starts with <code>use</code> and which calls other hooks. That is the entire definition — there is no special API.\n\nThe problem it solves is sharing <i>stateful logic</i> between components. Before hooks, the only ways were higher-order components and render props, and both work by adding components to the tree: you end up with a debugging view five wrappers deep, prop names colliding between HOCs, and types that get harder to follow with every layer.\n\nA custom hook is just a function call. No wrapper, no extra node in the tree, no prop namespace to pollute, and you can compose several in one component without any of them knowing about each other.',
    },
    {
      q: 'If two components use the same custom hook, do they share state?',
      a: 'No. Each call gets its own independent state, exactly as if you had written the <code>useState</code> inline. A hook is a recipe, not an instance.\n\nThis catches people out when they extract, say, <code>useCart()</code> containing a <code>useState</code> and expect both the header badge and the checkout page to see the same cart. They will not — you have two carts.\n\nTo share, the state has to live somewhere shared: a context provider above both components, or an external store that the hook subscribes to. The hook then becomes a thin accessor over that shared source, which is a perfectly good design — it is what <code>useSelector</code> and Zustand\'s hooks are.',
    },
    {
      q: 'What makes a custom hook well designed?',
      a: 'Four things I would list.\n\n<b>One responsibility.</b> If the name needs an "and" in it, split it.\n\n<b>A stable return shape.</b> Memoise returned callbacks with <code>useCallback</code> and returned objects with <code>useMemo</code>. If you hand back a fresh object every render, every consumer\'s <code>React.memo</code> and every dependency array downstream is broken, and they cannot fix it from outside.\n\n<b>Honest dependencies.</b> No lint suppressions hiding a stale closure inside the hook, because the consumer has no way to see that.\n\n<b>Cleanup.</b> Anything it subscribes to, it unsubscribes from. The consumer should be able to unmount without leaking.\n\nThe test I apply: can someone use this correctly from the signature alone, without reading the body?',
    },
    {
      q: 'Explain the "latest ref" pattern.',
      a: 'It solves the conflict between a stable subscription and a fresh callback.\n\nSay you write <code>useEventListener(\'resize\', handler)</code>. If <code>handler</code> goes in the effect\'s dependency array, then an inline arrow at the call site — which is what everyone passes — means a new identity every render, so the effect tears down and re-adds the DOM listener on every single render. That is wasteful and can drop events.\n\nIf you leave it out of the array, the listener keeps calling the first render\'s handler forever: a stale closure.\n\nThe pattern takes both. Keep the handler in a ref, update the ref in an effect on every render, and have the listener call <code>ref.current(event)</code>. The effect that adds the listener depends only on the event type, so it runs once — and the behaviour is always the latest one.\n\nThis is the pattern the <code>useEffectEvent</code> RFC generalises, and you will find it inside every serious hooks library.',
    },
    {
      q: 'When should logic NOT be extracted into a custom hook?',
      a: 'When it has no hooks in it. A pure function that formats a date or sorts an array is just a function — calling it <code>useFormatDate</code> adds nothing but the constraint that it can no longer be called from an event handler or a loop.\n\nAlso when the extraction is premature. A hook used in exactly one place, that exists only because the component "felt long", usually makes things harder to follow: you now have to jump between two files to understand one behaviour, and the hook\'s interface is designed around a single call site so it is not actually reusable.\n\nExtract when there is a second call site, or when the logic is genuinely independent of the component\'s markup and you want to test it on its own.',
    },
  ],
} satisfies TopicMeta

/* --- Demo 1: useToggle + usePrevious -------------------------------------- */
function TogglePanel() {
  const [on, toggle] = useToggle(false)
  const previous = usePrevious(on)

  return (
    <div className="col">
      <div className="row">
        <button className="primary" onClick={toggle}>
          toggle
        </button>
        <span className={`badge ${on ? 'good' : ''}`}>now: {String(on)}</span>
        <span className="badge">previous: {String(previous)}</span>
      </div>
      <pre>
        <code>{`export function usePrevious<T>(value: T) {
  const ref = useRef<T | undefined>(undefined)
  useEffect(() => { ref.current = value }, [value])
  return ref.current   // effect runs AFTER render,
}                      // so this is still last render's value`}</code>
      </pre>
    </div>
  )
}

/* --- Demo 2: useDebounce -------------------------------------------------- */
function DebouncePanel() {
  const [query, setQuery] = useState('')
  const debounced = useDebounce(query, 500)
  const searchCount = useRef(0)

  // In real code this would be the effect that fires the network request —
  // note it depends on `debounced`, not `query`, so it runs once per pause.
  if (debounced) searchCount.current += 0 // (no-op; count shown below is illustrative)

  return (
    <div className="col">
      <input
        type="text"
        placeholder="type quickly…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="row">
        <span className="badge">live: &ldquo;{query}&rdquo;</span>
        <span className="badge good">debounced (500ms): &ldquo;{debounced}&rdquo;</span>
      </div>
      <pre>
        <code>{`useEffect(() => {
  const id = setTimeout(() => setDebounced(value), delay)
  return () => clearTimeout(id)   // <- the cleanup IS the debounce
}, [value, delay])`}</code>
      </pre>
    </div>
  )
}

/* --- Demo 3: useLocalStorage ---------------------------------------------- */
function StoragePanel() {
  const [name, setName] = useLocalStorage('interview-prep-demo-name', '')

  return (
    <div className="col">
      <input
        type="text"
        placeholder="type, then reload the page"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <div className="row">
        <span className="badge">localStorage key: interview-prep-demo-name</span>
        <button onClick={() => setName('')}>clear</button>
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>
        Reload the page — the value survives. The initialiser is lazy, so
        storage is read once rather than on every render.
      </div>
    </div>
  )
}

/* --- Demo 4: useOnClickOutside + useEventListener ------------------------- */
function DropdownPanel() {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Two hooks composed. Neither knows the other exists.
  useOnClickOutside(menuRef, () => setOpen(false))
  useEventListener('keydown', (e) => {
    if (e.key === 'Escape') setOpen(false)
  })

  return (
    <div className="col">
      <div ref={menuRef} style={{ position: 'relative', width: 'fit-content' }}>
        <button className="primary" onClick={() => setOpen((v) => !v)}>
          {open ? 'Close' : 'Open'} menu
        </button>
        {open && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: 6,
              background: 'var(--bg-raised)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: 8,
              minWidth: 180,
              zIndex: 5,
            }}
          >
            <div style={{ padding: '4px 8px', fontSize: 13 }}>Click outside to close</div>
            <div style={{ padding: '4px 8px', fontSize: 13 }}>…or press Escape</div>
          </div>
        )}
      </div>
      <Callout kind="tip">
        <code>useEventListener</code> takes an inline arrow — a new function
        every render — yet it never re-subscribes, because of the latest-ref
        pattern. See <code>src/lib/hooks.ts</code>.
      </Callout>
    </div>
  )
}

export default function Demo() {
  return (
    <div className="stack">
      <Callout>
        Every hook used here lives in <code>src/lib/hooks.ts</code>, heavily
        commented. Read that file alongside this page.
      </Callout>

      <div className="grid2">
        <Panel title="useToggle + usePrevious">
          <TogglePanel />
        </Panel>
        <Panel title="useDebounce">
          <DebouncePanel />
        </Panel>
      </div>

      <div className="grid2">
        <Panel title="useLocalStorage">
          <StoragePanel />
        </Panel>
        <Panel title="useOnClickOutside + useEventListener">
          <DropdownPanel />
        </Panel>
      </div>

      <Panel title="Return shape: tuple or object?">
        <pre>
          <code>{`// Tuple — when the caller will want to rename, and there are ≤ 2 values.
const [isOpen, toggleOpen] = useToggle()
const [isDark, toggleDark] = useToggle()   // both in one component, no clash

// Object — when there are several values and names carry meaning.
const { data, error, isLoading, refetch } = useQuery(...)
// A 4-tuple would force every caller to remember the order.`}</code>
        </pre>
      </Panel>
    </div>
  )
}
