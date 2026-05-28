import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

// Locale comes from the URL segment (e.g. /es/teams), parsed by next-intl
// middleware. This is static-friendly: ISR keys can include the locale and
// pages still render at the edge without cookies(), so Cache-Control stays
// cacheable. Falls back to the default locale for routes that haven't been
// moved under [locale]/ yet.
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
