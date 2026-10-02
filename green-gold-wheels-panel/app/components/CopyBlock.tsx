'use client';

import { useState } from 'react';

export function CopyBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-xl bg-[#073c32] p-4 pr-24 text-xs leading-relaxed text-[#e9f4ef]">
        <code>{code}</code>
      </pre>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          } catch {
            // Pano engelliyse kullanıcı elle seçebilir — sessizce geç.
          }
        }}
        className="absolute right-3 top-3 inline-flex min-h-[36px] items-center rounded-lg border border-white/20 bg-white/10 px-3 text-xs font-semibold text-white transition hover:bg-white/20"
      >
        {copied ? 'Kopyalandı ✓' : 'Kopyala'}
      </button>
    </div>
  );
}
