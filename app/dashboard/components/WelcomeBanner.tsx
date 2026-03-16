"use client";

import { FaTimes } from "react-icons/fa";

interface WelcomeBannerProps {
  onDismiss: () => void;
}

export default function WelcomeBanner({ onDismiss }: WelcomeBannerProps) {
  return (
    <div className="bg-zinc-100 dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-4 mb-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-zinc-900 dark:text-white mb-1">Welcome to Grind Console!</h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            We&apos;ve loaded sample pillars and tasks to help you get started. Feel free to edit, delete, or add your own.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={async () => {
              if (!confirm("Clear all sample data? This will remove all pillars, tasks, and scores.")) return;
              await fetch("/api/seed", { method: "DELETE" });
              sessionStorage.setItem('skip-auto-seed', 'true');
              window.location.reload();
            }}
            className="px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 border border-red-300 dark:border-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            Clear Data
          </button>
          <button
            onClick={onDismiss}
            className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            <FaTimes className="text-xs" />
          </button>
        </div>
      </div>
    </div>
  );
}
