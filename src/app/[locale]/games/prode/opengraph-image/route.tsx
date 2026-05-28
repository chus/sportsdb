import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const points = searchParams.get("points") || "0";
  const rank = searchParams.get("rank") || "";
  const name = searchParams.get("name") || "A player";

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "1200px",
          height: "630px",
          background: "linear-gradient(135deg, #1e40af 0%, #4f46e5 50%, #7c3aed 100%)",
          color: "white",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            background: "rgba(255,255,255,0.1)",
            borderRadius: "24px",
            padding: "48px 64px",
            backdropFilter: "blur(10px)",
          }}
        >
          <div
            style={{
              fontSize: "24px",
              opacity: 0.8,
              marginBottom: "8px",
            }}
          >
            DataSports Score Predictions
          </div>
          <div
            style={{
              fontSize: "48px",
              fontWeight: "bold",
              marginBottom: "16px",
            }}
          >
            {name}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: "8px",
              marginBottom: "16px",
            }}
          >
            <span style={{ fontSize: "96px", fontWeight: "bold" }}>
              {points}
            </span>
            <span style={{ fontSize: "32px", opacity: 0.7 }}>points</span>
          </div>
          {rank && (
            <div
              style={{
                fontSize: "28px",
                background: "rgba(255,255,255,0.2)",
                padding: "8px 24px",
                borderRadius: "12px",
                marginBottom: "24px",
              }}
            >
              Ranked #{rank}
            </div>
          )}
          <div
            style={{
              fontSize: "20px",
              opacity: 0.8,
            }}
          >
            Think you can do better? Join now!
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
