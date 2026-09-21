import type { TopicMeta } from '../../types'
import { Callout, Panel } from '../../lib/ui'

export const meta = {
  title: 'What to test, and the custom render',
  summary:
    'The testing trophy, the provider boilerplate every real project needs, and how to answer "what is your testing strategy?" without reciting the pyramid.',
  notes: [
    '<b>The testing trophy (Kent C. Dodds)</b> replaces the pyramid for front-end work: a base of static analysis, a few unit tests, <b>mostly integration tests</b>, and a thin layer of end-to-end.',
    '<b>Integration is the sweet spot</b> because it is where the confidence-to-cost ratio peaks. Rendering a whole feature with its providers catches real bugs; testing one component in isolation with everything mocked often catches nothing.',
    '<b>Static analysis is part of the strategy.</b> TypeScript and ESLint eliminate whole categories of test you would otherwise write.',
    '<b>Write a custom <code>render</code></b> that wraps your provider stack, and import from it everywhere instead of from RTL directly.',
    '<b>Test behaviour, not coverage.</b> 100% line coverage with assertions on implementation details is worse than 60% covering the paths users take.',
    '<b>Always test the error and empty states.</b> They are the least-clicked paths in the product.',
    '<b>Do not test the framework or the library.</b> React works; React Router works. Test your code.',
    '<b>End-to-end is for critical journeys only</b> — sign up, checkout, the thing that loses money if it breaks. They are slow and flaky; keep the set small and stable.',
  ],
  questions: [
    {
      q: 'What is your testing strategy for a React application?',
      a: 'I think in terms of the testing trophy rather than the pyramid, because front-end code has a different cost curve.\n\n<b>Static analysis is the base.</b> TypeScript in strict mode plus ESLint removes an entire class of bug — typos, wrong shapes, missing dependency arrays — with no test to maintain.\n\n<b>Integration tests are the bulk.</b> Render a feature with its real providers, mock only the network with MSW, and drive it the way a user would. These catch the bugs that actually happen: a component passing the wrong prop, a context not wired up, a state update that does not propagate.\n\n<b>Unit tests for genuinely isolated logic</b> — a reducer, a validation function, a date formatter, an algorithm. Cheap and fast where the logic is pure.\n\n<b>End-to-end for a handful of critical journeys</b> — sign up, checkout, the flows that cost money when they break. Real browser, real backend if possible. Slow and occasionally flaky, so keep the set small.\n\nThe thing I would emphasise is that isolated component tests with everything mocked are usually the worst value: high maintenance, low confidence, and they break on every refactor.',
    },
    {
      q: 'Why do you prefer integration tests for React?',
      a: 'Because the bugs that reach production in a React app are overwhelmingly integration bugs, not unit bugs.\n\nIndividual components are usually simple — take props, render markup. What breaks is the wiring: a prop passed with the wrong name, a context provider missing, state that does not propagate, a handler that updates the wrong thing, a query key mismatch. A unit test that mounts one component with every dependency mocked cannot see any of that, by construction.\n\nRendering the whole feature with real providers and only the network mocked exercises all of it. And because the assertions are on what the user sees, the tests survive refactoring — you can restructure the components underneath and the tests keep passing, which is exactly what you want from a safety net.\n\nThe cost is that failures are slightly less precise about <i>where</i> the problem is. In practice that is a good trade.',
    },
    {
      q: 'What is a custom render and why does every project need one?',
      a: 'A wrapper around RTL\'s <code>render</code> that mounts your provider stack — router, query client, redux store, theme, i18n — so individual tests do not each repeat it.\n\nYou put it in something like <code>src/test/utils.tsx</code>, re-export everything from RTL alongside it, and then tests import from your helper instead of from <code>@testing-library/react</code>. Adding a provider later is a one-line change instead of a find-and-replace across two hundred files.\n\nThe good version takes options for the things tests need to vary — an initial route, a preloaded store state — and returns useful extras, like the store instance so a test can assert on it or the <code>user</code> instance from <code>userEvent.setup()</code> so every test does not create one.\n\nIt is boilerplate, but it is the boilerplate that decides whether your test suite is pleasant or exhausting to work in.',
    },
    {
      q: 'Is code coverage a useful metric?',
      a: 'It is useful in one direction only. Low coverage reliably tells you something is untested. High coverage tells you almost nothing about quality.\n\nYou can reach 100% by rendering every component and asserting that it did not throw. Every line is covered; no behaviour is verified. Conversely, a suite at 60% that covers the critical paths, the error states and the edge cases is far more valuable.\n\nWhat I would actually watch: is the error path covered? Is the empty state covered? Are the paths that would cost money covered? Those are questions coverage percentage cannot answer.\n\nAs a team policy, a coverage floor to catch "this PR added a file with no tests at all" is reasonable. A coverage <i>target</i> tends to produce tests written to satisfy the number.',
    },
    {
      q: 'What should you deliberately not test?',
      a: 'Third-party code. React\'s rendering, React Router\'s navigation, the date library\'s parsing — those have their own test suites. Testing them means your suite breaks when they upgrade, for no benefit.\n\nImplementation details: internal state, how many times something rendered, which private function was called. Those change during refactoring, and a test that breaks on a refactor with no behaviour change is a net negative.\n\nStatic markup with no logic. A component that renders a heading and a paragraph has nothing worth asserting.\n\nExact styling, unless it is functional. Testing a hex code is brittle; testing that an element is visible, or disabled, is not.\n\nAnd trivial pass-through wrappers. If a component just spreads props onto a child, the test is a tautology.',
    },
  ],
} satisfies TopicMeta

export default function Demo() {
  return (
    <div className="stack">
      <Panel title="The testing trophy">
        <pre>
          <code>{`        ╱▔▔▔▔▔▔▔▔╲
       │   E2E    │   few — critical journeys only. Playwright/Cypress.
       ╲▁▁▁▁▁▁▁▁╱    Slow, occasionally flaky. Sign up. Checkout.
      ╱▔▔▔▔▔▔▔▔▔▔╲
     │ INTEGRATION │  MOST of your tests. A whole feature, real providers,
     │             │  network mocked with MSW. Best confidence per unit cost.
      ╲▁▁▁▁▁▁▁▁▁▁╱
       ╱▔▔▔▔▔▔╲
      │  UNIT  │      Pure logic only: reducers, validators, formatters,
       ╲▁▁▁▁▁▁╱       algorithms. Cheap and fast where the logic is pure.
   ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔
      STATIC          TypeScript strict + ESLint. Catches an entire class of
                      bug with zero tests to maintain.

The pyramid's "mostly unit tests" advice comes from backend testing, where
units are meaningful in isolation. A React component in isolation, with every
dependency mocked, usually is not.`}</code>
        </pre>
      </Panel>

      <Panel title="The custom render — src/test/utils.tsx">
        <pre>
          <code>{`import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { Provider } from 'react-redux'
import { setupStore } from '../app/store'

function renderWithProviders(ui, {
  route = '/',
  preloadedState = {},
  store = setupStore(preloadedState),
  ...options
} = {}) {
  // A fresh QueryClient PER TEST. A shared one leaks cache between tests and
  // produces failures that depend on execution order.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },  // never retry in tests
  })

  function Wrapper({ children }) {
    return (
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
        </QueryClientProvider>
      </Provider>
    )
  }

  return {
    // Return the store so a test can assert on it or dispatch into it…
    store,
    // …and a ready-made user, so every test does not call setup() itself.
    user: userEvent.setup(),
    ...render(ui, { wrapper: Wrapper, ...options }),
  }
}

export * from '@testing-library/react'
export { renderWithProviders as render }   // shadow RTL's render

// Then, in every test file:
//   import { render, screen } from '../test/utils'
// Adding a provider next year is ONE line here, not 200 files.`}</code>
        </pre>
        <Callout kind="tip">
          Two details that prevent real flakiness:{' '}
          <code>retry: false</code> on the query client (otherwise a failing
          request retries three times and your test times out before the error
          state renders), and a <b>fresh</b> <code>QueryClient</code> per test
          so cache never leaks between them.
        </Callout>
      </Panel>

      <Panel title="A worked example of an integration test">
        <pre>
          <code>{`it('lets a user filter products and add one to the basket', async () => {
  server.use(
    http.get('/api/products', () => HttpResponse.json(PRODUCTS))
  )

  // The whole feature, with its real providers. Only the network is faked.
  const { user, store } = render(<ProductsPage />, { route: '/products' })

  await screen.findByRole('list', { name: /products/i })

  await user.type(screen.getByRole('searchbox', { name: /search/i }), 'keyboard')
  await user.click(screen.getByRole('button', { name: /apply filters/i }))

  expect(await screen.findByText(/mechanical keyboard/i)).toBeInTheDocument()
  expect(screen.queryByText(/27-inch monitor/i)).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /add mechanical keyboard/i }))

  // Assert what the USER sees…
  expect(await screen.findByText(/1 item in basket/i)).toBeInTheDocument()
  // …and, where it matters, that the state really changed.
  expect(store.getState().basket.items).toHaveLength(1)
})

// This one test covers: routing, data fetching, the loading state, filtering,
// the store, and the wiring between all of them. A dozen isolated unit tests
// of the same components, with everything mocked, would cover none of it.`}</code>
        </pre>
      </Panel>

      <div className="grid2">
        <Panel title="Test this">
          <ul className="notes" style={{ marginTop: 0 }}>
            <li>Everything a user can do — click, type, navigate, submit.</li>
            <li>Every state a fetch can be in, <b>especially error and empty</b>.</li>
            <li>Conditional rendering: permissions, feature flags, roles.</li>
            <li>Pure logic: reducers, validators, formatters, sorting.</li>
            <li>Accessibility: roles, labels, keyboard operation, focus.</li>
            <li>Edge cases: zero items, one item, a thousand, very long strings.</li>
            <li>Bugs, as you fix them — a regression test is the cheapest test you will ever write.</li>
          </ul>
        </Panel>

        <Panel title="Not this">
          <ul className="notes" style={{ marginTop: 0 }}>
            <li>React itself, React Router, your date library.</li>
            <li>Internal state, render counts, private functions.</li>
            <li>Exact class names or hex colours.</li>
            <li>Static markup with no logic in it.</li>
            <li>Trivial pass-through wrappers.</li>
            <li>Anything added purely to move a coverage number.</li>
          </ul>
        </Panel>
      </div>

      <Callout>
        <b>Run it.</b> <code>npm test</code> runs 145 tests: the 22 hand-written
        ones in <code>src/topics/06-testing/__tests__/</code>, plus a smoke
        suite in <code>src/test/smoke.test.tsx</code> that mounts all 60 topic
        demos and checks none of them throws. Read the test files rather than
        this page — they are commented line by line.
      </Callout>
    </div>
  )
}
