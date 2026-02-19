export default function TwelveWeekYearLoading() {
  return (
    <div className="container mx-auto px-4 py-4 md:py-8 max-w-5xl animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="h-9 w-48 bg-gray-200 dark:bg-gray-700 rounded-lg mb-2" />
          <div className="h-4 w-64 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
        <div className="h-10 w-32 bg-gray-200 dark:bg-gray-700 rounded-lg" />
      </div>

      {/* Cycle cards */}
      {[1, 2].map((i) => (
        <div
          key={i}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-5 mb-4"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="h-6 w-52 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded-full" />
          </div>
          <div className="h-4 w-40 bg-gray-200 dark:bg-gray-700 rounded mb-3" />
          <div className="h-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full" />
        </div>
      ))}
    </div>
  );
}
