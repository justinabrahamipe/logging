"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { FaSearch, FaFilter, FaChevronDown, FaChevronUp, FaUndo, FaCheck, FaPlus, FaMinus, FaSlidersH, FaBullseye, FaEdit, FaTimes } from "react-icons/fa";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface ActivityEntry {
  id: number;
  timestamp: string;
  taskId: number | null;
  pillarId: number | null;
  action: string;
  previousValue: number | null;
  newValue: number | null;
  delta: number | null;
  pointsBefore: number | null;
  pointsAfter: number | null;
  pointsDelta: number | null;
  source: string;
  reversalOf: number | null;
  note: string | null;
  taskName: string | null;
  taskCompletionType: string | null;
  pillarName: string | null;
  pillarEmoji: string | null;
  pillarColor: string | null;
  outcomeLogId: number | null;
  outcomeLogValue: number | null;
  outcomeId: number | null;
  outcomeName: string | null;
  outcomeUnit: string | null;
}

interface Pillar {
  id: number;
  name: string;
  emoji: string;
}

function getActionIcon(action: string) {
  switch (action) {
    case 'complete': return <FaCheck className="text-green-500" />;
    case 'reverse': return <FaUndo className="text-orange-500" />;
    case 'add': return <FaPlus className="text-zinc-500" />;
    case 'subtract': return <FaMinus className="text-red-500" />;
    case 'adjust': return <FaSlidersH className="text-purple-500" />;
    case 'outcome_log': return <FaBullseye className="text-teal-500" />;
    default: return <FaCheck className="text-zinc-500" />;
  }
}

function getActionLabel(action: string) {
  switch (action) {
    case 'complete': return 'Completed';
    case 'reverse': return 'Reversed';
    case 'add': return 'Added';
    case 'subtract': return 'Subtracted';
    case 'adjust': return 'Adjusted';
    case 'outcome_log': return 'Logged';
    default: return action;
  }
}

function formatTimestamp(ts: string) {
  const date = new Date(ts);
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(ts: string) {
  const date = new Date(ts);
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function ActivityPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [pillarFilter, setPillarFilter] = useState('');
  const [useRange, setUseRange] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      setLoading(false);
      return;
    }
    if (session?.user?.id) {
      fetchPillars();
      fetchEntries();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, status]);

  const fetchPillars = async () => {
    try {
      const res = await fetch('/api/pillars');
      if (res.ok) setPillars(await res.json());
    } catch (error) {
      console.error("Failed to fetch pillars:", error);
    }
  };

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (useRange) {
        if (dateFrom) params.set('from', dateFrom);
        if (dateTo) params.set('to', dateTo);
      } else {
        if (dateFilter) params.set('date', dateFilter);
      }
      if (pillarFilter) params.set('pillarId', pillarFilter);
      if (search) params.set('search', search);

      const res = await fetch(`/api/activity?${params.toString()}`);
      if (res.ok) {
        setEntries(await res.json());
      }
    } catch (error) {
      console.error("Failed to fetch activity:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user?.id) {
      fetchEntries();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFilter, dateFrom, dateTo, pillarFilter, useRange]);

  const handleSearch = () => {
    fetchEntries();
  };

  const handleSaveOutcomeLog = async (entry: ActivityEntry) => {
    if (!entry.outcomeLogId || !entry.outcomeId) return;
    try {
      const res = await fetch(`/api/outcomes/${entry.outcomeId}/log`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logId: entry.outcomeLogId,
          value: parseFloat(editValue),
        }),
      });
      if (res.ok) {
        setEditingId(null);
        fetchEntries();
      }
    } catch (error) {
      console.error("Failed to update outcome log:", error);
    }
  };

  if (loading && entries.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-900 dark:border-zinc-100"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-4 md:py-8 max-w-4xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-white">Activity Log</h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Your immutable action history</p>
          </div>
          <motion.button
            onClick={() => setShowFilters(!showFilters)}
            className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg font-medium flex items-center gap-2 border border-zinc-200 dark:border-zinc-700"
          >
            <FaFilter className="text-sm" />
            Filters
            {showFilters ? <FaChevronUp className="text-xs" /> : <FaChevronDown className="text-xs" />}
          </motion.button>
        </div>

        {/* Filters */}
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-4 mb-6 space-y-4"
          >
            {/* Date mode toggle */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setUseRange(false)}
                className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                  !useRange ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white' : 'border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300'
                }`}
              >
                Single Day
              </button>
              <button
                onClick={() => setUseRange(true)}
                className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                  useRange ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white' : 'border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300'
                }`}
              >
                Date Range
              </button>
            </div>

            {!useRange ? (
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Date</label>
                <input
                  type="date"
                  value={dateFilter}
                  onChange={e => setDateFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">From</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={e => setDateFrom(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">To</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={e => setDateTo(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
                  />
                </div>
              </div>
            )}

            {/* Pillar filter */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Pillar</label>
              <select
                value={pillarFilter}
                onChange={e => setPillarFilter(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
              >
                <option value="">All Pillars</option>
                {pillars.map(p => (
                  <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>
                ))}
              </select>
            </div>

            {/* Search */}
            <div className="flex gap-2">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="Search by task name..."
                className="flex-1 px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
              />
              <motion.button
                onClick={handleSearch}
                className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg"
              >
                <FaSearch />
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* Entries */}
        {entries.length === 0 ? (
          <div className="text-center py-12 text-zinc-500 dark:text-zinc-400">
            <p className="text-lg mb-2">No activity found</p>
            <p className="text-sm">Complete some tasks to see your activity log</p>
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white dark:bg-zinc-800 rounded-xl shadow border border-zinc-200 dark:border-zinc-700 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  {/* Action icon */}
                  <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center flex-shrink-0">
                    {getActionIcon(entry.action)}
                  </div>

                  {/* Main content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {entry.pillarEmoji && (
                        <span className="text-sm">{entry.pillarEmoji}</span>
                      )}
                      <span className="text-sm font-medium text-zinc-900 dark:text-white truncate">
                        {entry.action === 'outcome_log' ? (entry.outcomeName || 'Outcome') : (entry.taskName || 'Unknown Task')}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        entry.action === 'complete' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                        entry.action === 'reverse' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                        entry.action === 'add' ? 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300' :
                        entry.action === 'subtract' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                        entry.action === 'outcome_log' ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' :
                        'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                      }`}>
                        {getActionLabel(entry.action)}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      <span>{formatTimestamp(entry.timestamp)}</span>
                      {entry.action === 'outcome_log' && editingId === entry.id ? (
                        <span className="flex items-center gap-1">
                          <input
                            type="number"
                            step="any"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-20 px-1.5 py-0.5 text-xs border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveOutcomeLog(entry);
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                          />
                          <span className="text-zinc-400">{entry.outcomeUnit}</span>
                          <button onClick={() => handleSaveOutcomeLog(entry)} className="text-green-500 hover:text-green-600"><FaCheck className="text-xs" /></button>
                          <button onClick={() => setEditingId(null)} className="text-zinc-400 hover:text-zinc-500"><FaTimes className="text-xs" /></button>
                        </span>
                      ) : (
                        <>
                          {entry.action === 'outcome_log' && entry.outcomeLogValue != null ? (
                            <span className="flex items-center gap-1">
                              {entry.outcomeLogValue} {entry.outcomeUnit}
                              <button
                                onClick={() => { setEditingId(entry.id); setEditValue(String(entry.outcomeLogValue)); }}
                                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                              >
                                <FaEdit className="text-xs" />
                              </button>
                            </span>
                          ) : entry.delta != null && entry.delta !== 0 ? (
                            <span>
                              Value: {entry.previousValue ?? 0} → {entry.newValue ?? 0}
                              <span className={entry.delta > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                                {' '}({entry.delta > 0 ? '+' : ''}{entry.delta})
                              </span>
                            </span>
                          ) : null}
                          {entry.pointsDelta != null && entry.pointsDelta !== 0 && (
                            <span className={entry.pointsDelta > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                              {entry.pointsDelta > 0 ? '+' : ''}{entry.pointsDelta.toFixed(1)} pts
                            </span>
                          )}
                          <span className="text-zinc-400 dark:text-zinc-500 capitalize">{entry.source}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Timestamp */}
                  <div className="text-xs text-zinc-400 dark:text-zinc-500 flex-shrink-0">
                    {useRange && formatDate(entry.timestamp)}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
