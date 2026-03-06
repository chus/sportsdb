export default function TeamLoading() {
  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="animate-pulse bg-neutral-900">
        <div className="mx-auto max-w-7xl px-4 py-10">
          <div className="h-4 w-28 rounded bg-white/15" />
          <div className="mt-6 flex flex-col gap-6 md:flex-row">
            <div className="h-32 w-32 rounded-2xl bg-white md:h-40 md:w-40" />
            <div className="flex-1 space-y-4">
              <div className="h-12 max-w-xl rounded bg-white/15" />
              <div className="h-6 w-56 rounded bg-white/10" />
              <div className="grid max-w-3xl gap-4 sm:grid-cols-3">
                <div className="h-16 rounded-2xl bg-white/10" />
                <div className="h-16 rounded-2xl bg-white/10" />
                <div className="h-16 rounded-2xl bg-white/10" />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="h-80 rounded-3xl bg-white shadow-sm ring-1 ring-neutral-200" />
            <div className="h-56 rounded-3xl bg-white shadow-sm ring-1 ring-neutral-200" />
          </div>
          <div className="space-y-6">
            <div className="h-48 rounded-3xl bg-white shadow-sm ring-1 ring-neutral-200" />
            <div className="h-56 rounded-3xl bg-white shadow-sm ring-1 ring-neutral-200" />
            <div className="h-56 rounded-3xl bg-white shadow-sm ring-1 ring-neutral-200" />
          </div>
        </div>
      </div>
    </div>
  );
}
