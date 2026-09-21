import type { Section, Topic, TopicModule } from './types'
import { SECTION_TITLES } from './sections'

/**
 * AUTO-DISCOVERY
 * --------------
 * `import.meta.glob` is a Vite build-time feature: it is replaced during the
 * build with a literal object of imports. With `eager: true` the modules are
 * imported statically, so `modules` is fully populated at module-evaluation
 * time — no promises, no Suspense needed for the index.
 *
 * The pattern is deliberately ONE level deep (`topics/<section>/<file>.tsx`).
 * That means anything in a nested folder is ignored, which is how the
 * following stay out of the topic list:
 *   - `topics/06-testing/__tests__/*`   (the actual test files)
 *   - `topics/<section>/_lib/*`         (helper components for a demo)
 *
 * Why eager instead of lazy? This is a study app: the whole point is that
 * every topic is instantly available. There IS a lazy-loading topic — see
 * `03-performance/code-splitting-and-suspense.tsx` — which demonstrates
 * `React.lazy` properly, in isolation.
 */
const modules = import.meta.glob<TopicModule>('./topics/*/*.tsx', { eager: true })

function buildSections(): Section[] {
  // Object key order from import.meta.glob is not contractually sorted, so we
  // sort the paths ourselves. The numeric folder prefixes make a plain string
  // sort produce the intended curriculum order.
  const paths = Object.keys(modules).sort()

  const bySection = new Map<string, Topic[]>()

  for (const path of paths) {
    const mod = modules[path]

    // './topics/01-core/03-keys-and-lists.tsx' -> ['01-core', '03-keys-and-lists']
    const match = /^\.\/topics\/([^/]+)\/([^/]+)\.tsx$/.exec(path)
    if (!match) continue
    const [, sectionId, fileBase] = match

    // Both folders and files carry a numeric prefix so that the sort above
    // yields curriculum order rather than alphabetical order. The prefix is
    // stripped from the URL slug: `03-keys-and-lists.tsx` -> `/t/keys-and-lists`.
    // That keeps the ordering concern in the filesystem and out of the URLs.
    const id = fileBase.replace(/^\d+-/, '')

    // A file that forgets to export `meta` or a default component would
    // otherwise crash the whole app with a confusing error deep in render.
    // Failing loudly here, at startup, names the offending file.
    if (!mod.meta || !mod.default) {
      throw new Error(
        `Topic module "${path}" must export both a named \`meta\` object and a default component.`,
      )
    }

    const topic: Topic = {
      ...mod.meta,
      id,
      sectionId,
      path: `src/topics/${sectionId}/${fileBase}.tsx`,
      Demo: mod.default,
    }

    const list = bySection.get(sectionId) ?? []
    list.push(topic)
    bySection.set(sectionId, list)
  }

  return [...bySection.entries()].map(([id, topics]) => ({
    id,
    title: SECTION_TITLES[id]?.title ?? id,
    blurb: SECTION_TITLES[id]?.blurb ?? '',
    topics,
  }))
}

export const SECTIONS: Section[] = buildSections()

/** Flat list, in curriculum order. Used for prev/next navigation. */
export const ALL_TOPICS: Topic[] = SECTIONS.flatMap((s) => s.topics)

export const TOPICS_BY_ID: Map<string, Topic> = new Map(
  ALL_TOPICS.map((t) => [t.id, t]),
)

export function getNeighbours(id: string): { prev?: Topic; next?: Topic } {
  const i = ALL_TOPICS.findIndex((t) => t.id === id)
  if (i === -1) return {}
  return { prev: ALL_TOPICS[i - 1], next: ALL_TOPICS[i + 1] }
}
