import { Metadata } from "next";
import { NotificationsPageContent } from "./notifications-content";

export const metadata: Metadata = {
  title: "Notifications",
  description: "View and manage your SportsDB notifications",
};

export default function NotificationsPage() {
  return <NotificationsPageContent />;
}
