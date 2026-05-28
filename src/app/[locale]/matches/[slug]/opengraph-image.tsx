import { ImageResponse } from "next/og";
import { getMatchWithDetailsBySlug } from "@/lib/queries/matches";
import { format } from "date-fns";

export const runtime = "edge";
export const alt = "Match details on DataSports";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: { slug: string } }) {
  const match = await getMatchWithDetailsBySlug(params.slug);

  if (!match || !match.homeTeam || !match.awayTeam) {
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
          Match Not Found – DataSports
        </div>
      ),
      { ...size }
    );
  }

  const isFinished = match.status === "finished" && match.homeScore !== null && match.awayScore !== null;
  const score = isFinished
    ? `${match.homeScore} – ${match.awayScore}`
    : "vs";
  const statusLabel = isFinished ? "Full Time" : match.status === "live" ? "LIVE" : format(new Date(match.scheduledAt), "MMM d, yyyy");
  const compName = match.competition?.name || "";

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
          background: isFinished
            ? "linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #020617 100%)"
            : "linear-gradient(135deg, #2563eb 0%, #4f46e5 50%, #7e22ce 100%)",
          color: "white",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: "24px" }}>
          {compName && (
            <div
              style={{
                fontSize: 22,
                opacity: 0.7,
                textTransform: "uppercase",
                letterSpacing: "2px",
              }}
            >
              {compName}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: "40px" }}>
            <div style={{ fontSize: 48, fontWeight: 700, textAlign: "right", maxWidth: "380px" }}>
              {match.homeTeam.name}
            </div>
            <div style={{ fontSize: 72, fontWeight: 700, opacity: 0.9, minWidth: "140px", textAlign: "center" }}>
              {score}
            </div>
            <div style={{ fontSize: 48, fontWeight: 700, textAlign: "left", maxWidth: "380px" }}>
              {match.awayTeam.name}
            </div>
          </div>
          <div style={{ fontSize: 22, opacity: 0.6, marginTop: "8px" }}>
            {statusLabel}
            {match.venue ? `  ·  ${match.venue.name}` : ""}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
          }}
        >
          <div style={{ fontSize: 28, fontWeight: 700, opacity: 0.9 }}>
            DataSports
          </div>
          <div style={{ fontSize: 20, opacity: 0.6 }}>
            datasports.co
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
