import { ImageResponse } from "next/og";
import { getCompetitionBySlug } from "@/lib/queries/competitions";

export const runtime = "edge";
export const alt = "Competition on SportsDB";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: { slug: string } }) {
  const competition = await getCompetitionBySlug(params.slug);

  if (!competition) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, #2563eb 0%, #4f46e5 50%, #7e22ce 100%)",
            color: "white",
            fontSize: 48,
            fontWeight: 700,
          }}
        >
          Competition Not Found – SportsDB
        </div>
      ),
      { ...size }
    );
  }

  const details = [
    competition.country,
    competition.type ? competition.type.charAt(0).toUpperCase() + competition.type.slice(1) : null,
  ]
    .filter(Boolean)
    .join("  ·  ");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "60px 80px",
          background: "linear-gradient(135deg, #2563eb 0%, #4f46e5 50%, #7e22ce 100%)",
          color: "white",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div
            style={{
              fontSize: 24,
              opacity: 0.8,
              textTransform: "uppercase",
              letterSpacing: "2px",
            }}
          >
            Competition
          </div>
          <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.1 }}>
            {competition.name}
          </div>
          {details && (
            <div style={{ fontSize: 32, opacity: 0.85, marginTop: "8px" }}>
              {details}
            </div>
          )}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
          }}
        >
          <div style={{ fontSize: 28, fontWeight: 700, opacity: 0.9 }}>
            SportsDB
          </div>
          <div style={{ fontSize: 20, opacity: 0.6 }}>
            sportsdb-nine.vercel.app
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
