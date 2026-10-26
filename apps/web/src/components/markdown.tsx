import { CheckSquare, Square } from "@phosphor-icons/react";
import { Fragment, type ReactNode } from "react";
import { AppLink } from "./app-link.tsx";
import { Chart, parseChart } from "./chart.tsx";

/**
 * The Markdown the agent writes, rendered in the app's own style: headings, paragraphs, bullet,
 * numbered and task lists (nested by indentation), tables, quotes, code blocks, ```chart blocks,
 * **bold**, *italic*, ~~strike~~, `code` and [links](/plays/…). In-app paths go through the
 * router; other links open in a new tab. Anything it doesn't recognise stays plain text.
 */
export function Markdown({ text }: { text: string }) {
  return <div className="flex flex-col gap-2.5 break-words">{blocks(text.split("\n"))}</div>;
}

type ListItem = { depth: number; ordered: boolean; task: boolean | null; text: string };

function blocks(lines: string[]): ReactNode[] {
  const out: ReactNode[] = [];
  let paragraph: string[] = [];
  let list: ListItem[] = [];
  const key = () => out.length;

  const flushParagraph = () => {
    if (paragraph.length) out.push(<p key={key()}>{inline(paragraph.join(" "))}</p>);
    paragraph = [];
  };
  const flushList = () => {
    if (list.length) out.push(<List key={key()} items={list} />);
    list = [];
  };
  const flush = () => {
    flushParagraph();
    flushList();
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trimEnd();

    // Fenced code: ```lang … ```. A ```chart block holding valid JSON becomes a chart.
    const fence = /^\s*```\s*([\w-]*)\s*$/.exec(line);
    if (fence) {
      flush();
      const body: string[] = [];
      for (i++; i < lines.length && !/^\s*```\s*$/.test(lines[i]!); i++) body.push(lines[i]!);
      const source = body.join("\n");
      const chart = fence[1] === "chart" ? parseChart(source) : null;
      out.push(
        chart ? (
          <Chart key={key()} spec={chart} />
        ) : (
          <pre key={key()} className="overflow-x-auto bg-raised px-3.5 py-3 font-mono text-[0.85em] leading-relaxed">
            <code>{source}</code>
          </pre>
        ),
      );
      continue;
    }

    // Tables: a row of cells followed by a |---|:--:| separator row.
    if (isRow(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(lines[i + 1]!)) {
      flush();
      const head = cells(line);
      const align = cells(lines[i + 1]!).map((c) => (c.endsWith(":") ? (c.startsWith(":") ? "center" : "right") : "left") as "left" | "right" | "center");
      const rows: string[][] = [];
      for (i += 2; i < lines.length && isRow(lines[i]!); i++) rows.push(cells(lines[i]!));
      i--;
      out.push(<Table key={key()} head={head} align={align} rows={rows} />);
      continue;
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      const size = ["text-lg", "text-base", "text-base", "text-sm"][heading[1]!.length - 1];
      out.push(
        <p key={key()} className={`${size} mt-1 font-semibold tracking-[-0.01em]`}>
          {inline(heading[2]!)}
        </p>,
      );
      continue;
    }

    // Quotes: consecutive "> " lines, rendered as their own Markdown.
    if (/^\s*>/.test(line)) {
      flush();
      const quoted: string[] = [];
      for (; i < lines.length && /^\s*>/.test(lines[i]!); i++) quoted.push(lines[i]!.replace(/^\s*>\s?/, ""));
      i--;
      out.push(
        <blockquote key={key()} className="flex flex-col gap-2 bg-raised px-3.5 py-2.5 text-muted">
          {blocks(quoted)}
        </blockquote>,
      );
      continue;
    }

    // A thematic break only adds space: the app draws no separator lines.
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      flush();
      out.push(<div key={key()} className="h-1" aria-hidden />);
      continue;
    }

    const item = /^(\s*)([-*•+]|\d+[.)])\s+(?:\[([ xX])\]\s+)?(.*)$/.exec(line);
    if (item) {
      flushParagraph();
      list.push({
        depth: Math.floor(item[1]!.replace(/\t/g, "  ").length / 2),
        ordered: /\d/.test(item[2]!),
        task: item[3] === undefined ? null : item[3] !== " ",
        text: item[4]!,
      });
      continue;
    }

    if (!line.trim()) {
      flush();
      continue;
    }

    // A wrapped continuation of the last list item.
    if (list.length && /^\s{2,}\S/.test(line)) {
      list.at(-1)!.text += ` ${line.trim()}`;
      continue;
    }
    flushList();
    paragraph.push(line.trim());
  }
  flush();
  return out;
}

const isRow = (line: string) => /^\s*\|.*\|\s*$/.test(line) || (line.includes("|") && /^\s*[^|]+(\|[^|]*)+$/.test(line) && line.split("|").length > 2);
const cells = (line: string) =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split(/(?<!\\)\|/)
    .map((c) => c.trim().replace(/\\\|/g, "|"));

function Table({ head, align, rows }: { head: string[]; align: Array<"left" | "right" | "center">; rows: string[][] }) {
  // Columns that hold only figures read right-aligned, as in a spreadsheet, unless the author said otherwise.
  const numeric = head.map((_, c) => rows.length > 0 && rows.every((r) => /^[-+]?[\d\s.,]+\s*(%|€|\$|k|m)?$/i.test(r[c] ?? "")));
  const alignOf = (c: number) => (align[c] && align[c] !== "left" ? align[c] : numeric[c] ? "right" : "left");
  return (
    <div className="-mx-1 overflow-x-auto bg-panel">
      <table className="mac-table">
        <thead>
          <tr>
            {head.map((h, c) => (
              <th key={c} style={{ textAlign: alignOf(c) }}>
                {inline(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {head.map((_, c) => (
                // Figures stay on one line; text columns keep a readable width and the table scrolls sideways instead.
                <td key={c} style={{ textAlign: alignOf(c) }} className={numeric[c] ? "whitespace-nowrap tabular-nums" : "min-w-36"}>
                  {inline(r[c] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Lists nest by indentation; a change of kind at the same depth starts a new list. */
function List({ items }: { items: ListItem[] }) {
  const base = Math.min(...items.map((i) => i.depth));
  const groups: Array<{ head: ListItem; children: ListItem[] }> = [];
  for (const item of items) {
    if (item.depth > base && groups.length) groups.at(-1)!.children.push(item);
    else groups.push({ head: item, children: [] });
  }
  const ordered = groups[0]!.head.ordered;
  const tasks = groups.every((g) => g.head.task !== null);
  const Tag = ordered ? "ol" : "ul";
  return (
    <Tag className={tasks ? "flex flex-col gap-1" : ordered ? "flex list-decimal flex-col gap-1 pl-5" : "flex list-disc flex-col gap-1 pl-5"}>
      {groups.map(({ head, children }, i) => (
        <li key={i} className={tasks ? "flex items-start gap-2" : "pl-0.5"}>
          {tasks &&
            (head.task ? (
              <CheckSquare size={17} weight="fill" className="mt-[3px] shrink-0 text-accent" />
            ) : (
              <Square size={17} className="mt-[3px] shrink-0 text-muted" />
            ))}
          <div className="min-w-0">
            <span className={head.task ? "text-muted line-through" : undefined}>{inline(head.text)}</span>
            {children.length > 0 && (
              <div className="mt-1">
                <List items={children} />
              </div>
            )}
          </div>
        </li>
      ))}
    </Tag>
  );
}

// Bold first, so a link inside bold is split again from the bold text. URLs may hold one level of parentheses.
const TOKEN =
  /(\*\*(?:(?!\*\*).)+\*\*|__(?:(?!__).)+__|~~(?:(?!~~).)+~~|`[^`]+`|\[[^\]]+\]\((?:[^()\s]|\([^()\s]*\))+\)|(?<![\w*])\*(?!\s)[^*]+(?<!\s)\*(?![\w*])|(?<![\w_])_(?!\s)[^_]+(?<!\s)_(?![\w_])|https?:\/\/[^\s<>)]+[^\s<>).,;:!?])/g;

const LINK = "text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent";

function inline(text: string): ReactNode {
  return text.split(TOKEN).map((part, i) => {
    if (!part) return null;
    if ((part.startsWith("**") && part.endsWith("**")) || (part.startsWith("__") && part.endsWith("__"))) {
      if (part.length > 4) return <strong key={i}>{inline(part.slice(2, -2))}</strong>;
    }
    if (part.startsWith("~~") && part.endsWith("~~") && part.length > 4) return <s key={i}>{inline(part.slice(2, -2))}</s>;
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code key={i} className="bg-raised px-1 py-px font-mono text-[0.85em]">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (/^[*_]\S/.test(part) && part.endsWith(part[0]!) && part.length > 2) return <em key={i}>{inline(part.slice(1, -1))}</em>;
    if (/^https?:\/\//.test(part)) {
      return (
        <a key={i} href={part} target="_blank" rel="noreferrer" className={LINK}>
          {part.replace(/^https?:\/\/(www\.)?/, "")}
        </a>
      );
    }
    const link = /^\[([^\]]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)$/.exec(part);
    if (link) {
      const [, label, href] = link;
      return href!.startsWith("/") ? (
        <AppLink key={i} href={href!} className={LINK}>
          {inline(label!)}
        </AppLink>
      ) : /^https?:\/\//.test(href!) ? (
        <a key={i} href={href} target="_blank" rel="noreferrer" className={LINK}>
          {inline(label!)}
        </a>
      ) : (
        <Fragment key={i}>{label}</Fragment>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}
