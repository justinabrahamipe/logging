"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { FaClock, FaCalendar, FaCheck, FaCog, FaDatabase, FaTrash, FaDownload, FaExclamationTriangle, FaTasks, FaColumns, FaKey, FaCopy, FaFire, FaPalette, FaCrown, FaEye, FaEyeSlash } from "react-icons/fa";
import { useSession } from "next-auth/react";
import { useTheme } from "@/components/ThemeProvider";
import { Snackbar, Alert as MuiAlert } from "@mui/material";

type TimeFormat = "12h" | "24h";
type DateFormat = "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD" | "DD-MM-YYYY" | "MM-DD-YYYY";


export default function SettingsPage() {
  const { data: session } = useSession();
  const { dateFormat: globalDateFormat, timeFormat: globalTimeFormat, setDateFormat: setGlobalDateFormat, setTimeFormat: setGlobalTimeFormat, setHabitualColor: setGlobalHabitualColor, setTargetColor: setGlobalTargetColor, setOutcomeColor: setGlobalOutcomeColor } = useTheme();
  const [timeFormat, setTimeFormat] = useState<TimeFormat>(globalTimeFormat);
  const [dateFormat, setDateFormat] = useState<DateFormat>(globalDateFormat);

  const [saved, setSaved] = useState(false);
  const [, setLoading] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState<null | 'blank' | 'defaults'>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [streakThreshold, setStreakThreshold] = useState(95);
  const [habitualColor, setHabitualColor] = useState('#3B82F6');
  const [targetColor, setTargetColor] = useState('#F59E0B');
  const [outcomeColor, setOutcomeColor] = useState('#A855F7');
  const [isPremium, setIsPremium] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const apiKeyTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [apiKeyCopied, setApiKeyCopied] = useState(false);
  const [apiLinkCopied, setApiLinkCopied] = useState(false);
  const [mcpLinkCopied, setMcpLinkCopied] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error" | "warning" | "info";
  }>({
    open: false,
    message: "",
    severity: "info",
  });

  useEffect(() => { setDateFormat(globalDateFormat); }, [globalDateFormat]);
  useEffect(() => { setTimeFormat(globalTimeFormat); }, [globalTimeFormat]);

  useEffect(() => {
    if (session?.user?.id) {
      fetchPreferences();
    } else {
      loadFromLocalStorage();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const fetchPreferences = async () => {
    const cached = sessionStorage.getItem('userSettings');
    if (cached) {
      try {
        const data = JSON.parse(cached);
        setTimeFormat(data.timeFormat || "12h");
        setDateFormat(data.dateFormat || "DD/MM/YYYY");
        if (data.streakThreshold !== undefined) setStreakThreshold(data.streakThreshold);
        if (data.habitualColor) setHabitualColor(data.habitualColor);
        if (data.targetColor) setTargetColor(data.targetColor);
        if (data.outcomeColor) setOutcomeColor(data.outcomeColor);
        if (data.isPremium) setIsPremium(true);
      } catch {}
    }

    try {
      const response = await fetch("/api/settings");
      if (response.ok) {
        const data = await response.json();
        setTimeFormat(data.timeFormat || "12h");
        setDateFormat(data.dateFormat || "DD/MM/YYYY");
        if (data.streakThreshold !== undefined) setStreakThreshold(data.streakThreshold);
        if (data.habitualColor) setHabitualColor(data.habitualColor);
        if (data.targetColor) setTargetColor(data.targetColor);
        if (data.outcomeColor) setOutcomeColor(data.outcomeColor);
        setApiKey(data.apiKey || null);
        setIsPremium(!!data.isPremium);
        sessionStorage.setItem('userSettings', JSON.stringify(data));
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
      loadFromLocalStorage();
    } finally {
      setLoading(false);
    }
  };

  const loadFromLocalStorage = () => {
    const savedTimeFormat = localStorage.getItem("timeFormat") as TimeFormat;
    const savedDateFormat = localStorage.getItem("dateFormat") as DateFormat;

    if (savedTimeFormat) setTimeFormat(savedTimeFormat);
    if (savedDateFormat) setDateFormat(savedDateFormat);
    setLoading(false);
  };

  const handleSave = async () => {
    if (session?.user?.id) {
      try {
        const response = await fetch("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            timeFormat,
            dateFormat,
            streakThreshold,
            habitualColor,
            targetColor,
            outcomeColor,
          }),
        });

        if (response.ok) {
          setGlobalDateFormat(dateFormat);
          setGlobalTimeFormat(timeFormat);
          setGlobalHabitualColor(habitualColor);
          setGlobalTargetColor(targetColor);
          setGlobalOutcomeColor(outcomeColor);
          setSaved(true);

          const settingsData = {
            timeFormat,
            dateFormat,
            streakThreshold,
            habitualColor,
            targetColor,
            outcomeColor,
          };
          sessionStorage.setItem('userSettings', JSON.stringify(settingsData));

          setTimeout(() => setSaved(false), 1500);
        }
      } catch (error) {
        console.error("Error saving settings:", error);
      }
    } else {
      localStorage.setItem("timeFormat", timeFormat);
      localStorage.setItem("dateFormat", dateFormat);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  const getExampleTime = (format: TimeFormat) => {
    const now = new Date();
    if (format === "12h") {
      return now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
    }
    return now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  };

  const getExampleDate = (format: DateFormat) => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = now.getFullYear();

    switch (format) {
      case "DD/MM/YYYY": return `${day}/${month}/${year}`;
      case "MM/DD/YYYY": return `${month}/${day}/${year}`;
      case "YYYY-MM-DD": return `${year}-${month}-${day}`;
      case "DD-MM-YYYY": return `${day}-${month}-${year}`;
      case "MM-DD-YYYY": return `${month}-${day}-${year}`;
    }
  };

  const timeOptions: TimeFormat[] = ["12h", "24h"];
  const dateOptions: DateFormat[] = ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD", "DD-MM-YYYY", "MM-DD-YYYY"];

  const handleExportData = async (type: string) => {
    setIsExporting(true);
    try {
      const response = await fetch(`/api/export/${type}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${type}-export-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        setSnackbar({ open: true, message: `${type.charAt(0).toUpperCase() + type.slice(1)} data exported successfully!`, severity: "success" });
      } else {
        setSnackbar({ open: true, message: `Failed to export ${type} data`, severity: "error" });
      }
    } catch (error) {
      console.error(`Error exporting ${type} data:`, error);
      setSnackbar({ open: true, message: `Failed to export ${type} data`, severity: "error" });
    } finally {
      setIsExporting(false);
    }
  };

  const handleFactoryReset = async (seedDefaults: boolean) => {
    setIsResetting(true);
    try {
      const response = await fetch("/api/factory-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seedDefaults }),
      });
      const data = await response.json();
      if (response.ok) {
        const msg = seedDefaults
          ? "All data has been reset and default data loaded! Redirecting..."
          : "All data has been cleared! Redirecting...";
        setSnackbar({ open: true, message: msg, severity: "success" });
        sessionStorage.clear();
        localStorage.removeItem('tasks-filters');
        if (!seedDefaults) {
          sessionStorage.setItem('skip-auto-seed', 'true');
        }
        setTimeout(() => { window.location.href = "/dashboard"; }, 2000);
      } else {
        const detail = data?.details || data?.error || "Unknown error";
        setSnackbar({ open: true, message: `Reset failed: ${detail}`, severity: "error" });
      }
    } catch (error) {
      console.error("Error resetting data:", error);
      setSnackbar({ open: true, message: `Reset failed: ${error instanceof Error ? error.message : "Network error"}`, severity: "error" });
    } finally {
      setIsResetting(false);
      setShowResetConfirm(null);
    }
  };

  return (
    <div className="container mx-auto px-4 py-4 md:py-8 max-w-4xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6 md:mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-zinc-900 dark:bg-zinc-100 rounded-xl flex items-center justify-center shadow-sm">
              <FaCog className="text-white dark:text-zinc-900 text-xl md:text-2xl" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-white">Settings</h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 hidden sm:block">Manage your application preferences</p>
            </div>
          </div>
          <motion.button
            onClick={handleSave}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              saved
                ? "bg-green-500 hover:bg-green-600 text-white"
                : "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100"
            }`}
          >
            {saved ? (
              <span className="flex items-center gap-1.5">
                <FaCheck className="text-xs" /> Saved!
              </span>
            ) : (
              "Save"
            )}
          </motion.button>
        </div>

        <div className="space-y-4 md:space-y-6">

            {/* Time Format */}
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-4 md:p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                  <FaClock className="text-2xl text-zinc-600 dark:text-zinc-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white">Time Format</h2>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">Choose how you want time to be displayed</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {timeOptions.map((option) => (
                  <motion.button
                    key={option}
                    onClick={() => setTimeFormat(option)}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      timeFormat === option
                        ? "border-zinc-900 dark:border-zinc-100 bg-zinc-100 dark:bg-zinc-800"
                        : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-left">
                        <div className="font-semibold text-zinc-900 dark:text-white">{option === "12h" ? "12-Hour" : "24-Hour"}</div>
                        <div className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">{getExampleTime(option)}</div>
                      </div>
                      {timeFormat === option && <FaCheck className="text-zinc-900 dark:text-zinc-100" />}
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Date Format */}
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-4 md:p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                  <FaCalendar className="text-2xl text-zinc-600 dark:text-zinc-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white">Date Format</h2>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">Choose how you want dates to be displayed</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {dateOptions.map((option) => (
                  <motion.button
                    key={option}
                    onClick={() => setDateFormat(option)}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      dateFormat === option
                        ? "border-zinc-900 dark:border-zinc-100 bg-zinc-100 dark:bg-zinc-800"
                        : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-left">
                        <div className="font-semibold text-zinc-900 dark:text-white">{option}</div>
                        <div className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">{getExampleDate(option)}</div>
                      </div>
                      {dateFormat === option && <FaCheck className="text-zinc-900 dark:text-zinc-100" />}
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Streak Threshold */}
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-4 md:p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                  <FaFire className="text-2xl text-zinc-600 dark:text-zinc-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white">Streak Threshold</h2>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">Minimum action score to count as a streak day</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="50"
                    max="100"
                    step="5"
                    value={streakThreshold}
                    onChange={e => setStreakThreshold(parseInt(e.target.value))}
                    className="flex-1 accent-zinc-900 dark:accent-zinc-100"
                  />
                  <span className="text-2xl font-bold text-zinc-900 dark:text-white w-16 text-right">{streakThreshold}%</span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Days with an action score at or above {streakThreshold}% will count toward your streak.
                </p>
              </div>
            </div>

            {/* Goal Type Colors */}
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-4 md:p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                  <FaPalette className="text-2xl text-zinc-600 dark:text-zinc-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white">Goal Type Colors</h2>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">Customize colors for each goal type</p>
                </div>
              </div>

              <div className="space-y-4">
                {[
                  { label: 'Habitual', desc: 'Daily habits & routines', value: habitualColor, setter: setHabitualColor },
                  { label: 'Target', desc: 'Goals with a target to reach', value: targetColor, setter: setTargetColor },
                  { label: 'Outcome', desc: 'Outcomes not fully in your control', value: outcomeColor, setter: setOutcomeColor },
                ].map(({ label, desc, value, setter }) => {
                  const palette = [
                    '#EF4444', '#F97316', '#F59E0B', '#EAB308',
                    '#84CC16', '#22C55E', '#10B981', '#14B8A6',
                    '#06B6D4', '#0EA5E9', '#3B82F6', '#6366F1',
                    '#8B5CF6', '#A855F7', '#D946EF', '#EC4899',
                    '#F43F5E', '#78716C', '#64748B', '#1E293B',
                  ];
                  return (
                    <div key={label}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: value }} />
                        <span className="text-sm font-semibold text-zinc-900 dark:text-white">{label}</span>
                        <span className="text-xs text-zinc-400 dark:text-zinc-500">{desc}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {palette.map(c => (
                          <button
                            key={c}
                            onClick={() => setter(c)}
                            className={`w-7 h-7 rounded-lg transition-all ${value === c ? 'ring-2 ring-offset-2 ring-zinc-900 dark:ring-white dark:ring-offset-zinc-800 scale-110' : 'hover:scale-110'}`}
                            style={{ backgroundColor: c }}
                            title={c}
                          />
                        ))}
                        <label className="w-7 h-7 rounded-lg border-2 border-dashed border-zinc-300 dark:border-zinc-600 cursor-pointer flex items-center justify-center hover:scale-110 transition-all" title="Custom color">
                          <span className="text-[10px] text-zinc-400">+</span>
                          <input type="color" value={value} onChange={e => setter(e.target.value)} className="sr-only" />
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Export Data */}
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-4 md:p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                  <FaDownload className="text-2xl text-zinc-600 dark:text-zinc-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white">Export Data</h2>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">Download your data as CSV files</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { type: "pillars", label: "Pillars", icon: FaColumns },
                  { type: "tasks", label: "Tasks", icon: FaTasks },
                  { type: "completions", label: "Completions", icon: FaCheck },
                ].map(({ type, label, icon: Icon }) => (
                  <motion.button
                    key={type}
                    onClick={() => handleExportData(type)}
                    disabled={isExporting}
                    className="px-4 py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Icon className="text-lg" />
                    <span className="text-sm">{label}</span>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* API Access */}
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-4 md:p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                  <FaKey className="text-2xl text-zinc-600 dark:text-zinc-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white">API Access</h2>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">Share your data with AI tools via API</p>
                </div>
              </div>

              {apiKey ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-3 py-2 bg-zinc-100 dark:bg-zinc-900 rounded-lg text-xs text-zinc-700 dark:text-zinc-300 font-mono truncate select-none">
                      {apiKeyVisible ? apiKey : apiKey.slice(0, 6) + '••••••••••••••••••••'}
                    </code>
                    <button
                      onClick={() => {
                        if (apiKeyTimerRef.current) clearTimeout(apiKeyTimerRef.current);
                        if (!apiKeyVisible) {
                          setApiKeyVisible(true);
                          apiKeyTimerRef.current = setTimeout(() => setApiKeyVisible(false), 5000);
                        } else {
                          setApiKeyVisible(false);
                        }
                      }}
                      className="p-2 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 shrink-0"
                      title={apiKeyVisible ? "Hide key" : "Show key (5s)"}
                    >
                      {apiKeyVisible ? <FaEyeSlash /> : <FaEye />}
                    </button>
                    <button
                      onClick={() => { navigator.clipboard.writeText(apiKey); setApiKeyCopied(true); setTimeout(() => setApiKeyCopied(false), 2000); }}
                      className="p-2 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 shrink-0"
                      title="Copy"
                    >
                      {apiKeyCopied ? <FaCheck className="text-green-500" /> : <FaCopy />}
                    </button>
                  </div>
                  <div className="bg-zinc-50 dark:bg-zinc-900 rounded-lg p-3 text-xs text-zinc-600 dark:text-zinc-400 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-zinc-700 dark:text-zinc-300">Endpoint:</p>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/api/locations/public?key=${apiKey}`);
                          setApiLinkCopied(true);
                          setTimeout(() => setApiLinkCopied(false), 2000);
                        }}
                        className="text-[10px] px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-600 flex items-center gap-1"
                      >
                        {apiLinkCopied ? <><FaCheck className="text-green-500" /> Copied</> : <><FaCopy /> Copy link</>}
                      </button>
                    </div>
                    <code className="block truncate">{typeof window !== 'undefined' ? window.location.origin : ''}/api/locations/public?key={apiKeyVisible ? apiKey : apiKey.slice(0, 6) + '••••'}</code>
                    <p className="mt-2">Params: <code>section=all|logs|tasks|goals|scores|pillars</code>, <code>format=text|json</code>, <code>search=</code>, <code>from=</code>, <code>to=</code></p>

                    <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700">
                      <p className="font-medium text-zinc-700 dark:text-zinc-300">Claude.ai Connector:</p>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/api/mcp?key=${apiKey}`);
                          setMcpLinkCopied(true);
                          setTimeout(() => setMcpLinkCopied(false), 2000);
                        }}
                        className="text-[10px] px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-600 flex items-center gap-1"
                      >
                        {mcpLinkCopied ? <><FaCheck className="text-green-500" /> Copied</> : <><FaCopy /> Copy link</>}
                      </button>
                    </div>
                    <code className="block truncate">{typeof window !== 'undefined' ? window.location.origin : ''}/api/mcp?key={apiKeyVisible ? apiKey : apiKey.slice(0, 6) + '••••'}</code>
                    <p className="mt-1">Add this as a custom connector in Claude.ai (Settings → Connectors → Add custom connector)</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        const res = await fetch("/api/settings/api-key", { method: "POST" });
                        if (res.ok) { const d = await res.json(); setApiKey(d.apiKey); setApiKeyVisible(true); if (apiKeyTimerRef.current) clearTimeout(apiKeyTimerRef.current); apiKeyTimerRef.current = setTimeout(() => setApiKeyVisible(false), 5000); setSnackbar({ open: true, message: "API key regenerated — visible for 5 seconds", severity: "success" }); }
                      }}
                      className="px-3 py-2 text-sm rounded-lg bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-600"
                    >
                      Regenerate
                    </button>
                    <button
                      onClick={async () => {
                        const res = await fetch("/api/settings/api-key", { method: "DELETE" });
                        if (res.ok) { setApiKey(null); setSnackbar({ open: true, message: "API access disabled", severity: "info" }); }
                      }}
                      className="px-3 py-2 text-sm rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      Disable
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={async () => {
                    const res = await fetch("/api/settings/api-key", { method: "POST" });
                    if (res.ok) { const d = await res.json(); setApiKey(d.apiKey); setApiKeyVisible(true); if (apiKeyTimerRef.current) clearTimeout(apiKeyTimerRef.current); apiKeyTimerRef.current = setTimeout(() => setApiKeyVisible(false), 5000); setSnackbar({ open: true, message: "API access enabled — key visible for 5 seconds", severity: "success" }); }
                  }}
                  className="px-4 py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 font-semibold rounded-lg transition-all flex items-center gap-2"
                >
                  <FaKey />
                  <span className="text-sm">Enable API Access</span>
                </button>
              )}
            </div>

            {/* Reset Options */}
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-red-200 dark:border-red-900/50 p-4 md:p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
                  <FaTrash className="text-2xl text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white">Reset Data</h2>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">Clear your data and start over</p>
                </div>
              </div>

              <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-2">
                  <FaExclamationTriangle className="text-red-600 dark:text-red-400 mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-red-800 dark:text-red-300 mb-1">Warning: This action cannot be undone!</p>
                    <p className="text-sm text-red-700 dark:text-red-400">
                      This will permanently delete ALL your data including pillars, tasks, completions, and scores.
                    </p>
                  </div>
                </div>
              </div>

              {!showResetConfirm ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <motion.button
                    onClick={() => setShowResetConfirm('blank')}
                    className="px-6 py-4 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-all flex flex-col items-center gap-1"
                  >
                    <div className="flex items-center gap-2">
                      <FaTrash /> Start Blank
                    </div>
                    <span className="text-xs font-normal opacity-80">Delete everything and start fresh</span>
                  </motion.button>
                  <motion.button
                    onClick={() => setShowResetConfirm('defaults')}
                    className="px-6 py-4 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg transition-all flex flex-col items-center gap-1"
                  >
                    <div className="flex items-center gap-2">
                      <FaDatabase /> Load Defaults
                    </div>
                    <span className="text-xs font-normal opacity-80">Reset and load default pillars & tasks</span>
                  </motion.button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="font-semibold text-zinc-900 dark:text-white">
                    {showResetConfirm === 'blank'
                      ? 'This will delete ALL data with nothing re-created.'
                      : 'This will delete ALL data and load default pillars & tasks.'}
                  </p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Type &quot;DELETE&quot; to confirm:
                  </p>
                  <input
                    type="text"
                    id="confirmDelete"
                    placeholder='Type DELETE to confirm'
                    className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
                  />
                  <div className="flex gap-3">
                    <motion.button
                      onClick={() => {
                        const input = document.getElementById("confirmDelete") as HTMLInputElement;
                        if (input.value === "DELETE") {
                          handleFactoryReset(showResetConfirm === 'defaults');
                        } else {
                          setSnackbar({ open: true, message: "Please type DELETE to confirm", severity: "warning" });
                        }
                      }}
                      disabled={isResetting}
                      className={`px-6 py-3 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${
                        showResetConfirm === 'blank'
                          ? 'bg-red-600 hover:bg-red-700'
                          : 'bg-orange-600 hover:bg-orange-700'
                      }`}
                    >
                      {isResetting
                        ? (<><span className="animate-spin">&#9203;</span> Resetting...</>)
                        : (<><FaTrash /> {showResetConfirm === 'blank' ? 'Confirm Blank Reset' : 'Confirm & Load Defaults'}</>)
                      }
                    </motion.button>
                    <motion.button
                      onClick={() => setShowResetConfirm(null)}
                      className="px-6 py-3 bg-zinc-300 dark:bg-zinc-600 hover:bg-zinc-400 dark:hover:bg-zinc-500 text-zinc-900 dark:text-white font-semibold rounded-lg transition-all"
                    >
                      Cancel
                    </motion.button>
                  </div>
                </div>
              )}
            </div>
          </div>
      </motion.div>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <MuiAlert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </MuiAlert>
      </Snackbar>
    </div>
  );
}
