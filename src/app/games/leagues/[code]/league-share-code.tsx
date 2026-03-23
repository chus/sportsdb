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
      className="flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors"
    >
      <span className="font-mono text-sm font-bold tracking-widest text-neutral-700">
        {code}
      </span>
      {copied ? (
        <Check className="w-4 h-4 text-green-500" />
      ) : (
        <Copy className="w-4 h-4 text-neutral-500" />
      )}
    </button>
  );
}
