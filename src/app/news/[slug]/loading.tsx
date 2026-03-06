export default function ArticleLoading() {
  return (
    <div className="min-h-screen bg-white">
      <div className="animate-pulse bg-gradient-to-br from-neutral-900 via-blue-950 to-indigo-950">
        <div className="mx-auto max-w-3xl px-4 py-12">
          <div className="h-4 w-48 rounded bg-white/15" />
          <div className="mt-6 h-6 w-32 rounded-full bg-white/10" />
          <div className="mt-6 h-16 rounded bg-white/15" />
          <div className="mt-4 h-8 w-5/6 rounded bg-white/10" />
          <div className="mt-8 h-4 w-64 rounded bg-white/10" />
        </div>
      </div>
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="space-y-6">
          <div className="h-16 rounded-2xl bg-neutral-100" />
          <div className="h-5 w-full rounded bg-neutral-200" />
          <div className="h-5 w-full rounded bg-neutral-200" />
          <div className="h-5 w-5/6 rounded bg-neutral-200" />
          <div className="h-64 rounded-3xl bg-neutral-100" />
          <div className="h-5 w-full rounded bg-neutral-200" />
          <div className="h-5 w-4/5 rounded bg-neutral-200" />
        </div>
      </div>
    </div>
  );
}
