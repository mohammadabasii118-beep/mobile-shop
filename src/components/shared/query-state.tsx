import { Skeleton } from "@/components/ui/skeleton";

export function GridSkeleton({ count = 6, className = "h-64" }: { count?: number; className?: string }) {
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: count }, (_, i) => <Skeleton key={i} className={className} />)}</div>;
}
export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return <div className="space-y-2 p-4">{Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-12" />)}</div>;
}
