export default function OutcomesLoading() {
  return (
    <div className="container mx-auto px-4 py-4 md:py-8 max-w-4xl animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="h-9 w-40 bg-gray-200 dark:bg-gray-700 rounded-lg mb-2" />
          <div className="h-4 w-56 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
        <div className="h-10 w-32 bg-gray-200 dark:bg-gray-700 rounded-lg" />
      </div>

      {/* Outcome groups */}
      {[1, 2].map((g) => (
        <div key={g} className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-5 w-5 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
          <div className="space-y-3">
            {[1, 2].map((o) => (
              <div
                key={o}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="h-5 w-36 bg-gray-200 dark:bg-gray-700 rounded mb-1" />
                    <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
                  </div>
                  <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded" />
                </div>
                <div className="h-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full mb-1" />
                <div className="flex justify-between">
                  <div className="h-3 w-12 bg-gray-200 dark:bg-gray-700 rounded" />
                  <div className="h-3 w-8 bg-gray-200 dark:bg-gray-700 rounded" />
                  <div className="h-3 w-12 bg-gray-200 dark:bg-gray-700 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
