import { useState } from 'react'
import type { TopicMeta } from '../../types'
import { Callout, Panel } from '../../lib/ui'
import { LoginForm } from './_lib/components'

export const meta = {
  title: 'React Testing Library: queries & user-event',
  summary:
    'Query by accessible role, interact with user-event, assert on what the user sees. The priority order is the whole philosophy compressed into a list.',
  notes: [
    '<b>The guiding principle:</b> “the more your tests resemble the way your software is used, the more confidence they can give you.”',
    '<b>Query priority, highest to lowest:</b> <code>getByRole</code> → <code>getByLabelText</code> → <code>getByPlaceholderText</code> → <code>getByText</code> → <code>getByDisplayValue</code> → <code>getByAltText</code> → <code>getByTitle</code> → <code>getByTestId</code>.',
    '<b><code>getByRole(role, { name })</code> should be your default.</b> It is exactly how assistive technology finds an element, so a passing query is also an accessibility signal.',
    '<b><code>getByTestId</code> is the last resort</b>, for things with no accessible representation — a chart canvas, a layout wrapper.',
    '<b>Three prefixes:</b> <code>getBy</code> throws if not found (assert presence), <code>queryBy</code> returns <code>null</code> (assert <i>absence</i>), <code>findBy</code> returns a promise and retries (assert something that will appear).',
    '<b><code>userEvent</code> over <code>fireEvent</code>.</b> A real click is pointerdown, mousedown, focus, pointerup, mouseup, click. <code>fireEvent.click</code> dispatches one event and misses focus, hover and disabled handling.',
    '<b>Call <code>userEvent.setup()</code> before <code>render</code></b>, and <code>await</code> every interaction — v14 made them all async.',
    '<b>Never assert on state, props, class names or component internals.</b> Those are implementation; refactoring them should not break a test.',
  ],
  questions: [
    {
      q: 'What is the guiding principle of React Testing Library?',
      a: 'That tests should resemble how the software is actually used. Everything else in the library follows from it.\n\nConcretely: find elements the way a user or a screen reader would — by visible text, by label, by accessible role — not by class name or component instance. Interact through real events rather than by calling handlers. Assert on what is rendered, not on internal state.\n\nThe practical payoff is that your tests survive refactoring. Rename a state variable, switch from <code>useState</code> to <code>useReducer</code>, swap a styled-component for Tailwind — the tests keep passing, because none of that changes what the user sees. Enzyme-style tests that reached into component instances broke on every one of those changes, which is why they got a reputation for being a maintenance burden.',
    },
    {
      q: 'What is the query priority order and why does it matter?',
      a: 'Roughly: <code>getByRole</code> first, then <code>getByLabelText</code> for form fields, then <code>getByPlaceholderText</code>, <code>getByText</code>, <code>getByDisplayValue</code>, <code>getByAltText</code>, <code>getByTitle</code>, and <code>getByTestId</code> last.\n\nIt matters because the order is a proxy for accessibility. <code>getByRole("button", { name: /save/i })</code> is precisely how a screen reader locates that button — so if the query works, the button is reachable; if it fails, real users have a problem. The test is doing double duty.\n\nDropping to <code>getByTestId</code> skips that signal entirely. A <code>&lt;div data-testid="save"&gt;</code> with an onClick will pass a testid query and be completely unusable with a keyboard. So test ids are for things with genuinely no accessible representation — a canvas, a layout container — not for convenience.',
    },
    {
      q: 'What is the difference between getBy, queryBy and findBy?',
      a: 'They differ in what happens when the element is not there.\n\n<code>getBy*</code> throws immediately, with a helpful dump of the DOM. Use it when the element should already exist — the failure message is better than an <code>expect</code> on null.\n\n<code>queryBy*</code> returns <code>null</code>. Use it <i>only</i> to assert absence: <code>expect(screen.queryByRole("alert")).not.toBeInTheDocument()</code>. With <code>getBy</code> that assertion can never run, because the query throws first.\n\n<code>findBy*</code> returns a promise that retries until the element appears or it times out (1 second by default). Use it for anything asynchronous. It is <code>getBy</code> + <code>waitFor</code> in one, with a much better failure message than wrapping a <code>getBy</code> in a bare <code>waitFor</code>.\n\nEach has an <code>All</code> variant for multiple matches.',
    },
    {
      q: 'Why use userEvent instead of fireEvent?',
      a: 'Because <code>fireEvent</code> dispatches a single synthetic event, and real interactions are sequences.\n\nA genuine click fires pointerdown, mousedown, focus, pointerup, mouseup and then click. <code>fireEvent.click</code> fires only the last one — so a component that depends on focus, on hover state, or on pointer events sees a half-interaction and your test passes while the real thing is broken.\n\nTyping is worse: <code>fireEvent.change</code> sets the value in one shot, whereas <code>userEvent.type</code> fires keydown, keypress, input and keyup per character. Anything that inspects keystrokes — a masked input, a max-length guard, an autocomplete — behaves differently.\n\n<code>userEvent</code> also respects reality: it refuses to click a disabled button or type into a readonly field, which <code>fireEvent</code> will happily do, hiding bugs.\n\nSince v14 every method is async, so you call <code>const user = userEvent.setup()</code> before render and <code>await</code> each interaction.',
    },
    {
      q: 'What should you never assert on in a React test?',
      a: 'Anything the user cannot observe.\n\nComponent state and props — those are implementation. If you refactor <code>useState</code> into <code>useReducer</code>, behaviour is identical and the test should not care.\n\nClass names, unless the class is genuinely the contract (rare). Styling changes constantly.\n\nWhether a specific child component rendered, or how many times something re-rendered. That is testing React, not your code.\n\nInternal function calls, beyond the boundary of your unit — mocking and asserting that <code>formatPrice</code> was called tells you nothing about whether the price is displayed correctly.\n\nThe question I would apply: if this assertion failed, would a user notice anything different? If not, the assertion is testing the wrong thing.',
    },
  ],
} satisfies TopicMeta

export default function Demo() {
  const [submitted, setSubmitted] = useState<string | null>(null)

  return (
    <div className="stack">
      <Callout>
        The component below is the one under test in{' '}
        <code>src/topics/06-testing/__tests__/LoginForm.test.tsx</code>. Run{' '}
        <code>npm test</code> and read that file alongside this page — the tests
        are the material.
      </Callout>

      <Panel title="The component under test">
        <div className="panel" style={{ background: 'var(--bg-raised)' }}>
          <LoginForm
            onSubmit={(email) => setSubmitted(`submitted with ${email}`)}
          />
        </div>
        {submitted && (
          <div className="callout tip" style={{ marginTop: 10 }}>
            {submitted}
          </div>
        )}
        <div className="muted" style={{ fontSize: 13, marginTop: 10 }}>
          Try submitting with a malformed email, or a password shorter than
          eight characters.
        </div>
      </Panel>

      <Panel title="The query priority ladder">
        <table className="data">
          <thead>
            <tr>
              <th>#</th>
              <th>Query</th>
              <th>Use for</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1</td>
              <td className="mono">getByRole(role, {'{'} name {'}'})</td>
              <td>
                <b>Everything, by default.</b> Buttons, links, headings,
                textboxes, checkboxes, dialogs, lists.
              </td>
            </tr>
            <tr>
              <td>2</td>
              <td className="mono">getByLabelText</td>
              <td>Form fields. Passing means the label is correctly associated.</td>
            </tr>
            <tr>
              <td>3</td>
              <td className="mono">getByPlaceholderText</td>
              <td>Only when there is genuinely no label (and fix that).</td>
            </tr>
            <tr>
              <td>4</td>
              <td className="mono">getByText</td>
              <td>Non-interactive content — a paragraph, a span.</td>
            </tr>
            <tr>
              <td>5</td>
              <td className="mono">getByDisplayValue</td>
              <td>Finding a filled-in field by its current value.</td>
            </tr>
            <tr>
              <td>6–7</td>
              <td className="mono">getByAltText / getByTitle</td>
              <td>Images; elements whose only name is a title attribute.</td>
            </tr>
            <tr>
              <td>8</td>
              <td className="mono">getByTestId</td>
              <td>
                <b>Last resort.</b> Canvas, layout wrappers — things with no
                accessible representation at all.
              </td>
            </tr>
          </tbody>
        </table>
      </Panel>

      <div className="grid2">
        <Panel title="❌ Testing implementation">
          <pre>
            <code>{`// Breaks when you rename a class
const btn = container.querySelector('.btn-primary')

// Breaks when you change useState -> useReducer
expect(wrapper.state('isOpen')).toBe(true)

// Misses focus, hover, disabled handling
fireEvent.click(btn)

// Finds a hidden element and passes wrongly
expect(screen.getByText('Details')).toBeInTheDocument()

// Tests React, not your code
expect(renderSpy).toHaveBeenCalledTimes(2)`}</code>
          </pre>
        </Panel>

        <Panel title="✅ Testing behaviour">
          <pre>
            <code>{`const user = userEvent.setup()   // BEFORE render

await user.click(
  screen.getByRole('button', { name: /save/i })
)

await user.type(
  screen.getByLabelText(/email/i), 'ada@example.com'
)

expect(await screen.findByRole('alert'))
  .toHaveTextContent(/valid email/i)

expect(screen.getByText('Details')).toBeVisible()

expect(screen.queryByRole('alert'))
  .not.toBeInTheDocument()   // queryBy for ABSENCE`}</code>
          </pre>
        </Panel>
      </div>

      <Callout kind="tip">
        <b>The trick worth knowing.</b> When a query fails, RTL prints the whole
        DOM plus a list of the accessible roles it <i>did</i> find. Call{' '}
        <code>screen.debug()</code> to print it on demand, or{' '}
        <code>screen.logTestingPlaygroundURL()</code> to open the current DOM in
        Testing Playground, which suggests the best query for any element you
        click.
      </Callout>
    </div>
  )
}
