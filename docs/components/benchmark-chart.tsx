import {
  type BenchmarkFixture,
  benchmarkFixtures,
  benchmarkMachine,
} from "@/lib/benchmark";
import { cn } from "@/lib/cn";

const OURS = "pdf-raster";

function Fixture({ fixture, max }: { fixture: BenchmarkFixture; max: number }) {
  const fastest = fixture.rows.find((row) => row.library === OURS)?.msPerPage;

  return (
    <figure className="flex flex-col gap-4">
      <figcaption className="font-mono text-xs text-fd-muted-foreground">
        {fixture.label}
      </figcaption>
      <ul className="flex flex-col gap-3">
        {fixture.rows.map((row) => {
          const isOurs = row.library === OURS;
          const ratio =
            row.msPerPage !== null && fastest && !isOurs
              ? `${(row.msPerPage / fastest).toFixed(1)}× slower`
              : null;
          const label =
            row.msPerPage === null
              ? `${row.library}: ${row.note}`
              : `${row.library}: ${row.msPerPage} ms per page${ratio ? `, ${ratio}` : ""}`;

          return (
            <li
              key={row.library}
              className="group grid gap-1.5"
              aria-label={label}
              title={label}
            >
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span
                  className={cn(
                    "truncate",
                    isOurs
                      ? "font-medium text-fd-foreground"
                      : "text-fd-muted-foreground",
                  )}
                >
                  {row.library}
                </span>
                <span className="shrink-0 font-mono text-xs tabular-nums text-fd-muted-foreground">
                  {ratio}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {row.msPerPage === null ? (
                  <span className="font-mono text-xs text-fd-muted-foreground">
                    {row.note}
                  </span>
                ) : (
                  <>
                    <div
                      className={cn(
                        "h-3 min-w-1 rounded-r-[4px] transition-opacity group-hover:opacity-80",
                        isOurs
                          ? "bg-[var(--pr-accent)]"
                          : "bg-[var(--pr-bar-muted)]",
                      )}
                      style={{ width: `${(row.msPerPage / max) * 100}%` }}
                    />
                    <span
                      className={cn(
                        "shrink-0 font-mono text-xs tabular-nums",
                        isOurs
                          ? "font-semibold text-fd-foreground"
                          : "text-fd-muted-foreground",
                      )}
                    >
                      {row.msPerPage.toFixed(1)} ms
                    </span>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}

/** Horizontal bars of milliseconds per page, shorter is faster. */
export function BenchmarkChart({ className }: { className?: string }) {
  const max = Math.max(
    ...benchmarkFixtures.flatMap((fixture) =>
      fixture.rows.map((row) => row.msPerPage ?? 0),
    ),
  );

  return (
    <div className={cn("not-prose flex flex-col gap-8", className)}>
      <div className="grid gap-8 md:grid-cols-2 md:gap-10">
        {benchmarkFixtures.map((fixture) => (
          <Fixture key={fixture.id} fixture={fixture} max={max} />
        ))}
      </div>
      <p className="text-xs leading-5 text-fd-muted-foreground">
        Milliseconds per page at 300 DPI to PNG, one conversion at a time, on{" "}
        {benchmarkMachine}. Shorter is faster. Both charts share one scale.
      </p>
    </div>
  );
}
