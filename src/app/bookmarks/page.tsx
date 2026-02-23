import { Metadata } from "next";
import { BookmarksPageContent } from "./bookmarks-content";

export const metadata: Metadata = {
  title: "Bookmarks",
  description: "Your saved players, teams, and matches",
};

export default function BookmarksPage() {
  return <BookmarksPageContent />;
}
