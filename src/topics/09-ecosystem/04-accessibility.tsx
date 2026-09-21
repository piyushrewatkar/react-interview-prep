import { useEffect, useRef, useState } from 'react'
import type { TopicMeta } from '../../types'
import { Callout, Panel } from '../../lib/ui'

export const meta = {
  title: 'Accessibility in React',
  summary:
    'Semantic HTML first, the ARIA rules that actually matter, focus management in a SPA, and how to answer "how do you make a React app accessible?".',
  notes: [
    '<b>Rule one: use the right element.</b> A <code>&lt;button&gt;</code> gives you keyboard activation, focus, the correct role and Enter/Space handling for free. A <code>&lt;div onClick&gt;</code> gives you none of it.',
    '<b>The first rule of ARIA is not to use ARIA.</b> If a native element does the job, use it — bad ARIA is worse than no ARIA, because it overrides what assistive tech would otherwise infer correctly.',
    '<b>Every input needs a real <code>&lt;label htmlFor&gt;</code>.</b> A placeholder is not a label: it vanishes on focus and is inconsistently announced.',
    '<b>Images need <code>alt</code>.</b> Descriptive if meaningful, <code>alt=""</code> if purely decorative — omitting it entirely makes screen readers read the filename.',
    '<b>Never remove focus outlines without replacing them.</b> <code>:focus-visible</code> gives you a keyboard-only ring, which is what people actually wanted when they wrote <code>outline: none</code>.',
    '<b>SPAs break focus and announcements on navigation.</b> After a route change, move focus to the new page heading and announce the page title in a live region.',
    '<b>Dynamic content needs a live region</b> — <code>role="status"</code> for polite updates, <code>role="alert"</code> for urgent ones. Without it, a screen reader user never learns the form failed.',
    '<b>Colour is never the only signal</b>, contrast must be at least 4.5:1 for body text, and every interaction must work by keyboard alone.',
  ],
  questions: [
    {
      q: 'How do you make a React application accessible?',
      a: 'The largest single factor is semantic HTML, and it is mostly free. Use <code>&lt;button&gt;</code> for actions, <code>&lt;a href&gt;</code> for navigation, <code>&lt;nav&gt;</code>, <code>&lt;main&gt;</code>, <code>&lt;h1&gt;</code>–<code>&lt;h6&gt;</code> in a sensible order, real <code>&lt;form&gt;</code> and <code>&lt;label&gt;</code> elements. That alone gives you roles, keyboard behaviour, focus management and screen-reader semantics without writing any ARIA.\n\nThen the things React specifically breaks. Client-side routing does not move focus or announce the new page, so you handle that yourself. Modals and dropdowns rendered through portals need focus trapping and restoration. Content that appears asynchronously — validation errors, toasts, search results — needs a live region or nobody hears about it.\n\nThen the general discipline: keyboard operability for everything, visible focus indicators, 4.5:1 contrast, and never using colour as the only signal.\n\nAnd tooling: <code>eslint-plugin-jsx-a11y</code> catches a surprising amount at write time, <code>axe DevTools</code> catches more in the browser, and <code>jest-axe</code> catches regressions in CI. None of them replace tabbing through the page yourself with a screen reader on.',
    },
    {
      q: 'Why is a div with an onClick handler a problem?',
      a: 'Because a <code>div</code> is not interactive, and you lose five things at once.\n\nIt is not focusable, so a keyboard user can never reach it. It has no role, so a screen reader announces nothing useful. It does not respond to Enter or Space. It does not appear in the list of buttons that screen reader users navigate by. And it does not get the disabled semantics, form submission behaviour or focus ring that a button has.\n\nYou can patch all of it — <code>role="button"</code>, <code>tabIndex={0}</code>, an <code>onKeyDown</code> handling both Enter and Space, plus <code>aria-disabled</code> and manual focus styling — and that is four lines to reimplement, imperfectly, what <code>&lt;button&gt;</code> does for free.\n\nThe usual reason people reach for a div is styling, and the answer there is <code>all: unset</code> or a CSS reset on the button, not a different element.',
    },
    {
      q: 'What breaks in a single-page app that works fine with server-rendered pages?',
      a: 'Three things, all related to navigation no longer being a real page load.\n\n<b>Focus.</b> A full page load resets focus to the top of the document. A client-side route change does not, so focus stays on the link the user just activated — which is often now unmounted, meaning focus falls back to <code>&lt;body&gt;</code> and keyboard navigation starts from nowhere. The fix is to move focus to the new page\'s <code>&lt;h1&gt;</code> (with <code>tabIndex={-1}</code>) after navigation.\n\n<b>Announcements.</b> A browser announces the new page title on load. Client-side routing does not, so a screen reader user gets no indication anything happened. The fix is to update <code>document.title</code> and announce it in a polite live region.\n\n<b>Scroll position.</b> Browsers restore it on back/forward; most routers need to be told.\n\nAll three are the kind of thing that never comes up until someone tests with a keyboard, which is why they are worth naming explicitly in an interview.',
    },
    {
      q: 'What does a modal need to be accessible?',
      a: 'A portal gets you out of the CSS containment problem and nothing else. The rest is on you:\n\n<code>role="dialog"</code> and <code>aria-modal="true"</code>, plus an accessible name via <code>aria-labelledby</code> pointing at the heading.\n\nFocus moves into the dialog on open — usually the first focusable element or the dialog itself — and returns to the trigger on close. Losing the trigger is disorienting.\n\nTab is trapped inside: tabbing past the last element wraps to the first. Otherwise a keyboard user tabs behind the overlay into content they cannot see.\n\nEscape closes it, and the background is inert (the <code>inert</code> attribute, or <code>aria-hidden</code>) so screen readers do not read through it. Body scroll is locked.\n\nWhich is a lot — and why the honest answer ends with: use the native <code>&lt;dialog&gt;</code> element with <code>showModal()</code>, which gives you focus trapping, the top layer and Escape for free, or use Radix or React Aria. Hand-rolling this in production is how you ship a modal that traps keyboard users.',
    },
    {
      q: 'What is a live region and when do you need one?',
      a: 'An element marked so that assistive technology announces changes to its contents, even though focus is elsewhere.\n\nYou need one whenever something important appears without the user having navigated to it: a form validation summary after a failed submit, a toast, "3 results found" after a search, an autosave confirmation, an error from a background request.\n\nWithout it, a sighted user sees a red banner appear and a screen reader user gets nothing at all.\n\nThe two levels: <code>role="status"</code> (or <code>aria-live="polite"</code>) waits for a pause before announcing — right for almost everything. <code>role="alert"</code> (<code>aria-live="assertive"</code>) interrupts immediately — reserve it for errors and genuinely urgent information, because interrupting is disruptive.\n\nOne implementation detail that catches people: the live region element must be in the DOM <i>before</i> the content changes. Mounting a new element that already contains the message often does not announce, because there was no change to observe. Render an empty region and fill it.',
    },
  ],
} satisfies TopicMeta

/* ===========================================================================
   The same control, wrong and right.
   =========================================================================== */

function BadButton({ onActivate }: { onActivate: () => void }) {
  return (
    // Not focusable. No role. No keyboard activation. Invisible to a screen
    // reader's list of buttons. And no disabled semantics.
    <div
      onClick={onActivate}
      style={{
        display: 'inline-block',
        padding: '6px 13px',
        background: '#4a1f1c',
        border: '1px solid #6e2f2a',
        borderRadius: 6,
        cursor: 'pointer',
        fontSize: 13.5,
      }}
    >
      div with onClick
    </div>
  )
}

function GoodButton({ onActivate }: { onActivate: () => void }) {
  // Focusable, announced as a button, responds to Enter and Space, appears in
  // the screen reader's button list, supports `disabled`. All for free.
  return (
    <button className="primary" onClick={onActivate}>
      a real button
    </button>
  )
}

export default function Demo() {
  const [log, setLog] = useState<string[]>([])
  const push = (s: string) => setLog((l) => [...l, s].slice(-6))

  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  // A route-change focus target. In a real app you do this in a layout
  // component on every navigation.
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [pageTitle, setPageTitle] = useState('Page one')

  useEffect(() => {
    // Move focus to the new page heading. Without this, focus stays on the
    // link the user clicked — which may no longer exist.
    headingRef.current?.focus()
  }, [pageTitle])

  return (
    <div className="stack">
      <Panel title="1. Tab into this panel with your keyboard">
        <div className="row" style={{ marginBottom: 10 }}>
          <BadButton onActivate={() => push('div activated (mouse only)')} />
          <GoodButton onActivate={() => push('button activated')} />
        </div>
        <pre className="log">{log.length === 0 ? 'Press Tab, then Enter or Space.' : log.join('\n')}</pre>
        <Callout kind="trap">
          Tab reaches the real button and skips the div entirely. Even with{' '}
          <code>tabIndex={'{0}'}</code> added, the div still would not respond
          to Enter or Space, still would not be announced as a button, and still
          would not appear when a screen reader user lists the page&rsquo;s
          buttons.
        </Callout>
      </Panel>

      <Panel title="2. Live regions">
        <div className="row" style={{ marginBottom: 10 }}>
          <button onClick={() => setStatus(`Saved at ${new Date().toLocaleTimeString()}`)}>
            polite update (role=&quot;status&quot;)
          </button>
          <button className="danger" onClick={() => setError('Could not save. Check your connection.')}>
            urgent update (role=&quot;alert&quot;)
          </button>
          <button
            onClick={() => {
              setStatus('')
              setError('')
            }}
          >
            clear
          </button>
        </div>

        {/* THE DETAIL THAT CATCHES PEOPLE: these elements are always in the
            DOM, even when empty. Mounting a new element that already contains
            the message often fails to announce, because there was no change
            for the screen reader to observe. */}
        <div role="status" className="panel" style={{ minHeight: 42 }}>
          <div className="panel-title">role=&quot;status&quot; — announced at the next pause</div>
          {status || <span className="muted">empty</span>}
        </div>
        <div role="alert" className="panel" style={{ minHeight: 42, marginTop: 8 }}>
          <div className="panel-title">role=&quot;alert&quot; — interrupts immediately</div>
          {error ? <span style={{ color: 'var(--bad)' }}>{error}</span> : <span className="muted">empty</span>}
        </div>
      </Panel>

      <Panel title="3. Focus management on route change">
        <div className="row" style={{ marginBottom: 10 }}>
          <button onClick={() => setPageTitle('Page one')}>go to page one</button>
          <button onClick={() => setPageTitle('Page two')}>go to page two</button>
        </div>
        <div className="panel">
          {/* tabIndex={-1} makes it programmatically focusable without adding
              it to the tab order. */}
          <h3 ref={headingRef} tabIndex={-1} style={{ margin: 0, fontSize: 16, outline: 'none' }}>
            {pageTitle}
          </h3>
          <p className="muted" style={{ fontSize: 13, marginBottom: 0 }}>
            Focus just moved here. Press Tab and notice you continue from this
            heading, not from the top of the document.
          </p>
        </div>
        <pre style={{ marginTop: 10 }}>
          <code>{`// In a layout component, on every navigation:
const location = useLocation()
const headingRef = useRef(null)

useEffect(() => {
  headingRef.current?.focus()          // focus moves to the new page
  document.title = pageTitle           // and the title is announced
}, [location.pathname])

<h1 ref={headingRef} tabIndex={-1}>{pageTitle}</h1>
//                   ^ programmatically focusable, but NOT in the tab order`}</code>
        </pre>
      </Panel>

      <Panel title="The checklist worth reciting">
        <table className="data">
          <thead>
            <tr>
              <th>Area</th>
              <th>What to do</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Semantics</td>
              <td>
                <code>button</code> for actions, <code>a href</code> for navigation,{' '}
                <code>nav</code>/<code>main</code>/<code>h1-h6</code> in order, real{' '}
                <code>form</code> elements.
              </td>
            </tr>
            <tr>
              <td>Forms</td>
              <td>
                <code>label htmlFor</code> on every field, <code>aria-invalid</code> +{' '}
                <code>aria-describedby</code> on errors, focus the first invalid field on submit.
              </td>
            </tr>
            <tr>
              <td>Images</td>
              <td>
                Descriptive <code>alt</code>, or <code>alt=&quot;&quot;</code> if decorative. Never omit it.
              </td>
            </tr>
            <tr>
              <td>Keyboard</td>
              <td>
                Everything reachable and operable by Tab / Enter / Space / Escape / arrows. Visible{' '}
                <code>:focus-visible</code> ring.
              </td>
            </tr>
            <tr>
              <td>Routing</td>
              <td>Move focus to the new <code>h1</code>; update and announce the document title.</td>
            </tr>
            <tr>
              <td>Dynamic content</td>
              <td>
                <code>role=&quot;status&quot;</code> or <code>role=&quot;alert&quot;</code>, present in the DOM before it changes.
              </td>
            </tr>
            <tr>
              <td>Overlays</td>
              <td>
                Focus trap + restore, Escape, <code>aria-modal</code>, inert background. Prefer native{' '}
                <code>&lt;dialog&gt;</code> or Radix.
              </td>
            </tr>
            <tr>
              <td>Colour</td>
              <td>4.5:1 contrast for body text; never the only signal.</td>
            </tr>
            <tr>
              <td>Tooling</td>
              <td>
                <code>eslint-plugin-jsx-a11y</code>, axe DevTools, <code>jest-axe</code> — and tab through it yourself.
              </td>
            </tr>
          </tbody>
        </table>
        <Callout kind="tip">
          <b>The framing that lands.</b> &ldquo;Most accessibility work in React
          is not ARIA — it is using the right element, and then fixing the three
          things client-side routing breaks: focus, announcements and scroll
          position.&rdquo;
        </Callout>
      </Panel>
    </div>
  )
}
