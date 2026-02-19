export default function DashboardLoading() {
  return (
    <div className="container mx-auto px-4 py-4 md:py-8 max-w-4xl animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="h-9 w-48 bg-gray-200 dark:bg-gray-700 rounded-lg mb-2" />
          <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
        <div className="h-10 w-28 bg-gray-200 dark:bg-gray-700 rounded-lg" />
      </div>

      {/* Briefing card */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="h-5 w-36 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
        <div className="grid grid-cols-3 gap-4">
          <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded-lg" />
          <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded-lg" />
          <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        </div>
      </div>

      {/* Score card */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded-full" />
        </div>
        <div className="h-6 w-full bg-gray-200 dark:bg-gray-700 rounded-full mb-2" />
        <div className="flex justify-between">
          <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-5 w-12 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>

      {/* Pillar breakdown */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="h-6 w-40 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i}>
              <div className="flex justify-between mb-1">
                <div className="h-4 w-28 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-4 w-10 bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
              <div className="h-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full" />
            </div>
          ))}
        </div>
      </div>

      {/* XP & Streak */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
          <div className="h-12 w-12 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-2" />
          <div className="h-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full" />
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
          <div className="h-14 w-14 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto" />
        </div>
      </div>
    </div>
  );
}
