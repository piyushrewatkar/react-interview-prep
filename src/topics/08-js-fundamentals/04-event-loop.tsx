import { useState } from 'react'
import type { TopicMeta } from '../../types'
import { Callout, Panel } from '../../lib/ui'

export const meta = {
  title: 'The event loop: microtasks vs macrotasks',
  summary:
    'The output-ordering question, why a promise always beats a setTimeout(0), and where React rendering and the browser paint fit in.',
  notes: [
    '<b>JavaScript has one call stack.</b> Everything else — timers, network, events — is handled by the host (browser or Node) and queued back.',
    '<b>The loop:</b> run the current task to completion → drain the <i>entire</i> microtask queue → (browser) possibly render → take the next macrotask. Repeat.',
    '<b>Microtasks:</b> promise callbacks (<code>.then</code>/<code>catch</code>/<code>finally</code>), <code>await</code> continuations, <code>queueMicrotask</code>, <code>MutationObserver</code>.',
    '<b>Macrotasks:</b> <code>setTimeout</code>, <code>setInterval</code>, <code>setImmediate</code> (Node), I/O callbacks, and each user event.',
    '<b>Microtasks always run before the next macrotask</b> — and microtasks queued <i>by</i> microtasks are drained in the same pass. That is why an infinite microtask loop hangs the page permanently.',
    '<b><code>setTimeout(fn, 0)</code> is not 0ms.</b> The spec clamps nested timeouts to ~4ms, and it only queues the task — it still waits for the stack and the microtask queue to clear.',
    '<b>Rendering happens between macrotasks</b>, not between microtasks. A long microtask chain blocks paint exactly as a long function does.',
    '<b><code>requestAnimationFrame</code> runs just before the next paint</b>; <code>requestIdleCallback</code> runs when the browser is otherwise free.',
  ],
  questions: [
    {
      q: 'Explain the event loop.',
      a: 'JavaScript runs on a single thread with one call stack, so only one thing executes at a time. Anything asynchronous — a timer, a network request, a click — is handled by the host environment, which puts a callback into a queue when it is ready.\n\nThe event loop is the cycle that drains those queues. It runs the current task until the stack is empty, then drains the <i>entire</i> microtask queue, then — in a browser — may render, then picks up the next macrotask and repeats.\n\nThe crucial detail is the asymmetry between the two queues. Macrotasks are taken one per turn; microtasks are drained completely, including any queued while draining. That is why promise callbacks always beat timers, and why a promise chain that keeps queueing itself will hang the page forever while a recursive <code>setTimeout</code> will not.',
    },
    {
      q: 'What is the output of this, and why?',
      a: 'The standard puzzle is <code>console.log("1")</code>, <code>setTimeout(() =&gt; log("2"), 0)</code>, <code>Promise.resolve().then(() =&gt; log("3"))</code>, <code>console.log("4")</code>.\n\nThe answer is <b>1, 4, 3, 2</b>.\n\n1 and 4 are synchronous, so they run first, in order. The <code>setTimeout</code> callback goes to the macrotask queue and the <code>.then</code> callback goes to the microtask queue. When the synchronous script finishes and the stack empties, the loop drains microtasks first — so 3. Only then does it take the next macrotask — 2.\n\nThe point the question is testing is that <code>setTimeout(…, 0)</code> does not mean "now". It means "queue this as a macrotask", and every microtask already queued gets there first.',
    },
    {
      q: 'What is the difference between a microtask and a macrotask?',
      a: 'Priority, and how many run per turn of the loop.\n\nMicrotasks are promise reactions, <code>await</code> continuations, <code>queueMicrotask</code> and <code>MutationObserver</code> callbacks. The queue is drained <i>completely</i> after the current task, including microtasks queued during the drain.\n\nMacrotasks are timers, I/O callbacks, and each dispatched user event. The loop takes <i>one</i> per turn.\n\nThe practical consequences are both directions of the same fact. Microtasks are how you schedule "after this synchronous code but before anything else", which is exactly what promise semantics need. And an unbounded microtask chain starves everything — it blocks rendering and input handling permanently, where an equivalent <code>setTimeout</code> recursion would leave room for both.',
    },
    {
      q: 'Where does rendering fit in?',
      a: 'Between macrotasks, never between microtasks.\n\nThe browser\'s rendering steps — running <code>requestAnimationFrame</code> callbacks, recalculating style, layout, paint, composite — happen as part of the loop, typically once per display refresh, and only after the microtask queue has been drained.\n\nThat gives you the frame budget: at 60Hz, everything that happens in one turn has about 16.7 milliseconds before a frame is dropped. And it explains why a long synchronous function <i>or</i> a long microtask chain both cause visible jank — neither yields to the rendering steps.\n\nIt is also the mechanism concurrent React exploits. By breaking rendering work into units and yielding between them, React lets the loop reach its rendering steps and handle input, rather than blocking for the whole tree.',
    },
    {
      q: 'Is setTimeout(fn, 0) actually zero?',
      a: 'No, for two separate reasons.\n\nFirst, it only <i>queues</i> the callback. It still has to wait for the current task to finish and the entire microtask queue to drain, which can be arbitrarily long.\n\nSecond, the HTML spec clamps it. After five levels of nesting, the minimum becomes 4ms, so a recursive <code>setTimeout(fn, 0)</code> settles at roughly 250 iterations per second rather than running flat out. Browsers also throttle timers heavily in background tabs — often to once per second or worse.\n\nIf what you actually want is "run after the current synchronous work but as soon as possible", <code>queueMicrotask</code> is the correct tool. If you want "run before the next paint", it is <code>requestAnimationFrame</code>.',
    },
  ],
} satisfies TopicMeta

type Entry = { order: number; label: string; kind: 'sync' | 'micro' | 'macro' | 'raf' }

const KIND_COLOUR: Record<Entry['kind'], string> = {
  sync: 'var(--text)',
  micro: 'var(--accent)',
  macro: 'var(--warn)',
  raf: 'var(--good)',
}

export default function Demo() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [running, setRunning] = useState(false)

  const run = () => {
    setEntries([])
    setRunning(true)
    let order = 0
    const push = (label: string, kind: Entry['kind']) => {
      const o = ++order
      setEntries((e) => [...e, { order: o, label, kind }])
    }

    // ---- SYNCHRONOUS ------------------------------------------------------
    push('script start', 'sync')

    // ---- MACROTASK: goes to the task queue --------------------------------
    setTimeout(() => push('setTimeout 0', 'macro'), 0)
    setTimeout(() => {
      push('setTimeout 10', 'macro')
      setRunning(false)
    }, 10)

    // ---- MICROTASK: goes to the microtask queue ---------------------------
    Promise.resolve().then(() => {
      push('promise.then #1', 'micro')
      // A microtask queued BY a microtask is still drained in the same pass,
      // before any macrotask gets a turn. This is the key asymmetry.
      Promise.resolve().then(() => push('promise.then nested', 'micro'))
    })

    queueMicrotask(() => push('queueMicrotask', 'micro'))

    Promise.resolve().then(() => push('promise.then #2', 'micro'))

    // ---- An async function: everything before the first await is SYNC -----
    const asyncFn = async () => {
      push('async fn: before await (SYNCHRONOUS)', 'sync')
      await null
      // Everything after an await is a microtask continuation.
      push('async fn: after await (microtask)', 'micro')
    }
    asyncFn()

    // ---- rAF: just before the next paint ----------------------------------
    requestAnimationFrame(() => push('requestAnimationFrame', 'raf'))

    push('script end', 'sync')
  }

  return (
    <div className="stack">
      <Panel title="Run it and read the order">
        <div className="row" style={{ marginBottom: 12 }}>
          <button className="primary" onClick={run} disabled={running}>
            {running ? 'running…' : 'run the event-loop demo'}
          </button>
          <button onClick={() => setEntries([])}>clear</button>
          <span className="badge" style={{ color: KIND_COLOUR.sync }}>
            sync
          </span>
          <span className="badge" style={{ color: KIND_COLOUR.micro }}>
            microtask
          </span>
          <span className="badge" style={{ color: KIND_COLOUR.macro }}>
            macrotask
          </span>
          <span className="badge" style={{ color: KIND_COLOUR.raf }}>
            rAF
          </span>
        </div>

        <pre className="log" style={{ maxHeight: 260 }}>
          {entries.length === 0
            ? 'Press run.'
            : entries.map((e) => (
                <span key={e.order} style={{ color: KIND_COLOUR[e.kind], display: 'block' }}>
                  {String(e.order).padStart(2, ' ')}. [{e.kind.padEnd(5)}] {e.label}
                </span>
              ))}
        </pre>

        <Callout kind="tip">
          Every <code>sync</code> line runs first, then <b>every</b> microtask
          — including the one queued by another microtask — and only then the
          first macrotask. That ordering is the whole answer.
        </Callout>
      </Panel>

      <Panel title="The classic question">
        <pre>
          <code>{`console.log('1')

setTimeout(() => console.log('2'), 0)

Promise.resolve().then(() => console.log('3'))

console.log('4')

// Output: 1, 4, 3, 2
//
// 1, 4   synchronous — the call stack runs to completion first
// 3      microtask   — the queue is drained as soon as the stack empties
// 2      macrotask   — one per turn of the loop, after the microtasks

// The harder variant:
async function f() {
  console.log('A')          // SYNCHRONOUS — everything before the first
  await null                //   await runs immediately
  console.log('B')          // microtask continuation
}
console.log('start'); f(); console.log('end')
// Output: start, A, end, B`}</code>
        </pre>
      </Panel>

      <Panel title="One turn of the loop">
        <pre>
          <code>{`┌─────────────────────────────────────────────────────────┐
│  1. Run ONE macrotask to completion                     │
│     (the script itself, a timer callback, a click…)      │
├─────────────────────────────────────────────────────────┤
│  2. Drain the ENTIRE microtask queue                    │
│     — including microtasks queued while draining        │
│     — this is why an infinite promise chain hangs        │
├─────────────────────────────────────────────────────────┤
│  3. (browser, ~once per refresh)                        │
│     requestAnimationFrame callbacks                     │
│     → style → layout → paint → composite                │
│     ~16.7ms budget at 60Hz for everything above         │
├─────────────────────────────────────────────────────────┤
│  4. If idle time remains: requestIdleCallback           │
└──────────────────────── repeat ─────────────────────────┘`}</code>
        </pre>
      </Panel>

      <Panel title="Which scheduler do you want?">
        <table className="data">
          <thead>
            <tr>
              <th>You want</th>
              <th>Use</th>
              <th>Runs</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>After the current sync code, ASAP</td>
              <td className="mono">queueMicrotask(fn)</td>
              <td>Before the next macrotask, before paint.</td>
            </tr>
            <tr>
              <td>Yield to the browser, let it paint</td>
              <td className="mono">setTimeout(fn, 0)</td>
              <td>Next macrotask. Clamped to ~4ms when nested.</td>
            </tr>
            <tr>
              <td>Just before the next frame</td>
              <td className="mono">requestAnimationFrame(fn)</td>
              <td>In the rendering steps. Right place for animation.</td>
            </tr>
            <tr>
              <td>When nothing else is pending</td>
              <td className="mono">requestIdleCallback(fn)</td>
              <td>Spare time at the end of a frame. Analytics, prefetch.</td>
            </tr>
            <tr>
              <td>Break up a long job (React&rsquo;s way)</td>
              <td className="mono">startTransition(fn)</td>
              <td>Interruptible render work, yielding between units.</td>
            </tr>
          </tbody>
        </table>
        <Callout kind="trap">
          <b>The trap worth naming.</b> A recursive <code>queueMicrotask</code>{' '}
          never lets the loop reach step 3, so the page stops painting and stops
          responding to input — permanently. The equivalent recursive{' '}
          <code>setTimeout</code> yields every turn and the page stays alive.
        </Callout>
      </Panel>
    </div>
  )
}
