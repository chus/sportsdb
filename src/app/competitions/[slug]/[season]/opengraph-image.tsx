import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Competition Season";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function titleCase(str: string): string {
  return str
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string; season: string }>;
}) {
  const { slug, season } = await params;
  const competitionName = titleCase(decodeURIComponent(slug));
  const seasonLabel = decodeURIComponent(season).replace(/-/g, "/");
  const title = `${competitionName} ${seasonLabel}`;

  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #4c1d95, #7c3aed, #6d28d9)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
          color: "white",
        }}
      >
        <div style={{ fontSize: 80, marginBottom: 8, display: "flex" }}>
          &#x1F3C6;
        </div>
        <div
          style={{
            fontSize: 52,
            fontWeight: 800,
            marginBottom: 12,
            display: "flex",
            textAlign: "center",
            maxWidth: 900,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 24,
            opacity: 0.85,
            maxWidth: 700,
            textAlign: "center",
            display: "flex",
          }}
        >
          Standings, stats & results on DataSports
        </div>
        <div
          style={{
            position: "absolute",
            bottom: 40,
            fontSize: 20,
            fontWeight: 600,
            opacity: 0.7,
            display: "flex",
          }}
        >
          DataSports
        </div>
      </div>
    ),
    { ...size }
  );
}
