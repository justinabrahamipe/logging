"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { FaClock, FaCalendar, FaCheck, FaMoon, FaSun, FaDesktop, FaTasks, FaFlag, FaUsers, FaPuzzlePiece, FaMapMarkedAlt } from "react-icons/fa";
import { Card } from "flowbite-react";
import { useSession } from "next-auth/react";
import { useTheme } from "@/components/ThemeProvider";

type TimeFormat = "12h" | "24h";
type DateFormat = "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD" | "DD-MM-YYYY" | "MM-DD-YYYY";
type Theme = "light" | "dark" | "system";

export default function PreferencesPage() {
  const { data: session } = useSession();
  const { theme, setTheme: setGlobalTheme } = useTheme();
  const [localTheme, setLocalTheme] = useState<Theme>(theme);
  const [timeFormat, setTimeFormat] = useState<TimeFormat>("12h");
  const [dateFormat, setDateFormat] = useState<DateFormat>("DD/MM/YYYY");
  const [enableTodo, setEnableTodo] = useState(false);
  const [enableGoals, setEnableGoals] = useState(false);
  const [enablePeople, setEnablePeople] = useState(false);
  const [enablePlaces, setEnablePlaces] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

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
    try {
      const response = await fetch("/api/preferences");
      if (response.ok) {
        const data = await response.json();
        setLocalTheme(data.theme || "light");
        setTimeFormat(data.timeFormat || "12h");
        setDateFormat(data.dateFormat || "DD/MM/YYYY");
        setEnableTodo(data.enableTodo || false);
        setEnableGoals(data.enableGoals || false);
        setEnablePeople(data.enablePeople || false);
        setEnablePlaces(data.enablePlaces || false);
      }
    } catch (error) {
      console.error("Error fetching preferences:", error);
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
        const response = await fetch("/api/preferences", {
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
          }),
        });

        if (response.ok) {
          setGlobalTheme(localTheme);
          setSaved(true);
          setTimeout(() => {
            setSaved(false);
            // Reload page to update navigation
            window.location.reload();
          }, 1500);
        } else {
          console.error("Failed to save preferences");
        }
      } catch (error) {
        console.error("Error saving preferences:", error);
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

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-600 dark:text-gray-400">Loading preferences...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-4xl font-bold mb-8 text-gray-900 dark:text-white">
          Preferences
        </h1>

        <div className="space-y-6">
          {/* Theme Preference */}
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                <FaMoon className="text-2xl text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                  Theme
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Choose your preferred theme
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
          </Card>

          {/* Feature Selection */}
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <FaPuzzlePiece className="text-2xl text-green-600 dark:text-green-400" />
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
            </div>
          </Card>

          {/* Time Format Preference */}
          <Card>
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
          </Card>

          {/* Date Format Preference */}
          <Card>
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
          </Card>

          {/* Save Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSave}
            className={`w-full py-4 rounded-lg font-semibold text-lg transition-all ${
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
      </motion.div>
    </div>
  );
}
