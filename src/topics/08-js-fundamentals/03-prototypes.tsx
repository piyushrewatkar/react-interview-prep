import { useState } from 'react'
import type { TopicMeta } from '../../types'
import { Callout, Panel } from '../../lib/ui'

export const meta = {
  title: 'Prototypes, classes & inheritance',
  summary:
    'How property lookup actually works, what `class` is sugar for, and the handful of questions that follow from the prototype chain.',
  notes: [
    '<b>Every object has an internal link to another object</b> — its prototype. Reading a property walks that chain until it finds the key or reaches <code>null</code>.',
    '<b><code>__proto__</code> (legacy) / <code>Object.getPrototypeOf(obj)</code> is the link on an <i>instance</i>. <code>Fn.prototype</code> is the object that <i>will become</i> the prototype of instances made with <code>new Fn()</code>.</b> Two different things with confusingly similar names.',
    '<b><code>new Fn()</code> does four things:</b> creates an object, links its prototype to <code>Fn.prototype</code>, calls <code>Fn</code> with <code>this</code> bound to it, and returns it (unless the constructor returns an object).',
    '<b><code>class</code> is syntax over the same machinery</b> — methods go on <code>Class.prototype</code>, <code>extends</code> sets the chain. It is not a different object model.',
    '<b>What <code>class</code> adds beyond sugar:</b> it is not hoisted-and-callable, the body is always strict, calling it without <code>new</code> throws, and private <code>#fields</code> have no prototype equivalent.',
    '<b>Methods live on the prototype and are shared;</b> class <i>fields</i> (including arrow methods) are created per instance. That is the memory trade-off behind the bind-vs-class-field choice.',
    '<b><code>hasOwnProperty</code> distinguishes own properties from inherited ones</b> — use <code>Object.hasOwn(obj, key)</code> in new code.',
    '<b>Composition over inheritance holds in plain JS too.</b> Deep prototype chains are as brittle here as anywhere else.',
  ],
  questions: [
    {
      q: 'Explain prototypal inheritance.',
      a: 'Every object has a hidden link to another object called its prototype. When you read a property, the engine checks the object itself; if it is not there, it follows the link to the prototype and checks that, and so on until it finds the key or reaches <code>null</code>. That sequence is the prototype chain.\n\nThe practical effect is that behaviour is shared by <i>delegation</i> rather than by copying. When you call <code>arr.map(…)</code>, <code>map</code> is not on your array — it is on <code>Array.prototype</code>, one link up, shared by every array in the program.\n\nThe difference from classical inheritance is that there is no separate "class" entity. A prototype is just an ordinary object, and you can change it at runtime. Classes in JavaScript are a syntax over this, not a replacement for it.',
    },
    {
      q: 'What is the difference between __proto__ and prototype?',
      a: 'They are different things with unhelpfully similar names.\n\n<code>prototype</code> is a property on <i>constructor functions</i>. It holds the object that will be used as the prototype for instances created with <code>new</code>. Only functions have it, and it is where you put shared methods.\n\n<code>__proto__</code> is the actual link on <i>any</i> object, pointing at its prototype. The standard accessor is <code>Object.getPrototypeOf(obj)</code>; <code>__proto__</code> is legacy and only standardised for web compatibility.\n\nSo the relationship is: <code>Object.getPrototypeOf(new Foo()) === Foo.prototype</code>.\n\nA follow-up that catches people: a constructor function also has its own <code>__proto__</code>, which is <code>Function.prototype</code> — because a function is an object too.',
    },
    {
      q: 'What does `new` actually do?',
      a: 'Four steps.\n\nIt creates a new empty object. It sets that object\'s prototype link to the constructor function\'s <code>prototype</code> property. It calls the constructor with <code>this</code> bound to the new object. And it returns the object — unless the constructor explicitly returns an object, in which case that is returned instead. A returned primitive is ignored.\n\nYou can write it yourself, which is a common interview exercise:\n\n<code>function myNew(Ctor, ...args) { const obj = Object.create(Ctor.prototype); const result = Ctor.apply(obj, args); return typeof result === "object" && result !== null ? result : obj }</code>\n\nThe <code>Object.create(Ctor.prototype)</code> line is the interesting one — it is steps one and two in a single call.',
    },
    {
      q: 'Is `class` just syntactic sugar?',
      a: 'Mostly, but not entirely — and the exceptions are what the question is really after.\n\nThe sugar part is real: methods go on <code>Class.prototype</code>, <code>extends</code> sets up the prototype chain, <code>super</code> walks it. The object model is unchanged, and you can write the same thing with constructor functions and <code>Object.create</code>.\n\nWhat classes add that functions cannot replicate: class declarations are hoisted but not initialised, so they sit in a temporal dead zone rather than being callable early. The body is always strict mode. Calling a class without <code>new</code> throws a <code>TypeError</code>, where a constructor function would silently run with the wrong <code>this</code>. Private <code>#fields</code> are enforced by the language and have no prototype-based equivalent. And <code>super</code> in a derived constructor is mandatory before touching <code>this</code>.\n\nSo: the same object model, with meaningful guard rails on top.',
    },
    {
      q: 'What is the difference between a class method and a class field arrow function?',
      a: 'Where they live, which affects both <code>this</code> and memory.\n\nA method is defined once on <code>Class.prototype</code> and shared by every instance. Its <code>this</code> is dynamic, so detaching it loses the binding — the class-component bug.\n\nA class field holding an arrow function is created <i>per instance</i>, in the constructor, and captures <code>this</code> lexically. So it survives detachment, which is why <code>handleClick = () =&gt; {}</code> became the preferred React pattern.\n\nThe trade-off is memory and inheritance. A thousand instances means a thousand copies of each arrow field rather than one shared function — usually irrelevant, occasionally not. And fields are not on the prototype, so they cannot be overridden by a subclass through <code>super</code> in the normal way, and they are not enumerable on the prototype for anything doing reflection.\n\nIn practice, for React classes the arrow field was worth it; for general library code, prototype methods are the default.',
    },
  ],
} satisfies TopicMeta

/* ===========================================================================
   The same thing three ways: constructor function, class, and Object.create.
   =========================================================================== */

// --- 1. The pre-ES6 way ----------------------------------------------------
function AnimalFn(this: { name: string }, name: string) {
  // `this` is the object `new` created for us.
  this.name = name
}
// Methods go on the PROTOTYPE, so all instances share one function object.
AnimalFn.prototype.speak = function (this: { name: string }) {
  return `${this.name} makes a sound.`
}

// --- 2. The class way. Identical machinery underneath. ---------------------
class Animal {
  // A class FIELD — created per instance, in the constructor.
  readonly createdAt = Date.now()

  constructor(public name: string) {}

  // A METHOD — lives on Animal.prototype, shared by every instance.
  speak(): string {
    return `${this.name} makes a sound.`
  }

  // A class field holding an arrow. Per instance, captures `this` lexically,
  // survives detachment. This is the React class-component pattern.
  speakDetachable = (): string => `${this.name} makes a sound (detachable).`
}

class Dog extends Animal {
  constructor(
    name: string,
    public breed: string,
  ) {
    // `super` must run before touching `this` in a derived constructor.
    super(name)
  }

  // Overrides the prototype method one link up the chain.
  override speak(): string {
    return `${this.name} barks.`
  }

  describe(): string {
    // `super.speak()` reaches past the override to Animal.prototype.speak.
    return `${super.speak()} (overridden by Dog: "${this.speak()}")`
  }
}

/* --- 3. Object.create: the prototype chain with no constructor at all ----- */
const animalProto = {
  speak(this: { name: string }) {
    return `${this.name} makes a sound.`
  },
}

export default function Demo() {
  const [chain, setChain] = useState<string[]>([])

  const inspect = (obj: object, label: string) => {
    const out: string[] = [`${label}:`]
    let current: object | null = obj
    let depth = 0
    while (current && depth < 6) {
      const own = Object.getOwnPropertyNames(current).filter((k) => k !== 'constructor')
      const name =
        depth === 0
          ? '(the instance)'
          : (current.constructor?.name ?? 'Object') + '.prototype'
      out.push(`  ${'→ '.repeat(depth ? 1 : 0)}${name}  own keys: [${own.join(', ')}]`)
      current = Object.getPrototypeOf(current)
      depth++
    }
    out.push('  → null')
    setChain(out)
  }

  const dog = new Dog('Rex', 'collie')
  const animal = new Animal('Generic')
  const created = Object.create(animalProto) as { name: string; speak(): string }
  created.name = 'Created'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const legacy = new (AnimalFn as any)('Legacy') as { name: string; speak(): string }

  return (
    <div className="stack">
      <Panel title="1. Three ways to build the same object">
        <div className="grid2">
          <div>
            <div className="panel-title">Constructor function (pre-ES6)</div>
            <pre>
              <code>{`function Animal(name) {
  this.name = name          // per-instance
}
Animal.prototype.speak = function () {
  return this.name + ' makes a sound.'
}                            // shared

const a = new Animal('Rex')`}</code>
            </pre>
          </div>
          <div>
            <div className="panel-title">class — same machinery</div>
            <pre>
              <code>{`class Animal {
  constructor(name) {
    this.name = name        // per-instance
  }
  speak() {                 // → Animal.prototype
    return this.name + ' makes a sound.'
  }
}

const a = new Animal('Rex')`}</code>
            </pre>
          </div>
        </div>

        <div className="row" style={{ marginTop: 12 }}>
          <span className="badge">{legacy.speak()}</span>
          <span className="badge">{animal.speak()}</span>
          <span className="badge">{created.speak()}</span>
        </div>
        <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
          Three construction styles, one object model. <code>Object.create</code>{' '}
          skips the constructor entirely and just sets the link.
        </div>
      </Panel>

      <Panel title="2. Walk a prototype chain">
        <div className="row" style={{ marginBottom: 10 }}>
          <button className="primary" onClick={() => inspect(dog, 'new Dog("Rex", "collie")')}>
            inspect a Dog
          </button>
          <button onClick={() => inspect(animal, 'new Animal("Generic")')}>inspect an Animal</button>
          <button onClick={() => inspect([1, 2, 3], '[1, 2, 3]')}>inspect an array</button>
          <button onClick={() => inspect(() => {}, '() => {}')}>inspect a function</button>
        </div>
        <pre className="log" style={{ maxHeight: 200 }}>
          {chain.length === 0 ? 'Press a button.' : chain.join('\n')}
        </pre>
        <Callout kind="tip">
          Notice that the instance&rsquo;s own keys are the <i>fields</i> (
          <code>name</code>, <code>createdAt</code>,{' '}
          <code>speakDetachable</code>) while <code>speak</code> is one link up
          on the prototype. That split is the memory story: fields are per
          instance, methods are shared.
        </Callout>
      </Panel>

      <Panel title="3. Inheritance and super">
        <div className="col">
          <span className="mono" style={{ fontSize: 13 }}>
            {dog.describe()}
          </span>
          <div className="row">
            <span className="badge">dog instanceof Dog: {String(dog instanceof Dog)}</span>
            <span className="badge">dog instanceof Animal: {String(dog instanceof Animal)}</span>
            <span className="badge">
              Object.hasOwn(dog, &apos;speak&apos;): {String(Object.hasOwn(dog, 'speak'))}
            </span>
            <span className="badge">
              &apos;speak&apos; in dog: {String('speak' in dog)}
            </span>
          </div>
          <div className="muted" style={{ fontSize: 13 }}>
            <code>hasOwn</code> is false but <code>in</code> is true — the
            method is found by walking the chain, not on the object itself.
            That is the entire difference between the two checks.
          </div>
        </div>
      </Panel>

      <Panel title="4. What `new` actually does">
        <pre>
          <code>{`function myNew(Ctor, ...args) {
  // 1 + 2: create an object whose prototype link points at Ctor.prototype
  const obj = Object.create(Ctor.prototype)

  // 3: run the constructor with 'this' bound to it
  const result = Ctor.apply(obj, args)

  // 4: return the object — unless the constructor returned an object itself
  return (typeof result === 'object' && result !== null) ? result : obj
}

myNew(Animal, 'Rex').speak()   // "Rex makes a sound."`}</code>
        </pre>
      </Panel>

      <Panel title="5. What `class` adds beyond sugar">
        <table className="data">
          <thead>
            <tr>
              <th />
              <th>Constructor function</th>
              <th>class</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Called without <code>new</code></td>
              <td>Runs silently with the wrong <code>this</code>.</td>
              <td><code>TypeError</code>.</td>
            </tr>
            <tr>
              <td>Hoisting</td>
              <td>Fully hoisted and callable.</td>
              <td>Hoisted but in the temporal dead zone.</td>
            </tr>
            <tr>
              <td>Strict mode</td>
              <td>Inherited from the surrounding code.</td>
              <td>Always strict.</td>
            </tr>
            <tr>
              <td>Private state</td>
              <td>Closures only, by convention.</td>
              <td>
                <code>#fields</code>, enforced by the language.
              </td>
            </tr>
            <tr>
              <td>
                <code>super</code>
              </td>
              <td>Manual <code>Parent.call(this, …)</code>.</td>
              <td>Required before <code>this</code>, checked by the engine.</td>
            </tr>
          </tbody>
        </table>
      </Panel>
    </div>
  )
}
