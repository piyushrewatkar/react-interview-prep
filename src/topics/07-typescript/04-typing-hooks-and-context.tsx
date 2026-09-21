import { createContext, useContext, useReducer, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { TopicMeta } from '../../types'
import { Callout, Panel } from '../../lib/ui'

export const meta = {
  title: 'Typing hooks, refs, context & the utility types',
  summary:
    'The remaining everyday TypeScript: generic state, ref types that are actually different from each other, a context that cannot be undefined at the call site, and `satisfies`.',
  notes: [
    '<b><code>useState</code> infers from the initial value.</b> Annotate only when the initial value is narrower than the eventual type — <code>useState&lt;User | null&gt;(null)</code>.',
    '<b>Avoid <code>useState([])</code>:</b> it infers <code>never[]</code>, and every push is an error. Write <code>useState&lt;Item[]&gt;([])</code>.',
    '<b>Two different ref types.</b> <code>useRef&lt;HTMLDivElement&gt;(null)</code> gives a <i>read-only</i> ref for the <code>ref</code> attribute. <code>useRef&lt;number | null&gt;(null)</code> gives a mutable box you write to yourself.',
    '<b>DOM refs are always <code>T | null</code></b>, because the node does not exist until after the first commit. Optional-chain it; do not reach for <code>!</code>.',
    '<b>Type a context as <code>T | undefined</code></b> and narrow it in a guarded hook that throws. Every consumer then gets <code>T</code> with no optional chaining.',
    '<b>Type a reducer&rsquo;s actions as a discriminated union</b> and the <code>switch</code> narrows the payload per case.',
    '<b><code>satisfies</code> checks a value against a type without widening it</b> — you keep the literal types <i>and</i> the validation. This is why every topic file in this project ends with <code>satisfies TopicMeta</code>.',
    '<b>Know the core utility types:</b> <code>Partial</code>, <code>Required</code>, <code>Pick</code>, <code>Omit</code>, <code>Record</code>, <code>Readonly</code>, <code>ReturnType</code>, <code>Awaited</code>, <code>NonNullable</code>.',
  ],
  questions: [
    {
      q: 'When do you annotate useState and when do you let it infer?',
      a: 'Let it infer whenever the initial value already has the right type. <code>useState(0)</code> is <code>number</code>, <code>useState("")</code> is <code>string</code> — annotating those is noise.\n\nAnnotate when the initial value is narrower than what the state will eventually hold. <code>useState(null)</code> infers <code>null</code>, so you need <code>useState&lt;User | null&gt;(null)</code>. Same for a state that starts as one member of a union.\n\nThe specific trap is <code>useState([])</code>, which infers <code>never[]</code> — an array that can never contain anything. Every subsequent <code>setItems([...items, item])</code> is an error, and the message is confusing until you have seen it once. Write <code>useState&lt;Item[]&gt;([])</code>.\n\nSame reasoning for <code>useState({})</code>, which infers <code>{}</code> and then rejects every property access.',
    },
    {
      q: 'Why are there two different useRef types?',
      a: 'Because refs are used for two unrelated things, and TypeScript distinguishes them by whether <code>null</code> is in the type argument.\n\n<code>useRef&lt;HTMLInputElement&gt;(null)</code> — type argument without <code>null</code>, initial value <code>null</code> — returns a <code>RefObject</code> whose <code>current</code> is <code>HTMLInputElement | null</code>. This is the DOM-handle form: React writes to it, you only read.\n\n<code>useRef&lt;number | null&gt;(null)</code> — <code>null</code> in the type argument — returns a fully mutable ref you write to yourself. This is the instance-variable form: timer ids, latches, previous values.\n\nIn older type definitions the distinction was sharper: a <code>RefObject</code>\'s <code>current</code> was genuinely readonly, so assigning to a DOM ref was an error. React 19\'s types relaxed that, but the conceptual split is still what the two forms express, and knowing which you mean is the useful part.\n\nEither way, a DOM ref is always nullable, because the node does not exist until after the first commit.',
    },
    {
      q: 'How do you type a context so consumers do not have to check for undefined?',
      a: 'Type the context as <code>T | undefined</code> with a default of <code>undefined</code>, then never export the context. Export a hook that reads it and throws:\n\n<code>function useTheme() { const ctx = useContext(ThemeContext); if (!ctx) throw new Error("useTheme must be used within &lt;ThemeProvider&gt;"); return ctx }</code>\n\nThe throw is a type guard as far as TypeScript is concerned, so after it <code>ctx</code> is narrowed to <code>T</code> and the hook\'s return type is <code>T</code>. Every consumer gets a non-nullable value with no optional chaining and no non-null assertions.\n\nIt also gives a precise runtime error instead of "cannot read property of undefined" three components away.\n\nThe alternative you sometimes see — <code>createContext({} as ThemeValue)</code> — makes the types work by lying: a missing provider now fails silently with an empty object instead of erroring, which is strictly worse.',
    },
    {
      q: 'What does `satisfies` do that a type annotation does not?',
      a: 'It validates a value against a type without widening the value\'s inferred type.\n\nWith <code>const config: Config = { theme: "dark", retries: 3 }</code>, the variable\'s type becomes <code>Config</code>. If <code>Config.theme</code> is <code>string</code>, you have lost the information that it is specifically <code>"dark"</code>.\n\nWith <code>const config = { theme: "dark", retries: 3 } satisfies Config</code>, you get the same error checking, but the variable keeps its narrow inferred type — <code>theme</code> is <code>"dark"</code>, and the keys are the literal keys you wrote, so <code>Object.keys</code> and indexed access stay precise.\n\nIt is genuinely useful for configuration objects, route maps, theme tokens and anything where you want both the check and the literals. It is why every topic file in this project ends with <code>satisfies TopicMeta</code> — the object is validated, and the strings stay literal.',
    },
    {
      q: 'Which utility types do you actually use?',
      a: 'A small set covers almost everything.\n\n<code>Partial&lt;T&gt;</code> for update payloads and optional overrides. <code>Required&lt;T&gt;</code> occasionally, for the inverse. <code>Pick&lt;T, K&gt;</code> and <code>Omit&lt;T, K&gt;</code> constantly — <code>Omit</code> especially, for extending native element props while replacing one of them.\n\n<code>Record&lt;K, V&gt;</code> for lookup maps, and it pairs well with a union key so the compiler requires every case: <code>Record&lt;Status, string&gt;</code>.\n\n<code>ReturnType&lt;typeof fn&gt;</code> for deriving a type from a function rather than declaring it twice — that is how Redux\'s <code>RootState</code> is defined.\n\n<code>Awaited&lt;T&gt;</code> to unwrap a promise, <code>NonNullable&lt;T&gt;</code> to strip null and undefined, and <code>Parameters&lt;typeof fn&gt;</code> when wrapping a function.\n\nThe principle behind all of them: derive types from a single source rather than declaring the same shape twice, because two declarations always drift.',
    },
  ],
} satisfies TopicMeta

/* ===========================================================================
   1. useState
   =========================================================================== */

type User = { id: number; name: string }

/* ===========================================================================
   2. Context, typed so consumers never see undefined.
   =========================================================================== */

type SettingsValue = {
  density: 'compact' | 'comfortable'
  setDensity: (d: 'compact' | 'comfortable') => void
}

// `| undefined` in the type AND `undefined` as the default. The alternative,
// `createContext({} as SettingsValue)`, makes the types compile by lying:
// a missing provider then fails silently instead of erroring.
const SettingsContext = createContext<SettingsValue | undefined>(undefined)

function SettingsProvider({ children }: { children: ReactNode }) {
  const [density, setDensity] = useState<SettingsValue['density']>('comfortable')
  return (
    <SettingsContext.Provider value={{ density, setDensity }}>{children}</SettingsContext.Provider>
  )
}

// The throw acts as a type guard: after it, `ctx` is narrowed from
// `SettingsValue | undefined` to `SettingsValue`, so the return type is
// non-nullable and no consumer needs `?.` or `!`.
function useSettings(): SettingsValue {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within <SettingsProvider>')
  return ctx
}

function DensityToggle() {
  const { density, setDensity } = useSettings() // SettingsValue, guaranteed
  return (
    <button onClick={() => setDensity(density === 'compact' ? 'comfortable' : 'compact')}>
      density: {density}
    </button>
  )
}

/* ===========================================================================
   3. A typed reducer. The action union narrows per case.
   =========================================================================== */

type CounterState = { count: number; step: number }
type CounterAction =
  | { type: 'increment' }
  | { type: 'decrement' }
  | { type: 'setStep'; step: number }
  | { type: 'reset'; to?: number }

function counterReducer(state: CounterState, action: CounterAction): CounterState {
  switch (action.type) {
    case 'increment':
      return { ...state, count: state.count + state.step }
    case 'decrement':
      return { ...state, count: state.count - state.step }
    case 'setStep':
      // `action.step` is `number` here. On the 'increment' branch it does not
      // exist at all — the union narrowed.
      return { ...state, step: action.step }
    case 'reset':
      return { ...state, count: action.to ?? 0 }
    default: {
      const _exhaustive: never = action
      return state
    }
  }
}

/* ===========================================================================
   4. `satisfies`
   =========================================================================== */

type ThemeTokens = Record<string, string>

// With an annotation, `keyof typeof tokens` would widen to `string`.
// With `satisfies`, it stays 'bg' | 'fg' | 'accent' — checked AND narrow.
const tokens = {
  bg: '#0d1117',
  fg: '#e6edf3',
  accent: '#6aa9ff',
} satisfies ThemeTokens

type TokenName = keyof typeof tokens // 'bg' | 'fg' | 'accent'

export default function Demo() {
  // ✅ Inferred — the initial value already has the right type.
  const [name, setName] = useState('Ada')

  // ✅ Annotated — the initial value is narrower than the eventual type.
  const [user, setUser] = useState<User | null>(null)

  // ✅ Annotated — useState([]) would infer never[].
  const [items, setItems] = useState<string[]>([])

  // DOM ref: no `null` in the type argument. React writes it; we read it.
  const inputRef = useRef<HTMLInputElement>(null)

  // Mutable instance variable: `null` IS in the type argument.
  const timerRef = useRef<number | null>(null)

  const [state, dispatch] = useReducer(counterReducer, { count: 0, step: 1 })

  return (
    <div className="stack">
      <Panel title="1. useState — infer or annotate">
        <pre>
          <code>{`// ✅ Inferred. Annotating would be noise.
const [name, setName] = useState('Ada')              // string
const [count, setCount] = useState(0)                // number

// ✅ Annotate when the initial value is narrower.
const [user, setUser] = useState<User | null>(null)  // null would infer as null

// ❌ THE TRAP. Infers never[] — an array that can hold nothing.
const [items, setItems] = useState([])
setItems([...items, 'x'])   // Type 'string' is not assignable to 'never'

// ✅
const [items, setItems] = useState<string[]>([])`}</code>
        </pre>
        <div className="row">
          <input value={name} onChange={(e) => setName(e.target.value)} />
          <span className="badge">items: {items.length}</span>
          <button onClick={() => setItems((i) => [...i, `item ${i.length + 1}`])}>push</button>
          <button onClick={() => setUser({ id: 1, name })}>set user</button>
          <span className="badge">{user ? `user: ${user.name}` : 'user: null'}</span>
        </div>
      </Panel>

      <Panel title="2. Two kinds of ref">
        <pre>
          <code>{`// A DOM handle. No null in the type argument; null as the initial value.
// current is HTMLInputElement | null — null until the first commit.
const inputRef = useRef<HTMLInputElement>(null)
inputRef.current?.focus()        // optional-chain, don't reach for !

// A mutable instance variable. null IS in the type argument.
const timerRef = useRef<number | null>(null)
timerRef.current = window.setInterval(tick, 1000)   // you write this one`}</code>
        </pre>
        <div className="row">
          <input ref={inputRef} placeholder="typed DOM ref" />
          <button onClick={() => inputRef.current?.focus()}>focus via ref</button>
          <button
            onClick={() => {
              if (timerRef.current !== null) {
                clearInterval(timerRef.current)
                timerRef.current = null
              }
            }}
          >
            clear the (unused) timer ref
          </button>
        </div>
      </Panel>

      <Panel title="3. Context that is never undefined at the call site">
        <SettingsProvider>
          <div className="row">
            <DensityToggle />
          </div>
        </SettingsProvider>
        <pre style={{ marginTop: 10 }}>
          <code>{`const Ctx = createContext<Value | undefined>(undefined)   // not: {} as Value

function useSettings(): Value {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useSettings must be used within <SettingsProvider>')
  return ctx      // narrowed to Value — the throw is a type guard
}

// Do NOT export Ctx. The hook is the only way in, so the guard
// cannot be bypassed and the error message is always the good one.`}</code>
        </pre>
      </Panel>

      <Panel title="4. A typed reducer">
        <div className="row">
          <span className="big-num">{state.count}</span>
          <button onClick={() => dispatch({ type: 'increment' })}>+{state.step}</button>
          <button onClick={() => dispatch({ type: 'decrement' })}>−{state.step}</button>
          <button onClick={() => dispatch({ type: 'setStep', step: state.step === 1 ? 5 : 1 })}>
            step: {state.step}
          </button>
          <button onClick={() => dispatch({ type: 'reset' })}>reset</button>
          <button onClick={() => dispatch({ type: 'reset', to: 100 })}>reset to 100</button>
        </div>
        <pre style={{ marginTop: 10 }}>
          <code>{`type Action =
  | { type: 'increment' }
  | { type: 'setStep'; step: number }
  | { type: 'reset'; to?: number }

case 'setStep': return { ...state, step: action.step }   // ✅ action.step: number
case 'increment': return { ...state, count: action.step } // ❌ does not exist here`}</code>
        </pre>
      </Panel>

      <Panel title="5. satisfies, and the utility types">
        <pre>
          <code>{`// Annotation: checked, but WIDENED. keyof is plain string.
const a: Record<string, string> = { bg: '#0d1117', fg: '#e6edf3' }

// satisfies: checked, and NARROW. keyof is 'bg' | 'fg'.
const tokens = { bg: '#0d1117', fg: '#e6edf3' } satisfies Record<string, string>
type TokenName = keyof typeof tokens

// ── the ones you will actually use ──────────────────────────────────
Partial<T>                  // every prop optional — update payloads
Required<T>                 // the inverse
Pick<User, 'id' | 'name'>   // a subset
Omit<Props, 'size'>         // everything except — extending native props
Record<Status, string>      // a lookup map; a union key forces every case
Readonly<T>                 // freeze a shape
ReturnType<typeof fn>       // derive, don't re-declare — this is how
                            //   RootState = ReturnType<typeof store.getState>
Awaited<ReturnType<typeof fetchUser>>   // unwrap the promise
NonNullable<T>              // strip null | undefined
Parameters<typeof fn>       // when wrapping a function`}</code>
        </pre>
        <div className="row">
          {(Object.keys(tokens) as TokenName[]).map((k) => (
            <span key={k} className="badge">
              {k}: <span style={{ color: tokens[k] }}>{tokens[k]}</span>
            </span>
          ))}
        </div>
      </Panel>

      <Callout kind="tip">
        <b>The principle behind the utility types.</b> Derive types from one
        source instead of declaring the same shape twice. Two declarations
        always drift; a derived type cannot.
      </Callout>
    </div>
  )
}
