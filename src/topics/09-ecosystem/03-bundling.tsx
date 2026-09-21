import type { TopicMeta } from '../../types'
import { Callout, Panel } from '../../lib/ui'

export const meta = {
  title: 'Bundling, tree shaking & build tools',
  summary:
    'Why Vite is fast, what actually prevents tree shaking, and how to answer “our bundle is 3MB, what do you do?”.',
  notes: [
    '<b>Vite is two tools.</b> In development it serves native ES modules with no bundling, so startup is independent of project size. For production it bundles with Rollup (now Rolldown), because hundreds of unbundled requests are slow over a network.',
    '<b>Webpack bundles in development too</b>, which is why cold start and rebuild times grow with the codebase.',
    '<b>Tree shaking removes unused exports</b>, and it only works on static ES module syntax. CommonJS (<code>require</code>) cannot be shaken, because its exports are computed at runtime.',
    '<b>Side effects block it.</b> If a module might do something on import, the bundler must keep it. <code>"sideEffects": false</code> in <code>package.json</code> is how a library promises it does not.',
    '<b>Barrel files hurt.</b> <code>import { Button } from "@/components"</code> makes the bundler parse the whole index, and with a side-effectful module anywhere inside you pull in everything.',
    '<b>Import only what you use:</b> <code>import debounce from "lodash/debounce"</code>, or better, <code>lodash-es</code>. <code>import _ from "lodash"</code> ships the lot.',
    '<b>Check the bundle before guessing.</b> <code>rollup-plugin-visualizer</code>, <code>webpack-bundle-analyzer</code>, or <code>npx source-map-explorer</code>. The culprit is usually one dependency, not your code.',
    '<b>Usual suspects:</b> moment.js with all locales, a full icon set, a charting library, a date library, a markdown renderer, and the same dependency bundled twice at two versions.',
  ],
  questions: [
    {
      q: 'Why is Vite faster than webpack in development?',
      a: 'Because it does not bundle in development at all.\n\nWebpack builds a dependency graph of your entire application and produces bundles before it can serve anything, so cold start scales with codebase size — and a large app can take a minute.\n\nVite serves your source files as native ES modules over HTTP and lets the browser resolve the import graph. It only transforms a file when the browser actually requests it, so startup is nearly instant regardless of project size, and hot updates only invalidate the single changed module rather than a chunk.\n\nIt does pre-bundle dependencies once with esbuild — which is Go, and roughly 10–100× faster than a JavaScript bundler — because <code>node_modules</code> contains a lot of CommonJS and thousands of tiny files that would be slow to serve individually.\n\nFor production it does bundle, with Rollup (Rolldown in Vite 6+), because hundreds of unbundled requests over a real network with latency would be far worse than one optimised bundle.',
    },
    {
      q: 'What is tree shaking and what stops it working?',
      a: 'Eliminating exports that are never imported, by statically analysing the module graph. It relies on ES module syntax being statically analysable — <code>import</code> and <code>export</code> are declarations that cannot be conditional, so the bundler can prove what is reachable.\n\nWhat breaks it:\n\n<b>CommonJS.</b> <code>module.exports</code> is a runtime object that can be built conditionally, so the bundler cannot prove anything and keeps it all.\n\n<b>Side effects.</b> If importing a module might do something — register a polyfill, modify a prototype, inject CSS — removing it would change behaviour, so the bundler keeps it. <code>"sideEffects": false</code> in <code>package.json</code> is a library author\'s promise that it does not, and getting that wrong is a common bug.\n\n<b>Namespace imports of a CJS package.</b> <code>import _ from "lodash"</code> pulls the entire library; <code>import debounce from "lodash/debounce"</code>, or switching to <code>lodash-es</code>, does not.\n\n<b>Class methods.</b> Bundlers cannot generally prove an individual method is unused, so classes shake far less well than plain functions — one reason modern libraries prefer function exports.',
    },
    {
      q: 'Your bundle is 3MB. Walk me through what you do.',
      a: 'Measure first, always — the intuition about what is large is wrong surprisingly often.\n\nRun an analyser: <code>rollup-plugin-visualizer</code>, <code>webpack-bundle-analyzer</code>, or <code>npx source-map-explorer dist/assets/*.js</code>. You get a treemap, and in my experience one or two dependencies account for most of it.\n\nThen, roughly in order of payoff:\n\n<b>Fix the obvious dependency.</b> Moment with all locales, a full icon library imported as a namespace, a charting or PDF library used on one screen. Replace, import narrowly, or lazy-load it.\n\n<b>Split by route.</b> Nothing else gets you as much for as little work — the user only downloads the page they are on.\n\n<b>Lazy-load heavy conditional UI.</b> The rich text editor, the date picker, the modal most users never open.\n\n<b>Check for duplicates.</b> Two versions of the same package bundled twice is common and invisible until you look.\n\n<b>Verify compression.</b> Brotli or gzip should be on; that is often a config line, not a code change.\n\nAnd I would set a budget in CI afterwards, so it does not creep back.',
    },
    {
      q: 'What is the problem with barrel files?',
      a: 'A barrel is an <code>index.ts</code> that re-exports everything in a directory so you can write <code>import { Button } from "@/components"</code>.\n\nThe cost is that the bundler and the type-checker must parse the entire barrel and everything it re-exports, to resolve one import. With a large component library that is thousands of modules for a single button.\n\nIn development it inflates cold start and hot-reload times, because Vite has to transform every module the barrel touches. In production, tree shaking usually saves you — but not if anything in that graph has side effects, in which case you ship it all.\n\nIt also makes circular imports much easier to create accidentally, and those produce genuinely baffling <code>undefined</code>-at-import-time errors.\n\nThe pragmatic position: barrels are fine at a small scale and for a package\'s public API. For internal imports in a large app, deep imports — <code>import { Button } from "@/components/Button"</code> — are worth the extra characters. Next.js added <code>optimizePackageImports</code> specifically to work around this.',
    },
    {
      q: 'What is the difference between code splitting and tree shaking?',
      a: 'Tree shaking removes code that is <i>never used</i>. Code splitting defers code that <i>is</i> used but is not needed yet.\n\nTree shaking is a build-time elimination: you imported a module with fifty exports and used three, so forty-seven are dropped and never exist in the output. It is automatic and you mostly just avoid breaking it.\n\nCode splitting is a runtime decision you make deliberately, with <code>import()</code>. The code is still shipped — it is just in a separate chunk fetched when needed, so it is not in the initial download.\n\nThey are complementary and both matter. Tree shaking reduces total size; code splitting reduces the <i>initial</i> size, which is what the user actually waits for.',
    },
  ],
} satisfies TopicMeta

export default function Demo() {
  return (
    <div className="stack">
      <Callout>
        This project is built with Vite. Run <code>npm run build</code> and look
        at the output — you will see the main bundle plus a separate chunk for
        the lazily-loaded panel from the code-splitting topic.
      </Callout>

      <Panel title="Vite vs webpack, in development">
        <pre>
          <code>{`WEBPACK — bundle first, then serve
  ┌──────────────────────────────────────────────┐
  │  crawl the ENTIRE dependency graph           │
  │  transform every module                      │
  │  produce bundles                             │  ← cold start scales
  └──────────────────┬───────────────────────────┘     with codebase size
                     ▼
                 serve bundle


VITE — serve native ESM, transform on demand
  ┌──────────────────────────────────────────────┐
  │  pre-bundle node_modules ONCE with esbuild   │  ← Go: 10-100× faster,
  │  (CJS → ESM, thousands of files → a few)     │     and cached
  └──────────────────┬───────────────────────────┘
                     ▼
   browser requests /src/App.tsx
                     ▼
   transform JUST that file, serve it            ← instant, regardless
                     ▼                              of project size
   browser follows its imports, requests those…

PRODUCTION — Vite bundles too, with Rollup/Rolldown.
Hundreds of unbundled requests over a real network would be far worse.`}</code>
        </pre>
      </Panel>

      <Panel title="What breaks tree shaking">
        <div className="grid2">
          <div>
            <div className="panel-title" style={{ color: 'var(--bad)' }}>
              ❌ not shakeable
            </div>
            <pre>
              <code>{`// CommonJS — exports are a runtime
// object, so nothing can be proven.
const _ = require('lodash')

// Namespace import of a CJS package:
// ships all ~70kB gzipped.
import _ from 'lodash'
_.debounce(fn, 300)

// A module with side effects. The
// bundler must keep it — importing
// it DOES something.
import './polyfills'
import 'some-lib/styles.css'

// Barrel import: parses the whole
// index and everything it re-exports.
import { Button } from '@/components'`}</code>
            </pre>
          </div>
          <div>
            <div className="panel-title" style={{ color: 'var(--good)' }}>
              ✅ shakeable
            </div>
            <pre>
              <code>{`// ESM, named, statically analysable.
import { debounce } from 'lodash-es'

// Or a deep import from the CJS one.
import debounce from 'lodash/debounce'

// Libraries declare they are pure:
// package.json
{ "sideEffects": false }

// …or list the exceptions:
{ "sideEffects": ["*.css", "./src/polyfills.js"] }

// Deep import — resolves one module.
import { Button } from '@/components/Button'`}</code>
            </pre>
          </div>
        </div>
      </Panel>

      <Panel title="The bundle-audit checklist">
        <pre>
          <code>{`# 1. MEASURE. Never guess — the culprit is usually one dependency.
npx source-map-explorer 'dist/assets/*.js'
# or: rollup-plugin-visualizer / webpack-bundle-analyzer

# 2. The usual suspects, with their usual fixes:
   moment.js + all locales  →  date-fns, or day.js (2kB)
   the whole icon set       →  import the ~10 icons you use
   lodash (namespace)       →  lodash-es, or deep imports
   a chart library          →  lazy-load the one route that uses it
   two copies of react      →  npm ls react — check for a duplicate

# 3. Split by route. The biggest win for the least work.
const Dashboard = lazy(() => import('./routes/Dashboard'))

# 4. Lazy-load heavy conditional UI.
const Editor = lazy(() => import('./RichTextEditor'))

# 5. Check compression is actually on.
curl -sI -H 'Accept-Encoding: br' https://yoursite.com/assets/index.js \\
  | grep -i content-encoding

# 6. Set a budget so it does not creep back.
#    vite: build.chunkSizeWarningLimit, or a size-limit check in CI.`}</code>
        </pre>
      </Panel>

      <Panel title="Tree shaking vs code splitting">
        <table className="data">
          <thead>
            <tr>
              <th />
              <th>Tree shaking</th>
              <th>Code splitting</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Removes</td>
              <td>Code that is never used.</td>
              <td>Nothing — it defers code that IS used.</td>
            </tr>
            <tr>
              <td>When</td>
              <td>Build time, automatic.</td>
              <td>Runtime, and you choose the split points.</td>
            </tr>
            <tr>
              <td>You write</td>
              <td>Nothing — you just avoid breaking it.</td>
              <td>
                <code>import()</code> / <code>React.lazy</code>.
              </td>
            </tr>
            <tr>
              <td>Reduces</td>
              <td>Total bundle size.</td>
              <td>
                <b>Initial</b> bundle size — what the user waits for.
              </td>
            </tr>
          </tbody>
        </table>
        <Callout kind="tip">
          <b>The number worth quoting.</b> On a mid-tier phone over 4G, roughly
          one second of parse-and-execute time per 100kB of compressed
          JavaScript — before anything is interactive. That is what makes the
          initial bundle, rather than the total, the metric that matters.
        </Callout>
      </Panel>
    </div>
  )
}
