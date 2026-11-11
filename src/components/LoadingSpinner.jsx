import React from "react";

export default function LoadingSpinner() {
  return (
    <div className="flex justify-center items-center py-8 bg-gradient-to-r from-[#181818] via-[#232526] to-[#414345]">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-yellow-400 border-r-pink-500 border-l-cyan-400"></div>
      <span className="ml-2 text-lg font-semibold bg-gradient-to-r from-yellow-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent drop-shadow">
        Loading...
      </span>
    </div>
  );
}
