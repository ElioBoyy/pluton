import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://pluton.app",
  devToolbar: { enabled: false },
  i18n: {
    defaultLocale: "en",
    locales: ["en", "fr", "it", "es", "de"],
    routing: { prefixDefaultLocale: false },
  },
});
