"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

const managers = {
  npm: "npm install pdf-raster",
  pnpm: "pnpm add pdf-raster",
  bun: "bun add pdf-raster",
} as const;

type Manager = keyof typeof managers;

export function InstallCommand() {
  const [manager, setManager] = useState<Manager>("npm");
  const [copied, setCopied] = useState(false);
  const command = managers[manager];

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
    } catch {
      // Clipboard access can be blocked; the command stays selectable.
    }
  }

  return (
    <div className="w-full max-w-md overflow-hidden rounded-lg border border-fd-border bg-fd-card">
      <div
        className="flex border-b border-fd-border px-1"
        role="tablist"
        aria-label="Package manager"
      >
        {(Object.keys(managers) as Manager[]).map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={manager === name}
            onClick={() => setManager(name)}
            className={cn(
              "relative px-3 py-2 font-mono text-xs text-fd-muted-foreground transition-colors hover:text-fd-foreground",
              manager === name &&
                "text-fd-foreground after:absolute after:inset-x-3 after:-bottom-px after:h-px after:bg-[var(--pr-accent)]",
            )}
          >
            {name}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3 py-2.5 pr-2 pl-4">
        <code className="flex-1 select-all truncate font-mono text-sm">
          <span className="text-fd-muted-foreground select-none">$ </span>
          {command}
        </code>
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? "Copied" : "Copy install command"}
          className="inline-flex size-8 items-center justify-center rounded-md text-fd-muted-foreground transition-[color,background-color,transform] hover:bg-fd-accent hover:text-fd-foreground active:scale-95"
        >
          {copied ? (
            <Check className="size-4 text-[var(--pr-accent)]" />
          ) : (
            <Copy className="size-4" />
          )}
        </button>
      </div>
    </div>
  );
}
