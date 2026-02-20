import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { AccountSettings } from "@/components/account/account-settings";

export const metadata: Metadata = {
  title: "Account Settings",
  description: "Manage your account settings, profile, and security options.",
};

export default async function AccountPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?redirect=/account");
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-neutral-900 mb-2">Account Settings</h1>
        <p className="text-neutral-500 mb-8">
          Manage your profile, security settings, and account preferences.
        </p>

        <AccountSettings
          user={{
            id: user.id,
            email: user.email,
            name: user.name,
            avatarUrl: user.avatarUrl,
            emailVerified: user.emailVerified,
            createdAt: user.createdAt?.toISOString() || new Date().toISOString(),
          }}
        />
      </div>
    </div>
  );
}
