'use client';

import { Play, RotateCcw } from 'lucide-react';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createTravels } from 'travels';
import { CopyButton } from './copy-button';
import { describePatch } from './demo-utils';

type Token = readonly [className: string | null, text: string];

const LINES: readonly (readonly Token[])[] = [
  [['code-keyword', 'import'], [null, ' { createTravels } '], ['code-keyword', 'from'], [null, ' '], ['code-string', "'travels'"], [null, ';']],
  [],
  [['code-keyword', 'const'], [null, ' travels = '], ['code-function', 'createTravels'], [null, '({']],
  [[null, '  document: { title: '], ['code-string', "'Untitled'"], [null, ' }']],
  [[null, '});']],
  [],
  [[null, 'travels.'], ['code-function', 'setState'], [null, '((draft) '], ['code-keyword', '=>'], [null, ' {']],
  [[null, '  draft.document.title = '], ['code-string', "'Hello, Travels'"], [null, ';']],
  [[null, '});']],
  [],
  [[null, 'travels.'], ['code-function', 'back'], [null, '();    '], ['code-comment', '// undo']],
  [[null, 'travels.'], ['code-function', 'forward'], [null, '(); '], ['code-comment', '// redo']],
];

const CODE = LINES.map((line) => line.map(([, text]) => text).join('')).join('\n');

const STEPS = [
  { label: 'createTravels()', chip: 'create', lines: [0, 4] },
  { label: 'setState()', chip: 'setState', lines: [6, 8] },
  { label: 'back()', chip: 'back', lines: [10, 10] },
  { label: 'forward()', chip: 'forward', lines: [11, 11] },
] as const;

const LAST_STEP = STEPS.length - 1;

/** Replay the snippet up to `step` on a fresh timeline and read it back. */
function runTo(step: number) {
  const travels = createTravels({ document: { title: 'Untitled' } });
  if (step >= 1) {
    travels.setState((draft) => {
      draft.document.title = 'Hello, Travels';
    });
  }
  if (step >= 2) travels.back();
  if (step >= 3) travels.forward();
  const { patches, inversePatches } = travels.getPatches();
  return {
    title: travels.getState().document.title,
    position: travels.getPosition(),
    canBack: travels.canBack(),
    canForward: travels.canForward(),
    applied: step === 0 ? null : step === 2 ? inversePatches[0]?.[0] : patches[0]?.[0],
  };
}

function lineStatus(index: number, step: number) {
  const owner = STEPS.findIndex(({ lines: [first, last] }) => index >= first && index <= last);
  if (owner === -1) return 'is-idle';
  if (owner === step) return 'is-active';
  return owner < step ? 'is-done' : 'is-pending';
}

function Bool({ value }: { value: boolean }) {
  return <span className={value ? 'cw-true' : 'cw-false'}>{String(value)}</span>;
}

function Row({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="cw-row">
      <dt>{name}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function CodeWalkthrough() {
  const [step, setStep] = useState(1);
  const [announcement, setAnnouncement] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const touched = useRef(false);
  const result = useMemo(() => runTo(step), [step]);

  const goTo = useCallback((next: number, fromUser = true) => {
    if (fromUser) touched.current = true;
    setStep(next);
    const outcome = runTo(next);
    setAnnouncement(
      `Ran ${STEPS[next].label}. Position ${outcome.position}, title ${outcome.title}.`
    );
  }, []);

  // Play the snippet once, step by step, the first time it scrolls into view.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timers: number[] = [];
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || touched.current) return;
        observer.disconnect();
        STEPS.forEach((_, index) => {
          timers.push(
            window.setTimeout(() => {
              if (!touched.current) setStep(index);
            }, 400 + index * 1300)
          );
        });
      },
      { threshold: 0.6 }
    );
    observer.observe(root);
    return () => {
      observer.disconnect();
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, []);

  return (
    <div ref={rootRef} className="code-window cw-window" role="group" aria-label="Quick start walkthrough">
      <div className="code-window-bar">
        <div className="window-dots">
          <span />
          <span />
          <span />
        </div>
        <span>quick-start.ts</span>
        <CopyButton text={CODE} />
      </div>

      <pre className="cw-code" aria-label="Quick start code">
        <code>
          {LINES.map((line, index) => (
            <span key={index} className={`cw-line ${lineStatus(index, step)}`}>
              <span className="cw-gutter" aria-hidden="true">
                {index + 1}
              </span>
              {line.map(([className, text], tokenIndex) => (
                <Fragment key={tokenIndex}>
                  {className ? <span className={className}>{text}</span> : text}
                </Fragment>
              ))}
            </span>
          ))}
        </code>
      </pre>

      <div className="cw-controls">
        <button
          type="button"
          className="cw-run"
          onClick={() => goTo(step === LAST_STEP ? 0 : step + 1)}
        >
          {step === LAST_STEP ? <RotateCcw size={15} /> : <Play size={15} />}
          {step === LAST_STEP ? 'Run again' : 'Run next step'}
        </button>
        <div className="cw-steps" role="group" aria-label="Steps">
          {STEPS.map((entry, index) => (
            <button
              key={entry.label}
              type="button"
              className={`cw-chip${index === step ? ' is-active' : index < step ? ' is-done' : ''}`}
              aria-pressed={index === step}
              aria-label={`Run to step ${index + 1}: ${entry.label}`}
              onClick={() => goTo(index)}
            >
              <span className="cw-chip-index">{index + 1}</span>
              {entry.chip}
            </button>
          ))}
        </div>
      </div>

      <dl className="cw-result" key={step}>
        <Row name="getState()">
          <span className="code-punctuation">{'{ '}</span>document: <span className="code-punctuation">{'{ '}</span>
          title: <span className="code-string">&apos;{result.title}&apos;</span>
          <span className="code-punctuation">{' } }'}</span>
        </Row>
        <Row name="getPosition()">
          <span className="cw-number">{result.position}</span>
        </Row>
        <Row name="canBack() / canForward()">
          <Bool value={result.canBack} /> <span className="code-punctuation">/</span>{' '}
          <Bool value={result.canForward} />
        </Row>
        <Row name={step === 2 ? 'applied inverse patch' : 'applied patch'}>
          {result.applied ? (
            <span className="cw-patch">{describePatch(result.applied)}</span>
          ) : (
            <span className="code-comment">none yet: position 0 is the baseline</span>
          )}
        </Row>
      </dl>

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}
