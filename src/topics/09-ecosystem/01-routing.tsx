import { Link, Navigate, Outlet, Route, Routes, useParams, useSearchParams } from 'react-router-dom'
import { useState } from 'react'
import type { TopicMeta } from '../../types'
import { Callout, Panel } from '../../lib/ui'

export const meta = {
  title: 'Routing with React Router',
  summary:
    'Nested routes and layouts, URL params vs search params, protected routes, and why loaders changed how data fetching works.',
  notes: [
    '<b>Nested routes mirror nested UI.</b> A parent route renders a layout and an <code>&lt;Outlet /&gt;</code>; children render into that outlet. The URL structure and the component structure stay in sync.',
    '<b>A layout route has no <code>path</code></b> — it exists purely to wrap children in shared chrome without adding a URL segment.',
    '<b><code>useParams</code> for path segments</b> (<code>/users/:id</code> → identity) and <b><code>useSearchParams</code> for query strings</b> (<code>?sort=name</code> → modifiers).',
    '<b>Search params are state.</b> Filters, sort, pagination and the active tab belong there, not in <code>useState</code> — then the back button works and links are shareable.',
    '<b><code>&lt;Link&gt;</code>, not <code>&lt;a&gt;</code></b>, for internal navigation. A raw anchor causes a full page reload and loses all client state.',
    '<b>Protected routes are a layout route that conditionally redirects</b> — and <code>&lt;Navigate replace /&gt;</code> so the login page does not end up in the back history.',
    '<b>Data routers (v6.4+) introduced loaders and actions</b>: fetch before the route renders, which removes the render-then-fetch waterfall and the loading state from the component.',
    '<b>Route-level code splitting is the default win</b> — <code>lazy: () =&gt; import("./Route")</code> on a data router, preloaded on hover.',
  ],
  questions: [
    {
      q: 'How do nested routes work, and what is Outlet?',
      a: 'A route can have child routes, and the resulting component tree nests the same way the URL does. The parent renders shared chrome — a header, a sidebar, a tab bar — and places <code>&lt;Outlet /&gt;</code> wherever the child should appear. React Router renders the matched child into that outlet.\n\nSo <code>/settings/profile</code> renders the settings layout <i>and</i> the profile panel inside it. Navigating to <code>/settings/billing</code> swaps only the inner part; the layout does not remount, so its state, scroll position and any in-flight work survive.\n\nA route with no <code>path</code> is a "layout route": it adds a wrapper without adding a URL segment, which is how you apply a layout or an auth guard to a group of routes.\n\nThe payoff is that URL structure and UI structure stop drifting apart — you can read the route config and know what the page looks like.',
    },
    {
      q: 'When do you use route params versus search params?',
      a: 'Path params identify <i>what</i> resource you are looking at; search params modify <i>how</i> you are looking at it.\n\n<code>/users/42</code> — the 42 is the identity. Remove it and the route is meaningless. That is a path param, read with <code>useParams</code>.\n\n<code>/users?sort=name&amp;page=3&amp;role=admin</code> — all optional modifiers. Remove them and you still have a valid page. Those are search params, read with <code>useSearchParams</code>.\n\nThe important habit is putting more in search params than instinct suggests. Filters, sort order, pagination, the active tab, the expanded row, which modal is open — all of it. The moment it lives in the URL, the back button works correctly, a refresh preserves the view, and users can share a link to exactly what they are looking at. All of that is free, and it deletes a pile of <code>useState</code> plus the effects that were syncing them.',
    },
    {
      q: 'How do you implement a protected route?',
      a: 'As a layout route that checks auth and either renders <code>&lt;Outlet /&gt;</code> or redirects.\n\n<code>function RequireAuth() { const { user, isLoading } = useAuth(); const location = useLocation(); if (isLoading) return &lt;Spinner /&gt;; if (!user) return &lt;Navigate to="/login" state={{ from: location }} replace /&gt;; return &lt;Outlet /&gt; }</code>\n\nThree details matter. The <code>isLoading</code> check prevents a flash of the login page while auth resolves — without it, every refresh bounces the user to login and back. The <code>replace</code> prop keeps the protected URL out of the history stack, so pressing back from login does not loop. And passing <code>location</code> in state lets the login page send them where they were originally going.\n\nAnd the caveat I would always add: this is UX, not security. The route config and the code are in the browser. The server must authorise every request regardless.',
    },
    {
      q: 'What did loaders change?',
      a: 'They moved data fetching out of the component and ahead of rendering.\n\nWith a <code>useEffect</code> fetch, the sequence is: navigate → render the component → the effect runs → request starts → spinner → data arrives → re-render. And if that component renders a child that also fetches, the child\'s request cannot start until the parent has rendered — a waterfall that gets worse with every level.\n\nWith a loader, React Router starts the fetch as soon as navigation begins, in parallel for every matched route in the tree, and only renders once the data is there. The component receives it from <code>useLoaderData</code> and has no loading state at all.\n\nThe secondary benefits are substantial: errors go to the route\'s <code>errorElement</code> rather than needing per-component handling, <code>&lt;Form&gt;</code> plus an <code>action</code> gives you mutations with automatic revalidation, and the framework can prefetch a route\'s data on link hover.\n\nIt is the same idea as Remix\'s loaders and Next\'s server components: fetch where you route, not where you render.',
    },
    {
      q: 'Why can you not use a plain anchor tag for internal links?',
      a: 'Because an <code>&lt;a href&gt;</code> triggers a full document navigation. The browser tears down the page, re-downloads and re-parses the JavaScript bundle, and the app boots from scratch — losing all in-memory state, every cache, and any unsaved input. On a slow connection that is seconds instead of milliseconds.\n\n<code>&lt;Link&gt;</code> renders a real anchor — so middle-click, Cmd-click, right-click and screen readers all behave correctly — but intercepts the plain left-click, calls <code>history.pushState</code>, and lets the router swap the matched components. No reload, no reboot.\n\nThe exceptions are genuine: external URLs, downloads, and anything that should leave the SPA. For those, a plain anchor is correct.',
    },
  ],
} satisfies TopicMeta

/* ===========================================================================
   A nested router, rendered INSIDE this topic page.

   This works because the topic route in App.tsx is declared as `/t/:id/*` —
   the splat tells React Router that this route does not consume the whole URL,
   leaving the remainder for these nested <Routes> to match. Without it, none
   of the links below would resolve.

   All paths here are RELATIVE, so they resolve against the current topic URL.
   =========================================================================== */

const PRODUCTS = [
  { id: 'kbd', name: 'Mechanical keyboard', price: 89, category: 'peripherals' },
  { id: 'mon', name: '27-inch monitor', price: 340, category: 'displays' },
  { id: 'mse', name: 'Ergonomic mouse', price: 45, category: 'peripherals' },
]

/** A LAYOUT ROUTE. It renders shared chrome plus an <Outlet /> for children. */
function ShopLayout() {
  return (
    <div className="panel" style={{ background: 'var(--bg-raised)' }}>
      <div className="row" style={{ marginBottom: 12 }}>
        <span className="badge">layout: ShopLayout</span>
        {/* Relative links: resolved against the parent route's path. */}
        <Link to="products">Products</Link>
        <Link to="products?sort=price">Products (sorted)</Link>
        <Link to="account">Account</Link>
      </div>
      {/* The matched child renders HERE. Navigating between children does not
          remount this layout — its state survives. */}
      <Outlet />
    </div>
  )
}

function ProductList() {
  // Search params = state that lives in the URL. Change the sort and the back
  // button undoes it, and the link is shareable.
  const [searchParams, setSearchParams] = useSearchParams()
  const sort = searchParams.get('sort') ?? 'name'

  const sorted = [...PRODUCTS].sort((a, b) =>
    sort === 'price' ? a.price - b.price : a.name.localeCompare(b.name),
  )

  return (
    <div className="col">
      <div className="row">
        <span className="mono" style={{ fontSize: 13 }}>
          sort={sort}
        </span>
        <button
          onClick={() =>
            // Setting search params IS a navigation — it pushes history.
            setSearchParams((prev) => {
              prev.set('sort', sort === 'price' ? 'name' : 'price')
              return prev
            })
          }
        >
          sort by {sort === 'price' ? 'name' : 'price'}
        </button>
      </div>
      <div className="col" style={{ gap: 4 }}>
        {sorted.map((p) => (
          // A path param: `:productId` identifies WHICH product.
          <Link key={p.id} to={p.id} style={{ fontSize: 13 }}>
            {p.name} — £{p.price}
          </Link>
        ))}
      </div>
    </div>
  )
}

function ProductDetail() {
  // A path param. `/products/kbd` → { productId: 'kbd' }
  const { productId } = useParams<{ productId: string }>()
  const product = PRODUCTS.find((p) => p.id === productId)

  if (!product) {
    return (
      <div className="callout trap">
        No product &ldquo;{productId}&rdquo;. <Link to="..">Back to the list</Link>
      </div>
    )
  }

  return (
    <div className="col">
      <Link to=".." style={{ fontSize: 13 }}>
        ← back
      </Link>
      <div className="mono">
        {product.name} · £{product.price} · {product.category}
      </div>
      <span className="badge">
        useParams() → {'{'} productId: &quot;{productId}&quot; {'}'}
      </span>
    </div>
  )
}

/** A guard, implemented as a layout route. */
function RequireAuth({ isLoggedIn }: { isLoggedIn: boolean }) {
  if (!isLoggedIn) {
    // `replace` keeps the protected URL out of the history stack, so pressing
    // back from the redirect target does not bounce the user in a loop.
    return <Navigate to="../products" replace />
  }
  return <Outlet />
}

function Account() {
  return <div className="callout tip">🔐 Account settings — only rendered when signed in.</div>
}

export default function Demo() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  return (
    <div className="stack">
      <Callout>
        The router below is nested <i>inside</i> this page. Click the links and
        watch the browser URL — this is real routing, not a simulation.
      </Callout>

      <Panel title="A working nested router">
        <div className="row" style={{ marginBottom: 12 }}>
          <button className="primary" onClick={() => setIsLoggedIn((v) => !v)}>
            {isLoggedIn ? 'Sign out' : 'Sign in'}
          </button>
          <span className={`badge ${isLoggedIn ? 'good' : 'bad'}`}>
            {isLoggedIn ? 'authenticated' : 'anonymous'}
          </span>
          <span className="muted" style={{ fontSize: 13 }}>
            Try &ldquo;Account&rdquo; while signed out.
          </span>
        </div>

        <Routes>
          {/* A layout route: no path of its own, just shared chrome. */}
          <Route element={<ShopLayout />}>
            {/* index = what renders at the parent's own path */}
            <Route index element={<div className="muted">Pick a link above.</div>} />

            <Route path="products">
              <Route index element={<ProductList />} />
              {/* :productId is a PATH PARAM */}
              <Route path=":productId" element={<ProductDetail />} />
            </Route>

            {/* Guard applied to a group by nesting them under it. */}
            <Route element={<RequireAuth isLoggedIn={isLoggedIn} />}>
              <Route path="account" element={<Account />} />
            </Route>

            <Route path="*" element={<div className="muted">Nothing here.</div>} />
          </Route>
        </Routes>
      </Panel>

      <Panel title="The route config, and what it produces">
        <pre>
          <code>{`<Routes>
  <Route element={<ShopLayout />}>            {/* layout route — no path */}
    <Route index element={<Home />} />         {/* the parent's own path   */}

    <Route path="products">
      <Route index element={<ProductList />} />
      <Route path=":productId" element={<ProductDetail />} />
    </Route>

    <Route element={<RequireAuth />}>          {/* guard a whole group     */}
      <Route path="account" element={<Account />} />
    </Route>

    <Route path="*" element={<NotFound />} />  {/* catch-all               */}
  </Route>
</Routes>

/products          → <ShopLayout><ProductList /></ShopLayout>
/products/kbd      → <ShopLayout><ProductDetail /></ShopLayout>
/account           → <ShopLayout><RequireAuth><Account /></RequireAuth></ShopLayout>

// Navigating /products → /products/kbd swaps only the Outlet's content.
// ShopLayout does NOT remount, so its state and scroll position survive.`}</code>
        </pre>
      </Panel>

      <Panel title="Params vs search params">
        <table className="data">
          <thead>
            <tr>
              <th />
              <th>Path param</th>
              <th>Search param</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Looks like</td>
              <td className="mono">/users/42</td>
              <td className="mono">/users?sort=name&amp;page=3</td>
            </tr>
            <tr>
              <td>Read with</td>
              <td className="mono">useParams()</td>
              <td className="mono">useSearchParams()</td>
            </tr>
            <tr>
              <td>Answers</td>
              <td>
                <b>What</b> am I looking at? Identity.
              </td>
              <td>
                <b>How</b> am I looking at it? Modifiers.
              </td>
            </tr>
            <tr>
              <td>Optional?</td>
              <td>No — remove it and the route is meaningless.</td>
              <td>Yes — all of them, always.</td>
            </tr>
            <tr>
              <td>Use for</td>
              <td>Resource ids, slugs.</td>
              <td>Filters, sort, pagination, active tab, open modal.</td>
            </tr>
          </tbody>
        </table>
        <Callout kind="tip">
          <b>Put more in search params than feels natural.</b> Every piece of
          view state you move out of <code>useState</code> and into the URL
          gives you a working back button, a refresh-safe page and shareable
          links — for free, and with less code.
        </Callout>
      </Panel>

      <Panel title="Loaders: fetching where you route">
        <pre>
          <code>{`// ❌ Render-then-fetch. Navigate → render → effect → request → spinner.
//    And a child that also fetches cannot start until the parent rendered.
function Product() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  useEffect(() => { fetchProduct(id).then(setData) }, [id])
  if (!data) return <Spinner />
  return <Detail product={data} />
}

// ✅ Fetch-then-render. The request starts when navigation starts, in
//    parallel for every matched route. No loading state in the component.
const router = createBrowserRouter([
  {
    path: '/products/:id',
    loader: ({ params }) => fetchProduct(params.id),
    element: <Product />,
    errorElement: <ProductError />,       // errors land here automatically
    lazy: () => import('./Product'),      // route-level code splitting
  },
])

function Product() {
  const product = useLoaderData()         // already here
  return <Detail product={product} />
}

// Mutations get the same treatment: <Form method="post"> hits the route's
// action, and React Router revalidates the affected loaders afterwards.`}</code>
        </pre>
      </Panel>
    </div>
  )
}
