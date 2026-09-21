import { useEffect, useRef, useState } from 'react'
import type { TopicMeta } from '../../types'
import { Callout, Panel, useLog, Log } from '../../lib/ui'

export const meta = {
  title: 'Closures, scope & the React connection',
  summary:
    'The classic loop question, why a closure holds the variable rather than the value, and why every stale-state bug in React is a closure bug.',
  notes: [
    '<b>A closure is a function plus the lexical environment it was created in.</b> The function keeps a live link to those variables, so they survive after the outer function returns.',
    '<b>Closures capture variables, not values.</b> This is the whole of the <code>var</code>-in-a-loop question: one binding, three functions, all pointing at the same box.',
    '<b><code>let</code> and <code>const</code> are block-scoped</b>, and a <code>for</code> loop creates a <i>new binding per iteration</i>. That is why swapping <code>var</code> for <code>let</code> fixes the loop with no other change.',
    '<b>The temporal dead zone:</b> <code>let</code> and <code>const</code> are hoisted but uninitialised, so touching them before the declaration throws <code>ReferenceError</code>. <code>var</code> is hoisted <i>and</i> initialised to <code>undefined</code>.',
    '<b>Closures are how you get privacy in JavaScript</b> — the module pattern, factory functions, and every "private" variable before <code>#field</code> syntax.',
    '<b>Every React render creates a new closure</b> over that render&rsquo;s props and state. A callback captured in one render keeps that render&rsquo;s values forever.',
    '<b>Therefore: stale state in React is not a React bug.</b> It is a closure, working exactly as specified.',
    '<b>The three escapes:</b> the updater form (<code>setX(prev =&gt; …)</code>), a correct dependency array, or a ref holding the latest value.',
  ],
  questions: [
    {
      q: 'What is a closure?',
      a: 'A function together with the lexical environment in which it was defined. When a function is created, it keeps a reference to the scope around it, and that scope survives for as long as the function does — even after the enclosing function has returned.\n\nThe important nuance is that it captures the <i>variable</i>, not a snapshot of the value. Two closures over the same variable see each other\'s changes; a closure over a variable that is later reassigned sees the new value.\n\nIn practice you use closures constantly without naming them: every callback, every event handler, every function returned from a factory. In React, every render creates a fresh set of them over that render\'s props and state, which is the mechanism behind both how hooks work and how stale-state bugs happen.',
    },
    {
      q: 'Why does a for loop with var and setTimeout print the same number three times?',
      a: '<code>var</code> is function-scoped, so the loop creates exactly one <code>i</code> binding for the whole loop. All three callbacks close over that same binding. By the time the timers fire, the loop has finished and <code>i</code> holds its final value — 3 — so all three print 3.\n\nThe fix people usually give is to swap in <code>let</code>, and it works because <code>let</code> in a <code>for</code> loop creates a <i>new binding per iteration</i>. The spec explicitly copies the value into a fresh binding each time round, so each callback closes over its own <code>i</code>.\n\nThe pre-ES6 fix was an IIFE — <code>(function(j) { setTimeout(() =&gt; console.log(j)) })(i)</code> — which creates a new function scope per iteration manually. That is worth knowing, because it shows you understand <i>why</i> <code>let</code> works rather than just that it does.',
    },
    {
      q: 'What is the temporal dead zone?',
      a: 'The region between the start of a block and the point where a <code>let</code> or <code>const</code> declaration is evaluated. The binding exists — it is hoisted to the top of the block — but it is uninitialised, and accessing it throws a <code>ReferenceError</code>.\n\nThis is the difference from <code>var</code>, which is hoisted <i>and</i> initialised to <code>undefined</code>, so reading it early gives you a silent <code>undefined</code> rather than an error.\n\nThe design intent is to turn a class of bug into a loud failure. Reading a variable before its declaration is almost always a mistake, and <code>undefined</code> propagating silently through your code is much harder to debug than a stack trace at the point of the mistake.\n\n<code>const</code> has the additional rule that it must be initialised at declaration and cannot be reassigned — though the value it points at can still be mutated, which is a separate and frequently confused point.',
    },
    {
      q: 'How do closures cause bugs in React?',
      a: 'Because every render creates new closures over that render\'s props and state, and a function captured in one render keeps that render\'s values forever.\n\nThe textbook case is an interval: <code>useEffect(() =&gt; { setInterval(() =&gt; setCount(count + 1), 1000) }, [])</code>. The effect runs once, on mount, so its callback closes over <code>count</code> from the first render — which is 0, permanently. The counter goes to 1 and sticks.\n\nThe same shape appears in event listeners added once, in callbacks passed to non-React libraries, and in any <code>useCallback</code> with a dependency omitted.\n\nThree ways out. The updater form, <code>setCount(c =&gt; c + 1)</code>, so the callback never reads the value from its closure. A correct dependency array, so the effect re-runs and gets a fresh closure. Or a ref, which is a single mutable box shared by every render — which is exactly what the "latest ref" pattern in custom hooks is for.\n\nThe framing that lands: this is not a React quirk. It is JavaScript behaving as specified. React just creates a great many closures.',
    },
    {
      q: 'How do you create private state with closures?',
      a: 'Return functions from a factory that close over local variables. The variables are unreachable from outside — there is no reference to them — so the only way to touch them is through the functions you exposed.\n\n<code>function createCounter() { let count = 0; return { increment: () =&gt; ++count, get: () =&gt; count } }</code>\n\nThat was the only real encapsulation JavaScript had for most of its life, and it is the basis of the module pattern, the revealing module pattern, and every "private" field in pre-2022 code.\n\nModern alternatives are genuine private class fields (<code>#count</code>), which are enforced by the language and cannot be reached even with brackets, and ES modules, where anything not exported is private to the module.\n\nThe closure version still has a place: it gives you per-instance privacy without classes, which fits the functional style most React code is written in.',
    },
  ],
} satisfies TopicMeta

/* ---------------------------------------------------------------------------
   Note: `var` is used deliberately below. It is the only way to demonstrate
   the classic question, and the linter is right to complain about it anywhere
   else.
   --------------------------------------------------------------------------- */

export default function Demo() {
  const { lines, push, clear } = useLog(20)

  const runVarLoop = () => {
    clear()
    push('--- var: ONE binding shared by all three callbacks ---')
    // eslint-disable-next-line no-var
    for (var i = 0; i < 3; i++) {
      setTimeout(() => push(`var  i = ${i}`), 10 * (i + 1))
    }
  }

  const runLetLoop = () => {
    clear()
    push('--- let: a NEW binding per iteration ---')
    for (let j = 0; j < 3; j++) {
      setTimeout(() => push(`let  j = ${j}`), 10 * (j + 1))
    }
  }

  const runIifeLoop = () => {
    clear()
    push('--- var + IIFE: a new function scope per iteration ---')
    // eslint-disable-next-line no-var
    for (var k = 0; k < 3; k++) {
      // The IIFE creates a fresh scope and copies the current value into `copy`.
      // This is exactly what `let` does for you, done by hand.
      ;((copy: number) => {
        setTimeout(() => push(`iife k = ${copy}`), 10 * (copy + 1))
      })(k)
    }
  }

  /* --- Private state via closure ------------------------------------------ */
  // `count` is unreachable from outside. There is no reference to it anywhere
  // except inside these three functions.
  const counterRef = useRef(
    (() => {
      let count = 0
      return {
        increment: () => ++count,
        decrement: () => --count,
        get: () => count,
      }
    })(),
  )
  const [display, setDisplay] = useState(0)

  /* --- The React stale-closure bug ---------------------------------------- */
  const [staleCount, setStaleCount] = useState(0)
  const [freshCount, setFreshCount] = useState(0)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    if (!running) return

    // ❌ This closure captured `staleCount` from the render in which the
    //    effect last ran. Because the dep array omits it, that is the render
    //    where `running` became true — so it computes 0 + 1 forever.
    const stale = setInterval(() => setStaleCount(staleCount + 1), 400)

    // ✅ The updater form never reads a captured value, so there is nothing
    //    to go stale and the dep array is honest.
    const fresh = setInterval(() => setFreshCount((c) => c + 1), 400)

    return () => {
      clearInterval(stale)
      clearInterval(fresh)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running])

  return (
    <div className="stack">
      <Panel title="1. The classic loop question">
        <div className="row" style={{ marginBottom: 10 }}>
          <button className="danger" onClick={runVarLoop}>
            var — prints 3, 3, 3
          </button>
          <button className="primary" onClick={runLetLoop}>
            let — prints 0, 1, 2
          </button>
          <button onClick={runIifeLoop}>var + IIFE — prints 0, 1, 2</button>
        </div>
        <Log lines={lines} empty="Press a button." />
        <Callout kind="tip">
          The answer that scores: &ldquo;a closure captures the{' '}
          <b>variable</b>, not the value. <code>var</code> gives the whole loop
          one binding; <code>let</code> in a <code>for</code> loop creates a new
          binding each iteration, which is what the IIFE was doing by hand
          before ES6.&rdquo;
        </Callout>
      </Panel>

      <div className="grid2">
        <Panel title="2. Private state — no class, no #fields">
          <div className="row">
            <span className="big-num">{display}</span>
            <button onClick={() => setDisplay(counterRef.current.increment())}>+1</button>
            <button onClick={() => setDisplay(counterRef.current.decrement())}>−1</button>
          </div>
          <pre style={{ marginTop: 10 }}>
            <code>{`function createCounter() {
  let count = 0            // unreachable from outside
  return {
    increment: () => ++count,
    get:       () => count,
  }
}

const c = createCounter()
c.increment()
c.count        // undefined — there is no such property`}</code>
          </pre>
        </Panel>

        <Panel title="3. Hoisting and the temporal dead zone">
          <pre>
            <code>{`console.log(a)   // undefined  — hoisted AND initialised
var a = 1

console.log(b)   // ReferenceError: Cannot access 'b'
let b = 2        //   before initialization  ← the TDZ

function f() { return 'hoisted entirely' }   // ✅ callable above
const g = () => 'not hoisted'                // ❌ TDZ until this line

// The design intent: reading a variable before you declare it is
// almost always a mistake. var made it a silent undefined that
// propagates; let makes it a stack trace at the point of the error.`}</code>
          </pre>
        </Panel>
      </div>

      <Panel title="4. The same thing, as a React bug">
        <div className="row" style={{ marginBottom: 10 }}>
          <button className="primary" onClick={() => setRunning((r) => !r)}>
            {running ? 'stop' : 'start'} both intervals
          </button>
          <button
            onClick={() => {
              setStaleCount(0)
              setFreshCount(0)
            }}
          >
            reset
          </button>
        </div>
        <div className="grid2">
          <div className="panel">
            <div className="panel-title" style={{ color: 'var(--bad)' }}>
              setCount(count + 1) — captured closure
            </div>
            <span className="big-num" style={{ color: 'var(--bad)' }}>
              {staleCount}
            </span>
            <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>
              Stuck at 1. The callback closed over <code>staleCount === 0</code>{' '}
              and has been computing <code>0 + 1</code> every 400ms since.
            </div>
          </div>
          <div className="panel">
            <div className="panel-title" style={{ color: 'var(--good)' }}>
              setCount(c =&gt; c + 1) — no capture
            </div>
            <span className="big-num" style={{ color: 'var(--good)' }}>
              {freshCount}
            </span>
            <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>
              Counts correctly. The updater never reads a captured value, so
              there is nothing to be stale.
            </div>
          </div>
        </div>

        <pre style={{ marginTop: 12 }}>
          <code>{`// The three escapes from a stale closure:

// 1. Do not read the value at all.
setCount(c => c + 1)

// 2. Re-create the closure when the value changes.
useEffect(() => { … }, [count])

// 3. Read from a single mutable box shared by every render.
const latest = useRef(count)
useEffect(() => { latest.current = count })
// …then read latest.current inside the callback.`}</code>
        </pre>
      </Panel>
    </div>
  )
}
