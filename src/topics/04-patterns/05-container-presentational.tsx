import { useEffect, useState } from 'react'
import type { TopicMeta } from '../../types'
import { Callout, Panel, sleep } from '../../lib/ui'

export const meta = {
  title: 'Container / presentational (and what replaced it)',
  summary:
    'The "smart vs dumb components" split, why its original author walked it back, and where the underlying idea still holds.',
  notes: [
    '<b>The original rule (Dan Abramov, 2015):</b> container components fetch data and hold state; presentational components take props and render markup. No component does both.',
    '<b>Why it existed:</b> before hooks, the only way to reuse stateful logic was to put it in a component. Splitting was how you made the rendering half reusable and testable.',
    '<b>Abramov added a disclaimer in 2019:</b> "I don&rsquo;t suggest splitting your components like this any more. Hooks let you do the same thing without an arbitrary division."',
    '<b>What survives:</b> the underlying principle — separate what fetches from what renders — is still right. The mechanism changed from two components to one component plus a custom hook.',
    '<b>The modern version:</b> <code>useOrders()</code> holds the data logic; the component holds the markup. Same separation, no wrapper, no prop threading.',
    '<b>Where an explicit split still pays:</b> Storybook and visual tests (a pure component is trivial to mount with fixture props), and design systems shipping presentational components consumers wire up themselves.',
    '<b>React Server Components revived a version of it</b> at the framework level: the server component fetches, the client component handles interaction. That split is enforced by the runtime, not by convention.',
    '<b>Do not split on principle.</b> Split when one half needs to be reused, tested or rendered independently.',
  ],
  questions: [
    {
      q: 'What is the container/presentational pattern?',
      a: 'Splitting each feature into two components. The container knows <i>how things work</i> — it fetches data, holds state, wires up handlers — and renders no meaningful markup. The presentational component knows <i>how things look</i> — it receives everything as props, holds no state beyond UI concerns, and has no idea where the data came from.\n\nThe payoff was that the presentational half became trivially reusable and testable: mount it with fixture props, no mocking, no network. And in 2015 that mattered enormously, because a component was the only unit that could hold logic.',
    },
    {
      q: 'Is the pattern still recommended?',
      a: 'Not as a blanket rule — and notably, Dan Abramov, who popularised it, added a note to the original article saying he no longer suggests splitting components this way, because hooks let you do the same thing without an arbitrary division.\n\nThe reason is that the pattern was a workaround. Logic had to live in a component because there was no other place to put it, so "extract the logic" meant "create a container component", with all the prop threading that implies.\n\nA custom hook is a better container: <code>const { orders, isLoading, retry } = useOrders()</code> gives you the same separation between data and markup, in one component, with no wrapper in the tree and no props to thread.\n\nSo the <i>principle</i> — separate fetching from rendering — is intact. The <i>mechanism</i> is obsolete.',
    },
    {
      q: 'When would you still split explicitly?',
      a: 'Three cases where the second component earns its place.\n\n<b>Design systems.</b> You ship a presentational <code>&lt;DataTable&gt;</code>; consumers bring their own data. It literally cannot hold the fetching logic, because it does not know where the data lives.\n\n<b>Storybook and visual regression testing.</b> A pure props-in component mounts with fixtures in one line. A component that fetches needs MSW, a query client, and a provider stack to render a single story.\n\n<b>Multiple sources for one view.</b> The same table rendered from a REST call on one screen and from a WebSocket on another — two hooks, one presentational component.\n\nWhat I would not do is split on principle, creating a <code>UserListContainer</code> for every <code>UserList</code>. That doubles the file count for no benefit when there is exactly one consumer.',
    },
    {
      q: 'How do React Server Components relate to this?',
      a: 'They reintroduce the same split, but enforced by the runtime rather than by convention — and with a much better payoff.\n\nA server component runs only on the server: it can hit the database directly, it never ships its code to the browser, and it cannot use state or effects. A client component is interactive and ships to the browser. The natural shape is a server component that fetches and composes, rendering client components for the interactive parts.\n\nThat is container/presentational, except the boundary now buys you something concrete: bundle size. The data-fetching code, the ORM, the markdown parser — none of it reaches the client.\n\nSo the pattern came back, not because the 2015 reasoning was right, but because a new constraint made the same shape valuable again.',
    },
  ],
} satisfies TopicMeta

type Order = { id: string; customer: string; total: number; status: 'paid' | 'pending' | 'failed' }

const FIXTURES: Order[] = [
  { id: 'A-1041', customer: 'Ada Lovelace', total: 249.0, status: 'paid' },
  { id: 'A-1042', customer: 'Grace Hopper', total: 89.5, status: 'pending' },
  { id: 'A-1043', customer: 'Alan Turing', total: 1320.0, status: 'failed' },
]

/* ===========================================================================
   THE PRESENTATIONAL COMPONENT.

   Props in, JSX out. No fetching, no effects, no knowledge of where the data
   came from. This is the half that is genuinely worth isolating: you can mount
   it in Storybook, screenshot it, and test every state without a single mock.
   =========================================================================== */
function OrdersTable({
  orders,
  isLoading,
  error,
  onRetry,
}: {
  orders: Order[]
  isLoading: boolean
  error: string | null
  onRetry: () => void
}) {
  if (isLoading) return <div className="muted">Loading orders…</div>
  if (error) {
    return (
      <div className="callout trap">
        {error} <button onClick={onRetry}>Retry</button>
      </div>
    )
  }
  return (
    <table className="data">
      <thead>
        <tr>
          <th>Order</th>
          <th>Customer</th>
          <th>Total</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {orders.map((o) => (
          <tr key={o.id}>
            <td className="mono">{o.id}</td>
            <td>{o.customer}</td>
            <td className="mono">£{o.total.toFixed(2)}</td>
            <td>
              <span
                className={`badge ${o.status === 'paid' ? 'good' : o.status === 'failed' ? 'bad' : 'warn'}`}
              >
                {o.status}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/* ===========================================================================
   VERSION A — the 2015 container. A whole component whose only job is to hold
   state and render exactly one child.
   =========================================================================== */
function OrdersTableContainer({ shouldFail }: { shouldFail: boolean }) {
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let ignore = false
    setIsLoading(true)
    setError(null)
    sleep(500).then(() => {
      if (ignore) return
      if (shouldFail) setError('Could not load orders (HTTP 500).')
      else setOrders(FIXTURES)
      setIsLoading(false)
    })
    return () => {
      ignore = true
    }
  }, [shouldFail, attempt])

  // The container's entire render: pass everything down. This prop-threading
  // ceremony is what the pattern costs.
  return (
    <OrdersTable
      orders={orders}
      isLoading={isLoading}
      error={error}
      onRetry={() => setAttempt((a) => a + 1)}
    />
  )
}

/* ===========================================================================
   VERSION B — the modern equivalent. The SAME separation, but the "container"
   is a hook, so there is no wrapper component and no prop threading.
   =========================================================================== */
function useOrders(shouldFail: boolean) {
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let ignore = false
    setIsLoading(true)
    setError(null)
    sleep(500).then(() => {
      if (ignore) return
      if (shouldFail) setError('Could not load orders (HTTP 500).')
      else setOrders(FIXTURES)
      setIsLoading(false)
    })
    return () => {
      ignore = true
    }
  }, [shouldFail, attempt])

  return { orders, isLoading, error, retry: () => setAttempt((a) => a + 1) }
}

function OrdersPanel({ shouldFail }: { shouldFail: boolean }) {
  // One component. The data logic is still fully separated — it is just in a
  // hook instead of a parent component — and it is reusable anywhere.
  const { orders, isLoading, error, retry } = useOrders(shouldFail)
  return (
    <OrdersTable orders={orders} isLoading={isLoading} error={error} onRetry={retry} />
  )
}

export default function Demo() {
  const [fail, setFail] = useState(false)

  return (
    <div className="stack">
      <div className="row">
        <button className="primary" onClick={() => setFail((f) => !f)}>
          simulate: {fail ? 'failure' : 'success'}
        </button>
      </div>

      <div className="grid2">
        <Panel title="2015: container component">
          <OrdersTableContainer shouldFail={fail} />
          <pre style={{ marginTop: 12 }}>
            <code>{`<OrdersTableContainer />
  └─ <OrdersTable orders isLoading error onRetry />

// An extra node in the tree whose only
// job is to forward four props.`}</code>
          </pre>
        </Panel>

        <Panel title="Today: a hook plus a pure component">
          <OrdersPanel shouldFail={fail} />
          <pre style={{ marginTop: 12 }}>
            <code>{`const { orders, isLoading, error, retry }
  = useOrders()

<OrdersTable ... />

// Same separation. No wrapper, and the
// hook is reusable in any component.`}</code>
          </pre>
        </Panel>
      </div>

      <Panel title="Why the presentational half is still worth isolating">
        <pre>
          <code>{`// Testing OrdersTable — no network, no mocks, no providers:
it('shows a retry button on error', async () => {
  const onRetry = vi.fn()
  render(<OrdersTable orders={[]} isLoading={false} error="boom" onRetry={onRetry} />)
  await userEvent.click(screen.getByRole('button', { name: /retry/i }))
  expect(onRetry).toHaveBeenCalled()
})

// Testing OrdersPanel — you now need MSW or a fetch mock,
// fake timers, and possibly a QueryClientProvider.`}</code>
        </pre>
        <Callout kind="tip">
          <b>The line to use in an interview.</b> The <i>principle</i> — keep
          data-fetching out of your rendering components — is as true as ever.
          The <i>mechanism</i> changed: a custom hook is a better container than
          a container component, because it separates the concerns without
          adding a node to the tree or a layer of props.
        </Callout>
      </Panel>

      <Panel title="…and it came back, as Server Components">
        <pre>
          <code>{`// app/orders/page.tsx  — SERVER component (never ships to the browser)
export default async function OrdersPage() {
  const orders = await db.order.findMany()   // direct DB access
  return <OrdersTable orders={orders} />     // client component
}

// The same split — fetch here, render there — but now the boundary
// buys you bundle size: the ORM, the query code and the secrets
// never reach the client.`}</code>
        </pre>
      </Panel>
    </div>
  )
}
