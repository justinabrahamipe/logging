export default function DashboardLoading() {
  const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
    <div className={`bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6 mb-6 ${className}`}>
      {children}
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-4 md:py-8 max-w-[1800px] animate-pulse">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="h-9 w-48 bg-zinc-200 dark:bg-zinc-700 rounded-lg mb-2" />
          <div className="h-4 w-32 bg-zinc-200 dark:bg-zinc-700 rounded" />
        </div>
        <div className="h-10 w-28 bg-zinc-200 dark:bg-zinc-700 rounded-lg" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-6">
        <div>
          <Card>
            <div className="h-5 w-36 bg-zinc-200 dark:bg-zinc-700 rounded mb-4" />
            <div className="grid grid-cols-3 gap-4">
              {[1, 2, 3].map(i => <div key={i} className="h-16 bg-zinc-200 dark:bg-zinc-700 rounded-lg" />)}
            </div>
          </Card>
          <Card>
            <div className="h-6 w-32 bg-zinc-200 dark:bg-zinc-700 rounded mb-4" />
            <div className="h-6 w-full bg-zinc-200 dark:bg-zinc-700 rounded-full mb-2" />
            <div className="h-4 w-20 bg-zinc-200 dark:bg-zinc-700 rounded" />
          </Card>
          <Card>
            <div className="h-6 w-24 bg-zinc-200 dark:bg-zinc-700 rounded mb-3" />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[1, 2, 3].map(i => <div key={i} className="h-20 bg-zinc-200 dark:bg-zinc-700 rounded-xl" />)}
            </div>
          </Card>
          <Card>
            <div className="h-6 w-32 bg-zinc-200 dark:bg-zinc-700 rounded mb-4" />
            <div className="h-28 bg-zinc-200 dark:bg-zinc-700 rounded" />
          </Card>
        </div>

        <div>
          <Card>
            <div className="h-6 w-24 bg-zinc-200 dark:bg-zinc-700 rounded mb-3" />
            <div className="space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="h-5 bg-zinc-200 dark:bg-zinc-700 rounded" />)}
            </div>
          </Card>
          <Card>
            <div className="h-6 w-20 bg-zinc-200 dark:bg-zinc-700 rounded mb-4" />
            <div className="flex gap-1 justify-center">
              {[...Array(7)].map((_, i) => <div key={i} className="w-8 h-8 bg-zinc-200 dark:bg-zinc-700 rounded-full" />)}
            </div>
          </Card>
          <Card>
            <div className="h-6 w-36 bg-zinc-200 dark:bg-zinc-700 rounded mb-4" />
            <div className="h-40 bg-zinc-200 dark:bg-zinc-700 rounded" />
          </Card>
          <Card className="2xl:hidden">
            <div className="h-6 w-40 bg-zinc-200 dark:bg-zinc-700 rounded mb-4" />
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i}>
                  <div className="h-4 w-28 bg-zinc-200 dark:bg-zinc-700 rounded mb-1" />
                  <div className="h-3 w-full bg-zinc-200 dark:bg-zinc-700 rounded-full" />
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="hidden 2xl:block">
          <Card>
            <div className="h-6 w-40 bg-zinc-200 dark:bg-zinc-700 rounded mb-4" />
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i}>
                  <div className="h-4 w-28 bg-zinc-200 dark:bg-zinc-700 rounded mb-1" />
                  <div className="h-3 w-full bg-zinc-200 dark:bg-zinc-700 rounded-full" />
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
