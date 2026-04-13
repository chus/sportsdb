import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "DataSports – The International Sports Database";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #0c1e3a, #172554, #1e3a5f)",
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
        <div style={{ fontSize: 80, marginBottom: 8, display: "flex" }}>&#9917;</div>
        <div style={{ fontSize: 60, fontWeight: 800, marginBottom: 16, display: "flex" }}>
          DataSports
        </div>
        <div
          style={{
            fontSize: 26,
            opacity: 0.85,
            maxWidth: 750,
            textAlign: "center",
            display: "flex",
          }}
        >
          The comprehensive football database — players, teams, competitions, and matches
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
          datasports.co
        </div>
      </div>
    ),
    { ...size }
  );
}
