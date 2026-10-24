import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  Blocks,
  BookOpen,
  Box,
  Braces,
  Check,
  Code2,
  Database,
  FileText,
  GitBranch,
  History,
  Layers,
  LayoutTemplate,
  Network,
  PackageOpen,
  PenTool,
  ShieldCheck,
  Workflow,
  Zap,
} from 'lucide-react';
import { Brand } from '@/components/brand';
import { CopyButton } from '@/components/home/copy-button';
import { HeroVisual } from '@/components/home/hero-visual';
import { repositoryUrl } from '@/lib/shared';

const installCommand = 'pnpm add travels mutative';
const quickStartCode = `import { createTravels } from 'travels';

const travels = createTravels({
  document: { title: 'Untitled' }
});

travels.setState((draft) => {
  draft.document.title = 'Hello, Travels';
});

travels.back();
travels.forward();`;

const features = [
  {
    icon: Braces,
    title: 'Patch-based by design',
    text: 'Record forward and inverse JSON Patches instead of copying the whole state for every edit.',
    href: '/docs/concepts/how-it-works',
  },
  {
    icon: Database,
    title: 'History worth keeping',
    text: 'Serialize state, patches, cursor, and metadata into one versioned, restorable snapshot.',
    href: '/docs/persistence',
  },
  {
    icon: Blocks,
    title: 'Your framework, your store',
    text: 'Use immutable timelines or preserve reactive references with mutable mode and journals.',
    href: '/docs/integrations',
  },
  {
    icon: ShieldCheck,
    title: 'Predictable at the edges',
    text: 'Atomic transactions, typed errors, semantic restore validation, and explicit compatibility.',
    href: '/docs/guides/transactions',
  },
];

const documentation = [
  {
    icon: Zap,
    eyebrow: 'START HERE',
    title: 'Build your first timeline',
    text: 'Install Travels, record an edit, and connect undo/redo controls in minutes.',
    href: '/docs/getting-started/quick-start',
  },
  {
    icon: Workflow,
    eyebrow: 'GO DEEPER',
    title: 'Design the right history',
    text: 'Learn archive modes, transactions, branching, mutable state, and external journals.',
    href: '/docs/guides/archive-mode',
  },
  {
    icon: Code2,
    eyebrow: 'SHIP WITH CONFIDENCE',
    title: 'Persist and restore safely',
    text: 'Add durable storage, migrations, corruption recovery, and integrity boundaries.',
    href: '/docs/persistence',
  },
];

export default function HomePage() {
  return (
    <main className="home-page">
      <section className="home-hero home-container">
        <div className="hero-copy">
          <Link href="/docs/migration" className="release-pill">
            <span className="release-dot" />
            Travels 3.0 is here
            <span className="release-divider" />
            See what’s new
            <ArrowRight size={13} />
          </Link>
          <p className="hero-eyebrow">PATCH-BASED STATE HISTORY</p>
          <h1>
            Every change.
            <span>A way back.</span>
          </h1>
          <p className="hero-description">
            Durable undo/redo for modern applications. Keep compact history,
            write natural mutation-style updates, and integrate with the state
            tools you already use.
          </p>
          <div className="hero-actions">
            <Link href="/docs/getting-started/quick-start" className="button button-primary">
              Get started <ArrowRight size={17} />
            </Link>
            <a href={repositoryUrl} className="button button-secondary">
              <PackageOpen size={17} /> View on GitHub
            </a>
          </div>
          <div className="install-command">
            <span className="install-prompt">$</span>
            <code>{installCommand}</code>
            <CopyButton text={installCommand} label="Copy" />
          </div>
          <p className="framework-line">
            <span>Works with</span> React · Vue · Zustand · MobX · Pinia · Vanilla JS
          </p>
        </div>
        <HeroVisual />
      </section>

      <section className="proof-strip" aria-label="Key capabilities">
        <div className="home-container proof-grid">
          <div><Braces size={18} /><span><strong>RFC 6902</strong> JSON Patches</span></div>
          <div><Box size={18} /><span><strong>Framework-agnostic</strong> core</span></div>
          <div><Code2 size={18} /><span><strong>TypeScript-first</strong> API</span></div>
          <div><Database size={18} /><span><strong>Storage-agnostic</strong> persistence</span></div>
        </div>
      </section>

      <section className="home-section home-container">
        <div className="section-heading centered">
          <p className="section-eyebrow">WHY TRAVELS</p>
          <h2>A smaller history. A bigger editing experience.</h2>
          <p>
            Built for large state, small updates, long timelines, and histories
            that need to survive a reload—not just the current render.
          </p>
        </div>
        <div className="feature-grid">
          {features.map((feature) => (
            <Link href={feature.href} className="feature-card" key={feature.title}>
              <span className="feature-icon"><feature.icon size={21} /></span>
              <h3>{feature.title}</h3>
              <p>{feature.text}</p>
              <span className="card-link">Explore <ArrowRight size={14} /></span>
            </Link>
          ))}
        </div>
      </section>

      <section className="code-section">
        <div className="home-container code-section-grid">
          <div className="code-section-copy">
            <p className="section-eyebrow">NATURAL UPDATES, PRECISE HISTORY</p>
            <h2>Write like it’s mutable.<br />Travel like it’s immutable.</h2>
            <p>
              Travels uses Mutative to turn familiar draft mutations into
              immutable state and reversible patches. No reducer boilerplate,
              no manual inverse operations.
            </p>
            <ul className="check-list">
              <li><Check size={16} /> No-op updates stay out of history</li>
              <li><Check size={16} /> Metadata labels every meaningful edit</li>
              <li><Check size={16} /> Read-only controls fit any UI</li>
            </ul>
            <Link href="/docs/guides/updating-state" className="text-link">
              Explore state updates <ArrowRight size={15} />
            </Link>
          </div>
          <div className="code-window">
            <div className="code-window-bar">
              <div className="window-dots"><span /><span /><span /></div>
              <span>quick-start.ts</span>
              <CopyButton text={quickStartCode} />
            </div>
            <pre className="home-code"><code>
              <span className="code-keyword">import</span> {'{ createTravels }'} <span className="code-keyword">from</span> <span className="code-string">'travels'</span>;{'\n\n'}
              <span className="code-keyword">const</span> travels = <span className="code-function">createTravels</span>({'{'}{'\n'}
              {'  '}document: {'{'} title: <span className="code-string">'Untitled'</span> {'}'}{'\n'}{'}'});{'\n\n'}
              travels.<span className="code-function">setState</span>((draft) <span className="code-keyword">=&gt;</span> {'{'}{'\n'}
              {'  '}draft.document.title = <span className="code-string">'Hello, Travels'</span>;{'\n'}{'}'});{'\n\n'}
              travels.<span className="code-function">back</span>();  <span className="code-comment">// undo</span>{'\n'}
              travels.<span className="code-function">forward</span>(); <span className="code-comment">// redo</span>
            </code></pre>
            <div className="code-result">
              <span><GitBranch size={14} /> position: 1</span>
              <span><History size={14} /> history retained</span>
            </div>
          </div>
        </div>
      </section>

      <section className="home-section home-container">
        <div className="section-heading split-heading">
          <div>
            <p className="section-eyebrow">ONE CORE, TWO OWNERSHIP MODELS</p>
            <h2>History that fits your architecture.</h2>
          </div>
          <p>
            Let Travels own updates, or keep your existing store authoritative.
            The history contract stays explicit in both directions.
          </p>
        </div>
        <div className="ownership-grid">
          <div className="ownership-card ownership-blue">
            <div className="ownership-top"><Layers size={24} /><span>STATE-OWNING</span></div>
            <h3>createTravels()</h3>
            <p>Send updates through Travels and receive immutable states, patches, navigation, and controls.</p>
            <div className="ownership-flow"><span>Your update</span><ArrowRight size={15} /><span>Travels</span><ArrowRight size={15} /><span>Your UI</span></div>
            <Link href="/docs/getting-started/quick-start" className="card-link">Own state with Travels <ArrowRight size={14} /></Link>
          </div>
          <div className="ownership-card ownership-orange">
            <div className="ownership-top"><Network size={24} /><span>EXTERNALLY OWNED</span></div>
            <h3>createTravelJournal()</h3>
            <p>Record patches from an existing store or state machine, then delegate undo/redo through its commit path.</p>
            <div className="ownership-flow"><span>Your store</span><ArrowRight size={15} /><span>Journal</span><ArrowRight size={15} /><span>Your UI</span></div>
            <Link href="/docs/guides/controlled-journal" className="card-link">Connect an external owner <ArrowRight size={14} /></Link>
          </div>
        </div>
      </section>

      <section className="use-cases-section">
        <div className="home-container">
          <div className="section-heading centered light-heading">
            <p className="section-eyebrow">MADE FOR MEANINGFUL EDITS</p>
            <h2>Give every interaction a way back.</h2>
            <p>From a single field to a complex canvas, make exploration feel safe.</p>
          </div>
          <div className="use-case-grid">
            <div className="use-case-card">
              <span className="use-case-number">01</span><PenTool size={27} />
              <h3>Visual editors</h3>
              <p>Group complex canvas operations into atomic steps and keep long editing sessions compact.</p>
              <span className="use-case-tag">Canvas · Design tools · Whiteboards</span>
            </div>
            <div className="use-case-card">
              <span className="use-case-number">02</span><LayoutTemplate size={27} />
              <h3>Forms & builders</h3>
              <p>Choose when edits become undoable steps with manual archives and external form ownership.</p>
              <span className="use-case-tag">Forms · Page builders · Workflows</span>
            </div>
            <div className="use-case-card">
              <span className="use-case-number">03</span><FileText size={27} />
              <h3>Local-first apps</h3>
              <p>Persist complete timelines, validate restored history, and recover intentionally from bad data.</p>
              <span className="use-case-tag">Offline drafts · IndexedDB · Sync</span>
            </div>
          </div>
        </div>
      </section>

      <section className="home-section home-container docs-section">
        <div className="section-heading centered">
          <p className="section-eyebrow">DOCUMENTATION FOR THE WHOLE JOURNEY</p>
          <h2>Start small. Understand every edge.</h2>
          <p>Practical guides, integration recipes, operational guardrails, and source-generated API reference.</p>
        </div>
        <div className="docs-card-grid">
          {documentation.map((item) => (
            <Link href={item.href} className="docs-card" key={item.title}>
              <div className="docs-card-icon"><item.icon size={22} /></div>
              <span className="docs-card-eyebrow">{item.eyebrow}</span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
              <span className="card-link">Read the guide <ArrowUpRight size={15} /></span>
            </Link>
          ))}
        </div>
        <div className="api-banner">
          <div className="api-banner-icon"><BookOpen size={26} /></div>
          <div><h3>Need the exact signature?</h3><p>Browse every exported function, interface, type alias, class, and variable.</p></div>
          <Link href="/docs/api-reference" className="button button-secondary">API Reference <ArrowRight size={16} /></Link>
        </div>
      </section>

      <section className="home-container final-cta">
        <div className="final-cta-glow" />
        <div className="final-cta-content">
          <span className="final-icon"><History size={28} /></span>
          <p className="section-eyebrow">MAKE YOUR NEXT EDIT REVERSIBLE</p>
          <h2>Your users make mistakes.<br />Your state doesn’t have to.</h2>
          <p>One small package. A complete history engine.</p>
          <div className="hero-actions">
            <Link href="/docs/getting-started/installation" className="button button-primary">Install Travels <ArrowRight size={17} /></Link>
            <Link href="/docs" className="button button-ghost">Browse documentation</Link>
          </div>
        </div>
      </section>

      <footer className="site-footer">
        <div className="home-container footer-main">
          <div className="footer-brand"><Brand compact /><p>Patch-based state history for<br />modern applications.</p></div>
          <div className="footer-links"><strong>Learn</strong><Link href="/docs/getting-started/quick-start">Quick Start</Link><Link href="/docs/concepts/how-it-works">Core Concepts</Link><Link href="/docs/guides">Guides</Link></div>
          <div className="footer-links"><strong>Integrate</strong><Link href="/docs/integrations/react">React</Link><Link href="/docs/integrations/vue">Vue</Link><Link href="/docs/persistence">Persistence</Link></div>
          <div className="footer-links"><strong>Project</strong><a href={repositoryUrl}>GitHub</a><a href={`${repositoryUrl}/releases`}>Releases</a><Link href="/docs/resources/security">Security</Link></div>
        </div>
        <div className="home-container footer-bottom"><span>© {new Date().getFullYear()} Travels contributors</span><span>MIT licensed · Built with Fumadocs</span></div>
      </footer>
    </main>
  );
}
