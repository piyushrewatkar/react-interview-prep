import { render, screen } from '@testing-library/react'
import type { RenderOptions } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import userEvent from '@testing-library/user-event'
import { Accordion, ThemeProvider, ThemeToggle } from '../_lib/components'

/* ===========================================================================
   TESTING COMPONENTS THAT NEED PROVIDERS

   Every real app has a provider stack — router, store, theme, query client.
   Repeating it in every test is noise, and it drifts.

   The standard solution is a CUSTOM RENDER: wrap RTL's render with your app's
   providers, re-export everything else, and have tests import from your
   helper instead of from @testing-library/react. In a real project this lives
   in `src/test/utils.tsx`.
   =========================================================================== */

function AllProviders({ children }: { children: ReactNode }) {
  // In a real app this is where BrowserRouter, QueryClientProvider,
  // redux Provider and the i18n provider all go — once.
  return <ThemeProvider>{children}</ThemeProvider>
}

function renderWithProviders(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(ui, { wrapper: AllProviders, ...options })
}

describe('ThemeToggle', () => {
  it('renders inside the provider and toggles', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ThemeToggle />)

    const button = screen.getByRole('button')

    // aria-pressed is the accessible way to express a toggle's state, and
    // toBeInTheDocument's sibling matcher reads it directly. Asserting on a
    // CSS class here would test the implementation, not the behaviour.
    expect(button).toHaveAttribute('aria-pressed', 'false')
    expect(button).toHaveTextContent(/switch to dark/i)

    await user.click(button)

    expect(button).toHaveAttribute('aria-pressed', 'true')
    expect(button).toHaveTextContent(/switch to light/i)
  })

  it('can be given a specific initial state', () => {
    // Sometimes you want a non-default provider for one test. Pass a wrapper
    // inline rather than adding a prop to the shared helper.
    render(<ThemeToggle />, {
      wrapper: ({ children }) => <ThemeProvider initial="dark">{children}</ThemeProvider>,
    })

    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true')
  })

  it('throws a helpful error when used outside its provider', () => {
    // React logs the error to the console before the boundary/throw
    // propagates, which makes the test output noisy even on success.
    // Silencing it deliberately is standard practice for this kind of test.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => render(<ThemeToggle />)).toThrow(/must be used within a ThemeProvider/i)

    spy.mockRestore()
  })
})

describe('Accordion', () => {
  it('tests behaviour, not implementation', async () => {
    const user = userEvent.setup()
    render(
      <Accordion title="Shipping information">
        <p>Delivered in 3-5 working days.</p>
      </Accordion>,
    )

    const trigger = screen.getByRole('button', { name: /shipping information/i })

    // The panel is in the DOM but hidden, so getByText would FIND it and the
    // test would wrongly pass. `toBeVisible` checks computed visibility —
    // including the `hidden` attribute, display:none and visibility:hidden.
    expect(screen.getByText(/3-5 working days/i)).not.toBeVisible()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    await user.click(trigger)

    expect(screen.getByText(/3-5 working days/i)).toBeVisible()
    expect(trigger).toHaveAttribute('aria-expanded', 'true')

    await user.click(trigger)
    expect(screen.getByText(/3-5 working days/i)).not.toBeVisible()
  })

  it('is operable by keyboard', async () => {
    const user = userEvent.setup()
    render(
      <Accordion title="Returns">
        <p>30-day returns.</p>
      </Accordion>,
    )

    // Tab then Enter — exactly what a keyboard user does. Worth testing on
    // anything interactive, because a div with an onClick passes a mouse test
    // and fails this one.
    await user.tab()
    expect(screen.getByRole('button', { name: /returns/i })).toHaveFocus()

    await user.keyboard('{Enter}')
    expect(screen.getByText(/30-day returns/i)).toBeVisible()
  })
})
