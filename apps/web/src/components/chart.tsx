import { useState } from "react";
import { cn } from "../lib/cn.ts";

/**
 * Charts the agent can draw in a reply, from a ```chart block holding JSON:
 *   { "type": "bar" | "line" | "pie", "title"?, "unit"?,
 *     "data"?: [{ "label", "value" }],                       one series
 *     "labels"?: [...], "series"?: [{ "name", "values" }] }   several series
 * Series take the --color-chart-N tokens in a fixed order; text always stays in ink colours, every
 * mark has a hover tooltip, and two or more series get a legend.
 */
export type ChartSpec = {
  type: "bar" | "line" | "pie";
  title?: string;
  unit?: string;
  data?: Array<{ label: string; value: number }>;
  labels?: string[];
  series?: Array<{ name: string; values: number[] }>;
};

const COLORS = [1, 2, 3, 4, 5, 6].map((n) => `var(--color-chart-${n})`);

export function parseChart(source: string): ChartSpec | null {
  try {
    const spec = JSON.parse(source) as ChartSpec;
    if (!["bar", "line", "pie"].includes(spec.type)) return null;
    if (spec.data?.length || (spec.labels?.length && spec.series?.length)) return spec;
  } catch {
    // Not valid JSON: the caller shows the block as code.
  }
  return null;
}

export function Chart({ spec }: { spec: ChartSpec }) {
  const labels = spec.labels ?? spec.data?.map((d) => d.label) ?? [];
  const series = spec.series ?? [{ name: spec.title ?? "", values: spec.data?.map((d) => d.value) ?? [] }];
  const fmt = (v: number) => `${Number.isInteger(v) ? v.toLocaleString() : v.toLocaleString(undefined, { maximumFractionDigits: 2 })}${spec.unit ?? ""}`;
  return (
    <figure className="my-1 rounded-xl bg-panel px-4 py-3.5 shadow-card">
      {spec.title && <figcaption className="mb-3 text-sm font-semibold">{spec.title}</figcaption>}
      {spec.type === "pie" ? (
        <Donut labels={labels} values={series[0]!.values} fmt={fmt} />
      ) : spec.type === "line" ? (
        <Line labels={labels} series={series} fmt={fmt} />
      ) : series.length === 1 ? (
        <Bars labels={labels} values={series[0]!.values} fmt={fmt} />
      ) : (
        <GroupedBars labels={labels} series={series} fmt={fmt} />
      )}
      {series.length > 1 && <Legend names={series.map((s) => s.name)} />}
    </figure>
  );
}

function Legend({ names }: { names: string[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      {names.map((n, i) => (
        <span key={n} className="flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
          {n}
        </span>
      ))}
    </div>
  );
}

/** One series: horizontal bars, label left and value right, so long labels never collide. */
function Bars({ labels, values, fmt }: { labels: string[]; values: number[]; fmt: (v: number) => string }) {
  const max = Math.max(1, ...values.map(Math.abs));
  return (
    <div className="flex flex-col gap-2">
      {labels.map((label, i) => (
        <div key={i} className="group grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 text-sm" title={`${label}: ${fmt(values[i] ?? 0)}`}>
          <span className="truncate text-muted">{label}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-control">
            <span
              className="block h-full rounded-full transition-[filter] group-hover:brightness-110"
              style={{ width: `${(Math.abs(values[i] ?? 0) / max) * 100}%`, background: COLORS[0] }}
            />
          </span>
          <span className="text-right tabular-nums">{fmt(values[i] ?? 0)}</span>
        </div>
      ))}
    </div>
  );
}

function GroupedBars({ labels, series, fmt }: { labels: string[]; series: ChartSpec["series"] & object; fmt: (v: number) => string }) {
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  return (
    <div className="flex h-40 items-end gap-3">
      {labels.map((label, i) => (
        <div key={i} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-1.5">
          <div className="flex min-h-0 flex-1 items-end justify-center gap-[2px]">
            {series.map((s, k) => (
              <span
                key={k}
                title={`${label} · ${s.name}: ${fmt(s.values[i] ?? 0)}`}
                className="w-full max-w-4 rounded-t-[4px] hover:brightness-110"
                style={{ height: `${((s.values[i] ?? 0) / max) * 100}%`, background: COLORS[k % COLORS.length] }}
              />
            ))}
          </div>
          <span className="truncate text-center text-xs text-muted">{label}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * A smooth curve through every point (monotone cubic, Fritsch–Carlson): it bends
 * between points but never swings above or below them, so peaks stay honest.
 */
function smoothPath(pts: [number, number][]): string {
  if (pts.length < 3) return pts.map(([px, py], i) => `${i ? "L" : "M"}${px},${py}`).join("");
  const n = pts.length;
  const slope = pts.slice(1).map(([px, py], i) => (py - pts[i]![1]) / (px - pts[i]![0]));
  const tan = pts.map((_, i) =>
    i === 0 ? slope[0]! : i === n - 1 ? slope[n - 2]! : slope[i - 1]! * slope[i]! <= 0 ? 0 : (slope[i - 1]! + slope[i]!) / 2,
  );
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      tan[i] = tan[i + 1] = 0;
      continue;
    }
    const a = tan[i]! / slope[i]!;
    const b = tan[i + 1]! / slope[i]!;
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      tan[i] = t * a * slope[i]!;
      tan[i + 1] = t * b * slope[i]!;
    }
  }
  let d = `M${pts[0]![0]},${pts[0]![1]}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pts[i]!;
    const [x1, y1] = pts[i + 1]!;
    const dx = (x1 - x0) / 3;
    d += `C${x0 + dx},${y0 + tan[i]! * dx},${x1 - dx},${y1 - tan[i + 1]! * dx},${x1},${y1}`;
  }
  return d;
}

/** Lines with a crosshair: hovering a column shows every series' value there. */
function Line({ labels, series, fmt }: { labels: string[]; series: ChartSpec["series"] & object; fmt: (v: number) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  const [w, h, pad] = [600, 160, 6];
  const all = series.flatMap((s) => s.values);
  const [min, max] = [Math.min(0, ...all), Math.max(1, ...all)];
  const x = (i: number) => pad + (i * (w - pad * 2)) / Math.max(1, labels.length - 1);
  const y = (v: number) => h - pad - ((v - min) / (max - min)) * (h - pad * 2);
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-40 w-full overflow-visible" preserveAspectRatio="none" onMouseLeave={() => setHover(null)}>
        <line x1={0} x2={w} y1={y(min)} y2={y(min)} stroke="var(--color-line)" vectorEffect="non-scaling-stroke" />
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={0} y2={h} stroke="var(--color-line-strong)" vectorEffect="non-scaling-stroke" />}
        {series.map((s, k) => (
          <path
            key={k}
            fill="none"
            stroke={COLORS[k % COLORS.length]}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            d={smoothPath(s.values.map((v, i) => [x(i), y(v)]))}
          />
        ))}
        {labels.map((_, i) => (
          <rect key={i} x={x(i) - w / labels.length / 2} y={0} width={w / labels.length} height={h} fill="transparent" onMouseEnter={() => setHover(i)} />
        ))}
      </svg>
      {hover !== null && (
        <div
          className="popover pointer-events-none absolute top-0 z-10 min-w-32 -translate-x-1/2 rounded-lg px-2.5 py-1.5 text-xs"
          style={{ left: `${(x(hover) / w) * 100}%` }}
        >
          <p className="mb-0.5 font-medium">{labels[hover]}</p>
          {series.map((s, k) => (
            <p key={k} className="flex items-center gap-1.5 text-muted">
              <span className="size-1.5 rounded-full" style={{ background: COLORS[k % COLORS.length] }} />
              {series.length > 1 && <span className="flex-1">{s.name}</span>}
              <span className="text-ink tabular-nums">{fmt(s.values[hover] ?? 0)}</span>
            </p>
          ))}
        </div>
      )}
      <div className="mt-1.5 flex justify-between text-xs text-muted">
        <span>{labels[0]}</span>
        <span>{labels.at(-1)}</span>
      </div>
    </div>
  );
}

/** Shares of a whole: a donut with a 2px gap between slices and a labelled legend beside it. */
function Donut({ labels, values, fmt }: { labels: string[]; values: number[]; fmt: (v: number) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  const total = values.reduce((a, b) => a + Math.max(0, b), 0) || 1;
  const r = 42;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg viewBox="0 0 100 100" className="size-32 -rotate-90">
        {values.map((v, i) => {
          const len = (Math.max(0, v) / total) * c;
          const dash = `${Math.max(0, len - 2)} ${c}`;
          const el = (
            <circle
              key={i}
              cx={50}
              cy={50}
              r={r}
              fill="none"
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={hover === i ? 14 : 12}
              strokeDasharray={dash}
              strokeDashoffset={-offset}
              className="transition-[stroke-width] duration-150"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              <title>{`${labels[i]}: ${fmt(v)} (${Math.round((v / total) * 100)}%)`}</title>
            </circle>
          );
          offset += len;
          return el;
        })}
      </svg>
      <ul className="flex min-w-40 flex-1 flex-col gap-1.5 text-sm">
        {labels.map((label, i) => (
          <li key={i} className={cn("flex items-center gap-2", hover !== null && hover !== i && "opacity-50")}>
            <span className="size-2 shrink-0 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
            <span className="min-w-0 flex-1 truncate">{label}</span>
            <span className="text-muted tabular-nums">{fmt(values[i] ?? 0)}</span>
            <span className="w-10 text-right text-xs text-muted tabular-nums">{Math.round(((values[i] ?? 0) / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
