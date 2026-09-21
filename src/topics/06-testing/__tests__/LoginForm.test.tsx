import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginForm } from '../_lib/components'

/* ===========================================================================
   COMPONENT TESTING WITH RTL

   The guiding principle, from RTL's own docs:
     "The more your tests resemble the way your software is used,
      the more confidence they can give you."

   In practice that means: find elements the way a user would (by their
   accessible role and name), interact the way a user would (userEvent, not
   fireEvent), and assert on what a user would observe (visible text, the
   button being disabled) — never on state, props, or class names.
   =========================================================================== */

describe('LoginForm', () => {
  it('finds fields by their label, the way a user does', async () => {
    // userEvent.setup() must be called BEFORE render. It installs the
    // clipboard and pointer-event plumbing that the typing simulation needs.
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(<LoginForm onSubmit={onSubmit} />)

    // getByLabelText is the recommended query for form fields: it only passes
    // if the label is correctly associated, so the test doubles as an
    // accessibility check. A test that finds the input by className would pass
    // on a form no screen reader can use.
    await user.type(screen.getByLabelText(/email/i), 'ada@example.com')
    await user.type(screen.getByLabelText(/password/i), 'correcthorse')

    // getByRole('button', { name }) is how assistive tech identifies the
    // button. Again: if this query fails, real users have a problem too.
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(onSubmit).toHaveBeenCalledWith('ada@example.com', 'correcthorse')
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('shows a validation error for a malformed email', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(<LoginForm onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText(/email/i), 'not-an-email')
    await user.type(screen.getByLabelText(/password/i), 'correcthorse')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    // role="alert" is both the accessible way to announce an error and the
    // stable way to find it in a test. Asserting on the text alone would
    // break every time a designer rewords the copy.
    expect(screen.getByRole('alert')).toHaveTextContent(/valid email/i)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('shows a validation error for a short password', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(<LoginForm onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText(/email/i), 'ada@example.com')
    await user.type(screen.getByLabelText(/password/i), 'short')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(/at least 8 characters/i)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('clears the error once the input is corrected', async () => {
    const user = userEvent.setup()
    render(<LoginForm onSubmit={vi.fn()} />)

    await user.type(screen.getByLabelText(/email/i), 'nope')
    await user.type(screen.getByLabelText(/password/i), 'correcthorse')
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    expect(screen.getByRole('alert')).toBeInTheDocument()

    await user.clear(screen.getByLabelText(/email/i))
    await user.type(screen.getByLabelText(/email/i), 'ada@example.com')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    // queryBy* returns null instead of throwing, which is what you use to
    // assert ABSENCE. getBy* would throw before the expect ran.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('submits on Enter, because it is a real form', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(<LoginForm onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText(/email/i), 'ada@example.com')
    // {Enter} inside a form with a submit button triggers submission — free
    // behaviour you only get from using a <form> element, and a good reason
    // to test through the real interaction rather than calling the handler.
    await user.type(screen.getByLabelText(/password/i), 'correcthorse{Enter}')

    expect(onSubmit).toHaveBeenCalledWith('ada@example.com', 'correcthorse')
  })
})
