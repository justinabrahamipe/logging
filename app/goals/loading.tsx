"use client";

import { FaBullseye } from "react-icons/fa";

export default function Loading() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="w-16 h-16 mb-4 mx-auto">
          <div className="w-full h-full border-4 border-purple-200 dark:border-purple-800 border-t-purple-600 dark:border-t-purple-400 rounded-full animate-spin"></div>
        </div>
        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 font-medium">
          <FaBullseye className="text-purple-600 dark:text-purple-400" />
          <p>Loading goals...</p>
        </div>
      </div>
    </div>
  );
}
