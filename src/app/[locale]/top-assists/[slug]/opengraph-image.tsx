import { ImageResponse } from "next/og";
import { getCompetitionBySlug } from "@/lib/queries/leaderboards";

export const runtime = "edge";
export const alt = "Top Assists – Football Assist Rankings";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const competition = await getCompetitionBySlug(slug);
  const name = competition?.name ?? "Competition";

  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #3730a3, #4f46e5, #6366f1)",
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
        <div style={{ fontSize: 80, marginBottom: 8, display: "flex" }}>🤝</div>
        <div style={{ fontSize: 48, fontWeight: 800, marginBottom: 12, display: "flex", textAlign: "center", maxWidth: 900 }}>
          {name} Top Assists
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
          Assist rankings and playmaker statistics
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
