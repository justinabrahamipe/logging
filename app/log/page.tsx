"use client";
import axios from "axios";
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaPlay, FaTimes, FaClock, FaHistory, FaFire } from "react-icons/fa";
import ActivityPreset from "./(components)/ActivityPreset";
import RunningActivity from "./(components)/RunningActivity";
import ActivityHistory from "./(components)/ActivityHistory";

type TabType = "log" | "history";

export default function Log() {
  const [activityData, setActivityData] = useState<{ data: ActivityType[] }>({
    data: [],
  });
  const [logData, setLogData] = useState<{ data: LogType[] }>({
    data: [],
  });
  const [runningLogData, setRunningLogData] = useState<{ data: LogType[] }>({
    data: [],
  });
  const [rerun, refetchAction] = useState<boolean>(false);
  const [refetchRunningLogs, setRefetchRunningLogs] = useState<boolean>(false);
  const [snackbar, setSnackbar] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("log");
  const [loading, setLoading] = useState<boolean>(true);

  // Fetch activities once on mount (they rarely change)
  useEffect(() => {
    const fetchActivities = async () => {
      const baseUrl = window.location.origin;
      try {
        const activitiesResponse = await axios.get(`${baseUrl}/api/activity`);
        setActivityData(activitiesResponse.data);
      } catch (error) {
        console.error("Error fetching activities:", error);
        setActivityData({ data: [] });
      }
    };
    fetchActivities();
  }, []);

  // Fetch all logs when needed (for history tab or initial load)
  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      const baseUrl = window.location.origin;
      try {
        const logsResponse = await axios.get(`${baseUrl}/api/log`);
        const filteredData = logsResponse.data.data.filter(
          (log: LogType) => !log.end_time
        );
        setRunningLogData({ data: filteredData });
        setLogData({ data: logsResponse.data.data });
      } catch (error) {
        console.error("Error fetching logs:", error);
        setLogData({ data: [] });
        setRunningLogData({ data: [] });
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, [rerun]);

  // Fetch only running logs when they're updated (optimized)
  useEffect(() => {
    const fetchRunningLogs = async () => {
      const baseUrl = window.location.origin;
      try {
        const logsResponse = await axios.get(`${baseUrl}/api/log`);
        const filteredData = logsResponse.data.data.filter(
          (log: LogType) => !log.end_time
        );
        setRunningLogData({ data: filteredData });
        // Also update the full log data to keep it in sync
        setLogData({ data: logsResponse.data.data });
      } catch (error) {
        console.error("Error fetching running logs:", error);
      }
    };
    if (refetchRunningLogs) {
      fetchRunningLogs();
    }
  }, [refetchRunningLogs]);

  const handleStartActivity = useCallback(async (activity: ActivityType) => {
    const startTime = new Date().toISOString();
    // Create optimistic log entry with temporary ID
    const tempId = -Date.now(); // Negative timestamp as temp ID
    const optimisticLog: LogType = {
      id: tempId,
      activityTitle: activity.title,
      activityCategory: activity.category,
      activityIcon: activity.icon,
      activityColor: activity.color || null,
      start_time: startTime,
      end_time: null,
      comment: "",
      tags: null,
      logContacts: [],
      logPlaces: [],
      goalCount: null,
    };

    // Immediate UI update (optimistic)
    setRunningLogData(prev => ({
      data: [...prev.data, optimisticLog]
    }));
    setSnackbar({ message: `Started "${activity.title}"`, type: 'info' });
    setTimeout(() => setSnackbar(null), 3000);

    // API call in background
    const baseUrl = window.location.origin;
    try {
      const response = await axios.post(`${baseUrl}/api/log`, {
        activityTitle: activity.title,
        activityCategory: activity.category,
        activityIcon: activity.icon,
        activityColor: activity.color || null,
        start_time: startTime,
        end_time: null,
        comment: "",
      });

      // Replace temp log with real one from server
      const realLog = response.data;
      setRunningLogData(prev => ({
        data: prev.data.map(log => log.id === tempId ? realLog : log)
      }));
      setLogData(prev => ({
        data: [...prev.data, realLog]
      }));
    } catch (error) {
      console.error("Error starting activity:", error);
      // Rollback optimistic update
      setRunningLogData(prev => ({
        data: prev.data.filter(log => log.id !== tempId)
      }));
      setSnackbar({ message: "Failed to start activity", type: 'error' });
      setTimeout(() => setSnackbar(null), 3000);
    }
  }, []);

  const handleStopActivity = useCallback(async (logId: number) => {
    const log = runningLogData.data.find(l => l.id === logId);
    if (!log) return;

    // Check if this is a temporary ID (still being created on server)
    if (logId < 0) {
      setSnackbar({
        message: 'Activity is still being saved, please wait a moment...',
        type: 'info'
      });
      setTimeout(() => setSnackbar(null), 2000);
      return;
    }

    const endTime = new Date().toISOString();

    // Immediate UI update (optimistic) - remove from running logs
    setRunningLogData(prev => ({
      data: prev.data.filter(l => l.id !== logId)
    }));

    // Update in main log data with end time
    setLogData(prev => ({
      data: prev.data.map(l =>
        l.id === logId ? { ...l, end_time: endTime } : l
      )
    }));

    setSnackbar({ message: `Stopped "${log.activityTitle}"`, type: 'success' });
    setTimeout(() => setSnackbar(null), 3000);

    // API call in background
    const baseUrl = window.location.origin;
    try {
      await axios.put(`${baseUrl}/api/log`, {
        id: logId,
        end_time: endTime,
      });
      // Success - optimistic update was correct, no action needed
    } catch (error) {
      console.error("Error stopping activity:", error);
      // Rollback optimistic update
      setRunningLogData(prev => ({
        data: [...prev.data, log]
      }));
      setLogData(prev => ({
        data: prev.data.map(l =>
          l.id === logId ? { ...l, end_time: null } : l
        )
      }));
      setSnackbar({ message: "Failed to stop activity", type: 'error' });
      setTimeout(() => setSnackbar(null), 3000);
    }
  }, [runningLogData.data]);

  // Optimistic update handler for running activities
  const handleOptimisticUpdate = useCallback(async (
    logId: number,
    updates: Partial<LogType>,
    apiCall: () => Promise<any>
  ) => {
    // Store original log for rollback
    const originalLog = runningLogData.data.find(l => l.id === logId);
    if (!originalLog) return;

    // Immediate UI update (optimistic)
    setRunningLogData(prev => ({
      data: prev.data.map(l =>
        l.id === logId ? { ...l, ...updates } : l
      )
    }));

    setLogData(prev => ({
      data: prev.data.map(l =>
        l.id === logId ? { ...l, ...updates } : l
      )
    }));

    // API call in background
    try {
      await apiCall();
      // Success - optimistic update was correct
    } catch (error) {
      console.error("Error updating log:", error);
      // Rollback optimistic update
      setRunningLogData(prev => ({
        data: prev.data.map(l => l.id === logId ? originalLog : l)
      }));
      setLogData(prev => ({
        data: prev.data.map(l => l.id === logId ? originalLog : l)
      }));
      throw error; // Re-throw so component can handle it
    }
  }, [runningLogData.data]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <div className="flex items-center gap-4 mb-3">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
              <FaClock className="text-white text-2xl" />
            </div>
            <div>
              <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 bg-clip-text text-transparent">
                Time Tracker
              </h1>
              <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base mt-1">
                Monitor your productivity and track your activities
              </p>
            </div>
          </div>
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          <div className="flex items-center gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveTab("log")}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ${
                activeTab === "log"
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              <FaFire className={activeTab === "log" ? "text-orange-500" : ""} />
              Log
              {runningLogData.data.length > 0 && (
                <span className="ml-1 px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-bold rounded-full">
                  {runningLogData.data.length}
                </span>
              )}
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveTab("history")}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ${
                activeTab === "history"
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              <FaHistory className={activeTab === "history" ? "text-indigo-500" : ""} />
              History
            </motion.button>
          </div>
        </motion.div>

        {/* Tab Content */}
        {loading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-center py-32"
          >
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-blue-200 dark:border-blue-800 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400 font-medium">Loading...</p>
            </div>
          </motion.div>
        ) : (
          <AnimatePresence mode="wait">
            {activeTab === "log" ? (
            <motion.div
              key="log"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              {/* Running Section */}
              {runningLogData?.data?.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="mb-10"
                >
                  <div className="flex items-center gap-2 mb-5">
                    <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-orange-600 rounded-lg flex items-center justify-center">
                      <FaFire className="text-white text-sm" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                      Active Now
                    </h2>
                    <div className="ml-2 px-3 py-1 bg-red-100 dark:bg-red-900/30 rounded-full">
                      <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                        {runningLogData.data.length} Running
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {runningLogData?.data?.map((log: LogType, index: number) => (
                      <motion.div
                        key={`${log.start_time}-${log.activityTitle}`}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <RunningActivity
                          data={log}
                          onStopAction={handleStopActivity}
                          allLogs={logData.data}
                          onUpdate={() => setRefetchRunningLogs(prev => !prev)}
                          onOptimisticUpdate={handleOptimisticUpdate}
                        />
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Presets Section */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
                    <FaPlay className="text-white text-xs ml-0.5" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Quick Start
                  </h2>
                </div>
                {activityData?.data?.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700"
                  >
                    <div className="text-6xl mb-4">⚡</div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                      No activities yet
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      Create your first activity in the Activities page to get started!
                    </p>
                  </motion.div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {activityData?.data?.map((activity: ActivityType, index: number) => (
                      <motion.div
                        key={activity.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.03 }}
                      >
                        <ActivityPreset data={activity} onStartAction={handleStartActivity} />
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="history"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <ActivityHistory data={logData.data} refetchAction={refetchAction} activities={activityData.data} onStopAction={handleStopActivity} />
              </motion.div>
            </motion.div>
            )}
          </AnimatePresence>
        )}

      </div>

      {/* Snackbar */}
      <AnimatePresence>
        {snackbar && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 right-8 z-50"
          >
            <div className={`px-6 py-4 rounded-lg shadow-lg flex items-center gap-3 ${
              snackbar.type === 'success' ? 'bg-green-600' :
              snackbar.type === 'error' ? 'bg-red-600' :
              'bg-blue-600'
            }`}>
              <span className="text-white font-medium">{snackbar.message}</span>
              <button
                onClick={() => setSnackbar(null)}
                className="text-white hover:bg-white/20 rounded p-1 transition-colors"
              >
                <FaTimes size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
