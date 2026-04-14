import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Top Scorers";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function titleCase(str: string): string {
  return str
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string; season: string }>;
}) {
  const { slug, season } = await params;
  const competition = titleCase(decodeURIComponent(slug).replace(/-/g, " "));
  const displaySeason = season.replace("-", "/");

  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #c2410c, #ea580c, #f97316)",
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
          &#x26BD;
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
          {competition} {displaySeason}
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
          Top Scorers — Goals, stats & rankings on DataSports
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
