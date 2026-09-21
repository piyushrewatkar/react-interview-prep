import { useState } from 'react'
import type { TopicMeta } from '../../types'
import { Callout, Panel } from '../../lib/ui'

export const meta = {
  title: 'Security: XSS, tokens & dependencies',
  summary:
    'What React escapes for you, the four ways to defeat that protection, and where auth tokens should actually live.',
  notes: [
    '<b>React escapes text by default.</b> <code>{userInput}</code> in JSX is inserted as a text node, so <code>&lt;script&gt;</code> renders as visible characters, not as markup. That covers the majority of XSS.',
    '<b>Escape hatch 1 — <code>dangerouslySetInnerHTML</code>.</b> Named to make you think. Only ever pass content you wrote, or output from a sanitiser such as DOMPurify.',
    '<b>Escape hatch 2 — <code>href</code> and <code>src</code>.</b> <code>&lt;a href={userUrl}&gt;</code> with <code>javascript:alert(1)</code> executes on click. Validate the protocol against an allowlist.',
    '<b>Escape hatch 3 — spreading unknown props.</b> <code>&lt;div {...userSuppliedObject} /&gt;</code> can inject <code>dangerouslySetInnerHTML</code> or event handlers.',
    '<b>Escape hatch 4 — injecting into a <code>&lt;script&gt;</code> or a style during SSR</b>, where you are no longer inside React&rsquo;s escaping at all.',
    '<b><code>localStorage</code> is readable by any JavaScript on the page</b>, so a single XSS exfiltrates every token in it. <code>httpOnly</code> cookies are not readable by JavaScript.',
    '<b>Cookies need <code>httpOnly</code>, <code>Secure</code> and <code>SameSite</code></b>; <code>SameSite=Lax</code> or <code>Strict</code> handles most CSRF, with a token for the rest.',
    '<b>Anything in the client bundle is public.</b> <code>VITE_</code>/<code>NEXT_PUBLIC_</code> variables are shipped to the browser — never put a secret in one.',
  ],
  questions: [
    {
      q: 'How does React protect against XSS, and how do you defeat that protection?',
      a: 'React escapes any value you interpolate into JSX. <code>{userInput}</code> becomes a text node, so a string containing <code>&lt;img onerror=…&gt;</code> renders as those literal characters rather than as an element. That handles the common case automatically, which is why React apps have far fewer XSS holes than jQuery-era code.\n\nThere are four ways out of it.\n\n<code>dangerouslySetInnerHTML</code> — the explicit one, named to make you pause.\n\nURL attributes. <code>&lt;a href={userUrl}&gt;</code> is not escaped in a way that helps, because <code>javascript:alert(document.cookie)</code> is a valid URL. Validate the protocol against an allowlist of <code>http</code>, <code>https</code>, <code>mailto</code>.\n\nSpreading an untrusted object: <code>&lt;div {...props} /&gt;</code> where <code>props</code> came from an API can contain <code>dangerouslySetInnerHTML</code> or an event handler.\n\nAnd server-side rendering into a <code>&lt;script&gt;</code> tag — embedding JSON state into the page puts you outside React\'s escaping entirely, and <code>&lt;/script&gt;</code> inside a string will break out.',
    },
    {
      q: 'When is dangerouslySetInnerHTML acceptable?',
      a: 'When you can trace the content to something you control, or it has been through a sanitiser.\n\nContent from your own source code — a literal in a component, a markdown file in the repo compiled at build time — is code, not data, and is safe.\n\nContent from a CMS or a database is not safe by default, even if "only staff can edit it". That is a privilege-escalation vector, not a guarantee. Run it through DOMPurify: <code>dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }}</code>, and configure the allowed tags and attributes rather than accepting the defaults blindly.\n\nUser-generated content is never safe raw.\n\nAnd there is usually an alternative worth considering first: render markdown with a library that produces React elements rather than an HTML string, so the escape hatch is never opened at all.',
    },
    {
      q: 'Where should a JWT be stored?',
      a: 'In an <code>httpOnly</code> cookie, if you have any choice in the matter.\n\n<code>localStorage</code> is readable by any JavaScript running on the page. That means one XSS — in your code, or in any of your six hundred transitive dependencies — exfiltrates every token in it. And XSS is the vulnerability class you are most likely to actually have.\n\nAn <code>httpOnly</code> cookie cannot be read by JavaScript at all. An attacker with XSS can still <i>make requests</i> as the user, which is bad, but they cannot steal the token and use it elsewhere, later, at scale.\n\nThe cookie needs <code>httpOnly</code>, <code>Secure</code>, and <code>SameSite=Lax</code> or <code>Strict</code> — the last of which handles most CSRF, with a CSRF token for the cases it does not.\n\nThe common objection is that cookies are awkward for a separate API domain, and that is real — you need CORS with credentials and <code>SameSite=None; Secure</code>. The pattern that threads the needle is a short-lived access token in memory (a variable, not storage) plus a long-lived refresh token in an <code>httpOnly</code> cookie.\n\nWhat I would avoid saying is "localStorage is fine as long as you prevent XSS". Defence in depth exists because you will not prevent all of it.',
    },
    {
      q: 'What is CSRF and does it affect a React SPA?',
      a: 'Cross-site request forgery: a malicious site causes the user\'s browser to make an authenticated request to yours. It works because the browser attaches cookies automatically, based on the destination, regardless of which site initiated the request.\n\nSo it affects you if and only if you authenticate with cookies. A token sent in an <code>Authorization</code> header is not attached automatically, so a cross-site request simply arrives unauthenticated — which is one genuine argument in favour of header-based tokens.\n\nIf you use cookies, the defences are: <code>SameSite=Lax</code> (now the browser default) or <code>Strict</code>, which stops the cookie being sent on most cross-site requests; a CSRF token that the attacker cannot read or guess, for anything <code>SameSite</code> does not cover; and checking the <code>Origin</code> header on state-changing requests.\n\nThe trap worth naming: <code>SameSite=Lax</code> still allows cookies on top-level GET navigations, so a GET endpoint that changes state is exploitable. Which is a good reason for GET to be safe by definition.',
    },
    {
      q: 'How do you handle dependency security in a React project?',
      a: 'Accept that this is where most of your attack surface is. A typical React app has hundreds of transitive dependencies, all of which run with the same privileges as your own code.\n\nThe practical measures: run <code>npm audit</code> in CI and treat high-severity findings as blocking; use Dependabot or Renovate so updates arrive as small, reviewable PRs rather than a yearly migration; and commit the lockfile so builds are reproducible and a compromised version cannot be silently pulled in.\n\nFor anything new, look before adding: recent releases, a reasonable maintainer count, and its own dependency tree. A package with forty transitive dependencies to do one small thing is forty more things to trust.\n\nAnd the mitigation that matters most for supply-chain attacks specifically is a Content Security Policy. Even if a compromised package is in your bundle, a strict CSP stops it loading a script from an attacker\'s domain or exfiltrating data to one.',
    },
  ],
} satisfies TopicMeta

const PAYLOADS = [
  '<img src=x onerror="alert(\'XSS\')">',
  '<script>alert("XSS")</script>',
  '<svg onload="alert(1)">',
  'Just some normal text',
]

/** A naive "sanitiser", to show the shape. USE DOMPurify IN REAL CODE. */
function crudeSanitize(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/javascript:/gi, '')
}

/** Protocol allowlist — the fix for the href vector. */
function safeUrl(url: string): string {
  try {
    const parsed = new URL(url, window.location.origin)
    return ['http:', 'https:', 'mailto:'].includes(parsed.protocol) ? parsed.href : '#'
  } catch {
    return '#'
  }
}

export default function Demo() {
  const [payload, setPayload] = useState(PAYLOADS[0])
  const [url, setUrl] = useState('javascript:alert(document.cookie)')

  return (
    <div className="stack">
      <Callout>
        The payloads below are real but inert here, because the &ldquo;safe&rdquo;
        columns do what React does by default. Nothing on this page executes
        them.
      </Callout>

      <Panel title="1. React's default escaping">
        <div className="row" style={{ marginBottom: 12 }}>
          <select value={payload} onChange={(e) => setPayload(e.target.value)} style={{ flex: 1 }}>
            {PAYLOADS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div className="grid2">
          <div className="panel">
            <div className="panel-title" style={{ color: 'var(--good)' }}>
              ✅ {'{payload}'} — escaped automatically
            </div>
            {/* Inserted as a TEXT NODE. The angle brackets are characters. */}
            <div style={{ fontSize: 13, wordBreak: 'break-all' }}>{payload}</div>
          </div>

          <div className="panel">
            <div className="panel-title" style={{ color: 'var(--warn)' }}>
              ⚠ after crudeSanitize() — the shape of the fix
            </div>
            <div
              style={{ fontSize: 13, wordBreak: 'break-all' }}
              dangerouslySetInnerHTML={{ __html: crudeSanitize(payload) }}
            />
            <div style={{ fontSize: 12, color: 'var(--warn)', marginTop: 6 }}>
              Illustrative only — a regex sanitiser is <b>not</b> secure. Use
              DOMPurify.
            </div>
          </div>
        </div>

        <Callout kind="trap">
          The dangerous version is deliberately not rendered here. It would be{' '}
          <code>
            dangerouslySetInnerHTML={'{{'} __html: payload {'}}'}
          </code>{' '}
          with no sanitiser — and the <code>onerror</code> payload would execute
          the moment the image failed to load.
        </Callout>
      </Panel>

      <Panel title="2. The href vector — escaping does not help here">
        <div className="row" style={{ marginBottom: 10 }}>
          <input value={url} onChange={(e) => setUrl(e.target.value)} style={{ flex: 1, minWidth: 220 }} />
          <button onClick={() => setUrl('https://react.dev')}>use a safe URL</button>
        </div>
        <div className="grid2">
          <div className="panel">
            <div className="panel-title" style={{ color: 'var(--bad)' }}>
              ❌ what NOT to write
            </div>
            <pre style={{ margin: 0, fontSize: 12 }}>
              <code>{`<a href={userUrl}>Click</a>

// userUrl = "javascript:alert(1)"
// → executes on click.
// React escapes TEXT, not protocols.`}</code>
            </pre>
          </div>
          <div className="panel">
            <div className="panel-title" style={{ color: 'var(--good)' }}>
              ✅ protocol allowlist
            </div>
            <a href={safeUrl(url)} target="_blank" rel="noopener noreferrer">
              {safeUrl(url) === '#' ? 'blocked — protocol not allowed' : safeUrl(url)}
            </a>
            <pre style={{ marginTop: 8, marginBottom: 0, fontSize: 12 }}>
              <code>{`const parsed = new URL(url, origin)
return ['http:', 'https:', 'mailto:']
  .includes(parsed.protocol) ? parsed.href : '#'`}</code>
            </pre>
          </div>
        </div>
        <Callout>
          Also note <code>rel=&quot;noopener noreferrer&quot;</code> on any{' '}
          <code>target=&quot;_blank&quot;</code> link — without{' '}
          <code>noopener</code> the opened page can reach back through{' '}
          <code>window.opener</code> and navigate yours.
        </Callout>
      </Panel>

      <Panel title="3. The four escape hatches">
        <pre>
          <code>{`// 1. dangerouslySetInnerHTML — the explicit one.
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }} />

// 2. URL attributes — href, src, formAction, and CSS url().
<a href={validateProtocol(userUrl)}>…</a>

// 3. Spreading an untrusted object. That object could contain
//    dangerouslySetInnerHTML, or an onClick.
<div {...propsFromApi} />                 // ❌
const { id, title } = propsFromApi        // ✅ pick what you expect
<div id={id} title={title} />

// 4. SSR into a <script> tag — outside React's escaping entirely.
<script>window.__STATE__ = \${JSON.stringify(state)}</script>   // ❌
//   a string containing </script> breaks straight out
<script>window.__STATE__ = \${serialize(state)}</script>        // ✅ (e.g. 'serialize-javascript')`}</code>
        </pre>
      </Panel>

      <Panel title="4. Where tokens live">
        <table className="data">
          <thead>
            <tr>
              <th>Storage</th>
              <th>Readable by JS?</th>
              <th>XSS risk</th>
              <th>CSRF risk</th>
              <th>Verdict</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="mono">localStorage</td>
              <td className="mono">yes</td>
              <td style={{ color: 'var(--bad)' }}>One XSS steals every token.</td>
              <td className="mono">none</td>
              <td>Avoid for tokens.</td>
            </tr>
            <tr>
              <td className="mono">sessionStorage</td>
              <td className="mono">yes</td>
              <td style={{ color: 'var(--bad)' }}>Same, but scoped to the tab.</td>
              <td className="mono">none</td>
              <td>Marginally better. Still avoid.</td>
            </tr>
            <tr>
              <td className="mono">cookie (no httpOnly)</td>
              <td className="mono">yes</td>
              <td style={{ color: 'var(--bad)' }}>Readable.</td>
              <td style={{ color: 'var(--bad)' }}>Sent automatically.</td>
              <td>Worst of both.</td>
            </tr>
            <tr>
              <td className="mono">cookie + httpOnly</td>
              <td className="mono">no</td>
              <td style={{ color: 'var(--good)' }}>Cannot be exfiltrated.</td>
              <td>Mitigated by SameSite + a token.</td>
              <td style={{ color: 'var(--good)' }}>
                <b>Preferred.</b>
              </td>
            </tr>
            <tr>
              <td>In-memory variable</td>
              <td className="mono">yes, same-page</td>
              <td>Short-lived, so limited value.</td>
              <td className="mono">none</td>
              <td style={{ color: 'var(--good)' }}>
                Good for a short access token, with a refresh token in a cookie.
              </td>
            </tr>
          </tbody>
        </table>
      </Panel>

      <Panel title="5. The rest of the checklist">
        <pre>
          <code>{`# Environment variables are PUBLIC once they reach the client.
VITE_API_URL=https://api.example.com     # fine — it is in the network tab anyway
VITE_STRIPE_SECRET=sk_live_...           # ❌ shipped in the bundle. Never.

# Content Security Policy — the main mitigation for a compromised dependency.
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-{random}';    # no inline scripts, no eval
  connect-src 'self' https://api.example.com;
  frame-ancestors 'none';                # clickjacking

# Dependencies — where most of your attack surface actually is.
npm audit --audit-level=high             # in CI, blocking
# Dependabot / Renovate for small reviewable updates
# Commit the lockfile — reproducible builds

# Authorisation is a SERVER concern.
{user.isAdmin && <DeleteAllButton />}    # UX only. The route config and the
                                         # code are both in the browser.
                                         # The API must check every request.`}</code>
        </pre>
        <Callout kind="tip">
          <b>The line worth having ready.</b> &ldquo;React escapes text by
          default, so most XSS is handled. My job is the four places that
          escaping does not cover — <code>dangerouslySetInnerHTML</code>, URL
          attributes, spreading untrusted objects, and SSR into a script tag —
          plus not storing tokens where JavaScript can read them.&rdquo;
        </Callout>
      </Panel>
    </div>
  )
}
