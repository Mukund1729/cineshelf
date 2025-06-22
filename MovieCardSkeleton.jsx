export const MovieCardSkeleton = () => (
  <div className="bg-[#0f1c2d] rounded-lg overflow-hidden animate-pulse">
    <div className="pb-[150%] relative bg-gray-700"></div>
    <div className="p-4">
      <div className="h-5 w-3/4 bg-gray-700 rounded mb-2"></div>
      <div className="h-4 w-1/2 bg-gray-700 rounded"></div>
    </div>
  </div>
);