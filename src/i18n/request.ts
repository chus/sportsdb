import { getRequestConfig } from "next-intl/server";
import { defaultLocale } from "./config";

// Static locale resolution. Reading cookies() here would force every page to
// render dynamically (Cache-Control: no-store), which kills ISR and is the
// root cause of Google deindexing nearly all pages. Until the routes are
// migrated under /[locale]/, we serve the default locale to everyone.
export default getRequestConfig(async () => ({
  locale: defaultLocale,
  messages: (await import(`./messages/${defaultLocale}.json`)).default,
}));
