import type { TopicMeta } from '../../types'
import { Callout, Panel, useLog, Log } from '../../lib/ui'

export const meta = {
  title: '`this`, call, apply & bind',
  summary:
    'The four binding rules in priority order, why arrow functions are different in kind, and the class-component bug this explains.',
  notes: [
    '<b><code>this</code> is determined by how a function is CALLED, not where it is defined</b> — except for arrow functions, which have no <code>this</code> of their own at all.',
    '<b>The four rules, highest precedence first:</b> <code>new</code> binding → explicit binding (<code>call</code>/<code>apply</code>/<code>bind</code>) → implicit binding (a method call, <code>obj.fn()</code>) → default binding (<code>undefined</code> in strict mode, <code>globalThis</code> otherwise).',
    '<b>Losing <code>this</code> happens on detachment.</b> <code>const f = obj.method; f()</code> — the reference to <code>obj</code> is gone, so the implicit binding is gone.',
    '<b><code>call(thisArg, a, b)</code> and <code>apply(thisArg, [a, b])</code> invoke immediately.</b> <code>bind(thisArg, …)</code> returns a new function and can be partially applied.',
    '<b>A bound function cannot be re-bound.</b> <code>f.bind(a).bind(b)</code> is still bound to <code>a</code>.',
    '<b>Arrow functions close over <code>this</code> lexically.</b> They take it from the enclosing scope at definition time, and <code>call</code>/<code>apply</code>/<code>bind</code> cannot change it.',
    '<b>This is why class components needed <code>this.handleClick = this.handleClick.bind(this)</code></b> — passing a method as a prop detaches it.',
    '<b>Class bodies are always strict mode</b>, so a detached method gets <code>undefined</code> rather than the global object — hence “Cannot read properties of undefined”.',
  ],
  questions: [
    {
      q: 'How is the value of `this` determined?',
      a: 'By the call site, using four rules in strict priority order.\n\n<b>1. <code>new</code> binding.</b> <code>new Foo()</code> creates a fresh object and binds <code>this</code> to it.\n\n<b>2. Explicit binding.</b> <code>fn.call(obj)</code>, <code>fn.apply(obj)</code> or a function produced by <code>fn.bind(obj)</code> — <code>this</code> is whatever you passed.\n\n<b>3. Implicit binding.</b> <code>obj.fn()</code> — <code>this</code> is <code>obj</code>. Only the object immediately to the left of the dot counts, so <code>a.b.c()</code> gives <code>this === a.b</code>.\n\n<b>4. Default binding.</b> A plain <code>fn()</code> — <code>undefined</code> in strict mode, <code>globalThis</code> in sloppy mode.\n\nArrow functions sit outside this entirely: they have no <code>this</code> binding of their own and resolve it lexically, like any other variable.',
    },
    {
      q: 'Why does `this` become undefined when you pass a method as a callback?',
      a: 'Because the implicit binding lives at the call site, not in the function. <code>obj.method</code> evaluates to the function itself — the connection to <code>obj</code> exists only in the expression <code>obj.method()</code>.\n\nSo <code>setTimeout(obj.method, 0)</code> passes a bare function reference. When the timer eventually calls it, there is no object to the left of a dot, so the default binding applies: <code>undefined</code> in strict mode.\n\nThis is exactly the class-component problem. <code>&lt;button onClick={this.handleClick}&gt;</code> detaches the method, and because class bodies are always strict, <code>this</code> is <code>undefined</code> when React invokes it — producing "Cannot read properties of undefined (reading \'setState\')".\n\nThe fixes are to bind in the constructor, or to use a class field arrow function, which captures <code>this</code> lexically at construction time.',
    },
    {
      q: 'What is the difference between call, apply and bind?',
      a: '<code>call</code> and <code>apply</code> both invoke the function immediately with an explicit <code>this</code>; they differ only in how arguments are passed. <code>call(thisArg, a, b, c)</code> takes them individually; <code>apply(thisArg, [a, b, c])</code> takes an array.\n\nThe mnemonic is <b>A</b>pply for <b>A</b>rray, <b>C</b>all for <b>C</b>ommas.\n\n<code>bind</code> does not invoke. It returns a <i>new</i> function permanently bound to that <code>this</code>, and any arguments you pass are partially applied — <code>const add5 = add.bind(null, 5)</code>.\n\nTwo details worth knowing. A bound function cannot be re-bound: <code>f.bind(a).bind(b)</code> stays bound to <code>a</code>, because the second bind sets <code>this</code> on a function that already ignores it. And spread syntax has made <code>apply</code> largely redundant — <code>fn(...args)</code> does the same job more clearly, and only differs in that it does not set <code>this</code>.',
    },
    {
      q: 'How are arrow functions different?',
      a: 'They have no <code>this</code> binding of their own. Not "they bind it differently" — they simply do not have one, so <code>this</code> inside an arrow resolves lexically up the scope chain, exactly like any other variable.\n\nThe consequences: <code>call</code>, <code>apply</code> and <code>bind</code> cannot change an arrow\'s <code>this</code> — they are silently ignored. An arrow used as an object method gets <code>this</code> from the enclosing scope, not the object, which is a common surprise. And an arrow cannot be used as a constructor.\n\nThey also lack <code>arguments</code>, and are not hoisted the way function declarations are.\n\nThe practical upshot is that arrows are the right default for callbacks — that is the case that used to require <code>bind</code> or a <code>const self = this</code> — and the wrong choice for object methods and prototype methods where you do want dynamic <code>this</code>.',
    },
    {
      q: 'Does any of this matter if you only write function components?',
      a: 'Directly, much less — function components have no <code>this</code>, and closures replace it entirely. That is genuinely one of the reasons hooks simplified React.\n\nBut it comes up in three places. You will read and maintain class components, where every <code>this</code> question above is live. You will occasionally work with non-React libraries whose APIs are method-based — chart libraries, map SDKs, older DOM APIs — and detaching a method from them fails in exactly this way. And it remains a standard JavaScript interview question at any level, asked precisely because it separates people who learned patterns from people who understand the language.\n\nSo I would frame it as: not a daily concern in modern React, and still something you should be able to explain cleanly in about a minute.',
    },
  ],
} satisfies TopicMeta

/* ---------------------------------------------------------------------------
   The demo object.

   `this: ThisArg` is a TypeScript-only parameter — it is erased at runtime and
   exists purely to let the compiler check the receiver. Typing it as
   `ThisArg | undefined` is what makes the detached call below legal to write,
   which is exactly the situation we want to demonstrate.
   --------------------------------------------------------------------------- */

type ThisArg = { name: string }

type DemoObj = {
  name: string
  /** Regular function: `this` is decided at the CALL SITE. */
  regular(this: ThisArg | undefined | void): void
  /** Arrow: `this` is captured LEXICALLY and cannot be changed. */
  arrow: () => void
}

function makeDemo(log: (s: string) => void): DemoObj {
  const obj: DemoObj = {
    name: 'obj',

    regular(this: ThisArg | undefined | void) {
      const receiver = this as ThisArg | undefined
      log(`regular()  → this.name is ${receiver?.name ?? 'undefined (detached!)'}`)
    },

    // Written as an arrow in the object literal, so `this` comes from the
    // scope around `makeDemo` — NOT from `obj`. This is why arrows are the
    // wrong choice for object methods.
    arrow: () => {
      log('arrow()    → this comes from the enclosing scope, never from obj')
    },
  }
  return obj
}

const other = { name: 'other' }

export default function Demo() {
  const { lines, push, clear } = useLog(16)
  const obj = makeDemo(push)

  return (
    <div className="stack">
      <Panel title="The four binding rules, live">
        <div className="col">
          <div className="row">
            <button
              onClick={() => {
                clear()
                push('--- implicit: obj.regular() ---')
                obj.regular()
              }}
            >
              obj.regular() — implicit
            </button>
            <button
              className="danger"
              onClick={() => {
                clear()
                push('--- default: detached, then called ---')
                const detached = obj.regular
                detached() // no object to the left of a dot
              }}
            >
              const f = obj.regular; f() — detached
            </button>
          </div>

          <div className="row">
            <button
              className="primary"
              onClick={() => {
                clear()
                push('--- explicit: call / apply / bind ---')
                obj.regular.call(other)
                obj.regular.apply(other)
                const bound = obj.regular.bind(other)
                bound()
                // A bound function cannot be re-bound. Still `other`.
                bound.call({ name: 'ignored' })
                push('…and the last line was bound.call({name:"ignored"}) — still “other”.')
              }}
            >
              call / apply / bind — explicit
            </button>
            <button
              onClick={() => {
                clear()
                push('--- arrow: lexical, cannot be changed ---')
                obj.arrow()
                obj.arrow.call(other) // has no effect whatsoever
                push('…and .call(other) on an arrow did nothing. Arrows have no this to set.')
              }}
            >
              arrow — lexical
            </button>
          </div>

          <Log lines={lines} empty="Press a button." />
        </div>
      </Panel>

      <Panel title="The rules, in priority order">
        <table className="data">
          <thead>
            <tr>
              <th>#</th>
              <th>Rule</th>
              <th>Call site</th>
              <th>this is</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1</td>
              <td>
                <code>new</code> binding
              </td>
              <td className="mono">new Foo()</td>
              <td>The newly created object.</td>
            </tr>
            <tr>
              <td>2</td>
              <td>Explicit</td>
              <td className="mono">f.call(o) / f.apply(o) / f.bind(o)()</td>
              <td>
                <code>o</code>.
              </td>
            </tr>
            <tr>
              <td>3</td>
              <td>Implicit</td>
              <td className="mono">o.f()</td>
              <td>
                <code>o</code> — only the object immediately left of the dot.
              </td>
            </tr>
            <tr>
              <td>4</td>
              <td>Default</td>
              <td className="mono">f()</td>
              <td>
                <code>undefined</code> (strict) / <code>globalThis</code> (sloppy).
              </td>
            </tr>
            <tr>
              <td>—</td>
              <td>Arrow</td>
              <td className="mono">anything</td>
              <td>
                Lexical. Taken from the enclosing scope at <i>definition</i> time, and
                unchangeable.
              </td>
            </tr>
          </tbody>
        </table>
      </Panel>

      <Panel title="call vs apply vs bind">
        <pre>
          <code>{`function greet(greeting, punctuation) {
  return greeting + ', ' + this.name + punctuation
}
const user = { name: 'Ada' }

greet.call(user, 'Hello', '!')      // "Hello, Ada!"   — Commas
greet.apply(user, ['Hello', '!'])   // "Hello, Ada!"   — Array
const bound = greet.bind(user, 'Hi')
bound('?')                          // "Hi, Ada?"      — partial application

// A bound function cannot be re-bound:
bound.call({ name: 'Grace' })       // still Ada

// Spread has largely replaced apply — but note it does NOT set this:
Math.max.apply(null, numbers)       // old
Math.max(...numbers)                // modern`}</code>
        </pre>
      </Panel>

      <Panel title="The class-component bug this explains">
        <pre>
          <code>{`class Toggle extends React.Component {
  state = { on: false }

  handleClick() {
    this.setState({ on: !this.state.on })
    //  ^ TypeError: Cannot read properties of undefined (reading 'setState')
  }

  render() {
    // Passing the method DETACHES it. React later calls it with no receiver,
    // and class bodies are always strict mode, so this === undefined.
    return <button onClick={this.handleClick}>toggle</button>
  }
}

// ✅ Fix 1 — bind in the constructor. The pre-2018 standard.
constructor(props) {
  super(props)
  this.handleClick = this.handleClick.bind(this)
}

// ✅ Fix 2 — a class field arrow. Captures this lexically at construction.
handleClick = () => { this.setState(...) }

// ✅ Fix 3 — an inline arrow. Works, but allocates a new function every
//            render, which defeats shouldComponentUpdate on the child.
<button onClick={() => this.handleClick()}>

// ✅ Fix 4 — write a function component. No this at all.`}</code>
        </pre>
        <Callout kind="tip">
          <b>The one-line summary for an interview.</b>{' '}
          &ldquo;<code>this</code> is about how a function is <i>called</i>.
          Arrow functions opted out of that entirely and resolve it lexically —
          which is why they made <code>bind</code> and{' '}
          <code>const self = this</code> disappear from callback code.&rdquo;
        </Callout>
      </Panel>
    </div>
  )
}
