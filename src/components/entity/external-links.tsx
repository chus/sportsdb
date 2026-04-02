import { Globe, ExternalLink } from "lucide-react";

interface ExternalLinksProps {
  wikipediaUrl?: string | null;
  websiteUrl?: string | null;
  instagramHandle?: string | null;
  twitterHandle?: string | null;
  entityName: string;
}

export function ExternalLinks({
  wikipediaUrl,
  websiteUrl,
  instagramHandle,
  twitterHandle,
  entityName,
}: ExternalLinksProps) {
  const links = [
    websiteUrl && {
      label: "Official Website",
      href: websiteUrl,
      icon: <Globe className="w-4 h-4" />,
    },
    wikipediaUrl && {
      label: "Wikipedia",
      href: wikipediaUrl,
      icon: <WikipediaIcon />,
    },
    instagramHandle && {
      label: `@${instagramHandle}`,
      href: `https://instagram.com/${instagramHandle}`,
      icon: <InstagramIcon />,
    },
    twitterHandle && {
      label: `@${twitterHandle}`,
      href: `https://x.com/${twitterHandle}`,
      icon: <XIcon />,
    },
  ].filter(Boolean) as { label: string; href: string; icon: React.ReactNode }[];

  if (links.length === 0) return null;

  return (
    <section className="bg-white rounded-xl border border-neutral-200 p-5">
      <h3 className="text-sm font-bold text-neutral-900 mb-3 flex items-center gap-2">
        <ExternalLink className="w-3.5 h-3.5 text-neutral-400" />
        Links
      </h3>
      <div className="space-y-1.5">
        {links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            target="_blank"
            rel="noreferrer noopener"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-neutral-700 hover:bg-neutral-50 hover:text-blue-600 transition-colors group"
          >
            <span className="text-neutral-400 group-hover:text-blue-500 flex-shrink-0">
              {link.icon}
            </span>
            <span className="truncate">{link.label}</span>
          </a>
        ))}
      </div>
    </section>
  );
}

function WikipediaIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.09 13.119c-.936 1.932-2.217 4.548-2.853 5.728-.616 1.074-1.127.931-1.532.029-1.406-3.321-4.293-9.144-5.651-12.409-.251-.601-.441-.987-.619-1.139-.181-.15-.554-.24-1.122-.271C.103 5.033 0 4.982 0 4.898v-.455l.052-.045c.924-.005 5.401 0 5.401 0l.051.045v.434c0 .119-.075.176-.225.176l-.564.031c-.485.029-.727.164-.727.436 0 .135.053.33.166.601 1.082 2.646 4.818 10.521 4.818 10.521l2.681-5.476-2.607-5.04c-.237-.46-.429-.758-.578-.895-.148-.136-.449-.21-.904-.24-.174-.01-.259-.065-.259-.17v-.457c0-.068.026-.1.078-.1.21.004 1.439.022 2.358.022 1.062 0 1.807-.018 2.04-.022.045 0 .067.032.067.1v.457c0 .105-.065.154-.2.17-.635.045-.952.15-.952.314 0 .105.053.27.166.495l1.836 3.672 1.836-3.672c.112-.225.166-.39.166-.495 0-.164-.317-.27-.952-.314-.135-.016-.2-.065-.2-.17v-.457c0-.068.022-.1.067-.1.233.004.978.022 2.04.022.919 0 2.147-.018 2.358-.022.052 0 .078.032.078.1v.457c0 .105-.085.16-.259.17-.455.029-.756.104-.904.24-.149.137-.341.435-.578.895l-2.607 5.04 2.681 5.476s3.736-7.875 4.818-10.521c.113-.27.166-.466.166-.601 0-.272-.242-.407-.727-.436l-.564-.031c-.15 0-.225-.057-.225-.176v-.434l.051-.045s4.477-.005 5.401 0l.052.045v.455c0 .084-.103.135-.335.159-.568.031-.941.121-1.122.271-.178.152-.368.538-.619 1.139-1.358 3.265-4.245 9.088-5.651 12.409-.405.902-.916 1.045-1.532-.029-.636-1.18-1.917-3.796-2.853-5.728-.347.67-2.059 4.282-2.738 5.728-.615 1.074-1.127.931-1.532.029-1.122-2.509-4.269-9.095-5.651-12.409-.245-.596-.371-.895-.545-1.139-.178-.238-.481-.363-.904-.376l-.412-.017c-.135-.016-.2-.065-.2-.17v-.457c0-.068.022-.1.067-.1z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}
