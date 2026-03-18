export default function DashboardLoading() {
  return (
    <div className="container mx-auto px-4 py-4 md:py-8 max-w-7xl animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="h-9 w-48 bg-zinc-200 dark:bg-zinc-700 rounded-lg mb-2" />
          <div className="h-4 w-32 bg-zinc-200 dark:bg-zinc-700 rounded" />
        </div>
        <div className="h-10 w-28 bg-zinc-200 dark:bg-zinc-700 rounded-lg" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left column */}
        <div className="xl:col-span-7 space-y-6">
          {/* Briefing card */}
          <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6">
            <div className="h-5 w-36 bg-zinc-200 dark:bg-zinc-700 rounded mb-4" />
            <div className="grid grid-cols-3 gap-4">
              <div className="h-16 bg-zinc-200 dark:bg-zinc-700 rounded-lg" />
              <div className="h-16 bg-zinc-200 dark:bg-zinc-700 rounded-lg" />
              <div className="h-16 bg-zinc-200 dark:bg-zinc-700 rounded-lg" />
            </div>
          </div>

          {/* Score card */}
          <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="h-6 w-32 bg-zinc-200 dark:bg-zinc-700 rounded" />
              <div className="h-6 w-20 bg-zinc-200 dark:bg-zinc-700 rounded-full" />
            </div>
            <div className="h-6 w-full bg-zinc-200 dark:bg-zinc-700 rounded-full mb-2" />
            <div className="flex justify-between">
              <div className="h-4 w-20 bg-zinc-200 dark:bg-zinc-700 rounded" />
              <div className="h-5 w-12 bg-zinc-200 dark:bg-zinc-700 rounded" />
            </div>
          </div>

          {/* Goals */}
          <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-4">
            <div className="h-6 w-24 bg-zinc-200 dark:bg-zinc-700 rounded mb-3" />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-zinc-200 dark:bg-zinc-700 rounded-xl" />
              ))}
            </div>
          </div>

          {/* Habits */}
          <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-4">
            <div className="h-6 w-24 bg-zinc-200 dark:bg-zinc-700 rounded mb-3" />
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-5 bg-zinc-200 dark:bg-zinc-700 rounded" />
              ))}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="xl:col-span-5 space-y-6">
          {/* Streak */}
          <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6">
            <div className="h-6 w-20 bg-zinc-200 dark:bg-zinc-700 rounded mb-4" />
            <div className="flex gap-1 justify-center">
              {[...Array(7)].map((_, i) => (
                <div key={i} className="w-8 h-8 bg-zinc-200 dark:bg-zinc-700 rounded-full" />
              ))}
            </div>
          </div>

          {/* Calendar */}
          <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6">
            <div className="h-6 w-32 bg-zinc-200 dark:bg-zinc-700 rounded mb-4" />
            <div className="h-28 bg-zinc-200 dark:bg-zinc-700 rounded" />
          </div>

          {/* History chart */}
          <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6">
            <div className="h-6 w-36 bg-zinc-200 dark:bg-zinc-700 rounded mb-4" />
            <div className="h-40 bg-zinc-200 dark:bg-zinc-700 rounded" />
          </div>

          {/* Pillar breakdown */}
          <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6">
            <div className="h-6 w-40 bg-zinc-200 dark:bg-zinc-700 rounded mb-4" />
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i}>
                  <div className="h-4 w-28 bg-zinc-200 dark:bg-zinc-700 rounded mb-1" />
                  <div className="h-3 w-full bg-zinc-200 dark:bg-zinc-700 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
