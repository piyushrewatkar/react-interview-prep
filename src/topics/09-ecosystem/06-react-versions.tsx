import { useState } from 'react'
import type { TopicMeta } from '../../types'
import { Callout, Panel } from '../../lib/ui'

export const meta = {
  title: 'React 18 & 19: what actually changed',
  summary:
    '“What is new in the latest React?” — the version history a five-year developer is expected to have lived through, and the migration gotchas.',
  notes: [
    '<b>React 16 (2017)</b> — the Fiber rewrite, error boundaries, portals, fragments, returning arrays from render.',
    '<b>React 16.8 (2019)</b> — hooks. The largest change to how React code is written.',
    '<b>React 17 (2020)</b> — deliberately no new features. Event delegation moved from <code>document</code> to the root container, and the new JSX transform removed the need to import React.',
    '<b>React 18 (2022)</b> — concurrent rendering. <code>createRoot</code>, automatic batching everywhere, <code>useTransition</code>, <code>useDeferredValue</code>, <code>useId</code>, <code>useSyncExternalStore</code>, streaming SSR with selective hydration.',
    '<b>React 19 (2024)</b> — Actions, the <code>use</code> hook, <code>useOptimistic</code>, <code>useActionState</code>, <code>ref</code> as a plain prop, document metadata hoisting, and Server Components as a stable API.',
    '<b>Removed in 19:</b> <code>ReactDOM.render</code>, <code>defaultProps</code> on function components, legacy string refs, <code>propTypes</code>, and the legacy context API.',
    '<b>The React Compiler</b> memoises automatically at build time, which makes most manual <code>useMemo</code>/<code>useCallback</code> unnecessary.',
    '<b>The through-line:</b> React has spent seven years making rendering interruptible and moving work to the server. Every feature above is one of those two.',
  ],
  questions: [
    {
      q: 'What was the headline change in React 18?',
      a: 'Concurrent rendering, and the fact that it is opt-in via <code>createRoot</code> rather than a flag.\n\nBefore 18, once a render started it ran to completion — a single uninterruptible unit of work. React 18 made the render phase interruptible, so React can start rendering, notice something more urgent arrived, abandon that work, handle the urgent update, and restart.\n\nEverything else in the release is downstream of that. <code>useTransition</code> and <code>useDeferredValue</code> are how you mark work as interruptible. Automatic batching everywhere became possible because React controls the scheduling. Streaming SSR with selective hydration lets parts of the page hydrate independently and prioritises whichever the user just interacted with. And <code>useSyncExternalStore</code> exists because concurrent rendering made tearing possible, so external stores needed a safe way in.\n\nThe practical migration notes: switch <code>ReactDOM.render</code> to <code>createRoot</code>, expect StrictMode to double-invoke your effects in development, and audit any code that relied on updates outside event handlers not being batched.',
    },
    {
      q: 'What are Actions in React 19?',
      a: 'A built-in convention for handling async mutations — the form-submission flow that every app was hand-rolling.\n\nYou pass an async function to a form\'s <code>action</code> prop, and React handles the surrounding machinery: <code>useActionState</code> gives you the pending flag, the result and the error; <code>useFormStatus</code> lets a nested submit button read the parent form\'s pending state without prop drilling; <code>useOptimistic</code> gives you a temporary optimistic value that reverts automatically when the action settles.\n\nThe thing to emphasise is what disappears. The manual <code>isSubmitting</code> state, the try/catch storing an error, the optimistic-update rollback path, and the input reset on success — React does all of it.\n\nIt was designed alongside Server Actions, where the function passed to <code>action</code> runs on the server, but the client-side hooks work on their own with any async function.',
    },
    {
      q: 'What does the `use` hook do differently?',
      a: 'It reads a resource — a promise or a context — and it is the first hook that can be called conditionally.\n\n<code>const data = use(promise)</code> suspends the component until the promise resolves, integrating with the nearest <code>Suspense</code> boundary. <code>const theme = use(ThemeContext)</code> reads context like <code>useContext</code>.\n\nThe interesting part is that it is exempt from the "no conditional hooks" rule — you can call it inside an <code>if</code> or after an early return. That is possible because it does not allocate a hook slot in the fiber\'s ordered list the way <code>useState</code> does; it resolves a value that is already identified by the resource you pass in.\n\nThe practical caveat: do not create the promise during render, because a new promise every render means suspending forever. The promise should come from a cache, a server component, or somewhere stable.',
    },
    {
      q: 'What was removed in React 19, and what breaks?',
      a: '<code>ReactDOM.render</code> and <code>ReactDOM.hydrate</code> are gone — you must use <code>createRoot</code> and <code>hydrateRoot</code>. Anything still on the legacy root stops working.\n\n<code>defaultProps</code> on function components is gone; use default parameter values. Class components keep it.\n\n<code>propTypes</code> is gone — React no longer checks it, so those runtime warnings silently stop. TypeScript is the replacement.\n\nLegacy string refs (<code>ref="input"</code>) and the legacy context API are gone, both long deprecated.\n\nAnd <code>forwardRef</code> is deprecated rather than removed, since <code>ref</code> is now an ordinary prop on function components.\n\nIn practice the migration is usually smooth if you were already on 18 with <code>createRoot</code> and no deprecation warnings. The one that catches people is <code>propTypes</code> disappearing quietly — code that was relying on those warnings to catch bad props loses the safety net without any error.',
    },
    {
      q: 'What is the React Compiler and should you use it?',
      a: 'A build-time optimising compiler that inserts memoisation automatically. It analyses your components, works out which values and callbacks are stable, and generates the equivalent of <code>useMemo</code> and <code>useCallback</code> — for everything, not just the places a human bothered to annotate.\n\nThe argument for it is that manual memoisation exists only because React could not previously know what was stable. It is easy to get wrong (a missing dependency is a stale-closure bug, an extra one is a useless memo), it clutters the code, and most people either under-apply or over-apply it.\n\nIt relies on your components following the Rules of React — being pure, not mutating props or state during render. The accompanying ESLint rule tells you where you do not comply, and the compiler skips components it cannot prove are safe rather than breaking them.\n\nOn whether to use it: it is worth enabling on a new project or one with good lint hygiene, and the guidance once adopted is to remove the manual memos. On a large legacy codebase I would run the lint rule first and see how much does not comply before committing.',
    },
  ],
} satisfies TopicMeta

type Version = '16' | '16.8' | '17' | '18' | '19'

const VERSIONS: Record<
  Version,
  { year: string; headline: string; added: string[]; removed?: string[]; why: string }
> = {
  '16': {
    year: '2017',
    headline: 'The Fiber rewrite',
    added: [
      'Fiber reconciler — the tree walk becomes a linked list, so rendering can be paused',
      'Error boundaries (getDerivedStateFromError, componentDidCatch)',
      'Portals',
      'Fragments, and returning arrays and strings from render',
      'Better SSR performance',
    ],
    why: 'Nothing user-visible changed much, but Fiber is the foundation everything since is built on. Without a rendering loop that can be interrupted, there is no Suspense and no concurrent mode.',
  },
  '16.8': {
    year: '2019',
    headline: 'Hooks',
    added: [
      'useState, useEffect, useContext, useReducer, useMemo, useCallback, useRef',
      'Custom hooks — stateful logic reuse without wrapper components',
      'Function components become the default way to write React',
    ],
    why: 'The largest change to how React code is written. HOCs and render props existed to share stateful logic; hooks did it without adding components to the tree, so wrapper hell and prop collisions simply went away.',
  },
  '17': {
    year: '2020',
    headline: 'Deliberately no new features',
    added: [
      'Event delegation moved from document to the root container',
      'The new JSX transform — no more `import React from "react"`',
      'Cleaner errors with component stacks',
    ],
    why: 'A "stepping stone" release, designed so that two versions of React could coexist on one page. That made gradual upgrades possible for large applications, which is why it exists at all.',
  },
  '18': {
    year: '2022',
    headline: 'Concurrent rendering',
    added: [
      'createRoot — the opt-in to everything below',
      'Automatic batching everywhere, not just in React event handlers',
      'useTransition and useDeferredValue',
      'useId — SSR-stable identifiers',
      'useSyncExternalStore — tearing-safe subscriptions for store libraries',
      'Streaming SSR with selective hydration',
      'StrictMode double-invokes effects in development',
    ],
    removed: ['ReactDOM.render still worked, but in legacy mode with concurrency off'],
    why: 'Rendering became interruptible. React can abandon in-progress work when something more urgent arrives, which is what stops a slow render blocking typing. Everything in the list is either how you opt in, or a consequence of it.',
  },
  '19': {
    year: '2024',
    headline: 'Actions, and the server',
    added: [
      'Actions — pass an async function to a form’s action prop',
      'useActionState — pending, result and error for an action',
      'useFormStatus — a nested button reads the parent form’s pending state',
      'useOptimistic — an optimistic value that reverts automatically',
      'use(promise) / use(context) — the first conditionally-callable hook',
      'ref as a plain prop; forwardRef deprecated',
      'Document metadata (<title>, <meta>, <link>) hoisted automatically',
      'Server Components stable',
      'Better hydration error messages with a real diff',
    ],
    removed: [
      'ReactDOM.render and ReactDOM.hydrate',
      'defaultProps on function components',
      'propTypes — no longer checked at all',
      'Legacy string refs and the legacy context API',
    ],
    why: 'Two themes. Actions remove the boilerplate around async mutations — the isSubmitting flag, the error state, the optimistic rollback. And Server Components move rendering back to the server, so a component’s code never has to reach the browser at all.',
  },
}

export default function Demo() {
  const [version, setVersion] = useState<Version>('18')
  const v = VERSIONS[version]

  return (
    <div className="stack">
      <Panel title="The version history">
        <div className="row" style={{ marginBottom: 14 }}>
          {(Object.keys(VERSIONS) as Version[]).map((k) => (
            <button key={k} className={version === k ? 'primary' : ''} onClick={() => setVersion(k)}>
              React {k}
            </button>
          ))}
        </div>

        <div className="row" style={{ marginBottom: 10 }}>
          <h3 style={{ margin: 0, fontSize: 18 }}>{v.headline}</h3>
          <span className="badge">{v.year}</span>
        </div>

        <div className="panel">
          <div className="panel-title" style={{ color: 'var(--good)' }}>
            added
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.8 }}>
            {v.added.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>

        {v.removed && (
          <div className="panel" style={{ marginTop: 10 }}>
            <div className="panel-title" style={{ color: 'var(--bad)' }}>
              removed / deprecated
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.8 }}>
              {v.removed.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        )}

        <Callout kind="tip">
          <b>Why it mattered:</b> {v.why}
        </Callout>
      </Panel>

      <Panel title="React 19, in code">
        <pre>
          <code>{`// ── Actions ──────────────────────────────────────────────────────────
function SignUp() {
  const [state, formAction, isPending] = useActionState(
    async (prevState, formData) => {
      try {
        await createUser(formData.get('email'))
        return { ok: true }
      } catch (e) {
        return { ok: false, error: e.message }   // returned, not thrown
      }
    },
    { ok: false }
  )

  return (
    <form action={formAction}>            {/* not onSubmit */}
      <input name="email" />
      <SubmitButton />                     {/* reads pending, no props */}
      {state.error && <p role="alert">{state.error}</p>}
    </form>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()     // reads the PARENT form's state
  return <button disabled={pending}>{pending ? 'Saving…' : 'Sign up'}</button>
}

// Gone: an isSubmitting useState, a try/catch storing the error,
//       manual input reset, and prop-drilling pending to the button.


// ── use() — the first conditionally-callable hook ────────────────────
function Comments({ commentsPromise }) {
  if (!commentsPromise) return null       // early return, then a hook — legal
  const comments = use(commentsPromise)   // suspends until it resolves
  return comments.map(c => <Comment key={c.id} {...c} />)
}
// ⚠️ Do not CREATE the promise in render — a new promise each render
//    suspends forever. It must come from a cache or a server component.


// ── ref is a plain prop ──────────────────────────────────────────────
function Input({ ref, ...props }) {       // 19
  return <input ref={ref} {...props} />
}
const Input = forwardRef((props, ref) =>  // pre-19
  <input ref={ref} {...props} />
)


// ── Metadata hoists automatically ────────────────────────────────────
function Article({ post }) {
  return (
    <article>
      <title>{post.title}</title>         {/* moved into <head> for you */}
      <meta name="description" content={post.excerpt} />
      <h1>{post.title}</h1>
    </article>
  )
}
// react-helmet, for most use cases, is no longer needed.`}</code>
        </pre>
      </Panel>

      <Panel title="The through-line">
        <pre>
          <code>{`2017  Fiber            make rendering INTERRUPTIBLE
2019  Hooks            make LOGIC composable
2020  React 17         make UPGRADES gradual
2022  Concurrent       actually USE the interruptibility
2024  RSC + Actions    move WORK back to the server
20xx  Compiler         make OPTIMISATION automatic

Two sentences that answer "where is React going?":

  "React spent years making rendering interruptible so that expensive
   work never blocks the user — that is Fiber, then concurrent mode,
   then transitions.

   Now it is moving work off the client entirely — Server Components so
   code never ships, Actions so mutation boilerplate disappears, and the
   Compiler so memoisation stops being a manual chore."`}</code>
        </pre>
      </Panel>

      <Callout>
        <b>This project runs React 19</b> with <code>createRoot</code> and
        StrictMode. Several topics — <code>useOptimistic</code>,{' '}
        <code>ref</code> as a prop, <code>useTransition</code>,{' '}
        <code>useSyncExternalStore</code> — are live demonstrations of the
        features listed above.
      </Callout>
    </div>
  )
}
