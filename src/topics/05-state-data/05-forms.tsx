import { useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { TopicMeta } from '../../types'
import { Callout, Panel, RenderBadge, sleep } from '../../lib/ui'

export const meta = {
  title: 'Forms & validation',
  summary:
    'Controlled forms, uncontrolled forms, the touched/dirty/error model every form library implements, and why a twenty-field controlled form is slow.',
  notes: [
    '<b>Three pieces of state per field, not one:</b> the <i>value</i>, whether it has been <i>touched</i> (blurred at least once), and its <i>error</i>. Showing errors before a field is touched is the single most common form UX mistake.',
    '<b>Validate on change after the first blur.</b> Validating on every keystroke from the start shouts at users while they type; validating only on submit hides problems until too late.',
    '<b>Controlled forms re-render the whole form on every keystroke.</b> Fine for five fields, noticeable at twenty, bad at fifty with per-field validation.',
    '<b>Uncontrolled forms are why React Hook Form is fast</b> — values live in the DOM, the form component barely re-renders, and it reads everything at submit.',
    '<b>Derive validity; do not store it.</b> <code>isValid</code> is a function of values, not a fourth piece of state to keep in sync.',
    '<b>Disable submit on <i>submitting</i>, not on <i>invalid</i>.</b> A permanently disabled button with no explanation is an accessibility problem; let them submit and show the errors.',
    '<b>Server errors need a home in the same model</b> — a field-level error keyed by name plus a form-level error for everything else.',
    '<b>Accessibility:</b> <code>&lt;label htmlFor&gt;</code> on every field, <code>aria-invalid</code>, <code>aria-describedby</code> pointing at the error, and a live region or focus move on submit failure.',
  ],
  questions: [
    {
      q: 'How do you decide between a controlled and an uncontrolled form?',
      a: 'By whether anything needs to react to the value as it is typed.\n\nControlled when the UI depends on the current value: live validation messages, a character counter, formatting or masking as you type, one field enabling another, a preview pane. You need the value in React state for any of that.\n\nUncontrolled when you only care at submit. A long settings form that validates on save re-renders on every keystroke for no benefit if controlled; with <code>defaultValue</code> and a single <code>FormData</code> read you get the same result with essentially zero render cost.\n\nIn practice most real forms are mixed: a couple of fields controlled because they drive the UI, the rest uncontrolled. And for anything non-trivial I would use React Hook Form, which is uncontrolled by default and subscribes only the fields that need to re-render.',
    },
    {
      q: 'Why is React Hook Form faster than a controlled form?',
      a: 'Because it keeps values in the DOM rather than in React state. It registers each input with a ref and reads from the DOM node, so typing does not call <code>setState</code> and the form component does not re-render.\n\nIn a controlled form, one <code>useState</code> per field plus one <code>onChange</code> per keystroke means every keystroke re-renders the form component and therefore every field in it. At twenty fields with validation running on each render, that is measurable.\n\nRHF also scopes subscriptions: a component that watches one field with <code>useWatch</code> re-renders only when that field changes, rather than the whole form. And errors are subscribed per field, so an error on field three does not re-render fields one through twenty.\n\nThe trade-off is that it is less obvious what is happening — the values are not visible in React state — and integrating a fully controlled third-party component needs the <code>&lt;Controller&gt;</code> wrapper.',
    },
    {
      q: 'When should a validation error be shown to the user?',
      a: 'After the field has been touched, and then live.\n\nConcretely: do not validate a field until it has been blurred at least once. Once it has, validate on every change so the error clears as soon as they fix it. And validate everything on submit regardless, because a user can submit without ever focusing a field.\n\nThat is why every form library tracks <code>touched</code> separately from <code>errors</code> — the error may exist from the first render, but you do not <i>show</i> it until <code>touched</code> is true.\n\nThe failure modes either side are both common: showing "email is required" the instant the form mounts, which is hostile; or only validating on submit, which makes the user fix problems one round trip at a time.',
    },
    {
      q: 'How would you handle server-side validation errors?',
      a: 'Fold them into the same error model the client-side rules use, so the rendering does not need to know where an error came from.\n\nThe API should return field-keyed errors — <code>{ errors: { email: "Already registered" } }</code> — which you merge into the form\'s <code>errors</code> object. Anything that is not field-specific goes into a form-level error rendered at the top.\n\nTwo details that matter. First, the server error must clear when the user edits that field, otherwise it sticks around after they have fixed it. Second, on a failed submit, move focus to the first invalid field — or at minimum announce the error summary in a live region — because otherwise a screen reader user gets no indication that anything happened.\n\nAnd the general principle: client-side validation is a UX affordance, never a security control. The server validates regardless.',
    },
    {
      q: 'What accessibility requirements does a form have?',
      a: 'Every input needs a real <code>&lt;label&gt;</code> associated by <code>htmlFor</code>/<code>id</code> — a placeholder is not a label, it disappears on focus and many screen readers ignore it.\n\nInvalid fields get <code>aria-invalid="true"</code> and <code>aria-describedby</code> pointing at the id of their error message, so the error is announced when the field receives focus. Hint text goes in <code>aria-describedby</code> too.\n\nRequired fields get the <code>required</code> attribute, which is announced, rather than just an asterisk.\n\nOn submit failure, move focus to the first invalid field, or render a summary in a <code>role="alert"</code> region. Without that, a keyboard or screen reader user presses submit and nothing appears to happen.\n\nAnd use a real <code>&lt;form&gt;</code> with a <code>&lt;button type="submit"&gt;</code>, so Enter submits and browser autofill works.',
    },
  ],
} satisfies TopicMeta

/* ===========================================================================
   A controlled form with the full touched/dirty/error model.
   =========================================================================== */

type Values = { name: string; email: string; password: string }
type Errors = Partial<Record<keyof Values, string>>

const EMPTY: Values = { name: '', email: '', password: '' }

/** Pure function of the values. Trivially unit-testable — no React involved. */
function validate(values: Values): Errors {
  const errors: Errors = {}
  if (!values.name.trim()) errors.name = 'Name is required.'
  if (!values.email) errors.email = 'Email is required.'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email))
    errors.email = 'That does not look like an email address.'
  if (values.password.length < 8) errors.password = 'Use at least 8 characters.'
  return errors
}

function Field({
  name,
  label,
  type = 'text',
  value,
  error,
  touched,
  onChange,
  onBlur,
}: {
  name: keyof Values
  label: string
  type?: string
  value: string
  error?: string
  touched: boolean
  onChange: (v: string) => void
  onBlur: () => void
}) {
  // The error EXISTS from the first render, but we only SHOW it once the user
  // has blurred the field. That one condition is the difference between a form
  // that feels helpful and one that feels accusatory.
  const showError = touched && !!error
  const errorId = `${name}-error`

  return (
    <div className="col" style={{ gap: 4 }}>
      {/* A real label, associated by htmlFor. Not a placeholder. */}
      <label htmlFor={name} style={{ fontSize: 12, color: 'var(--text-faint)' }}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        aria-invalid={showError}
        // Points the screen reader at the error text when the field is focused.
        aria-describedby={showError ? errorId : undefined}
        style={{ borderColor: showError ? 'var(--bad)' : undefined }}
      />
      {showError && (
        <span id={errorId} style={{ fontSize: 12, color: 'var(--bad)' }}>
          {error}
        </span>
      )}
    </div>
  )
}

function ControlledForm() {
  const [values, setValues] = useState<Values>(EMPTY)
  const [touched, setTouched] = useState<Partial<Record<keyof Values, boolean>>>({})
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done'>('idle')
  const [serverError, setServerError] = useState<Errors>({})

  // DERIVED, not stored. Keeping `errors` in state and syncing it with an
  // effect is the classic mistake — it is one render stale, always.
  const errors = useMemo(() => {
    const client = validate(values)
    return { ...client, ...serverError }
  }, [values, serverError])

  const isValid = Object.keys(errors).length === 0
  const isDirty = JSON.stringify(values) !== JSON.stringify(EMPTY)

  const setField = (name: keyof Values) => (v: string) => {
    setValues((prev) => ({ ...prev, [name]: v }))
    // A server error must clear as soon as the user edits that field,
    // otherwise it lingers after they have fixed the problem.
    setServerError((prev) => (prev[name] ? { ...prev, [name]: undefined } : prev))
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    // Touch everything, so errors for fields the user never focused appear.
    setTouched({ name: true, email: true, password: true })
    if (!isValid) return

    setStatus('submitting')
    await sleep(700)

    // Pretend the server rejects this one.
    if (values.email.endsWith('@example.com')) {
      setServerError({ email: 'That address is already registered.' })
      setStatus('idle')
      return
    }
    setStatus('done')
  }

  if (status === 'done') {
    return (
      <div className="col">
        <div className="callout tip">Submitted. Welcome, {values.name}.</div>
        <button
          onClick={() => {
            setValues(EMPTY)
            setTouched({})
            setStatus('idle')
          }}
        >
          reset
        </button>
      </div>
    )
  }

  return (
    <form className="col" onSubmit={onSubmit} noValidate>
      <Field
        name="name"
        label="Full name"
        value={values.name}
        error={errors.name}
        touched={!!touched.name}
        onChange={setField('name')}
        onBlur={() => setTouched((t) => ({ ...t, name: true }))}
      />
      <Field
        name="email"
        label="Email (try anything@example.com for a server error)"
        type="email"
        value={values.email}
        error={errors.email}
        touched={!!touched.email}
        onChange={setField('email')}
        onBlur={() => setTouched((t) => ({ ...t, email: true }))}
      />
      <Field
        name="password"
        label="Password"
        type="password"
        value={values.password}
        error={errors.password}
        touched={!!touched.password}
        onChange={setField('password')}
        onBlur={() => setTouched((t) => ({ ...t, password: true }))}
      />

      <div className="row">
        {/* Disabled on SUBMITTING, not on INVALID. A permanently disabled
            button with no explanation is an accessibility failure. */}
        <button className="primary" type="submit" disabled={status === 'submitting'}>
          {status === 'submitting' ? 'submitting…' : 'Sign up'}
        </button>
        <RenderBadge label="form" />
        <span className={`badge ${isValid ? 'good' : ''}`}>{isValid ? 'valid' : 'invalid'}</span>
        <span className="badge">{isDirty ? 'dirty' : 'pristine'}</span>
      </div>
    </form>
  )
}

/* ===========================================================================
   The uncontrolled equivalent. Watch the render counter stay at zero.
   =========================================================================== */

function UncontrolledForm() {
  const [result, setResult] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  return (
    <form
      ref={formRef}
      className="col"
      onSubmit={(e) => {
        e.preventDefault()
        // The whole form, read in one line, keyed by the `name` attributes.
        const data = Object.fromEntries(new FormData(e.currentTarget))
        const errors = validate(data as unknown as Values)
        setResult(
          Object.keys(errors).length
            ? `invalid: ${Object.values(errors).join(' ')}`
            : `submitted: ${JSON.stringify(data)}`,
        )
      }}
    >
      <div className="col" style={{ gap: 4 }}>
        <label htmlFor="u-name" style={{ fontSize: 12, color: 'var(--text-faint)' }}>
          Full name
        </label>
        <input id="u-name" name="name" defaultValue="" />
      </div>
      <div className="col" style={{ gap: 4 }}>
        <label htmlFor="u-email" style={{ fontSize: 12, color: 'var(--text-faint)' }}>
          Email
        </label>
        <input id="u-email" name="email" type="email" defaultValue="" />
      </div>
      <div className="col" style={{ gap: 4 }}>
        <label htmlFor="u-password" style={{ fontSize: 12, color: 'var(--text-faint)' }}>
          Password
        </label>
        <input id="u-password" name="password" type="password" defaultValue="" />
      </div>
      <div className="row">
        <button className="primary" type="submit">
          Sign up
        </button>
        <RenderBadge label="form" />
        <span className="badge good">0 renders while typing</span>
      </div>
      {result && (
        <div className="mono" style={{ fontSize: 12, color: 'var(--text-dim)' }}>
          {result}
        </div>
      )}
    </form>
  )
}

export default function Demo() {
  return (
    <div className="stack">
      <div className="grid2">
        <Panel title="Controlled — live validation, a render per keystroke">
          <ControlledForm />
        </Panel>
        <Panel title="Uncontrolled — validates at submit, no renders">
          <UncontrolledForm />
        </Panel>
      </div>

      <Callout kind="tip">
        <b>Try both.</b> Blur the email field on the left with it empty — the
        error appears. Start typing — it updates live. That is the{' '}
        <code>touched</code> flag doing its job. Then watch the render badges as
        you type in each form.
      </Callout>

      <Panel title="The three pieces of state per field">
        <table className="data">
          <thead>
            <tr>
              <th>State</th>
              <th>Meaning</th>
              <th>Drives</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="mono">value</td>
              <td>What is in the field.</td>
              <td>The input itself.</td>
            </tr>
            <tr>
              <td className="mono">touched</td>
              <td>Has the user blurred it at least once?</td>
              <td>
                Whether to <i>show</i> the error. This is the one people forget.
              </td>
            </tr>
            <tr>
              <td className="mono">error</td>
              <td>
                <b>Derived</b> from value. Never stored in state.
              </td>
              <td>The message, <code>aria-invalid</code>, the border colour.</td>
            </tr>
            <tr>
              <td className="mono">dirty</td>
              <td>
                <b>Derived.</b> Does value differ from the initial value?
              </td>
              <td>&ldquo;Unsaved changes&rdquo; prompts, enabling a reset button.</td>
            </tr>
          </tbody>
        </table>
      </Panel>

      <Panel title="What React Hook Form + Zod looks like">
        <pre>
          <code>{`const schema = z.object({
  name: z.string().min(1, 'Name is required.'),
  email: z.string().email('That does not look like an email address.'),
  password: z.string().min(8, 'Use at least 8 characters.'),
})

function SignUp() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm({ resolver: zodResolver(schema), mode: 'onTouched' })
    //                                        ^ validate after first blur,
    //                                          then live. Exactly the model above.

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <label htmlFor="email">Email</label>
      <input id="email" {...register('email')}
             aria-invalid={!!errors.email}
             aria-describedby={errors.email ? 'email-error' : undefined} />
      {errors.email && <span id="email-error">{errors.email.message}</span>}

      <button disabled={isSubmitting}>Sign up</button>
    </form>
  )
}

// One schema gives you: runtime validation, TypeScript types via z.infer,
// and the same rules reusable on the server.`}</code>
        </pre>
      </Panel>
    </div>
  )
}
