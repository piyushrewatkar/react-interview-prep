import { useState } from 'react'
import type { ButtonHTMLAttributes, ChangeEvent, FormEvent, MouseEvent, ReactNode } from 'react'
import type { TopicMeta } from '../../types'
import { Callout, Panel } from '../../lib/ui'

export const meta = {
  title: 'Typing props, children & events',
  summary:
    'The everyday TypeScript in a React codebase: prop types, the children types and when each is right, event handler types, and extending native element props.',
  notes: [
    '<b>Prefer a plain <code>type</code> or <code>interface</code> for props</b> over <code>React.FC</code>. <code>React.FC</code> used to add an implicit <code>children</code>, which was removed in React 18&rsquo;s types precisely because it lied about components that take none.',
    '<b><code>ReactNode</code> is the right type for <code>children</code></b> in almost every case: it covers elements, strings, numbers, arrays, fragments, <code>null</code> and <code>undefined</code>.',
    '<b><code>ReactElement</code> is narrower</b> — exactly one element. Use it when a string child would break your component.',
    '<b>Event handler types come from the element:</b> <code>MouseEvent&lt;HTMLButtonElement&gt;</code>, <code>ChangeEvent&lt;HTMLInputElement&gt;</code>, <code>FormEvent&lt;HTMLFormElement&gt;</code>, <code>KeyboardEvent&lt;HTMLInputElement&gt;</code>.',
    '<b>Let inference do the work.</b> An inline <code>onClick={(e) =&gt; …}</code> already knows <code>e</code>&rsquo;s type from the JSX. You only annotate when the handler is defined separately.',
    '<b>Extend native props with <code>ComponentPropsWithoutRef&lt;"button"&gt;</code></b> so your wrapper accepts <code>disabled</code>, <code>aria-*</code>, <code>type</code> and everything else. Use the <code>WithRef</code> variant when you forward a ref.',
    '<b>Union types beat booleans for variants.</b> <code>variant: "primary" | "ghost"</code> makes invalid combinations unrepresentable, where <code>isPrimary</code> + <code>isGhost</code> allows both at once.',
    '<b>Do not type <code>style</code> as <code>any</code></b> — <code>CSSProperties</code> exists and catches typos.',
  ],
  questions: [
    {
      q: 'Why should you avoid React.FC?',
      a: 'Its main historical problem was that it added an implicit <code>children?: ReactNode</code> to every component, so a component that accepted no children still type-checked when you passed some. React 18\'s type definitions removed that, which was a breaking change for a lot of codebases and is a good illustration of why the implicit behaviour was wrong.\n\nWhat remains is that it buys you very little — an implicit return type you almost never need — while making generic components awkward to write, since you have to move the type parameter around the <code>FC</code> wrapper.\n\nThe plain form is simpler and more honest:\n\n<code>function Button({ label, onClick }: ButtonProps) { … }</code>\n\nYou declare <code>children</code> when you take children, and you do not when you do not.',
    },
    {
      q: 'What is the difference between ReactNode, ReactElement and JSX.Element?',
      a: '<code>ReactNode</code> is the widest: anything React can render. Elements, strings, numbers, booleans, <code>null</code>, <code>undefined</code>, arrays of any of those, portals. This is what <code>children</code> should almost always be, because JSX genuinely produces all of them — <code>{cond && &lt;X /&gt;}</code> is <code>false | Element</code>.\n\n<code>ReactElement</code> is one element object specifically — the thing <code>createElement</code> returns. Use it when a bare string child would break your component, for example a wrapper that clones its child to inject props.\n\n<code>JSX.Element</code> is essentially <code>ReactElement&lt;any, any&gt;</code>, kept for historical reasons and inherited from the global JSX namespace. For a function component\'s return type, all three work and you usually annotate none of them — inference is fine.\n\nThe practical rule: <code>ReactNode</code> for props you accept, no annotation for what you return.',
    },
    {
      q: 'How do you type an event handler?',
      a: 'With React\'s synthetic event types, parameterised by the element: <code>MouseEvent&lt;HTMLButtonElement&gt;</code>, <code>ChangeEvent&lt;HTMLInputElement&gt;</code>, <code>FormEvent&lt;HTMLFormElement&gt;</code>. Import them from <code>react</code> — they are <i>not</i> the DOM globals of the same names, which is a classic confusing error when you forget the import.\n\nMost of the time you should not annotate at all. Writing <code>onChange={(e) =&gt; setValue(e.target.value)}</code> inline gives you a fully typed <code>e</code> by contextual inference from the JSX attribute.\n\nYou annotate when the handler is defined separately from its use site, since there is no context to infer from there.\n\nOne detail worth knowing: <code>e.target</code> is typed as the generic <code>EventTarget</code> in some handlers, while <code>e.currentTarget</code> is typed as the element the handler is attached to. For form submits, <code>e.currentTarget</code> is what you want in order to get <code>HTMLFormElement</code>.',
    },
    {
      q: 'How do you make a wrapper component accept all the native props of the element it renders?',
      a: 'Extend <code>ComponentPropsWithoutRef</code> for that element:\n\n<code>type ButtonProps = { variant?: "primary" | "ghost" } &amp; ComponentPropsWithoutRef&lt;"button"&gt;</code>\n\nNow your button accepts <code>disabled</code>, <code>type</code>, <code>onClick</code>, every <code>aria-*</code> attribute and every data attribute, correctly typed, without you enumerating them. Spread the rest onto the element.\n\nUse <code>ComponentPropsWithRef</code> when the component forwards a ref, so <code>ref</code> is typed too.\n\nIf you need to override a native prop — say your <code>size</code> means something different from the native <code>size</code> — use <code>Omit</code>: <code>Omit&lt;ComponentPropsWithoutRef&lt;"input"&gt;, "size"&gt; &amp; { size: "sm" | "lg" }</code>.\n\nSkipping this is the most common reason design-system components end up with a growing list of "can you also pass through <code>aria-label</code>" requests.',
    },
    {
      q: 'Why prefer a union over boolean props for variants?',
      a: 'Because booleans allow combinations that make no sense. <code>isPrimary</code>, <code>isSecondary</code> and <code>isDanger</code> gives you eight states, five of which are contradictions your component then has to resolve arbitrarily — and whichever <code>if</code> comes first silently wins.\n\n<code>variant: "primary" | "secondary" | "danger"</code> has exactly three states, all valid. The compiler rejects the contradictions instead of your component guessing, you get autocomplete at the call site, and a <code>switch</code> over it can be exhaustiveness-checked so adding a fourth variant produces a compile error everywhere it needs handling.\n\nThe same argument scales up: it is the single-prop version of the discriminated-union technique that makes impossible states unrepresentable, which is the next topic.',
    },
  ],
} satisfies TopicMeta

/* ===========================================================================
   A properly typed button. This is the shape every design system converges on.
   =========================================================================== */

type ButtonProps = {
  /** A union, not three booleans — invalid combinations cannot be expressed. */
  variant?: 'primary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
  children: ReactNode
} & ButtonHTMLAttributes<HTMLButtonElement>
// ^ `ButtonHTMLAttributes<HTMLButtonElement>` (or ComponentPropsWithoutRef<'button'>)
//   brings in disabled, type, onClick, every aria-* and every data-*.
//   Without it, consumers cannot pass `aria-label` and you will get a ticket.

function Button({ variant = 'primary', size = 'md', children, ...rest }: ButtonProps) {
  return (
    // `...rest` is fully typed. A typo like `onCLick` is a compile error.
    <button
      {...rest}
      className={variant === 'primary' ? 'primary' : variant === 'danger' ? 'danger' : ''}
      style={{ padding: size === 'sm' ? '3px 9px' : undefined, ...rest.style }}
    >
      {children}
    </button>
  )
}

export default function Demo() {
  const [value, setValue] = useState('')
  const [log, setLog] = useState<string[]>([])

  const push = (s: string) => setLog((l) => [...l, s].slice(-5))

  // ANNOTATED because the handler is defined separately from its use site,
  // so there is no JSX context to infer from.
  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    push(`click on <${e.currentTarget.tagName.toLowerCase()}> at ${e.clientX},${e.clientY}`)
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value)
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    // `currentTarget` is typed as HTMLFormElement — which is what makes this
    // line compile. `e.target` would be the wider EventTarget.
    const data = new FormData(e.currentTarget)
    push(`submitted: ${JSON.stringify(Object.fromEntries(data))}`)
  }

  return (
    <div className="stack">
      <Panel title="A typed button that accepts every native prop">
        <form onSubmit={handleSubmit} className="col">
          <div className="row">
            <input name="q" value={value} onChange={handleChange} placeholder="typed input" />
            {/* Inline handler: `e` is inferred, no annotation needed. */}
            <input
              name="inline"
              placeholder="inferred handler"
              onChange={(e) => push(`inline: e is ChangeEvent<HTMLInputElement>, value "${e.target.value}"`)}
            />
          </div>
          <div className="row">
            <Button onClick={handleClick}>primary</Button>
            <Button variant="ghost" size="sm" onClick={handleClick}>
              ghost sm
            </Button>
            <Button variant="danger" disabled aria-label="disabled danger button">
              danger (disabled)
            </Button>
            <Button type="submit">submit</Button>
          </div>
        </form>
        <pre className="log" style={{ marginTop: 12 }}>
          {log.length === 0 ? 'Click or type above.' : log.join('\n')}
        </pre>
      </Panel>

      <Panel title="Props: the patterns worth memorising">
        <pre>
          <code>{`// ✅ Plain type. No React.FC.
type CardProps = {
  title: string
  children: ReactNode              // widest — covers strings, arrays, null…
  footer?: ReactNode               // optional slot
  onDismiss?: () => void
  variant?: 'info' | 'warning'     // union, not booleans
}
function Card({ title, children, footer, onDismiss, variant = 'info' }: CardProps) {}

// ✅ Extend a native element so every aria-*, data-* and native prop works.
import type { ComponentPropsWithoutRef } from 'react'
type InputProps = { label: string } & ComponentPropsWithoutRef<'input'>

// ✅ Override a native prop you need to redefine.
type SizedInput =
  Omit<ComponentPropsWithoutRef<'input'>, 'size'> & { size: 'sm' | 'lg' }

// ✅ Forwarding a ref (React 19: ref is just a prop).
type FieldProps = ComponentPropsWithRef<'input'> & { label: string }
function Field({ label, ref, ...rest }: FieldProps) {
  return <><label>{label}</label><input ref={ref} {...rest} /></>
}`}</code>
        </pre>
      </Panel>

      <Panel title="Event types: the cheat sheet">
        <table className="data">
          <thead>
            <tr>
              <th>Handler</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="mono">onClick</td>
              <td className="mono">MouseEvent&lt;HTMLButtonElement&gt;</td>
            </tr>
            <tr>
              <td className="mono">onChange (input)</td>
              <td className="mono">ChangeEvent&lt;HTMLInputElement&gt;</td>
            </tr>
            <tr>
              <td className="mono">onChange (select)</td>
              <td className="mono">ChangeEvent&lt;HTMLSelectElement&gt;</td>
            </tr>
            <tr>
              <td className="mono">onSubmit</td>
              <td className="mono">FormEvent&lt;HTMLFormElement&gt;</td>
            </tr>
            <tr>
              <td className="mono">onKeyDown</td>
              <td className="mono">KeyboardEvent&lt;HTMLInputElement&gt;</td>
            </tr>
            <tr>
              <td className="mono">onFocus / onBlur</td>
              <td className="mono">FocusEvent&lt;HTMLInputElement&gt;</td>
            </tr>
            <tr>
              <td className="mono">onDrop</td>
              <td className="mono">DragEvent&lt;HTMLDivElement&gt;</td>
            </tr>
            <tr>
              <td className="mono">any handler, as a prop</td>
              <td className="mono">MouseEventHandler&lt;HTMLButtonElement&gt;</td>
            </tr>
          </tbody>
        </table>
        <Callout kind="trap">
          These come from <code>react</code>, not from the DOM lib. Forgetting{' '}
          <code>import type {'{'} MouseEvent {'}'} from &apos;react&apos;</code>{' '}
          silently picks up the global DOM <code>MouseEvent</code>, which is not
          generic — producing a confusing &ldquo;Type MouseEvent is not
          generic&rdquo; error.
        </Callout>
      </Panel>
    </div>
  )
}
