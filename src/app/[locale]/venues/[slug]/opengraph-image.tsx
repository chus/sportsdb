import { ImageResponse } from "next/og";
import { getVenueBySlug } from "@/lib/queries/venues";

export const runtime = "edge";
export const alt = "Venue profile on DataSports";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: { slug: string } }) {
  const venue = await getVenueBySlug(params.slug);

  if (!venue) {
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
          Venue Not Found – DataSports
        </div>
      ),
      { ...size }
    );
  }

  const details = [
    venue.city,
    venue.country,
    venue.capacity ? `Capacity: ${venue.capacity.toLocaleString()}` : null,
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
          background: "linear-gradient(135deg, #0f766e 0%, #115e59 50%, #134e4a 100%)",
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
            Stadium
          </div>
          <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.1 }}>
            {venue.name}
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
