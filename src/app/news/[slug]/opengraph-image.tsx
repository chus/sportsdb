import { ImageResponse } from "next/og";
import { getArticleBySlug, getArticleMatchData } from "@/lib/queries/articles";

export const runtime = "edge";
export const alt = "Article on SportsDB";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: { slug: string } }) {
  const result = await getArticleBySlug(params.slug);

  if (!result) {
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
          Article Not Found – SportsDB
        </div>
      ),
      { ...size }
    );
  }

  const { article, competition } = result;

  // Fetch match data for match reports
  const matchData = article.matchId ? await getArticleMatchData(article.matchId) : null;
  const hasScoreline =
    matchData &&
    article.type === "match_report" &&
    matchData.match.homeScore !== null &&
    matchData.match.awayScore !== null;

  const details = [
    competition?.name,
    article.type.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()),
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
          background: "linear-gradient(135deg, #0c1e3a 0%, #172554 50%, #312e81 100%)",
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
            {hasScoreline ? "Match Report" : "News"}
          </div>

          {/* Scoreline for match reports */}
          {hasScoreline && matchData && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "40px",
                padding: "24px 0",
              }}
            >
              <div
                style={{
                  fontSize: 42,
                  fontWeight: 700,
                  textAlign: "right",
                  flex: 1,
                }}
              >
                {matchData.homeTeam.name}
              </div>
              <div
                style={{
                  fontSize: 72,
                  fontWeight: 800,
                  letterSpacing: "4px",
                }}
              >
                {matchData.match.homeScore} - {matchData.match.awayScore}
              </div>
              <div
                style={{
                  fontSize: 42,
                  fontWeight: 700,
                  textAlign: "left",
                  flex: 1,
                }}
              >
                {matchData.awayTeam.name}
              </div>
            </div>
          )}

          {/* Title (smaller when scoreline is shown) */}
          {!hasScoreline && (
            <div
              style={{
                fontSize: 56,
                fontWeight: 700,
                lineHeight: 1.15,
                overflow: "hidden",
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
              }}
            >
              {article.title}
            </div>
          )}

          {details && (
            <div style={{ fontSize: 28, opacity: 0.85, marginTop: "8px" }}>
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
            datasports.co
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
