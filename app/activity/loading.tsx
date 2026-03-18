export default function ActivityLoading() {
  return (
    <div className="container mx-auto px-4 py-4 md:py-8 max-w-3xl animate-pulse">
      <div className="h-9 w-40 bg-zinc-200 dark:bg-zinc-700 rounded-lg mb-6" />
      <div className="space-y-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-zinc-200 dark:bg-zinc-700 rounded-full" />
              <div className="flex-1">
                <div className="h-4 w-48 bg-zinc-200 dark:bg-zinc-700 rounded mb-1" />
                <div className="h-3 w-24 bg-zinc-200 dark:bg-zinc-700 rounded" />
              </div>
              <div className="h-4 w-12 bg-zinc-200 dark:bg-zinc-700 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
