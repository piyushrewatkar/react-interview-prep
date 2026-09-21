# React Interview Prep

An interactive study project for a **React interview at around five years of experience**.
60 topics, ~300 interview questions with model answers, and a live demo for every one — all
in heavily commented TypeScript you can read as the actual lesson.

```bash
npm install     # already done if you are reading this in the folder that was built for you
npm run dev     # open the URL it prints
npm test        # 145 tests, all passing (22 hand-written + a 60-topic smoke suite)
```

---

## How to use this

The site is a summary. **The source files are the material.**

Each topic page shows you:

1. **Key points** — the things you want to be able to recite.
2. **A live demo** — click it, break it, watch the render counters.
3. **The interview questions** — the real ones, with an answer you could actually say out loud
   in 30–60 seconds. Try answering before you expand them.
4. **The path to the source file** — open it. Every non-obvious line has a comment explaining
   *why*, not *what*.

Work a topic like this: read the page, play with the demo until the behaviour surprises you,
then open the file and read the comments around the part that surprised you.

---

## What is covered

| # | Section | Topics | Covers |
|---|---------|--------|--------|
| 1 | **Core React** | 12 | JSX → `createElement`, the render pipeline, reconciliation & the diffing heuristics, keys and the index-key bug, state snapshots & batching, `flushSync`, props & composition, controlled vs uncontrolled, refs / `forwardRef` / `useImperativeHandle`, Context and its re-render trap, error boundaries, portals, StrictMode, the class lifecycle → hooks map |
| 2 | **Hooks** | 9 | The rules of hooks and *why* they exist, `useState` in depth (lazy init, updater form, bail-out), `useEffect` (dependencies, cleanup, race conditions, `AbortController`), `useLayoutEffect` vs `useEffect`, `useReducer` + state machines, `useTransition` / `useDeferredValue`, `useId` / `useSyncExternalStore`, writing custom hooks, and "you might not need an effect" |
| 3 | **Performance** | 7 | The four reasons a component re-renders, `React.memo` and why it silently fails, `useMemo` / `useCallback` and when they are a net loss, structural fixes (state colocation, children-as-prop), a hand-rolled virtualised list over 50,000 rows, `lazy` + `Suspense`, and profiling with DevTools and the `<Profiler>` API |
| 4 | **Component Patterns** | 5 | Higher-order components (and why hooks replaced them), render props and headless components, compound components with Context, control props / prop getters / the state reducer, container-presentational and what replaced it |
| 5 | **State & Data** | 6 | Where state should live (the four kinds), a store built from `useReducer` + split contexts, Redux Toolkit with slices/thunks/typed hooks/memoised selectors, a ~100-line React Query clone with cache + dedupe + revalidate + invalidation, forms & validation, optimistic updates including `useOptimistic` |
| 6 | **Testing** | 4 | RTL query priority and `userEvent`, async testing and mocking at the right layer, `renderHook` + `act` + fake timers, testing strategy and the custom `render`. **Backed by tests that actually run.** |
| 7 | **TypeScript + React** | 4 | Typing props / children / events / native element props, generic and polymorphic components, discriminated unions and impossible states, typing hooks / refs / context, `satisfies` and the utility types |
| 8 | **JavaScript Fundamentals** | 7 | Closures and the React stale-closure bug, `this` / `call` / `apply` / `bind`, prototypes and what `class` really is, the event loop with an interactive micro/macrotask logger, promises and the four combinators, debounce & throttle written from scratch, and the "implement it yourself" exercises |
| 9 | **Ecosystem & System Design** | 6 | React Router (nested routes, params vs search params, guards, loaders), CSR/SSR/SSG/ISR/RSC and hydration, bundling & tree shaking, accessibility, security (XSS, tokens, CSP), and the React 16→19 version history |

---

## A suggested schedule

**If you have a week**

| Day | Do |
|-----|-----|
| 1 | Section 1 (Core React). Do not skip reconciliation or keys — they underpin everything else. |
| 2 | Section 2 (Hooks). Spend extra time on `useEffect` dependencies and the race-condition demo. |
| 3 | Section 3 (Performance). Then go back and re-read the Context topic in section 1. |
| 4 | Sections 4 and 5 (Patterns, State & Data). Read `_lib/miniQuery.ts` properly. |
| 5 | Sections 6 and 7 (Testing, TypeScript). Run `npm test` and read the test files. |
| 6 | Section 8 (JavaScript). This is where most candidates lose points. |
| 7 | Section 9, then re-do the questions you could not answer out loud on days 1–6. |

**If you have one evening**

Section 1, then **Performance**, then **JavaScript Fundamentals**. That is where interviews
at this level actually go wrong.

**The day before**

Use the sidebar filter. Type a keyword — `memo`, `closure`, `hydration`, `key` — and skim
the questions only.

---

## Project layout

```
src/
├── main.tsx                    Entry point. StrictMode is ON deliberately.
├── App.tsx                     Routes. Note the /t/:id/* splat — the routing
│                                 topic renders its own nested <Routes>.
├── registry.ts                 Auto-discovers topics with import.meta.glob.
├── sections.ts                 Section titles and blurbs.
├── types.ts                    The TopicMeta contract every topic exports.
├── styles.css                  Plain CSS. No Tailwind, no CSS-in-JS —
│                                 nothing to distract from the React.
├── components/                 Sidebar, Home, TopicPage, DemoBoundary.
├── lib/
│   ├── ui.tsx                  RenderBadge, Log, Callout, burnCpu, sleep.
│   └── hooks.ts                useToggle, usePrevious, useDebounce,
│                                 useLocalStorage, useEventListener,
│                                 useOnClickOutside, useIntersectionObserver.
├── test/
│   ├── setup.ts                jest-dom matchers + cleanup.
│   └── smoke.test.tsx          Mounts all 60 demos; fails if any throws.
└── topics/
    ├── 01-core/ … 09-ecosystem/
    │   ├── NN-topic-name.tsx   One topic. Exports `meta` + a default Demo.
    │   ├── _lib/               Helpers. Excluded from the topic glob.
    │   └── __tests__/          Real tests. Also excluded.
```

**Adding a topic** — drop a file in any section folder exporting `meta` (satisfying
`TopicMeta`) and a default component. The registry picks it up automatically; no
registration step. The numeric filename prefix sets the order and is stripped from the URL.

---

## Scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | Dev server with HMR |
| `npm test` | Run the test suite once (145 tests) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run typecheck` | `tsc -b --noEmit`, strict mode |
| `npm run build` | Type-check then production build |
| `npm run lint` | oxlint |

---

## A few honest notes

- **"All the questions asked in a 5-year interview" has no fixed list.** This covers the
  topics that reliably come up at that level. It is not a guarantee of question-for-question
  overlap with any specific company.
- **The answers are written to be *said*, not recited.** If one sounds like you would not say
  it that way, rewrite it in your own words — that is the exercise.
- **StrictMode is deliberately on**, so effects double-invoke in development. Several topics
  depend on you seeing that. It has no effect in production.
- **The production bundle is large and the build warns about it.** That is expected: the
  registry imports every topic eagerly so the whole site is instantly available. The
  code-splitting topic demonstrates the fix properly, in isolation.
- **`dangerouslySetInnerHTML` is used** in `TopicPage.tsx` to render `<code>` tags inside
  notes and answers. It is safe there because every string is a literal in this repository's
  own source. `09-ecosystem/05-security.tsx` explains exactly when it stops being safe.

Good luck.

---

## A note on the lint config

`.oxlintrc.json` turns off a handful of rules, and every one of them is deliberate:

- **`react/only-export-components` — off globally.** Every topic file exports both a `meta`
  object and a default component; that is the contract the registry relies on. The rule is
  about React Fast Refresh, which is not worth restructuring 60 files for.
- **`set-state-in-effect`, `no-did-update-set-state`, `no-this-in-sfc`, `globals`, `refs`,
  `purity`, `rules-of-hooks` — off inside `src/topics/` only.** Several topics exist
  specifically to *demonstrate* those anti-patterns side by side with the fix: the
  stale-closure interval, the impure render under StrictMode, the effect that should have
  been a `key`. The comments in each file say which side is which. Outside `src/topics/`,
  the rules are on.
- **`react/refs` — off for `src/lib/hooks.ts` and `src/lib/ui.tsx`.** `usePrevious` and
  `useRenderCount` read `ref.current` during render by design — that *is* the implementation
  of "the value from the previous render". Both are commented to explain why.

`npm run lint` should be clean. If it is not, something real has broken.
