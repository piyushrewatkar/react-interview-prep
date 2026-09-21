import { useState } from 'react'
import type { TopicMeta } from '../../types'
import { Callout, Panel } from '../../lib/ui'

export const meta = {
  title: 'Keys, lists & the index-as-key bug',
  summary:
    'Why keys exist, the exact circumstances under which using the array index silently corrupts your UI, and the legitimate use of a key to reset state.',
  notes: [
    '<b>A key is an identity, not a label.</b> It answers "is this the same item as the one I rendered last time?" — it is never rendered and never reaches your component as a prop.',
    '<b>Keys are scoped to their siblings.</b> They only need to be unique among the children of one parent, not globally.',
    '<b>Index-as-key is safe if and only if</b> the list is never reordered, never filtered, and items are never inserted or removed anywhere except the end — <i>and</i> the items hold no internal state or uncontrolled DOM state.',
    '<b>What goes wrong:</b> with index keys, deleting item 0 makes item 1 slide into index 0. React sees "key 0 still exists, its props changed", so it keeps the old instance and just patches the props. Component state and uncontrolled input values stay behind with the index instead of following the item.',
    '<b>Do not use <code>Math.random()</code> or <code>crypto.randomUUID()</code> in render.</b> A key that changes every render is worse than an index key — it forces a full unmount/remount of every row on every render.',
    '<b>The deliberate use:</b> changing a key on purpose is the idiomatic way to reset a component. <code>&lt;Form key={userId} /&gt;</code> gives each user a clean form instead of leaking the previous user&rsquo;s draft.',
    '<b>Keys do not make things faster by themselves.</b> They make things <i>correct</i> when the list mutates, and correctness happens to avoid unnecessary teardown.',
  ],
  questions: [
    {
      q: 'Why does React need keys?',
      a: 'When a list re-renders, React has to match each child in the new tree to a child in the old tree so it knows what to update, what to move, and what to destroy. Without a hint it can only match by position, which is wrong the moment the list changes shape.\n\nA key gives each child a stable identity that survives reordering. With keys, moving an item from index 4 to index 0 is a DOM move of an existing node, and its component state moves with it. Without keys it is "the thing at index 0 now has different props", which is a completely different — and usually wrong — operation.',
    },
    {
      q: 'What actually breaks when you use the array index as a key?',
      a: 'Nothing, until the list changes shape. The moment you insert, delete or reorder, the mapping from index to item shifts, and React\'s identity check — which is based on the key — goes stale.\n\nConcretely: you have three rows with index keys 0, 1, 2 and you delete row 0. On the next render keys 0 and 1 still exist, so React keeps those two instances and simply feeds them the props of what used to be rows 1 and 2. Any state held inside those rows — a toggled checkbox, a half-typed input, a "is expanded" flag, a CSS transition mid-flight — stays with the position instead of following the data. The classic symptom is deleting the first item in a list and watching the wrong checkbox appear ticked.\n\nUncontrolled inputs are the worst case, because their value lives in the DOM node that React just decided to reuse.',
    },
    {
      q: 'When is index-as-key actually fine?',
      a: 'When the list is static, or append-only, and the items are stateless. A hard-coded array of nav links, a set of read-only table rows that only ever grows at the end, the bullet list on this very page — all fine, and the ESLint rule is not going to complain because there is no rule.\n\nThe honest way to say it in an interview: "index keys are fine when position <i>is</i> the identity. The bug appears when position and identity can diverge, which is any list you can reorder, filter, or delete from the middle of."',
    },
    {
      q: 'Why not just use Math.random() as a key?',
      a: 'Because it produces a different key on every render, so React can never match an item to its previous self. Every render becomes a full unmount and remount of the entire list: all state destroyed, all effects re-run, all DOM nodes recreated, focus lost, scroll position lost.\n\nIt is strictly worse than an index key — at least an index key is stable when nothing changes. If your data genuinely has no id, generate one <i>once</i> when the item is created and store it alongside the item, not during render.',
    },
    {
      q: 'How do you reset a component’s state when a prop changes?',
      a: 'Change its key. <code>&lt;ProfileForm key={userId} userId={userId} /&gt;</code> — when <code>userId</code> changes, React sees a different key at that position, unmounts the old instance and mounts a fresh one with clean state. It is one line and it is the officially recommended approach.\n\nThe alternative you see in older code is a <code>useEffect</code> that watches the prop and calls a pile of setters, which is more code, runs a render late (so there is a frame showing stale data), and has to be updated every time you add a piece of state. Keys are declarative; the effect approach is a manual re-implementation of unmounting.',
    },
    {
      q: 'Do keys need to be globally unique?',
      a: 'No — only unique among siblings. Two different lists on the same page can both use keys 1, 2, 3 without any conflict, because React only ever compares a child against the previous children of the same parent.\n\nThis matters in practice when you are tempted to build compound keys like <code>{`${section}-${id}`}</code> to "be safe". That is harmless, but it is not required, and if <code>section</code> can change for an item you have accidentally made the key unstable.',
    },
  ],
} satisfies TopicMeta

type Row = { id: number; name: string }

const INITIAL: Row[] = [
  { id: 1, name: 'Ada' },
  { id: 2, name: 'Grace' },
  { id: 3, name: 'Linus' },
  { id: 4, name: 'Barbara' },
]

/**
 * The row deliberately holds UNCONTROLLED DOM state (the checkbox) and React
 * state (the note). Both are attached to the component instance, so both will
 * misbehave when React reuses the wrong instance.
 */
function PersonRow({ row }: { row: Row }) {
  const [note, setNote] = useState('')
  return (
    <div className="row" style={{ padding: '4px 0' }}>
      <input type="checkbox" aria-label={`select ${row.name}`} />
      <span className="mono" style={{ minWidth: 78 }}>
        {row.name}
      </span>
      <input
        type="text"
        placeholder="type a note…"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        style={{ width: 170 }}
      />
    </div>
  )
}

function List({ rows, mode }: { rows: Row[]; mode: 'index' | 'id' }) {
  return (
    <div>
      {rows.map((row, i) => (
        // THE ENTIRE DEMO IS THIS ONE EXPRESSION.
        // `mode === 'index' ? i : row.id` — everything else is identical.
        <PersonRow key={mode === 'index' ? i : row.id} row={row} />
      ))}
    </div>
  )
}

export default function Demo() {
  const [rows, setRows] = useState(INITIAL)

  const removeFirst = () => setRows((r) => r.slice(1))
  const shuffleUp = () => setRows((r) => (r.length ? [...r.slice(1), r[0]] : r))
  const reset = () => setRows(INITIAL)

  return (
    <div className="stack">
      <Callout>
        <b>Do this first:</b> tick a checkbox and type a note into the{' '}
        <b>Ada</b> row on <i>both</i> sides. Then press “Remove first”.
      </Callout>

      <div className="row">
        <button onClick={removeFirst} disabled={rows.length === 0}>
          Remove first
        </button>
        <button onClick={shuffleUp} disabled={rows.length < 2}>
          Rotate order
        </button>
        <button onClick={reset}>Reset</button>
      </div>

      <div className="grid2">
        <Panel title="key={index}  ❌">
          <List rows={rows} mode="index" />
          <div style={{ marginTop: 10, fontSize: 13, color: 'var(--bad)' }}>
            Your tick and your note stayed on the <i>row position</i>. They now
            belong to a different person.
          </div>
        </Panel>

        <Panel title="key={row.id}  ✅">
          <List rows={rows} mode="id" />
          <div style={{ marginTop: 10, fontSize: 13, color: 'var(--good)' }}>
            The state followed the <i>person</i>. Removing Ada removed Ada&rsquo;s
            state with her.
          </div>
        </Panel>
      </div>

      <Callout kind="tip">
        <b>The one-line version for an interview:</b> a key answers “is this the
        same item as before?”. An index answers “is this the same slot as
        before?”. They are the same answer only while the list never changes
        shape.
      </Callout>
    </div>
  )
}
