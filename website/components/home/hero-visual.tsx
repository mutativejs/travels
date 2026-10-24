import { Braces, Check, History, Redo2, Undo2, Zap } from 'lucide-react';

const entries = [
  { position: '00', label: 'Initial document', meta: 'Baseline', done: true },
  { position: '01', label: 'Add a text layer', meta: '1 patch', done: true },
  { position: '02', label: 'Move selection', meta: '2 patches', done: true },
  { position: '03', label: 'Rename layer', meta: 'Current', active: true },
];

export function HeroVisual() {
  return (
    <div
      className="hero-visual"
      role="img"
      aria-label="A Travels history timeline storing compact patches for each document edit"
    >
      <div className="hero-visual-inner" aria-hidden="true">
        <div className="history-window">
          <div className="history-window-bar">
            <div className="window-dots">
              <span />
              <span />
              <span />
            </div>
            <span className="window-title">canvas.travels</span>
            <span className="live-badge">
              <span /> Live
            </span>
          </div>

          <div className="history-window-body">
            <div className="history-heading">
              <div>
                <span className="history-kicker">TIMELINE</span>
                <h2>Layer edits</h2>
              </div>
              <span className="position-badge">03 / 03</span>
            </div>

            <div className="history-timeline">
              {entries.map((entry) => (
                <div
                  className={`history-entry ${entry.active ? 'is-active' : ''}`}
                  key={entry.position}
                >
                  <div className="history-marker">
                    {entry.active ? <History size={14} /> : <Check size={13} />}
                  </div>
                  <span className="history-position">{entry.position}</span>
                  <span className="history-label">{entry.label}</span>
                  <span className="history-meta">{entry.meta}</span>
                </div>
              ))}
            </div>

            <div className="patch-card">
              <div className="patch-card-heading">
                <span>
                  <Braces size={15} /> Forward patch
                </span>
                <span className="patch-format">JSON Patch</span>
              </div>
              <pre>
                <code>
                  <span className="code-punctuation">{'{'}</span>{'\n'}
                  {'  '}<span className="code-key">"op"</span>: <span className="code-string">"replace"</span>,{'\n'}
                  {'  '}<span className="code-key">"path"</span>: <span className="code-string">"/layers/0/name"</span>,{'\n'}
                  {'  '}<span className="code-key">"value"</span>: <span className="code-string">"Hero"</span>{'\n'}
                  <span className="code-punctuation">{'}'}</span>
                </code>
              </pre>
            </div>
          </div>

          <div className="history-window-footer">
            <span>
              <Undo2 size={15} /> Undo available
            </span>
            <span className="redo-disabled">
              <Redo2 size={15} /> Redo
            </span>
          </div>
        </div>

        <div className="floating-note floating-note-top">
          <span className="floating-icon blue"><Zap size={16} /></span>
          <span><strong>Only the delta</strong><small>not another snapshot</small></span>
        </div>
        <div className="floating-note floating-note-bottom">
          <span className="floating-icon orange"><History size={16} /></span>
          <span><strong>Ready to persist</strong><small>state + patches + cursor</small></span>
        </div>
      </div>
    </div>
  );
}
