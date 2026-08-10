export default function AdminLoading() {
  return (
    <div className="min-h-full p-4 sm:p-8" aria-label="Cargando panel administrativo" role="status">
      <div className="mb-8 space-y-3">
        <div className="h-3 w-32 animate-pulse rounded bg-gray-200" />
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
        <div className="h-4 w-72 max-w-full animate-pulse rounded bg-gray-100" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((item) => <div key={item} className="h-24 animate-pulse rounded-xl border bg-white" />)}
      </div>
      <div className="mt-6 h-72 animate-pulse rounded-xl border bg-white" />
    </div>
  );
}
