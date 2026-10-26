import react from "@astrojs/react";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://pluton.app",
  devToolbar: { enabled: false },
  integrations: [react()],
  i18n: {
    defaultLocale: "en",
    locales: ["en", "fr", "it", "es", "de"],
    routing: { prefixDefaultLocale: false },
  },
});
