interface JsonLdProps {
  data: Record<string, unknown>;
}

export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

// Schema.org types for sports entities

export function PlayerJsonLd({
  name,
  url,
  image,
  nationality,
  birthDate,
  height,
  team,
  position,
}: {
  name: string;
  url: string;
  image?: string | null;
  nationality?: string | null;
  birthDate?: string | null;
  height?: number | null;
  team?: { name: string; url: string } | null;
  position?: string | null;
}) {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Person",
    name,
    url,
    ...(image && { image }),
    ...(nationality && { nationality }),
    ...(birthDate && { birthDate }),
    ...(height && { height: { "@type": "QuantitativeValue", value: height, unitCode: "CMT" } }),
    ...(position && { jobTitle: position }),
    ...(team && {
      memberOf: {
        "@type": "SportsTeam",
        name: team.name,
        url: team.url,
      },
    }),
  };

  return <JsonLd data={data} />;
}

export function TeamJsonLd({
  name,
  url,
  logo,
  sport = "Football",
  location,
  foundingDate,
  memberCount,
}: {
  name: string;
  url: string;
  logo?: string | null;
  sport?: string;
  location?: { city?: string | null; country?: string | null } | null;
  foundingDate?: number | null;
  memberCount?: number;
}) {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "SportsTeam",
    name,
    url,
    sport,
    ...(logo && { logo }),
    ...(foundingDate && { foundingDate: String(foundingDate) }),
    ...(memberCount && { member: { "@type": "QuantitativeValue", value: memberCount } }),
    ...(location && (location.city || location.country) && {
      location: {
        "@type": "Place",
        address: {
          "@type": "PostalAddress",
          ...(location.city && { addressLocality: location.city }),
          ...(location.country && { addressCountry: location.country }),
        },
      },
    }),
  };

  return <JsonLd data={data} />;
}

export function CompetitionJsonLd({
  name,
  url,
  logo,
  sport = "Football",
  location,
}: {
  name: string;
  url: string;
  logo?: string | null;
  sport?: string;
  location?: string | null;
}) {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "SportsOrganization",
    name,
    url,
    sport,
    ...(logo && { logo }),
    ...(location && {
      location: {
        "@type": "Place",
        address: {
          "@type": "PostalAddress",
          addressCountry: location,
        },
      },
    }),
  };

  return <JsonLd data={data} />;
}

export function VenueJsonLd({
  name,
  url,
  image,
  address,
  capacity,
}: {
  name: string;
  url: string;
  image?: string | null;
  address?: { city?: string | null; country?: string | null } | null;
  capacity?: number | null;
}) {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "StadiumOrArena",
    name,
    url,
    ...(image && { image }),
    ...(capacity && { maximumAttendeeCapacity: capacity }),
    ...(address && (address.city || address.country) && {
      address: {
        "@type": "PostalAddress",
        ...(address.city && { addressLocality: address.city }),
        ...(address.country && { addressCountry: address.country }),
      },
    }),
  };

  return <JsonLd data={data} />;
}
