import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import type { TopicMeta } from '../../types'
import { Callout, Panel, useLog, Log } from '../../lib/ui'

export const meta = {
  title: 'Portals',
  summary:
    'Rendering into a different part of the DOM while staying in the same React tree — and why events still bubble to the React parent.',
  notes: [
    '<b><code>createPortal(children, domNode)</code></b> renders <code>children</code> into <code>domNode</code> instead of the parent&rsquo;s DOM position.',
    '<b>The React tree is unchanged.</b> Context still flows in, state still lives where it lived, and the component still unmounts when its React parent does.',
    '<b>Events bubble through the React tree, not the DOM tree.</b> A click inside a portal fires <code>onClick</code> handlers on its React ancestors even though the DOM node is elsewhere. This surprises people and is a favourite interview question.',
    '<b>The reason portals exist is CSS.</b> <code>overflow: hidden</code>, <code>z-index</code> stacking contexts and <code>transform</code> on an ancestor will all clip or mis-stack a modal. Rendering into <code>document.body</code> escapes all of it.',
    '<b>Typical uses:</b> modals, dialogs, tooltips, popovers, toasts, context menus, dropdowns that must escape a scroll container.',
    '<b>You still own accessibility.</b> A portal does not give you focus trapping, <code>aria-modal</code>, Escape handling or scroll locking. Consider the native <code>&lt;dialog&gt;</code> element or a headless library before hand-rolling.',
    '<b>SSR:</b> <code>createPortal</code> cannot run on the server — there is no DOM. Guard it, or create the container in an effect.',
  ],
  questions: [
    {
      q: 'What problem does createPortal solve?',
      a: 'CSS containment. A modal rendered in place is a child of whatever component opened it, so it inherits that ancestor\'s <code>overflow: hidden</code>, its stacking context, and any <code>transform</code> or <code>filter</code> on the chain — any of which will clip it, trap it behind a sibling, or break <code>position: fixed</code>.\n\nYou can fight this with z-index escalation, and everyone has, and it never ends well. A portal sidesteps it: the DOM node goes to <code>document.body</code> where nothing is clipping it, while the component stays exactly where it was in the React tree.',
    },
    {
      q: 'If a portal renders into document.body, does a click inside it bubble to the component that rendered it?',
      a: 'Yes — and that is the part people get wrong. React\'s event system propagates along the <b>React</b> tree, not the DOM tree. A click on a button inside a portal will fire <code>onClick</code> handlers on every React ancestor of the portal component, even though those elements are nowhere near it in the DOM.\n\nThat is usually what you want: a portal-rendered dropdown inside a <code>&lt;form&gt;</code> still triggers the form\'s handlers. Where it bites is "click outside to close" logic — a click in the portal looks like an outside click to a native listener on <code>document</code>, but like an inside click to React. Pick one model and be consistent.',
    },
    {
      q: 'Does a portal change where state or context live?',
      a: 'No. The portal only affects the DOM insertion point. The component is still mounted at its original position in the React tree, so it reads the same contexts, its state has the same lifetime, and it unmounts when its React parent unmounts — not when something near its DOM location does.\n\nThis is the key property that makes portals usable: a modal can be a genuine child of the feature that owns it, reading that feature\'s context and state, while visually escaping to the top of the document.',
    },
    {
      q: 'What do you still have to do yourself when building a modal with a portal?',
      a: 'Essentially all the accessibility. A portal gives you a DOM node and nothing else. You are responsible for: <code>role="dialog"</code> and <code>aria-modal="true"</code>; an accessible name via <code>aria-labelledby</code>; moving focus into the dialog on open and restoring it to the trigger on close; trapping Tab inside the dialog; closing on Escape; marking the background inert or aria-hidden; and locking body scroll.\n\nGetting all of that right is why the honest answer is usually "use the native <code>&lt;dialog&gt;</code> element with <code>showModal()</code>, which gives you focus trapping and the top layer for free, or use Radix/React Aria". Writing it from scratch in an interview is fine; shipping it from scratch rarely is.',
    },
  ],
} satisfies TopicMeta

/* ---------------------------------------------------------------------------
   A modal rendered through a portal. Note that it is a *child* of the clipping
   container in the React tree, but a child of <body> in the DOM.
   --------------------------------------------------------------------------- */
function Modal({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const dialogRef = useRef<HTMLDivElement>(null)

  // The minimum viable accessibility: Escape closes, and focus moves in.
  // A production modal also needs a focus trap and focus restoration.
  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement | null
    dialogRef.current?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)

    // Lock background scroll while open.
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      prevFocus?.focus()
    }
  }, [onClose])

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 1000,
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Portal demo dialog"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-raised)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 24,
          maxWidth: 440,
          outline: 'none',
        }}
      >
        {children}
      </div>
    </div>,
    // The second argument: WHERE in the DOM this goes.
    document.body,
  )
}

export default function Demo() {
  const [open, setOpen] = useState(false)
  const { lines, push, clear } = useLog()

  return (
    <div className="stack">
      <Panel title="1. Escaping a clipping container">
        <p className="muted" style={{ marginTop: 0, fontSize: 13.5 }}>
          The box below has <code>overflow: hidden</code> and a small height.
          Without a portal, a modal rendered inside it would be clipped to these
          dimensions.
        </p>

        {/*
          The onClick here is the interesting part. The modal's DOM node lives
          in <body>, nowhere near this div — yet clicking inside the modal fires
          THIS handler, because React events travel the React tree.
        */}
        <div
          onClick={() => push('click bubbled to the clipping container’s React parent')}
          style={{
            height: 110,
            overflow: 'hidden',
            border: '1px dashed var(--border)',
            borderRadius: 8,
            padding: 14,
            position: 'relative',
          }}
        >
          <div className="row">
            <button className="primary" onClick={() => setOpen(true)}>
              Open modal (portalled to document.body)
            </button>
          </div>
          <p className="muted" style={{ fontSize: 13 }}>
            This container clips everything past 110px. The modal is unaffected.
          </p>
          {open && (
            <Modal onClose={() => setOpen(false)}>
              <h3 style={{ marginTop: 0 }}>I am in document.body</h3>
              <p className="muted" style={{ fontSize: 14 }}>
                …but I am still a React child of that clipped div. Click this
                text and watch the log below: the click bubbles to the div&rsquo;s{' '}
                <code>onClick</code>.
              </p>
              <div className="row">
                <button onClick={() => setOpen(false)}>Close (or press Escape)</button>
              </div>
            </Modal>
          )}
        </div>
      </Panel>

      <Panel title="2. Event bubbling through the React tree">
        <Log lines={lines} empty="Open the modal and click inside it." />
        <div className="row" style={{ marginTop: 10 }}>
          <button onClick={clear}>Clear</button>
        </div>
        <Callout kind="trap">
          <b>The gotcha.</b> A <code>document</code>-level &ldquo;click
          outside&rdquo; listener sees a portal click as <i>outside</i> (DOM
          tree), while React sees it as <i>inside</i> (React tree). Mixing the
          two is how dropdowns end up closing the instant you click them.
        </Callout>
      </Panel>
    </div>
  )
}
