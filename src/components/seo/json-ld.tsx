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

export function MatchJsonLd({
  homeTeam,
  awayTeam,
  homeScore,
  awayScore,
  scheduledAt,
  status,
  venue,
  competition,
  matchUrl,
}: {
  homeTeam: { name: string; url: string };
  awayTeam: { name: string; url: string };
  homeScore?: number | null;
  awayScore?: number | null;
  scheduledAt: string;
  status: string;
  venue?: { name: string; url: string } | null;
  competition?: { name: string; url: string } | null;
  matchUrl: string;
}) {
  const getEventStatus = (status: string) => {
    switch (status) {
      case "scheduled":
        return "https://schema.org/EventScheduled";
      case "live":
      case "half_time":
        return "https://schema.org/EventInProgress";
      case "finished":
        return "https://schema.org/EventCompleted";
      case "postponed":
        return "https://schema.org/EventPostponed";
      case "cancelled":
        return "https://schema.org/EventCancelled";
      default:
        return "https://schema.org/EventScheduled";
    }
  };

  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: `${homeTeam.name} vs ${awayTeam.name}`,
    url: matchUrl,
    startDate: scheduledAt,
    eventStatus: getEventStatus(status),
    competitor: [
      {
        "@type": "SportsTeam",
        name: homeTeam.name,
        url: homeTeam.url,
      },
      {
        "@type": "SportsTeam",
        name: awayTeam.name,
        url: awayTeam.url,
      },
    ],
    ...(venue && {
      location: {
        "@type": "StadiumOrArena",
        name: venue.name,
        url: venue.url,
      },
    }),
    ...(competition && {
      superEvent: {
        "@type": "SportsEvent",
        name: competition.name,
        url: competition.url,
      },
    }),
    ...((status === "finished" || status === "live" || status === "half_time") &&
      homeScore !== null &&
      awayScore !== null && {
        result: {
          "@type": "Text",
          name: `${homeTeam.name} ${homeScore} - ${awayScore} ${awayTeam.name}`,
        },
      }),
  };

  return <JsonLd data={data} />;
}

export function BreadcrumbJsonLd({
  items,
}: {
  items: { name: string; url: string }[];
}) {
  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };

  return <JsonLd data={data} />;
}

export function WebsiteJsonLd({
  url,
  name,
  description,
  searchUrl,
}: {
  url: string;
  name: string;
  description: string;
  searchUrl?: string;
}) {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    url,
    name,
    description,
    ...(searchUrl && {
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: searchUrl,
        },
        "query-input": "required name=search_term_string",
      },
    }),
  };

  return <JsonLd data={data} />;
}

export function OrganizationJsonLd({
  name,
  url,
  logo,
  description,
  sameAs,
}: {
  name: string;
  url: string;
  logo?: string;
  description?: string;
  sameAs?: string[];
}) {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name,
    url,
    ...(logo && { logo }),
    ...(description && { description }),
    ...(sameAs && sameAs.length > 0 && { sameAs }),
  };

  return <JsonLd data={data} />;
}
