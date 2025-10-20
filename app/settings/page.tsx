"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { FaClock, FaCalendar, FaCheck, FaMoon, FaSun, FaDesktop, FaTasks, FaFlag, FaUsers, FaCubes, FaMapMarkedAlt, FaDollarSign, FaCog, FaSlidersH, FaDatabase, FaTrash, FaDownload, FaExclamationTriangle, FaBullseye, FaClipboardList, FaBook } from "react-icons/fa";
import { useSession } from "next-auth/react";
import { useTheme } from "@/components/ThemeProvider";
import { Snackbar, Alert as MuiAlert } from "@mui/material";

type TimeFormat = "12h" | "24h";
type DateFormat = "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD" | "DD-MM-YYYY" | "MM-DD-YYYY";
type Theme = "light" | "dark" | "system";
type SettingsTab = "preferences" | "data";

export default function SettingsPage() {
  const { data: session } = useSession();
  const { theme, setTheme: setGlobalTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<SettingsTab>("preferences");
  const [localTheme, setLocalTheme] = useState<Theme>(theme);
  const [timeFormat, setTimeFormat] = useState<TimeFormat>("12h");
  const [dateFormat, setDateFormat] = useState<DateFormat>("DD/MM/YYYY");
  const [enableTodo, setEnableTodo] = useState(false);
  const [enableGoals, setEnableGoals] = useState(false);
  const [enablePeople, setEnablePeople] = useState(false);
  const [enablePlaces, setEnablePlaces] = useState(false);
  const [enableFinance, setEnableFinance] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error" | "warning" | "info";
  }>({
    open: false,
    message: "",
    severity: "info",
  });

  // Sync local theme with global theme
  useEffect(() => {
    setLocalTheme(theme);
  }, [theme]);

  useEffect(() => {
    // Load preferences from API if authenticated, otherwise from localStorage
    if (session?.user?.id) {
      fetchPreferences();
    } else {
      loadFromLocalStorage();
    }
  }, [session]);

  const fetchPreferences = async () => {
    // Try to load from sessionStorage first for instant render
    const cached = sessionStorage.getItem('userSettings');
    if (cached) {
      try {
        const data = JSON.parse(cached);
        setLocalTheme(data.theme || "light");
        setTimeFormat(data.timeFormat || "12h");
        setDateFormat(data.dateFormat || "DD/MM/YYYY");
        setEnableTodo(data.enableTodo || false);
        setEnableGoals(data.enableGoals || false);
        setEnablePeople(data.enablePeople || false);
        setEnablePlaces(data.enablePlaces || false);
        setEnableFinance(data.enableFinance || false);
      } catch (e) {
        // Ignore parse errors
      }
    }

    try {
      const response = await fetch("/api/settings");
      if (response.ok) {
        const data = await response.json();
        setLocalTheme(data.theme || "light");
        setTimeFormat(data.timeFormat || "12h");
        setDateFormat(data.dateFormat || "DD/MM/YYYY");
        setEnableTodo(data.enableTodo || false);
        setEnableGoals(data.enableGoals || false);
        setEnablePeople(data.enablePeople || false);
        setEnablePlaces(data.enablePlaces || false);
        setEnableFinance(data.enableFinance || false);
        // Cache for next time
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
    const savedTheme = localStorage.getItem("theme") as Theme;
    const savedTimeFormat = localStorage.getItem("timeFormat") as TimeFormat;
    const savedDateFormat = localStorage.getItem("dateFormat") as DateFormat;

    if (savedTheme) setLocalTheme(savedTheme);
    if (savedTimeFormat) setTimeFormat(savedTimeFormat);
    if (savedDateFormat) setDateFormat(savedDateFormat);
    setLoading(false);
  };

  const handleSave = async () => {
    if (session?.user?.id) {
      // Save to database via API
      try {
        const response = await fetch("/api/settings", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            theme: localTheme,
            timeFormat,
            dateFormat,
            enableTodo,
            enableGoals,
            enablePeople,
            enablePlaces,
            enableFinance,
          }),
        });

        if (response.ok) {
          setGlobalTheme(localTheme);
          setSaved(true);

          // Update caches
          const settingsData = {
            theme: localTheme,
            timeFormat,
            dateFormat,
            enableTodo,
            enableGoals,
            enablePeople,
            enablePlaces,
            enableFinance,
          };
          sessionStorage.setItem('userSettings', JSON.stringify(settingsData));
          sessionStorage.setItem('enabledFeatures', JSON.stringify({
            todo: enableTodo,
            goals: enableGoals,
            people: enablePeople,
            places: enablePlaces,
            finance: enableFinance,
          }));

          // Dispatch custom event to update header without reload
          window.dispatchEvent(new CustomEvent('settingsUpdated', {
            detail: {
              enableTodo,
              enableGoals,
              enablePeople,
              enablePlaces,
              enableFinance,
            }
          }));

          setTimeout(() => {
            setSaved(false);
          }, 1500);
        } else {
          console.error("Failed to save settings");
        }
      } catch (error) {
        console.error("Error saving settings:", error);
      }
    } else {
      // Save to localStorage
      localStorage.setItem("theme", localTheme);
      localStorage.setItem("timeFormat", timeFormat);
      localStorage.setItem("dateFormat", dateFormat);
      setGlobalTheme(localTheme);
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
      case "DD/MM/YYYY":
        return `${day}/${month}/${year}`;
      case "MM/DD/YYYY":
        return `${month}/${day}/${year}`;
      case "YYYY-MM-DD":
        return `${year}-${month}-${day}`;
      case "DD-MM-YYYY":
        return `${day}-${month}-${year}`;
      case "MM-DD-YYYY":
        return `${month}-${day}-${year}`;
    }
  };

  const timeOptions: TimeFormat[] = ["12h", "24h"];
  const dateOptions: DateFormat[] = [
    "DD/MM/YYYY",
    "MM/DD/YYYY",
    "YYYY-MM-DD",
    "DD-MM-YYYY",
    "MM-DD-YYYY"
  ];

  const themeOptions: { value: Theme; label: string; icon: typeof FaMoon }[] = [
    { value: "light", label: "Light", icon: FaSun },
    { value: "dark", label: "Dark", icon: FaMoon },
    { value: "system", label: "System", icon: FaDesktop },
  ];

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
        setSnackbar({
          open: true,
          message: `${type.charAt(0).toUpperCase() + type.slice(1)} data exported successfully!`,
          severity: "success",
        });
      } else {
        setSnackbar({
          open: true,
          message: `Failed to export ${type} data`,
          severity: "error",
        });
      }
    } catch (error) {
      console.error(`Error exporting ${type} data:`, error);
      setSnackbar({
        open: true,
        message: `Failed to export ${type} data`,
        severity: "error",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleFactoryReset = async () => {
    setIsResetting(true);
    try {
      const response = await fetch("/api/factory-reset", {
        method: "POST",
      });
      if (response.ok) {
        setSnackbar({
          open: true,
          message: "All data has been deleted successfully! Redirecting...",
          severity: "success",
        });
        setTimeout(() => {
          window.location.href = "/";
        }, 2000);
      } else {
        setSnackbar({
          open: true,
          message: "Failed to reset data. Please try again.",
          severity: "error",
        });
      }
    } catch (error) {
      console.error("Error resetting data:", error);
      setSnackbar({
        open: true,
        message: "Failed to reset data. Please try again.",
        severity: "error",
      });
    } finally {
      setIsResetting(false);
      setShowResetConfirm(false);
    }
  };

  const tabs = [
    { id: "preferences" as SettingsTab, label: "Preferences", icon: FaSlidersH },
    { id: "data" as SettingsTab, label: "Data Management", icon: FaDatabase },
  ];

  return (
    <div className="container mx-auto px-4 py-4 md:py-8 max-w-4xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-6 md:mb-8">
          <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
            <FaCog className="text-white text-xl md:text-2xl" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
              Settings
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 hidden sm:block">Manage your application preferences</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto overflow-y-hidden -mx-4 px-4 md:mx-0 md:px-0">
          <div className="flex gap-2 min-w-max md:min-w-0">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <motion.button
                  key={tab.id}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors whitespace-nowrap ${
                    isActive
                      ? "bg-blue-600 text-white shadow-lg"
                      : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500"
                  }`}
                >
                  <tab.icon className="text-sm" />
                  <span className="font-medium text-sm md:text-base">{tab.label}</span>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === "preferences" && (
          <div className="space-y-4 md:space-y-6">
            {/* Theme Preference */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 md:p-6">
              <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
                <div className="p-2 md:p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                  <FaMoon className="text-xl md:text-2xl text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h2 className="text-lg md:text-2xl font-semibold text-gray-900 dark:text-white">
                    Theme
                  </h2>
                  <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400">
                    Choose your preferred theme
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
                {themeOptions.map((option) => (
                  <motion.button
                    key={option.value}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setLocalTheme(option.value)}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      localTheme === option.value
                        ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-left">
                        <div className="flex items-center gap-2">
                          <option.icon className="text-lg text-indigo-600 dark:text-indigo-400" />
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {option.label}
                          </span>
                        </div>
                      </div>
                      {localTheme === option.value && (
                        <FaCheck className="text-indigo-500" />
                      )}
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Feature Selection */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 md:p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <FaCubes className="text-2xl text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                    Features
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Choose which features to enable (Activities and Log are always enabled)
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {/* Todo Feature */}
                <motion.div
                  whileHover={{ scale: 1.01 }}
                  onClick={() => setEnableTodo(!enableTodo)}
                  className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                    enableTodo
                      ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FaTasks className={`text-xl ${enableTodo ? "text-green-600 dark:text-green-400" : "text-gray-400"}`} />
                      <div>
                        <div className="font-semibold text-gray-900 dark:text-white">
                          Todo
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          Manage your tasks and to-do lists
                        </div>
                      </div>
                    </div>
                    {enableTodo && <FaCheck className="text-green-500" />}
                  </div>
                </motion.div>

                {/* Goals Feature */}
                <motion.div
                  whileHover={{ scale: 1.01 }}
                  onClick={() => setEnableGoals(!enableGoals)}
                  className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                    enableGoals
                      ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FaFlag className={`text-xl ${enableGoals ? "text-green-600 dark:text-green-400" : "text-gray-400"}`} />
                      <div>
                        <div className="font-semibold text-gray-900 dark:text-white">
                          Goals
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          Set and track your personal goals
                        </div>
                      </div>
                    </div>
                    {enableGoals && <FaCheck className="text-green-500" />}
                  </div>
                </motion.div>

                {/* People Feature */}
                <motion.div
                  whileHover={{ scale: 1.01 }}
                  onClick={() => setEnablePeople(!enablePeople)}
                  className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                    enablePeople
                      ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FaUsers className={`text-xl ${enablePeople ? "text-green-600 dark:text-green-400" : "text-gray-400"}`} />
                      <div>
                        <div className="font-semibold text-gray-900 dark:text-white">
                          People
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          Manage your contacts and relationships
                        </div>
                      </div>
                    </div>
                    {enablePeople && <FaCheck className="text-green-500" />}
                  </div>
                </motion.div>

                {/* Places Feature */}
                <motion.div
                  whileHover={{ scale: 1.01 }}
                  onClick={() => setEnablePlaces(!enablePlaces)}
                  className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                    enablePlaces
                      ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FaMapMarkedAlt className={`text-xl ${enablePlaces ? "text-green-600 dark:text-green-400" : "text-gray-400"}`} />
                      <div>
                        <div className="font-semibold text-gray-900 dark:text-white">
                          Places
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          Track and manage places you visit
                        </div>
                      </div>
                    </div>
                    {enablePlaces && <FaCheck className="text-green-500" />}
                  </div>
                </motion.div>

                {/* Finance Feature */}
                <motion.div
                  whileHover={{ scale: 1.01 }}
                  onClick={() => setEnableFinance(!enableFinance)}
                  className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                    enableFinance
                      ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FaDollarSign className={`text-xl ${enableFinance ? "text-green-600 dark:text-green-400" : "text-gray-400"}`} />
                      <div>
                        <div className="font-semibold text-gray-900 dark:text-white">
                          Finance
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          Track your financial activities
                        </div>
                      </div>
                    </div>
                    {enableFinance && <FaCheck className="text-green-500" />}
                  </div>
                </motion.div>
              </div>
            </div>

            {/* Time Format Preference */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 md:p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <FaClock className="text-2xl text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                    Time Format
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Choose how you want time to be displayed
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {timeOptions.map((option) => (
                  <motion.button
                    key={option}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setTimeFormat(option)}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      timeFormat === option
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-left">
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {option === "12h" ? "12-Hour" : "24-Hour"}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {getExampleTime(option)}
                        </div>
                      </div>
                      {timeFormat === option && (
                        <FaCheck className="text-blue-500" />
                      )}
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Date Format Preference */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 md:p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <FaCalendar className="text-2xl text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                    Date Format
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Choose how you want dates to be displayed
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {dateOptions.map((option) => (
                  <motion.button
                    key={option}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setDateFormat(option)}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      dateFormat === option
                        ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-left">
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {option}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {getExampleDate(option)}
                        </div>
                      </div>
                      {dateFormat === option && (
                        <FaCheck className="text-purple-500" />
                      )}
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Save Button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSave}
              className={`w-full py-3 md:py-4 rounded-lg font-semibold text-base md:text-lg transition-all touch-target ${
                saved
                  ? "bg-green-500 hover:bg-green-600 text-white"
                  : "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
              }`}
            >
              {saved ? (
                <span className="flex items-center justify-center gap-2">
                  <FaCheck /> Saved Successfully!
                </span>
              ) : (
                "Save Preferences"
              )}
            </motion.button>
          </div>
        )}

        {/* Data Management Tab */}
        {activeTab === "data" && (
          <div className="space-y-4 md:space-y-6">
            {/* Export Data Section */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 md:p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <FaDownload className="text-2xl text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                    Export Data
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Download all your data as CSV files
                  </p>
                </div>
              </div>

              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Export your data to CSV format. Choose which data you want to export.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  { type: "activities", label: "Activities", icon: FaBullseye },
                  { type: "log", label: "Logs", icon: FaClipboardList },
                  { type: "bible", label: "Bible Readings", icon: FaBook },
                  { type: "todo", label: "Todos", icon: FaTasks },
                  { type: "goals", label: "Goals", icon: FaFlag },
                  { type: "people", label: "People", icon: FaUsers },
                  { type: "places", label: "Places", icon: FaMapMarkedAlt },
                  { type: "finance", label: "Finance", icon: FaDollarSign },
                ].map(({ type, label, icon: Icon }) => (
                  <motion.button
                    key={type}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleExportData(type)}
                    disabled={isExporting}
                    className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Icon className="text-lg" />
                    <span className="text-sm">{label}</span>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Factory Reset Section */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-red-200 dark:border-red-900/50 p-4 md:p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
                  <FaTrash className="text-2xl text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                    Factory Reset
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Delete all data and generate sample data
                  </p>
                </div>
              </div>

              <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-2">
                  <FaExclamationTriangle className="text-red-600 dark:text-red-400 mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-red-800 dark:text-red-300 mb-1">
                      Warning: This action cannot be undone!
                    </p>
                    <p className="text-sm text-red-700 dark:text-red-400">
                      This will permanently delete ALL your data including activities, logs, Bible readings,
                      goals, todos, people, places, and finance records. Sample data will be generated for each page.
                    </p>
                  </div>
                </div>
              </div>

              {!showResetConfirm ? (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowResetConfirm(true)}
                  className="w-full sm:w-auto px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2"
                >
                  <FaTrash /> Factory Reset
                </motion.button>
              ) : (
                <div className="space-y-3">
                  <p className="font-semibold text-gray-900 dark:text-white">
                    Are you absolutely sure? Type "DELETE" to confirm:
                  </p>
                  <input
                    type="text"
                    id="confirmDelete"
                    placeholder="Type DELETE to confirm"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  <div className="flex gap-3">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        const input = document.getElementById("confirmDelete") as HTMLInputElement;
                        if (input.value === "DELETE") {
                          handleFactoryReset();
                        } else {
                          setSnackbar({
                            open: true,
                            message: "Please type DELETE to confirm",
                            severity: "warning",
                          });
                        }
                      }}
                      disabled={isResetting}
                      className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isResetting ? (
                        <>
                          <span className="animate-spin">⏳</span> Resetting...
                        </>
                      ) : (
                        <>
                          <FaTrash /> Confirm Reset
                        </>
                      )}
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setShowResetConfirm(false)}
                      className="px-6 py-3 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-900 dark:text-white font-semibold rounded-lg transition-all"
                    >
                      Cancel
                    </motion.button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </motion.div>

      {/* Snackbar for notifications */}
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
