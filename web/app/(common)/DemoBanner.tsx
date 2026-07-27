"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";

const demoPaths = ["/dashboard", "/tasks", "/goals", "/pillars", "/cycles"];

export default function DemoBanner() {
  const { status } = useSession();
  const pathname = usePathname();

  if (status !== "unauthenticated" || !demoPaths.includes(pathname)) return null;

  return (
    <div className="border-b border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
        <p className="text-sm text-amber-700 dark:text-amber-300">
          Viewing demo data.{" "}
          <Link href="/login" className="font-medium underline underline-offset-2 hover:text-amber-900 dark:hover:text-amber-100">
            Sign in
          </Link>{" "}
          to track your own progress.
        </p>
      </div>
    </div>
  );
}
