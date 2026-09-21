import { act, renderHook } from '@testing-library/react'
import { useCountdown } from '../_lib/components'

/* ===========================================================================
   TESTING A CUSTOM HOOK

   `renderHook` mounts a hook inside a throwaway test component and gives you
   its return value on `result.current`.

   Two rules that account for most of the confusion:

   1. `result.current` is a SNAPSHOT. After anything that triggers a re-render,
      you must read `result.current` again — destructuring it once at the top
      gives you a stale value forever.

   2. Anything that causes a state update must be wrapped in `act()`, so React
      flushes the update before you assert. Without it you get the "not wrapped
      in act(...)" warning and your assertions see the pre-update state.
   =========================================================================== */

describe('useCountdown', () => {
  beforeEach(() => {
    // Fake timers let us fast-forward instead of really waiting 10 seconds.
    // Without them this file would take 30s to run and would be flaky.
    vi.useFakeTimers()
  })

  afterEach(() => {
    // ALWAYS restore. Leaving fake timers installed breaks every subsequent
    // test file that relies on real async behaviour — a genuinely nasty and
    // hard-to-trace source of flakiness.
    vi.useRealTimers()
  })

  it('starts at the initial value and is not running', () => {
    const { result } = renderHook(() => useCountdown(10))

    expect(result.current.seconds).toBe(10)
    expect(result.current.isRunning).toBe(false)
    expect(result.current.isDone).toBe(false)
  })

  it('counts down once started', () => {
    const { result } = renderHook(() => useCountdown(10))

    // `start` triggers a state update, so it goes inside act().
    act(() => {
      result.current.start()
    })
    expect(result.current.isRunning).toBe(true)

    // Advancing timers triggers the interval callback, which calls setState —
    // also a state update, so also inside act().
    act(() => {
      vi.advanceTimersByTime(3000)
    })

    // Re-read result.current. If we had destructured `seconds` before the
    // act() above, we would still be looking at 10.
    expect(result.current.seconds).toBe(7)
  })

  it('stops at zero and reports done', () => {
    const { result } = renderHook(() => useCountdown(3))

    act(() => {
      result.current.start()
    })
    act(() => {
      vi.advanceTimersByTime(5000) // deliberately past the end
    })

    expect(result.current.seconds).toBe(0)
    expect(result.current.isDone).toBe(true)
    expect(result.current.isRunning).toBe(false)
  })

  it('reset restores the initial value', () => {
    const { result } = renderHook(() => useCountdown(10))

    act(() => result.current.start())
    act(() => vi.advanceTimersByTime(4000))
    expect(result.current.seconds).toBe(6)

    act(() => result.current.reset())

    expect(result.current.seconds).toBe(10)
    expect(result.current.isRunning).toBe(false)
  })

  it('accepts new props through rerender', () => {
    // `initialProps` plus `rerender` is how you test a hook's reaction to
    // changing arguments — the equivalent of a parent passing new props.
    const { result, rerender } = renderHook(({ from }) => useCountdown(from), {
      initialProps: { from: 10 },
    })

    expect(result.current.seconds).toBe(10)

    rerender({ from: 30 })

    // useState ignores a changed initial value — the hook keeps its own state.
    // That is correct React behaviour, and this test documents it.
    expect(result.current.seconds).toBe(10)

    // But `reset` closes over the NEW `from`, so it picks up the change.
    act(() => result.current.reset())
    expect(result.current.seconds).toBe(30)
  })

  it('clears its interval on unmount', () => {
    const clearSpy = vi.spyOn(globalThis, 'clearInterval')
    const { result, unmount } = renderHook(() => useCountdown(10))

    act(() => result.current.start())
    unmount()

    // Asserting that cleanup runs is worth doing for any hook that subscribes
    // to something. A leaked interval is invisible until it is a memory leak.
    expect(clearSpy).toHaveBeenCalled()
  })
})
