import { ArrowSquareOut } from "@phosphor-icons/react";
import { useT } from "../../i18n/index.ts";
import { cn } from "../../lib/cn.ts";

/** A lead's evidence item, as the server sends it. */
type Evidence = { label: string; url?: string };

/** The first piece of evidence that has a source, as a link: the proof behind the signal, one click away. */
export function ProofLink({ evidence, className }: { evidence: Evidence[]; className?: string }) {
  const t = useT("leads");
  const proof = evidence.find((e) => e.url);
  if (!proof) return null;
  return (
    <a
      href={proof.url}
      target="_blank"
      rel="noreferrer"
      title={proof.label}
      onClick={(e) => e.stopPropagation()}
      className={cn("inline-flex items-center gap-1 text-accent hover:underline", className)}
    >
      {t("row.proof")} <ArrowSquareOut size={11} />
    </a>
  );
}
