import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="page">
      <h1>Not found</h1>
      <p className="lede">That topic does not exist.</p>
      <Link to="/">Back to the index</Link>
    </div>
  )
}
