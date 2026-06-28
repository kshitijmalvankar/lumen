import { Skeleton } from "@/components/ui/skeleton";

export default function LibraryLoading() {
  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Skeleton className="h-9 w-40" />
          <Skeleton className="mt-2 h-4 w-24" />
        </div>
        <Skeleton className="h-9 w-full rounded-lg sm:w-72" />
      </div>

      <div className="mt-5 flex gap-2">
        <Skeleton className="h-8 w-14 rounded-full" />
        <Skeleton className="h-8 w-20 rounded-full" />
      </div>

      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <li key={i} className="flex flex-col gap-3 rounded-xl border bg-card p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-5/6" />
                <Skeleton className="h-5 w-2/3" />
              </div>
              <Skeleton className="h-7 w-7 rounded-md" />
            </div>
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="mt-1 h-3 w-32" />
          </li>
        ))}
      </ul>
    </div>
  );
}
