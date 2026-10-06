import { cn } from "@/lib/cn";

const stages = [
  {
    name: "Input",
    detail: "path, Buffer, Uint8Array or ArrayBuffer",
  },
  {
    name: "Render",
    detail: "PDFium, one page at a time behind a process-wide lock",
    tag: "locked",
  },
  {
    name: "Encode",
    detail: "PNG, JPEG or WebP on up to 4 threads per call",
    tag: "parallel",
  },
  {
    name: "Result",
    detail: "ConvertedPage[] with bytes, size and DPI",
  },
];

/** How one convert() call moves a page from PDF bytes to an image buffer. */
export function Pipeline({ className }: { className?: string }) {
  return (
    <ol
      className={cn(
        "not-prose grid gap-px overflow-hidden rounded-lg border border-fd-border bg-fd-border sm:grid-cols-4",
        className,
      )}
    >
      {stages.map((stage, index) => (
        <li
          key={stage.name}
          className="relative flex flex-col gap-2 bg-fd-card p-4"
        >
          <div className="flex h-5 items-center justify-between gap-2">
            <span className="font-mono text-[11px] text-fd-muted-foreground">
              {String(index + 1).padStart(2, "0")}
            </span>
            {stage.tag ? (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider",
                  stage.tag === "locked"
                    ? "bg-fd-muted text-fd-muted-foreground"
                    : "bg-[var(--pr-accent-soft)] text-[var(--pr-accent)]",
                )}
              >
                {stage.tag}
              </span>
            ) : null}
          </div>
          <p className="font-medium text-fd-foreground">{stage.name}</p>
          <p className="text-sm leading-5 text-fd-muted-foreground">
            {stage.detail}
          </p>
        </li>
      ))}
    </ol>
  );
}
