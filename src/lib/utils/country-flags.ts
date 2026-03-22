/**
 * Country flag utilities — emoji flags and CDN image URLs.
 */

const COUNTRY_TO_CODE: Record<string, string> = {
  Afghanistan: "af",
  Albania: "al",
  Algeria: "dz",
  Argentina: "ar",
  Armenia: "am",
  Australia: "au",
  Austria: "at",
  Azerbaijan: "az",
  Belgium: "be",
  Bolivia: "bo",
  "Bosnia and Herzegovina": "ba",
  Brazil: "br",
  Bulgaria: "bg",
  Cameroon: "cm",
  Canada: "ca",
  Chile: "cl",
  China: "cn",
  Colombia: "co",
  "Costa Rica": "cr",
  Croatia: "hr",
  "Czech Republic": "cz",
  Czechia: "cz",
  Denmark: "dk",
  "DR Congo": "cd",
  Ecuador: "ec",
  Egypt: "eg",
  England: "gb-eng",
  Finland: "fi",
  France: "fr",
  Gabon: "ga",
  Georgia: "ge",
  Germany: "de",
  Ghana: "gh",
  Greece: "gr",
  Guatemala: "gt",
  Guinea: "gn",
  Honduras: "hn",
  Hungary: "hu",
  Iceland: "is",
  India: "in",
  Indonesia: "id",
  Iran: "ir",
  Iraq: "iq",
  Ireland: "ie",
  Israel: "il",
  Italy: "it",
  "Ivory Coast": "ci",
  "Cote D'Ivoire": "ci",
  Jamaica: "jm",
  Japan: "jp",
  Kenya: "ke",
  Kosovo: "xk",
  "Korea Republic": "kr",
  "South Korea": "kr",
  Mali: "ml",
  Malta: "mt",
  Mexico: "mx",
  Montenegro: "me",
  Morocco: "ma",
  Mozambique: "mz",
  Netherlands: "nl",
  "New Zealand": "nz",
  Nigeria: "ng",
  "North Macedonia": "mk",
  "Northern Ireland": "gb-nir",
  Norway: "no",
  Panama: "pa",
  Paraguay: "py",
  Peru: "pe",
  Poland: "pl",
  Portugal: "pt",
  Romania: "ro",
  Russia: "ru",
  "Saudi Arabia": "sa",
  Scotland: "gb-sct",
  Senegal: "sn",
  Serbia: "rs",
  Slovakia: "sk",
  Slovenia: "si",
  "South Africa": "za",
  Spain: "es",
  Sweden: "se",
  Switzerland: "ch",
  Tunisia: "tn",
  Turkey: "tr",
  Turkiye: "tr",
  Ukraine: "ua",
  "United States": "us",
  USA: "us",
  Uruguay: "uy",
  Uzbekistan: "uz",
  Venezuela: "ve",
  Wales: "gb-wls",
  Zambia: "zm",
  Zimbabwe: "zw",
};

/**
 * Get the 2-letter ISO code for a country name.
 * Returns null if not found.
 */
export function getCountryCode(country: string): string | null {
  return COUNTRY_TO_CODE[country] ?? null;
}

/**
 * Get a flag CDN image URL for a country name.
 * Uses flagcdn.com which serves free flag images.
 * Returns null if the country is not mapped.
 */
export function getCountryFlagUrl(country: string, width = 80): string | null {
  const code = getCountryCode(country);
  if (!code) return null;
  return `https://flagcdn.com/w${width}/${code}.png`;
}

/**
 * Get flag emoji for a country name.
 * Returns null if the country is not mapped or uses a subdivision code.
 */
export function getCountryFlagEmoji(country: string): string | null {
  const code = getCountryCode(country);
  if (!code || code.includes("-")) return null; // Subdivision codes (gb-eng) don't have emoji flags
  return code
    .toUpperCase()
    .split("")
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join("");
}
