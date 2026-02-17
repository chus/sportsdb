/**
 * Date Parser for Career Extraction
 *
 * Handles various date formats found in Wikipedia:
 * - "1 July 2019" → { year: 2019, month: 7, day: 1 }
 * - "Summer 2019" → { year: 2019, month: 7 }
 * - "January 2020" → { year: 2020, month: 1 }
 * - "2019–2022" → start year, end year
 * - "2019–" → start year, null end year (current)
 */

export interface ParsedDate {
  year: number;
  month?: number;
  day?: number;
}

export interface DateRange {
  start: ParsedDate;
  end: ParsedDate | null; // null = current/present
}

const MONTH_MAP: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

const SEASON_MAP: Record<string, number> = {
  winter: 1,
  spring: 4,
  summer: 7,
  autumn: 10,
  fall: 10,
};

/**
 * Parse a single date string into a ParsedDate object.
 */
export function parseDate(text: string): ParsedDate | null {
  const cleaned = text.trim().toLowerCase();

  // Try full date: "1 July 2019", "July 1, 2019"
  const fullDateMatch = cleaned.match(
    /(\d{1,2})\s+([a-z]+)\s+(\d{4})|([a-z]+)\s+(\d{1,2}),?\s+(\d{4})/
  );
  if (fullDateMatch) {
    const day = parseInt(fullDateMatch[1] || fullDateMatch[5]);
    const monthStr = fullDateMatch[2] || fullDateMatch[4];
    const year = parseInt(fullDateMatch[3] || fullDateMatch[6]);
    const month = MONTH_MAP[monthStr];
    if (month && year >= 1900 && year <= 2100) {
      return { year, month, day };
    }
  }

  // Try month + year: "January 2020", "Jan 2020"
  const monthYearMatch = cleaned.match(/([a-z]+)\s+(\d{4})/);
  if (monthYearMatch) {
    const monthStr = monthYearMatch[1];
    const year = parseInt(monthYearMatch[2]);
    const month = MONTH_MAP[monthStr];
    if (month && year >= 1900 && year <= 2100) {
      return { year, month };
    }
  }

  // Try season + year: "Summer 2019"
  const seasonMatch = cleaned.match(/([a-z]+)\s+(\d{4})/);
  if (seasonMatch) {
    const season = SEASON_MAP[seasonMatch[1]];
    const year = parseInt(seasonMatch[2]);
    if (season && year >= 1900 && year <= 2100) {
      return { year, month: season };
    }
  }

  // Try just year: "2019"
  const yearMatch = cleaned.match(/^(\d{4})$/);
  if (yearMatch) {
    const year = parseInt(yearMatch[1]);
    if (year >= 1900 && year <= 2100) {
      return { year };
    }
  }

  return null;
}

/**
 * Parse a date range string into start and end dates.
 */
export function parseDateRange(text: string): DateRange | null {
  const cleaned = text.trim();

  // Handle various dash types: –, -, —
  const parts = cleaned.split(/[–\-—]/);

  if (parts.length === 2) {
    const startText = parts[0].trim();
    const endText = parts[1].trim();

    // Parse start
    let startDate = parseDate(startText);
    if (!startDate) {
      // Try just year
      const startYear = parseInt(startText);
      if (startYear >= 1900 && startYear <= 2100) {
        startDate = { year: startYear };
      }
    }

    if (!startDate) return null;

    // Parse end (or null if empty/present)
    if (!endText || endText === "" || endText.toLowerCase() === "present") {
      return { start: startDate, end: null };
    }

    let endDate = parseDate(endText);
    if (!endDate) {
      // Try just year
      const endYear = parseInt(endText);
      if (endYear >= 1900 && endYear <= 2100) {
        endDate = { year: endYear };
      }
    }

    if (endDate) {
      return { start: startDate, end: endDate };
    }

    // If we couldn't parse end but have start, assume current
    return { start: startDate, end: null };
  }

  // Single date (assume start only, current)
  const singleDate = parseDate(cleaned);
  if (singleDate) {
    return { start: singleDate, end: null };
  }

  return null;
}

/**
 * Convert a ParsedDate to an ISO date string (YYYY-MM-DD).
 * Uses sensible defaults: July 1st for year-only start dates,
 * June 30th for year-only end dates.
 */
export function toIsoDate(
  date: ParsedDate,
  isEndDate: boolean = false
): string {
  const year = date.year;

  if (date.month && date.day) {
    const month = date.month.toString().padStart(2, "0");
    const day = date.day.toString().padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  if (date.month) {
    const month = date.month.toString().padStart(2, "0");
    // Use first of month for start, last for end
    const day = isEndDate ? "28" : "01"; // Safe last day
    return `${year}-${month}-${day}`;
  }

  // Year only: use July 1 for start (typical transfer window), June 30 for end
  if (isEndDate) {
    return `${year}-06-30`;
  }
  return `${year}-07-01`;
}

/**
 * Parse transfer fee strings.
 */
export interface TransferFee {
  amount: number | null;
  currency: string;
  type: "paid" | "free" | "loan" | "undisclosed" | "unknown";
  raw: string;
}

export function parseTransferFee(text: string): TransferFee {
  const cleaned = text.trim().toLowerCase();
  const raw = text.trim();

  // Free transfer
  if (
    cleaned.includes("free") ||
    cleaned === "0" ||
    cleaned.includes("released")
  ) {
    return { amount: 0, currency: "", type: "free", raw };
  }

  // Loan
  if (cleaned.includes("loan")) {
    return { amount: null, currency: "", type: "loan", raw };
  }

  // Undisclosed
  if (
    cleaned.includes("undisclosed") ||
    cleaned.includes("unknown") ||
    cleaned === "?"
  ) {
    return { amount: null, currency: "", type: "undisclosed", raw };
  }

  // Parse amount with currency
  // Matches: €60M, £45m, $100 million, 60m€
  const amountMatch = cleaned.match(
    /([€£$])?(\d+(?:[.,]\d+)?)\s*(k|m|million|billion)?(?:\s*([€£$]))?/
  );

  if (amountMatch) {
    const currency = amountMatch[1] || amountMatch[4] || "€";
    let amount = parseFloat(amountMatch[2].replace(",", "."));
    const multiplier = amountMatch[3];

    if (multiplier) {
      if (
        multiplier === "m" ||
        multiplier === "million" ||
        multiplier.startsWith("m")
      ) {
        amount *= 1_000_000;
      } else if (multiplier === "k") {
        amount *= 1_000;
      } else if (multiplier === "billion") {
        amount *= 1_000_000_000;
      }
    }

    return { amount, currency, type: "paid", raw };
  }

  return { amount: null, currency: "", type: "unknown", raw };
}
