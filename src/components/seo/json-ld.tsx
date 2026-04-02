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
  birthPlace,
  height,
  team,
  position,
  sameAs,
}: {
  name: string;
  url: string;
  image?: string | null;
  nationality?: string | null;
  birthDate?: string | null;
  birthPlace?: string | null;
  height?: number | null;
  team?: { name: string; url: string } | null;
  position?: string | null;
  sameAs?: string[];
}) {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Person",
    name,
    url,
    ...(image && { image }),
    ...(nationality && { nationality }),
    ...(birthDate && { birthDate }),
    ...(birthPlace && { birthPlace: { "@type": "Place", name: birthPlace } }),
    ...(height && { height: { "@type": "QuantitativeValue", value: height, unitCode: "CMT" } }),
    ...(position && { jobTitle: position }),
    ...(team && {
      memberOf: {
        "@type": "SportsTeam",
        name: team.name,
        url: team.url,
      },
    }),
    ...(sameAs && sameAs.length > 0 && { sameAs }),
  };

  return <JsonLd data={data} />;
}

export function TeamJsonLd({
  name,
  url,
  logo,
  location,
  foundingDate,
  coach,
  athletes,
  sameAs,
}: {
  name: string;
  url: string;
  logo?: string | null;
  location?: { city?: string | null; country?: string | null } | null;
  foundingDate?: number | null;
  coach?: string | null;
  athletes?: { name: string; url: string }[];
  sameAs?: string[];
}) {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "SportsTeam",
    name,
    url,
    sport: "https://www.wikidata.org/entity/Q2736",
    ...(logo && { logo }),
    ...(foundingDate && { foundingDate: String(foundingDate) }),
    ...(coach && { coach: { "@type": "Person", name: coach } }),
    ...(athletes && athletes.length > 0 && {
      athlete: athletes.map((a) => ({ "@type": "Person", name: a.name, url: a.url })),
    }),
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
    ...(sameAs && sameAs.length > 0 && { sameAs }),
  };

  return <JsonLd data={data} />;
}

export function CollectionPageJsonLd({
  name,
  description,
  url,
}: {
  name: string;
  description: string;
  url: string;
}) {
  const data = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name,
    description,
    url,
  };

  return <JsonLd data={data} />;
}

export function CompetitionJsonLd({
  name,
  url,
  logo,
  location,
}: {
  name: string;
  url: string;
  logo?: string | null;
  location?: string | null;
}) {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "SportsOrganization",
    name,
    url,
    sport: "https://www.wikidata.org/entity/Q2736",
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
  venue?: { name: string; url: string; city?: string | null; country?: string | null } | null;
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

  const scoreStr =
    (status === "finished" || status === "live" || status === "half_time") &&
    homeScore !== null &&
    awayScore !== null
      ? `${homeTeam.name} ${homeScore} - ${awayScore} ${awayTeam.name}`
      : null;

  const description = scoreStr
    ? `${scoreStr}. ${competition ? competition.name + " match" : "Football match"} between ${homeTeam.name} and ${awayTeam.name}.`
    : `${competition ? competition.name + " match" : "Football match"}: ${homeTeam.name} vs ${awayTeam.name}.`;

  // Estimate endDate as startDate + 2 hours
  const startDateObj = new Date(scheduledAt);
  const endDate = new Date(startDateObj.getTime() + 2 * 60 * 60 * 1000).toISOString();

  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: `${homeTeam.name} vs ${awayTeam.name}`,
    description,
    url: matchUrl,
    startDate: scheduledAt,
    endDate,
    eventStatus: getEventStatus(status),
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    sport: "https://www.wikidata.org/entity/Q2736",
    image: `${matchUrl}/opengraph-image`,
    performer: [
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
    location: venue
      ? {
          "@type": "StadiumOrArena",
          name: venue.name,
          url: venue.url,
          address: {
            "@type": "PostalAddress",
            ...(venue.city && { addressLocality: venue.city }),
            ...(venue.country && { addressCountry: venue.country }),
            ...(!venue.city && !venue.country && { name: venue.name }),
          },
        }
      : {
          "@type": "Place",
          name: "TBD",
          address: {
            "@type": "PostalAddress",
            name: "TBD",
          },
        },
    offers: {
      "@type": "Offer",
      url: matchUrl,
      price: "0",
      priceCurrency: "EUR",
      availability: "https://schema.org/InStock",
    },
    ...(competition && {
      organizer: {
        "@type": "SportsOrganization",
        name: competition.name,
        url: competition.url,
      },
    }),
    ...(competition && {
      superEvent: {
        "@type": "SportsEvent",
        name: competition.name,
        url: competition.url,
      },
    }),
    ...(scoreStr && {
      result: {
        "@type": "Text",
        name: scoreStr,
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

export function FAQJsonLd({ items }: { items: { question: string; answer: string }[] }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return <JsonLd data={data} />;
}

export function ItemListJsonLd({
  name,
  items,
}: {
  name: string;
  items: { position: number; url: string; name: string; image?: string | null }[];
}) {
  const data = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    numberOfItems: items.length,
    itemListElement: items.map((item) => ({
      "@type": "ListItem",
      position: item.position,
      url: item.url,
      name: item.name,
      ...(item.image && { image: item.image }),
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
