import { Skeleton } from "@/components/ui/skeleton";

export default function ArticleLoading() {
  return (
    <div>
      <Skeleton className="h-7 w-24" />

      <div className="mt-4 flex items-start justify-between gap-3">
        <div className="flex-1 space-y-3">
          <Skeleton className="h-9 w-11/12" />
          <Skeleton className="h-9 w-3/4" />
        </div>
        <Skeleton className="h-8 w-20 rounded-lg" />
      </div>

      <Skeleton className="mt-4 h-4 w-64" />

      <div className="mt-8 space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton
            key={i}
            className="h-4"
            style={{ width: `${[96, 100, 92, 98, 70, 95, 88, 60][i]}%` }}
          />
        ))}
      </div>
    </div>
  );
}
