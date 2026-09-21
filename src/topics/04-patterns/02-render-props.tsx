import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { TopicMeta } from '../../types'
import { Callout, Panel } from '../../lib/ui'

export const meta = {
  title: 'Render props',
  summary:
    'Passing a function that returns JSX, so one component owns the logic and the caller owns the markup. Superseded by hooks — except where it is not.',
  notes: [
    '<b>A render prop is a prop whose value is a function returning JSX.</b> The component calls it with its internal state instead of rendering fixed markup.',
    '<b><code>children</code> as a function</b> is the same pattern with nicer syntax: <code>&lt;Mouse&gt;{(pos) =&gt; …}&lt;/Mouse&gt;</code>.',
    '<b>It solves the same problem as an HOC</b> — sharing stateful logic — but the data flow is visible at the call site rather than injected invisibly.',
    '<b>Its weakness is nesting.</b> Three render props means three levels of callback pyramid, and you cannot use the values from one inside another&rsquo;s dependency array cleanly.',
    '<b>Hooks replaced it for pure logic sharing.</b> <code>const pos = useMouse()</code> is flat, composable and renameable.',
    '<b>It survives where the component must own both state <i>and</i> rendering structure</b> — virtualised lists, drag handles, autocomplete, chart primitives. The component decides <i>where</i> your markup goes; you decide <i>what</i> it is.',
    '<b>Inline arrow functions defeat <code>React.memo</code></b> on the render-prop component, because the prop is a new function every render.',
    '<b>Real examples:</b> Downshift, react-virtualized, Formik&rsquo;s <code>&lt;Field&gt;</code>, Recharts&rsquo; <code>&lt;ResponsiveContainer&gt;</code>, React Router v5&rsquo;s <code>&lt;Route render={} /&gt;</code>.',
  ],
  questions: [
    {
      q: 'What is a render prop?',
      a: 'A prop whose value is a function that returns JSX. The component holding the logic calls that function with its internal state, rather than rendering markup itself:\n\n<code>&lt;MousePosition render={({ x, y }) =&gt; &lt;p&gt;{x}, {y}&lt;/p&gt;} /&gt;</code>\n\nThe component owns the behaviour — the event listener, the state — and the caller owns the appearance. It was the main alternative to HOCs for logic reuse before hooks, and it has one clear advantage over them: you can see exactly where the values come from, right at the call site, instead of them appearing as mystery props.\n\nUsing <code>children</code> as the function is the same pattern with better ergonomics, and is what most libraries settled on.',
    },
    {
      q: 'Why did hooks replace render props?',
      a: 'Composition. Two render props means nesting one inside the other; three means a pyramid. The values from the outer one are available to the inner, but only by indentation, and you cannot destructure and rename cleanly, or use them in a dependency array without threading them through.\n\n<code>const pos = useMouse(); const size = useWindowSize(); const online = useOnline()</code> is three flat lines with no nesting at all, and each value is a normal variable.\n\nRender props also create a real component boundary, so you get extra nodes in the tree, and every inline arrow is a new function identity that breaks memoisation on the provider component.\n\nFor sharing <i>logic</i>, hooks win outright. That is why almost every library that used render props in 2018 has a hooks API now.',
    },
    {
      q: 'Is the pattern dead, then?',
      a: 'No — it is alive wherever the component needs to control <i>where</i> your markup goes, not just supply data to it.\n\nA virtualised list has to decide which items exist and position them absolutely; it calls your render function once per visible row. A hook cannot do that, because a hook returns to its caller and has no say in the caller\'s output.\n\nSame for a drag-and-drop primitive that needs to give you props to spread on the handle and decide the wrapper, a chart container that measures itself before rendering children, or an autocomplete that owns the list structure and highlight logic.\n\nThe modern phrasing is "headless components": the library owns behaviour and structure, you own presentation. TanStack Table, Downshift and React Aria all work this way, usually offering both a hook and a render-prop entry point.',
    },
    {
      q: 'What is the performance concern with render props?',
      a: 'The function is a new identity on every render of the parent, so if the render-prop component is wrapped in <code>React.memo</code>, the memo never hits — the prop always differs.\n\nSo <code>memo</code> on a render-prop component is essentially decorative unless the caller wraps the function in <code>useCallback</code>, which is easy to forget and awkward to enforce.\n\nThere is also a subtler cost: everything the render function returns is re-created inside the provider\'s render, so an expensive subtree passed through a render prop cannot benefit from the "children as a stable element" bail-out that ordinary <code>children</code> gets. With plain children the element object comes from the grandparent and stays stable; with a render prop it is constructed fresh each time by definition.',
    },
  ],
} satisfies TopicMeta

/* ===========================================================================
   The classic: one component owns the logic, the caller owns the markup.
   =========================================================================== */

type MouseState = { x: number; y: number }

function MouseTracker({ children }: { children: (state: MouseState) => ReactNode }) {
  const [pos, setPos] = useState<MouseState>({ x: 0, y: 0 })

  useEffect(() => {
    const onMove = (e: MouseEvent) => setPos({ x: e.clientX, y: e.clientY })
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  // The component renders NOTHING of its own. It hands its state to the
  // caller's function and returns whatever comes back.
  return <>{children(pos)}</>
}

/* ===========================================================================
   Where render props genuinely still win: the component controls STRUCTURE.
   A simple headless list — it owns the container, the keys, the empty state
   and the "show more" logic; you own what a row looks like.
   =========================================================================== */

type ListProps<T> = {
  items: T[]
  pageSize?: number
  /** Called once per visible item. The list decides where this output goes. */
  renderItem: (item: T, index: number) => ReactNode
  /** Called when there is nothing to show. */
  renderEmpty?: () => ReactNode
}

function HeadlessList<T>({ items, pageSize = 3, renderItem, renderEmpty }: ListProps<T>) {
  const [shown, setShown] = useState(pageSize)

  if (items.length === 0) {
    return <>{renderEmpty?.() ?? <div className="muted">Nothing here.</div>}</>
  }

  const visible = items.slice(0, shown)

  return (
    <div className="col">
      {/* The library owns the container, the keys, and the pagination state.
          A hook could not do this — it cannot place the caller's markup. */}
      <div className="col" style={{ gap: 6 }}>
        {visible.map((item, i) => (
          <div key={i}>{renderItem(item, i)}</div>
        ))}
      </div>
      {shown < items.length && (
        <button onClick={() => setShown((s) => s + pageSize)}>
          Show {Math.min(pageSize, items.length - shown)} more ({items.length - shown} left)
        </button>
      )}
    </div>
  )
}

type Person = { name: string; role: string }
const PEOPLE: Person[] = [
  { name: 'Ada Lovelace', role: 'Mathematician' },
  { name: 'Grace Hopper', role: 'Rear Admiral' },
  { name: 'Alan Turing', role: 'Cryptanalyst' },
  { name: 'Barbara Liskov', role: 'Computer Scientist' },
  { name: 'Katherine Johnson', role: 'Mathematician' },
  { name: 'Margaret Hamilton', role: 'Software Engineer' },
]

export default function Demo() {
  return (
    <div className="stack">
      <Panel title="1. The classic render prop — logic here, markup there">
        <MouseTracker>
          {({ x, y }) => (
            // THIS function is the render prop. MouseTracker calls it with its
            // state and renders whatever we return.
            <div className="row">
              <span className="badge">
                x: {x} · y: {y}
              </span>
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: 'var(--accent)',
                  transform: `translate(${Math.min(x / 12, 200)}px, 0)`,
                  transition: 'transform 40ms linear',
                }}
              />
            </div>
          )}
        </MouseTracker>

        <div className="grid2" style={{ marginTop: 14 }}>
          <div>
            <div className="panel-title">Render prop</div>
            <pre>
              <code>{`<MouseTracker>
  {({ x, y }) => <p>{x}, {y}</p>}
</MouseTracker>

// Nesting three of them:
<A>{a => (
  <B>{b => (
    <C>{c => <Thing a={a} b={b} c={c} />}
  </B>
)}</A>`}</code>
            </pre>
          </div>
          <div>
            <div className="panel-title">The hook equivalent</div>
            <pre>
              <code>{`const { x, y } = useMouse()
return <p>{x}, {y}</p>

// Composing three of them:
const a = useA()
const b = useB()
const c = useC()
return <Thing a={a} b={b} c={c} />`}</code>
            </pre>
          </div>
        </div>
        <Callout kind="trap">
          That pyramid on the left is the whole reason hooks exist. For pure
          logic sharing, render props lost.
        </Callout>
      </Panel>

      <Panel title="2. Where it still wins: the component owns the structure">
        <div className="grid2">
          <div>
            <div className="panel-title">renderItem → a compact row</div>
            <HeadlessList
              items={PEOPLE}
              renderItem={(p) => (
                <span className="mono" style={{ fontSize: 13 }}>
                  {p.name}
                </span>
              )}
            />
          </div>
          <div>
            <div className="panel-title">renderItem → a card, same component</div>
            <HeadlessList
              items={PEOPLE}
              pageSize={2}
              renderItem={(p, i) => (
                <div className="panel" style={{ padding: '8px 12px' }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>
                    {i + 1}. {p.name}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>{p.role}</div>
                </div>
              )}
            />
          </div>
        </div>
        <Callout kind="tip">
          One <code>HeadlessList</code>, two completely different appearances.
          The component keeps the pagination state, the keys and the empty
          state; the caller supplies only the row. This is what &ldquo;headless
          component&rdquo; means, and it is why TanStack Table and Downshift are
          built this way.
        </Callout>
      </Panel>
    </div>
  )
}
