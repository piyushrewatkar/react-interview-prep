import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { TopicMeta } from '../../types'
import { Callout, Panel } from '../../lib/ui'

export const meta = {
  title: 'Controlled vs uncontrolled components',
  summary:
    'Who owns the input value — React or the DOM — and the three warnings you get when you accidentally switch between them.',
  notes: [
    '<b>Controlled:</b> you pass <code>value</code> and <code>onChange</code>. React state is the single source of truth; the DOM node is a mirror of it. Every keystroke is a render.',
    '<b>Uncontrolled:</b> you pass nothing (or <code>defaultValue</code>) and read the value from a ref, or from the form, when you need it. The DOM owns the value; React never re-renders while typing.',
    '<b><code>value={undefined}</code> then <code>value="x"</code> is the classic bug.</b> React warns “A component is changing an uncontrolled input to be controlled”. Fix it by initialising state to <code>""</code>, never <code>undefined</code> or <code>null</code>.',
    '<b><code>value</code> without <code>onChange</code> makes the field read-only</b> and React warns. Use <code>defaultValue</code> if you meant uncontrolled, or add <code>readOnly</code> if you meant it.',
    '<b>Prefer controlled when the value drives the UI</b> — live validation, formatting as you type, disabling a submit button, syncing two fields. Prefer uncontrolled when it does not: a big form you only read on submit, a file input (which <i>must</i> be uncontrolled), or an integration with a non-React widget.',
    '<b><code>&lt;input type="file"&gt;</code> is always uncontrolled.</b> Its value is read-only for security reasons — you cannot set it from JavaScript.',
    '<b>Select and textarea differ from HTML.</b> React uses <code>value</code> on <code>&lt;select&gt;</code> and <code>&lt;textarea&gt;</code> rather than <code>selected</code> on options or a text child.',
  ],
  questions: [
    {
      q: 'What is the difference between a controlled and an uncontrolled component?',
      a: 'It is about where the value lives. In a controlled component, React state is the source of truth: you render <code>value={state}</code> and update the state in <code>onChange</code>, so the DOM can never hold anything React did not put there. In an uncontrolled component, the DOM node holds the value and React only reads it when asked — typically through a ref, or from <code>FormData</code> on submit.\n\nThe trade-off is re-renders versus control. Controlled inputs re-render the component on every keystroke, which buys you the ability to validate, format, mask or mirror the value as it is typed. Uncontrolled inputs cost nothing while typing but you cannot react to the value until you go and fetch it.',
    },
    {
      q: 'You are seeing "A component is changing an uncontrolled input to be controlled". What causes it?',
      a: 'The <code>value</code> prop went from <code>undefined</code> (or <code>null</code>) to a defined string. React decides controlled-ness per input on first render based on whether <code>value</code> is defined, so flipping it mid-life is ambiguous and it warns.\n\nAlmost always the cause is state initialised as <code>useState()</code> with no argument, or state hydrated from an API response that starts out undefined — <code>value={user?.email}</code> is undefined until the fetch resolves.\n\nThe fix is to guarantee a defined value from the very first render: <code>useState("")</code>, or <code>value={user?.email ?? ""}</code>. Never let a controlled input see <code>undefined</code>.',
    },
    {
      q: 'When would you deliberately choose an uncontrolled input?',
      a: 'When nothing in the UI depends on the value until submit. A twenty-field settings form that only validates on save re-renders twenty times per keystroke if fully controlled, for no benefit — uncontrolled inputs plus a single <code>FormData</code> read on submit is simpler and faster.\n\nAlso when you have no choice: <code>&lt;input type="file"&gt;</code> cannot be controlled because its value is read-only in the browser for security reasons. And when integrating a third-party widget (a date picker, a rich-text editor) that manages its own DOM, fighting it with a controlled value usually loses.\n\nThis is the model React Hook Form is built on, and it is a large part of why it outperforms controlled-form libraries.',
    },
    {
      q: 'How do you make a reusable input that supports both modes?',
      a: 'The standard pattern is to accept an optional <code>value</code> and an optional <code>defaultValue</code>, and derive the mode from whether <code>value</code> was supplied — <code>const isControlled = value !== undefined</code>. Keep internal state for the uncontrolled case, and render <code>isControlled ? value : internal</code>. In the change handler, always call the consumer\'s <code>onChange</code>, and only set internal state when uncontrolled.\n\nThe important detail is that the mode must be decided once, not per render: capture <code>isControlled</code> from the first render in a ref and warn in development if it ever flips, which is exactly what React\'s own DOM inputs and every serious component library do.',
    },
    {
      q: 'Why does React use `value` on select and textarea instead of the HTML attributes?',
      a: 'For consistency. In plain HTML you mark a <code>&lt;select&gt;</code>\'s choice by putting <code>selected</code> on one of its <code>&lt;option&gt;</code> children, and a <code>&lt;textarea&gt;</code>\'s content is its text child. Both would force you into a different pattern for each form control.\n\nReact normalises all of them onto a single <code>value</code>/<code>onChange</code> pair, so one mental model and one generic <code>Field</code> component covers text inputs, selects, textareas and multi-selects (where <code>value</code> is an array). The cost is that the JSX does not look like the HTML, which trips people up once and then never again.',
    },
  ],
} satisfies TopicMeta

export default function Demo() {
  // --- Controlled -----------------------------------------------------------
  // Initialised to "" and not undefined. This is the whole fix for the
  // "uncontrolled -> controlled" warning.
  const [email, setEmail] = useState('')
  const [renders, setRenders] = useState(0)

  // --- Uncontrolled ---------------------------------------------------------
  // React never sees a keystroke here. The DOM node holds the value; we reach
  // for it only at submit time.
  const nameRef = useRef<HTMLInputElement>(null)
  const [readBack, setReadBack] = useState<string | null>(null)

  // --- Uncontrolled via FormData -------------------------------------------
  // No refs at all. The `name` attribute is the API. This is what the platform
  // has always done, and what React 19's form actions lean on.
  const [formResult, setFormResult] = useState<string | null>(null)
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    setFormResult(JSON.stringify(Object.fromEntries(data), null, 2))
  }

  const emailValid = email.includes('@') && email.includes('.')

  return (
    <div className="stack">
      <div className="grid2">
        <Panel title="Controlled — React owns the value">
          <div className="col">
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setRenders((r) => r + 1)
              }}
            />
            {/* This is what controlled buys you: the UI can respond to the
                value *while it is being typed*. Impossible uncontrolled. */}
            <div className="row">
              <span className={`badge ${email === '' ? '' : emailValid ? 'good' : 'bad'}`}>
                {email === '' ? 'empty' : emailValid ? 'looks valid' : 'not an email yet'}
              </span>
              <span className="badge">{email.length}/40 chars</span>
              <span className="badge warn">{renders} keystroke renders</span>
            </div>
            <button className="primary" disabled={!emailValid}>
              Submit (disabled until valid)
            </button>
          </div>
        </Panel>

        <Panel title="Uncontrolled — the DOM owns the value">
          <div className="col">
            <input type="text" placeholder="type freely…" defaultValue="" ref={nameRef} />
            <div className="row">
              <span className="badge good">0 renders while typing</span>
            </div>
            <button onClick={() => setReadBack(nameRef.current?.value ?? '')}>
              Read the value now
            </button>
            <div className="mono" style={{ fontSize: 13, color: 'var(--text-dim)' }}>
              {readBack === null ? 'not read yet' : `ref.current.value === "${readBack}"`}
            </div>
          </div>
        </Panel>
      </div>

      <Panel title="Uncontrolled without refs: FormData">
        <form onSubmit={onSubmit} className="col">
          <div className="row">
            {/* The `name` attribute is what FormData keys off. No state, no
                refs, no onChange — and it works with browser autofill. */}
            <input name="firstName" placeholder="first name" defaultValue="Ada" />
            <input name="lastName" placeholder="last name" defaultValue="Lovelace" />
            <select name="role" defaultValue="eng">
              {/* React uses `value` on the select, not `selected` on the option. */}
              <option value="eng">Engineer</option>
              <option value="pm">PM</option>
              <option value="design">Design</option>
            </select>
            <button className="primary" type="submit">
              Submit
            </button>
          </div>
        </form>
        {formResult && (
          <pre style={{ marginTop: 10 }}>
            <code>{formResult}</code>
          </pre>
        )}
      </Panel>

      <Callout kind="trap">
        <b>The warning you will be asked about.</b>{' '}
        <code>useState()</code> with no argument gives <code>undefined</code>, so
        the input mounts uncontrolled. The first keystroke sets a string, and
        React complains that the input changed mode. Initialise to{' '}
        <code>""</code> — or, when the value comes from an API,{' '}
        <code>value={'{'}data?.email ?? ""{'}'}</code>.
      </Callout>
    </div>
  )
}
