import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ALL_TOPICS, SECTIONS } from '../registry'
import TopicPage from '../components/TopicPage'
import Home from '../components/Home'

/* ===========================================================================
   SMOKE TESTS

   Every topic in this project is a real, interactive component. This file
   mounts all of them and asserts that none throws, which is the one thing
   that would make a study page useless: you open it and see the error
   boundary instead of the lesson.

   It also checks the TopicMeta contract, so a topic added later that forgets
   its questions or its summary fails here rather than rendering an empty page.
   =========================================================================== */

function renderTopic(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/t/${id}`]}>
      <Routes>
        <Route path="/t/:id/*" element={<TopicPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('registry', () => {
  it('discovers every section', () => {
    expect(SECTIONS).toHaveLength(9)
    expect(SECTIONS.map((s) => s.id)).toEqual([
      '01-core',
      '02-hooks',
      '03-performance',
      '04-patterns',
      '05-state-data',
      '06-testing',
      '07-typescript',
      '08-js-fundamentals',
      '09-ecosystem',
    ])
  })

  it('gives every topic a unique slug with the numeric prefix stripped', () => {
    const ids = ALL_TOPICS.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    // A leftover "01-" prefix would mean the registry regex broke.
    expect(ids.every((id) => !/^\d+-/.test(id))).toBe(true)
  })

  it('renders the home page with every topic linked', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: /react interview prep/i })).toBeInTheDocument()
    // One card per topic, each linking to its route.
    expect(screen.getAllByRole('link')).toHaveLength(ALL_TOPICS.length)

    // And each title is rendered. We match the text node rather than the
    // link's accessible name, because a card's name is title + summary —
    // and titles contain regex metacharacters, so building a RegExp from
    // them would be wrong too.
    for (const topic of ALL_TOPICS) {
      expect(screen.getByText(topic.title)).toBeInTheDocument()
    }
  })
})

describe('every topic', () => {
  // it.each gives one named test per topic, so a failure names the file.
  it.each(ALL_TOPICS.map((t) => [t.path, t] as const))(
    'renders %s without throwing',
    (_path, topic) => {
      renderTopic(topic.id)

      // The title renders…
      expect(screen.getByRole('heading', { level: 1, name: topic.title })).toBeInTheDocument()

      // …and the demo did NOT hit the error boundary. If a demo throws,
      // DemoBoundary renders this text instead of the lesson.
      expect(screen.queryByText(/this demo threw/i)).not.toBeInTheDocument()
    },
  )

  it.each(ALL_TOPICS.map((t) => [t.path, t] as const))(
    'satisfies the TopicMeta contract: %s',
    (_path, topic) => {
      expect(topic.title.length).toBeGreaterThan(3)
      expect(topic.summary.length).toBeGreaterThan(20)
      expect(topic.notes.length).toBeGreaterThanOrEqual(3)
      expect(topic.questions.length).toBeGreaterThanOrEqual(3)
      for (const qa of topic.questions) {
        // A question should be a question, and an answer should be substantial
        // enough to be worth reading.
        expect(qa.q).toMatch(/[?.]$/)
        expect(qa.a.length).toBeGreaterThan(120)
      }
    },
  )
})
