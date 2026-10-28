import { useEffect } from "react";
import { AppLink } from "../components/app-link.tsx";
import { PageHeader } from "../components/ui.tsx";
import { UpdateNotice } from "../components/release-notices.tsx";
import { useT } from "../i18n/index.ts";
import { markReleasesSeen, useReleases } from "../lib/releases.ts";

/**
 * Read as release notes: a column of reading width, one block per version (newest first, the one
 * running marked), each feature group a heading over its list, set apart by space.
 */
export function WhatsNewPage() {
  const t = useT("settings");
  const releases = useReleases();
  // Opening the page reads the notes: the sidebar stops announcing them.
  useEffect(() => markReleasesSeen(releases[0]?.version), [releases]);
  return (
    <>
      <PageHeader title={t("whatsNew.title")} description={t("whatsNew.description")} />
      <UpdateNotice className="mb-10 max-w-[65ch]" />
      <article className="max-w-[65ch]">
        {releases.map((release, v) => (
          <section key={release.version} className="[&+&]:mt-16">
            <h2 className="flex items-center gap-2.5 text-2xl font-semibold tracking-[-0.02em] tabular-nums">
              v{release.version}
              {v === 0 && <span className="inline-flex h-5 items-center rounded-full bg-accent/15 px-2 text-xs font-medium tracking-normal text-accent">{t("whatsNew.current")}</span>}
            </h2>
            {release.sections.map((section) => (
              <section key={section.id} className="mt-6 [&+&]:mt-9">
                <h3 className="text-lg font-semibold tracking-[-0.01em]">{t(section.title)}</h3>
                <ul className="mt-3 flex flex-col gap-2.5 text-base text-pretty">
                  {section.items.map((item) => (
                    <li key={item.text} className="flex gap-3">
                      <span aria-hidden className="mt-[8.5px] size-[5px] shrink-0 rounded-full bg-muted" />
                      {item.to ? (
                        <AppLink href={item.to} className="decoration-accent/40 underline-offset-[3px] hover:text-accent hover:underline">
                          {t(item.text)}
                        </AppLink>
                      ) : (
                        <span>{t(item.text)}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </section>
        ))}
      </article>
    </>
  );
}
