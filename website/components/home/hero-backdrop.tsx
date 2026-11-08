/**
 * A still perspective floor grid behind the hero that recedes to a glowing
 * horizon. Purely decorative.
 */
export function HeroBackdrop() {
  return (
    <div className="hero-backdrop" aria-hidden="true">
      <div className="hero-horizon" />
      <div className="hero-floor">
        <div className="hero-floor-plane" />
      </div>
    </div>
  );
}
