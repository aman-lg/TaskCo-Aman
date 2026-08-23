export default function Loading() {
  return (
    <div className="px-4 py-6 md:px-10 md:py-8 max-w-[1200px] mx-auto">
      {/* Page-level skeleton shown during server-side data fetching */}
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-48 rounded-lg" style={{ background: "var(--panel-bg)" }} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-xl" style={{ background: "var(--panel-bg)" }} />
          ))}
        </div>
        <div className="h-64 rounded-xl" style={{ background: "var(--panel-bg)" }} />
        <div className="h-48 rounded-xl" style={{ background: "var(--panel-bg)" }} />
      </div>
    </div>
  );
}
