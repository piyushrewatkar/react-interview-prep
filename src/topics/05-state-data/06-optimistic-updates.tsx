import { useOptimistic, useState, useTransition } from 'react'
import type { TopicMeta } from '../../types'
import { Callout, Panel, sleep, useLog, Log } from '../../lib/ui'

export const meta = {
  title: 'Optimistic updates',
  summary:
    'Applying a change before the server confirms it, and rolling back cleanly when it fails. Plus React 19’s useOptimistic.',
  notes: [
    '<b>The idea:</b> most mutations succeed, so show the result immediately and reconcile when the response arrives. The UI feels instant instead of network-bound.',
    '<b>The three steps:</b> snapshot the current state, apply the predicted change, and on failure restore the snapshot and tell the user.',
    '<b>Always keep the snapshot.</b> Rolling back by re-deriving or refetching is slower and can lose other changes made in the meantime.',
    '<b>React Query models it explicitly:</b> <code>onMutate</code> cancels in-flight queries, snapshots and applies; <code>onError</code> restores; <code>onSettled</code> invalidates so the server remains the source of truth.',
    '<b>Cancel in-flight refetches first</b> — otherwise a query that was already running can land old data on top of your optimistic update.',
    '<b>React 19&rsquo;s <code>useOptimistic</code></b> gives you a temporary overlay value that automatically reverts when the surrounding transition finishes. No manual snapshot.',
    '<b>Do not be optimistic about things that usually fail</b>, or where being wrong is expensive: payments, irreversible deletes, anything with server-side validation you cannot replicate.',
    '<b>Good candidates:</b> likes, toggles, reordering, adding a to-do, marking read — high success rate, cheap to reverse, immediately visible.',
  ],
  questions: [
    {
      q: 'What is an optimistic update and when is it appropriate?',
      a: 'Applying a mutation to the UI immediately, before the server has confirmed it, on the assumption that it will succeed. If it fails, you roll back.\n\nIt is appropriate when three things hold: the operation almost always succeeds, the result is cheap and safe to reverse, and the user would otherwise be staring at a spinner for something they expect to be instant. Liking a post, toggling a checkbox, reordering a list, adding an item — all good.\n\nIt is inappropriate when failure is common or expensive: anything involving payment, an irreversible delete, or a mutation whose validity depends on server state you cannot check locally. Showing someone their payment succeeded and then taking it back is much worse than a two-second spinner.\n\nThe framing I would offer: you are trading a small chance of a confusing rollback for a large improvement in perceived speed. Take that trade when the odds are strongly in your favour.',
    },
    {
      q: 'How do you implement rollback correctly?',
      a: 'Snapshot before you mutate, and restore the snapshot on failure. Not re-derive, not refetch — restore the exact previous value.\n\nIn React Query that is the <code>onMutate</code>/<code>onError</code>/<code>onSettled</code> triad. <code>onMutate</code> first cancels any in-flight queries for the key (otherwise a refetch that was already running can overwrite your optimistic value with stale data), then snapshots the cache with <code>getQueryData</code> and applies the optimistic change with <code>setQueryData</code>, returning the snapshot as its context. <code>onError</code> receives that context and writes the snapshot back. <code>onSettled</code> invalidates the key either way, so the server has the final word.\n\nThe subtlety worth mentioning: with concurrent mutations, a naive rollback can undo a <i>later</i> successful change. Keying optimistic entries by a temporary id, or invalidating rather than restoring when several are in flight, handles that.',
    },
    {
      q: 'What does useOptimistic do?',
      a: 'It is a React 19 hook that gives you a temporary, optimistic view of a value while an async action is in progress, and reverts automatically when that action completes.\n\n<code>const [optimisticTodos, addOptimistic] = useOptimistic(todos, (state, newTodo) =&gt; [...state, newTodo])</code>\n\nInside a transition you call <code>addOptimistic(item)</code>, and the component renders the optimistic list immediately. When the transition finishes — the server action returns and the real state updates — React discards the optimistic overlay and shows the real value.\n\nThe important difference from the manual approach is that there is no rollback code. You never snapshot and never restore: the overlay is inherently temporary, so if the action fails and the real state never changed, the UI reverts by itself. It removes the class of bugs where the rollback path is wrong because nobody ever exercised it.\n\nIt is designed for the server-actions model, but it works with any promise inside a transition.',
    },
    {
      q: 'What can go wrong with optimistic updates?',
      a: 'Four things, in rough order of how often I have seen them.\n\n<b>A racing refetch.</b> A background revalidation that was already in flight resolves after your optimistic write and replaces it with the old server value. Cancelling in-flight queries first is the fix, and it is the step people skip.\n\n<b>Concurrent mutations.</b> Two optimistic updates in flight, the first fails, and a naive rollback to its snapshot also discards the second. You need per-mutation identity or invalidation rather than restoration.\n\n<b>Server-assigned data.</b> Your optimistic item has no real id, no server timestamp, no computed fields. The UI has to cope with a temporary shape — and keys based on a temporary id will cause a remount when the real one arrives.\n\n<b>A silent rollback.</b> The change reverts and the user assumes they misclicked. A rollback always needs a visible message.',
    },
  ],
} satisfies TopicMeta

type Todo = { id: string; text: string; pending?: boolean }

const INITIAL: Todo[] = [
  { id: '1', text: 'Read the reconciliation topic' },
  { id: '2', text: 'Rehearse the useEffect race answer' },
]

/** Fails whenever the text contains "fail", so the rollback path is reachable. */
async function saveTodo(text: string): Promise<Todo> {
  await sleep(1200)
  if (text.toLowerCase().includes('fail')) throw new Error('Server rejected: 422 Unprocessable.')
  return { id: crypto.randomUUID(), text }
}

/* ===========================================================================
   VERSION A — pessimistic. Correct, and it feels slow.
   =========================================================================== */
function Pessimistic({ log }: { log: (s: string) => void }) {
  const [todos, setTodos] = useState(INITIAL)
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!text.trim()) return
    setSaving(true)
    setError(null)
    log(`pessimistic: waiting for the server…`)
    try {
      const saved = await saveTodo(text)
      setTodos((t) => [...t, saved])
      setText('')
      log(`pessimistic: server confirmed after 1.2s`)
    } catch (e) {
      setError((e as Error).message)
      log(`pessimistic: failed — nothing to undo`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="col">
      <div className="row">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="type… (include 'fail' to break it)"
          disabled={saving}
          style={{ flex: 1, minWidth: 140 }}
        />
        <button onClick={submit} disabled={saving}>
          {saving ? 'saving…' : 'add'}
        </button>
      </div>
      {error && <div className="callout trap">{error}</div>}
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
        {todos.map((t) => (
          <li key={t.id}>{t.text}</li>
        ))}
      </ul>
      <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>
        1.2 seconds of nothing happening before the item appears.
      </div>
    </div>
  )
}

/* ===========================================================================
   VERSION B — manual optimistic, with snapshot and rollback.
   =========================================================================== */
function ManualOptimistic({ log }: { log: (s: string) => void }) {
  const [todos, setTodos] = useState(INITIAL)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!text.trim()) return

    // 1. SNAPSHOT. Keep the exact previous value — not a recomputation of it.
    const snapshot = todos

    // 2. APPLY the predicted result immediately.
    const tempId = `temp-${crypto.randomUUID()}`
    const optimistic: Todo = { id: tempId, text, pending: true }
    setTodos((t) => [...t, optimistic])
    setText('')
    setError(null)
    log(`optimistic: shown instantly with a temporary id`)

    try {
      const saved = await saveTodo(optimistic.text)
      // 3a. SUCCESS: swap the temporary entry for the real one. Note we map
      //     rather than append — appending would duplicate it.
      setTodos((t) => t.map((x) => (x.id === tempId ? saved : x)))
      log(`optimistic: server confirmed, temp id replaced with real id`)
    } catch (e) {
      // 3b. FAILURE: restore the snapshot and TELL THE USER. A silent rollback
      //     reads as "my click did not register".
      setTodos(snapshot)
      setText(optimistic.text) // give them their input back
      setError((e as Error).message)
      log(`optimistic: failed — rolled back to the snapshot`)
    }
  }

  return (
    <div className="col">
      <div className="row">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="type… (include 'fail' to break it)"
          style={{ flex: 1, minWidth: 140 }}
        />
        <button className="primary" onClick={submit}>
          add
        </button>
      </div>
      {error && <div className="callout trap">{error}</div>}
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
        {todos.map((t) => (
          <li key={t.id} style={{ opacity: t.pending ? 0.5 : 1 }}>
            {t.text} {t.pending && <span className="badge warn">saving…</span>}
          </li>
        ))}
      </ul>
      <div style={{ fontSize: 13, color: 'var(--good)' }}>
        Instant. The dimmed row is the optimistic one.
      </div>
    </div>
  )
}

/* ===========================================================================
   VERSION C — React 19's useOptimistic. No snapshot, no rollback code.
   =========================================================================== */
function WithUseOptimistic({ log }: { log: (s: string) => void }) {
  const [todos, setTodos] = useState(INITIAL)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // `optimisticTodos` is `todos` with any pending additions overlaid. React
  // discards the overlay automatically when the transition below completes —
  // so if the action failed and `todos` never changed, the UI reverts by
  // itself. There is no rollback path to get wrong.
  const [optimisticTodos, addOptimistic] = useOptimistic(
    todos,
    (state: Todo[], newText: string) => [
      ...state,
      { id: `optimistic-${newText}`, text: newText, pending: true },
    ],
  )

  const action = (formData: FormData) => {
    const text = String(formData.get('text') ?? '')
    if (!text.trim()) return

    startTransition(async () => {
      // Must be inside the transition, or React has nothing to tie the
      // overlay's lifetime to.
      addOptimistic(text)
      setError(null)
      log(`useOptimistic: overlay applied`)
      try {
        const saved = await saveTodo(text)
        setTodos((t) => [...t, saved])
        log(`useOptimistic: real state updated, overlay discarded`)
      } catch (e) {
        setError((e as Error).message)
        // NOTHING TO UNDO. `todos` was never modified, so when the transition
        // ends the overlay simply disappears.
        log(`useOptimistic: failed — overlay reverted automatically`)
      }
    })
  }

  return (
    <div className="col">
      {/* React 19 lets a form take an action function directly, and resets the
          uncontrolled input for you on success. */}
      <form action={action} className="row">
        <input
          name="text"
          placeholder="type… (include 'fail' to break it)"
          style={{ flex: 1, minWidth: 140 }}
        />
        <button className="primary" type="submit" disabled={isPending}>
          add
        </button>
      </form>
      {error && <div className="callout trap">{error}</div>}
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
        {optimisticTodos.map((t) => (
          <li key={t.id} style={{ opacity: t.pending ? 0.5 : 1 }}>
            {t.text} {t.pending && <span className="badge warn">saving…</span>}
          </li>
        ))}
      </ul>
      <div style={{ fontSize: 13, color: 'var(--good)' }}>
        Instant, and there is no rollback code in this component at all.
      </div>
    </div>
  )
}

export default function Demo() {
  const { lines, push, clear } = useLog(14)

  return (
    <div className="stack">
      <Callout>
        Type anything containing the word <b>fail</b> to trigger the error path
        in all three columns.
      </Callout>

      <div className="grid2">
        <Panel title="❌ Pessimistic — wait for the server">
          <Pessimistic log={push} />
        </Panel>
        <Panel title="✅ Manual optimistic — snapshot + rollback">
          <ManualOptimistic log={push} />
        </Panel>
      </div>

      <Panel title="✅ React 19 — useOptimistic">
        <WithUseOptimistic log={push} />
      </Panel>

      <Panel title="What happened">
        <Log lines={lines} empty="Add an item in any column." />
        <div className="row" style={{ marginTop: 10 }}>
          <button onClick={clear}>clear</button>
        </div>
      </Panel>

      <Panel title="The React Query shape">
        <pre>
          <code>{`useMutation({
  mutationFn: addTodo,

  async onMutate(newTodo) {
    // 1. Stop any refetch that is already in flight, or it can land
    //    stale server data on top of our optimistic write.
    await queryClient.cancelQueries({ queryKey: ['todos'] })

    // 2. Snapshot, and return it as this mutation's context.
    const previous = queryClient.getQueryData(['todos'])

    // 3. Apply optimistically.
    queryClient.setQueryData(['todos'], old => [...old, newTodo])

    return { previous }
  },

  onError(err, newTodo, context) {
    // 4. Restore the exact snapshot. Not a refetch — a restore.
    queryClient.setQueryData(['todos'], context.previous)
    toast.error('Could not save. Your change was undone.')   // never silent
  },

  onSettled() {
    // 5. Either way, let the server have the final word.
    queryClient.invalidateQueries({ queryKey: ['todos'] })
  },
})`}</code>
        </pre>
      </Panel>

      <Callout kind="trap">
        <b>The step people skip</b> is <code>cancelQueries</code>. Without it, a
        background revalidation that started before your mutation can resolve
        afterwards and silently overwrite the optimistic value with the old one
        — an intermittent bug that is miserable to reproduce.
      </Callout>
    </div>
  )
}
