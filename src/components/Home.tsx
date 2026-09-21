import { Link } from 'react-router-dom'
import { ALL_TOPICS, SECTIONS } from '../registry'

export default function Home() {
  return (
    <div className="page">
      <span className="crumb">Start here</span>
      <h1>React Interview Prep</h1>
      <p className="lede">
        {ALL_TOPICS.length} topics across {SECTIONS.length} sections, pitched at a
        developer with around five years of React experience. Every topic has a
        live demo you can poke at, a heavily commented source file, and the
        questions an interviewer actually asks.
      </p>

      <div className="callout tip">
        <b>How to use this.</b> Read the page, play with the demo, then open the
        source file listed at the top of the page — the comments in the source are
        the real material. The page is the summary; the file is the lesson.
      </div>

      <div className="block">
        <h2>Suggested order</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          If you have a week: sections 1–2 on days one and two, 3–5 on days three
          and four, 6–7 on day five, 8 on day six, 9 plus a re-read of your weak
          spots on day seven. If you have an evening, do section 1, then the
          “Performance” and “JavaScript Fundamentals” sections — that is where
          most candidates get caught.
        </p>
      </div>

      {SECTIONS.map((s) => (
        <div className="home-sec" key={s.id}>
          <h2>{s.title}</h2>
          <p className="blurb">{s.blurb}</p>
          <div className="card-grid">
            {s.topics.map((t) => (
              <Link className="card" key={t.id} to={`/t/${t.id}`}>
                <div className="t">{t.title}</div>
                <div className="s">{t.summary}</div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
