import { useState } from 'react'
import type { TopicMeta } from '../../types'
import { Callout, Panel } from '../../lib/ui'
import { useCountdown } from './_lib/components'

export const meta = {
  title: 'Testing custom hooks',
  summary:
    'renderHook, act, and the two rules that account for almost every confusing failure — plus when you should not test a hook directly at all.',
  notes: [
    '<b><code>renderHook(() =&gt; useThing())</code></b> mounts the hook in a throwaway component and returns <code>{ result, rerender, unmount }</code>.',
    '<b><code>result.current</code> is a snapshot.</b> Re-read it after every state change; destructuring it once gives you a value that never updates.',
    '<b>Wrap anything that updates state in <code>act()</code></b>, so React flushes before your assertions run. Otherwise you get the “not wrapped in act” warning and assert on stale values.',
    '<b>Async updates use <code>await act(async () =&gt; …)</code></b>, or <code>waitFor</code> from RTL.',
    '<b><code>rerender(newProps)</code></b> with <code>initialProps</code> tests how the hook responds to changing arguments — the equivalent of a parent passing new props.',
    '<b>Pass a <code>wrapper</code></b> when the hook needs a provider: <code>renderHook(() =&gt; useCart(), { wrapper: CartProvider })</code>.',
    '<b>Test the cleanup.</b> Call <code>unmount()</code> and assert the subscription was removed — a leaked listener is invisible until it is not.',
    '<b>Do not test a hook in isolation if it only exists for one component.</b> Test the component; you get the hook&rsquo;s behaviour plus the integration for free.',
  ],
  questions: [
    {
      q: 'How do you test a custom hook?',
      a: 'With <code>renderHook</code> from React Testing Library. It renders a minimal test component that calls your hook and exposes the return value on <code>result.current</code>.\n\n<code>const { result } = renderHook(() =&gt; useCountdown(10))</code>\n<code>expect(result.current.seconds).toBe(10)</code>\n<code>act(() =&gt; result.current.start())</code>\n\nIt also gives you <code>rerender</code> for changing the hook\'s arguments, <code>unmount</code> for testing cleanup, and a <code>wrapper</code> option for hooks that need providers.\n\nBefore hooks testing utilities existed, people wrote a throwaway <code>TestComponent</code> by hand — which is all <code>renderHook</code> is, with a nicer interface.',
    },
    {
      q: 'Why do you have to re-read result.current?',
      a: 'Because it is a plain property holding whatever the hook returned on the most recent render — it is not a live reference.\n\n<code>const { seconds } = result.current</code> captures the value at that instant. After an <code>act()</code> that causes a re-render, the hook returns a new object, <code>result.current</code> is reassigned to point at it, and your destructured <code>seconds</code> is still looking at the old one.\n\nSo the rule is: always go through <code>result.current</code> at the point of assertion, never destructure it ahead of time. It is the single most common source of "the hook obviously works but the test says it is still 10".',
    },
    {
      q: 'When do you need act()?',
      a: 'Around anything that triggers a state update outside of React\'s own event handling.\n\nCalling a function returned by the hook — <code>result.current.start()</code> — happens outside a React event, so React does not automatically batch and flush it. Advancing fake timers, resolving a promise manually, firing a native event: same.\n\n<code>act()</code> tells React "I am about to do something that updates state; flush everything before you hand control back". Without it you get the "An update to TestComponent inside a test was not wrapped in act(...)" warning, and your assertion reads the state from before the update.\n\nYou do <i>not</i> need it around <code>userEvent</code> or RTL\'s <code>render</code> — they wrap themselves. And for async updates it is <code>await act(async () =&gt; { … })</code>, or just use <code>waitFor</code>, which is act-aware.',
    },
    {
      q: 'Should you always test hooks in isolation?',
      a: 'No, and over-applying <code>renderHook</code> is a common way to end up with a suite that has high coverage and low confidence.\n\nIf a hook exists to serve one component, test the component. You exercise the hook <i>and</i> the wiring between them, and the test describes a user-facing behaviour rather than an internal API. A hook test that passes while the component misuses the hook has told you nothing.\n\nTest a hook directly when it is genuinely a shared unit — something in a shared library, used in several places, with its own edge cases. Then it has its own contract worth pinning down, and testing every branch through one consumer\'s UI would be indirect and brittle.\n\nThe question to ask: is this hook a public API, or an implementation detail of one component?',
    },
  ],
} satisfies TopicMeta

function CountdownDemo() {
  const { seconds, isRunning, start, reset, isDone } = useCountdown(10)
  return (
    <div className="row">
      <span className="big-num" style={{ color: isDone ? 'var(--good)' : undefined }}>
        {seconds}
      </span>
      <button className="primary" onClick={start} disabled={isRunning || isDone}>
        start
      </button>
      <button onClick={reset}>reset</button>
      {isDone && <span className="badge good">done</span>}
    </div>
  )
}

export default function Demo() {
  const [show, setShow] = useState(false)

  return (
    <div className="stack">
      <Callout>
        The hook below is tested in{' '}
        <code>src/topics/06-testing/__tests__/useCountdown.test.ts</code> — six
        tests covering counting, completion, reset, changing props and cleanup,
        all with fake timers so they run in milliseconds.
      </Callout>

      <Panel title="The hook under test">
        <div className="row" style={{ marginBottom: 10 }}>
          <button onClick={() => setShow((v) => !v)}>
            {show ? 'unmount' : 'mount'} the countdown
          </button>
        </div>
        {show && <CountdownDemo />}
      </Panel>

      <Panel title="The two rules">
        <pre>
          <code>{`const { result } = renderHook(() => useCountdown(10))

// RULE 1 — result.current is a SNAPSHOT, not a live reference.
const { seconds } = result.current        // ❌ frozen at 10 forever
act(() => result.current.start())
expect(seconds).toBe(10)                  // ❌ passes for the wrong reason
expect(result.current.seconds).toBe(10)   // ✅ re-read every time

// RULE 2 — anything that updates state goes inside act().
result.current.start()                    // ❌ "not wrapped in act" warning
act(() => { result.current.start() })     // ✅

act(() => { vi.advanceTimersByTime(3000) })      // ✅ timers too
await act(async () => { await somePromise })     // ✅ async variant`}</code>
        </pre>
      </Panel>

      <Panel title="The other three arguments you will need">
        <pre>
          <code>{`// 1. Changing the hook's arguments, like a parent passing new props.
const { result, rerender } = renderHook(
  ({ from }) => useCountdown(from),
  { initialProps: { from: 10 } }
)
rerender({ from: 30 })

// 2. Providers, for a hook that reads context.
const { result } = renderHook(() => useCart(), {
  wrapper: ({ children }) => <CartProvider>{children}</CartProvider>
})

// 3. Cleanup. Worth testing for anything that subscribes.
const clearSpy = vi.spyOn(globalThis, 'clearInterval')
const { result, unmount } = renderHook(() => useCountdown(10))
act(() => result.current.start())
unmount()
expect(clearSpy).toHaveBeenCalled()`}</code>
        </pre>
      </Panel>

      <Callout kind="trap">
        <b>The judgement call.</b> If a hook exists to serve one component, test
        the component instead — you get the hook plus the integration, and the
        test describes something a user cares about. Reserve{' '}
        <code>renderHook</code> for hooks that are genuinely shared units with
        their own contract.
      </Callout>
    </div>
  )
}
