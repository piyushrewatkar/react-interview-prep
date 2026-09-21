import { useState } from 'react'
import type { TopicMeta } from '../../types'
import { Callout, Panel } from '../../lib/ui'

export const meta = {
  title: '“Implement it yourself”: the classic exercises',
  summary:
    'Deep clone, currying, memoise, flatten, groupBy, and the polyfills. The live-coding questions that actually come up, with the edge cases interviewers probe for.',
  notes: [
    '<b>Deep clone:</b> <code>structuredClone</code> is built in and handles <code>Date</code>, <code>Map</code>, <code>Set</code>, <code>RegExp</code>, typed arrays and cycles. It cannot clone functions, DOM nodes or class prototypes.',
    '<b><code>JSON.parse(JSON.stringify(x))</code> is the answer to avoid.</b> It loses <code>undefined</code>, functions, <code>Symbol</code>, <code>Map</code>/<code>Set</code>, converts <code>Date</code> to a string, turns <code>NaN</code>/<code>Infinity</code> into <code>null</code>, and throws on cycles.',
    '<b>Hand-rolled deep clone needs a <code>WeakMap</code></b> to handle circular references — that is the detail interviewers are listening for.',
    '<b>Currying:</b> return a function until you have enough arguments. <code>fn.length</code> tells you the expected arity.',
    '<b>Memoise:</b> a cache keyed by the arguments. A <code>Map</code> plus <code>JSON.stringify</code> for the key is the pragmatic version; a <code>WeakMap</code> avoids leaks for object keys.',
    '<b>Flatten:</b> <code>arr.flat(Infinity)</code> exists. Be able to write the recursive and the iterative (stack-based) versions anyway.',
    '<b>Polyfills to know:</b> <code>Array.prototype.map</code>, <code>Function.prototype.bind</code>, <code>Promise.all</code>. Each one probes a different thing.',
    '<b>Read the edge cases out loud.</b> Sparse arrays, <code>this</code> handling, the third callback argument — mentioning them is most of the score.',
  ],
  questions: [
    {
      q: 'How do you deep clone an object?',
      a: '<code>structuredClone(obj)</code>, which is built into every modern browser and Node 17+. It handles <code>Date</code>, <code>Map</code>, <code>Set</code>, <code>RegExp</code>, <code>ArrayBuffer</code>, typed arrays, and — importantly — circular references. It throws on functions, DOM nodes and symbols, and it does not preserve class prototypes, so a cloned instance becomes a plain object.\n\nThe answer to avoid is <code>JSON.parse(JSON.stringify(obj))</code>. It silently drops <code>undefined</code> values, functions and symbols, turns <code>Date</code> into a string, converts <code>NaN</code> and <code>Infinity</code> to <code>null</code>, mangles <code>Map</code> and <code>Set</code> into <code>{}</code>, and throws on any cycle. It is fine for plain JSON-shaped data and dangerous elsewhere.\n\nIf they want it hand-written, the structure is: return primitives as-is, handle <code>Date</code>/<code>Map</code>/<code>Set</code>/<code>RegExp</code> explicitly, recurse into arrays and objects — and keep a <code>WeakMap</code> of already-cloned objects so a cycle terminates instead of blowing the stack. That <code>WeakMap</code> is the detail the question is really about.',
    },
    {
      q: 'Write a curry function.',
      a: 'Collect arguments until you have as many as the original function expects, using <code>fn.length</code> to know when that is:\n\n<code>function curry(fn) { return function curried(...args) { return args.length &gt;= fn.length ? fn.apply(this, args) : (...more) =&gt; curried.apply(this, [...args, ...more]) } }</code>\n\nSo <code>curry(add3)(1)(2)(3)</code>, <code>curry(add3)(1, 2)(3)</code> and <code>curry(add3)(1)(2, 3)</code> all work.\n\nThe caveats worth raising: <code>fn.length</code> does not count rest parameters or parameters with defaults, so currying a variadic function needs an explicit arity argument. And the practical use in JavaScript is narrower than in a functional language — partial application via <code>bind</code> or an arrow usually reads better. It is asked because it tests closures, recursion and <code>this</code> handling in one short function.',
    },
    {
      q: 'Write a memoise function. What are its limits?',
      a: '<code>function memoize(fn) { const cache = new Map(); return function (...args) { const key = JSON.stringify(args); if (cache.has(key)) return cache.get(key); const result = fn.apply(this, args); cache.set(key, result); return result } }</code>\n\nThe limitations are where the interesting conversation is.\n\n<code>JSON.stringify</code> as a key is wrong for objects whose property order differs, for functions, for <code>undefined</code>, and for anything cyclic. It is also O(n) in the size of the arguments, which can cost more than the function you are caching.\n\nThe cache grows without bound — a real implementation needs an LRU or a size cap, or you have a memory leak. A <code>WeakMap</code> keyed on a single object argument avoids that, at the cost of only supporting one object key.\n\nAnd it is only correct for pure functions. Memoising anything that reads external state, or whose result should expire, silently serves stale answers.\n\nReact\'s <code>useMemo</code> is a different shape of the same idea: cache size one, keyed by a dependency array compared with <code>Object.is</code>.',
    },
    {
      q: 'Polyfill Array.prototype.map.',
      a: '<code>Array.prototype.myMap = function (callback, thisArg) { const result = new Array(this.length); for (let i = 0; i &lt; this.length; i++) { if (i in this) result[i] = callback.call(thisArg, this[i], i, this) } return result }</code>\n\nThree details are what separate a complete answer from a partial one.\n\nThe callback receives <b>three</b> arguments — value, index, and the array itself. Omitting the third is the most common miss, and it is why <code>["1","2","3"].map(parseInt)</code> famously returns <code>[1, NaN, NaN]</code>: <code>parseInt</code> takes the index as its radix.\n\nThe <code>i in this</code> check skips holes in sparse arrays, which is what the real <code>map</code> does — <code>[1, , 3].map(f)</code> calls <code>f</code> twice, not three times.\n\nAnd the optional second parameter <code>thisArg</code> is passed through with <code>call</code>.\n\nMentioning the <code>parseInt</code> example unprompted tends to land well, because it shows the rule matters in practice.',
    },
    {
      q: 'Polyfill Function.prototype.bind.',
      a: '<code>Function.prototype.myBind = function (thisArg, ...boundArgs) { const fn = this; return function (...callArgs) { return fn.apply(thisArg, [...boundArgs, ...callArgs]) } }</code>\n\nThat covers the normal case: fix <code>this</code>, partially apply arguments, return a new function.\n\nThe part that makes it a good question is <code>new</code>. The real <code>bind</code> specifies that when the bound function is used as a constructor, the bound <code>this</code> is <i>ignored</i> and the newly created object is used instead. Handling that requires checking whether <code>this instanceof</code> the returned function and branching:\n\n<code>return function Bound(...callArgs) { return fn.apply(this instanceof Bound ? this : thisArg, [...boundArgs, ...callArgs]) }</code>\n\nplus setting up the prototype chain so <code>instanceof</code> still works against the original.\n\nEven saying "and the real one has special behaviour when called with <code>new</code>" without writing it out demonstrates you know what <code>bind</code> actually specifies rather than what it usually does.',
    },
  ],
} satisfies TopicMeta

/* ===========================================================================
   1. DEEP CLONE
   =========================================================================== */

function deepClone<T>(value: T, seen = new WeakMap<object, unknown>()): T {
  // Primitives and functions are returned as-is. (Functions are not cloneable
  // in any meaningful sense — structuredClone throws on them.)
  if (value === null || typeof value !== 'object') return value

  // THE DETAIL INTERVIEWERS LOOK FOR: circular references. Without this,
  // `const a = {}; a.self = a; deepClone(a)` blows the stack.
  if (seen.has(value as object)) return seen.get(value as object) as T

  if (value instanceof Date) return new Date(value.getTime()) as T
  if (value instanceof RegExp) return new RegExp(value.source, value.flags) as T

  if (value instanceof Map) {
    const out = new Map()
    seen.set(value, out)
    value.forEach((v, k) => out.set(deepClone(k, seen), deepClone(v, seen)))
    return out as T
  }

  if (value instanceof Set) {
    const out = new Set()
    seen.set(value, out)
    value.forEach((v) => out.add(deepClone(v, seen)))
    return out as T
  }

  if (Array.isArray(value)) {
    const out: unknown[] = []
    seen.set(value, out) // register BEFORE recursing, or a cycle still loops
    value.forEach((v, i) => (out[i] = deepClone(v, seen)))
    return out as T
  }

  const out: Record<string, unknown> = {}
  seen.set(value as object, out)
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = deepClone(v, seen)
  }
  return out as T
}

/* ===========================================================================
   2. CURRY
   =========================================================================== */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function curry(fn: (...args: any[]) => any) {
  // `fn.length` is the declared arity — it does NOT count rest params or
  // parameters with default values, which is the main caveat to mention.
  return function curried(this: unknown, ...args: unknown[]): unknown {
    return args.length >= fn.length
      ? fn.apply(this, args)
      : (...more: unknown[]) => curried.apply(this, [...args, ...more])
  }
}

/* ===========================================================================
   3. MEMOISE
   =========================================================================== */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function memoize<F extends (...args: any[]) => any>(fn: F) {
  const cache = new Map<string, ReturnType<F>>()
  let hits = 0
  let misses = 0

  const memoized = function (this: unknown, ...args: Parameters<F>): ReturnType<F> {
    // Pragmatic, and flawed: JSON.stringify is O(n), is wrong when object key
    // order differs, and cannot represent functions or undefined.
    const key = JSON.stringify(args)
    if (cache.has(key)) {
      hits++
      return cache.get(key)!
    }
    misses++
    const result = fn.apply(this, args)
    cache.set(key, result)
    return result
  }

  memoized.stats = () => ({ hits, misses, size: cache.size })
  memoized.clear = () => {
    cache.clear()
    hits = 0
    misses = 0
  }
  return memoized
}

/* ===========================================================================
   4. FLATTEN, GROUP BY, and the map polyfill
   =========================================================================== */

function flattenRecursive(arr: unknown[], depth = Infinity): unknown[] {
  return depth < 1
    ? arr.slice()
    : arr.reduce<unknown[]>(
        (acc, item) =>
          acc.concat(Array.isArray(item) ? flattenRecursive(item, depth - 1) : item),
        [],
      )
}

/** Iterative version — no recursion, so no stack-overflow risk on deep input. */
function flattenIterative(arr: unknown[]): unknown[] {
  const stack = [...arr]
  const out: unknown[] = []
  while (stack.length) {
    const next = stack.pop()
    if (Array.isArray(next)) stack.push(...next)
    else out.push(next)
  }
  return out.reverse() // we popped from the end, so reverse to restore order
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return items.reduce<Record<string, T[]>>((acc, item) => {
    const key = keyFn(item)
    ;(acc[key] ??= []).push(item)
    return acc
  }, {})
}

/** A faithful Array.prototype.map — three callback args, sparse-aware. */
function myMap<T, U>(
  arr: T[],
  callback: (value: T, index: number, array: T[]) => U,
  thisArg?: unknown,
): U[] {
  const result = new Array<U>(arr.length)
  for (let i = 0; i < arr.length; i++) {
    // `i in arr` skips HOLES. [1, , 3].map(f) calls f twice, not three times.
    if (i in arr) result[i] = callback.call(thisArg, arr[i], i, arr)
  }
  return result
}

export default function Demo() {
  const [out, setOut] = useState<string>('')

  const show = (label: string, value: unknown) =>
    setOut(`${label}\n\n${typeof value === 'string' ? value : JSON.stringify(value, null, 2)}`)

  /* --- deep clone ---------------------------------------------------------- */
  const runClone = () => {
    const original: Record<string, unknown> = {
      date: new Date('2024-01-15'),
      set: new Set([1, 2, 3]),
      map: new Map([['a', 1]]),
      nested: { deep: { value: 42 } },
      undef: undefined,
      notANumber: NaN,
    }
    original.self = original // ← circular

    const cloned = deepClone(original)
    ;(cloned.nested as { deep: { value: number } }).deep.value = 999

    const viaJson = (() => {
      try {
        return JSON.parse(JSON.stringify({ ...original, self: undefined }))
      } catch (e) {
        return `threw: ${(e as Error).message}`
      }
    })()

    show(
      'deepClone vs JSON round-trip',
      [
        `original.nested.deep.value  = ${(original.nested as { deep: { value: number } }).deep.value}  (unchanged ✅)`,
        `cloned.nested.deep.value    = ${(cloned.nested as { deep: { value: number } }).deep.value}`,
        `cloned.self === cloned      = ${cloned.self === cloned}  (cycle preserved ✅)`,
        `cloned.date instanceof Date = ${cloned.date instanceof Date}`,
        `cloned.set instanceof Set   = ${cloned.set instanceof Set}`,
        '',
        'JSON.parse(JSON.stringify(...)) gives:',
        JSON.stringify(viaJson, null, 2),
        '',
        '…note: Date became a string, Set and Map became {}, undefined and',
        'NaN were mangled, and the cycle would have thrown outright.',
        '',
        'structuredClone(obj) does all of this correctly, and is built in.',
      ].join('\n'),
    )
  }

  /* --- curry --------------------------------------------------------------- */
  const runCurry = () => {
    const volume = (l: number, w: number, h: number) => l * w * h
    const curried = curry(volume)
    show(
      'curry',
      [
        `volume.length                = ${volume.length}   (declared arity)`,
        `curried(2)(3)(4)             = ${(curried(2) as (n: number) => (n: number) => number)(3)(4)}`,
        `curried(2, 3)(4)             = ${(curried(2, 3) as (n: number) => number)(4)}`,
        `curried(2)(3, 4)             = ${(curried(2) as (a: number, b: number) => number)(3, 4)}`,
        `curried(2, 3, 4)             = ${curried(2, 3, 4)}`,
        '',
        'Caveat: fn.length ignores rest params and defaulted params, so a',
        'variadic function needs an explicit arity argument.',
      ].join('\n'),
    )
  }

  /* --- memoize ------------------------------------------------------------- */
  const [fibMemo] = useState(() => {
    const fn = memoize((n: number): number => (n <= 1 ? n : fn(n - 1) + fn(n - 2)))
    return fn
  })

  const runMemo = () => {
    const t0 = performance.now()
    const result = fibMemo(35)
    const t1 = performance.now()
    const cached = fibMemo(35)
    const t2 = performance.now()
    show(
      'memoize',
      [
        `fib(35)          = ${result}`,
        `first call       = ${(t1 - t0).toFixed(2)}ms`,
        `second call      = ${(t2 - t1).toFixed(3)}ms   (cache hit)`,
        `cached result    = ${cached}`,
        `stats            = ${JSON.stringify(fibMemo.stats())}`,
        '',
        'Without memoisation, naive fib(35) is ~30 million calls.',
        'With it, 36 — because the recursion itself hits the cache.',
      ].join('\n'),
    )
  }

  /* --- flatten / groupBy / map --------------------------------------------- */
  const runArrays = () => {
    const nested = [1, [2, [3, [4, [5]]]], 6]
    const people = [
      { name: 'Ada', dept: 'eng' },
      { name: 'Grace', dept: 'eng' },
      { name: 'Alan', dept: 'research' },
    ]
    show(
      'flatten / groupBy / map',
      [
        `input              = ${JSON.stringify(nested)}`,
        `arr.flat(Infinity) = ${JSON.stringify(nested.flat(Infinity))}`,
        `flattenRecursive   = ${JSON.stringify(flattenRecursive(nested))}`,
        `flattenIterative   = ${JSON.stringify(flattenIterative(nested))}`,
        `flat(1)            = ${JSON.stringify(flattenRecursive(nested, 1))}`,
        '',
        `groupBy(people, dept) =`,
        JSON.stringify(groupBy(people, (p) => p.dept), null, 2),
        '',
        `myMap([1,2,3], x => x * 2)  = ${JSON.stringify(myMap([1, 2, 3], (x) => x * 2))}`,
        '',
        'The classic:',
        `['1','2','3'].map(parseInt) = ${JSON.stringify(['1', '2', '3'].map(parseInt))}`,
        '  …because map passes (value, INDEX, array) and parseInt reads the',
        '  second argument as a radix. parseInt("2", 1) is NaN.',
        `['1','2','3'].map(Number)   = ${JSON.stringify(['1', '2', '3'].map(Number))}`,
      ].join('\n'),
    )
  }

  return (
    <div className="stack">
      <Panel title="Run them">
        <div className="row">
          <button className="primary" onClick={runClone}>
            deep clone
          </button>
          <button onClick={runCurry}>curry</button>
          <button onClick={runMemo}>memoize (fib 35)</button>
          <button onClick={runArrays}>flatten / groupBy / map</button>
          <button onClick={() => fibMemo.clear()}>clear memo cache</button>
        </div>
        <pre className="log" style={{ marginTop: 12, maxHeight: 340 }}>
          {out || 'Press a button. The implementations are in this file’s source.'}
        </pre>
      </Panel>

      <Panel title="The two polyfills worth memorising">
        <div className="grid2">
          <div>
            <div className="panel-title">Array.prototype.map</div>
            <pre>
              <code>{`Array.prototype.myMap = function (cb, thisArg) {
  const result = new Array(this.length)
  for (let i = 0; i < this.length; i++) {
    // skip HOLES in sparse arrays
    if (i in this) {
      result[i] = cb.call(
        thisArg,
        this[i],   // value
        i,         // index      ← the one people forget
        this       // the array  ← and this one
      )
    }
  }
  return result
}`}</code>
            </pre>
          </div>
          <div>
            <div className="panel-title">Function.prototype.bind</div>
            <pre>
              <code>{`Function.prototype.myBind = function (thisArg, ...bound) {
  const fn = this
  function Bound(...args) {
    // The spec detail: when called with 'new', the bound
    // 'this' is IGNORED and the new object wins.
    return fn.apply(
      this instanceof Bound ? this : thisArg,
      [...bound, ...args]
    )
  }
  // Keep instanceof working against the original.
  Bound.prototype = Object.create(fn.prototype || null)
  return Bound
}`}</code>
            </pre>
          </div>
        </div>
      </Panel>

      <Callout kind="tip">
        <b>How to answer these.</b> Write the simple version first and get it
        working, then say the edge cases out loud —{' '}
        &ldquo;this does not handle cycles; I would add a WeakMap&rdquo;,
        &ldquo;the real <code>map</code> skips holes&rdquo;,
        &ldquo;<code>bind</code> behaves differently under <code>new</code>&rdquo;.
        Naming what you have not handled scores better than a longer answer that
        pretends the edge cases do not exist.
      </Callout>
    </div>
  )
}
