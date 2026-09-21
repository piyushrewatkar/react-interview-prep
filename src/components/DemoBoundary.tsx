import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null }

/**
 * A minimal error boundary used to isolate each topic's demo.
 *
 * WHY IS THIS A CLASS?
 * There is still no hook equivalent of `componentDidCatch` /
 * `getDerivedStateFromError`. As of React 19 an error boundary must be a class
 * component (or you use a library such as `react-error-boundary`, which is
 * itself a class under the hood). This is the single most common "when do you
 * still need a class component?" answer, and it is the right one.
 *
 * The full treatment, including what boundaries do NOT catch, is in
 * `01-core/error-boundaries.tsx`.
 */
export default class DemoBoundary extends Component<Props, State> {
  state: State = { error: null }

  // Runs during the render phase. Must be pure — its only job is to map the
  // thrown error to the next state so a fallback can render.
  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  // Runs during the commit phase. This is where side effects go: logging to
  // Sentry/Datadog, incrementing a metric.
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[DemoBoundary] a demo threw:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="callout trap">
          <b>This demo threw:</b> {this.state.error.message}
          <div style={{ marginTop: 10 }}>
            <button onClick={() => this.setState({ error: null })}>Reset demo</button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
