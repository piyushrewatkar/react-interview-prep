import { useState } from 'react'
import type { TopicMeta } from '../../types'
import { Callout, Panel } from '../../lib/ui'

export const meta = {
  title: 'CSR, SSR, SSG, ISR & Server Components',
  summary:
    'Where the HTML comes from, what hydration is and why it costs so much, and what RSC actually changes. The “how would you architect this app?” question.',
  notes: [
    '<b>CSR:</b> the server sends an empty shell; the browser downloads the bundle, runs it and renders. Simple to deploy, worst first paint, poor for SEO on content pages.',
    '<b>SSR:</b> the server renders HTML per request, the browser paints it, then <i>hydrates</i>. Fast first paint, personalised, but costs server time on every request.',
    '<b>SSG:</b> HTML is built once at deploy time and served from a CDN. Fastest possible, but stale until the next build and impractical past a few thousand pages.',
    '<b>ISR:</b> SSG plus background regeneration — serve the cached page, rebuild it after <code>revalidate</code> seconds. The usual answer for large content sites.',
    '<b>Hydration is the expensive part.</b> React re-renders the whole tree on the client to attach event handlers and rebuild its internal state. The markup arrives fast, but the page is not interactive until the bundle has downloaded and run.',
    '<b>A hydration mismatch is a real bug.</b> <code>Date.now()</code>, <code>Math.random()</code>, <code>window</code>, or anything locale-dependent in render will differ between server and client.',
    '<b>RSC:</b> components that run only on the server and never ship their JavaScript. They can read the database directly; they cannot use state, effects or event handlers.',
    '<b>The decision is per route, not per app.</b> A marketing page, a dashboard and a checkout flow want three different answers.',
  ],
  questions: [
    {
      q: 'What is the difference between CSR, SSR, SSG and ISR?',
      a: 'They differ in <i>where</i> and <i>when</i> the HTML is produced.\n\n<b>CSR</b> — the browser does it, at runtime. The server sends an empty <code>&lt;div id="root"&gt;</code>; nothing is visible until the bundle downloads and executes. Simplest to build and deploy, worst first paint, and historically bad for SEO and link previews.\n\n<b>SSR</b> — the server does it, per request. HTML arrives complete, so the user sees content immediately, and it can be personalised. The costs are server CPU on every request and the hydration step before anything is interactive.\n\n<b>SSG</b> — the build does it, once. Pure static files on a CDN: the fastest possible delivery and essentially free to serve. But content is frozen until the next build, and build time scales with page count.\n\n<b>ISR</b> — SSG with a revalidation window. Serve the cached page instantly, regenerate it in the background after N seconds, swap it in. You get static performance with content that is at most N seconds stale.\n\nThe important part of the answer is that this is a per-route decision. A marketing page is SSG, a product page is ISR, a dashboard is SSR or CSR, and they can coexist in one application.',
    },
    {
      q: 'What is hydration and why is it expensive?',
      a: 'Hydration is the process of taking server-rendered HTML and making it interactive. React walks the existing DOM, renders the same component tree on the client, matches the two up, and attaches event listeners and internal state.\n\nIt is expensive because it is essentially a full render of the whole tree, and it cannot start until the entire JavaScript bundle has downloaded, parsed and executed. So you get a window where the page <i>looks</i> ready but nothing responds to clicks — which is worse than an obvious spinner, because users try to interact and nothing happens. That window is what INP and the old Time To Interactive metric measure.\n\nThe mitigations are all about doing less of it: selective hydration in React 18, where <code>Suspense</code> boundaries hydrate independently and React prioritises whichever the user just clicked; streaming SSR, so HTML arrives in chunks rather than all at once; and Server Components, which sidestep it entirely for any component that does not need interactivity.',
    },
    {
      q: 'What causes a hydration mismatch?',
      a: 'Rendering something on the client that differs from what the server produced. React compares the two and, if they diverge, warns and discards the server markup for that subtree.\n\nThe usual culprits: <code>Date.now()</code> or <code>new Date()</code> rendered directly, because the timestamps differ. <code>Math.random()</code>, for obvious reasons. Anything reading <code>window</code>, <code>localStorage</code> or <code>navigator</code>, which do not exist on the server. Locale- or timezone-dependent formatting, where the server\'s locale differs from the user\'s. And invalid HTML nesting — a <code>&lt;div&gt;</code> inside a <code>&lt;p&gt;</code> — because the browser silently reparents it and the DOM no longer matches what React rendered.\n\nThe fixes: render the deterministic value on both sides and adjust in an effect; guard browser APIs behind a <code>mounted</code> flag; use <code>suppressHydrationWarning</code> for genuinely unavoidable cases like a timestamp; and for anything truly client-only, a dynamic import with SSR disabled.',
    },
    {
      q: 'What are React Server Components and what problem do they solve?',
      a: 'Components that execute only on the server. Their code never reaches the browser — what gets sent is a serialised description of their rendered output, not their JavaScript.\n\nThe problem they solve is bundle size and data-fetching waterfalls at once. A server component can <code>await</code> a database query directly, with no API route, no client-side fetch and no loading state. And the markdown parser, the date library, the ORM — none of it counts against the bundle, because none of it is shipped.\n\nThe constraints follow from running on the server: no <code>useState</code>, no <code>useEffect</code>, no event handlers, no browser APIs. Anything interactive is a client component, marked with <code>"use client"</code>, and server components render them as children.\n\nThe mental model that helps: server components are for fetching and composing, client components are for interactivity. The boundary is where the JavaScript starts.\n\nAnd the honest caveat: it requires a framework (Next.js App Router, or React Router v7 in framework mode), it is a genuine shift in how you structure an app, and the "use client" boundary rules take a while to get intuitive.',
    },
    {
      q: 'How would you choose a strategy for a given application?',
      a: 'Per route, starting from two questions: does this content need to be indexed or shared, and is it the same for everyone?\n\nA marketing site, docs or a blog — content is public and mostly static, so SSG or ISR. Build it once, serve it from a CDN, regenerate when it changes.\n\nAn e-commerce product page — public and indexable, but with stock and pricing that change. ISR with a short revalidation window, or SSR if it must be exactly current.\n\nAn internal dashboard behind a login — no SEO value, highly personalised, and users stay for a long session. CSR is entirely reasonable, and the simplest thing that works.\n\nA social feed or anything user-specific and dynamic — SSR for the first paint so the user sees something immediately, then client-side navigation.\n\nAnd I would say explicitly that mixing is normal. Next.js and React Router v7 both let you choose per route, so a single application can be static at the edges and server-rendered in the middle.',
    },
  ],
} satisfies TopicMeta

type Strategy = 'csr' | 'ssr' | 'ssg' | 'isr' | 'rsc'

const STRATEGIES: Record<
  Strategy,
  {
    name: string
    html: string
    timeline: string[]
    good: string[]
    bad: string[]
    useFor: string
  }
> = {
  csr: {
    name: 'Client-side rendering',
    html: `<!-- What the server sends -->
<html>
  <body>
    <div id="root"></div>          <!-- empty -->
    <script src="/bundle.js"></script>
  </body>
</html>`,
    timeline: [
      'request → empty shell (fast, but blank)',
      'download bundle.js (300kB+)',
      'parse + execute',
      'React renders',
      'fetch data (a second round trip)',
      'render again with data ← first meaningful paint',
    ],
    good: ['Simplest to build and deploy', 'No server runtime at all', 'Rich interactivity after load'],
    bad: ['Blank screen until JS runs', 'Bad on slow devices and networks', 'Weak SEO / link previews'],
    useFor: 'Internal dashboards, admin panels, anything behind a login with long sessions.',
  },
  ssr: {
    name: 'Server-side rendering',
    html: `<!-- What the server sends -->
<html>
  <body>
    <div id="root">
      <h1>Ada Lovelace</h1>        <!-- real content, immediately -->
      <p>Mathematician</p>
    </div>
    <script src="/bundle.js"></script>
  </body>
</html>`,
    timeline: [
      'request → server fetches data and renders',
      'HTML arrives complete ← first paint, content visible',
      'download bundle.js',
      'HYDRATE — React re-renders to attach handlers',
      '← interactive (this gap is the cost)',
    ],
    good: ['Fast first paint', 'Full SEO', 'Can be personalised per request'],
    bad: ['Server CPU on every request', 'Hydration delay before interactive', 'Harder to cache'],
    useFor: 'Personalised, dynamic, indexable pages: a social feed, a logged-in home page.',
  },
  ssg: {
    name: 'Static site generation',
    html: `<!-- Built once, at deploy time. Served from a CDN. -->
<html>
  <body>
    <div id="root">
      <h1>Ada Lovelace</h1>        <!-- baked in at build -->
    </div>
  </body>
</html>`,
    timeline: [
      'BUILD TIME: render every page to a file',
      '---',
      'request → CDN edge serves a static file ← first paint (fastest possible)',
      'download bundle.js',
      'hydrate ← interactive',
    ],
    good: ['Fastest possible delivery', 'Essentially free to serve', 'Cannot fall over under load'],
    bad: ['Stale until the next build', 'Build time scales with page count', 'No personalisation'],
    useFor: 'Marketing pages, documentation, blogs — anything that changes on a deploy cadence.',
  },
  isr: {
    name: 'Incremental static regeneration',
    html: `// Next.js
export const revalidate = 60   // seconds

// First request after 60s: serve the STALE page immediately,
// regenerate in the background, swap it in for the next visitor.
// Nobody ever waits for the rebuild.`,
    timeline: [
      'BUILD: render the popular pages',
      '---',
      'request → CDN serves the cached page ← instant',
      'if older than `revalidate`: rebuild in the background',
      'next visitor gets the fresh copy',
      '(a page never built yet is rendered on demand, then cached)',
    ],
    good: ['Static speed with fresh-ish content', 'Build time no longer scales with page count', 'Great cache hit rate'],
    bad: ['Content can be up to `revalidate` seconds stale', 'Needs a platform that supports it', 'Cache invalidation logic to reason about'],
    useFor: 'Large content sites and e-commerce catalogues — thousands of pages that change occasionally.',
  },
  rsc: {
    name: 'React Server Components',
    html: `// app/user/[id]/page.tsx  — a SERVER component by default
export default async function UserPage({ params }) {
  const user = await db.user.findUnique({ where: { id: params.id } })
  //           ^ direct DB access. No API route. No loading state.
  return (
    <article>
      <h1>{user.name}</h1>
      <FollowButton userId={user.id} />   {/* a CLIENT component */}
    </article>
  )
}

// components/FollowButton.tsx
'use client'                              // ← the boundary
export function FollowButton({ userId }) {
  const [following, setFollowing] = useState(false)   // state needs the client
  return <button onClick={...}>{following ? 'Following' : 'Follow'}</button>
}`,
    timeline: [
      'request → server runs the server components',
      'they query the DB directly, no API layer',
      'server streams the rendered output',
      'ONLY client components ship JavaScript',
      'those hydrate; everything else never needed to',
    ],
    good: [
      'The ORM, markdown parser and date library never reach the browser',
      'No API layer for your own data',
      'No fetch waterfall — the server has the database next to it',
    ],
    bad: [
      'Requires a framework (Next App Router, React Router v7)',
      'No state, effects or handlers in server components',
      'The "use client" boundary takes time to internalise',
    ],
    useFor: 'New applications on a supporting framework, where bundle size and data access both matter.',
  },
}

export default function Demo() {
  const [strategy, setStrategy] = useState<Strategy>('ssr')
  const s = STRATEGIES[strategy]

  return (
    <div className="stack">
      <Panel title="Pick a strategy">
        <div className="row" style={{ marginBottom: 14 }}>
          {(Object.keys(STRATEGIES) as Strategy[]).map((k) => (
            <button
              key={k}
              className={strategy === k ? 'primary' : ''}
              onClick={() => setStrategy(k)}
            >
              {k.toUpperCase()}
            </button>
          ))}
        </div>

        <h3 style={{ margin: '0 0 10px', fontSize: 17 }}>{s.name}</h3>

        <pre>
          <code>{s.html}</code>
        </pre>

        <div className="panel" style={{ marginTop: 12 }}>
          <div className="panel-title">Timeline</div>
          <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13.5, lineHeight: 1.9 }}>
            {s.timeline.map((t, i) => (
              <li key={i} className={t === '---' ? 'muted' : ''}>
                {t}
              </li>
            ))}
          </ol>
        </div>

        <div className="grid2" style={{ marginTop: 12 }}>
          <div className="panel">
            <div className="panel-title" style={{ color: 'var(--good)' }}>
              good
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5 }}>
              {s.good.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          </div>
          <div className="panel">
            <div className="panel-title" style={{ color: 'var(--bad)' }}>
              costs
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5 }}>
              {s.bad.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </div>
        </div>

        <Callout kind="tip" >
          <b>Use it for:</b> {s.useFor}
        </Callout>
      </Panel>

      <Panel title="Hydration, and the mismatches that break it">
        <pre>
          <code>{`// ❌ Server renders 10:00:00. Client hydrates at 10:00:01. Mismatch.
<p>Rendered at {new Date().toLocaleTimeString()}</p>

// ❌ window does not exist on the server.
<div style={{ width: window.innerWidth }} />

// ❌ Different locale / timezone on the server than in the browser.
<p>{new Intl.NumberFormat().format(1234.5)}</p>

// ❌ Invalid nesting. The browser silently reparents the div out of the p,
//    so the real DOM no longer matches what React rendered.
<p><div>text</div></p>

// ✅ Render the deterministic thing, adjust after mount.
const [mounted, setMounted] = useState(false)
useEffect(() => setMounted(true), [])
return <p>{mounted ? new Date().toLocaleTimeString() : 'loading…'}</p>

// ✅ For a genuinely unavoidable difference:
<time suppressHydrationWarning>{new Date().toISOString()}</time>

// ✅ For a truly client-only component:
const Chart = dynamic(() => import('./Chart'), { ssr: false })`}</code>
        </pre>
      </Panel>

      <Panel title="Choosing, per route">
        <table className="data">
          <thead>
            <tr>
              <th>Route</th>
              <th>Indexable?</th>
              <th>Personalised?</th>
              <th>Choose</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Marketing / docs / blog</td>
              <td>Yes</td>
              <td>No</td>
              <td className="mono">SSG</td>
            </tr>
            <tr>
              <td>Product catalogue (10k pages)</td>
              <td>Yes</td>
              <td>No</td>
              <td className="mono">ISR</td>
            </tr>
            <tr>
              <td>Logged-in home / feed</td>
              <td>Partly</td>
              <td>Yes</td>
              <td className="mono">SSR (or RSC)</td>
            </tr>
            <tr>
              <td>Internal dashboard</td>
              <td>No</td>
              <td>Yes</td>
              <td className="mono">CSR</td>
            </tr>
            <tr>
              <td>Checkout</td>
              <td>No</td>
              <td>Yes</td>
              <td className="mono">SSR/CSR — correctness over speed</td>
            </tr>
          </tbody>
        </table>
        <Callout>
          <b>Say this explicitly.</b> &ldquo;It is a per-route decision, not a
          per-application one.&rdquo; Interviewers are often checking whether
          you treat it as a single global choice — the frameworks stopped
          working that way years ago.
        </Callout>
      </Panel>
    </div>
  )
}
