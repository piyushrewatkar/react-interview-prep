import { useState } from 'react'
import type { TopicMeta } from '../../types'
import { Callout, Panel, sleep } from '../../lib/ui'
import { cacheStats, invalidate, useQuery } from './_lib/miniQuery'

export const meta = {
  title: 'Data fetching: cache, dedupe & revalidate',
  summary:
    'Everything a useEffect fetch does not do — built from scratch in a hundred lines, so you can explain exactly what React Query buys you.',
  notes: [
    '<b>A <code>useEffect</code> fetch is correct but incomplete.</b> It handles one request in one component. Everything else is missing.',
    '<b>Caching:</b> two components asking for the same data should share one entry, not fire two requests and hold two copies that can disagree.',
    '<b>Deduplication:</b> three components mounting at once with the same key should cause <i>one</i> network request, not three.',
    '<b>Stale-while-revalidate:</b> render the cached data immediately, refetch in the background, swap it in when it arrives. The user never sees a spinner for data you already have.',
    '<b><code>isLoading</code> vs <code>isValidating</code></b> is the UX distinction that falls out of this: one means &ldquo;nothing to show&rdquo;, the other means &ldquo;showing something, checking for newer&rdquo;.',
    '<b>Invalidation:</b> after a mutation, mark the affected keys stale so any mounted query refetches. React Query does this with keys; RTK Query with <code>providesTags</code>/<code>invalidatesTags</code>.',
    '<b>Race conditions are handled by the key</b>, not by an abort controller: the cache entry is per key, so a late response for key A cannot overwrite key B.',
    '<b>Also in the real libraries:</b> retry with backoff, refetch on window focus and reconnect, garbage collection, pagination and infinite queries, prefetching, and Suspense integration.',
  ],
  questions: [
    {
      q: 'What is wrong with fetching in a useEffect?',
      a: 'Nothing, in isolation — it is the correct primitive. The problem is everything it does not do, which you then write by hand, inconsistently, in every component.\n\nNo caching: navigate away and back, and you refetch from scratch with a spinner, even though you had the data two seconds ago. No deduplication: three components needing the same user fire three requests. No shared state: each component keeps its own copy, and they can disagree. No revalidation on focus or reconnect, so users stare at stale data after their laptop wakes up. No retry. And you own the race-condition handling every single time.\n\nYou also write the same four lines of <code>isLoading</code>/<code>error</code>/<code>data</code> state in every component.\n\nSo the honest answer is: an effect is the right mechanism, but server data has enough recurring requirements that it deserves a library — which is precisely why React Query exists.',
    },
    {
      q: 'What does stale-while-revalidate mean?',
      a: 'Show the cached data immediately, fetch a fresh copy in the background, and swap it in when it arrives.\n\nThe user gets an instant render from cache instead of a spinner, and still ends up with current data a moment later. For anything the user has seen before — going back to a list, reopening a tab — it makes the app feel instantaneous.\n\nThe important consequence for your UI is that "loading" splits into two states. <code>isLoading</code> means there is genuinely nothing to show, so you render a skeleton. <code>isFetching</code> means you are showing real data while checking for newer, so you render a subtle indicator and leave the content in place. Conflating the two is what produces the jarring "content flashes back to a spinner" experience.\n\nThe name comes from the HTTP <code>Cache-Control</code> directive of the same name, which does the same thing at the CDN layer.',
    },
    {
      q: 'How does deduplication work?',
      a: 'The cache stores the in-flight promise alongside the data. When a request comes in for a key, the library first checks whether a promise for that key already exists — if so it returns the <i>same</i> promise rather than starting a second request.\n\nSo three components mounting simultaneously and all asking for <code>["user", 42]</code> produce one network call and three subscribers to one promise. When it resolves, the cache entry updates once and notifies all three.\n\nThat is why the query key matters so much and why it must be serialisable: it is the identity of the request. Two components using <code>["user", 42]</code> share; one using <code>["user", "42"]</code> does not, which is a classic source of duplicate requests.',
    },
    {
      q: 'How do you keep the cache correct after a mutation?',
      a: 'Invalidate the keys the mutation affected, and let any mounted query refetch.\n\nIn React Query that is <code>queryClient.invalidateQueries({ queryKey: ["todos"] })</code> in the mutation\'s <code>onSuccess</code> — which marks every query whose key starts with <code>["todos"]</code> as stale, so the mounted ones refetch and the unmounted ones refetch next time they mount. RTK Query does the same thing declaratively: queries declare <code>providesTags</code>, mutations declare <code>invalidatesTags</code>, and the wiring is automatic.\n\nThere are two alternatives worth naming. You can write the server\'s response directly into the cache with <code>setQueryData</code>, avoiding a round trip — good when the response contains the full updated resource. And you can update optimistically before the request completes, which is the next topic.\n\nThe failure mode to mention is over-invalidation: invalidating a broad key after every small mutation turns one write into a dozen refetches.',
    },
    {
      q: 'Would you still need useEffect for data fetching in a modern app?',
      a: 'Rarely, and it is worth explaining why the answer keeps shrinking.\n\nIn a framework with a router that supports data loading — Next.js server components, Remix/React Router loaders, TanStack Router — the fetch happens before the component renders, so there is no effect and no loading state in the component at all.\n\nIn a client-only SPA, React Query or SWR covers essentially everything, and they use an effect internally so you do not have to.\n\nWhere a raw effect is still right: subscribing to a WebSocket or an event stream, one-off imperative calls that are not really "data" (analytics, logging), and integrating a non-React library. All of those are genuinely "synchronise with an external system", which is what effects are for.',
    },
  ],
} satisfies TopicMeta

/* --- A fake API ------------------------------------------------------------ */

let requestCount = 0

type User = { id: number; name: string; email: string; fetchedAt: string }

async function fetchUser(id: number): Promise<User> {
  requestCount += 1
  await sleep(800)
  const names = ['Ada Lovelace', 'Grace Hopper', 'Alan Turing']
  return {
    id,
    name: names[(id - 1) % names.length],
    email: `user${id}@example.com`,
    fetchedAt: new Date().toLocaleTimeString(),
  }
}

/* Three independent components, all asking for the same key. Watch the request
   counter: mounting all three fires ONE request, not three. */
function UserCard({ id, label }: { id: number; label: string }) {
  const { data, error, isLoading, isValidating, refetch } = useQuery(
    `user/${id}`,
    () => fetchUser(id),
    { staleTime: 4000 },
  )

  return (
    <div className="panel">
      <div className="panel-title">{label}</div>
      {isLoading && <div className="muted">Loading (nothing cached yet)…</div>}
      {error && <div className="callout trap">{error.message}</div>}
      {data && (
        <div className="col" style={{ gap: 4 }}>
          <div className="row">
            <span className="mono" style={{ fontSize: 13 }}>
              {data.name}
            </span>
            {/* The UX distinction: content stays visible, with a quiet hint
                that we are checking for newer. */}
            {isValidating && <span className="badge warn">revalidating…</span>}
          </div>
          <div className="mono" style={{ fontSize: 12, color: 'var(--text-faint)' }}>
            {data.email} · fetched at {data.fetchedAt}
          </div>
        </div>
      )}
      <div className="row" style={{ marginTop: 8 }}>
        <button onClick={refetch}>refetch this key</button>
      </div>
    </div>
  )
}

export default function Demo() {
  const [mounted, setMounted] = useState(false)
  const [userId, setUserId] = useState(1)
  const [, tick] = useState(0)

  return (
    <div className="stack">
      <Callout>
        The whole implementation is in{' '}
        <code>src/topics/05-state-data/_lib/miniQuery.ts</code> — about a
        hundred commented lines. Read it and React Query stops being magic.
      </Callout>

      <Panel title="1. Deduplication — three components, one request">
        <div className="row" style={{ marginBottom: 12 }}>
          <button className="primary" onClick={() => setMounted((m) => !m)}>
            {mounted ? 'Unmount' : 'Mount'} three cards
          </button>
          <button onClick={() => setUserId((i) => (i % 3) + 1)} disabled={!mounted}>
            switch to user {(userId % 3) + 1}
          </button>
          <span className="badge">{requestCount} network requests so far</span>
          <button onClick={() => tick((n) => n + 1)}>refresh counters</button>
        </div>

        {mounted && (
          <div className="col">
            <div className="grid2">
              <UserCard id={userId} label="Header avatar" />
              <UserCard id={userId} label="Sidebar profile" />
            </div>
            <UserCard id={userId} label="Main content — same key again" />
          </div>
        )}

        <Callout kind="tip">
          Mount the three cards, then press &ldquo;refresh counters&rdquo;. One
          request for three components. Switch users and back within four
          seconds — the cached data renders <i>instantly</i>, with no request at
          all.
        </Callout>
      </Panel>

      <Panel title="2. Invalidation">
        <div className="row">
          <button
            className="danger"
            onClick={() => {
              // What queryClient.invalidateQueries({ queryKey: ['user'] }) does.
              invalidate((key) => key.startsWith('user/'))
              tick((n) => n + 1)
            }}
            disabled={!mounted}
          >
            invalidate every user/* key
          </button>
          <span className="muted" style={{ fontSize: 13 }}>
            Mounted queries refetch; unmounted ones refetch next time they mount.
          </span>
        </div>
      </Panel>

      <Panel title="3. What is in the cache right now">
        <table className="data">
          <thead>
            <tr>
              <th>Key</th>
              <th>Data</th>
              <th>In flight</th>
              <th>Subscribers</th>
              <th>Age</th>
            </tr>
          </thead>
          <tbody>
            {cacheStats().length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  Empty. Mount the cards above.
                </td>
              </tr>
            )}
            {cacheStats().map((s) => (
              <tr key={s.key}>
                <td className="mono">{s.key}</td>
                <td>{s.hasData ? '✓' : '—'}</td>
                <td>{s.inFlight ? '⟳' : '—'}</td>
                <td className="mono">{s.listeners}</td>
                <td className="mono">
                  {s.ageMs === null ? '—' : `${Math.round(s.ageMs / 100) / 10}s`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel title="The same thing, in React Query">
        <pre>
          <code>{`function UserCard({ id }) {
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['user', id],       // the identity — must be serialisable
    queryFn: () => fetchUser(id),
    staleTime: 4000,              // how long before a background refetch
  })

  if (isLoading) return <Skeleton />          // nothing to show
  if (error)     return <Error error={error} />
  return (
    <div>
      {data.name}
      {isFetching && <Spinner size="xs" />}   // showing data, checking for newer
    </div>
  )
}

// After a mutation:
const mutation = useMutation({
  mutationFn: updateUser,
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['user'] }),
})`}</code>
        </pre>
      </Panel>
    </div>
  )
}
