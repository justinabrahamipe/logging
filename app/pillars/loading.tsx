export default function PillarsLoading() {
  return (
    <div className="container mx-auto px-4 py-4 md:py-8 max-w-4xl animate-pulse">
      <div className="flex items-center justify-between mb-6">
        <div className="h-9 w-32 bg-zinc-200 dark:bg-zinc-700 rounded-lg" />
        <div className="h-10 w-28 bg-zinc-200 dark:bg-zinc-700 rounded-lg" />
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-zinc-200 dark:bg-zinc-700 rounded-full" />
              <div className="flex-1">
                <div className="h-5 w-32 bg-zinc-200 dark:bg-zinc-700 rounded mb-1" />
                <div className="h-3 w-48 bg-zinc-200 dark:bg-zinc-700 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
