"use client";

import { useState } from "react";
import { FaPaperPlane } from "react-icons/fa";

const TYPES = [
  "Feedback",
  "Bug Report",
  "Feature Request",
  "Question",
  "Other",
];

const PAGES: Record<string, string[]> = {
  "General": [],
  "Dashboard": ["Briefing", "Score Card", "Streak Chain", "Heatmap", "Habit Tracker", "Goal Progress"],
  "Tasks": ["Task List", "Task Creation", "Task Completion", "Swipe Actions", "Filters", "Skip / Discard"],
  "Goals": ["Outcome Goals", "Habitual Goals", "Target Goals", "Momentum", "Trajectory"],
  "Cycles": ["Cycle Planning", "Weekly Review"],
  "Pillars": ["Pillar Management", "Default Points"],
  "Activity Log": [],
  "Settings": ["Theme", "Preferences", "Data Export"],
};

export default function ContactPage() {
  const [type, setType] = useState("Feedback");
  const [page, setPage] = useState("General");
  const [feature, setFeature] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const isBug = type === "Bug Report";
  const features = PAGES[page] || [];

  const handlePageChange = (newPage: string) => {
    setPage(newPage);
    setFeature("");
  };

  const handleTypeChange = (newType: string) => {
    setType(newType);
    if (newType !== "Bug Report") {
      setPage("General");
      setFeature("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError("");

    try {
      const parts = [type, page];
      if (feature) parts.push(feature);
      const topic = parts.join(" — ");

      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, message }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Something went wrong");
      }

      setSent(true);
      setMessage("");
      setType("Feedback");
      setPage("General");
      setFeature("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pt-20 pb-24 px-4">
      <div className="max-w-lg mx-auto">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">Contact Us</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
          Have feedback, a question, or just want to say hi? Drop us a message.
        </p>

        {sent ? (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-6 text-center">
            <div className="text-3xl mb-2">&#10003;</div>
            <h2 className="text-lg font-semibold text-green-700 dark:text-green-400 mb-1">Message sent!</h2>
            <p className="text-sm text-green-600 dark:text-green-500">Thanks for reaching out. We&apos;ll get back to you soon.</p>
            <button
              onClick={() => setSent(false)}
              className="mt-4 px-4 py-2 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
            >
              Send another
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Type</label>
              <select
                value={type}
                onChange={(e) => handleTypeChange(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                {TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {isBug && (
              <div className={`grid gap-3 ${features.length > 0 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Page</label>
                  <select
                    value={page}
                    onChange={(e) => handlePageChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  >
                    {Object.keys(PAGES).map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                {features.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Feature</label>
                    <select
                      value={feature}
                      onChange={(e) => setFeature(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    >
                      <option value="">All</option>
                      {features.map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                rows={5}
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                placeholder="What's on your mind?"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}

            <button
              type="submit"
              disabled={sending || !message.trim()}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors disabled:opacity-50"
            >
              <FaPaperPlane className="text-xs" />
              {sending ? "Sending..." : "Send Message"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
