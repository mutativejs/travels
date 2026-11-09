'use client';

import { Check, Copy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export function CopyButton({
  text,
  label,
  copiedLabel = 'Copied',
  className = '',
}: {
  text: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      className={`copy-button ${className}`}
      onClick={copy}
      aria-label={copied ? copiedLabel : (label ?? 'Copy to clipboard')}
      title={copied ? copiedLabel : (label ?? 'Copy to clipboard')}
    >
      {copied ? <Check size={15} /> : <Copy size={15} />}
      {label && <span>{copied ? copiedLabel : label}</span>}
    </button>
  );
}
