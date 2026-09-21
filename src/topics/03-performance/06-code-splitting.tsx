import { Suspense, lazy, useState } from 'react'
import type { TopicMeta } from '../../types'
import { Callout, Panel } from '../../lib/ui'

export const meta = {
  title: 'Code splitting, lazy & Suspense',
  summary:
    'Shipping less JavaScript up front. How React.lazy works, what Suspense actually does, and where to draw the split lines.',
  notes: [
    '<b><code>lazy(() =&gt; import("./X"))</code></b> turns a dynamic import into a component. The bundler sees the <code>import()</code> and emits a separate chunk.',
    '<b>Every <code>lazy</code> component must be inside a <code>&lt;Suspense&gt;</code> boundary</b>, or React throws when it tries to render before the chunk arrives.',
    '<b>Suspense is a boundary for "not ready yet"</b>, not just for lazy loading. Data libraries and server components use the same mechanism.',
    '<b>The default split is per route.</b> Highest payoff, lowest risk: the user only downloads the page they are on.',
    '<b>Then split heavy, conditional UI</b> — a rich text editor, a chart library, a date picker, a modal that most users never open.',
    '<b>Do not split tiny components.</b> Each chunk is an extra HTTP request and a waterfall step; splitting a 2kB component makes things slower.',
    '<b>Preload on intent.</b> Call the same <code>import()</code> on hover or focus so the chunk is already in flight by the time the user clicks.',
    '<b>Named exports need a shim:</b> <code>lazy(() =&gt; import("./X").then(m =&gt; ({ default: m.X })))</code>.',
    '<b>Pair it with an error boundary.</b> A failed chunk fetch — a deploy mid-session, a flaky network — throws, and without a boundary it blanks the page.',
  ],
  questions: [
    {
      q: 'How does React.lazy work?',
      a: 'It takes a function returning a dynamic <code>import()</code> promise and gives you back a component. On first render, React calls that function, sees a pending promise, and suspends — it stops rendering that subtree and shows the nearest <code>&lt;Suspense&gt;</code> fallback. When the promise resolves, React renders the real component and caches it, so subsequent renders are synchronous.\n\nThe bundler half matters too: webpack, Vite and Rollup all treat a dynamic <code>import()</code> as a split point and emit everything reachable only from that module into a separate chunk. So the component never appears in the main bundle at all.\n\nThe requirement people trip on is that the module must have a <i>default</i> export that is a component — for a named export you map it: <code>import("./X").then(m =&gt; ({ default: m.X }))</code>.',
    },
    {
      q: 'What is Suspense actually doing?',
      a: 'It is a boundary that catches "this subtree is not ready yet" and renders a fallback in its place, without unmounting anything above it.\n\nMechanically, a child signals unreadiness by throwing a promise during render (in newer APIs, via the <code>use</code> hook). React catches it at the nearest <code>Suspense</code> boundary, renders the fallback, and retries the subtree when the promise settles.\n\nThe important part is that it is a <i>general</i> mechanism, not a lazy-loading feature. <code>React.lazy</code> was the first consumer; server components, streaming SSR, and data libraries that integrate with Suspense all use the same protocol. That is why the boundary is declarative — you say where a loading state belongs in the UI, and anything below it that is not ready triggers it.',
    },
    {
      q: 'Where would you put split points in a real application?',
      a: 'I would work outward from the biggest wins.\n\n<b>Per route, first.</b> This is where most of the payoff is and it maps naturally onto how users move through an app — someone on the login page does not need the dashboard\'s code.\n\n<b>Heavy conditional UI, second.</b> A WYSIWYG editor, a charting library, a PDF viewer, a map — anything large that only some users, on some screens, ever open. A modal behind a rarely-clicked button is a classic.\n\n<b>Below-the-fold content, third</b>, if it is substantial.\n\nWhat I would <i>not</i> do is split small components. Each chunk costs a request, and a split inside another lazy chunk creates a waterfall — the browser cannot even start fetching the inner chunk until the outer one has parsed. The rule of thumb is that the chunk should be worth more than the round trip, which in practice means tens of kilobytes, not a few.',
    },
    {
      q: 'How do you avoid the loading spinner flashing on every navigation?',
      a: 'Three techniques, usually combined.\n\n<b>Preload on intent.</b> Fire the same <code>import()</code> on <code>mouseenter</code> or <code>focus</code> of the link. Module imports are cached, so by the time the click lands the chunk is already downloaded and the transition is instant. React Router\'s lazy routes and Next.js\'s <code>&lt;Link&gt;</code> both do a version of this automatically.\n\n<b>Wrap the navigation in <code>startTransition</code>.</b> React then keeps the current screen on-screen while the new one loads, instead of immediately swapping in a fallback — so you show stale-but-useful content rather than a blank skeleton.\n\n<b>Put the boundary lower and make the fallback match the layout.</b> A skeleton with the same dimensions as the real content avoids the layout shift that makes a flash feel jarring.',
    },
    {
      q: 'What happens if the chunk fails to load?',
      a: 'The dynamic import rejects, React re-throws during render, and without an error boundary above it the whole root unmounts — a blank white page.\n\nIt is not a hypothetical: it happens whenever a user has a tab open across a deploy and the hashed filenames they were given no longer exist on the server. It also happens on flaky mobile connections.\n\nSo a lazy boundary should always be paired with an error boundary, and the fallback for a chunk-load error is usually "reload the page", because that fetches the new manifest. Some teams go further and detect the specific chunk-load error to trigger a reload automatically, once, guarding against a reload loop.',
    },
  ],
} satisfies TopicMeta

/* ---------------------------------------------------------------------------
   The split point. Declared at module scope — NOT inside the component.

   If you write `const X = lazy(...)` inside a component body, you create a new
   lazy component on every render, so React unmounts and re-fetches on every
   single render. It is a classic mistake and produces an infinite loading
   spinner.
   --------------------------------------------------------------------------- */
const HeavyPanel = lazy(() => import('./_lib/HeavyPanel'))

// The same import, exposed for preloading. Module imports are cached by the
// browser and the bundler runtime, so calling this early makes the later
// `lazy` resolution instant.
const preloadHeavyPanel = () => import('./_lib/HeavyPanel')

export default function Demo() {
  const [show, setShow] = useState(false)
  const [preloaded, setPreloaded] = useState(false)

  return (
    <div className="stack">
      <Callout>
        Open DevTools &rarr; Network, filter to JS, then press the button. A new
        chunk is fetched at that moment — it was never in the initial bundle.
      </Callout>

      <Panel title="1. lazy + Suspense">
        <div className="row" style={{ marginBottom: 12 }}>
          <button
            className="primary"
            onClick={() => setShow((v) => !v)}
            // PRELOAD ON INTENT. By the time the click happens, the chunk is
            // usually already downloaded, so the fallback never appears.
            onMouseEnter={() => {
              preloadHeavyPanel()
              setPreloaded(true)
            }}
            onFocus={() => {
              preloadHeavyPanel()
              setPreloaded(true)
            }}
          >
            {show ? 'Unmount' : 'Load'} the heavy panel
          </button>
          <span className={`badge ${preloaded ? 'good' : ''}`}>
            {preloaded ? 'chunk preloaded on hover' : 'not yet fetched'}
          </span>
        </div>

        {show && (
          // Every lazy component needs a Suspense boundary above it. Put the
          // boundary where the loading state makes visual sense — often around
          // a whole section rather than a single component.
          <Suspense
            fallback={
              <div className="panel">
                {/* A skeleton matching the real layout prevents the jump that
                    makes loading states feel cheap. */}
                <div className="panel-title">loading chunk…</div>
                <div style={{ height: 90, background: 'var(--bg-raised)', borderRadius: 6 }} />
              </div>
            }
          >
            <HeavyPanel />
          </Suspense>
        )}
      </Panel>

      <Panel title="2. The mistakes">
        <pre>
          <code>{`// ❌ A NEW lazy component every render. Refetches forever.
function Page() {
  const Heavy = lazy(() => import('./Heavy'))
  return <Suspense fallback={null}><Heavy /></Suspense>
}

// ✅ Module scope. Created once.
const Heavy = lazy(() => import('./Heavy'))

// ❌ Named export — resolves to a module, not a component.
const Chart = lazy(() => import('./charts'))

// ✅ Map it to a default.
const Chart = lazy(() => import('./charts').then(m => ({ default: m.Chart })))

// ❌ No error boundary. A failed chunk fetch blanks the page.
<Suspense fallback={<Spinner />}><Heavy /></Suspense>

// ✅ Boundaries come in pairs.
<ErrorBoundary fallback={<p>Failed to load. <button onClick={reload}>Retry</button></p>}>
  <Suspense fallback={<Spinner />}><Heavy /></Suspense>
</ErrorBoundary>`}</code>
        </pre>
      </Panel>

      <Panel title="3. Route-level splitting, the default">
        <pre>
          <code>{`// react-router v6/v7
const Dashboard = lazy(() => import('./routes/Dashboard'))
const Settings  = lazy(() => import('./routes/Settings'))

<Suspense fallback={<PageSkeleton />}>
  <Routes>
    <Route path="/dashboard" element={<Dashboard />} />
    <Route path="/settings"  element={<Settings />} />
  </Routes>
</Suspense>

// Or with the data router, which preloads on hover for you:
{ path: '/dashboard', lazy: () => import('./routes/Dashboard') }`}</code>
        </pre>
        <Callout kind="tip">
          <b>Where to stop.</b> Each chunk is a request and a potential
          waterfall step. Split routes and genuinely heavy features; do not
          split a 2kB button. If a chunk is smaller than the round trip that
          fetches it, you have made the app slower.
        </Callout>
      </Panel>
    </div>
  )
}
