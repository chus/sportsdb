import { defineRouting } from "next-intl/routing";
import { defaultLocale, locales } from "./config";

export const routing = defineRouting({
  locales: [...locales],
  defaultLocale,
  // The default locale (en) is served without a prefix at the root path.
  // Other locales get a /es/, /fr/... prefix. Preserves existing en URLs so
  // we don't have to redirect every external link.
  localePrefix: "as-needed",
  localeDetection: false,
});
