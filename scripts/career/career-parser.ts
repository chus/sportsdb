/**
 * Career Parser with Strategy Pattern
 *
 * Supports multiple Wikipedia formats:
 * 1. InfoboxCareerStrategy - standard infobox career tables
 * 2. WikitableCareerStrategy - dedicated career wikitables
 * 3. TransferboxStrategy - transfer history boxes
 * 4. TextParagraphStrategy - fallback: extract from prose
 */

import * as cheerio from "cheerio";
import {
  parseDateRange,
  toIsoDate,
  parseTransferFee,
  type TransferFee,
} from "./date-parser";
import { extractTeamFromWikiLink } from "./team-matcher";

export interface CareerEntry {
  teamName: string;
  startYear: number;
  startMonth?: number;
  endYear: number | null;
  endMonth?: number;
  appearances: number | null;
  goals: number | null;
  isLoan: boolean;
  transferFee?: TransferFee;
  careerType: "senior" | "youth";
}

export interface CareerParsingStrategy {
  name: string;
  canParse($: cheerio.CheerioAPI): boolean;
  parse($: cheerio.CheerioAPI): CareerEntry[];
}

/**
 * Strategy 1: Parse career from infobox (most common format)
 */
export class InfoboxCareerStrategy implements CareerParsingStrategy {
  name = "InfoboxCareer";

  canParse($: cheerio.CheerioAPI): boolean {
    return $(".infobox").length > 0;
  }

  parse($: cheerio.CheerioAPI): CareerEntry[] {
    const career: CareerEntry[] = [];
    let currentCareerType: "senior" | "youth" = "senior";

    $(".infobox").each((_, infobox) => {
      const $infobox = $(infobox);

      $infobox.find("tr").each((_, row) => {
        const $row = $(row);
        const headerText = $row.find("th").text().toLowerCase();

        // Track career section type
        if (headerText.includes("youth career")) {
          currentCareerType = "youth";
          return;
        }
        if (headerText.includes("senior career") || headerText.includes("career")) {
          currentCareerType = "senior";
          return;
        }

        // Skip international career
        if (headerText.includes("national") || headerText.includes("international")) {
          return;
        }

        // Parse career rows
        const cells = $row.find("td");
        if (cells.length >= 2) {
          const yearsCell = $(cells[0]);
          const teamCell = $(cells[1]);
          const statsCell = cells.length > 2 ? $(cells[2]) : null;

          const yearsText = yearsCell.text().trim();
          // Get team name from link text or cell text
          const teamLink = teamCell.find("a").first();
          const teamName = teamLink.length > 0
            ? extractTeamFromWikiLink(teamLink.text())
            : extractTeamFromWikiLink(teamCell.text());
          const statsText = statsCell ? statsCell.text().trim() : "";

          // Parse years
          const dateRange = parseDateRange(yearsText);
          if (!dateRange || !teamName || teamName.toLowerCase().includes("total")) {
            return;
          }

          // Parse appearances and goals (format: "45 (12)" or "45(12)")
          let appearances: number | null = null;
          let goals: number | null = null;
          const statsMatch = statsText.match(/(\d+)\s*\((\d+)\)/);
          if (statsMatch) {
            appearances = parseInt(statsMatch[1]);
            goals = parseInt(statsMatch[2]);
          }

          // Check if it's a loan
          const isLoan =
            teamCell.text().toLowerCase().includes("loan") ||
            yearsText.toLowerCase().includes("loan");

          career.push({
            teamName,
            startYear: dateRange.start.year,
            startMonth: dateRange.start.month,
            endYear: dateRange.end?.year || null,
            endMonth: dateRange.end?.month,
            appearances,
            goals,
            isLoan,
            careerType: currentCareerType,
          });
        }
      });
    });

    return career;
  }
}

/**
 * Strategy 2: Parse from dedicated wikitables
 */
export class WikitableCareerStrategy implements CareerParsingStrategy {
  name = "WikitableCareer";

  canParse($: cheerio.CheerioAPI): boolean {
    // Look for wikitables near "Career" or "Club" headers
    const tables = $("table.wikitable");
    let hasCareerTable = false;

    tables.each((_, table) => {
      const $table = $(table);
      const caption = $table.find("caption").text().toLowerCase();
      const prevHeader = $table.prev("h2, h3").text().toLowerCase();

      if (
        caption.includes("career") ||
        caption.includes("club") ||
        prevHeader.includes("career") ||
        prevHeader.includes("club")
      ) {
        hasCareerTable = true;
        return false; // break
      }
    });

    return hasCareerTable;
  }

  parse($: cheerio.CheerioAPI): CareerEntry[] {
    const career: CareerEntry[] = [];

    $("table.wikitable").each((_, table) => {
      const $table = $(table);
      const caption = $table.find("caption").text().toLowerCase();
      const prevHeader = $table.prev("h2, h3").text().toLowerCase();

      if (
        !(
          caption.includes("career") ||
          caption.includes("club") ||
          prevHeader.includes("career") ||
          prevHeader.includes("club")
        )
      ) {
        return;
      }

      // Analyze header row to understand column structure
      const headers: string[] = [];
      $table.find("thead tr th, tbody tr:first-child th").each((_, th) => {
        headers.push($(th).text().toLowerCase().trim());
      });

      const seasonIdx = headers.findIndex(
        (h) => h.includes("season") || h.includes("year")
      );
      const clubIdx = headers.findIndex(
        (h) => h.includes("club") || h.includes("team")
      );
      const appsIdx = headers.findIndex(
        (h) => h.includes("app") || h === "a"
      );
      const goalsIdx = headers.findIndex(
        (h) => h.includes("goal") || h === "g"
      );

      $table.find("tbody tr").each((_, row) => {
        const $row = $(row);
        const cells = $row.find("td");

        if (cells.length < 2) return;

        // Get values based on column indices (or fallback to position)
        const seasonCell = seasonIdx >= 0 ? $(cells[seasonIdx]) : $(cells[0]);
        const clubCell =
          clubIdx >= 0 ? $(cells[clubIdx]) : $(cells[1]);
        const appsCell = appsIdx >= 0 ? $(cells[appsIdx]) : null;
        const goalsCell = goalsIdx >= 0 ? $(cells[goalsIdx]) : null;

        const yearsText = seasonCell.text().trim();
        // Get team name from link text or cell text
        const clubLink = clubCell.find("a").first();
        const teamName = clubLink.length > 0
          ? extractTeamFromWikiLink(clubLink.text())
          : extractTeamFromWikiLink(clubCell.text());

        if (!teamName || teamName.toLowerCase().includes("total")) {
          return;
        }

        // Parse years from season text (e.g., "2019-20" or "2019")
        let startYear: number | null = null;
        let endYear: number | null = null;

        const seasonMatch = yearsText.match(/(\d{4})(?:[–\-](\d{2,4}))?/);
        if (seasonMatch) {
          startYear = parseInt(seasonMatch[1]);
          if (seasonMatch[2]) {
            endYear =
              seasonMatch[2].length === 2
                ? parseInt(seasonMatch[1].slice(0, 2) + seasonMatch[2])
                : parseInt(seasonMatch[2]);
          }
        }

        if (!startYear) return;

        const appearances = appsCell
          ? parseInt(appsCell.text().trim()) || null
          : null;
        const goals = goalsCell
          ? parseInt(goalsCell.text().trim()) || null
          : null;

        career.push({
          teamName,
          startYear,
          endYear,
          appearances,
          goals,
          isLoan: clubCell.text().toLowerCase().includes("loan"),
          careerType: "senior",
        });
      });
    });

    return career;
  }
}

/**
 * Strategy 3: Parse from transfer box sections
 */
export class TransferboxStrategy implements CareerParsingStrategy {
  name = "Transferbox";

  canParse($: cheerio.CheerioAPI): boolean {
    // Look for transfer-related content
    return (
      $(".infobox-data-value a[title*='transfer']").length > 0 ||
      $("table:contains('Transfer fee')").length > 0
    );
  }

  parse($: cheerio.CheerioAPI): CareerEntry[] {
    const career: CareerEntry[] = [];

    // Look for transfer history in tables
    $("table").each((_, table) => {
      const $table = $(table);
      const text = $table.text().toLowerCase();

      if (!text.includes("transfer") && !text.includes("fee")) {
        return;
      }

      $table.find("tbody tr").each((_, row) => {
        const $row = $(row);
        const cells = $row.find("td");

        if (cells.length < 3) return;

        // Try to extract: Date, From, To, Fee
        let dateText = "";
        let fromTeam = "";
        let toTeam = "";
        let feeText = "";

        cells.each((idx, cell) => {
          const cellText = $(cell).text().trim();
          const cellHtml = $(cell).html() || "";

          if (cellText.match(/\d{4}/)) {
            dateText = cellText;
          } else if (
            cellText.toLowerCase().includes("free") ||
            cellText.match(/[€£$]/)
          ) {
            feeText = cellText;
          } else if (cellHtml.includes("<a")) {
            if (!fromTeam) {
              fromTeam = extractTeamFromWikiLink(cellHtml);
            } else {
              toTeam = extractTeamFromWikiLink(cellHtml);
            }
          }
        });

        if (toTeam && dateText) {
          const dateRange = parseDateRange(dateText);
          if (dateRange) {
            career.push({
              teamName: toTeam,
              startYear: dateRange.start.year,
              startMonth: dateRange.start.month,
              endYear: null,
              appearances: null,
              goals: null,
              isLoan: false,
              transferFee: feeText ? parseTransferFee(feeText) : undefined,
              careerType: "senior",
            });
          }
        }
      });
    });

    return career;
  }
}

/**
 * Strategy 4: Extract career info from text paragraphs (last resort)
 */
export class TextParagraphStrategy implements CareerParsingStrategy {
  name = "TextParagraph";

  canParse($: cheerio.CheerioAPI): boolean {
    // Always returns true as fallback
    return true;
  }

  parse($: cheerio.CheerioAPI): CareerEntry[] {
    const career: CareerEntry[] = [];

    // Look for career section content
    let careerSection = $("h2:contains('Career'), h2:contains('Club career')")
      .next()
      .text();

    if (!careerSection) {
      // Try first few paragraphs of the article
      careerSection = $(".mw-parser-output > p").slice(0, 5).text();
    }

    // Pattern: "signed for/joined [Team] in [Year]" or "[Team] ([Year]-[Year])"
    const patterns = [
      /(?:signed for|joined|moved to)\s+([A-Z][A-Za-z\s]+)(?:\s+in\s+(\d{4}))?/g,
      /([A-Z][A-Za-z\s]+)\s+\((\d{4})[–\-](\d{4})?\)/g,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(careerSection)) !== null) {
        const teamName = match[1].trim();
        const startYear = parseInt(match[2]);
        const endYear = match[3] ? parseInt(match[3]) : null;

        if (startYear >= 1900 && startYear <= 2100) {
          career.push({
            teamName,
            startYear,
            endYear,
            appearances: null,
            goals: null,
            isLoan: false,
            careerType: "senior",
          });
        }
      }
    }

    return career;
  }
}

/**
 * Main parser that tries each strategy in order
 */
export class CareerParser {
  private strategies: CareerParsingStrategy[];

  constructor() {
    this.strategies = [
      new InfoboxCareerStrategy(),
      new WikitableCareerStrategy(),
      new TransferboxStrategy(),
      new TextParagraphStrategy(),
    ];
  }

  parse($: cheerio.CheerioAPI): CareerEntry[] {
    for (const strategy of this.strategies) {
      if (strategy.canParse($)) {
        const results = strategy.parse($);
        if (results.length > 0) {
          console.log(`    Using strategy: ${strategy.name}`);
          return results;
        }
      }
    }

    return [];
  }
}
