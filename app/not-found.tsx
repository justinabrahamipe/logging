import Link from "next/link";
import { FaHome, FaQuestionCircle } from "react-icons/fa";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-zinc-800 rounded-2xl shadow-sm p-8 text-center">
        <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
          <FaQuestionCircle className="text-zinc-900 dark:text-white text-2xl" />
        </div>
        <h1 className="text-6xl font-bold text-zinc-900 dark:text-white mb-2">
          404
        </h1>
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">
          Page Not Found
        </h2>
        <p className="text-zinc-600 dark:text-zinc-400 mb-6">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-900 font-semibold rounded-lg transition-colors"
        >
          <FaHome />
          Go Home
        </Link>
      </div>
    </div>
  );
}
