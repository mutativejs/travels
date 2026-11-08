import type { CSSProperties } from 'react';

/** Light trails that race toward the horizon, like patches replaying. */
const comets = [
  { lane: 41, delay: 0, hue: 'blue' },
  { lane: 57, delay: 2.6, hue: 'orange' },
  { lane: 33, delay: 4.1, hue: 'blue' },
  { lane: 66, delay: 5.7, hue: 'blue' },
  { lane: 50, delay: 7.2, hue: 'orange' },
];

/**
 * A perspective floor grid that drifts toward the viewer behind the hero,
 * fading out at a glowing horizon. Purely decorative.
 */
export function HeroBackdrop() {
  return (
    <div className="hero-backdrop" aria-hidden="true">
      <div className="hero-horizon" />
      <div className="hero-floor">
        <div className="hero-floor-plane">
          <div className="hero-floor-grid" />
          {comets.map((comet) => (
            <span
              key={`${comet.lane}-${comet.delay}`}
              className={`hero-comet hero-comet-${comet.hue}`}
              style={{ '--lane': comet.lane, '--delay': `${comet.delay}s` } as CSSProperties}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
