import { CaretRight } from "@phosphor-icons/react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@pluton/server/router";
import { AppLink } from "../../components/app-link.tsx";
import { Group } from "../../components/ui.tsx";

type Digest = inferRouterOutputs<AppRouter>["notifications"]["previewDigest"];

/** The digest as the email shows it: a few sections of linked lines, each section a block of list rows. */
export function DigestView({ digest, title }: { digest: Digest; title?: string }) {
  return (
    <Group className="py-1">
      {title && <h2 className="px-4 pt-3 pb-1 text-sm font-semibold">{title}</h2>}
      {digest.sections.map((s) => (
        <section key={s.title} className="pb-1 [&+&]:mt-2">
          <p className="px-4 pt-2.5 pb-1 text-xs font-medium text-muted">{s.title}</p>
          <ul>
            {s.lines.map((l) => (
              <li key={l.text}>
                {l.link ? (
                  <AppLink href={l.link} className="flex min-h-9 items-center gap-3 px-4 py-2 text-sm transition-colors duration-150 hover:bg-raised">
                    <span className="min-w-0 flex-1 text-pretty">{l.text}</span>
                    <CaretRight size={12} weight="bold" className="shrink-0 text-muted" />
                  </AppLink>
                ) : (
                  <p className="flex min-h-9 items-center px-4 py-2 text-sm text-muted">{l.text}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </Group>
  );
}
