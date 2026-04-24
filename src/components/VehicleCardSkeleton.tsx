import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton placeholder matching the VehicleCard layout 1:1 so the grid
 * doesn't shift when real cards stream in.
 *
 * Mirrors:
 *  - aspect-[3/2] image area
 *  - title (2 lines)
 *  - 3 spec rows
 *  - price block on bottom border
 */
const VehicleCardSkeleton = () => {
  return (
    <div className="glass-card overflow-hidden flex flex-col h-full">
      <Skeleton className="rounded-none rounded-t-lg aspect-[3/2] w-full" />
      <div className="p-5 flex flex-col flex-grow gap-3">
        <Skeleton className="h-5 w-4/5" />
        <Skeleton className="h-4 w-2/3" />
        <div className="flex flex-col gap-1.5 mt-2">
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-2/5" />
          <Skeleton className="h-3 w-3/5" />
        </div>
        <div className="mt-auto pt-3 border-t border-border/50">
          <Skeleton className="h-6 w-1/3" />
        </div>
      </div>
    </div>
  );
};

export default VehicleCardSkeleton;
