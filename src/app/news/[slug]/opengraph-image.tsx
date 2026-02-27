import { ImageResponse } from "next/og";
import { getArticleBySlug } from "@/lib/queries/articles";

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
            News
          </div>
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
            sportsdb-nine.vercel.app
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
