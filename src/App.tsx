import { Route, Routes } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Home from './components/Home'
import TopicPage from './components/TopicPage'
import NotFound from './components/NotFound'

export default function App() {
  return (
    <div className="shell">
      <Sidebar />
      <main className="main">
        <Routes>
          <Route path="/" element={<Home />} />
          {/*
            Note the trailing `/*` (a "splat"). It tells React Router that this
            route does not consume the whole URL, which is what lets a topic
            render its OWN nested <Routes> underneath. The routing topic in
            section 09 relies on this.
          */}
          <Route path="/t/:id/*" element={<TopicPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  )
}
