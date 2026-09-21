import { configureStore, createAsyncThunk, createSelector, createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import { useDispatch, useSelector } from 'react-redux'

/* ===========================================================================
   A complete Redux Toolkit setup, small enough to read in one sitting.

   Everything an interviewer might ask you to produce on a whiteboard is here:
   a slice with reducers, a typed store, typed hooks, an async thunk with its
   three lifecycle actions, and memoised selectors.
   =========================================================================== */

/* --- 1. A slice -----------------------------------------------------------
   `createSlice` generates the action creators AND the reducer from one object.
   No action-type string constants, no switch statement, no separate actions
   file — that boilerplate was the single biggest complaint about classic Redux.
   -------------------------------------------------------------------------- */

export type Todo = { id: string; text: string; done: boolean }

type TodosState = {
  items: Todo[]
  filter: 'all' | 'active' | 'done'
  /** Status of the async "load sample data" thunk. */
  loading: 'idle' | 'pending' | 'succeeded' | 'failed'
  error: string | null
}

const initialState: TodosState = {
  items: [],
  filter: 'all',
  loading: 'idle',
  error: null,
}

/* An async thunk. It dispatches three actions automatically:
     todos/fetchSamples/pending
     todos/fetchSamples/fulfilled
     todos/fetchSamples/rejected
   which you handle in `extraReducers` below. */
export const fetchSampleTodos = createAsyncThunk<Todo[], void, { rejectValue: string }>(
  'todos/fetchSamples',
  async (_arg, { rejectWithValue }) => {
    await new Promise((r) => setTimeout(r, 700))
    // Fail one time in three so the error path is reachable in the demo.
    if (Math.random() < 0.33) {
      // `rejectWithValue` puts a typed payload on the rejected action, which is
      // much better than relying on `action.error.message`.
      return rejectWithValue('The sample server returned 503.')
    }
    return [
      { id: 's1', text: 'Explain reconciliation', done: true },
      { id: 's2', text: 'Rehearse the useEffect race-condition answer', done: false },
      { id: 's3', text: 'Build something with useSyncExternalStore', done: false },
    ]
  },
)

const todosSlice = createSlice({
  name: 'todos',
  initialState,
  reducers: {
    /* These LOOK like mutations. They are not.
       RTK wraps every reducer in Immer, which hands you a draft proxy, records
       the mutations you perform on it, and produces a new immutable state from
       them. So `state.items.push(...)` is safe here and ONLY here. Writing the
       same line against the real store state elsewhere is still a bug. */
    added: {
      reducer(state, action: PayloadAction<Todo>) {
        state.items.push(action.payload)
      },
      // A `prepare` callback lets the action creator take friendly arguments
      // and construct the payload — the right place for id generation, so the
      // reducer itself stays pure and deterministic.
      prepare(text: string) {
        return { payload: { id: crypto.randomUUID(), text, done: false } }
      },
    },

    toggled(state, action: PayloadAction<string>) {
      const todo = state.items.find((t) => t.id === action.payload)
      if (todo) todo.done = !todo.done
    },

    removed(state, action: PayloadAction<string>) {
      state.items = state.items.filter((t) => t.id !== action.payload)
    },

    filterChanged(state, action: PayloadAction<TodosState['filter']>) {
      state.filter = action.payload
    },

    clearedCompleted(state) {
      state.items = state.items.filter((t) => !t.done)
    },
  },

  // Handles actions defined elsewhere — here, the thunk's three lifecycle
  // actions. This is also how one slice reacts to another slice's actions.
  extraReducers(builder) {
    builder
      .addCase(fetchSampleTodos.pending, (state) => {
        state.loading = 'pending'
        state.error = null
      })
      .addCase(fetchSampleTodos.fulfilled, (state, action) => {
        state.loading = 'succeeded'
        state.items = action.payload
      })
      .addCase(fetchSampleTodos.rejected, (state, action) => {
        state.loading = 'failed'
        state.error = action.payload ?? 'Unknown error'
      })
  },
})

export const { added, toggled, removed, filterChanged, clearedCompleted } = todosSlice.actions

/* --- 2. The store ---------------------------------------------------------
   `configureStore` sets up the Redux DevTools connection, adds redux-thunk,
   and installs development-only middleware that throws if you accidentally
   mutate state outside a reducer or put a non-serialisable value in the store.
   Classic `createStore` required you to wire all of that by hand.
   -------------------------------------------------------------------------- */

export const store = configureStore({
  reducer: {
    todos: todosSlice.reducer,
  },
})

/* --- 3. Types and typed hooks ---------------------------------------------
   Deriving the types from the store rather than declaring them by hand means
   they can never drift out of sync with the actual reducer shape.
   -------------------------------------------------------------------------- */

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

// Pre-typed hooks. Export these and never import the raw ones in components —
// otherwise every `useSelector` needs an explicit `(state: RootState)` and
// `dispatch(someThunk())` fails to type-check.
export const useAppDispatch = useDispatch.withTypes<AppDispatch>()
export const useAppSelector = useSelector.withTypes<RootState>()

/* --- 4. Selectors ---------------------------------------------------------
   Selectors keep the store's shape out of your components: if `items` moves,
   you change one line here rather than twenty call sites.
   -------------------------------------------------------------------------- */

export const selectAllTodos = (s: RootState) => s.todos.items
export const selectFilter = (s: RootState) => s.todos.filter
export const selectLoading = (s: RootState) => s.todos.loading
export const selectError = (s: RootState) => s.todos.error

/* `createSelector` memoises. This matters because `useSelector` re-runs the
   selector on every dispatched action and compares the result by reference —
   so a selector that returns a NEW ARRAY every call causes a re-render on
   every action, even unrelated ones. Memoising fixes it. */
export const selectVisibleTodos = createSelector(
  [selectAllTodos, selectFilter],
  (items, filter) => {
    switch (filter) {
      case 'active':
        return items.filter((t) => !t.done)
      case 'done':
        return items.filter((t) => t.done)
      default:
        return items
    }
  },
)

export const selectCounts = createSelector([selectAllTodos], (items) => ({
  total: items.length,
  done: items.filter((t) => t.done).length,
  active: items.filter((t) => !t.done).length,
}))
