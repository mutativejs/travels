import { assetPath } from '@/lib/assets';

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand" aria-label="Travels">
      <img
        src={assetPath('/travels-logo.webp')}
        alt=""
        width="38"
        height="38"
        className="brand-logo"
      />
      <span className="brand-wordmark">travels</span>
      {!compact && <span className="brand-version">3.0</span>}
    </span>
  );
}
