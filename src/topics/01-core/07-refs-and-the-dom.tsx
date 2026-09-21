import { useImperativeHandle, useRef, useState } from 'react'
import type { TopicMeta } from '../../types'
import { Callout, Panel } from '../../lib/ui'

export const meta = {
  title: 'Refs, forwardRef & useImperativeHandle',
  summary:
    'The escape hatch out of declarative React: reaching a DOM node, storing a mutable value that does not trigger renders, and exposing an imperative API from a child.',
  notes: [
    '<b>A ref is a mutable box that survives renders.</b> <code>useRef(x)</code> returns <code>{ current: x }</code> — the same object every render. Writing to <code>.current</code> does <b>not</b> schedule a re-render.',
    '<b>Two distinct uses.</b> (1) A handle on a DOM node: <code>&lt;input ref={inputRef} /&gt;</code>. (2) An instance variable: a timer id, a "has this already run" flag, the previous value of a prop.',
    '<b>Do not read or write refs during render.</b> Rendering must be pure. Refs belong in event handlers and effects. React will not stop you, but concurrent rendering can make it misbehave.',
    '<b>React 19 removed the need for <code>forwardRef</code></b> — <code>ref</code> is now an ordinary prop on function components. <code>forwardRef</code> still works and is everywhere in existing code, so you need to be able to explain it.',
    '<b><code>useImperativeHandle</code> narrows what a parent can do.</b> Instead of handing out the raw DOM node, you expose a curated object: <code>{ focus, clear }</code>. Use it sparingly — an imperative API is a design decision, not a shortcut.',
    '<b>Callback refs run on mount and unmount</b> with the node and then <code>null</code>. Since React 19 you can return a cleanup function from one. They are what you want when you need to measure a node as soon as it attaches, or track a dynamic list of nodes.',
    '<b>If setting a ref should change what the user sees, it should have been state.</b> That is the one-line test.',
  ],
  questions: [
    {
      q: 'When would you use a ref instead of state?',
      a: 'When the value is not rendered. State exists to tell React "re-render, the output changed"; if changing the value does not change the output, state is just an unnecessary render.\n\nTypical ref cases: a <code>setInterval</code> id you need in order to clear it, a "did the user already submit" latch, the previous value of a prop for a comparison, an accumulated scroll position you only read in a handler, or a DOM node you need to focus or measure.\n\nThe test I use out loud: "if I change this, does anything on screen need to look different?" Yes ⇒ state. No ⇒ ref.',
    },
    {
      q: 'What is forwardRef and why did it exist?',
      a: 'Refs were never regular props — React intercepted <code>ref</code> and, for a function component, had nowhere to put it, so it warned and dropped it. That meant you could not write <code>&lt;MyInput ref={r} /&gt;</code> and reach the underlying <code>&lt;input&gt;</code>, which broke every design-system wrapper component.\n\n<code>forwardRef</code> wrapped a component so it received <code>(props, ref)</code> as two arguments, letting it pass the ref down to a host element. Every serious component library is full of it.\n\nAs of React 19, <code>ref</code> is just a normal prop on function components, so new code writes <code>function MyInput({ ref, ...props })</code> and <code>forwardRef</code> is deprecated. Knowing both is the expectation at five years, because you will be reading a lot of code written before 19.',
    },
    {
      q: 'What does useImperativeHandle do and when is it justified?',
      a: 'It replaces the value the parent sees on the ref. Instead of the DOM node, the parent gets whatever object you return — typically a small set of methods.\n\nIt is justified when a component genuinely has imperative operations that cannot be expressed as props. A video player needs <code>play()</code> and <code>seek()</code>; a modal needs <code>open()</code> and <code>close()</code>; a form needs <code>focusFirstError()</code>. Modelling "play" as a <code>isPlaying</code> prop works until the user pauses with the native controls and your prop is out of sync.\n\nIt is <i>not</i> justified as a way to let a parent reach in and mutate a child\'s state because props felt like too much typing. That is just prop drilling with extra steps and no data flow you can trace.',
    },
    {
      q: 'What is a callback ref and when do you need one?',
      a: 'Instead of a ref object you pass a function: <code>&lt;div ref={node =&gt; …} /&gt;</code>. React calls it with the DOM node when it attaches and with <code>null</code> when it detaches — and in React 19 you can return a cleanup function instead of relying on the null call.\n\nYou need one when attachment time matters or when the set of nodes is dynamic. Measuring an element the instant it mounts is the common case: with <code>useRef</code> plus <code>useEffect</code> you are a tick late and the ref may be null on the first pass, whereas a callback ref fires exactly when the node exists. The other case is collecting refs for a list — you cannot call <code>useRef</code> in a loop, so you use one callback ref that writes into a <code>Map</code> keyed by id.\n\nThe gotcha: an inline arrow function is a new reference every render, so React detaches (calls with <code>null</code>) and reattaches it on each one. Wrap it in <code>useCallback</code> if that matters.',
    },
    {
      q: 'Why should you not read ref.current during render?',
      a: 'Because rendering must be pure — the same props and state must produce the same output — and a ref is explicitly a mutable value outside React\'s data flow. Reading it during render makes the output depend on something React does not track, so React has no way to know the result is stale.\n\nConcretely, under concurrent rendering React may render a component, pause, and render it again before committing. If the second pass reads a mutated ref, the two passes disagree and you get inconsistent output. Refs are also not populated until <i>after</i> commit, so on the first render <code>ref.current</code> is null anyway.\n\nRead and write refs in event handlers and effects, which run after commit, where mutation is safe by design.',
    },
  ],
} satisfies TopicMeta

/* ---------------------------------------------------------------------------
   A child that exposes a deliberately narrow imperative API.

   NOTE: In React 19, `ref` is a plain prop — no forwardRef needed. The
   equivalent pre-19 code is shown in the panel below the demo.
   --------------------------------------------------------------------------- */
type SearchHandle = {
  focus: () => void
  clear: () => void
  /** Returns the current value without the parent owning it. */
  read: () => string
}

function SearchBox({ ref }: { ref?: React.Ref<SearchHandle> }) {
  const inputRef = useRef<HTMLInputElement>(null)

  // The parent gets THIS object on its ref — not the <input>. It can focus and
  // clear, but it cannot, say, reach in and change the element's styles.
  useImperativeHandle(
    ref,
    () => ({
      focus: () => inputRef.current?.focus(),
      clear: () => {
        if (inputRef.current) inputRef.current.value = ''
      },
      read: () => inputRef.current?.value ?? '',
    }),
    [],
  )

  return <input type="search" ref={inputRef} placeholder="a child component…" />
}

export default function Demo() {
  // 1. Ref as a DOM handle.
  const inputRef = useRef<HTMLInputElement>(null)

  // 2. Ref as an instance variable. `renders` changes on every render but never
  //    causes one — compare with the state counter beside it.
  const renderCount = useRef(0)
  renderCount.current += 1 // (Illustrative. Strictly this is an impure render;
  //                            `useRenderCount` in lib/ui.tsx does it properly
  //                            in an effect. Shown here because you will meet
  //                            this exact line in real codebases.)

  // 3. Ref holding a timer id — the textbook case.
  const timerRef = useRef<number | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(false)

  const start = () => {
    if (timerRef.current !== null) return
    setRunning(true)
    timerRef.current = window.setInterval(() => setElapsed((e) => e + 1), 100)
  }
  const stop = () => {
    if (timerRef.current === null) return
    clearInterval(timerRef.current)
    timerRef.current = null
    setRunning(false)
  }

  // 4. Imperative handle from a child.
  const searchRef = useRef<SearchHandle>(null)
  const [readValue, setReadValue] = useState<string | null>(null)

  return (
    <div className="stack">
      <Panel title="1. A ref as a DOM handle">
        <div className="row">
          <input type="text" ref={inputRef} placeholder="click the buttons →" />
          <button onClick={() => inputRef.current?.focus()}>focus()</button>
          <button onClick={() => inputRef.current?.select()}>select()</button>
          <button
            onClick={() =>
              alert(`offsetWidth is ${inputRef.current?.offsetWidth}px`)
            }
          >
            measure
          </button>
        </div>
        <Callout>
          These are all things you <i>cannot</i> express declaratively. Focus,
          text selection, measurement, scroll position, media playback — that is
          the legitimate surface area for refs.
        </Callout>
      </Panel>

      <Panel title="2. A ref as an instance variable (no re-render)">
        <div className="row">
          <span className="badge">ref: {renderCount.current} renders</span>
          <span className="badge">state: {elapsed} ticks</span>
          <button onClick={() => setElapsed((e) => e)}>
            setState to the same value (React bails out)
          </button>
        </div>
      </Panel>

      <Panel title="3. Holding a timer id">
        <div className="row">
          <span className="big-num">{(elapsed / 10).toFixed(1)}s</span>
          <button className="primary" onClick={start} disabled={running}>
            start
          </button>
          <button onClick={stop} disabled={!running}>
            stop
          </button>
          <button
            onClick={() => {
              stop()
              setElapsed(0)
            }}
          >
            reset
          </button>
        </div>
        <Callout kind="tip">
          The interval id must survive re-renders but must never cause one —
          which is the exact definition of a ref. Storing it in state would
          re-render on every start/stop for no visual reason.
        </Callout>
      </Panel>

      <Panel title="4. useImperativeHandle: a curated API">
        <div className="row">
          <SearchBox ref={searchRef} />
          <button onClick={() => searchRef.current?.focus()}>.focus()</button>
          <button onClick={() => searchRef.current?.clear()}>.clear()</button>
          <button onClick={() => setReadValue(searchRef.current?.read() ?? '')}>
            .read()
          </button>
        </div>
        {readValue !== null && (
          <div className="mono" style={{ fontSize: 13, marginTop: 8 }}>
            read() returned &ldquo;{readValue}&rdquo;
          </div>
        )}
      </Panel>

      <Panel title="React 19 vs. forwardRef">
        <div className="grid2">
          <div>
            <div className="panel-title">React 19 — ref is a normal prop</div>
            <pre>
              <code>{`function SearchBox({ ref }) {\n  const el = useRef(null)\n  useImperativeHandle(ref, () => ({\n    focus: () => el.current?.focus()\n  }), [])\n  return <input ref={el} />\n}`}</code>
            </pre>
          </div>
          <div>
            <div className="panel-title">Pre-19 — forwardRef required</div>
            <pre>
              <code>{`const SearchBox = forwardRef(\n  function SearchBox(props, ref) {\n    const el = useRef(null)\n    useImperativeHandle(ref, () => ({\n      focus: () => el.current?.focus()\n    }), [])\n    return <input ref={el} />\n  }\n)`}</code>
            </pre>
          </div>
        </div>
      </Panel>
    </div>
  )
}
