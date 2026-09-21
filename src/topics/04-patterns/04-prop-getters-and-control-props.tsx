import { useCallback, useRef, useState } from 'react'
import type { TopicMeta } from '../../types'
import { Callout, Panel } from '../../lib/ui'

export const meta = {
  title: 'Control props, prop getters & the state reducer',
  summary:
    'Three escalating levels of "let the consumer take over" — the API design questions that come up when you are asked to build a component library.',
  notes: [
    '<b>Level 1 — control props.</b> Accept an optional <code>value</code>. If it is supplied, the consumer owns the state; if not, the component keeps it internally. Exactly how <code>&lt;input&gt;</code> works.',
    '<b>Decide the mode once.</b> Capture <code>value !== undefined</code> on the first render and warn in development if it ever flips — switching mid-life is the "changing an uncontrolled input to be controlled" bug.',
    '<b>Always call the consumer&rsquo;s <code>onChange</code></b>, in both modes. Only skip the internal <code>setState</code> when controlled.',
    '<b>Level 2 — prop getters.</b> Return functions like <code>getToggleButtonProps()</code> that produce the props to spread. The consumer gets the behaviour and the accessibility without the component owning their markup.',
    '<b>Composing handlers is the crucial detail:</b> a prop getter must call the consumer&rsquo;s handler <i>and</i> its own, and respect <code>defaultPrevented</code>.',
    '<b>Level 3 — the state reducer.</b> Expose the component&rsquo;s reducer so the consumer can intercept any transition: <code>stateReducer={(state, action) =&gt; …}</code>. Maximum power, used by Downshift.',
    '<b>Escalate only as far as you need.</b> Each level costs API surface and documentation.',
    '<b>Real examples:</b> Radix (control props), Downshift (all three), React Aria (prop getters throughout).',
  ],
  questions: [
    {
      q: 'How do you design a component that works both controlled and uncontrolled?',
      a: 'Accept an optional <code>value</code> and an optional <code>defaultValue</code>. Derive the mode from whether <code>value</code> was supplied: <code>const isControlled = value !== undefined</code>. Keep internal state for the uncontrolled case and render <code>isControlled ? value : internalValue</code>.\n\nIn the change handler, always call the consumer\'s <code>onChange</code> — they need to know either way — but only call <code>setInternalValue</code> when uncontrolled. In controlled mode the consumer is responsible for feeding the new value back in, which is exactly what makes it controlled.\n\nThe detail that separates a good implementation from a buggy one: capture <code>isControlled</code> in a ref on the first render and warn in development if it ever changes. A component that silently switches modes produces bugs that look like the state randomly resetting.',
    },
    {
      q: 'What is a prop getter and what problem does it solve?',
      a: 'A function the component returns that produces a bundle of props for you to spread onto your own element: <code>&lt;button {...getToggleButtonProps()}&gt;</code>.\n\nIt solves the tension between "the component should own the behaviour and the accessibility" and "the consumer should own the markup". A headless dropdown knows which ARIA attributes a trigger needs, which keyboard events to handle, and which id to point <code>aria-controls</code> at — but it should not dictate that your trigger is a <code>&lt;button&gt;</code> with a particular class name.\n\nThe prop getter hands you all the behaviour as props. You decide the element, the styling and the children.\n\nThe critical implementation detail is handler composition: <code>getToggleButtonProps({ onClick: myHandler })</code> must call your handler and the internal one. The convention is to call the consumer\'s first, then check <code>event.defaultPrevented</code> and skip the internal behaviour if they prevented it — so the consumer can override as well as extend.',
    },
    {
      q: 'What is the state reducer pattern?',
      a: 'The component runs its state through a reducer internally, and lets you pass in your own <code>stateReducer</code> that is called with the proposed state change. You can pass it through unchanged, modify it, or veto it entirely.\n\n<code>stateReducer={(state, action) =&gt; action.type === "item-click" ? { ...action.changes, isOpen: true } : action.changes}</code>\n\nThat example keeps a multi-select dropdown open after a selection, which is not a prop any library author would have thought to add — and that is the point. It inverts control completely: the consumer can change any transition without the author anticipating the requirement.\n\nDownshift popularised it. The cost is that you have exposed your internal action types as public API, so they become a versioning commitment.',
    },
    {
      q: 'How do you compose an event handler in a prop getter?',
      a: 'Call the consumer\'s handler first, then check whether they prevented the default, and only run your own behaviour if they did not:\n\n<code>onClick: (e) =&gt; { consumerOnClick?.(e); if (!e.defaultPrevented) internalToggle() }</code>\n\nOrder matters. Consumer first means they can inspect the event before anything has happened and cancel it. The <code>defaultPrevented</code> check gives them an opt-out that reads naturally — <code>e.preventDefault()</code> is already the idiom for "do not do the normal thing".\n\nThe alternative, running your behaviour first, means the consumer can only react after the fact and cannot cancel. Libraries that do this force consumers into workarounds.\n\nReact Aria and Downshift both use the consumer-first-plus-defaultPrevented convention, and it is worth naming it as a convention rather than an invention.',
    },
  ],
} satisfies TopicMeta

/* ===========================================================================
   LEVEL 1 — control props.
   =========================================================================== */

type ToggleProps = {
  /** Supply this to take control. Leave it out for uncontrolled mode. */
  on?: boolean
  defaultOn?: boolean
  onChange?: (next: boolean) => void
  label: string
}

function Toggle({ on, defaultOn = false, onChange, label }: ToggleProps) {
  const [internalOn, setInternalOn] = useState(defaultOn)

  // Decided per render, but checked for consistency below.
  const isControlled = on !== undefined
  const value = isControlled ? on : internalOn

  // Capture the mode from the FIRST render. Flipping modes mid-life is the
  // bug behind React's own "changing an uncontrolled input to be controlled"
  // warning, and a library component should warn about it too.
  const wasControlled = useRef(isControlled)
  if (import.meta.env.DEV && wasControlled.current !== isControlled) {
    console.warn(
      `<Toggle label="${label}"> switched from ${wasControlled.current ? 'controlled' : 'uncontrolled'} ` +
        `to ${isControlled ? 'controlled' : 'uncontrolled'}. Pick one for the component's lifetime.`,
    )
    wasControlled.current = isControlled
  }

  const toggle = () => {
    const next = !value
    // ALWAYS notify. The consumer needs to know regardless of who owns the state.
    onChange?.(next)
    // Only write internally when we are the owner. In controlled mode the
    // consumer feeds the new value back through `on`.
    if (!isControlled) setInternalOn(next)
  }

  return (
    <button
      role="switch"
      aria-checked={value}
      onClick={toggle}
      className={value ? 'primary' : ''}
      style={{ minWidth: 150 }}
    >
      {label}: {value ? 'on' : 'off'}
    </button>
  )
}

/* ===========================================================================
   LEVEL 2 — prop getters. A headless disclosure.
   =========================================================================== */

type GetterProps<E extends HTMLElement> = {
  onClick?: (e: React.MouseEvent<E>) => void
  onKeyDown?: (e: React.KeyboardEvent<E>) => void
  [key: string]: unknown
}

function useDisclosure(initial = false) {
  const [isOpen, setIsOpen] = useState(initial)
  const panelId = useRef(`disclosure-${Math.random().toString(36).slice(2, 8)}`).current

  const getTriggerProps = useCallback(
    <E extends HTMLElement>({ onClick, onKeyDown, ...rest }: GetterProps<E> = {}) => ({
      ...rest,
      // The accessibility the consumer should not have to remember.
      'aria-expanded': isOpen,
      'aria-controls': panelId,
      // HANDLER COMPOSITION. Consumer first, so they can inspect and cancel.
      onClick: (e: React.MouseEvent<E>) => {
        onClick?.(e)
        // Their `e.preventDefault()` vetoes our behaviour. This is the
        // convention React Aria and Downshift both use.
        if (!e.defaultPrevented) setIsOpen((v) => !v)
      },
      onKeyDown: (e: React.KeyboardEvent<E>) => {
        onKeyDown?.(e)
        if (!e.defaultPrevented && e.key === 'Escape') setIsOpen(false)
      },
    }),
    [isOpen, panelId],
  )

  const getPanelProps = useCallback(
    (props: Record<string, unknown> = {}) => ({
      ...props,
      id: panelId,
      hidden: !isOpen,
    }),
    [isOpen, panelId],
  )

  return { isOpen, setIsOpen, getTriggerProps, getPanelProps }
}

export default function Demo() {
  // Controlled usage: this component owns the state.
  const [controlledOn, setControlledOn] = useState(false)
  const [log, setLog] = useState<string[]>([])

  const disclosure = useDisclosure()
  const [vetoed, setVetoed] = useState(false)

  return (
    <div className="stack">
      <Panel title="Level 1 — control props (same component, two modes)">
        <div className="grid2">
          <div className="col">
            <div className="panel-title">Uncontrolled — no `on` prop</div>
            <Toggle
              label="notifications"
              defaultOn={false}
              onChange={(v) => setLog((l) => [...l, `uncontrolled → ${v}`].slice(-5))}
            />
            <div className="muted" style={{ fontSize: 13 }}>
              The component keeps its own state. <code>onChange</code> still
              fires, so the parent can react without owning it.
            </div>
          </div>

          <div className="col">
            <div className="panel-title">Controlled — parent owns `on`</div>
            <Toggle
              label="dark mode"
              on={controlledOn}
              onChange={(v) => {
                setLog((l) => [...l, `controlled → ${v}`].slice(-5))
                setControlledOn(v)
              }}
            />
            <div className="row">
              <button onClick={() => setControlledOn(true)}>force on</button>
              <button onClick={() => setControlledOn(false)}>force off</button>
            </div>
            <div className="muted" style={{ fontSize: 13 }}>
              The parent can set it from outside — impossible in uncontrolled
              mode.
            </div>
          </div>
        </div>
        <pre className="log" style={{ marginTop: 12 }}>
          {log.length === 0 ? 'Click the toggles.' : log.join('\n')}
        </pre>
      </Panel>

      <Panel title="Level 2 — prop getters">
        <div className="col">
          {/* The hook supplies behaviour + ARIA. We choose the element, the
              styling and the children. */}
          <div className="row">
            <button
              {...disclosure.getTriggerProps<HTMLButtonElement>({
                // Our own handler is composed in, not replaced.
                onClick: (e) => {
                  if (vetoed) {
                    e.preventDefault() // ← vetoes the library's toggle
                    setLog((l) => [...l, 'consumer called preventDefault — toggle vetoed'].slice(-5))
                  }
                },
              })}
              className="primary"
            >
              {disclosure.isOpen ? 'Hide' : 'Show'} details
            </button>

            <label className="row" style={{ fontSize: 13, gap: 6 }}>
              <input type="checkbox" checked={vetoed} onChange={(e) => setVetoed(e.target.checked)} />
              veto the toggle with preventDefault()
            </label>
          </div>

          <div {...disclosure.getPanelProps()} className="panel">
            The trigger above got <code>aria-expanded</code>,{' '}
            <code>aria-controls</code>, an <code>onClick</code> and an Escape
            handler — all spread from one call. We never wrote any of them.
          </div>

          <pre>
            <code>{`const { isOpen, getTriggerProps, getPanelProps } = useDisclosure()

<button {...getTriggerProps({ onClick: myHandler })}>Toggle</button>
<div    {...getPanelProps()}>…</div>

// inside the getter:
onClick: (e) => {
  myHandler?.(e)                          // consumer first
  if (!e.defaultPrevented) toggle()       // they can veto
}`}</code>
          </pre>
        </div>
      </Panel>

      <Panel title="Level 3 — the state reducer">
        <pre>
          <code>{`// The component runs every transition through a reducer, and lets YOU
// intercept it. Downshift's signature:

const { ... } = useSelect({
  items,
  stateReducer(state, actionAndChanges) {
    const { type, changes } = actionAndChanges
    switch (type) {
      case useSelect.stateChangeTypes.ItemClick:
        // Keep a multi-select open after choosing. No library author would
        // have added an isOpenAfterSelect prop for this — and they
        // don't have to.
        return { ...changes, isOpen: true, highlightedIndex: state.highlightedIndex }
      default:
        return changes
    }
  },
})`}</code>
        </pre>
        <Callout kind="tip">
          <b>Escalate deliberately.</b> Control props cover most needs. Prop
          getters are for headless components. A state reducer exposes your
          internal action types as public API, so you can never rename them
          again — only pay that price when consumers genuinely need to
          reprogram behaviour.
        </Callout>
      </Panel>
    </div>
  )
}
