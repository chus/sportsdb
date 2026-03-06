import { NextRequest } from "next/server";
import {
  type EntityImageType,
  getEntityInitials,
  getFallbackEntityLabel,
  getFallbackEntityTheme,
} from "@/lib/images/fallback-entity-image";

export const runtime = "edge";

const VALID_TYPES = new Set<EntityImageType>([
  "player",
  "team",
  "competition",
  "venue",
  "article",
]);

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function renderShape(type: EntityImageType, accent: string) {
  const common = `fill="${accent}" fill-opacity="0.18"`;

  if (type === "player") {
    return `
      <circle cx="160" cy="138" r="56" ${common} />
      <path d="M104 264c18-44 42-66 72-66s54 22 72 66" ${common} />
    `;
  }

  if (type === "venue") {
    return `
      <rect x="84" y="110" width="152" height="102" rx="18" ${common} />
      <path d="M96 222h128" stroke="${accent}" stroke-opacity="0.24" stroke-width="10" stroke-linecap="round" />
      <path d="M116 96h96" stroke="${accent}" stroke-opacity="0.24" stroke-width="10" stroke-linecap="round" />
    `;
  }

  if (type === "article") {
    return `
      <rect x="88" y="92" width="144" height="152" rx="24" ${common} />
      <path d="M112 132h96M112 164h80M112 196h64" stroke="${accent}" stroke-opacity="0.42" stroke-width="10" stroke-linecap="round" />
    `;
  }

  return `
    <path d="M160 82 224 104v62c0 52-32 89-64 108-32-19-64-56-64-108v-62z" ${common} />
  `;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawType = searchParams.get("type");
  const type = VALID_TYPES.has(rawType as EntityImageType)
    ? (rawType as EntityImageType)
    : "article";
  const name = searchParams.get("name")?.trim() || "SportsDB";
  const initials = getEntityInitials(name);
  const label = getFallbackEntityLabel(type);
  const theme = getFallbackEntityTheme(type);
  const safeName = escapeXml(name.slice(0, 40));
  const safeLabel = escapeXml(label);
  const safeInitials = escapeXml(initials);

  const svg = `
    <svg width="1200" height="630" viewBox="0 0 320 320" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${safeName}">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${theme.start}" />
          <stop offset="100%" stop-color="${theme.end}" />
        </linearGradient>
        <radialGradient id="glow" cx="80%" cy="20%" r="80%">
          <stop offset="0%" stop-color="${theme.accent}" stop-opacity="0.48" />
          <stop offset="100%" stop-color="${theme.accent}" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect width="320" height="320" rx="36" fill="url(#bg)" />
      <circle cx="260" cy="56" r="120" fill="url(#glow)" />
      <circle cx="52" cy="280" r="96" fill="${theme.accent}" fill-opacity="0.08" />
      ${renderShape(type, theme.accent)}
      <text x="36" y="58" fill="white" fill-opacity="0.82" font-size="20" font-family="Arial, sans-serif" letter-spacing="3">${safeLabel.toUpperCase()}</text>
      <text x="36" y="236" fill="white" font-size="76" font-weight="700" font-family="Arial, sans-serif">${safeInitials}</text>
      <text x="36" y="280" fill="white" fill-opacity="0.9" font-size="24" font-family="Arial, sans-serif">${safeName}</text>
    </svg>
  `.trim();

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
