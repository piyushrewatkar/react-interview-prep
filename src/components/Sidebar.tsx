import { useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { ALL_TOPICS, SECTIONS } from '../registry'

export default function Sidebar() {
  const [q, setQ] = useState('')

  // useMemo here is genuinely earned: filtering ~60 topics on every keystroke
  // while also re-running on every unrelated parent render would be wasteful.
  // Compare with `03-performance/usememo-and-usecallback.tsx`, which argues
  // that most useMemo calls in real code are NOT earned.
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return SECTIONS

    return SECTIONS.map((s) => ({
      ...s,
      topics: s.topics.filter(
        (t) =>
          t.title.toLowerCase().includes(needle) ||
          t.summary.toLowerCase().includes(needle) ||
          t.questions.some((x) => x.q.toLowerCase().includes(needle)),
      ),
    })).filter((s) => s.topics.length > 0)
  }, [q])

  return (
    <nav className="sidebar">
      <div className="sidebar-head">
        <h1>
          <NavLink to="/" style={{ color: 'inherit' }}>
            React Interview Prep
          </NavLink>
        </h1>
        <p>{ALL_TOPICS.length} topics &middot; 5-year level</p>
        <input
          className="search"
          type="search"
          placeholder="Filter topics and questions…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Filter topics"
        />
      </div>

      {filtered.map((section) => (
        <div key={section.id}>
          <div className="sec-title">{section.title}</div>
          {section.topics.map((t) => (
            <NavLink
              key={t.id}
              to={`/t/${t.id}`}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              {t.title}
            </NavLink>
          ))}
        </div>
      ))}

      {filtered.length === 0 && (
        <p style={{ padding: '18px', color: 'var(--text-faint)', fontSize: 13 }}>
          No topic matches “{q}”.
        </p>
      )}
    </nav>
  )
}
