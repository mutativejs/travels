'use client';

import { History } from 'lucide-react';
import { useState } from 'react';
import './time-orbit.css';

/**
 * Three patch orbits around the history icon, drawn in CSS 3D. Clicking it
 * winds everything backwards once, like an undo for time itself.
 */
export function TimeOrbit() {
  const [rewinds, setRewinds] = useState(0);

  return (
    <button
      type="button"
      className="time-orbit"
      aria-label="Rewind the orbit animation"
      title="Rewind"
      onClick={() => setRewinds((count) => count + 1)}
    >
      <span
        key={rewinds}
        className={`orbit-scene${rewinds > 0 ? ' is-rewinding' : ''}`}
        aria-hidden="true"
      >
        <span className="orbit-ring orbit-ring-1">
          <i />
        </span>
        <span className="orbit-ring orbit-ring-2">
          <i />
        </span>
        <span className="orbit-ring orbit-ring-3">
          <i />
        </span>
        <span className="orbit-core">
          <History size={26} />
        </span>
      </span>
    </button>
  );
}
