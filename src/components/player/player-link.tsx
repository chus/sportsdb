import Link from "next/link";

interface PlayerLinkProps {
  slug: string;
  isLinkWorthy: boolean;
  children: React.ReactNode;
  className?: string;
}

/**
 * Renders a player name as a <Link> if the player has enough data (isIndexable),
 * or as a plain <span> if the player page would be thin/404.
 */
export function PlayerLink({ slug, isLinkWorthy, children, className }: PlayerLinkProps) {
  if (isLinkWorthy) {
    return (
      <Link href={`/players/${slug}`} className={className}>
        {children}
      </Link>
    );
  }

  return <span className={className}>{children}</span>;
}
