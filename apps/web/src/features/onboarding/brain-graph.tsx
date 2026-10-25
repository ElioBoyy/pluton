import { CornersOut, Minus, Plus } from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D, { type ForceGraphMethods } from "react-force-graph-2d";
import type { BrainItemView } from "@pluton/core";
import { useTheme } from "../../lib/theme.ts";

type Kind = "root" | "hub" | "leaf";
export type GraphNode = { id: string; label: string; kind: Kind; color: string; hub?: string; x?: number; y?: number };
type GraphLink = { source: string; target: string };

// Theme tokens, so the graph follows the light/dark appearance; the canvas resolves them with useCssColor.
const C = {
  pink: "var(--color-cat-pink)",
  purple: "var(--color-cat-purple)",
  orange: "var(--color-cat-orange)",
  yellow: "var(--color-cat-yellow)",
  green: "var(--color-cat-mint)",
  lime: "var(--color-cat-green)",
  blue: "var(--color-cat-blue)",
  root: "var(--color-ink)",
};

type HubDef = { id: string; label: string; color: string; parent?: string; leaves: (items: BrainItemView[]) => string[] };

const of = (items: BrainItemView[], section: string) => items.filter((i) => i.section === section).map((i) => i.data as Record<string, any>);
const one = (items: BrainItemView[], section: string) => of(items, section)[0];

/** Each Brain section becomes a colored cluster around the company. */
const HUBS: HubDef[] = [
  { id: "company", label: "Company", color: C.pink, leaves: (i) => [one(i, "company")?.category, ...(one(i, "company")?.products ?? [])] },
  { id: "market", label: "Market profile", color: C.pink, leaves: (i) => one(i, "icp")?.geographies ?? one(i, "company")?.geographies ?? [] },
  {
    id: "icp",
    label: "ICP",
    color: C.pink,
    parent: "market",
    leaves: (i) => [...(one(i, "icp")?.industries ?? []), sizeRange(one(i, "icp")?.companySizes ?? [])],
  },
  { id: "personas", label: "Buyer personas", color: C.purple, leaves: (i) => of(i, "persona").map((p) => p.title) },
  { id: "competitors", label: "Competitors", color: C.orange, leaves: (i) => of(i, "competitor").map((c) => c.name) },
  { id: "influencers", label: "Influencers & experts", color: C.yellow, leaves: (i) => of(i, "influencer").map((p) => p.name) },
  { id: "voice", label: "Voice", color: C.green, leaves: (i) => [...(one(i, "voice")?.traits ?? []), one(i, "voice")?.language] },
  { id: "keywords", label: "Keywords", color: C.lime, leaves: (i) => of(i, "keyword").map((k) => k.phrase) },
  { id: "pillars", label: "Message pillars", color: C.blue, leaves: (i) => of(i, "message_pillar").map((m) => m.title) },
  { id: "hiring_stack", label: "Hiring & stack", color: C.blue, leaves: () => [] },
  { id: "hiring", label: "Hiring signal", color: C.blue, parent: "hiring_stack", leaves: (i) => one(i, "hiring_signal")?.roles ?? [] },
  {
    id: "stack",
    label: "Stack signal",
    color: C.blue,
    parent: "hiring_stack",
    leaves: (i) => (one(i, "stack_signal")?.technologies ?? []).map((t: { name: string }) => t.name),
  },
];

const SECTION_TO_HUB: Record<string, string> = {
  company: "company",
  icp: "icp",
  persona: "personas",
  competitor: "competitors",
  influencer: "influencers",
  voice: "voice",
  keyword: "keywords",
  message_pillar: "pillars",
  hiring_signal: "hiring",
  stack_signal: "stack",
};

function sizeRange(sizes: string[]) {
  if (sizes.length === 0) return undefined;
  // Bands arrive in ascending order ("11–50", …, "10,001+"): label the overall span.
  const lo = sizes[0]!.split("–")[0]!.replace("+", "");
  const last = sizes.at(-1)!;
  return last.endsWith("+") ? `${lo}+ employees` : `${lo}–${last.split("–")[1]} employees`;
}

export function buildGraph(items: BrainItemView[], rootLabel: string) {
  const nodes: GraphNode[] = [{ id: "root", label: rootLabel, kind: "root", color: C.root }];
  const links: GraphLink[] = [];
  const hubLeaves = new Map<string, string[]>();
  for (const hub of HUBS) {
    const leaves = [...new Set(hub.leaves(items).filter((l): l is string => Boolean(l)))];
    hubLeaves.set(hub.id, leaves);
  }
  // A parent hub exists if it or any child hub has leaves.
  const visible = (hub: HubDef): boolean =>
    hubLeaves.get(hub.id)!.length > 0 || HUBS.some((h) => h.parent === hub.id && visible(h));

  for (const hub of HUBS) {
    if (!visible(hub)) continue;
    const id = `hub:${hub.id}`;
    nodes.push({ id, label: hub.label, kind: "hub", color: hub.color, hub: hub.id });
    links.push({ source: hub.parent ? `hub:${hub.parent}` : "root", target: id });
    for (const leaf of hubLeaves.get(hub.id)!) {
      const leafId = `leaf:${hub.id}:${leaf}`;
      nodes.push({ id: leafId, label: leaf, kind: "leaf", color: hub.color, hub: hub.id });
      links.push({ source: id, target: leafId });
    }
  }
  return { nodes, links, hubLeaves };
}

export const hubForSection = (section: string | null) => (section ? (SECTION_TO_HUB[section] ?? null) : null);
export const hubMeta = (hubId: string) => HUBS.find((h) => h.id === hubId);

const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Canvas can't read CSS variables: resolve `var(--x)` to its value, again whenever the appearance flips. */
function useCssColor() {
  const theme = useTheme();
  // `theme` is a dependency only so the cache is dropped when the appearance flips.
  return useMemo(() => {
    const style = getComputedStyle(document.documentElement);
    const cache = new Map<string, string>();
    return (value: string) => {
      const name = /^var\((--[\w-]+)\)$/.exec(value)?.[1];
      if (!name) return value;
      if (!cache.has(name)) cache.set(name, style.getPropertyValue(name).trim());
      return cache.get(name)!;
    };
  }, [theme]);
}

export function BrainGraph({
  items,
  rootLabel,
  selectedHub,
  onSelectHub,
}: {
  items: BrainItemView[];
  rootLabel: string;
  selectedHub: string | null;
  onSelectHub: (hub: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<ForceGraphMethods<GraphNode, GraphLink> | undefined>(undefined);
  const nodeCache = useRef(new Map<string, GraphNode>());
  const [size, setSize] = useState({ width: 0, height: 0 });
  const color = useCssColor();

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({ width: entry!.contentRect.width, height: entry!.contentRect.height }),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Reuse node objects across rebuilds so existing nodes keep their positions while new ones fly in.
  const data = useMemo(() => {
    const { nodes, links } = buildGraph(items, rootLabel);
    const next = new Map<string, GraphNode>();
    const merged = nodes.map((n) => {
      const prev = nodeCache.current.get(n.id);
      const node = prev ? Object.assign(prev, { label: n.label, color: n.color }) : n;
      next.set(n.id, node);
      return node;
    });
    nodeCache.current = next;
    return { nodes: merged, links };
  }, [items, rootLabel]);

  const mounted = size.width > 0;
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;
    // Spread harder as the Brain grows so leaf labels stop overlapping.
    const crowd = Math.min(data.nodes.length / 40, 2);
    graph.d3Force("charge")?.strength?.(-140 - 120 * crowd);
    const link = graph.d3Force("link");
    link?.distance?.((l: { target: GraphNode }) => (l.target.kind === "leaf" ? 46 + 18 * crowd : 150 + 60 * crowd));
    graph.d3ReheatSimulation();
    // `mounted` matters on reload: the replayed events can all land before the canvas exists.
  }, [data, mounted]);

  return (
    <div ref={containerRef} className="relative h-full w-full">
      {size.width > 0 && (
        <ForceGraph2D<GraphNode, GraphLink>
          ref={graphRef}
          width={size.width}
          height={size.height}
          graphData={data}
          backgroundColor="rgba(0,0,0,0)"
          cooldownTicks={400}
          onEngineStop={() => {
            // Fitting a handful of nodes would blow them up; keep a sane zoom until the graph fills in.
            if (data.nodes.length > 6) graphRef.current?.zoomToFit(600, 80);
            else graphRef.current?.zoom(1.6, 400);
          }}
          linkColor={() => color("var(--color-line)")}
          linkWidth={1}
          enableNodeDrag
          onNodeClick={(node) => node.hub && onSelectHub(node.hub)}
          nodePointerAreaPaint={(node, color, ctx) => {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(node.x!, node.y!, node.kind === "leaf" ? 6 : 10, 0, 2 * Math.PI);
            ctx.fill();
          }}
          nodeCanvasObject={(node, ctx, scale) => {
            const r = node.kind === "root" ? 9 : node.kind === "hub" ? 6.5 : 3.5;
            const dim = selectedHub !== null && node.hub !== selectedHub && node.kind !== "root";
            ctx.globalAlpha = dim ? 0.45 : 1;
            if (node.kind === "hub") {
              ctx.globalAlpha = (dim ? 0.45 : 1) * 0.25;
              ctx.fillStyle = color(node.color);
              ctx.beginPath();
              ctx.arc(node.x!, node.y!, r + 3, 0, 2 * Math.PI);
              ctx.fill();
              ctx.globalAlpha = dim ? 0.45 : 1;
            }
            ctx.fillStyle = color(node.color);
            ctx.beginPath();
            ctx.arc(node.x!, node.y!, r, 0, 2 * Math.PI);
            ctx.fill();

            const fontSize = (node.kind === "leaf" ? 10 : 11.5) / Math.max(scale, 0.6);
            ctx.font = `${node.kind === "leaf" ? 400 : 600} ${fontSize}px ${color("var(--font-sans)")}`;
            ctx.textBaseline = "middle";
            ctx.fillStyle = color(node.kind === "leaf" ? "var(--color-muted)" : "var(--color-ink)");
            ctx.fillText(truncate(node.label, node.kind === "leaf" ? 28 : 40), node.x! + r + 5, node.y!);
            ctx.globalAlpha = 1;
          }}
        />
      )}
      <div className="glass absolute bottom-5 left-5 flex flex-col overflow-hidden rounded-xl">
        {[
          { icon: Plus, label: "Zoom in", run: () => graphRef.current?.zoom(graphRef.current.zoom() * 1.3, 300) },
          { icon: Minus, label: "Zoom out", run: () => graphRef.current?.zoom(graphRef.current.zoom() / 1.3, 300) },
          { icon: CornersOut, label: "Fit", run: () => graphRef.current?.zoomToFit(400, 80) },
        ].map(({ icon: Icon, label, run }) => (
          <button key={label} aria-label={label} onClick={run} className="p-2 text-muted hover:bg-raised hover:text-ink">
            <Icon size={14} />
          </button>
        ))}
      </div>
    </div>
  );
}
