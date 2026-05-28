"use client";

import { useEffect, useState, useCallback } from "react";
import {
  CreditCard,
  Ticket,
  Plus,
  Trash2,
  Loader2,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

// ----- Types -----

interface Subscriber {
  id: string;
  name: string | null;
  email: string;
  tier: string;
  createdAt: string;
}

interface Voucher {
  id: string;
  code: string;
  type: string;
  discountType: string;
  discountValue: number;
  maxUses: number | null;
  currentUses: number;
  validFrom: string | null;
  validTo: string | null;
  createdAt: string;
  redemptionCount: number;
}

interface VoucherForm {
  code: string;
  type: string;
  discountType: string;
  discountValue: string;
  maxUses: string;
  validTo: string;
}

const emptyForm: VoucherForm = {
  code: "",
  type: "promo",
  discountType: "free_months",
  discountValue: "",
  maxUses: "",
  validTo: "",
};

// ----- Component -----

export default function AdminSubscriptionsPage() {
  const [proSubscribers, setProSubscribers] = useState<Subscriber[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<VoucherForm>(emptyForm);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchSubscribers = useCallback(async () => {
    const proRes = await fetch("/api/admin/users?tier=pro&limit=100");

    if (!proRes.ok) {
      throw new Error("Failed to fetch subscribers");
    }

    const proData = await proRes.json();
    setProSubscribers(proData.users);
  }, []);

  const fetchVouchers = useCallback(async () => {
    const res = await fetch("/api/admin/vouchers");
    if (!res.ok) {
      throw new Error("Failed to fetch vouchers");
    }
    const data = await res.json();
    setVouchers(data.vouchers);
  }, []);

  useEffect(() => {
    async function loadAll() {
      try {
        await Promise.all([fetchSubscribers(), fetchVouchers()]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    }
    loadAll();
  }, [fetchSubscribers, fetchVouchers]);

  async function handleCreateVoucher(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/vouchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.code,
          type: form.type,
          discountType: form.discountType,
          discountValue: Number(form.discountValue),
          maxUses: form.maxUses ? Number(form.maxUses) : null,
          validTo: form.validTo || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to create voucher");
      }

      setForm(emptyForm);
      await fetchVouchers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create voucher");
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteVoucher(voucherId: string) {
    setDeletingId(voucherId);
    setError(null);

    try {
      const res = await fetch("/api/admin/vouchers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voucherId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to delete voucher");
      }

      await fetchVouchers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete voucher");
    } finally {
      setDeletingId(null);
    }
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return "--";
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-neutral-900">Subscriptions</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Manage paying subscribers and voucher codes.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ---- Active Subscribers ---- */}
      <section className="mb-12">
        <div className="mb-4 flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-neutral-600" />
          <h3 className="text-lg font-semibold text-neutral-900">
            Active Subscribers
          </h3>
        </div>

        {/* Pro Subscribers */}
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Star className="h-4 w-4 text-blue-600" />
            <h4 className="text-sm font-medium text-neutral-700">
              Pro ({proSubscribers.length})
            </h4>
          </div>
          <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
            {proSubscribers.length === 0 ? (
              <div className="p-6 text-center text-sm text-neutral-400">
                No pro subscribers yet.
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="border-b border-neutral-100 bg-neutral-50">
                  <tr>
                    <th className="px-4 py-3 font-medium text-neutral-500">Name</th>
                    <th className="px-4 py-3 font-medium text-neutral-500">Email</th>
                    <th className="px-4 py-3 font-medium text-neutral-500">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {proSubscribers.map((sub) => (
                    <tr key={sub.id} className="hover:bg-neutral-50">
                      <td className="px-4 py-3 font-medium text-neutral-900">
                        {sub.name || "--"}
                      </td>
                      <td className="px-4 py-3 text-neutral-600">{sub.email}</td>
                      <td className="px-4 py-3 text-neutral-500">
                        {formatDate(sub.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </section>

      {/* ---- Voucher Codes ---- */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <Ticket className="h-5 w-5 text-neutral-600" />
          <h3 className="text-lg font-semibold text-neutral-900">
            Voucher Codes
          </h3>
        </div>

        {/* Create voucher form */}
        <form
          onSubmit={handleCreateVoucher}
          className="mb-6 rounded-xl border border-neutral-200 bg-white p-6"
        >
          <h4 className="mb-4 text-sm font-semibold text-neutral-900">
            Create New Voucher
          </h4>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-500">
                Code
              </label>
              <input
                type="text"
                required
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="e.g. LAUNCH50"
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-500">
                Type
              </label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="promo">Promo</option>
                <option value="referral">Referral</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-500">
                Discount Type
              </label>
              <select
                value={form.discountType}
                onChange={(e) =>
                  setForm({ ...form, discountType: e.target.value })
                }
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="free_months">Free Months</option>
                <option value="percent_off">Percent Off</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-500">
                Discount Value
              </label>
              <input
                type="number"
                required
                min="1"
                value={form.discountValue}
                onChange={(e) =>
                  setForm({ ...form, discountValue: e.target.value })
                }
                placeholder={
                  form.discountType === "free_months"
                    ? "Number of months"
                    : "Percentage (1-100)"
                }
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-500">
                Max Uses (optional)
              </label>
              <input
                type="number"
                min="1"
                value={form.maxUses}
                onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
                placeholder="Unlimited"
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-500">
                Valid Until (optional)
              </label>
              <input
                type="date"
                value={form.validTo}
                onChange={(e) => setForm({ ...form, validTo: e.target.value })}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="mt-4">
            <button
              type="submit"
              disabled={creating}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              )}
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Create Voucher
            </button>
          </div>
        </form>

        {/* Existing vouchers table */}
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          {vouchers.length === 0 ? (
            <div className="p-6 text-center text-sm text-neutral-400">
              No voucher codes created yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-neutral-100 bg-neutral-50">
                  <tr>
                    <th className="px-4 py-3 font-medium text-neutral-500">Code</th>
                    <th className="px-4 py-3 font-medium text-neutral-500">Type</th>
                    <th className="px-4 py-3 font-medium text-neutral-500">Discount</th>
                    <th className="px-4 py-3 font-medium text-neutral-500">Uses</th>
                    <th className="px-4 py-3 font-medium text-neutral-500">Valid Until</th>
                    <th className="px-4 py-3 font-medium text-neutral-500">Created</th>
                    <th className="px-4 py-3 font-medium text-neutral-500"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {vouchers.map((v) => (
                    <tr key={v.id} className="hover:bg-neutral-50">
                      <td className="px-4 py-3">
                        <code className="rounded bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-800">
                          {v.code}
                        </code>
                      </td>
                      <td className="px-4 py-3 capitalize text-neutral-600">
                        {v.type}
                      </td>
                      <td className="px-4 py-3 text-neutral-600">
                        {v.discountType === "percent_off"
                          ? `${v.discountValue}% off`
                          : `${v.discountValue} free month${v.discountValue !== 1 ? "s" : ""}`}
                      </td>
                      <td className="px-4 py-3 text-neutral-600">
                        {v.redemptionCount}
                        {v.maxUses ? ` / ${v.maxUses}` : ""}
                      </td>
                      <td className="px-4 py-3 text-neutral-500">
                        {formatDate(v.validTo)}
                      </td>
                      <td className="px-4 py-3 text-neutral-500">
                        {formatDate(v.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDeleteVoucher(v.id)}
                          disabled={deletingId === v.id}
                          className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                          title="Delete voucher"
                        >
                          {deletingId === v.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
