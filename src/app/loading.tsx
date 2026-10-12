// Skeleton shaped like the Today screen.
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card space-y-3 p-4">
            <div className="skeleton h-3 w-24" />
            <div className="skeleton h-8 w-14" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card space-y-4 p-4">
            <div className="flex items-center gap-3">
              <div className="skeleton h-10 w-10 rounded-xl" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-3.5 w-28" />
                <div className="skeleton h-3 w-16" />
              </div>
              <div className="skeleton h-14 w-14 rounded-full" />
            </div>
            <div className="flex gap-2">
              <div className="skeleton h-6 w-28 rounded-full" />
              <div className="skeleton h-6 w-20 rounded-full" />
            </div>
            <div className="skeleton h-3 w-full" />
            <div className="flex justify-between">
              <div className="skeleton h-6 w-24 rounded-full" />
              <div className="skeleton h-8 w-28 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
      <div className="card p-5">
        <div className="skeleton mb-4 h-4 w-40" />
        <div className="grid gap-1" style={{ gridTemplateColumns: "140px repeat(14, minmax(0,1fr))" }}>
          {Array.from({ length: 10 * 15 }).map((_, i) => (
            <div key={i} className={i % 15 === 0 ? "skeleton h-6 w-28" : "skeleton h-6"} />
          ))}
        </div>
      </div>
    </div>
  );
}
