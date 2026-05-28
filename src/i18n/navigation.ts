import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Drop-in replacements for next/link, next/navigation primitives that
// preserve the current locale prefix across navigation. Import from here
// instead of next/link / next/navigation in client and server code.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
