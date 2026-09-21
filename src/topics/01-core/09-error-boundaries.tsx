import { Component, useState } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import type { TopicMeta } from '../../types'
import { Callout, Panel } from '../../lib/ui'

export const meta = {
  title: 'Error boundaries',
  summary:
    'The last remaining reason to write a class component, what boundaries do and do not catch, and where to place them.',
  notes: [
    '<b>An error boundary is a class component</b> implementing <code>static getDerivedStateFromError</code> and/or <code>componentDidCatch</code>. There is still no hook equivalent in React 19.',
    '<b>They catch errors thrown during rendering, in lifecycle methods, and in constructors of the tree below them.</b>',
    '<b>They do NOT catch:</b> errors in event handlers, in <code>setTimeout</code>/<code>requestAnimationFrame</code> callbacks, in async code after an <code>await</code>, during server-side rendering, or thrown by the boundary itself.',
    '<b>Why not event handlers?</b> They do not run during rendering, so React is not in the middle of building a tree and does not need to unmount anything to stay consistent. Use <code>try/catch</code> there.',
    '<b><code>getDerivedStateFromError</code> is the render-phase half</b> — pure, returns the next state. <code>componentDidCatch</code> is the commit-phase half — where logging to Sentry/Datadog goes.',
    '<b>An uncaught render error unmounts the entire root</b> as of React 16. A blank white page is the default, which is why at least one boundary near the root is mandatory in production.',
    '<b>Granularity is a product decision.</b> One boundary per route stops a page crash; one per widget stops a dashboard tile taking down the dashboard.',
    '<b>Recovery needs a remount.</b> Clearing the error state re-renders the same children, which will usually throw again. Pair it with a key change or a refetch — which is what <code>react-error-boundary</code>&rsquo;s <code>resetKeys</code> does.',
  ],
  questions: [
    {
      q: 'What is an error boundary and why must it be a class?',
      a: 'A component that catches JavaScript errors thrown while rendering its subtree and renders a fallback UI instead of letting the error propagate to the root.\n\nIt has to be a class because the two lifecycle methods involved — <code>static getDerivedStateFromError</code> and <code>componentDidCatch</code> — have no hook equivalents, and React has never shipped one. The reason usually given is that a hook version would need to express "catch what my children throw", which does not map onto the hooks model where a hook only sees its own component.\n\nIn practice most teams write one boundary class and never touch it again, or install <code>react-error-boundary</code>, which gives you a hook-friendly API (<code>useErrorBoundary</code>, <code>resetKeys</code>) wrapped around a class.',
    },
    {
      q: 'What do error boundaries not catch?',
      a: 'Four things, and this list is the whole question:\n\n<b>Event handlers.</b> A click handler runs outside the render cycle, so React does not need to bail out of anything to stay consistent. Use <code>try/catch</code>.\n\n<b>Asynchronous code.</b> Anything after an <code>await</code>, in a <code>setTimeout</code>, or in a promise callback has left the React call stack. Catch it and put the error into state, then throw it during render if you want the boundary to take over.\n\n<b>Server-side rendering.</b> Different code path entirely.\n\n<b>Errors thrown by the boundary itself.</b> A boundary cannot catch its own render error — it bubbles to the next boundary above, so keep fallback UI trivially simple.\n\nThe general rule: boundaries catch what happens <i>during React\'s render and commit</i>, nothing else.',
    },
    {
      q: 'How do you get an async error into an error boundary?',
      a: 'Catch it yourself, store it in state, and re-throw it during render:\n\n<code>const [err, setErr] = useState(null)</code>\n<code>if (err) throw err</code>\n\nNow the throw happens inside the render phase, where the boundary can see it. <code>react-error-boundary</code> packages this as <code>useErrorBoundary().showBoundary(error)</code>.\n\nIn practice, though, most async errors are data-fetching errors, and for those a data library is the better answer — React Query and friends already model <code>error</code> as state and can optionally re-throw it for a boundary via <code>throwOnError</code>. Rolling your own throw-in-render is for the cases the library does not cover.',
    },
    {
      q: 'Where would you place error boundaries in a real app?',
      a: 'At least three levels. One at the root, as a last resort, rendering a generic "something went wrong, reload" screen — without it a render error blanks the entire page.\n\nOne per route, so a crash in the settings page does not take down the navigation shell and the user can click elsewhere.\n\nAnd one around any independently-failing widget: dashboard tiles, embedded third-party components, anything rendering user-generated content or data from a flaky service. Each of those should degrade into a small inline "this panel failed" rather than removing the surrounding page.\n\nThe framing I would give: a boundary defines a <i>blast radius</i>. Put them wherever you would be willing to lose one piece of the UI but not the rest.',
    },
    {
      q: 'How do you let the user recover from an error?',
      a: 'Resetting the boundary\'s state is necessary but not sufficient — it just re-renders the same children with the same props, which usually throws immediately again.\n\nThe reset has to be paired with something that changes the input: refetch the data, change a key so the subtree remounts fresh, or navigate away. <code>react-error-boundary</code> formalises this with <code>resetKeys</code> — the boundary clears itself automatically when a value in that array changes — plus an <code>onReset</code> callback where you trigger the refetch.\n\nFor the root boundary, honestly, a "reload the page" button is a legitimate answer and often the most reliable one.',
    },
  ],
} satisfies TopicMeta

/* ---------------------------------------------------------------------------
   The boundary. Note that it is the ONLY class component in this whole project,
   which is itself the answer to "when do you still write classes?".
   --------------------------------------------------------------------------- */
type BoundaryProps = {
  children: ReactNode
  /** Changing any of these clears the error and retries. */
  resetKey?: unknown
}
type BoundaryState = { error: Error | null }

class Boundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null }

  // RENDER PHASE. Must be pure — no logging, no side effects, no setState.
  // Its only job is to map the error to the next state.
  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error }
  }

  // COMMIT PHASE. This is where side effects belong. In a real app:
  //   Sentry.captureException(error, { contexts: { react: info } })
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Boundary] caught during render:', error.message, info.componentStack)
  }

  // Clearing the error alone is not enough — the parent also bumps `resetKey`,
  // which remounts the children with fresh props. Without that, the child
  // throws again on the very next render.
  componentDidUpdate(prev: BoundaryProps) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null })
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="callout trap">
          <b>Fallback UI.</b> Caught: <code>{this.state.error.message}</code>
        </div>
      )
    }
    return this.props.children
  }
}

/** Throws during RENDER — the boundary catches this. */
function ThrowsOnRender({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('Cannot read properties of undefined (reading "name")')
  return <span className="badge good">rendering fine</span>
}

/** Throws in an EVENT HANDLER — the boundary does NOT catch this. */
function ThrowsInHandler() {
  const [caught, setCaught] = useState<string | null>(null)
  return (
    <div className="col">
      <button
        className="danger"
        onClick={() => {
          try {
            throw new Error('exploded in onClick')
          } catch (e) {
            // Without this try/catch the error goes straight to window.onerror.
            // The boundary above never sees it.
            setCaught((e as Error).message)
          }
        }}
      >
        throw inside onClick
      </button>
      <span className="mono" style={{ fontSize: 13 }}>
        {caught ? `caught by try/catch: "${caught}"` : 'not thrown yet'}
      </span>
    </div>
  )
}

/** The async case: catch, store, re-throw during render. */
function ThrowsAsync() {
  const [error, setError] = useState<Error | null>(null)

  // THIS is the trick. The throw now happens in the render phase, which is
  // where the boundary is listening.
  if (error) throw error

  return (
    <button
      className="danger"
      onClick={() => {
        setTimeout(() => {
          // A bare `throw` here would escape React entirely.
          setError(new Error('async failure, re-thrown during render'))
        }, 300)
      }}
    >
      throw in setTimeout → boundary
    </button>
  )
}

export default function Demo() {
  const [shouldThrow, setShouldThrow] = useState(false)
  const [resetKey, setResetKey] = useState(0)

  return (
    <div className="stack">
      <Panel title="1. A render error — caught">
        <div className="row" style={{ marginBottom: 10 }}>
          <button className="danger" onClick={() => setShouldThrow(true)} disabled={shouldThrow}>
            make the child throw
          </button>
          <button
            onClick={() => {
              setShouldThrow(false)
              setResetKey((k) => k + 1)
            }}
            disabled={!shouldThrow}
          >
            reset (fix the input + bump resetKey)
          </button>
        </div>
        <Boundary resetKey={resetKey}>
          <ThrowsOnRender shouldThrow={shouldThrow} />
        </Boundary>
        <Callout kind="tip">
          Resetting does two things: it fixes the <i>cause</i>{' '}
          (<code>shouldThrow=false</code>) and bumps <code>resetKey</code> so the
          boundary clears. Clearing alone would just throw again.
        </Callout>
      </Panel>

      <div className="grid2">
        <Panel title="2. An event handler error — NOT caught">
          <Boundary>
            <ThrowsInHandler />
          </Boundary>
          <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 8 }}>
            The boundary is right there and does nothing. Handlers run outside
            the render cycle.
          </div>
        </Panel>

        <Panel title="3. An async error — caught, via re-throw">
          <Boundary>
            <ThrowsAsync />
          </Boundary>
          <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 8 }}>
            <code>setError(e)</code> then <code>if (error) throw error</code> in
            the body moves the throw into the render phase.
          </div>
        </Panel>
      </div>
    </div>
  )
}
