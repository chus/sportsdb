export default function RootLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-50 to-white">
      <div className="mx-auto max-w-7xl px-4 py-16">
        <div className="animate-pulse space-y-6">
          <div className="h-4 w-40 rounded bg-neutral-200" />
          <div className="h-16 max-w-3xl rounded-3xl bg-neutral-200" />
          <div className="h-6 max-w-2xl rounded bg-neutral-100" />
          <div className="grid gap-6 md:grid-cols-3">
            <div className="h-48 rounded-3xl bg-white shadow-sm ring-1 ring-neutral-200" />
            <div className="h-48 rounded-3xl bg-white shadow-sm ring-1 ring-neutral-200" />
            <div className="h-48 rounded-3xl bg-white shadow-sm ring-1 ring-neutral-200" />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="h-72 rounded-3xl bg-white shadow-sm ring-1 ring-neutral-200" />
            <div className="h-72 rounded-3xl bg-white shadow-sm ring-1 ring-neutral-200" />
          </div>
        </div>
      </div>
    </div>
  );
}
