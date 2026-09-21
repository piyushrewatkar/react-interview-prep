import { useState } from 'react'
import type { ReactElement } from 'react'
import type { TopicMeta } from '../../types'
import { Callout, Panel } from '../../lib/ui'

export const meta = {
  title: 'JSX, elements & the render pipeline',
  summary:
    'What JSX compiles to, why a React element is not a DOM node, and the three phases React goes through to put pixels on screen.',
  notes: [
    '<b>JSX is not HTML.</b> It is syntax sugar that the compiler turns into function calls. With the modern JSX transform (React 17+) <code>&lt;div id="a" /&gt;</code> becomes <code>_jsx("div", { id: "a" })</code>, imported automatically from <code>react/jsx-runtime</code>. That is why you no longer need <code>import React from "react"</code> in every file.',
    '<b>A React element is a plain object</b>, roughly <code>{ type, key, ref, props }</code>. It is an immutable <i>description</i> of what you want on screen — creating one is cheap and does nothing. Rendering is React later reading that description.',
    '<b>Capitalisation is semantic.</b> <code>&lt;button&gt;</code> compiles to <code>_jsx("button", …)</code> — a string type, meaning a host element. <code>&lt;Button&gt;</code> compiles to <code>_jsx(Button, …)</code> — a reference to your function. Lowercase your component and React will silently render an unknown HTML tag.',
    '<b>Three phases.</b> <i>Trigger</i> (initial mount or a state update) → <i>Render</i> (React calls your components, builds the new element tree, and diffs it against the old one — pure, interruptible, no DOM touched) → <i>Commit</i> (React applies the minimal set of DOM mutations, then runs layout effects, paints, then runs passive effects).',
    '<b>"Render" does not mean "update the DOM".</b> A component can render and produce a tree identical to last time, in which case the commit phase touches nothing. This distinction is the whole basis of performance work in React.',
    '<b>Children are just a prop.</b> <code>&lt;Card&gt;hi&lt;/Card&gt;</code> is <code>_jsx(Card, { children: "hi" })</code>. Nothing magic — which is what makes the "pass children as a prop to skip re-renders" trick in the performance section work.',
  ],
  questions: [
    {
      q: 'What does JSX actually compile to?',
      a: 'Function calls. Under the classic transform, <code>&lt;div className="x"&gt;hi&lt;/div&gt;</code> became <code>React.createElement("div", { className: "x" }, "hi")</code>. Since React 17 the default is the automatic runtime, which emits <code>_jsx("div", { className: "x", children: "hi" })</code> and imports <code>_jsx</code> from <code>react/jsx-runtime</code> for you — that is why the <code>import React</code> line became unnecessary.\n\nEither way the return value is a plain, frozen-ish JavaScript object describing the node: its <code>type</code>, its <code>props</code>, its <code>key</code> and its <code>ref</code>. No DOM is created at this point.',
    },
    {
      q: 'What is the difference between a React element, a component and a component instance?',
      a: 'A <b>component</b> is the function (or class) you write — a blueprint. An <b>element</b> is the lightweight object returned by calling JSX on it, describing one intended appearance of that blueprint with a particular set of props. An <b>instance</b> is what React maintains internally — the fiber node that holds the hook state, refs and DOM node for a particular position in the tree.\n\nThe practical consequence: you create thousands of elements per second and it is fine, because they are throwaway objects. Instances are the expensive thing, and React works hard to reuse them across renders — which is exactly what reconciliation and keys are about.',
    },
    {
      q: 'Why must component names start with a capital letter?',
      a: 'Because the JSX transform uses the case of the tag to decide between a string and an identifier. A lowercase tag is emitted as a string literal — <code>_jsx("div", …)</code> — which React treats as a host (DOM) element. A capitalised tag is emitted as a variable reference — <code>_jsx(Button, …)</code>.\n\nSo if you write <code>&lt;button /&gt;</code> intending your own <code>button</code> component, React renders a real HTML button and ignores your function entirely. It usually shows up as "my props are not doing anything" plus an unknown-prop warning in the console.',
    },
    {
      q: 'Walk me through what happens between calling setState and seeing the change on screen.',
      a: '<b>Trigger:</b> <code>setState</code> marks the fiber as needing work and schedules a render at some priority. It does not render synchronously.\n\n<b>Render phase:</b> React calls your component function (and its affected children), producing a new element tree, and diffs it against the current one to build a list of effects — "update this text node", "insert this DOM element", "delete this subtree". This phase must be pure, because React may abandon and restart it. Nothing is visible yet.\n\n<b>Commit phase:</b> React applies the mutations to the real DOM in one synchronous pass, then runs <code>useLayoutEffect</code> callbacks and updates refs — still before the browser paints, which is why layout effects can measure and correct layout without flicker. The browser then paints. Finally React flushes <code>useEffect</code> callbacks asynchronously.',
    },
    {
      q: 'Is the virtual DOM faster than direct DOM manipulation?',
      a: 'No, and it is worth saying so plainly — hand-written, perfectly targeted DOM updates will always beat it, because the virtual DOM is pure overhead on top of the same final operations.\n\nWhat it buys you is a <i>programming model</i>: you write a function from state to UI and describe the end result, and React figures out the minimal mutation to get there. It makes the fast path the default one and removes an entire class of bugs where the DOM and your model drift apart. The honest framing in an interview is "it is fast enough, and it is predictable", not "it is faster".',
    },
    {
      q: 'What is `React.Fragment` for, and when do you need the long form?',
      a: 'A component must return a single element. A fragment groups children without adding a DOM wrapper, which matters when a stray <code>&lt;div&gt;</code> would break the parent layout — inside a flex or grid container, or between <code>&lt;tr&gt;</code> and <code>&lt;td&gt;</code> where invalid HTML would actually be reparented by the browser.\n\nThe shorthand <code>&lt;&gt;…&lt;/&gt;</code> covers most cases. You need the long form <code>&lt;React.Fragment key={id}&gt;</code> when you are producing fragments inside a <code>.map()</code>, because the shorthand syntax cannot take a key.',
    },
  ],
} satisfies TopicMeta

export default function Demo() {
  const [count, setCount] = useState(0)

  // ---------------------------------------------------------------------------
  // Creating an element is just calling a function. Nothing renders here; this
  // is a plain object sitting in a variable. You can log it, pass it around,
  // store it in an array — it is inert data until React commits it.
  // ---------------------------------------------------------------------------
  const element: ReactElement = <p id="greeting">Hello, interviewer.</p>

  // We strip `_owner`/`_store` and friends before displaying, because React
  // attaches dev-only bookkeeping fields that would drown out the real shape.
  const shape = {
    type: typeof element.type === 'string' ? element.type : '(function component)',
    key: element.key,
    props: element.props,
  }

  return (
    <div className="stack">
      <Callout kind="tip">
        Everything below is produced from the same two lines of JSX. Nothing here
        touches the DOM until React commits.
      </Callout>

      <div className="grid2">
        <Panel title="The JSX you wrote">
          <pre>
            <code>{`const element =\n  <p id="greeting">\n    Hello, interviewer.\n  </p>`}</code>
          </pre>
        </Panel>

        <Panel title="What it compiles to">
          <pre>
            <code>{`const element = _jsx("p", {\n  id: "greeting",\n  children: "Hello, interviewer."\n});\n\n// _jsx is auto-imported from\n// "react/jsx-runtime"`}</code>
          </pre>
        </Panel>
      </div>

      <Panel title="The object that call returns">
        <pre>
          <code>{JSON.stringify(shape, null, 2)}</code>
        </pre>
      </Panel>

      <Panel title="…and only now, rendered">
        <div style={{ border: '1px dashed var(--border)', borderRadius: 6, padding: '0 12px' }}>
          {element}
        </div>
      </Panel>

      <Panel title="Render vs. commit">
        <p className="muted" style={{ marginTop: 0, fontSize: 13.5 }}>
          Click the button. The component function re-runs every click — a render.
          But the paragraph above it produces an identical element tree each time,
          so React&rsquo;s commit phase touches exactly one text node: the number.
          Open DevTools &rarr; Elements and watch which node flashes.
        </p>
        <div className="row">
          <button className="primary" onClick={() => setCount((c) => c + 1)}>
            Re-render this component
          </button>
          <span className="big-num">{count}</span>
        </div>
      </Panel>
    </div>
  )
}
