/**
 * A component that only exists to be code-split.
 *
 * It is imported with `React.lazy(() => import('./_lib/HeavyPanel'))`, which
 * Vite (and webpack) recognise as a code-split point: everything reachable only
 * from this file goes into its own chunk, fetched on demand.
 *
 * NOTE THE DEFAULT EXPORT. `React.lazy` expects the module's promise to resolve
 * to an object with a `default` that is a component. For a named export you
 * write:
 *     lazy(() => import('./Foo').then(m => ({ default: m.Foo })))
 */
import { useState } from 'react'

// Pretend this is a charting library, a markdown renderer, or a date picker —
// the kind of dependency that adds 150kB and is only needed on one screen.
const FAKE_DATA = Array.from({ length: 24 }, (_, i) => Math.round(40 + Math.sin(i / 3) * 35))

export default function HeavyPanel() {
  const [hovered, setHovered] = useState<number | null>(null)

  return (
    <div className="col">
      <div className="row">
        <span className="badge good">loaded from a separate chunk</span>
        {hovered !== null && <span className="badge">value: {FAKE_DATA[hovered]}</span>}
      </div>
      <div
        style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 90 }}
        onMouseLeave={() => setHovered(null)}
      >
        {FAKE_DATA.map((v, i) => (
          <div
            key={i}
            onMouseEnter={() => setHovered(i)}
            style={{
              flex: 1,
              height: `${v}%`,
              background: hovered === i ? 'var(--accent)' : 'var(--accent-dim)',
              borderRadius: '3px 3px 0 0',
              cursor: 'pointer',
              transition: 'background 100ms',
            }}
          />
        ))}
      </div>
      <div className="muted" style={{ fontSize: 13 }}>
        Check the Network tab: this arrived as its own JavaScript file, only
        once you asked for it.
      </div>
    </div>
  )
}
