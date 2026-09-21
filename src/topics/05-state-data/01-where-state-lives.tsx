import { useState } from 'react'
import type { TopicMeta } from '../../types'
import { Callout, Panel } from '../../lib/ui'

export const meta = {
  title: 'Where should this state live?',
  summary:
    'The decision that shapes an application more than any library choice — and the question behind "how would you architect state in a large app?".',
  notes: [
    '<b>Not all state is the same.</b> Separate it into four kinds and most architecture arguments dissolve: server cache, URL state, form state, and genuine client state.',
    '<b>Server state is a cache, not state.</b> Data fetched from an API is owned by the server; your copy is stale the moment it arrives. It needs caching, deduping, revalidation and invalidation — which is what React Query, SWR and RTK Query are for. Putting it in Redux by hand is the most common architectural mistake.',
    '<b>URL state belongs in the URL.</b> Current page, active tab, filters, search query, selected id. If a user should be able to share or bookmark it, or if the back button should undo it, it goes in the query string — not in <code>useState</code>.',
    '<b>Form state is its own category</b> with its own libraries, because it is high-frequency, ephemeral and validation-heavy.',
    '<b>Genuine client state is what remains</b> — theme, sidebar open, a wizard step, an undo stack, a shopping cart before checkout. This is usually far less than people expect, and often fits in <code>useState</code>.',
    '<b>Colocate by default.</b> Start local. Lift only to the closest common ancestor of the components that genuinely need it. Go global only when the consumers are genuinely distant.',
    '<b>Lifting state costs re-renders.</b> State high in the tree re-renders everything below it, so "just put it in a context at the root" has a real price.',
    '<b>Global state that is not shared is a smell.</b> If exactly one component reads it, it is local state in the wrong place.',
  ],
  questions: [
    {
      q: 'How do you decide where a piece of state should live?',
      a: 'I start by classifying it, because the four kinds have genuinely different answers.\n\n<b>Is it server data?</b> Then it is a cache, and it belongs in a data library with proper invalidation — not hand-rolled into a global store.\n\n<b>Should it survive a refresh or be shareable?</b> Then it belongs in the URL. Filters, pagination, the selected item, the active tab.\n\n<b>Is it form input?</b> Own category, own tooling.\n\n<b>Otherwise it is real client state</b>, and then it is a scope question: keep it in the component that uses it, lift it to the closest common ancestor when two components need it, and only reach for a global store when the consumers are genuinely far apart and the value changes often enough that context would be a performance problem.\n\nThe default is local. Every level you lift it costs re-renders and readability.',
    },
    {
      q: 'Why is it a problem to keep server data in Redux?',
      a: 'Because you end up hand-writing a cache, badly. Server data is not state you own — it is a snapshot of state the server owns, and it is stale from the moment it arrives.\n\nWhat that means in practice is that you need deduplication (three components mounting at once should cause one request), background revalidation, refetch on window focus and reconnect, stale-while-revalidate so the user sees something immediately, per-query loading and error states, retry with backoff, pagination and infinite scroll, garbage collection of unused entries, and cache invalidation after mutations.\n\nEvery team that puts server data in Redux writes some subset of that, inconsistently, spread across a dozen thunks. React Query, SWR and RTK Query are 30kB that do all of it, and they are the reason most applications now have almost no global client state left.',
    },
    {
      q: 'What belongs in the URL rather than in state?',
      a: 'Anything the user would expect to survive a refresh, be shareable as a link, or be undone by the back button.\n\nThat is more than people usually put there: the current page of a table, active filters, sort column and direction, the search query, which tab is selected, which row is expanded into a detail panel, and any modal that represents a distinct view.\n\nThe test I apply is: if the user sends this link to a colleague, should they see the same thing? If yes, it is URL state.\n\nThe practical benefit is large — the back button starts working correctly, deep links work, and you have deleted a pile of <code>useState</code> plus the effects that were trying to keep them in sync. React Router\'s <code>useSearchParams</code> or Next\'s <code>useSearchParams</code> gives you a state-like API over it.',
    },
    {
      q: 'When is a global store actually justified?',
      a: 'When the state is genuinely shared across distant parts of the tree, changes frequently, and different consumers care about different slices of it.\n\nThat last part is the real discriminator. Context can share a value across a tree perfectly well — what it cannot do is let one component subscribe to just <code>user.name</code> while another subscribes to <code>cart.total</code> without both re-rendering on either change. <code>useContext</code> has no selector.\n\nSo: theme and current user in context is fine, because they rarely change. A collaborative editor\'s document state, a complex multi-step workflow, an undo/redo stack, or anything driving many independent subscribers — that is where a store with selectors earns its place.\n\nI would also name the secondary reasons: devtools with time-travel, middleware for cross-cutting concerns, and state that needs to be read or updated from outside React.',
    },
    {
      q: 'What is the cost of lifting state up too far?',
      a: 'Re-renders and readability, in that order.\n\nA state update re-renders the component holding it and its entire subtree. State at the top of a page means every keystroke in a search field re-renders the whole page. You then "fix" it by memoising everything below, which is a lot of code to undo a decision you could have avoided.\n\nThe readability cost is subtler but worse over time. When state lives five levels above where it is used, you cannot tell what it affects without tracing props down, and every intermediate component\'s signature carries props it does not use.\n\nSo the guidance is to lift to the <i>closest</i> common ancestor and no higher — and to push state back down when a refactor makes it possible, which people almost never remember to do.',
    },
  ],
} satisfies TopicMeta

export default function Demo() {
  const [scenario, setScenario] = useState<string | null>(null)

  const SCENARIOS: { q: string; answer: string; where: string; why: string }[] = [
    {
      q: 'The list of products shown on the catalogue page',
      answer: 'Server cache',
      where: 'React Query / SWR / RTK Query',
      why: 'The server owns it. You need deduping, revalidation and invalidation after a mutation — all of which a data library gives you and a store does not.',
    },
    {
      q: 'Which filters the user has applied to that catalogue',
      answer: 'URL',
      where: 'useSearchParams',
      why: 'Shareable, bookmarkable, and the back button should undo it. Also means the fetch key derives from the URL, so caching falls out for free.',
    },
    {
      q: 'Whether the mobile nav drawer is open',
      answer: 'Local',
      where: 'useState in the layout component',
      why: 'One component reads it. Nothing else cares. Putting this in a global store is the classic over-engineering tell.',
    },
    {
      q: 'The current theme (light / dark)',
      answer: 'Context',
      where: 'A ThemeProvider near the root',
      why: 'Genuinely ambient, read in many places, and changes about once a session — so the "every consumer re-renders" cost of context is irrelevant.',
    },
    {
      q: 'The text the user is typing into a 20-field settings form',
      answer: 'Form state',
      where: 'React Hook Form (uncontrolled) or local useState',
      why: 'High-frequency and ephemeral. Lifting it re-renders the page on every keystroke; putting it in a global store is worse still.',
    },
    {
      q: 'The signed-in user’s profile',
      answer: 'Both',
      where: 'Server cache for the data, context for the identity',
      why: 'The profile object is server data and should be cached like any other. Whether someone is signed in is ambient client state that gates routing.',
    },
    {
      q: 'Items in the shopping cart, before checkout',
      answer: 'Client state (global)',
      where: 'Zustand / Redux / context+reducer, persisted',
      why: 'Read by the header badge, the cart page and checkout — genuinely distant consumers. Changes often. Should survive a refresh, so persist it.',
    },
    {
      q: 'Which row of a table is expanded',
      answer: 'Local, or URL',
      where: 'useState — unless it should be linkable',
      why: 'Local by default. If a user should be able to send a link to “this row, expanded”, it becomes URL state.',
    },
  ]

  return (
    <div className="stack">
      <Panel title="The four kinds of state">
        <table className="data">
          <thead>
            <tr>
              <th>Kind</th>
              <th>Owned by</th>
              <th>Lives in</th>
              <th>The give-away</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><b>Server cache</b></td>
              <td>The server</td>
              <td>React Query, SWR, RTK Query</td>
              <td>It arrived over the network. It can be stale.</td>
            </tr>
            <tr>
              <td><b>URL state</b></td>
              <td>The browser</td>
              <td>
                <code>useSearchParams</code>, route params
              </td>
              <td>A shared link should reproduce it. Back should undo it.</td>
            </tr>
            <tr>
              <td><b>Form state</b></td>
              <td>The form</td>
              <td>React Hook Form, or local state</td>
              <td>Changes on every keystroke. Discarded on cancel.</td>
            </tr>
            <tr>
              <td><b>Client state</b></td>
              <td>Your app</td>
              <td>
                <code>useState</code> → lift → context → store
              </td>
              <td>None of the above. Usually far less than you expect.</td>
            </tr>
          </tbody>
        </table>
      </Panel>

      <Panel title="Work through the examples">
        <p className="muted" style={{ marginTop: 0, fontSize: 13.5 }}>
          Decide for yourself first, then click to check. These are exactly the
          kind of thing an interviewer will pose as &ldquo;where would you put
          X?&rdquo;.
        </p>
        <div className="col">
          {SCENARIOS.map((s) => (
            <div key={s.q}>
              <button
                onClick={() => setScenario(scenario === s.q ? null : s.q)}
                style={{ width: '100%', textAlign: 'left' }}
              >
                {scenario === s.q ? '▾' : '▸'} {s.q}
              </button>
              {scenario === s.q && (
                <div className="panel" style={{ marginTop: 6 }}>
                  <div className="row" style={{ marginBottom: 6 }}>
                    <span className="badge good">{s.answer}</span>
                    <span className="mono" style={{ fontSize: 13 }}>
                      {s.where}
                    </span>
                  </div>
                  <div style={{ fontSize: 13.5, color: 'var(--text-dim)' }}>{s.why}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="The escalation ladder for client state">
        <pre>
          <code>{`useState in the component that uses it
   │  two sibling components need it?
   ▼
useState in their closest common ancestor   ← "lifting state up"
   │  the ancestor is now 5 levels up and threading props?
   ▼
try composition first: pass the child down as children
   │  still awkward, and the value is ambient + low-frequency?
   ▼
Context (memoise the value; split state from actions)
   │  consumers need DIFFERENT SLICES and it changes often?
   ▼
A store with selectors (Zustand, Redux Toolkit, Jotai)

At every step, ask first: is this actually server state or URL state?
If so, none of this ladder applies.`}</code>
        </pre>
      </Panel>

      <Callout kind="tip">
        <b>The answer that lands.</b> &ldquo;Most of what teams call global
        state is really a server cache and some URL state. Once those are in the
        right place, the amount of genuine global client state left in a typical
        app is small enough that the library choice stops being an architectural
        decision.&rdquo;
      </Callout>
    </div>
  )
}
