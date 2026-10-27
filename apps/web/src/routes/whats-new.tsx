import { useEffect } from "react";
import { AppLink } from "../components/app-link.tsx";
import { PageHeader } from "../components/ui.tsx";
import { UpdateNotice } from "../components/release-notices.tsx";
import { useT } from "../i18n/index.ts";
import { markReleasesSeen, useReleases } from "../lib/releases.ts";

/** Read as release notes: a column of reading width, each release a heading over its list, set apart by space. */
export function WhatsNewPage() {
  const t = useT("settings");
  const releases = useReleases();
  // Opening the page reads the notes: the sidebar stops announcing them.
  useEffect(() => markReleasesSeen(releases[0]?.id), [releases]);
  return (
    <>
      <PageHeader title={t("whatsNew.title")} description={t("whatsNew.description")} />
      <UpdateNotice className="mb-8 max-w-[65ch]" />
      <article className="max-w-[65ch]">
        {releases.map((release, i) => (
          <section key={release.id} className="[&+&]:mt-10">
            <h2 className="flex items-center gap-2 text-lg font-semibold tracking-[-0.01em]">
              {t(release.title)}
              {i === 0 && <span className="inline-flex h-5 items-center rounded-full bg-accent/15 px-2 text-xs font-medium tracking-normal text-accent">{t("whatsNew.latest")}</span>}
            </h2>
            <ul className="mt-3 flex flex-col gap-2.5 text-base text-pretty">
              {release.items.map((item) => (
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
      </article>
    </>
  );
}
