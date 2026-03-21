"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface AdminUser {
  id: string;
  name: string | null;
  email: string;
  role: string;
  tier: string;
  createdAt: string;
}

const TIERS = ["free", "pro", "premium"] as const;

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const limit = 20;

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search,
        page: String(page),
        limit: String(limit),
      });
      const res = await fetch(`/api/admin/users?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setUsers(data.users);
      setTotal(data.total);
    } catch (err) {
      console.error("Error fetching users:", err);
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchUsers();
    }, 300);
    return () => clearTimeout(timeout);
  }, [fetchUsers]);

  async function handleTierChange(userId: string, tier: string) {
    setUpdatingId(userId);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, tier }),
      });
      if (!res.ok) throw new Error("Failed to update tier");
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, tier } : u))
      );
    } catch (err) {
      console.error("Error updating tier:", err);
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleDelete(userId: string) {
    if (!confirm("Are you sure you want to delete this user? This action cannot be undone.")) {
      return;
    }
    setUpdatingId(userId);
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to delete user");
        return;
      }
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setTotal((prev) => prev - 1);
    } catch (err) {
      console.error("Error deleting user:", err);
    } finally {
      setUpdatingId(null);
    }
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-900">Users</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Manage user accounts and subscription tiers
        </p>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-neutral-200 bg-white py-2.5 pl-10 pr-4 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50">
                <th className="px-6 py-3.5 font-medium text-neutral-500">
                  Name
                </th>
                <th className="px-6 py-3.5 font-medium text-neutral-500">
                  Email
                </th>
                <th className="px-6 py-3.5 font-medium text-neutral-500">
                  Tier
                </th>
                <th className="px-6 py-3.5 font-medium text-neutral-500">
                  Role
                </th>
                <th className="px-6 py-3.5 font-medium text-neutral-500">
                  Created At
                </th>
                <th className="px-6 py-3.5 font-medium text-neutral-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-neutral-400"
                  >
                    Loading...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-neutral-400"
                  >
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr
                    key={user.id}
                    className={cn(
                      "transition-colors hover:bg-neutral-50",
                      updatingId === user.id && "opacity-50"
                    )}
                  >
                    <td className="px-6 py-4 font-medium text-neutral-900">
                      {user.name || "—"}
                    </td>
                    <td className="px-6 py-4 text-neutral-600">{user.email}</td>
                    <td className="px-6 py-4">
                      <select
                        value={user.tier}
                        onChange={(e) =>
                          handleTierChange(user.id, e.target.value)
                        }
                        disabled={updatingId === user.id}
                        className={cn(
                          "rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500",
                          user.tier === "premium" &&
                            "border-purple-200 bg-purple-50 text-purple-700",
                          user.tier === "pro" &&
                            "border-blue-200 bg-blue-50 text-blue-700",
                          user.tier === "free" &&
                            "border-neutral-200 bg-neutral-50 text-neutral-600"
                        )}
                      >
                        {TIERS.map((tier) => (
                          <option key={tier} value={tier}>
                            {tier.charAt(0).toUpperCase() + tier.slice(1)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                          user.role === "admin"
                            ? "bg-red-50 text-red-700"
                            : "bg-neutral-100 text-neutral-600"
                        )}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-neutral-500">
                      {user.createdAt
                        ? new Date(user.createdAt).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })
                        : "—"}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleDelete(user.id)}
                        disabled={updatingId === user.id}
                        className="rounded-lg p-2 text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                        title="Delete user"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-neutral-100 px-6 py-4">
            <p className="text-sm text-neutral-500">
              Showing {(page - 1) * limit + 1} to{" "}
              {Math.min(page * limit, total)} of {total} users
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </button>
              <span className="px-2 text-sm text-neutral-500">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
