import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Player Comparison";
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
  params: Promise<{ matchup: string }>;
}) {
  const { matchup } = await params;
  const decoded = decodeURIComponent(matchup);
  const parts = decoded.split("-vs-");

  const player1 = parts[0] ? titleCase(parts[0]) : "Player 1";
  const player2 = parts[1] ? titleCase(parts[1]) : "Player 2";
  const title =
    parts.length === 2 ? `${player1} vs ${player2}` : "Player Comparison";

  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #1e3a5f, #2563eb, #7c3aed)",
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
          &#x2694;&#xFE0F;
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
          Head-to-head stats comparison on DataSports
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
