"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { FaPlus, FaEdit, FaTrash, FaTimes, FaMapMarkerAlt, FaSearch, FaSortAmountDown, FaSortAmountUp, FaExternalLinkAlt, FaDownload } from "react-icons/fa";
import { formatDate } from "@/lib/format";
import { useTheme } from "@/components/ThemeProvider";
import LocationsLoading from "./loading";

interface LocationLog {
  id: number;
  latitude: number;
  longitude: number;
  date: string;
  notes: string | null;
  createdAt: string;
}

export default function LocationsPage() {
  const { data: session, status } = useSession();
  const { dateFormat } = useTheme();
  const [logs, setLogs] = useState<LocationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortAsc, setSortAsc] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingLog, setEditingLog] = useState<LocationLog | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [formData, setFormData] = useState({ latitude: "", longitude: "", date: new Date().toISOString().split("T")[0], notes: "" });
  const [saving, setSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch(`/api/locations?sort=${sortAsc ? "asc" : "desc"}`);
      if (res.ok) setLogs(await res.json());
    } catch (err) {
      console.error("Failed to fetch locations:", err);
    } finally {
      setLoading(false);
    }
  }, [sortAsc]);

  useEffect(() => {
    if (status === "unauthenticated") { setLoading(false); return; }
    if (session?.user?.id) fetchLogs();
  }, [session, status, fetchLogs]);

  const detectLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormData(prev => ({
          ...prev,
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
        }));
        setDetecting(false);
      },
      () => setDetecting(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const openCreateForm = () => {
    setEditingLog(null);
    setFormData({ latitude: "", longitude: "", date: new Date().toISOString().split("T")[0], notes: "" });
    setShowForm(true);
    detectLocation();
  };

  const openEditForm = (log: LocationLog) => {
    setEditingLog(log);
    setFormData({
      latitude: String(log.latitude),
      longitude: String(log.longitude),
      date: log.date,
      notes: log.notes || "",
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    const lat = parseFloat(formData.latitude);
    const lng = parseFloat(formData.longitude);
    if (isNaN(lat) || isNaN(lng) || !formData.date) return;
    setSaving(true);
    try {
      const body = { latitude: lat, longitude: lng, date: formData.date, notes: formData.notes };
      if (editingLog) {
        await fetch(`/api/locations/${editingLog.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      } else {
        await fetch("/api/locations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      }
      setShowForm(false);
      setEditingLog(null);
      await fetchLogs();
    } catch (err) {
      console.error("Failed to save:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await fetch(`/api/locations/${id}`, { method: "DELETE" });
      setLogs(prev => prev.filter(l => l.id !== id));
    } catch (err) {
      console.error("Failed to delete:", err);
    }
    setDeleteConfirmId(null);
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
    a.download = `locations${search ? "-search" : ""}-${new Date().toISOString().split("T")[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

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

  if (loading) return <LocationsLoading />;

  return (
    <div className="container mx-auto px-4 py-4 md:py-8 max-w-4xl">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl md:text-2xl font-bold text-zinc-900 dark:text-white">Locations</h1>
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
              onClick={openCreateForm}
              className="p-2.5 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100"
            >
              <FaPlus />
            </button>
          </div>
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
            <p className="text-sm">{search ? "No matching entries" : "No location logs yet"}</p>
            {!search && <p className="text-xs mt-1">Tap + to log your first location</p>}
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
                <div className="space-y-2 ml-1 pl-3 border-l-2 border-zinc-200 dark:border-zinc-700">
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
                              <p className="text-sm text-zinc-900 dark:text-white mb-1">{log.notes}</p>
                            )}
                            <div className="flex flex-wrap items-center gap-2">
                              <a
                                href={`https://www.google.com/maps?q=${log.latitude},${log.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
                              >
                                <FaMapMarkerAlt className="text-[9px]" />
                                {log.latitude.toFixed(4)}, {log.longitude.toFixed(4)}
                                <FaExternalLinkAlt className="text-[8px]" />
                              </a>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => openEditForm(log)}
                              className="p-1.5 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                            >
                              <FaEdit className="text-xs" />
                            </button>
                            {deleteConfirmId === log.id ? (
                              <button
                                onClick={() => handleDelete(log.id)}
                                className="px-2 py-1 rounded text-xs font-medium text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30"
                              >
                                Confirm
                              </button>
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

      {/* Form Modal */}
      <AnimatePresence>
        {showForm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40"
              onClick={() => { setShowForm(false); setEditingLog(null); }}
            />
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-zinc-800 rounded-t-2xl shadow-xl border-t border-zinc-200 dark:border-zinc-700 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] max-h-[80vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                  {editingLog ? "Edit Location" : "Log Location"}
                </h2>
                <button onClick={() => { setShowForm(false); setEditingLog(null); }} className="p-1 text-zinc-400 hover:text-zinc-600">
                  <FaTimes />
                </button>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Latitude</label>
                    <input
                      type="number"
                      step="any"
                      value={formData.latitude}
                      onChange={e => setFormData(prev => ({ ...prev, latitude: e.target.value }))}
                      placeholder={detecting ? "Detecting..." : "-90 to 90"}
                      className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Longitude</label>
                    <input
                      type="number"
                      step="any"
                      value={formData.longitude}
                      onChange={e => setFormData(prev => ({ ...prev, longitude: e.target.value }))}
                      placeholder={detecting ? "Detecting..." : "-180 to 180"}
                      className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-white"
                    />
                  </div>
                </div>

                {!editingLog && (
                  <button
                    onClick={detectLocation}
                    disabled={detecting}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
                  >
                    {detecting ? "Detecting GPS..." : "Re-detect location"}
                  </button>
                )}

                <div>
                  <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Date</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={e => setFormData(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    rows={3}
                    placeholder="What happened here..."
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-white resize-none"
                  />
                </div>

                <button
                  onClick={handleSave}
                  disabled={saving || !formData.latitude || !formData.longitude || !formData.date}
                  className="w-full py-2.5 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-100 disabled:opacity-50"
                >
                  {saving ? "Saving..." : editingLog ? "Update" : "Save"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
