import { Fragment, type ReactNode } from "react";
import { AppLink } from "./app-link.tsx";

/**
 * The little Markdown the agent writes: paragraphs, bullet and numbered lists, **bold**, `code`
 * and [links](/plays/…). In-app paths go through the router; other links open in a new tab.
 */
export function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) blocks.push(<p key={blocks.length}>{inline(paragraph.join(" "))}</p>);
    paragraph = [];
  };
  const flushList = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    blocks.push(
      <Tag key={blocks.length} className={list.ordered ? "list-decimal pl-5" : "list-disc pl-5"}>
        {list.items.map((item, i) => (
          <li key={i} className="pl-0.5">
            {inline(item)}
          </li>
        ))}
      </Tag>,
    );
    list = null;
  };

  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    const heading = /^#{1,4}\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      flushParagraph();
      const ordered = Boolean(numbered);
      if (list && list.ordered !== ordered) flushList();
      list ??= { ordered, items: [] };
      list.items.push((bullet ?? numbered)![1]!);
    } else if (heading) {
      flushParagraph();
      flushList();
      blocks.push(
        <p key={blocks.length} className="font-semibold">
          {inline(heading[1]!)}
        </p>,
      );
    } else if (!line.trim()) {
      flushParagraph();
      flushList();
    } else {
      flushList();
      paragraph.push(line.trim());
    }
  }
  flushParagraph();
  flushList();
  return <div className="flex flex-col gap-2 break-words">{blocks}</div>;
}

// Bold first, so a link inside bold is split again from the bold text. URLs may hold one level of parentheses.
const TOKEN = /(\*\*(?:(?!\*\*).)+\*\*|`[^`]+`|\[[^\]]+\]\((?:[^()\s]|\([^()\s]*\))+\))/g;

function inline(text: string): ReactNode {
  return text.split(TOKEN).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) return <strong key={i}>{inline(part.slice(2, -2))}</strong>;
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code key={i} className="rounded bg-raised px-1 py-px text-[0.9em]">
          {part.slice(1, -1)}
        </code>
      );
    }
    const link = /^\[([^\]]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)$/.exec(part);
    if (link) {
      const [, label, href] = link;
      const className = "text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent";
      return href!.startsWith("/") ? (
        <AppLink key={i} href={href!} className={className}>
          {label}
        </AppLink>
      ) : /^https?:\/\//.test(href!) ? (
        <a key={i} href={href} target="_blank" rel="noreferrer" className={className}>
          {label}
        </a>
      ) : (
        <Fragment key={i}>{label}</Fragment>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}
