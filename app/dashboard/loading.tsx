export default function DashboardLoading() {
  return (
    <div className="container mx-auto px-4 py-4 md:py-8 max-w-[1800px] animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="h-9 w-48 bg-zinc-200 dark:bg-zinc-700 rounded-lg mb-2" />
          <div className="h-4 w-32 bg-zinc-200 dark:bg-zinc-700 rounded" />
        </div>
        <div className="h-10 w-28 bg-zinc-200 dark:bg-zinc-700 rounded-lg" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 2xl:grid-cols-3 gap-6">
        {/* Column 1 */}
        <div className="xl:col-span-7 2xl:col-span-1 space-y-6">
          <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6">
            <div className="h-5 w-36 bg-zinc-200 dark:bg-zinc-700 rounded mb-4" />
            <div className="grid grid-cols-3 gap-4">
              <div className="h-16 bg-zinc-200 dark:bg-zinc-700 rounded-lg" />
              <div className="h-16 bg-zinc-200 dark:bg-zinc-700 rounded-lg" />
              <div className="h-16 bg-zinc-200 dark:bg-zinc-700 rounded-lg" />
            </div>
          </div>
          <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6">
            <div className="h-6 w-32 bg-zinc-200 dark:bg-zinc-700 rounded mb-4" />
            <div className="h-6 w-full bg-zinc-200 dark:bg-zinc-700 rounded-full mb-2" />
            <div className="h-4 w-20 bg-zinc-200 dark:bg-zinc-700 rounded" />
          </div>
          <div className="hidden 2xl:block space-y-6">
            <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6">
              <div className="h-6 w-20 bg-zinc-200 dark:bg-zinc-700 rounded mb-4" />
              <div className="flex gap-1 justify-center">
                {[...Array(7)].map((_, i) => (
                  <div key={i} className="w-8 h-8 bg-zinc-200 dark:bg-zinc-700 rounded-full" />
                ))}
              </div>
            </div>
            <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6">
              <div className="h-6 w-32 bg-zinc-200 dark:bg-zinc-700 rounded mb-4" />
              <div className="h-28 bg-zinc-200 dark:bg-zinc-700 rounded" />
            </div>
          </div>
        </div>

        {/* Column 2 */}
        <div className="xl:col-span-5 2xl:col-span-1 space-y-6">
          <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-4">
            <div className="h-6 w-24 bg-zinc-200 dark:bg-zinc-700 rounded mb-3" />
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-20 bg-zinc-200 dark:bg-zinc-700 rounded-xl" />
              ))}
            </div>
          </div>
          <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-4">
            <div className="h-6 w-24 bg-zinc-200 dark:bg-zinc-700 rounded mb-3" />
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-5 bg-zinc-200 dark:bg-zinc-700 rounded" />
              ))}
            </div>
          </div>
          <div className="2xl:hidden space-y-6">
            <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6">
              <div className="h-6 w-20 bg-zinc-200 dark:bg-zinc-700 rounded mb-4" />
              <div className="h-8 bg-zinc-200 dark:bg-zinc-700 rounded" />
            </div>
            <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6">
              <div className="h-6 w-36 bg-zinc-200 dark:bg-zinc-700 rounded mb-4" />
              <div className="h-40 bg-zinc-200 dark:bg-zinc-700 rounded" />
            </div>
          </div>
        </div>

        {/* Column 3 (ultrawide only) */}
        <div className="hidden 2xl:block 2xl:col-span-1 space-y-6">
          <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6">
            <div className="h-6 w-36 bg-zinc-200 dark:bg-zinc-700 rounded mb-4" />
            <div className="h-40 bg-zinc-200 dark:bg-zinc-700 rounded" />
          </div>
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
