import type { ComponentType } from 'react'

/**
 * One interview question and the answer you should be able to give out loud.
 * Keep answers to what you could actually say in 30-60 seconds.
 */
export type QA = {
  q: string
  /** Model answer. Written as prose, because that is how you will deliver it. */
  a: string
}

/**
 * The metadata every topic module exports. Written as a plain object and
 * validated with `satisfies TopicMeta` in each file, so you get autocomplete
 * and error checking without widening the literal types.
 */
export type TopicMeta = {
  title: string
  /** One sentence shown in the sidebar and on the home page. */
  summary: string
  /** Key points. These are the things you want to be able to recite. */
  notes: string[]
  /** The questions an interviewer actually asks about this topic. */
  questions: QA[]
}

/**
 * The shape of a topic module file. Each `src/topics/<section>/<id>.tsx`
 * must export exactly these two things.
 */
export type TopicModule = {
  meta: TopicMeta
  default: ComponentType
}

/** A topic after the registry has attached its derived routing info. */
export type Topic = TopicMeta & {
  /** URL slug, derived from the filename. */
  id: string
  /** Section folder name, e.g. `01-core`. */
  sectionId: string
  /** Path relative to the repo root, so you can open the source quickly. */
  path: string
  Demo: ComponentType
}

export type Section = {
  id: string
  title: string
  blurb: string
  topics: Topic[]
}
