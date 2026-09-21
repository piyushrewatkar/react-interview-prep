import { useCallback, useEffect, useRef, useState } from 'react'

/* ===========================================================================
   A ~100-line React Query.

   This is deliberately a teaching implementation: it has the four features
   that actually matter and none of the ones that make the real libraries big.
   If you can explain these four, you can explain why you use React Query
   instead of a useEffect.

     1. CACHE            two components asking for the same key share one entry
     2. DEDUPE           two simultaneous requests for one key make ONE fetch
     3. STALE-WHILE-     cached data renders instantly, a background refetch
        REVALIDATE       updates it
     4. INVALIDATION     a mutation can mark keys stale so they refetch
   =========================================================================== */

type Entry<T> = {
  data: T | undefined
  error: Error | undefined
  /** When the data was last written. Used to decide staleness. */
  updatedAt: number
  /** The in-flight promise, if any. This is what makes deduping work. */
  promise: Promise<T> | undefined
  /** Components currently interested in this key. */
  listeners: Set<() => void>
}

const cache = new Map<string, Entry<unknown>>()

function getEntry<T>(key: string): Entry<T> {
  let entry = cache.get(key) as Entry<T> | undefined
  if (!entry) {
    entry = {
      data: undefined,
      error: undefined,
      updatedAt: 0,
      promise: undefined,
      listeners: new Set(),
    }
    cache.set(key, entry as Entry<unknown>)
  }
  return entry
}

function notify(entry: Entry<unknown>) {
  entry.listeners.forEach((l) => l())
}

/**
 * Fetches a key, deduplicating concurrent requests.
 *
 * The dedupe is the `entry.promise` check: if a request for this key is
 * already in flight, we hand back the SAME promise instead of starting a
 * second one. Three components mounting at once cause one network request.
 */
function fetchKey<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const entry = getEntry<T>(key)

  if (entry.promise) return entry.promise

  const promise = fetcher()
    .then((data) => {
      entry.data = data
      entry.error = undefined
      entry.updatedAt = Date.now()
      return data
    })
    .catch((err: Error) => {
      entry.error = err
      // NOTE: we deliberately keep `entry.data`. Showing stale data with an
      // error banner is almost always better UX than blanking the screen.
      throw err
    })
    .finally(() => {
      entry.promise = undefined
      notify(entry as Entry<unknown>)
    })

  entry.promise = promise
  notify(entry as Entry<unknown>)
  return promise
}

/** Marks matching keys stale and refetches the ones anyone is watching. */
export function invalidate(predicate: (key: string) => boolean) {
  for (const [key, entry] of cache) {
    if (!predicate(key)) continue
    entry.updatedAt = 0 // force "stale"
    if (entry.listeners.size > 0) notify(entry)
  }
}

/** Used by optimistic updates: write straight into the cache. */
export function setQueryData<T>(key: string, updater: (prev: T | undefined) => T) {
  const entry = getEntry<T>(key)
  entry.data = updater(entry.data)
  entry.updatedAt = Date.now()
  notify(entry as Entry<unknown>)
}

export function getQueryData<T>(key: string): T | undefined {
  return (cache.get(key) as Entry<T> | undefined)?.data
}

export function cacheStats() {
  return [...cache.entries()].map(([key, e]) => ({
    key,
    hasData: e.data !== undefined,
    inFlight: e.promise !== undefined,
    listeners: e.listeners.size,
    ageMs: e.updatedAt ? Date.now() - e.updatedAt : null,
  }))
}

export type QueryResult<T> = {
  data: T | undefined
  error: Error | undefined
  /** True only when there is no data to show yet. */
  isLoading: boolean
  /** True while a background refetch is happening over existing data. */
  isValidating: boolean
  refetch: () => void
}

export function useQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  { staleTime = 5000 }: { staleTime?: number } = {},
): QueryResult<T> {
  const entry = getEntry<T>(key)
  const [, forceRender] = useState(0)

  // Keep the fetcher in a ref so an inline arrow at the call site does not
  // re-trigger the effect on every render. (The "latest ref" pattern again.)
  const fetcherRef = useRef(fetcher)
  useEffect(() => {
    fetcherRef.current = fetcher
  })

  // Subscribe to this cache entry.
  useEffect(() => {
    const listener = () => forceRender((n) => n + 1)
    const e = getEntry<T>(key)
    e.listeners.add(listener)
    return () => {
      e.listeners.delete(listener)
    }
  }, [key])

  // Fetch if we have nothing, or if what we have is stale.
  useEffect(() => {
    const e = getEntry<T>(key)
    const isStale = Date.now() - e.updatedAt > staleTime
    if (e.promise) return // already in flight — dedupe
    if (e.data !== undefined && !isStale) return // fresh enough
    fetchKey(key, () => fetcherRef.current()).catch(() => {
      // Swallowed: the error is stored on the entry and surfaced through the
      // return value below. An unhandled rejection here would be noise.
    })
  }, [key, staleTime])

  const refetch = useCallback(() => {
    const e = getEntry<T>(key)
    e.updatedAt = 0
    fetchKey(key, () => fetcherRef.current()).catch(() => {})
  }, [key])

  return {
    data: entry.data,
    error: entry.error,
    // The distinction that matters for UX: `isLoading` means "nothing to
    // show". `isValidating` means "showing something, checking for newer".
    isLoading: entry.data === undefined && entry.promise !== undefined,
    isValidating: entry.promise !== undefined,
    refetch,
  }
}
