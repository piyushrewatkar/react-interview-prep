import { useMemo, useRef, useState } from 'react'
import type { TopicMeta } from '../../types'
import { Callout, Panel } from '../../lib/ui'

export const meta = {
  title: 'Virtualisation (windowing)',
  summary:
    'Rendering only the rows the user can see. The one optimisation that changes a list from unusable to instant, built from scratch in about thirty lines.',
  notes: [
    '<b>The problem:</b> 50,000 rows is 50,000+ DOM nodes. The browser spends seconds on layout, style recalculation and memory, and scrolling drops to single-digit frames per second.',
    '<b>The idea:</b> render only the ~20 rows in the viewport. Fake the scrollbar with a single spacer element of the full height, and translate the visible window into position.',
    '<b>The maths:</b> <code>startIndex = floor(scrollTop / rowHeight)</code>, <code>visibleCount = ceil(viewportHeight / rowHeight)</code>, then render <code>[start - overscan, start + visibleCount + overscan]</code>.',
    '<b>Overscan</b> is a few extra rows rendered above and below the viewport, so fast scrolling does not show blank gaps before React catches up.',
    '<b>Fixed row height is the easy case.</b> Variable heights need measurement and a cumulative-offset cache — which is why you use a library.',
    '<b>Use <code>@tanstack/react-virtual</code> or <code>react-window</code> in production.</b> They handle variable heights, horizontal lists, grids, sticky rows, scroll restoration and accessibility.',
    '<b>Accessibility is the hidden cost.</b> Screen readers and Ctrl+F only see rendered DOM, so a virtualised list needs <code>role="grid"</code> with <code>aria-rowcount</code>/<code>aria-rowindex</code>, and in-page search stops working.',
    '<b>Alternatives worth naming:</b> pagination, infinite scroll with a cap, and <code>content-visibility: auto</code>, which gets you some of the benefit in pure CSS.',
  ],
  questions: [
    {
      q: 'How would you render a list of 50,000 items?',
      a: 'Virtualise it — render only the rows inside the viewport plus a small overscan buffer, which is typically twenty or thirty nodes regardless of list length.\n\nMechanically: put a scrollable container around an inner spacer whose height is <code>itemCount × rowHeight</code>, so the scrollbar behaves as if everything were there. On scroll, read <code>scrollTop</code>, compute the first visible index, slice that window out of your data, and position it with a <code>transform: translateY(startIndex × rowHeight)</code> or an absolute <code>top</code>.\n\nThe result is constant DOM size and constant render cost no matter how long the list is. In production I would reach for <code>@tanstack/react-virtual</code> rather than hand-rolling, because variable row heights, grids and scroll restoration get complicated fast.\n\nAnd I would ask first whether the user actually needs 50,000 rows, or whether pagination or better filtering is the real answer.',
    },
    {
      q: 'What is overscan and why does it matter?',
      a: 'Rendering a few extra rows above and below the visible window — usually three to five.\n\nWithout it, fast scrolling shows blank space: the browser scrolls and paints before React has processed the scroll event and rendered the new rows. With a buffer, the next rows are already in the DOM by the time they scroll into view.\n\nIt is a straight trade: more overscan means smoother fast scrolling but more nodes and more render work per scroll event. The default in most libraries is small deliberately, and you raise it if you see flashing on a slow device.',
    },
    {
      q: 'What breaks when you virtualise a list?',
      a: 'Several things, and being able to list them is what separates "I used react-window once" from understanding it.\n\n<b>Ctrl+F stops working.</b> The browser can only find text in the DOM, and 99% of the rows are not there.\n\n<b>Accessibility needs explicit work.</b> A screen reader reads the DOM, so it sees twenty rows. You have to declare the real structure with <code>role="grid"</code>, <code>aria-rowcount</code> on the container and <code>aria-rowindex</code> on each row.\n\n<b>Variable heights are hard.</b> You cannot compute offsets without knowing heights, and you cannot know heights without rendering. Libraries solve it by measuring on render and caching cumulative offsets, which means the scrollbar size changes as you scroll.\n\n<b>Nested scrolling, sticky headers, anchor links and scroll restoration</b> all need specific handling.\n\n<b>CSS that depends on siblings</b> — <code>:nth-child</code> striping, <code>position: sticky</code> within the list — behaves unexpectedly, because the DOM children are not the logical children.',
    },
    {
      q: 'Is there a simpler alternative to virtualisation?',
      a: 'Often, yes, and it is worth suggesting before jumping to a library.\n\n<b>Pagination.</b> If the user cannot meaningfully consume 50,000 rows, do not give them 50,000 rows. It is less code, it is accessible by default, and it usually means a smaller API response too.\n\n<b><code>content-visibility: auto</code></b> with <code>contain-intrinsic-size</code> tells the browser to skip rendering off-screen elements. It is one CSS declaration, keeps the DOM intact so Ctrl+F and screen readers still work, and gets you a large share of the benefit. The nodes still exist, so memory is unchanged, but layout and paint cost drop sharply.\n\n<b>Better filtering or search</b>, so that the visible result set is small in the first place.\n\nVirtualisation is the right answer when the user genuinely needs to scroll a long list — a log viewer, a chat history, a spreadsheet.',
    },
  ],
} satisfies TopicMeta

const ROW_HEIGHT = 32
const TOTAL = 50_000

type Row = { id: number; name: string; value: number }

// Built once. Creating 50k objects is itself noticeable — which is a decent
// reminder that virtualisation only fixes RENDERING, not data size.
const DATA: Row[] = Array.from({ length: TOTAL }, (_, i) => ({
  id: i,
  name: `Record ${i.toString().padStart(5, '0')}`,
  value: Math.round(Math.sin(i / 50) * 1000) / 10,
}))

function VirtualList({ overscan }: { overscan: number }) {
  const [scrollTop, setScrollTop] = useState(0)
  const viewportHeight = 260
  const containerRef = useRef<HTMLDivElement>(null)

  // --- The entire algorithm -------------------------------------------------
  const { items, offsetY, startIndex, endIndex } = useMemo(() => {
    // Which row is at the top edge of the viewport?
    const first = Math.floor(scrollTop / ROW_HEIGHT)
    // How many fit in the viewport?
    const count = Math.ceil(viewportHeight / ROW_HEIGHT)

    // Extend by the overscan buffer, clamped to the bounds of the data.
    const start = Math.max(0, first - overscan)
    const end = Math.min(TOTAL, first + count + overscan)

    return {
      items: DATA.slice(start, end),
      // Push the rendered window down so it appears at the right scroll offset.
      offsetY: start * ROW_HEIGHT,
      startIndex: start,
      endIndex: end,
    }
  }, [scrollTop, overscan])

  return (
    <div className="col">
      <div className="row">
        <span className="badge good">{items.length} DOM rows</span>
        <span className="badge">of {TOTAL.toLocaleString()} records</span>
        <span className="badge">
          showing {startIndex}–{endIndex}
        </span>
      </div>

      {/* The VIEWPORT: fixed height, scrollable. */}
      <div
        ref={containerRef}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        style={{
          height: viewportHeight,
          overflowY: 'auto',
          border: '1px solid var(--border)',
          borderRadius: 8,
          background: 'var(--bg-sunken)',
          position: 'relative',
        }}
        role="grid"
        aria-rowcount={TOTAL}
        aria-label="Virtualised record list"
      >
        {/* The SPACER: one empty element as tall as the whole list would be.
            This is what gives the scrollbar its correct size and range. */}
        <div style={{ height: TOTAL * ROW_HEIGHT, position: 'relative' }}>
          {/* The WINDOW: only the visible rows, translated into place. */}
          <div style={{ transform: `translateY(${offsetY}px)` }}>
            {items.map((row) => (
              <div
                key={row.id}
                role="row"
                // The real index, so assistive tech knows where it is in the
                // full list rather than in the twenty nodes that exist.
                aria-rowindex={row.id + 1}
                style={{
                  height: ROW_HEIGHT,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '0 12px',
                  fontSize: 13,
                  fontFamily: 'var(--mono)',
                  borderBottom: '1px solid var(--border-soft)',
                  color: 'var(--text-dim)',
                }}
              >
                <span style={{ color: 'var(--text-faint)', width: 58 }}>#{row.id}</span>
                <span style={{ flex: 1 }}>{row.name}</span>
                <span style={{ color: row.value >= 0 ? 'var(--good)' : 'var(--bad)' }}>
                  {row.value > 0 ? '+' : ''}
                  {row.value.toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Demo() {
  const [overscan, setOverscan] = useState(4)

  return (
    <div className="stack">
      <Callout>
        Scroll the list below. It holds 50,000 records and never has more than
        ~20 DOM nodes. Open DevTools &rarr; Elements and watch the rows being
        recycled.
      </Callout>

      <Panel title="A virtualised list, hand-rolled">
        <div className="row" style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 13 }} htmlFor="overscan">
            overscan:
          </label>
          <input
            id="overscan"
            type="number"
            min={0}
            max={30}
            value={overscan}
            onChange={(e) => setOverscan(Math.max(0, Number(e.target.value)))}
            style={{ width: 70 }}
          />
          <span className="muted" style={{ fontSize: 13 }}>
            Set it to 0 and scroll fast — you will see the blank flashes it exists
            to prevent.
          </span>
        </div>
        <VirtualList overscan={overscan} />
      </Panel>

      <Panel title="The whole algorithm">
        <pre>
          <code>{`const first  = Math.floor(scrollTop / ROW_HEIGHT)       // top visible row
const count  = Math.ceil(viewportHeight / ROW_HEIGHT)   // how many fit
const start  = Math.max(0, first - overscan)
const end    = Math.min(total, first + count + overscan)

const items   = data.slice(start, end)
const offsetY = start * ROW_HEIGHT

// <viewport height=260 overflow=auto onScroll={setScrollTop}>
//   <spacer height={total * ROW_HEIGHT}>        ← gives the scrollbar its range
//     <window style={{ transform: translateY(offsetY) }}>
//       {items.map(...)}                        ← ~20 nodes, always
//     </window>
//   </spacer>
// </viewport>`}</code>
        </pre>
      </Panel>

      <Panel title="What you give up">
        <table className="data">
          <thead>
            <tr>
              <th>Breaks</th>
              <th>Mitigation</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Browser Ctrl+F</td>
              <td>Provide your own search over the data, not the DOM.</td>
            </tr>
            <tr>
              <td>Screen reader row context</td>
              <td>
                <code>role="grid"</code> + <code>aria-rowcount</code> +{' '}
                <code>aria-rowindex</code>, as in the demo above.
              </td>
            </tr>
            <tr>
              <td>Variable row heights</td>
              <td>Measure on render and cache cumulative offsets — use a library.</td>
            </tr>
            <tr>
              <td>
                <code>:nth-child</code> striping, sticky rows
              </td>
              <td>Compute stripe colour from the real index, not the DOM position.</td>
            </tr>
            <tr>
              <td>Anchor links, scroll restoration</td>
              <td>Scroll to <code>index × rowHeight</code> manually.</td>
            </tr>
          </tbody>
        </table>
      </Panel>

      <Callout kind="tip">
        <b>The cheap alternative worth mentioning.</b>{' '}
        <code>content-visibility: auto</code> with{' '}
        <code>contain-intrinsic-size: 32px</code> lets the browser skip layout
        and paint for off-screen rows while keeping the DOM intact — so Ctrl+F
        and screen readers still work. One CSS line, a large share of the
        benefit.
      </Callout>
    </div>
  )
}
