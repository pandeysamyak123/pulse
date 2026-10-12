// Skeleton shaped like the account workspace.
export default function Loading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading account">
      <div className="flex items-center gap-4 pt-6">
        <div className="skeleton h-12 w-12 rounded-xl" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-6 w-56" />
          <div className="skeleton h-4 w-72" />
        </div>
        <div className="skeleton h-16 w-16 rounded-full" />
      </div>
      <div className="flex gap-4 border-b border-line pb-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton h-5 w-20" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="card space-y-3 p-5 lg:col-span-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-4 w-4/5" />
          ))}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="skeleton h-24" />
            <div className="skeleton h-24" />
          </div>
        </div>
        <div className="card space-y-3 p-5">
          <div className="skeleton h-3 w-full" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-4 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
