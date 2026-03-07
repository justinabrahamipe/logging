export default function TasksLoading() {
  return (
    <div className="container mx-auto px-4 py-4 md:py-8 max-w-4xl animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="h-9 w-32 bg-zinc-200 dark:bg-zinc-700 rounded-lg mb-2" />
          <div className="h-4 w-48 bg-zinc-200 dark:bg-zinc-700 rounded" />
        </div>
        <div className="h-10 w-28 bg-zinc-200 dark:bg-zinc-700 rounded-lg" />
      </div>

      {/* Filter toggle */}
      <div className="flex gap-1 mb-4 w-fit">
        <div className="h-9 w-20 bg-zinc-200 dark:bg-zinc-700 rounded-md" />
        <div className="h-9 w-20 bg-zinc-200 dark:bg-zinc-700 rounded-md" />
      </div>

      {/* Score bar */}
      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-4 mb-6">
        <div className="flex justify-between mb-2">
          <div className="h-7 w-16 bg-zinc-200 dark:bg-zinc-700 rounded" />
          <div className="h-4 w-20 bg-zinc-200 dark:bg-zinc-700 rounded" />
        </div>
        <div className="h-2 w-full bg-zinc-200 dark:bg-zinc-700 rounded-full" />
      </div>

      {/* Task groups */}
      {[1, 2, 3].map((g) => (
        <div
          key={g}
          className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 overflow-hidden mb-6"
        >
          <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 flex items-center gap-2">
            <div className="h-5 w-5 bg-zinc-200 dark:bg-zinc-700 rounded" />
            <div className="h-5 w-28 bg-zinc-200 dark:bg-zinc-700 rounded" />
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-700">
            {[1, 2, 3].map((t) => (
              <div key={t} className="px-4 py-3 flex items-center justify-between">
                <div className="flex-1">
                  <div className="h-4 w-36 bg-zinc-200 dark:bg-zinc-700 rounded mb-1" />
                  <div className="h-3 w-24 bg-zinc-200 dark:bg-zinc-700 rounded" />
                </div>
                <div className="h-8 w-8 bg-zinc-200 dark:bg-zinc-700 rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
