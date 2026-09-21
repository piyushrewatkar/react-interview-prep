import { Link, useParams } from 'react-router-dom'
import { getNeighbours, TOPICS_BY_ID } from '../registry'
import { SECTION_TITLES } from '../sections'
import NotFound from './NotFound'
import DemoBoundary from './DemoBoundary'

/**
 * The frame every topic renders inside: concept notes, the live demo, then the
 * interview questions. Kept deliberately dumb — it reads a `Topic` out of the
 * registry and lays it out. All the teaching content lives in the topic module.
 */
/*
 * A NOTE ON `dangerouslySetInnerHTML` BELOW
 * -----------------------------------------
 * This file renders note bullets and answer paragraphs as raw HTML so that the
 * content can contain <code> and <b> tags. That is safe HERE and only here:
 * every string comes from a `.tsx` file in this repository that you wrote and
 * that the bundler compiled — it is code, not data, and there is no path for a
 * user, a URL, or a server response to reach it.
 *
 * The moment any of that stops being true, this becomes a stored-XSS hole.
 * `09-ecosystem/security-xss.tsx` covers the rule properly: never pass a value
 * to `dangerouslySetInnerHTML` unless you can trace it to a literal in your own
 * source, or it has been through a sanitiser such as DOMPurify.
 */
export default function TopicPage() {
  const { id } = useParams<{ id: string }>()
  const topic = id ? TOPICS_BY_ID.get(id) : undefined

  if (!topic) return <NotFound />

  const { prev, next } = getNeighbours(topic.id)
  const { Demo } = topic

  return (
    // `key` forces a full remount when you navigate between topics. Without it
    // React would reuse the previous topic's component instances where the tree
    // shape happens to match, and demos would open with stale state. This is the
    // legitimate "reset state with a key" pattern — see
    // topics/01-core/keys-and-lists.tsx.
    <div className="page" key={topic.id}>
      <span className="crumb">
        {SECTION_TITLES[topic.sectionId]?.title ?? topic.sectionId}
      </span>
      <h1>{topic.title}</h1>
      <p className="lede">{topic.summary}</p>

      <div className="srcline">
        Source: <b>{topic.path}</b> — open it, the comments are the lesson.
      </div>

      <section className="block">
        <h2>Key points</h2>
        <ul className="notes">
          {topic.notes.map((n, i) => (
            // Index as key is FINE here: this list is static, never reordered,
            // never filtered, and the items have no state. See the keys topic
            // for exactly when it stops being fine.
            <li key={i} dangerouslySetInnerHTML={{ __html: n }} />
          ))}
        </ul>
      </section>

      <section className="block">
        <h2>Live demo</h2>
        <div className="demo">
          {/* One misbehaving demo should not white-screen the whole study app. */}
          <DemoBoundary>
            <Demo />
          </DemoBoundary>
        </div>
      </section>

      <section className="block">
        <h2>Interview questions ({topic.questions.length})</h2>
        <div className="qa">
          {topic.questions.map((qa, i) => (
            <details key={i}>
              <summary>{qa.q}</summary>
              <div className="answer">
                {qa.a.split('\n\n').map((para, j) => (
                  <p key={j} dangerouslySetInnerHTML={{ __html: para }} />
                ))}
              </div>
            </details>
          ))}
        </div>
      </section>

      <nav className="pager">
        {prev ? (
          <Link to={`/t/${prev.id}`}>
            <span className="dir">← Previous</span>
            {prev.title}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link to={`/t/${next.id}`} style={{ textAlign: 'right' }}>
            <span className="dir">Next →</span>
            {next.title}
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </div>
  )
}
