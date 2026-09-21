import { createContext, useContext, useId, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { TopicMeta } from '../../types'
import { Callout, Panel } from '../../lib/ui'

export const meta = {
  title: 'Compound components',
  summary:
    'Several components that share implicit state through context, so the consumer composes markup instead of configuring props. This is how every good component library is built.',
  notes: [
    '<b>The shape:</b> a parent holds the state and provides it via context; the children read it. <code>&lt;Tabs&gt;&lt;Tabs.List&gt;&lt;Tabs.Tab /&gt;&lt;/Tabs.List&gt;&lt;Tabs.Panel /&gt;&lt;/Tabs&gt;</code>.',
    '<b>The alternative it replaces</b> is a configuration object: <code>&lt;Tabs items={[{label, content, icon, disabled, badge}]} /&gt;</code>, which grows a new prop for every design request forever.',
    '<b>The consumer controls the markup.</b> They can wrap, reorder, insert their own elements between the children, and style anything — without the component author anticipating it.',
    '<b>Attach the children as static properties</b> (<code>Tabs.Tab = Tab</code>) so the relationship is visible at the import site and in autocomplete.',
    '<b>Do not use <code>React.Children.map</code> to inject props.</b> It only reaches direct children, so it breaks the moment someone wraps one in a <code>&lt;div&gt;</code>. Use context.',
    '<b>Throw a useful error when a child is used outside its parent.</b> A custom hook with a guard turns a confusing crash into a precise message.',
    '<b>Memoise the context value</b>, or every child re-renders on every parent render.',
    '<b>Real examples:</b> Radix UI, Headless UI, Reach UI, <code>&lt;select&gt;</code>/<code>&lt;option&gt;</code> in HTML itself.',
  ],
  questions: [
    {
      q: 'What are compound components and what do they solve?',
      a: 'A set of components designed to work together, where the parent holds shared state and the children consume it implicitly through context. <code>&lt;Tabs&gt;</code> with <code>&lt;Tabs.Tab&gt;</code> and <code>&lt;Tabs.Panel&gt;</code> is the canonical example; HTML\'s own <code>&lt;select&gt;</code>/<code>&lt;option&gt;</code> is the same idea.\n\nWhat they solve is prop explosion. The alternative is one component configured by a data array plus a prop for every possible variation — <code>renderIcon</code>, <code>tabClassName</code>, <code>disabledTabs</code>, <code>badgePosition</code> — and that list only ever grows, because the author has to anticipate every layout the consumer might want.\n\nWith compound components the consumer writes the markup, so they can wrap a tab in a tooltip, put a divider between two of them, or reorder the panels, without the author having to add anything.',
    },
    {
      q: 'How do the children get access to the parent’s state?',
      a: 'Context. The parent renders a provider around its children with the shared state and the callbacks, and each child calls a hook to read it.\n\nThe other technique you see in older code is <code>React.Children.map</code> with <code>cloneElement</code> to inject props into the children. It works for the simple case and is worth knowing because you will encounter it, but it is fragile: it only reaches <i>direct</i> children, so wrapping one child in a <code>&lt;div&gt;</code> or a <code>&lt;Tooltip&gt;</code> silently breaks it, and it cannot reach a child rendered by a child.\n\nContext has neither limitation and is what every current library uses.',
    },
    {
      q: 'How do you stop a compound child being used outside its parent?',
      a: 'Give the context a default of <code>undefined</code> and read it through a custom hook that throws:\n\n<code>function useTabs() { const ctx = useContext(TabsContext); if (!ctx) throw new Error("&lt;Tabs.Tab&gt; must be used inside &lt;Tabs&gt;"); return ctx }</code>\n\nWithout it, the child reads <code>undefined</code>, destructures it, and you get "Cannot destructure property \'activeId\' of undefined" pointing at a line that does not explain the actual mistake.\n\nThe hook also narrows the type from <code>Ctx | undefined</code> to <code>Ctx</code>, so every child stops needing optional chaining. And keeping the context object itself unexported means nobody can bypass the guard.',
    },
    {
      q: 'What are the downsides of compound components?',
      a: 'They are more verbose at the call site — five lines of JSX where a config array would have been one prop. For a genuinely fixed, repeated structure that is a real cost, and a simple configured component is the better choice.\n\nThey are harder to drive from data. If your tabs come from an API response you end up mapping over it anyway, and the compound API gives you less than a config prop would.\n\nThe context adds a re-render coupling: any change to the shared value re-renders every child, so the value needs memoising and, for large trees, possibly splitting.\n\nAnd typing the static-property pattern (<code>Tabs.Tab</code>) takes a little care in TypeScript, particularly if the parent is generic.\n\nThe rule I would give: use compound components when consumers need layout freedom, and a configured component when the structure is genuinely fixed.',
    },
  ],
} satisfies TopicMeta

/* ===========================================================================
   A compound <Tabs>. About sixty lines, and it is the same architecture Radix
   and Headless UI use.
   =========================================================================== */

type TabsContextValue = {
  activeId: string
  setActiveId: (id: string) => void
  /** Namespaces the generated DOM ids so two Tabs on one page do not collide. */
  baseId: string
}

// Not exported. The only way in is through the guarded hook below, which means
// nobody can bypass the "must be inside <Tabs>" check.
const TabsContext = createContext<TabsContextValue | undefined>(undefined)

function useTabsContext(component: string): TabsContextValue {
  const ctx = useContext(TabsContext)
  if (!ctx) {
    // A precise message beats "cannot destructure property of undefined"
    // pointing at a line three files away.
    throw new Error(`<Tabs.${component}> must be rendered inside <Tabs>.`)
  }
  return ctx
}

function Tabs({
  defaultValue,
  children,
}: {
  defaultValue: string
  children: ReactNode
}) {
  const [activeId, setActiveId] = useState(defaultValue)
  const baseId = useId()

  // MEMOISED. Without this, every render of Tabs gives the context a new object
  // identity and re-renders every tab and panel.
  const value = useMemo(() => ({ activeId, setActiveId, baseId }), [activeId, baseId])

  return <TabsContext.Provider value={value}>{children}</TabsContext.Provider>
}

function TabList({ children }: { children: ReactNode }) {
  return (
    <div
      role="tablist"
      style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)' }}
    >
      {children}
    </div>
  )
}

function Tab({ value, children }: { value: string; children: ReactNode }) {
  const { activeId, setActiveId, baseId } = useTabsContext('Tab')
  const selected = activeId === value

  return (
    <button
      role="tab"
      id={`${baseId}-tab-${value}`}
      // The accessibility wiring the consumer never has to think about. This is
      // the other half of what a component library sells you.
      aria-selected={selected}
      aria-controls={`${baseId}-panel-${value}`}
      tabIndex={selected ? 0 : -1}
      onClick={() => setActiveId(value)}
      style={{
        border: 'none',
        borderRadius: 0,
        borderBottom: `2px solid ${selected ? 'var(--accent)' : 'transparent'}`,
        background: 'transparent',
        color: selected ? 'var(--text)' : 'var(--text-dim)',
        padding: '8px 14px',
        marginBottom: -1,
      }}
    >
      {children}
    </button>
  )
}

function TabPanel({ value, children }: { value: string; children: ReactNode }) {
  const { activeId, baseId } = useTabsContext('Panel')
  if (activeId !== value) return null

  return (
    <div
      role="tabpanel"
      id={`${baseId}-panel-${value}`}
      aria-labelledby={`${baseId}-tab-${value}`}
      style={{ padding: '14px 2px' }}
    >
      {children}
    </div>
  )
}

// Attaching the parts as statics. This is what makes the relationship obvious
// at the call site and in editor autocomplete — you type `Tabs.` and see them.
Tabs.List = TabList
Tabs.Tab = Tab
Tabs.Panel = TabPanel

export default function Demo() {
  return (
    <div className="stack">
      <Panel title="The compound API in use">
        <Tabs defaultValue="overview">
          <Tabs.List>
            <Tabs.Tab value="overview">Overview</Tabs.Tab>
            {/* The consumer can put anything between the tabs — a divider, a
                tooltip wrapper, a conditional. The author never had to
                anticipate it. */}
            <Tabs.Tab value="api">API</Tabs.Tab>
            <span style={{ flex: 1 }} />
            <Tabs.Tab value="danger">⚠ Danger zone</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="overview">
            <p style={{ margin: 0 }} className="muted">
              The parent owns <code>activeId</code>. These children found it
              through context — no props were threaded through{' '}
              <code>Tabs.List</code>.
            </p>
          </Tabs.Panel>
          <Tabs.Panel value="api">
            <pre style={{ margin: 0 }}>
              <code>{`<Tabs defaultValue="overview">
  <Tabs.List>
    <Tabs.Tab value="overview">Overview</Tabs.Tab>
    <Tabs.Tab value="api">API</Tabs.Tab>
  </Tabs.List>
  <Tabs.Panel value="overview">…</Tabs.Panel>
  <Tabs.Panel value="api">…</Tabs.Panel>
</Tabs>`}</code>
            </pre>
          </Tabs.Panel>
          <Tabs.Panel value="danger">
            <div className="callout trap">
              Rendering <code>&lt;Tabs.Tab&gt;</code> outside{' '}
              <code>&lt;Tabs&gt;</code> throws{' '}
              <code>&ldquo;&lt;Tabs.Tab&gt; must be rendered inside
              &lt;Tabs&gt;&rdquo;</code> — because of the guard in{' '}
              <code>useTabsContext</code>.
            </div>
          </Tabs.Panel>
        </Tabs>
      </Panel>

      <Panel title="Why not just take a config array?">
        <div className="grid2">
          <div>
            <div className="panel-title" style={{ color: 'var(--bad)' }}>
              configured — one prop per design request
            </div>
            <pre>
              <code>{`<Tabs
  items={[
    { id: 'a', label: 'Overview', content: <A/> },
    { id: 'b', label: 'API', content: <B/> },
  ]}
  tabClassName="…"
  renderTabIcon={…}
  disabledTabs={['b']}
  tabAlignment="right"
  separatorAfter={['a']}
  // …and it never stops
/>`}</code>
            </pre>
          </div>
          <div>
            <div className="panel-title" style={{ color: 'var(--good)' }}>
              compound — the consumer writes markup
            </div>
            <pre>
              <code>{`<Tabs defaultValue="a">
  <Tabs.List>
    <Tabs.Tab value="a">
      <Icon/> Overview
    </Tabs.Tab>
    <Divider />
    <span style={{flex:1}} />
    <Tooltip content="…">
      <Tabs.Tab value="b">API</Tabs.Tab>
    </Tooltip>
  </Tabs.List>
  …
</Tabs>`}</code>
            </pre>
          </div>
        </div>
      </Panel>

      <Callout kind="trap">
        <b>The old implementation you will see in legacy code.</b>{' '}
        <code>React.Children.map(children, c =&gt; cloneElement(c, {'{'}…{'}'}))</code>{' '}
        injects props into direct children only. Wrap one tab in a{' '}
        <code>&lt;Tooltip&gt;</code> and it silently stops receiving them.
        Context has no such limit — that is why every current library uses it.
      </Callout>
    </div>
  )
}
