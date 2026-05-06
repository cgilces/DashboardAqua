import React from "react";

// Skeleton placeholders con shimmer. Más natural que un spinner para listas/cards.
//
// Uso:
//   <SkeletonRow rows={5} cols={4} />
//   <SkeletonCard count={6} />

export function SkeletonRow({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2 py-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-3">
          {Array.from({ length: cols }).map((_, j) => (
            <div key={j}
              className="h-4 flex-1 rounded bg-gradient-to-r from-white/5 via-white/10 to-white/5 animate-pulse"
              style={{ animationDelay: `${(i * cols + j) * 50}ms` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonCard({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-black/20 border border-white/5 rounded-xl p-4 space-y-3 animate-pulse">
          <div className="h-3 w-1/2 bg-white/10 rounded" />
          <div className="h-6 w-3/4 bg-white/10 rounded" />
          <div className="grid grid-cols-3 gap-2">
            <div className="h-10 bg-white/5 rounded" />
            <div className="h-10 bg-white/5 rounded" />
            <div className="h-10 bg-white/5 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonKpis({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl p-3 border border-white/10 bg-black/25 animate-pulse">
          <div className="h-3 w-2/3 bg-white/10 rounded mb-2" />
          <div className="h-6 w-1/2 bg-white/15 rounded" />
        </div>
      ))}
    </div>
  );
}
