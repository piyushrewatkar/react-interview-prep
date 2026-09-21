import { useState } from 'react'
import type { TopicMeta } from '../../types'
import { Callout, Panel, sleep, useLog, Log } from '../../lib/ui'

export const meta = {
  title: 'Promises, async/await & the combinators',
  summary:
    'The four combinators and when each is right, error handling that does not swallow failures, and sequential-vs-parallel — the mistake that shows up in every code review.',
  notes: [
    '<b>A promise has three states:</b> pending → fulfilled, or pending → rejected. Once settled it never changes.',
    '<b><code>.then</code> always returns a new promise</b>, which is what makes chaining work. Returning a value fulfils it; returning a promise adopts it; throwing rejects it.',
    '<b><code>async</code> always returns a promise</b>, and <code>await</code> unwraps one. <code>await</code> on a non-promise still yields to the microtask queue.',
    '<b><code>Promise.all</code></b> — all must succeed. Rejects immediately on the first failure (but the others keep running; they are not cancelled).',
    '<b><code>Promise.allSettled</code></b> — waits for every one and reports <code>{status, value|reason}</code> for each. Never rejects.',
    '<b><code>Promise.race</code></b> — settles with the first to <i>settle</i>, fulfilled or rejected. Use it for timeouts.',
    '<b><code>Promise.any</code></b> — settles with the first to <i>fulfil</i>; rejects with an <code>AggregateError</code> only if all fail.',
    '<b>Sequential vs parallel:</b> <code>await a(); await b()</code> is serial. <code>await Promise.all([a(), b()])</code> is concurrent. Independent requests should be the second one.',
    '<b>An unhandled rejection is a crash in Node</b> and a console error in browsers. Always <code>.catch</code> or <code>try/catch</code>.',
  ],
  questions: [
    {
      q: 'What is the difference between Promise.all, allSettled, race and any?',
      a: '<b><code>all</code></b> waits for every promise to fulfil, and rejects as soon as any one rejects — with that first error. Use it when you need all the results and any failure makes the whole operation meaningless. Note that a rejection does not cancel the others; they keep running, their results are just discarded.\n\n<b><code>allSettled</code></b> waits for every promise to settle and never rejects. It gives you an array of <code>{status: "fulfilled", value}</code> or <code>{status: "rejected", reason}</code>. Use it when partial success is acceptable — loading six dashboard widgets, where one failing should not blank the page.\n\n<b><code>race</code></b> settles with whichever settles first, fulfilled <i>or</i> rejected. The classic use is a timeout: race the real work against a promise that rejects after N milliseconds.\n\n<b><code>any</code></b> settles with the first to <i>fulfil</i>, ignoring rejections, and only rejects — with an <code>AggregateError</code> — if every one fails. Use it for redundant sources: three mirrors, take whichever answers first.\n\nThe pair people confuse is <code>race</code> and <code>any</code>: <code>race</code> cares about the first to settle, <code>any</code> about the first to succeed.',
    },
    {
      q: 'What is wrong with awaiting in a loop?',
      a: 'It serialises work that could be concurrent. <code>for (const id of ids) { results.push(await fetchUser(id)) }</code> with ten ids and a 200ms request takes two seconds; the same ten requests in parallel take two hundred milliseconds.\n\nThe fix is <code>const results = await Promise.all(ids.map(id =&gt; fetchUser(id)))</code>. Note that <code>.map</code> starts every request immediately — the promises are already in flight before <code>Promise.all</code> ever sees them.\n\nWhen it <i>is</i> correct to await in a loop: when each iteration genuinely depends on the previous one, or when you are deliberately rate-limiting to avoid hammering a server. For the second case, a concurrency-limited map — <code>p-limit</code>, or a hand-rolled pool — is usually better than full serialisation.\n\nThe subtle related bug is <code>array.forEach(async item =&gt; { await … })</code>, which does not wait at all: <code>forEach</code> ignores the returned promises, so the function continues before any of them finish.',
    },
    {
      q: 'How do you add a timeout to a fetch?',
      a: 'Two ways, and the better one depends on whether you want to actually stop the request.\n\n<code>Promise.race</code> is the classic: race the fetch against a promise that rejects after N milliseconds. It gives you a timeout error, but the underlying request keeps running in the background — you have only stopped waiting for it.\n\n<code>AbortController</code> genuinely cancels. Create one, pass <code>signal</code> to <code>fetch</code>, and call <code>abort()</code> from a timer. The request is terminated, the connection is freed, and <code>fetch</code> rejects with an <code>AbortError</code> you can distinguish from a real failure.\n\n<code>AbortSignal.timeout(5000)</code> is the modern shorthand for exactly that, in one line.\n\nFor anything real I would use the abort version, because a hung request that nobody is waiting for still holds a connection — and in React it is the same mechanism you use to cancel a stale request when the effect re-runs.',
    },
    {
      q: 'What happens to errors in an async function?',
      a: 'A <code>throw</code> inside an <code>async</code> function rejects the promise it returns. So the caller sees a rejection, not a thrown exception — which is why a <code>try/catch</code> around the <i>call site</i> only works if you <code>await</code> there.\n\n<code>try { doAsyncThing() } catch {}</code> catches nothing, because the function returns immediately and the rejection happens later. It needs to be <code>try { await doAsyncThing() } catch {}</code>.\n\nThe other common leak is a floating promise: calling an async function without awaiting it and without a <code>.catch</code>. If it rejects, you get an unhandled rejection — a console error in the browser, and a process crash in Node by default since v15.\n\nAnd a detail worth knowing: <code>.then(onSuccess, onError)</code> and <code>.then(onSuccess).catch(onError)</code> are not equivalent. The second catches errors thrown by <code>onSuccess</code>; the first does not.',
    },
    {
      q: 'Can you cancel a promise?',
      a: 'Not the promise itself — once created, it will settle. There is no <code>promise.cancel()</code>, and that was a deliberate design decision.\n\nWhat you can cancel is the <i>underlying operation</i>, and the standard mechanism is <code>AbortController</code>. You pass its <code>signal</code> to an API that understands it — <code>fetch</code> does, as do several newer browser APIs — and calling <code>abort()</code> makes the operation stop and the promise reject with an <code>AbortError</code>.\n\nFor promises you cannot abort, the pattern is to ignore the result rather than stop the work: a boolean latch that the continuation checks, which is exactly the <code>let ignore = false</code> pattern in a React effect\'s cleanup.\n\nThe distinction is worth stating clearly in an interview: cancelling means "stop the work and free the resources"; ignoring means "the work continues but nobody uses the result". Abort gives you the first; a latch gives you the second.',
    },
  ],
} satisfies TopicMeta

/* --- A fake API with controllable timing and failure ---------------------- */
async function task(name: string, ms: number, shouldFail = false): Promise<string> {
  await sleep(ms)
  if (shouldFail) throw new Error(`${name} failed`)
  return `${name} (${ms}ms)`
}

export default function Demo() {
  const { lines, push, clear } = useLog(30)
  const [busy, setBusy] = useState(false)

  const time = async (label: string, fn: () => Promise<void>) => {
    clear()
    setBusy(true)
    const t0 = performance.now()
    push(`--- ${label} ---`)
    try {
      await fn()
    } catch (e) {
      push(`caught: ${(e as Error).message}`)
    }
    push(`total: ${Math.round(performance.now() - t0)}ms`)
    setBusy(false)
  }

  /* --- Sequential vs parallel ---------------------------------------------- */
  const runSequential = () =>
    time('await in a loop — SERIAL', async () => {
      const ids = ['A', 'B', 'C']
      const out: string[] = []
      for (const id of ids) {
        // Each iteration waits for the previous one to finish.
        out.push(await task(id, 300))
        push(`got ${id}`)
      }
      push(out.join(' | '))
    })

  const runParallel = () =>
    time('Promise.all — CONCURRENT', async () => {
      const ids = ['A', 'B', 'C']
      // .map starts all three IMMEDIATELY. By the time Promise.all sees them
      // they are already in flight; all it does is wait.
      const out = await Promise.all(ids.map((id) => task(id, 300)))
      push(out.join(' | '))
    })

  /* --- The four combinators ------------------------------------------------ */
  const runAll = () =>
    time('Promise.all with one failure', async () => {
      const results = await Promise.all([
        task('fast', 200),
        task('broken', 400, true), // rejects
        task('slow', 800), // keeps running — it is NOT cancelled
      ])
      push(JSON.stringify(results))
    })

  const runAllSettled = () =>
    time('Promise.allSettled — partial success', async () => {
      const results = await Promise.allSettled([
        task('fast', 200),
        task('broken', 400, true),
        task('slow', 800),
      ])
      for (const r of results) {
        push(
          r.status === 'fulfilled'
            ? `✅ ${r.value}`
            : `❌ ${(r.reason as Error).message}`,
        )
      }
    })

  const runRace = () =>
    time('Promise.race — first to SETTLE, success or failure', async () => {
      const winner = await Promise.race([
        task('slow-but-ok', 600),
        task('fast-but-broken', 200, true), // this one wins, and it rejects
      ])
      push(`winner: ${winner}`)
    })

  const runAny = () =>
    time('Promise.any — first to FULFIL', async () => {
      const winner = await Promise.any([
        task('fast-but-broken', 200, true), // ignored
        task('slower-but-ok', 500), // this one wins
        task('slowest', 900),
      ])
      push(`winner: ${winner}`)
    })

  /* --- Timeouts ------------------------------------------------------------ */
  const runRaceTimeout = () =>
    time('timeout via Promise.race (does NOT cancel)', async () => {
      const timeout = (ms: number) =>
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms),
        )
      const result = await Promise.race([task('long-request', 1500), timeout(400)])
      push(result)
    })

  const runAbort = () =>
    time('timeout via AbortController (genuinely cancels)', async () => {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 400)

      const abortable = (ms: number, signal: AbortSignal) =>
        new Promise<string>((resolve, reject) => {
          const id = setTimeout(() => resolve(`finished after ${ms}ms`), ms)
          signal.addEventListener('abort', () => {
            // The real work stops here — the timer is cleared, and in a real
            // fetch the connection is torn down.
            clearTimeout(id)
            reject(new DOMException('Aborted', 'AbortError'))
          })
        })

      try {
        push(await abortable(1500, controller.signal))
      } catch (e) {
        const err = e as Error
        push(
          err.name === 'AbortError'
            ? 'AbortError — the underlying work was actually stopped'
            : err.message,
        )
      } finally {
        clearTimeout(timer)
      }
    })

  return (
    <div className="stack">
      <Panel title="1. Sequential vs parallel — the code-review classic">
        <div className="row" style={{ marginBottom: 10 }}>
          <button className="danger" onClick={runSequential} disabled={busy}>
            await in a loop (~900ms)
          </button>
          <button className="primary" onClick={runParallel} disabled={busy}>
            Promise.all (~300ms)
          </button>
        </div>
        <pre>
          <code>{`// ❌ 3 × 300ms = 900ms. Each request waits for the last.
for (const id of ids) {
  results.push(await fetchUser(id))
}

// ✅ 300ms. .map starts all three immediately.
const results = await Promise.all(ids.map(id => fetchUser(id)))

// ❌ Does not wait AT ALL — forEach ignores the returned promises.
ids.forEach(async id => { await fetchUser(id) })
console.log('done')   // logs before any request finishes`}</code>
        </pre>
      </Panel>

      <Panel title="2. The four combinators">
        <div className="row" style={{ marginBottom: 10 }}>
          <button onClick={runAll} disabled={busy}>
            Promise.all
          </button>
          <button onClick={runAllSettled} disabled={busy}>
            Promise.allSettled
          </button>
          <button onClick={runRace} disabled={busy}>
            Promise.race
          </button>
          <button onClick={runAny} disabled={busy}>
            Promise.any
          </button>
        </div>
        <table className="data">
          <thead>
            <tr>
              <th>Combinator</th>
              <th>Settles when</th>
              <th>Rejects when</th>
              <th>Use for</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="mono">all</td>
              <td>All fulfil</td>
              <td>The first rejection</td>
              <td>All-or-nothing: you need every result.</td>
            </tr>
            <tr>
              <td className="mono">allSettled</td>
              <td>All settle</td>
              <td className="mono">never</td>
              <td>Partial success: six dashboard widgets, one may fail.</td>
            </tr>
            <tr>
              <td className="mono">race</td>
              <td>The first to settle</td>
              <td>If that first one rejected</td>
              <td>Timeouts.</td>
            </tr>
            <tr>
              <td className="mono">any</td>
              <td>The first to fulfil</td>
              <td>Only if all reject (AggregateError)</td>
              <td>Redundant sources: three mirrors, take the fastest.</td>
            </tr>
          </tbody>
        </table>
      </Panel>

      <Panel title="3. Timeouts: race vs abort">
        <div className="row" style={{ marginBottom: 10 }}>
          <button onClick={runRaceTimeout} disabled={busy}>
            Promise.race timeout
          </button>
          <button className="primary" onClick={runAbort} disabled={busy}>
            AbortController timeout
          </button>
        </div>
        <pre>
          <code>{`// Stops WAITING. The request keeps running and holding a connection.
await Promise.race([fetch(url), timeout(5000)])

// Stops the REQUEST. The connection is freed; fetch rejects with AbortError.
const controller = new AbortController()
setTimeout(() => controller.abort(), 5000)
await fetch(url, { signal: controller.signal })

// The modern one-liner for exactly that:
await fetch(url, { signal: AbortSignal.timeout(5000) })

// …and the same signal is what a React effect's cleanup uses to cancel
// a stale request when a dependency changes.`}</code>
        </pre>
      </Panel>

      <Panel title="Output">
        <Log lines={lines} empty="Press a button above." />
      </Panel>

      <Callout kind="trap">
        <b>Two error-handling traps.</b>{' '}
        <code>try {'{'} doAsync() {'}'} catch {'{}'}</code> catches nothing —
        without <code>await</code>, the function returns before it can reject.
        And <code>.then(ok, err)</code> is not{' '}
        <code>.then(ok).catch(err)</code>: only the second catches an error
        thrown inside <code>ok</code>.
      </Callout>
    </div>
  )
}
