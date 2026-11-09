import Link from 'next/link';
import type { CSSProperties } from 'react';
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
import { BackToTop } from '@/components/home/back-to-top';
import { CopyButton } from '@/components/home/copy-button';
import { CodeWalkthrough } from '@/components/home/code-walkthrough';
import { HeroBackdrop } from '@/components/home/hero-backdrop';
import { PatchPlayground } from '@/components/home/patch-playground';
import { RevealEffects } from '@/components/home/reveal-effects';
import { TiltEffects } from '@/components/home/tilt-effects';
import { TimeOrbit } from '@/components/home/time-orbit';
import { TimeStack } from '@/components/home/time-stack';
import { homeContent } from '@/lib/home-content';
import { localePath, type Locale } from '@/lib/locale';
import { repositoryUrl } from '@/lib/shared';

const installCommand = 'pnpm add travels mutative';
const featureIcons = [Braces, Database, Blocks, ShieldCheck] as const;
const docIcons = [Zap, Workflow, Code2] as const;
const useCaseIcons = [PenTool, LayoutTemplate, FileText] as const;

export function HomePage({ locale }: { locale: Locale }) {
  const copy = homeContent[locale];
  const isZh = locale === 'zh';
  const link = (path: string) => localePath(locale, path);

  return (
    <div className="home-page">
      <TiltEffects />
      <RevealEffects />
      <section className="home-hero home-container">
        <HeroBackdrop />
        <div className="hero-copy">
          <Link href={copy.release.href} className="release-pill">
            <span className="release-dot" />
            {copy.release.text}
            <span className="release-divider" />
            {copy.release.cta}
            <ArrowRight size={13} />
          </Link>
          <p className="hero-eyebrow">{copy.hero.eyebrow}</p>
          <h1>
            {copy.hero.line1}
            <span>{copy.hero.line2}</span>
          </h1>
          <p className="hero-description">{copy.hero.description}</p>
          <div className="hero-actions">
            <Link href={link('/docs/getting-started/quick-start')} className="button button-primary">
              {copy.hero.primary} <ArrowRight size={17} />
            </Link>
            <a href={repositoryUrl} className="button button-secondary">
              <PackageOpen size={17} /> {copy.hero.secondary}
            </a>
          </div>
          <div className="install-command">
            <span className="install-prompt">$</span>
            <code>{installCommand}</code>
            <CopyButton
              text={installCommand}
              label={isZh ? '复制' : 'Copy'}
              copiedLabel={isZh ? '已复制' : 'Copied'}
            />
          </div>
          <p className="framework-line">
            <span>{isZh ? '适用于' : 'Works with'}</span> {copy.hero.framework.replace(/^(适用于|Works with)\s*/, '')}
          </p>
        </div>
        <TimeStack locale={locale} />
      </section>

      <section className="proof-strip" aria-label={copy.proofLabel}>
        <div className="home-container proof-grid">
          {copy.proof.map((item, index) => {
            const Icon = [Braces, Box, Code2, Database][index];
            return (
              <div key={item.strong}>
                <Icon size={18} />
                <span>
                  <strong>{item.strong}</strong> {item.text}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="home-section home-container">
        <div className="section-heading centered" data-reveal>
          <p className="section-eyebrow">{copy.features.eyebrow}</p>
          <h2>{copy.features.title}</h2>
          <p>{copy.features.text}</p>
        </div>
        <div className="feature-grid" data-reveal="stagger">
          {copy.features.items.map((feature, index) => {
            const Icon = featureIcons[index];
            return (
              <Link href={feature.href} className="feature-card" data-tilt key={feature.title}>
                <span className="feature-icon">
                  <Icon size={21} />
                </span>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
                <span className="card-link">
                  {feature.cta} <ArrowRight size={14} />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="playground-section" id="playground" aria-labelledby="playground-title">
        <div className="home-container">
          <div className="section-heading split-heading" data-reveal>
            <div>
              <p className="section-eyebrow">{copy.playground.eyebrow}</p>
              <h2 id="playground-title">{copy.playground.title}</h2>
            </div>
            <p>{copy.playground.text}</p>
          </div>
          <div data-reveal>
            <PatchPlayground locale={locale} />
          </div>
        </div>
      </section>

      <section className="code-section">
        <div className="home-container code-section-grid" data-reveal="stagger">
          <div className="code-section-copy">
            <p className="section-eyebrow">{copy.code.eyebrow}</p>
            <h2>
              {copy.code.line1}
              <br />
              {copy.code.line2}
            </h2>
            <p>{copy.code.text}</p>
            <ul className="check-list">
              {copy.code.checks.map((item) => (
                <li key={item}>
                  <Check size={16} /> {item}
                </li>
              ))}
            </ul>
            <Link href={copy.code.href} className="text-link">
              {copy.code.link} <ArrowRight size={15} />
            </Link>
          </div>
          <CodeWalkthrough locale={locale} />
        </div>
      </section>

      <section className="home-section home-container">
        <div className="section-heading split-heading" data-reveal>
          <div>
            <p className="section-eyebrow">{copy.ownership.eyebrow}</p>
            <h2>{copy.ownership.title}</h2>
          </div>
          <p>{copy.ownership.text}</p>
        </div>
        <div className="ownership-grid" data-reveal="stagger">
          {copy.ownership.cards.map((card, index) => (
            <div
              className={`ownership-card ${index === 0 ? 'ownership-blue' : 'ownership-orange'}`}
              key={card.title}
            >
              <div className="ownership-top">
                {index === 0 ? <Layers size={24} /> : <Network size={24} />}
                <span>{card.tag}</span>
              </div>
              <h3>{card.title}</h3>
              <p>{card.text}</p>
              <div className="ownership-flow">
                <p className="sr-only">{card.sr}</p>
                <span className="flow-node" aria-hidden="true">
                  {card.nodes[0]}
                </span>
                <span className="flow-link" aria-hidden="true">
                  <i />
                </span>
                <span className="flow-node is-core" aria-hidden="true">
                  {card.nodes[1]}
                </span>
                <span
                  className="flow-link"
                  aria-hidden="true"
                  style={{ '--flow-delay': '1.3s' } as CSSProperties}
                >
                  <i />
                </span>
                <span className="flow-node" aria-hidden="true">
                  {card.nodes[2]}
                </span>
                <span
                  className={`flow-return${index === 0 ? ' flow-return-short' : ''}`}
                  aria-hidden="true"
                >
                  <span
                    className="flow-link is-reverse"
                    style={{ '--flow-delay': '0.65s' } as CSSProperties}
                  >
                    <i />
                  </span>
                  <span className="flow-caption">{card.caption}</span>
                </span>
              </div>
              <Link href={card.href} className="card-link">
                {card.link} <ArrowRight size={14} />
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="use-cases-section">
        <div className="home-container">
          <div className="section-heading centered light-heading" data-reveal>
            <p className="section-eyebrow">{copy.useCases.eyebrow}</p>
            <h2>{copy.useCases.title}</h2>
            <p>{copy.useCases.text}</p>
          </div>
          <div className="use-case-grid" data-reveal="stagger">
            {copy.useCases.items.map((item, index) => {
              const Icon = useCaseIcons[index];
              return (
                <div className="use-case-card" data-tilt="5" key={item.title}>
                  <span className="use-case-number">0{index + 1}</span>
                  <Icon size={27} />
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                  <span className="use-case-tag">{item.tag}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="home-section home-container docs-section">
        <div className="section-heading centered" data-reveal>
          <p className="section-eyebrow">{copy.docs.eyebrow}</p>
          <h2>{copy.docs.title}</h2>
          <p>{copy.docs.text}</p>
        </div>
        <div className="docs-card-grid" data-reveal="stagger">
          {copy.docs.cards.map((item, index) => {
            const Icon = docIcons[index];
            return (
              <Link href={item.href} className="docs-card" data-tilt key={item.title}>
                <div className="docs-card-icon">
                  <Icon size={22} />
                </div>
                <span className="docs-card-eyebrow">{item.eyebrow}</span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
                <span className="card-link">
                  {item.cta} <ArrowUpRight size={15} />
                </span>
              </Link>
            );
          })}
        </div>
        <div className="api-banner" data-reveal>
          <div className="api-banner-icon">
            <BookOpen size={26} />
          </div>
          <div>
            <h3>{copy.api.title}</h3>
            <p>{copy.api.text}</p>
          </div>
          <Link href={link('/docs/api-reference')} className="button button-secondary">
            {copy.api.cta} <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <section className="home-container final-cta">
        <div className="final-cta-glow" />
        <div className="final-cta-content" data-reveal>
          <TimeOrbit locale={locale} />
          <p className="section-eyebrow">{copy.final.eyebrow}</p>
          <h2>
            {copy.final.line1}
            <br />
            {copy.final.line2}
          </h2>
          <p>{copy.final.text}</p>
          <div className="hero-actions">
            <Link href={copy.final.primaryHref} className="button button-primary">
              {copy.final.primary} <ArrowRight size={17} />
            </Link>
            <Link href={copy.final.secondaryHref} className="button button-ghost">
              {copy.final.secondary}
            </Link>
          </div>
        </div>
      </section>

      <footer className="site-footer">
        <div className="home-container footer-main">
          <div className="footer-brand">
            <Brand compact />
            <p>{copy.footer.tagline}</p>
          </div>
          <div className="footer-links">
            <strong>{copy.footer.learn}</strong>
            <Link href={link('/docs/getting-started/quick-start')}>{copy.footer.quickStart}</Link>
            <Link href={link('/docs/concepts/how-it-works')}>{copy.footer.concepts}</Link>
            <Link href={link('/docs/guides')}>{copy.footer.guides}</Link>
            <Link href={`${link('/')}#playground`}>{copy.footer.playground}</Link>
          </div>
          <div className="footer-links">
            <strong>{copy.footer.integrate}</strong>
            <Link href={link('/docs/integrations/react')}>React</Link>
            <Link href={link('/docs/integrations/vue')}>Vue</Link>
            <Link href={link('/docs/persistence')}>{copy.footer.persistence}</Link>
          </div>
          <div className="footer-links">
            <strong>{copy.footer.project}</strong>
            <a href={repositoryUrl}>GitHub</a>
            <a href="https://www.npmjs.com/package/travels">npm</a>
            <a href={`${repositoryUrl}/releases`}>{copy.footer.releases}</a>
            <Link href={link('/docs/resources/security')}>{copy.footer.security}</Link>
          </div>
        </div>
        <div className="home-container footer-bottom">
          <span>
            © {new Date().getFullYear()} Travels {isZh ? '贡献者' : 'contributors'}
          </span>
          <span className="footer-bottom-end">
            <span>{copy.footer.license}</span>
            <BackToTop label={copy.footer.backToTop} />
          </span>
        </div>
      </footer>
    </div>
  );
}
