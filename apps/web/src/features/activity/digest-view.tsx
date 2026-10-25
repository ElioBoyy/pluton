import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@pluton/server/router";
import { AppLink } from "../../components/app-link.tsx";
import { Card } from "../../components/ui.tsx";

type Digest = inferRouterOutputs<AppRouter>["notifications"]["previewDigest"];

/** The digest as the email shows it: a few sections of linked lines. */
export function DigestView({ digest, title }: { digest: Digest; title?: string }) {
  return (
    <Card>
      {title && <h2 className="mb-1 text-sm font-semibold">{title}</h2>}
      <div className="flex flex-col gap-4">
        {digest.sections.map((s) => (
          <section key={s.title}>
            <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-faint uppercase">{s.title}</p>
            <ul className="flex flex-col gap-1">
              {s.lines.map((l) => (
                <li key={l.text} className="text-sm">
                  {l.link ? (
                    <AppLink href={l.link} className="text-ink hover:text-accent">
                      {l.text}
                    </AppLink>
                  ) : (
                    <span className="text-muted">{l.text}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Card>
  );
}
