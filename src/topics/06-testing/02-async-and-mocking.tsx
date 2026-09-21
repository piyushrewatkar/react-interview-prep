import type { TopicMeta } from '../../types'
import { Callout, Panel } from '../../lib/ui'

export const meta = {
  title: 'Async tests, mocking & fake timers',
  summary:
    'findBy vs waitFor, mocking the network at the right layer, and the fake-timer rules that stop tests becoming flaky.',
  notes: [
    '<b><code>findBy*</code> is <code>getBy*</code> + <code>waitFor</code>.</b> Prefer it whenever you are waiting for an element — the failure message is far better than a bare <code>waitFor</code>.',
    '<b><code>waitFor</code> is for assertions that are not about an element</b> — a mock having been called, a value having changed.',
    '<b><code>waitForElementToBeRemoved</code></b> when the disappearance is the point, e.g. a spinner.',
    '<b>Never put a side effect inside <code>waitFor</code>.</b> It retries the callback repeatedly, so a click in there fires many times.',
    '<b>Mock at the network layer, not the module layer.</b> MSW intercepts the actual request, so your component&rsquo;s real fetch/axios code runs. Mocking your own <code>api.ts</code> means the code you ship is never exercised.',
    '<b>Test the error and empty states.</b> They are the least-exercised paths in production and the most likely to be broken.',
    '<b>Fake timers must be restored.</b> <code>vi.useFakeTimers()</code> in <code>beforeEach</code>, <code>vi.useRealTimers()</code> in <code>afterEach</code> — leaking them breaks every later file.',
    '<b>Mixing fake timers with user-event needs wiring:</b> <code>userEvent.setup({ advanceTimers: vi.advanceTimersByTime })</code>, or user-event will hang waiting for real time.',
  ],
  questions: [
    {
      q: 'When do you use findBy, waitFor and waitForElementToBeRemoved?',
      a: '<code>findBy*</code> whenever you are waiting for an element to appear. It is the common case, and it produces a good failure message that includes the DOM.\n\n<code>waitFor</code> when the thing you are waiting for is not an element — a mock having been called, a store having updated, a callback having fired. It retries the callback until it stops throwing.\n\n<code>waitForElementToBeRemoved</code> when the disappearance is what you care about. You could assert on the new content instead, but stating the intent directly reads better and fails more clearly if the spinner never goes away.\n\nThe anti-pattern is <code>await waitFor(() =&gt; expect(screen.getByText("x")).toBeInTheDocument())</code>, which is what <code>findByText</code> does, more verbosely and with a worse error.',
    },
    {
      q: 'Why should you not put side effects inside waitFor?',
      a: 'Because <code>waitFor</code> calls its callback repeatedly — on an interval and on every DOM mutation — until it stops throwing. Anything with a side effect in there runs many times.\n\n<code>await waitFor(() =&gt; { user.click(button); expect(thing).toBeVisible() })</code> can click that button a dozen times before the assertion passes. If the click submits a form, you have submitted a dozen times, and the test will pass or fail depending on machine speed.\n\nThe rule is that a <code>waitFor</code> callback must be a pure assertion. Do the action before it, and wait after.',
    },
    {
      q: 'Where should you mock the network — and why does the layer matter?',
      a: 'At the network boundary, with MSW, rather than by mocking your own API module.\n\nIf you <code>vi.mock("./api")</code>, everything between the component and the wire is stubbed out: your fetch call, the URL construction, the header logic, the error handling, the response parsing. None of that is tested, and it is exactly where bugs live. Worse, the mock\'s shape can drift from the real function until they disagree and the test still passes.\n\nMSW intercepts at the service-worker or Node request level. Your component calls real <code>fetch</code>, your real client code builds the request, and MSW responds. You can assert on the request that was made, simulate a 500, simulate a delay, and the same handlers run in tests, in Storybook and in local development.\n\nFor one or two tests, stubbing global <code>fetch</code> with <code>vi.fn()</code> is a reasonable shortcut — which is what the example file here does — but for a real suite MSW is the answer.',
    },
    {
      q: 'What are the rules for fake timers?',
      a: 'Install them in <code>beforeEach</code> and <i>always</i> restore in <code>afterEach</code>. Leaked fake timers are one of the worst sources of cross-file flakiness, because a later file\'s real async code silently never resolves and the failure points somewhere unrelated.\n\nWrap timer advancement in <code>act()</code> when it triggers a state update, or React warns and your assertions read pre-update state.\n\nAnd if you combine fake timers with user-event, you must tell user-event how to advance them: <code>userEvent.setup({ advanceTimers: vi.advanceTimersByTime })</code>. Without that, user-event\'s internal delays wait for real time that never passes, and the test hangs until it times out. This catches almost everyone once.\n\nUse them when real waiting would make the suite slow or flaky — debounces, polling, countdowns, retry backoff. Do not reach for them for ordinary promise resolution, which resolves on the microtask queue anyway.',
    },
    {
      q: 'How do you test something that depends on the current time?',
      a: '<code>vi.setSystemTime(new Date("2024-01-15T10:00:00Z"))</code> alongside fake timers, so <code>Date.now()</code> and <code>new Date()</code> return a value you control.\n\nWithout it, anything rendering "3 minutes ago", "expires tomorrow" or a date in the user\'s locale is a test that passes today and fails in March, or passes for you and fails for a colleague in another timezone.\n\nThe complementary discipline is to avoid reading the clock deep inside components. If a component takes <code>now</code> as a prop, or gets it from an injectable clock, you can test it with no mocking at all — and that is usually the better design.',
    },
  ],
} satisfies TopicMeta

export default function Demo() {
  return (
    <div className="stack">
      <Callout>
        The runnable version of everything here is{' '}
        <code>src/topics/06-testing/__tests__/ProductList.test.tsx</code>, which
        covers the loading, success, empty and error states of a fetching
        component.
      </Callout>

      <Panel title="Choosing the right waiter">
        <pre>
          <code>{`// ✅ Waiting for an element to appear — the common case.
expect(await screen.findByText(/mechanical keyboard/i)).toBeInTheDocument()

// ❌ The same thing, more verbose, worse failure message.
await waitFor(() => {
  expect(screen.getByText(/mechanical keyboard/i)).toBeInTheDocument()
})

// ✅ Waiting for something that is NOT an element.
await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

// ✅ Waiting for a disappearance, when that is the point.
await waitForElementToBeRemoved(() => screen.queryByText(/loading/i))

// ❌ NEVER. waitFor retries the callback — this clicks many times.
await waitFor(() => {
  user.click(button)
  expect(thing).toBeVisible()
})`}</code>
        </pre>
      </Panel>

      <Panel title="Mock at the right layer">
        <div className="grid2">
          <div>
            <div className="panel-title" style={{ color: 'var(--bad)' }}>
              ❌ mocking your own module
            </div>
            <pre>
              <code>{`vi.mock('./api', () => ({
  getProducts: vi.fn(() => Promise.resolve([...]))
}))

// Never tested:
//  · the URL you build
//  · the auth headers
//  · response parsing
//  · error handling
//  · retry logic
// And the mock's shape can drift
// from the real function forever.`}</code>
            </pre>
          </div>
          <div>
            <div className="panel-title" style={{ color: 'var(--good)' }}>
              ✅ MSW, at the network boundary
            </div>
            <pre>
              <code>{`const server = setupServer(
  http.get('/api/products', ({ request }) => {
    const url = new URL(request.url)
    // You can assert on the real request
    expect(url.searchParams.get('category'))
      .toBe('audio')
    return HttpResponse.json(PRODUCTS)
  })
)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

// Your real fetch code runs.
// Same handlers work in Storybook
// and in local dev.`}</code>
            </pre>
          </div>
        </div>
      </Panel>

      <Panel title="Fake timers — the rules and the gotcha">
        <pre>
          <code>{`beforeEach(() => { vi.useFakeTimers() })
afterEach(()  => { vi.useRealTimers() })   // ← non-negotiable

it('debounces the search', async () => {
  // THE GOTCHA. user-event has internal delays. With fake timers
  // installed, real time never passes and it hangs until timeout
  // unless you tell it how to advance them.
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

  render(<Search onSearch={onSearch} />)
  await user.type(screen.getByRole('searchbox'), 'react')

  expect(onSearch).not.toHaveBeenCalled()      // still debouncing

  // act() because the timer callback calls setState.
  act(() => { vi.advanceTimersByTime(500) })

  expect(onSearch).toHaveBeenCalledExactlyOnceWith('react')
})

// Deterministic dates:
vi.setSystemTime(new Date('2024-01-15T10:00:00Z'))
// …otherwise "3 minutes ago" is a test that fails next Tuesday.`}</code>
        </pre>
      </Panel>

      <Panel title="The four states every fetching component has">
        <table className="data">
          <thead>
            <tr>
              <th>State</th>
              <th>Tested by most people?</th>
              <th>Breaks in production?</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Loading</td>
              <td className="mono">usually</td>
              <td>Rarely.</td>
            </tr>
            <tr>
              <td>Success</td>
              <td className="mono">always</td>
              <td>Rarely — it is the path everyone clicks through.</td>
            </tr>
            <tr>
              <td>Empty</td>
              <td className="mono">sometimes</td>
              <td>
                Often. <code>data.map</code> on <code>undefined</code>, or a
                layout that collapses.
              </td>
            </tr>
            <tr>
              <td>Error</td>
              <td className="mono">rarely</td>
              <td>
                <b>Constantly.</b> Nobody clicks through it, so nobody notices
                it is broken.
              </td>
            </tr>
          </tbody>
        </table>
      </Panel>
    </div>
  )
}
