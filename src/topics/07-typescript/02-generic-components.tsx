import { useState } from 'react'
import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react'
import type { TopicMeta } from '../../types'
import { Callout, Panel } from '../../lib/ui'

export const meta = {
  title: 'Generic & polymorphic components',
  summary:
    'A typed list that works with any item shape, a component whose element you can change with an `as` prop, and the type machinery each needs.',
  notes: [
    '<b>A generic component is a function with a type parameter:</b> <code>function List&lt;T&gt;({ items }: { items: T[] })</code>. The caller never writes the type — TypeScript infers it from the props.',
    '<b>Constrain the parameter when you need a property:</b> <code>&lt;T extends { id: string }&gt;</code> lets you use <code>item.id</code> as a key.',
    '<b>Even better: take a <code>getKey</code> function</b> so the component does not dictate your data shape.',
    '<b>In a <code>.tsx</code> file, <code>&lt;T&gt;</code> in an arrow function is parsed as JSX.</b> Write <code>&lt;T,&gt;</code> or, more readably, use a <code>function</code> declaration.',
    '<b>Polymorphic components take an <code>as</code> prop</b> and accept the props of whatever element they render: <code>&lt;Text as="a" href="…" /&gt;</code>.',
    '<b>The polymorphic type is genuinely gnarly.</b> Know the shape, and know that in real projects you usually reach for a library or accept a small compromise.',
    '<b>Generics propagate through hooks too:</b> <code>useState&lt;T&gt;</code>, and your own <code>useFetch&lt;T&gt;(url): { data: T | undefined }</code>.',
    '<b>Do not over-genericise.</b> If a component only ever renders one shape, a concrete type is clearer.',
  ],
  questions: [
    {
      q: 'How do you write a generic React component?',
      a: 'Exactly like a generic function, because that is what a function component is:\n\n<code>function List&lt;T&gt;({ items, renderItem }: { items: T[]; renderItem: (item: T) =&gt; ReactNode }) { … }</code>\n\nThe caller writes <code>&lt;List items={users} renderItem={u =&gt; u.name} /&gt;</code> and TypeScript infers <code>T = User</code> from <code>items</code>, then type-checks <code>renderItem</code>\'s parameter against it. So <code>u.nmae</code> is a compile error inside the callback, which is the payoff.\n\nThe gotcha specific to React is syntax: in a <code>.tsx</code> file, <code>const List = &lt;T&gt;(props) =&gt; …</code> parses <code>&lt;T&gt;</code> as a JSX tag. Write <code>&lt;T,&gt;</code> with a trailing comma, or use a <code>function</code> declaration, which has no ambiguity and reads better anyway.',
    },
    {
      q: 'When do you constrain a generic, and when do you take a function instead?',
      a: 'Constrain when the component genuinely needs a property to do its job: <code>&lt;T extends { id: string }&gt;</code> if you use <code>item.id</code> as the key. The constraint documents the requirement and the error message when someone passes the wrong shape is reasonably clear.\n\nBut it also dictates the caller\'s data shape, which is a real cost. If their entities use <code>uuid</code> or <code>key</code> or a composite, they have to map their array just to satisfy your component.\n\nTaking a <code>getKey: (item: T) =&gt; string</code> prop instead keeps <code>T</code> unconstrained and pushes the decision to the caller, who knows their data. It is one more prop, and it is what the well-designed libraries do — TanStack Table, react-window and friends all take accessor functions rather than requiring a shape.',
    },
    {
      q: 'What is a polymorphic component?',
      a: 'One that lets the consumer choose the element it renders, through an <code>as</code> prop, while still type-checking the props of whatever they chose.\n\n<code>&lt;Text as="h1"&gt;Title&lt;/Text&gt;</code> renders an <code>h1</code>. <code>&lt;Text as="a" href="/about"&gt;</code> renders an anchor and requires <code>href</code> to be valid — and passing <code>href</code> with <code>as="h1"</code> is a compile error.\n\nThe reason it exists is that visual styling and semantic element are independent concerns. A design system\'s "large heading" style might be an <code>h1</code> on one page and an <code>h2</code> on another, for correct document outline. Forcing the element would either break accessibility or require a component per element.\n\nChakra, MUI and Radix all support it; Radix calls its version <code>asChild</code>, which merges props into the child you provide instead of taking an element name.',
    },
    {
      q: 'What makes typing a polymorphic component hard?',
      a: 'You need the props to depend on the value of another prop, which means a generic over <code>ElementType</code> plus some set subtraction.\n\nThe shape is roughly: <code>type Props&lt;C extends ElementType&gt; = { as?: C } &amp; OwnProps &amp; Omit&lt;ComponentPropsWithoutRef&lt;C&gt;, keyof OwnProps | "as"&gt;</code>.\n\nThe <code>Omit</code> matters: without it, your own <code>size</code> prop and the native <code>size</code> on <code>&lt;input&gt;</code> collide and TypeScript intersects them into something unusable, usually <code>never</code>.\n\nAdd ref forwarding and it gets worse, because the ref type also depends on <code>C</code> and generic components do not play nicely with <code>forwardRef</code> — the standard workaround is a cast on the wrapper.\n\nThe honest position for an interview: know the shape, know why each piece is there, and know that in production most teams either use a library\'s implementation or accept a slightly looser type rather than maintaining the full version.',
    },
  ],
} satisfies TopicMeta

/* ===========================================================================
   1. A generic list.

   Note the `function` declaration rather than an arrow. In a .tsx file,
   `const List = <T>(...)` parses `<T>` as JSX and fails. You can write `<T,>`
   with a trailing comma, but a function declaration avoids the question.
   =========================================================================== */

type ListProps<T> = {
  items: T[]
  /** Unconstrained T, because the caller tells us how to get a key. */
  getKey: (item: T) => string
  renderItem: (item: T, index: number) => ReactNode
  empty?: ReactNode
}

function List<T>({ items, getKey, renderItem, empty }: ListProps<T>) {
  if (items.length === 0) return <>{empty ?? <span className="muted">Nothing to show.</span>}</>
  return (
    <div className="col" style={{ gap: 4 }}>
      {items.map((item, i) => (
        <div key={getKey(item)}>{renderItem(item, i)}</div>
      ))}
    </div>
  )
}

/* The constrained alternative, for comparison. Simpler signature, but it
   dictates that every consumer's data has an `id: string`. */
function ConstrainedList<T extends { id: string }>({
  items,
  renderItem,
}: {
  items: T[]
  renderItem: (item: T) => ReactNode
}) {
  return (
    <div className="col" style={{ gap: 4 }}>
      {items.map((item) => (
        <div key={item.id}>{renderItem(item)}</div>
      ))}
    </div>
  )
}

/* ===========================================================================
   2. A polymorphic component.
   =========================================================================== */

type TextOwnProps = {
  weight?: 'normal' | 'bold'
  tone?: 'default' | 'muted' | 'accent'
  children: ReactNode
}

type TextProps<C extends ElementType> = {
  as?: C
} & TextOwnProps &
  // Take every prop of the chosen element, MINUS the ones we define ourselves
  // and minus `as`. Without this Omit, our `weight` would intersect with any
  // native `weight` and the result is usually unusable.
  Omit<ComponentPropsWithoutRef<C>, keyof TextOwnProps | 'as'>

function Text<C extends ElementType = 'span'>({
  as,
  weight = 'normal',
  tone = 'default',
  children,
  ...rest
}: TextProps<C>) {
  // Capitalised so JSX treats it as a component reference, not a literal tag.
  const Component = as ?? 'span'
  return (
    <Component
      {...rest}
      style={{
        fontWeight: weight === 'bold' ? 600 : 400,
        color:
          tone === 'muted'
            ? 'var(--text-faint)'
            : tone === 'accent'
              ? 'var(--accent)'
              : 'var(--text)',
        ...(rest as { style?: React.CSSProperties }).style,
      }}
    >
      {children}
    </Component>
  )
}

/* ===========================================================================
   3. A generic hook — generics are not only for components.
   =========================================================================== */

function useSelection<T>(items: T[], getKey: (item: T) => string) {
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())

  const toggle = (item: T) => {
    const key = getKey(item)
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      // Sets are mutable, so we must copy before mutating — otherwise the
      // reference is unchanged and React skips the render.
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const selected = items.filter((i) => selectedKeys.has(getKey(i)))
  return { selected, toggle, isSelected: (i: T) => selectedKeys.has(getKey(i)) }
}

/* --- Two completely different data shapes, one component ------------------ */

type User = { userId: string; name: string; email: string }
type Repo = { id: string; fullName: string; stars: number }

const USERS: User[] = [
  { userId: 'u1', name: 'Ada Lovelace', email: 'ada@example.com' },
  { userId: 'u2', name: 'Grace Hopper', email: 'grace@example.com' },
]

const REPOS: Repo[] = [
  { id: 'r1', fullName: 'facebook/react', stars: 228000 },
  { id: 'r2', fullName: 'vitejs/vite', stars: 68000 },
]

export default function Demo() {
  const userSel = useSelection(USERS, (u) => u.userId)

  return (
    <div className="stack">
      <Panel title="1. One generic list, two unrelated shapes">
        <div className="grid2">
          <div>
            <div className="panel-title">
              items: User[] · key: <code>userId</code>
            </div>
            {/* T is inferred as User. Inside renderItem, `u` is a User and
                `u.nmae` would be a compile error. */}
            <List
              items={USERS}
              getKey={(u) => u.userId}
              renderItem={(u) => (
                <button
                  onClick={() => userSel.toggle(u)}
                  style={{ width: '100%', textAlign: 'left' }}
                  className={userSel.isSelected(u) ? 'primary' : ''}
                >
                  {u.name} — {u.email}
                </button>
              )}
            />
            <div className="row" style={{ marginTop: 8 }}>
              <span className="badge">{userSel.selected.length} selected</span>
            </div>
          </div>

          <div>
            <div className="panel-title">
              items: Repo[] · key: <code>id</code>
            </div>
            {/* Same component. T is now Repo. */}
            <List
              items={REPOS}
              getKey={(r) => r.id}
              renderItem={(r) => (
                <span className="mono" style={{ fontSize: 13 }}>
                  {r.fullName} ★{(r.stars / 1000).toFixed(0)}k
                </span>
              )}
            />
            <div style={{ marginTop: 8 }}>
              {/* The constrained version — works because Repo has `id`.
                  Passing USERS here would be a compile error, because User
                  has `userId`, not `id`. */}
              <ConstrainedList items={REPOS} renderItem={(r) => <span className="muted" style={{ fontSize: 12 }}>constrained: {r.fullName}</span>} />
            </div>
          </div>
        </div>
      </Panel>

      <Panel title="2. Polymorphic: the same styling, different elements">
        <div className="col" style={{ gap: 6 }}>
          <Text as="h3" weight="bold" style={{ margin: 0 }}>
            as=&quot;h3&quot; — a real heading, for document outline
          </Text>
          <Text as="a" href="https://react.dev" target="_blank" rel="noreferrer" tone="accent">
            as=&quot;a&quot; — href is required and type-checked
          </Text>
          <Text tone="muted">no `as` — defaults to a span</Text>
          <Text as="label" htmlFor="poly-demo" tone="muted">
            as=&quot;label&quot; — htmlFor is valid here and nowhere else
          </Text>
          <input id="poly-demo" placeholder="labelled by the line above" />
        </div>
      </Panel>

      <Panel title="The syntax gotcha, and the polymorphic type">
        <pre>
          <code>{`// ❌ In a .tsx file, <T> parses as a JSX tag.
const List = <T>(props: ListProps<T>) => { … }
//            ^ "JSX element 'T' has no corresponding closing tag"

// ✅ Trailing comma disambiguates…
const List = <T,>(props: ListProps<T>) => { … }

// ✅ …or just use a function declaration. Clearer anyway.
function List<T>(props: ListProps<T>) { … }


// The polymorphic type, piece by piece:
type TextProps<C extends ElementType> =
  { as?: C }                                     // the element to render
  & TextOwnProps                                 // our own props
  & Omit<
      ComponentPropsWithoutRef<C>,               // every prop of that element
      keyof TextOwnProps | 'as'                  // minus the ones we define
    >
//   ^ this Omit is not optional: without it our 'weight' intersects with a
//     native 'weight' and the result is usually 'never'.`}</code>
        </pre>
      </Panel>

      <Callout kind="tip">
        <b>The judgement to voice.</b> Generic components are genuinely useful —
        a typed list or table pays for itself immediately. Fully typed
        polymorphic components with ref forwarding are a different matter: know
        the shape for the interview, and in production reach for a library&rsquo;s
        implementation rather than maintaining your own.
      </Callout>
    </div>
  )
}
