/**
 * Human-readable names for the folders under `src/topics/`.
 *
 * The folder names are number-prefixed (`01-core`, `02-hooks`, ...) purely so
 * that a plain lexicographic sort of the file paths produces the curriculum
 * order. The registry relies on that; do not rename a folder without keeping
 * the prefix.
 */
export const SECTION_TITLES: Record<string, { title: string; blurb: string }> = {
  '01-core': {
    title: 'Core React',
    blurb:
      'The mental model. Rendering, reconciliation, state, refs, context, errors. Most senior interviews open here and a shaky answer colours the rest of the hour.',
  },
  '02-hooks': {
    title: 'Hooks',
    blurb:
      'Every built-in hook, what it is actually for, and the failure mode each one has. Plus the rules of hooks and how to build your own.',
  },
  '03-performance': {
    title: 'Performance',
    blurb:
      'Why components re-render, why memoisation so often does nothing, and the techniques that genuinely move the needle.',
  },
  '04-patterns': {
    title: 'Component Patterns',
    blurb:
      'HOCs, render props, compound components, prop getters. Know the history: interviewers ask about the old patterns to see whether you understand why hooks replaced them.',
  },
  '05-state-data': {
    title: 'State & Data',
    blurb:
      'Choosing where state lives, Redux Toolkit, external stores, data fetching with caching and deduping, forms, optimistic updates.',
  },
  '06-testing': {
    title: 'Testing',
    blurb:
      'React Testing Library the way it is meant to be used. Every example here is a real test that runs under `npm test`.',
  },
  '07-typescript': {
    title: 'TypeScript + React',
    blurb:
      'Typing props, events, refs, context and generic components. At five years of experience this is assumed knowledge, not a bonus.',
  },
  '08-js-fundamentals': {
    title: 'JavaScript Fundamentals',
    blurb:
      'Closures, `this`, prototypes, the event loop, promises, and the classic "implement it yourself" questions. Half of a React interview is a JavaScript interview.',
  },
  '09-ecosystem': {
    title: 'Ecosystem & System Design',
    blurb:
      'Routing, rendering strategies, bundling, accessibility, security, and the version-history questions.',
  },
}
