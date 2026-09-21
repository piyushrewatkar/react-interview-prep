import { useState } from 'react'
import type { TopicMeta } from '../../types'
import { Callout, Panel, RenderBadge, burnCpu } from '../../lib/ui'

export const meta = {
  title: 'useState in depth',
  summary:
    'Lazy initialisation, the updater form, why objects in state are a trap, and the bail-out rule.',
  notes: [
    '<b>The initial value is only used on the first render</b> — but the expression is <i>evaluated</i> on every render unless you pass a function.',
    '<b>Lazy init:</b> <code>useState(() =&gt; JSON.parse(localStorage.getItem("x")))</code>. React calls the function once. <code>useState(JSON.parse(...))</code> parses on every single render and throws the result away.',
    '<b>Updater form:</b> <code>setX(prev =&gt; next)</code>. Use it whenever the next value depends on the current one. It reads the freshest value, so it is immune to stale closures and to batching.',
    '<b>Storing a function in state needs double arrows:</b> <code>setFn(() =&gt; myFn)</code>, because a bare function argument is interpreted as an updater.',
    '<b>State updates are replacements, not merges.</b> Unlike class <code>this.setState</code>, <code>setUser({ name })</code> drops every other key. Spread explicitly: <code>setUser(u =&gt; ({ ...u, name }))</code>.',
    '<b>React bails out on <code>Object.is</code>-equal values</b> — setting state to what it already is skips the re-render. But React may still render once before deciding, so never rely on it for correctness.',
    '<b>Prefer several <code>useState</code> calls to one big object</b> unless the fields genuinely change together. Independent values in one object means every update rewrites the whole thing and you spread constantly.',
    '<b>Do not duplicate derivable data in state.</b> If <code>fullName</code> is <code>first + " " + last</code>, compute it during render. Mirroring props into state is the most common source of stale UI.',
  ],
  questions: [
    {
      q: 'What is lazy initial state and when does it matter?',
      a: 'Passing a <i>function</i> to <code>useState</code> instead of a value: <code>useState(() =&gt; expensiveInit())</code>. React calls it only on the first render and ignores it thereafter.\n\nIt matters because the argument to <code>useState</code> is evaluated on every render regardless of whether React uses it. <code>useState(JSON.parse(localStorage.getItem("cart")))</code> hits localStorage and parses JSON on every single render, from mount to unmount, and discards the result every time after the first. Wrapping it in an arrow defers it to the one render that needs it.\n\nThe rule of thumb: if the initial value comes from a function call that does real work — parsing, reading storage, building a large array — make it lazy. For a literal like <code>useState(0)</code> it makes no difference and adds noise.',
    },
    {
      q: 'When must you use the updater form of setState?',
      a: 'Whenever the next value is computed from the current one. <code>setCount(count + 1)</code> reads <code>count</code> from the render that created the closure, which may be stale by the time the update is applied — because of batching, because the handler is async, or because it was captured in an effect that has not re-run.\n\n<code>setCount(c =&gt; c + 1)</code> asks React to apply a function to whatever the latest queued value is, so it composes correctly with other queued updates and never reads a stale snapshot.\n\nThe second, subtler benefit: since the callback no longer closes over <code>count</code>, you can remove <code>count</code> from a <code>useCallback</code> or <code>useEffect</code> dependency array, which is often the difference between a stable callback and one that changes every render.',
    },
    {
      q: 'How do you store a function in state?',
      a: 'Double arrow: <code>setCallback(() =&gt; myFunction)</code>. A single <code>setCallback(myFunction)</code> is interpreted as the updater form — React calls <code>myFunction(prevState)</code> and stores whatever it returns, which is almost never what you wanted.\n\nThe same applies to the initialiser: <code>useState(() =&gt; myFunction)</code> stores the function, whereas <code>useState(myFunction)</code> calls it as a lazy initialiser.\n\nHonestly, if you are storing a function in state, it is worth a second look — a ref is usually the better home for it, since changing a callback rarely needs to trigger a render.',
    },
    {
      q: 'Does useState merge object updates like this.setState did?',
      a: 'No. Class <code>this.setState({ name })</code> shallow-merged into the existing state object. <code>useState</code> replaces wholesale — <code>setUser({ name })</code> leaves you with an object that has only <code>name</code> and has silently dropped <code>email</code>, <code>id</code> and everything else.\n\nYou spread explicitly: <code>setUser(u =&gt; ({ ...u, name }))</code>, and note it is a shallow spread, so nested objects need nesting too, which is where Immer earns its place.\n\nThe design reason is that merging is ambiguous once state can be any type — you cannot merge a number or an array meaningfully — and implicit merging hid bugs where a key was dropped or a nested object was shared by reference.',
    },
    {
      q: 'What happens if you set state to the same value it already has?',
      a: 'React compares with <code>Object.is</code> and, if equal, bails out — it skips re-rendering that component and its children.\n\nWith one caveat worth stating: React may still render the component <i>once</i> before it works out that it can bail, because the bail-out check happens after it has already begun. So the render is not guaranteed to be skipped, only the work below it. That means you must not depend on it for correctness — a render with a side effect in it will still run.\n\nAlso note <code>Object.is</code>, not <code>===</code>: <code>NaN</code> is equal to itself here, and <code>+0</code> and <code>-0</code> are not. And of course a mutated-then-reassigned object is <code>Object.is</code>-equal to itself, which is why mutating state can make updates silently disappear.',
    },
    {
      q: 'One state object or several useState calls?',
      a: 'Several, by default. Independent values updating independently is what the API is designed for, and it avoids the constant spreading plus the risk of dropping a key.\n\nGroup into one object when the fields genuinely change together and are meaningless apart — a cursor\'s <code>{x, y}</code>, a fetch\'s <code>{status, data, error}</code>. Splitting those invites impossible states like <code>status: "success"</code> with <code>data: null</code>.\n\nAnd once a single object has several fields that update through more than a couple of distinct operations, that is the signal to move to <code>useReducer</code>, where the transitions get names and live in one place.',
    },
  ],
} satisfies TopicMeta

// Simulates an expensive initial computation, e.g. parsing a large blob out of
// localStorage or building a lookup table.
function expensiveInit(): number {
  burnCpu(40)
  return 100
}

export default function Demo() {
  // ❌ `expensiveInit()` is CALLED on every render. React discards the result
  //    after the first, but you still paid for it. Try swapping the two lines
  //    below and watching the render latency.
  // const [eager] = useState(expensiveInit())

  // ✅ Passing the function defers it: React invokes it once, on mount.
  const [lazy] = useState(expensiveInit)

  const [count, setCount] = useState(0)
  const [user, setUser] = useState({ name: 'Ada', email: 'ada@example.com', role: 'admin' })
  const [same, setSame] = useState(1)

  // The function-in-state trap.
  const [fn, setFn] = useState<() => string>(() => () => 'hello from stored fn')

  return (
    <div className="stack">
      <div className="row">
        <RenderBadge label="Demo" />
        <span className="badge">lazy init ran once → {lazy}</span>
      </div>

      <Panel title="1. Lazy initialisation">
        <pre>
          <code>{`// ❌ runs on EVERY render, result thrown away after the first
const [v] = useState(expensiveInit())

// ✅ runs ONCE, on mount
const [v] = useState(expensiveInit)
const [v] = useState(() => JSON.parse(localStorage.getItem('cart') ?? '[]'))`}</code>
        </pre>
        <Callout kind="tip">
          Nothing changes about the <i>value</i> — both give you 100. The
          difference is that the eager form burns 40ms of CPU on every single
          render for the rest of the component&rsquo;s life.
        </Callout>
      </Panel>

      <Panel title="2. Replacement, not merge">
        <div className="row" style={{ marginBottom: 10 }}>
          <button
            className="danger"
            onClick={() => setUser({ name: 'Grace' } as typeof user)}
          >
            ❌ setUser({'{'} name {'}'})
          </button>
          <button
            className="primary"
            onClick={() => setUser((u) => ({ ...u, name: u.name === 'Ada' ? 'Grace' : 'Ada' }))}
          >
            ✅ setUser(u =&gt; ({'{'} ...u, name {'}'}))
          </button>
          <button onClick={() => setUser({ name: 'Ada', email: 'ada@example.com', role: 'admin' })}>
            reset
          </button>
        </div>
        <pre>
          <code>{JSON.stringify(user, null, 2)}</code>
        </pre>
        <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>
          Press the red button: <code>email</code> and <code>role</code> are
          gone. <code>useState</code> replaces; it does not merge.
        </div>
      </Panel>

      <div className="grid2">
        <Panel title="3. The bail-out">
          <div className="row">
            <span className="mono">same: {same}</span>
            <button onClick={() => setSame(1)}>setSame(1) — no-op</button>
            <button onClick={() => setSame((s) => s + 1)}>setSame(s =&gt; s+1)</button>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 8 }}>
            Setting <code>1</code> when it is already <code>1</code> is{' '}
            <code>Object.is</code>-equal, so React skips the work. Watch the
            render badge at the top: it does not move.
          </div>
        </Panel>

        <Panel title="4. Storing a function">
          <div className="row">
            <button onClick={() => setFn(() => () => `generated at ${Date.now() % 10000}`)}>
              setFn(() =&gt; () =&gt; …)
            </button>
          </div>
          <div className="mono" style={{ fontSize: 13, marginTop: 8 }}>
            fn() === &ldquo;{fn()}&rdquo;
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 8 }}>
            One arrow would make React treat your function as an updater and
            store its return value instead.
          </div>
        </Panel>
      </div>

      <Panel title="5. Do not mirror what you can derive">
        <div className="row">
          <button onClick={() => setCount((c) => c + 1)}>count: {count}</button>
          {/* ✅ Derived during render. No state, no effect, never stale. */}
          <span className="badge">doubled (derived): {count * 2}</span>
          <span className="badge">parity (derived): {count % 2 ? 'odd' : 'even'}</span>
        </div>
        <Callout kind="trap">
          A second <code>useState</code> for <code>doubled</code> kept in sync by
          a <code>useEffect</code> is the single most common piece of
          unnecessary React code. It costs an extra render, and it is stale for
          one frame every time.
        </Callout>
      </Panel>
    </div>
  )
}
