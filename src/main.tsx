import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './styles.css'

/**
 * ENTRY POINT
 *
 * Two things here get asked about constantly:
 *
 * 1. `createRoot` (React 18+) vs the old `ReactDOM.render` (React 17).
 *    The new root API is what enables concurrent features — automatic
 *    batching, `useTransition`, streaming SSR. `ReactDOM.render` still worked
 *    in React 18 but ran in "legacy mode" with those features off. In React 19
 *    it was removed entirely.
 *
 * 2. `<StrictMode>`. It is a DEVELOPMENT-ONLY tool that renders components
 *    twice and mounts/unmounts/remounts effects once extra, specifically to
 *    surface impure renders and missing effect cleanups. It is deliberately
 *    left ON in this project — several topics depend on you seeing that
 *    double-invocation. It has zero effect on a production build.
 *    See: topics/01-core/strict-mode.tsx
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
