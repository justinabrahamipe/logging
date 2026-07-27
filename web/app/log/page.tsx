"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { FaPlus, FaEdit, FaTrash, FaTimes, FaMapMarkerAlt, FaSearch, FaSortAmountDown, FaSortAmountUp, FaDownload } from "react-icons/fa";
import { formatDate } from "@/lib/format";
import { useTheme } from "@/components/ThemeProvider";
import LocationsLoading from "./loading";

interface LocationLog {
  id: number;
  latitude: number;
  longitude: number;
  date: string;
  time: string | null;
  notes: string | null;
  createdAt: string;
}

export default function LogPage() {
  const { data: session, status } = useSession();
  const { dateFormat } = useTheme();
  const router = useRouter();
  const [logs, setLogs] = useState<LocationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortAsc, setSortAsc] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [quickNote, setQuickNote] = useState("");
  const [quickSaving, setQuickSaving] = useState(false);
  const quickInputRef = useRef<HTMLTextAreaElement>(null);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch(`/api/locations?sort=${sortAsc ? "asc" : "desc"}`);
      if (res.ok) setLogs(await res.json());
    } catch (err) {
      console.error("Failed to fetch logs:", err);
    } finally {
      setLoading(false);
    }
  }, [sortAsc]);

  useEffect(() => {
    if (status === "unauthenticated") { setLoading(false); return; }
    if (session?.user?.id) fetchLogs();
  }, [session, status, fetchLogs]);

  const handleDelete = async (id: number) => {
    try {
      await fetch(`/api/locations/${id}`, { method: "DELETE" });
      setLogs(prev => prev.filter(l => l.id !== id));
    } catch (err) {
      console.error("Failed to delete:", err);
    }
    setDeleteConfirmId(null);
  };

  const handleQuickLog = async () => {
    if (!quickNote.trim() || quickSaving) return;
    setQuickSaving(true);
    try {
      const now = new Date();
      const date = now.toISOString().split("T")[0];
      const time = now.toTimeString().slice(0, 5);
      let latitude = 0;
      let longitude = 0;
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 5000 })
        );
        latitude = pos.coords.latitude;
        longitude = pos.coords.longitude;
      } catch {}
      const res = await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latitude, longitude, date, time, notes: quickNote.trim() }),
      });
      if (res.ok) {
        const newLog = await res.json();
        setLogs(prev => sortAsc ? [...prev, newLog] : [newLog, ...prev]);
        setQuickNote("");
        if (quickInputRef.current) quickInputRef.current.style.height = 'auto';
      }
    } catch (err) {
      console.error("Quick log failed:", err);
    } finally {
      setQuickSaving(false);
    }
  };

  // Fuzzy search: split terms, match all against notes
  const filtered = useMemo(() => {
    if (!search.trim()) return logs;
    const terms = search.toLowerCase().split(/\s+/).filter(Boolean);
    return logs.filter(l => {
      const text = (l.notes || "").toLowerCase();
      return terms.every(t => text.includes(t));
    });
  }, [logs, search]);

  // Group by date
  const grouped = useMemo(() => {
    const map = new Map<string, LocationLog[]>();
    for (const log of filtered) {
      const arr = map.get(log.date) || [];
      arr.push(log);
      map.set(log.date, arr);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const handleDownload = () => {
    const lines: string[] = [];
    for (const [date, entries] of grouped) {
      lines.push(`--- ${date} ---`);
      for (const log of entries) {
        const coords = `${log.latitude.toFixed(6)}, ${log.longitude.toFixed(6)}`;
        const mapLink = `https://www.google.com/maps?q=${log.latitude},${log.longitude}`;
        lines.push(`  Location: ${coords}`);
        lines.push(`  Map: ${mapLink}`);
        if (log.notes) lines.push(`  Notes: ${log.notes}`);
        lines.push("");
      }
    }
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `log${search ? "-search" : ""}-${new Date().toISOString().split("T")[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <LocationsLoading />;

  return (
    <div className="container mx-auto px-4 py-4 md:py-8 max-w-5xl">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl md:text-2xl font-bold text-zinc-900 dark:text-white">Log</h1>
          <div className="flex items-center gap-2">
            {filtered.length > 0 && (
              <button
                onClick={handleDownload}
                className="p-2 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                title="Download as text"
              >
                <FaDownload />
              </button>
            )}
            <button
              onClick={() => setSortAsc(!sortAsc)}
              className="p-2 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700"
              title={sortAsc ? "Oldest first" : "Newest first"}
            >
              {sortAsc ? <FaSortAmountUp /> : <FaSortAmountDown />}
            </button>
            <button
              onClick={() => router.push("/log/new")}
              className="p-2.5 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100"
            >
              <FaPlus />
            </button>
          </div>
        </div>

        {/* Quick Log */}
        <div className="flex gap-2 mb-3 items-end">
          <textarea
            ref={quickInputRef}
            value={quickNote}
            onChange={e => {
              setQuickNote(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = e.target.scrollHeight + 'px';
            }}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleQuickLog(); } }}
            placeholder="Quick log..."
            rows={1}
            className="flex-1 px-3 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:focus:ring-zinc-600 resize-none overflow-hidden"
          />
          <button
            onClick={handleQuickLog}
            disabled={!quickNote.trim() || quickSaving}
            className="px-3 py-2.5 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 disabled:opacity-50 transition-colors shrink-0"
          >
            {quickSaving ? (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <FaPlus className="text-sm" />
            )}
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm" />
          <input
            ref={searchInputRef}
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search notes..."
            className="w-full pl-9 pr-8 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:focus:ring-zinc-600"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
              <FaTimes className="text-xs" />
            </button>
          )}
        </div>

        {/* Timeline */}
        {grouped.length === 0 ? (
          <div className="text-center py-12 text-zinc-500 dark:text-zinc-400">
            <FaMapMarkerAlt className="text-3xl mx-auto mb-3 opacity-50" />
            <p className="text-sm">{search ? "No matching entries" : "No log entries yet"}</p>
            {!search && <p className="text-xs mt-1">Tap + to create your first entry</p>}
          </div>
        ) : (
          <div className="space-y-4">
            {grouped.map(([date, entries]) => (
              <div key={date}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-zinc-400 dark:bg-zinc-500" />
                  <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                    {formatDate(date, dateFormat)}
                  </span>
                  <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-700" />
                </div>
                <div className="ml-1 pl-3 border-l-2 border-zinc-200 dark:border-zinc-700 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  <AnimatePresence>
                    {entries.map(log => (
                      <motion.div
                        key={log.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 hover:shadow-sm transition-shadow"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            {log.notes && (
                              <p className="text-sm text-zinc-900 dark:text-white mb-1 whitespace-pre-wrap">{log.notes}</p>
                            )}
                            <div className="flex flex-wrap items-center gap-2">
                              {log.time && (
                                <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{log.time}</span>
                              )}
                              <a
                                href={`https://www.google.com/maps?q=${log.latitude},${log.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                                title={`${log.latitude.toFixed(4)}, ${log.longitude.toFixed(4)}`}
                              >
                                <FaMapMarkerAlt className="text-sm" />
                              </a>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => router.push(`/log/${log.id}/edit`)}
                              className="p-1.5 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                            >
                              <FaEdit className="text-xs" />
                            </button>
                            {deleteConfirmId === log.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleDelete(log.id)}
                                  className="px-2 py-1 rounded text-xs font-medium text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400"
                                >
                                  Delete
                                </button>
                                <button
                                  onClick={() => setDeleteConfirmId(null)}
                                  className="px-2 py-1 rounded text-xs font-medium text-zinc-500 bg-zinc-100 dark:bg-zinc-700 dark:text-zinc-400"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeleteConfirmId(log.id)}
                                className="p-1.5 rounded text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                              >
                                <FaTrash className="text-xs" />
                              </button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Count */}
        {filtered.length > 0 && (
          <div className="text-center mt-6 text-xs text-zinc-400 dark:text-zinc-500">
            {filtered.length} entr{filtered.length === 1 ? "y" : "ies"}{search ? " matching" : ""}
          </div>
        )}

      </motion.div>
    </div>
  );
}
