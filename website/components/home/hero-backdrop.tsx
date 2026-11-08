/*
 * The floor is drawn in two dimensions with exact perspective instead of a
 * CSS background on a plane tilted in 3D. A tilted plane squeezes horizontal
 * lines below one pixel, and the browser then drops or doubles them, so the
 * rows lose their even perspective rhythm.
 *
 * Ground rows are evenly spaced in depth. Row n projects to
 * HORIZON + DEPTH / (1 + n * STEP), so each gap shrinks in proportion to its
 * distance, and the columns converge on the vanishing point at the center of
 * the horizon. Cells are square on the ground plane.
 */
const WIDTH = 2400;
const HEIGHT = 360;
const HORIZON = 90;
const DEPTH = HEIGHT - HORIZON;
/** Column spacing at the near edge, in view box units. */
const CELL = 90;
/** Depth of one row relative to the distance of the near edge. */
const STEP = 0.134;
/** Rows drawn before they crowd together at the horizon. */
const ROWS = 22;
/** Columns on each side of the center line. */
const LANES = 40;

const rowY = (row: number) => HORIZON + DEPTH / (1 + row * STEP);
const FAR_Y = rowY(ROWS);
const FAR_SCALE = (FAR_Y - HORIZON) / DEPTH;
const CENTER = WIDTH / 2;

const GRID_PATH = [
  ...Array.from({ length: ROWS + 1 }, (_, row) => `M0 ${rowY(row).toFixed(2)}H${WIDTH}`),
  ...Array.from({ length: LANES * 2 + 1 }, (_, lane) => {
    const offset = (lane - LANES) * CELL;
    const farX = (CENTER + offset * FAR_SCALE).toFixed(2);
    return `M${CENTER + offset} ${HEIGHT}L${farX} ${FAR_Y.toFixed(2)}`;
  }),
].join('');

/**
 * A still perspective floor grid behind the hero that recedes to a glowing
 * horizon. Purely decorative.
 */
export function HeroBackdrop() {
  return (
    <div className="hero-backdrop" aria-hidden="true">
      <div className="hero-horizon" />
      <div className="hero-floor">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="xMidYMax slice">
          <defs>
            {/* Fade the far rows out so the grid dissolves into the horizon. */}
            <linearGradient
              id="hero-floor-fade"
              gradientUnits="userSpaceOnUse"
              x1="0"
              y1={FAR_Y.toFixed(2)}
              x2="0"
              y2={HEIGHT}
            >
              <stop offset="0" stopOpacity="0" />
              <stop offset="0.45" stopOpacity="0.75" />
              <stop offset="1" stopOpacity="1" />
            </linearGradient>
          </defs>
          <path d={GRID_PATH} stroke="url(#hero-floor-fade)" />
        </svg>
      </div>
    </div>
  );
}
