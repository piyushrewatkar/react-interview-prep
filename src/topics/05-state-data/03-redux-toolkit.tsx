import { useState } from 'react'
import { Provider } from 'react-redux'
import type { TopicMeta } from '../../types'
import { Callout, Panel, RenderBadge } from '../../lib/ui'
import {
  added,
  clearedCompleted,
  fetchSampleTodos,
  filterChanged,
  removed,
  selectCounts,
  selectError,
  selectFilter,
  selectLoading,
  selectVisibleTodos,
  store,
  toggled,
  useAppDispatch,
  useAppSelector,
} from './_lib/store'

export const meta = {
  title: 'Redux Toolkit',
  summary:
    'The official, modern Redux: slices, Immer, thunks, typed hooks and memoised selectors — and the questions that separate people who have read about it from people who have shipped it.',
  notes: [
    '<b>The three principles are unchanged:</b> a single source of truth, state is read-only, and changes are made by pure reducers.',
    '<b><code>createSlice</code></b> generates action creators and a reducer from one object. No action-type constants, no switch, no separate actions file.',
    '<b>Immer makes reducers look mutable.</b> <code>state.items.push(x)</code> inside a slice is safe — you are mutating a draft proxy and RTK produces a new immutable state from the recorded changes.',
    '<b><code>configureStore</code></b> wires up DevTools, thunk middleware, and development checks for accidental mutation and non-serialisable values.',
    '<b><code>createAsyncThunk</code></b> dispatches <code>pending</code>/<code>fulfilled</code>/<code>rejected</code> automatically; you handle them in <code>extraReducers</code>.',
    '<b>Type the hooks once</b> — <code>useAppSelector</code> and <code>useAppDispatch</code> — and never import the raw ones in a component.',
    '<b>Memoise any selector that returns a new object or array.</b> <code>useSelector</code> compares by reference, so an unmemoised <code>.filter()</code> re-renders on every action.',
    '<b>Do not put server data here by hand.</b> Use RTK Query (built into RTK) or React Query; writing your own cache in thunks is the classic mistake.',
  ],
  questions: [
    {
      q: 'What problems does Redux Toolkit solve compared with classic Redux?',
      a: 'Boilerplate and footguns, roughly in that order.\n\nClassic Redux meant writing action-type constants, action creators, and a switch-based reducer for every piece of state — three files and forty lines for "add a todo". <code>createSlice</code> collapses that into one object and generates the action creators from the reducer names.\n\nIt also removed the manual immutable-update gymnastics. Deeply nested spread updates were where most Redux bugs came from; Immer lets you write what looks like a mutation and produces the immutable result correctly.\n\n<code>configureStore</code> replaced the hand-rolled <code>createStore</code> plus <code>applyMiddleware</code> plus DevTools composition dance, and added development checks that catch accidental mutation and non-serialisable values in the store.\n\nAnd <code>createAsyncThunk</code> plus RTK Query gave official answers to "how do I do async", which classic Redux deliberately left to the ecosystem — and which fragmented it.',
    },
    {
      q: 'If reducers must be pure, how can I write state.items.push()?',
      a: 'Because that is not the real state — it is an Immer draft proxy. RTK wraps every slice reducer in <code>produce</code>, which hands you a proxy that records every mutation you perform, then constructs a new immutable state from the recording. Structural sharing means unchanged branches keep their identity, so reference equality checks downstream still work.\n\nThe rule that matters: this only applies <i>inside</i> a slice reducer or an <code>extraReducers</code> case. Mutating store state anywhere else — in a component, in a thunk after reading state, in a selector — is still a real bug and RTK\'s development middleware will warn you about it.\n\nOne gotcha worth knowing: in a reducer you either mutate the draft <i>or</i> return a new value, never both. Mixing them throws.',
    },
    {
      q: 'Why do selectors need memoising?',
      a: 'Because <code>useSelector</code> runs the selector after <i>every</i> dispatched action and compares the result to the previous one with reference equality. If your selector returns a new array or object each time — <code>state =&gt; state.todos.items.filter(t =&gt; !t.done)</code> — the reference always differs, so the component re-renders on every action in the entire application, including ones that touched a completely different slice.\n\n<code>createSelector</code> from Reselect fixes it: it caches the result and only recomputes when its input selectors return something different. So the filtered array keeps its identity until the underlying items or filter actually change.\n\nThe alternative for simple cases is to select primitives — <code>state =&gt; state.todos.items.length</code> is fine unmemoised, because numbers compare by value. Or pass <code>shallowEqual</code> as the second argument to <code>useSelector</code>.',
    },
    {
      q: 'When would you use Redux at all these days?',
      a: 'Less often than five years ago, and I would say so plainly.\n\nMost of what filled Redux stores historically was server data, and that now belongs in React Query or RTK Query. A lot of the rest was URL state. Once both are relocated, many applications have little global client state left, and <code>useState</code> plus context covers it.\n\nWhere Redux still earns its place: large applications with many contributors, where the discipline of named actions and a single state shape genuinely helps; state with complex interdependent transitions — collaborative editing, an undo/redo stack, a rules engine; anywhere the devtools and time-travel debugging pay for themselves; and codebases that already have it, where consistency beats novelty.\n\nIf I were starting a new app today and needed a store, I would reach for Zustand first and move to RTK if the app grew into it.',
    },
    {
      q: 'What is RTK Query and how does it relate to the rest of Redux Toolkit?',
      a: 'It is a data-fetching and caching layer built into RTK, positioned as the answer to "stop hand-writing thunks for server data".\n\nYou define endpoints declaratively and it generates hooks — <code>useGetTodosQuery()</code>, <code>useAddTodoMutation()</code> — that handle deduplication, caching, loading and error states, polling, refetch on focus and reconnect, and cache invalidation through a tag system: a mutation declares which tags it invalidates, and any query providing those tags refetches.\n\nThe relationship to the rest of RTK is that the cache lives in the same Redux store, so it shows up in the devtools alongside your client state and can be inspected the same way.\n\nCompared with React Query it is a similar feature set with a Redux-shaped API; the reason to choose it is that you are already using RTK and want one store and one set of devtools.',
    },
  ],
} satisfies TopicMeta

/* ===========================================================================
   Components. Note that NOTHING here knows the store's shape — they go through
   selectors, which is what lets the shape change without touching components.
   =========================================================================== */

function AddTodo() {
  const [text, setText] = useState('')
  const dispatch = useAppDispatch()

  return (
    <form
      className="row"
      onSubmit={(e) => {
        e.preventDefault()
        if (!text.trim()) return
        // The `prepare` callback in the slice generates the id, so the call
        // site just passes the text.
        dispatch(added(text.trim()))
        setText('')
      }}
    >
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="what needs doing?"
        style={{ flex: 1, minWidth: 180 }}
      />
      <button className="primary" type="submit">
        add
      </button>
      <RenderBadge label="AddTodo" />
    </form>
  )
}

function Filters() {
  const filter = useAppSelector(selectFilter)
  const counts = useAppSelector(selectCounts)
  const dispatch = useAppDispatch()

  return (
    <div className="row">
      {(['all', 'active', 'done'] as const).map((f) => (
        <button
          key={f}
          className={filter === f ? 'primary' : ''}
          onClick={() => dispatch(filterChanged(f))}
        >
          {f} ({f === 'all' ? counts.total : f === 'active' ? counts.active : counts.done})
        </button>
      ))}
      <button onClick={() => dispatch(clearedCompleted())} disabled={counts.done === 0}>
        clear completed
      </button>
    </div>
  )
}

function TodoList() {
  // Memoised selector. Without createSelector this .filter() would produce a
  // new array reference on every dispatched action, re-rendering this list
  // even when a completely unrelated slice changed.
  const todos = useAppSelector(selectVisibleTodos)
  const loading = useAppSelector(selectLoading)
  const error = useAppSelector(selectError)
  const dispatch = useAppDispatch()

  if (loading === 'pending') return <div className="muted">Loading samples…</div>

  return (
    <div className="col">
      {error && <div className="callout trap">{error}</div>}
      {todos.length === 0 && <div className="muted">Nothing here.</div>}
      {todos.map((t) => (
        <div key={t.id} className="row">
          <input
            type="checkbox"
            checked={t.done}
            onChange={() => dispatch(toggled(t.id))}
            aria-label={`mark ${t.text} as ${t.done ? 'not done' : 'done'}`}
          />
          <span
            style={{
              flex: 1,
              fontSize: 13.5,
              textDecoration: t.done ? 'line-through' : 'none',
              color: t.done ? 'var(--text-faint)' : 'var(--text)',
            }}
          >
            {t.text}
          </span>
          <button onClick={() => dispatch(removed(t.id))}>×</button>
        </div>
      ))}
      <div className="row">
        <RenderBadge label="TodoList" />
      </div>
    </div>
  )
}

function AsyncPanel() {
  const loading = useAppSelector(selectLoading)
  const dispatch = useAppDispatch()

  return (
    <div className="row">
      <button
        onClick={() => dispatch(fetchSampleTodos())}
        disabled={loading === 'pending'}
      >
        {loading === 'pending' ? 'fetching…' : 'dispatch async thunk'}
      </button>
      <span className={`badge ${loading === 'failed' ? 'bad' : loading === 'succeeded' ? 'good' : ''}`}>
        loading: {loading}
      </span>
      <span className="muted" style={{ fontSize: 13 }}>
        (fails ~1 time in 3, on purpose)
      </span>
    </div>
  )
}

export default function Demo() {
  return (
    <div className="stack">
      <Callout>
        A real Redux store, defined in{' '}
        <code>src/topics/05-state-data/_lib/store.ts</code>. Install the Redux
        DevTools extension and you can inspect every action dispatched below.
      </Callout>

      {/* In a real app this Provider wraps the whole app in main.tsx. It is
          scoped to the demo here so the rest of the site does not depend on it. */}
      <Provider store={store}>
        <Panel title="A working slice">
          <div className="col">
            <AddTodo />
            <Filters />
            <hr style={{ border: 0, borderTop: '1px solid var(--border-soft)', margin: '4px 0' }} />
            <TodoList />
            <hr style={{ border: 0, borderTop: '1px solid var(--border-soft)', margin: '4px 0' }} />
            <AsyncPanel />
          </div>
        </Panel>
      </Provider>

      <Panel title="createSlice, in full">
        <pre>
          <code>{`const todosSlice = createSlice({
  name: 'todos',
  initialState,
  reducers: {
    // Looks mutable. Is not — this is an Immer draft.
    toggled(state, action: PayloadAction<string>) {
      const todo = state.items.find(t => t.id === action.payload)
      if (todo) todo.done = !todo.done
    },
    added: {
      reducer(state, action: PayloadAction<Todo>) { state.items.push(action.payload) },
      // prepare() keeps non-determinism (ids, timestamps) OUT of the reducer
      prepare(text: string) {
        return { payload: { id: crypto.randomUUID(), text, done: false } }
      },
    },
  },
  extraReducers(builder) {
    builder
      .addCase(fetchSampleTodos.pending,   s => { s.loading = 'pending' })
      .addCase(fetchSampleTodos.fulfilled, (s, a) => { s.loading = 'succeeded'; s.items = a.payload })
      .addCase(fetchSampleTodos.rejected,  (s, a) => { s.loading = 'failed'; s.error = a.payload })
  },
})

export const { added, toggled, removed } = todosSlice.actions
// Action type strings are generated: 'todos/added', 'todos/toggled', …`}</code>
        </pre>
      </Panel>

      <Panel title="Typed hooks — write these once, per app">
        <pre>
          <code>{`export type RootState   = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

export const useAppDispatch = useDispatch.withTypes<AppDispatch>()
export const useAppSelector = useSelector.withTypes<RootState>()

// Without them, every component needs:
//   useSelector((state: RootState) => state.todos.items)
// and dispatch(someThunk()) fails to type-check.`}</code>
        </pre>
      </Panel>

      <Panel title="The selector trap">
        <pre>
          <code>{`// ❌ New array every call → re-renders on EVERY action in the app,
//    including ones from completely unrelated slices.
const visible = useSelector(s => s.todos.items.filter(t => !t.done))

// ✅ Memoised. Recomputes only when items or filter actually change.
const selectVisible = createSelector(
  [s => s.todos.items, s => s.todos.filter],
  (items, filter) => filter === 'active' ? items.filter(t => !t.done) : items
)
const visible = useSelector(selectVisible)

// ✅ Also fine — primitives compare by value, no memo needed.
const count = useSelector(s => s.todos.items.length)`}</code>
        </pre>
      </Panel>
    </div>
  )
}
