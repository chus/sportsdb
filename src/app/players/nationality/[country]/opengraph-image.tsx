import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Football Players by Nationality";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ country: string }> }) {
  const { country } = await params;
  const label = decodeURIComponent(country);

  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #1e3a5f, #2563eb, #4f46e5)",
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
        <div style={{ fontSize: 80, marginBottom: 8, display: "flex" }}>🌍</div>
        <div style={{ fontSize: 52, fontWeight: 800, marginBottom: 12, display: "flex", textAlign: "center", maxWidth: 900 }}>
          {label} Players
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
          Football players from {label} — profiles, stats, and career data
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
