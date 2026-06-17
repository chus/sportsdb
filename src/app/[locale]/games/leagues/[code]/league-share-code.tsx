"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function LeagueShareCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-2 px-4 py-2 bg-surface-2 hover:bg-surface-2 rounded-lg transition-colors"
    >
      <span className="font-mono text-sm font-bold tracking-widest text-ink">
        {code}
      </span>
      {copied ? (
        <Check className="w-4 h-4 text-green-500" />
      ) : (
        <Copy className="w-4 h-4 text-muted" />
      )}
    </button>
  );
}
