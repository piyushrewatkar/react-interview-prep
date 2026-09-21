import { Component, useEffect, useState } from 'react'
import type { TopicMeta } from '../../types'
import { Callout, Panel, useLog, Log } from '../../lib/ui'

export const meta = {
  title: 'Class components & the lifecycle map',
  summary:
    'You will maintain class components for years yet. The lifecycle-to-hooks mapping, and the one thing classes still do that hooks cannot.',
  notes: [
    '<b>Mount:</b> <code>constructor</code> → <code>getDerivedStateFromProps</code> → <code>render</code> → DOM updated → <code>componentDidMount</code>.',
    '<b>Update:</b> <code>getDerivedStateFromProps</code> → <code>shouldComponentUpdate</code> → <code>render</code> → <code>getSnapshotBeforeUpdate</code> → DOM updated → <code>componentDidUpdate</code>.',
    '<b>Unmount:</b> <code>componentWillUnmount</code>.',
    '<b>The mapping:</b> <code>componentDidMount</code> ≈ <code>useEffect(fn, [])</code>; <code>componentDidUpdate</code> ≈ <code>useEffect(fn, [deps])</code>; <code>componentWillUnmount</code> ≈ the function returned from <code>useEffect</code>; <code>shouldComponentUpdate</code> ≈ <code>React.memo</code>; <code>this.state</code> ≈ <code>useState</code>/<code>useReducer</code>.',
    '<b>It is an approximation, not an equivalence.</b> One effect bundles mount + update + unmount for <i>one concern</i>; lifecycles split one concern across three methods and cram unrelated concerns into each. That re-organisation is the main argument for hooks.',
    '<b><code>componentWillMount</code>, <code>componentWillReceiveProps</code> and <code>componentWillUpdate</code> are gone</b> (renamed with an <code>UNSAFE_</code> prefix). They were unsafe under async rendering because they could run more than once per commit.',
    '<b>Classes cannot use hooks</b>, so there is no way to consume a modern library hook from one without a wrapper component.',
    '<b>Error boundaries are the one thing only classes can do.</b> Everything else has a hook equivalent.',
    '<b><code>this</code> binding</b> is the classic class bug: <code>onClick={this.handleClick}</code> loses <code>this</code> unless you bind in the constructor or use a class field arrow.',
  ],
  questions: [
    {
      q: 'Map the class lifecycle methods to hooks.',
      a: '<code>componentDidMount</code> → <code>useEffect(fn, [])</code>. <code>componentDidUpdate</code> → <code>useEffect(fn, [deps])</code>, though note the hook also runs on mount, so "update only" needs a ref guard. <code>componentWillUnmount</code> → the cleanup function returned from <code>useEffect</code>. <code>shouldComponentUpdate</code> → <code>React.memo</code> with an optional comparator. <code>getSnapshotBeforeUpdate</code> → <code>useLayoutEffect</code>, which also runs before paint. <code>getDerivedStateFromProps</code> → usually nothing: the modern answer is to derive the value during render, or reset with a key.\n\nThe caveat worth adding: this is a translation table, not an equivalence. A single <code>useEffect</code> that subscribes and returns an unsubscribe replaces code that was split across <code>componentDidMount</code> and <code>componentWillUnmount</code> with a hundred lines of unrelated logic in between. Co-locating the setup with its teardown is the actual win.',
    },
    {
      q: 'Why were componentWillMount and friends deprecated?',
      a: 'Because they run in the render phase, which React needs to be able to pause, abort and restart under concurrent rendering. A method that might be called several times before a single commit is a terrible place for side effects — and people used them for exactly that: starting fetches in <code>componentWillMount</code>, calling <code>setState</code> in <code>componentWillReceiveProps</code>.\n\nThey were renamed to <code>UNSAFE_componentWillMount</code> and so on rather than removed outright, so existing code keeps working while the name tells you what you are signing up for. The replacements are <code>getDerivedStateFromProps</code> (static and pure, so it cannot touch <code>this</code>) and <code>getSnapshotBeforeUpdate</code> (runs once, right before the DOM is mutated).',
    },
    {
      q: 'Why do you have to bind event handlers in a class component?',
      a: 'Because <code>this</code> in JavaScript is determined by how a function is <i>called</i>, not where it is defined. Passing <code>this.handleClick</code> as a prop detaches it from the instance, so when React eventually invokes it, <code>this</code> is <code>undefined</code> in strict mode — and class bodies are always strict.\n\nThree fixes: bind in the constructor (<code>this.handleClick = this.handleClick.bind(this)</code>), use a class field with an arrow function (which captures <code>this</code> lexically at construction time), or pass an inline arrow in JSX (which creates a new function every render and defeats <code>shouldComponentUpdate</code>).\n\nFunction components sidestep the whole category: there is no <code>this</code>, only closures.',
    },
    {
      q: 'Are there any advantages to class components today?',
      a: 'One real one: error boundaries. <code>getDerivedStateFromError</code> and <code>componentDidCatch</code> have no hook equivalent, so every error boundary in the ecosystem — including the one inside <code>react-error-boundary</code> — is a class.\n\nBeyond that, no. Hooks give you better logic reuse (a custom hook composes; an HOC nests), smaller bundles (no class transpilation, better minification), no <code>this</code>, and access to the entire modern ecosystem, most of which ships hooks only. React\'s own docs recommend function components for all new code.\n\nThe practical reason to know classes at five years of experience is that you will be reading and incrementally migrating them, not writing new ones.',
    },
    {
      q: 'What is getDerivedStateFromProps for, and what replaced it?',
      a: 'It lets a component update its state in response to a prop change, before rendering. It is static and receives <code>(props, state)</code> precisely so it cannot reach <code>this</code> and cause side effects.\n\nIt is almost always the wrong tool. The React team wrote a whole blog post ("You Probably Don\'t Need Derived State") about it, because the common use — copying a prop into state so it can be edited — creates two sources of truth that drift.\n\nThe modern replacements: if the value can be computed from props during render, just compute it, no state needed. If you want state to reset when a prop changes, give the component a <code>key</code>. If you genuinely need to adjust state when a prop changes, React supports setting state during render in that narrow case, which is the hooks equivalent and is documented as such.',
    },
  ],
} satisfies TopicMeta

/* ===========================================================================
   The same component written both ways. Read them side by side.
   =========================================================================== */

type Props = { label: string; log: (s: string) => void }

class ClassTimer extends Component<Props, { seconds: number }> {
  // Class field. Instance state is one bag; you cannot split it the way
  // multiple useState calls can.
  state = { seconds: 0 }
  private intervalId: number | null = null

  // CLASS FIELD ARROW: captures `this` lexically, so passing it as a prop is
  // safe. The alternative is `this.tick = this.tick.bind(this)` in a
  // constructor. An inline arrow in JSX also works but allocates per render.
  private tick = () => {
    this.setState((s) => ({ seconds: s.seconds + 1 }))
  }

  componentDidMount() {
    this.props.log(`[class] componentDidMount — ${this.props.label}`)
    this.intervalId = window.setInterval(this.tick, 1000)
  }

  // Note how far this is from componentDidMount. In a real class the two are
  // often hundreds of lines apart with unrelated logic in between. That
  // separation is the core complaint hooks were designed to answer.
  componentWillUnmount() {
    this.props.log(`[class] componentWillUnmount — ${this.props.label}`)
    if (this.intervalId !== null) clearInterval(this.intervalId)
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.label !== this.props.label) {
      this.props.log(`[class] componentDidUpdate — label ${prevProps.label} → ${this.props.label}`)
    }
  }

  render() {
    return (
      <span className="mono">
        {this.props.label}: {this.state.seconds}s
      </span>
    )
  }
}

function HookTimer({ label, log }: Props) {
  const [seconds, setSeconds] = useState(0)

  // Setup and teardown for ONE concern, in ONE place. That is the whole
  // argument, and it is a good one.
  useEffect(() => {
    log(`[hook] effect setup — ${label}`)
    const id = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => {
      log(`[hook] effect cleanup — ${label}`)
      clearInterval(id)
    }
    // `label` is in the deps only so the log stays honest; the interval itself
    // does not depend on it. In real code you would split these into two
    // effects — which is another thing classes cannot do.
  }, [label, log])

  return (
    <span className="mono">
      {label}: {seconds}s
    </span>
  )
}

export default function Demo() {
  const [mounted, setMounted] = useState(false)
  const [label, setLabel] = useState('alpha')
  const { lines, push, clear } = useLog()

  return (
    <div className="stack">
      <div className="row">
        <button className="primary" onClick={() => setMounted((m) => !m)}>
          {mounted ? 'Unmount both' : 'Mount both'}
        </button>
        <button onClick={() => setLabel((l) => (l === 'alpha' ? 'beta' : 'alpha'))} disabled={!mounted}>
          change label prop
        </button>
        <button onClick={clear}>Clear log</button>
      </div>

      {mounted && (
        <div className="grid2">
          <Panel title="Class component">
            <ClassTimer label={label} log={push} />
          </Panel>
          <Panel title="Function component + hooks">
            <HookTimer label={label} log={push} />
          </Panel>
        </div>
      )}

      <Panel title="Lifecycle log">
        <Log lines={lines} empty="Press “Mount both”." />
      </Panel>

      <Panel title="The translation table">
        <table className="data">
          <thead>
            <tr>
              <th>Class</th>
              <th>Hooks</th>
              <th>Caveat</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="mono">constructor</td>
              <td className="mono">useState(init)</td>
              <td>Pass a function for lazy init: <code>useState(() =&gt; expensive())</code>.</td>
            </tr>
            <tr>
              <td className="mono">componentDidMount</td>
              <td className="mono">useEffect(fn, [])</td>
              <td>Runs after paint, not before. Use <code>useLayoutEffect</code> if you must measure first.</td>
            </tr>
            <tr>
              <td className="mono">componentDidUpdate</td>
              <td className="mono">useEffect(fn, [deps])</td>
              <td>Also fires on mount. A ref guard is needed for update-only.</td>
            </tr>
            <tr>
              <td className="mono">componentWillUnmount</td>
              <td className="mono">return () =&gt; {} from useEffect</td>
              <td>Also runs before every re-run, not only on unmount.</td>
            </tr>
            <tr>
              <td className="mono">shouldComponentUpdate</td>
              <td className="mono">React.memo(C, areEqual)</td>
              <td>Memo compares props only; it cannot see state or context.</td>
            </tr>
            <tr>
              <td className="mono">getSnapshotBeforeUpdate</td>
              <td className="mono">useLayoutEffect</td>
              <td>Both run after DOM mutation but before paint.</td>
            </tr>
            <tr>
              <td className="mono">getDerivedStateFromProps</td>
              <td className="mono">(usually nothing)</td>
              <td>Compute during render, or reset with a <code>key</code>.</td>
            </tr>
            <tr>
              <td className="mono">componentDidCatch</td>
              <td className="mono">— no equivalent —</td>
              <td>The one thing that still requires a class.</td>
            </tr>
          </tbody>
        </table>
      </Panel>

      <Callout kind="tip">
        <b>The framing that lands well.</b> Lifecycles organise code by{' '}
        <i>when it runs</i>. Effects organise code by <i>what it is about</i>.
        Every subscription keeps its own unsubscribe next to it, and unrelated
        concerns go in separate effects instead of sharing a
        <code> componentDidUpdate</code>.
      </Callout>
    </div>
  )
}
