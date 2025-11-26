"use client";
import axios from "axios";
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaPlus, FaEdit, FaTrash, FaBullseye, FaChartLine, FaCalendarAlt, FaClock, FaCheckCircle, FaTimes, FaTh, FaList, FaSort, FaSortUp, FaSortDown, FaRedoAlt, FaPlay, FaStop, FaUsers, FaMapMarkedAlt } from "react-icons/fa";
import Snackbar from "../(components)/Snackbar";
import DeleteDialog from "../(components)/DeleteDialog";
import GoalForm from "./(components)/GoalForm";

export default function GoalsPage() {
  const [data, setData] = useState<{ data: GoalType[] }>({ data: [] });
  const [activities, setActivities] = useState<{ data: ActivityType[] }>({ data: [] });
  const [rerun, refetchAction] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [snackbar, setSnackbar] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "completed">("active");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState<GoalType>({} as GoalType);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [runningGoals, setRunningGoals] = useState<Map<number, { logId: number, startTime: Date }>>(new Map());
  const [countInputGoalId, setCountInputGoalId] = useState<number | null>(null);
  const [countInputValue, setCountInputValue] = useState<string>("");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const baseUrl = window.location.origin;
      try {
        const [goalsResponse, activitiesResponse] = await Promise.all([
          axios.get(`${baseUrl}/api/goal`),
          axios.get(`${baseUrl}/api/activity`)
        ]);
        setData(goalsResponse.data);
        setActivities(activitiesResponse.data);
      } catch (error) {
        console.error("Error fetching data:", error);
        setSnackbar({ message: "Failed to load data", type: "error" });
        setTimeout(() => setSnackbar(null), 3000);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [rerun]);

  const handleAddGoal = useCallback(async (formData: GoalType) => {
    const baseUrl = window.location.origin;
    const url = `${baseUrl}/api/goal`;
    try {
      console.log("Creating goal with data:", formData);
      console.log("Posting to URL:", url);
      const response = await axios.post(url, formData);
      console.log("Goal created successfully:", response.data);
      setShowAddForm(false);
      setEditFormData({} as GoalType);
      refetchAction(prev => !prev);
      setSnackbar({ message: `"${formData.title}" created successfully`, type: 'success' });
      setTimeout(() => setSnackbar(null), 3000);
    } catch (error: any) {
      console.error("Error creating goal:", error);
      console.error("Error response:", error.response);
      console.error("Error status:", error.response?.status);
      console.error("Error data:", error.response?.data);
      const errorMessage = error.response?.data?.error || error.message || "Failed to create goal";
      setSnackbar({ message: `Error ${error.response?.status || ''}: ${errorMessage}`, type: "error" });
      setTimeout(() => setSnackbar(null), 5000);
    }
  }, []);

  const handleCancelAdd = useCallback(() => {
    setShowAddForm(false);
    setEditingId(null);
    setEditFormData({} as GoalType);
  }, []);

  const handleDelete = useCallback((id: number) => {
    setDeleteConfirmId(id);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteConfirmId) return;
    const goal = data.data.find(g => g.id === deleteConfirmId);
    const baseUrl = window.location.origin;
    try {
      await axios.delete(`${baseUrl}/api/goal`, {
        data: { id: deleteConfirmId }
      });
      setDeleteConfirmId(null);
      refetchAction(prev => !prev);
      setSnackbar({ message: `"${goal?.title}" deleted successfully`, type: 'success' });
      setTimeout(() => setSnackbar(null), 3000);
    } catch (error) {
      console.error("Error deleting goal:", error);
      setSnackbar({ message: "Failed to delete goal", type: "error" });
      setTimeout(() => setSnackbar(null), 3000);
    }
  }, [deleteConfirmId, data.data]);

  const cancelDelete = useCallback(() => {
    setDeleteConfirmId(null);
  }, []);

  const handleEditGoal = useCallback(async (formData: GoalType) => {
    if (!editingId) return;
    const baseUrl = window.location.origin;
    try {
      // Only send fields that exist in the current Prisma client (excluding new recurring fields temporarily)
      const updatePayload = {
        id: editingId,
        title: formData.title,
        description: formData.description,
        goalType: formData.goalType,
        metricType: formData.metricType,
        targetValue: formData.targetValue,
        periodType: formData.periodType,
        startDate: formData.startDate,
        endDate: formData.endDate,
        activityTitle: formData.activityTitle,
        activityCategory: formData.activityCategory,
        color: formData.color,
        icon: formData.icon,
        isActive: formData.isActive,
        // Temporarily commented out until Prisma client is regenerated
        // isRecurring: formData.isRecurring,
        // recurrencePattern: formData.recurrencePattern,
        // recurrenceConfig: formData.recurrenceConfig,
      };

      await axios.put(`${baseUrl}/api/goal`, updatePayload);
      setEditingId(null);
      setEditFormData({} as GoalType);
      refetchAction(prev => !prev);
      setSnackbar({ message: `"${formData.title}" updated successfully`, type: 'success' });
      setTimeout(() => setSnackbar(null), 3000);
    } catch (error) {
      console.error("Error updating goal:", error);
      setSnackbar({ message: "Failed to update goal", type: "error" });
      setTimeout(() => setSnackbar(null), 3000);
    }
  }, [editingId]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleStartGoal = useCallback(async (goal: GoalType) => {
    if (goal.metricType === 'time') {
      // For time-based goals, create a log immediately and start the timer
      const baseUrl = window.location.origin;
      try {
        const startTime = new Date();
        const response = await axios.post(`${baseUrl}/api/log`, {
          activityTitle: goal.activityTitle || goal.title,
          activityCategory: goal.activityCategory || 'Goal',
          activityIcon: goal.icon || 'FaBullseye',
          activityColor: goal.color || null,
          start_time: startTime.toISOString(),
          end_time: null, // No end time yet
          goalId: goal.id,
          tags: goal.title
        });

        setRunningGoals(prev => {
          const newMap = new Map(prev);
          newMap.set(goal.id!, { logId: response.data.id, startTime });
          return newMap;
        });
        setSnackbar({ message: `Timer started for "${goal.title}"`, type: 'success' });
        setTimeout(() => setSnackbar(null), 2000);
      } catch (error) {
        console.error("Error starting timer:", error);
        setSnackbar({ message: "Failed to start timer", type: "error" });
        setTimeout(() => setSnackbar(null), 3000);
      }
    } else {
      // For count-based goals, show input dialog
      setCountInputGoalId(goal.id!);
      setCountInputValue("");
    }
  }, []);

  const handleStopGoal = useCallback(async (goal: GoalType) => {
    const runningData = runningGoals.get(goal.id!);
    if (!runningData) return;

    const baseUrl = window.location.origin;
    try {
      // Update the existing log with the end time
      await axios.put(`${baseUrl}/api/log`, {
        id: runningData.logId,
        end_time: new Date().toISOString()
      });

      // Remove from running goals
      setRunningGoals(prev => {
        const newMap = new Map(prev);
        newMap.delete(goal.id!);
        return newMap;
      });

      // Refetch goals to update progress
      refetchAction(prev => !prev);
      setSnackbar({ message: `Timer stopped for "${goal.title}"`, type: 'success' });
      setTimeout(() => setSnackbar(null), 3000);
    } catch (error) {
      console.error("Error stopping timer:", error);
      setSnackbar({ message: "Failed to stop timer", type: "error" });
      setTimeout(() => setSnackbar(null), 3000);
    }
  }, [runningGoals]);

  const handleCountSubmit = useCallback(async () => {
    if (!countInputGoalId || !countInputValue) return;

    const goal = data.data.find(g => g.id === countInputGoalId);
    if (!goal) return;

    const baseUrl = window.location.origin;
    try {
      // Create a log with the count
      await axios.post(`${baseUrl}/api/log`, {
        activityTitle: goal.activityTitle || goal.title,
        activityCategory: goal.activityCategory || 'Goal',
        activityIcon: goal.icon || 'FaBullseye',
        activityColor: goal.color || null,
        start_time: new Date().toISOString(),
        goalId: goal.id,
        goalCount: parseInt(countInputValue),
        tags: goal.title
      });

      // Reset dialog
      setCountInputGoalId(null);
      setCountInputValue("");

      // Refetch goals to update progress
      refetchAction(prev => !prev);
      setSnackbar({ message: `Log created for "${goal.title}" with count: ${countInputValue}`, type: 'success' });
      setTimeout(() => setSnackbar(null), 3000);
    } catch (error) {
      console.error("Error creating log:", error);
      setSnackbar({ message: "Failed to create log", type: "error" });
      setTimeout(() => setSnackbar(null), 3000);
    }
  }, [countInputGoalId, countInputValue, data.data]);

  const filteredData = data?.data?.filter((goal) => {
    if (filter === "completed") return goal.isCompleted;
    if (filter === "active") return !goal.isCompleted && !goal.isOverdue;
    return true;
  }).sort((a, b) => {
    if (!sortField) return 0;

    let aVal: any = a[sortField as keyof GoalType];
    let bVal: any = b[sortField as keyof GoalType];

    // Handle date fields
    if (sortField === 'startDate' || sortField === 'endDate') {
      aVal = new Date(aVal).getTime();
      bVal = new Date(bVal).getTime();
    }

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Calculate progress for different time periods
  const calculatePeriodProgress = () => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    const periods = {
      daily: { start: todayStart, progress: 0, target: 0 },
      weekly: { start: weekStart, progress: 0, target: 0 },
      monthly: { start: monthStart, progress: 0, target: 0 },
      quarterly: { start: quarterStart, progress: 0, target: 0 },
      yearly: { start: yearStart, progress: 0, target: 0 }
    };

    // Calculate progress for each active goal
    data?.data?.forEach((goal) => {
      if (!goal || goal.isCompleted || goal.isOverdue) return;

      // Safety checks
      if (!goal.currentValue && goal.currentValue !== 0) return;
      if (!goal.daysRemaining && goal.daysRemaining !== 0) return;

      // Calculate daily progress
      const totalDays = Math.ceil((new Date(goal.endDate).getTime() - new Date(goal.startDate).getTime()) / (1000 * 60 * 60 * 24));
      const elapsedDays = Math.max(0, totalDays - (goal.daysRemaining || 0));
      const currentDailyRate = elapsedDays > 0 ? (goal.currentValue || 0) / elapsedDays : 0;

      Object.entries(periods).forEach(([key, period]) => {
        const daysInPeriod = Math.max(1, Math.ceil((now.getTime() - period.start.getTime()) / (1000 * 60 * 60 * 24)));
        const expectedProgress = (goal.dailyTarget || 0) * daysInPeriod;
        const actualProgress = currentDailyRate * daysInPeriod;

        // Only add valid numbers
        if (!isNaN(actualProgress) && isFinite(actualProgress)) {
          period.progress += actualProgress;
        }
        if (!isNaN(expectedProgress) && isFinite(expectedProgress)) {
          period.target += expectedProgress;
        }
      });
    });

    return periods;
  };

  // Calculate historical progress
  const calculateHistoricalProgress = () => {
    const now = new Date();

    // Yesterday
    const yesterdayStart = new Date(now);
    yesterdayStart.setDate(now.getDate() - 1);
    yesterdayStart.setHours(0, 0, 0, 0);
    const yesterdayEnd = new Date(yesterdayStart);
    yesterdayEnd.setHours(23, 59, 59, 999);

    // Last week (7 days ago to yesterday)
    const lastWeekStart = new Date(now);
    lastWeekStart.setDate(now.getDate() - 7);
    lastWeekStart.setHours(0, 0, 0, 0);
    const lastWeekEnd = new Date(now);
    lastWeekEnd.setDate(now.getDate() - 1);
    lastWeekEnd.setHours(23, 59, 59, 999);

    // Last month
    const lastMonthStart = new Date(now);
    lastMonthStart.setMonth(now.getMonth() - 1);
    lastMonthStart.setDate(1);
    lastMonthStart.setHours(0, 0, 0, 0);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    // Last quarter
    const currentQuarter = Math.floor(now.getMonth() / 3);
    const lastQuarterStart = new Date(now.getFullYear(), (currentQuarter - 1) * 3, 1);
    if (lastQuarterStart.getFullYear() > now.getFullYear() - 2) {
      lastQuarterStart.setFullYear(now.getFullYear() - 1);
      lastQuarterStart.setMonth(9); // Q4 of last year
    }
    lastQuarterStart.setHours(0, 0, 0, 0);
    const lastQuarterEnd = new Date(lastQuarterStart);
    lastQuarterEnd.setMonth(lastQuarterStart.getMonth() + 3);
    lastQuarterEnd.setDate(0);
    lastQuarterEnd.setHours(23, 59, 59, 999);

    // Last year
    const lastYearStart = new Date(now.getFullYear() - 1, 0, 1, 0, 0, 0, 0);
    const lastYearEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);

    const historicalPeriods = {
      yesterday: { start: yesterdayStart, end: yesterdayEnd, progress: 0, target: 0 },
      lastWeek: { start: lastWeekStart, end: lastWeekEnd, progress: 0, target: 0 },
      lastMonth: { start: lastMonthStart, end: lastMonthEnd, progress: 0, target: 0 },
      lastQuarter: { start: lastQuarterStart, end: lastQuarterEnd, progress: 0, target: 0 },
      lastYear: { start: lastYearStart, end: lastYearEnd, progress: 0, target: 0 }
    };

    // Calculate progress for each goal
    data?.data?.forEach((goal) => {
      if (!goal || !goal.currentValue) return;

      const totalDays = Math.ceil((new Date(goal.endDate).getTime() - new Date(goal.startDate).getTime()) / (1000 * 60 * 60 * 24));
      const elapsedDays = Math.max(0, totalDays - (goal.daysRemaining || 0));
      const currentDailyRate = elapsedDays > 0 ? (goal.currentValue || 0) / elapsedDays : 0;

      Object.entries(historicalPeriods).forEach(([key, period]) => {
        const daysInPeriod = Math.max(1, Math.ceil((period.end.getTime() - period.start.getTime()) / (1000 * 60 * 60 * 24)));
        const expectedProgress = (goal.dailyTarget || 0) * daysInPeriod;
        const actualProgress = currentDailyRate * daysInPeriod;

        if (!isNaN(actualProgress) && isFinite(actualProgress)) {
          period.progress += actualProgress;
        }
        if (!isNaN(expectedProgress) && isFinite(expectedProgress)) {
          period.target += expectedProgress;
        }
      });
    });

    return historicalPeriods;
  };

  const periodProgress = !loading ? calculatePeriodProgress() : {
    daily: { start: new Date(), progress: 0, target: 0 },
    weekly: { start: new Date(), progress: 0, target: 0 },
    monthly: { start: new Date(), progress: 0, target: 0 },
    quarterly: { start: new Date(), progress: 0, target: 0 },
    yearly: { start: new Date(), progress: 0, target: 0 }
  };

  const historicalProgress = !loading ? calculateHistoricalProgress() : {
    yesterday: { start: new Date(), end: new Date(), progress: 0, target: 0 },
    lastWeek: { start: new Date(), end: new Date(), progress: 0, target: 0 },
    lastMonth: { start: new Date(), end: new Date(), progress: 0, target: 0 },
    lastQuarter: { start: new Date(), end: new Date(), progress: 0, target: 0 },
    lastYear: { start: new Date(), end: new Date(), progress: 0, target: 0 }
  };

  const getProgressColor = (goal: GoalType) => {
    if (goal.isCompleted) {
      return goal.goalType === 'limiting'
        ? 'from-green-500 to-emerald-600'
        : 'from-green-500 to-emerald-600';
    }
    if (goal.isOverdue) return 'from-red-500 to-rose-600';

    const progress = goal.percentComplete || 0;
    if (progress < 25) return 'from-red-500 to-orange-600';
    if (progress < 50) return 'from-orange-500 to-yellow-600';
    if (progress < 75) return 'from-yellow-500 to-lime-600';
    return 'from-lime-500 to-green-600';
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900 p-3 sm:p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
              <FaBullseye className="text-white text-lg" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                Goals
              </h1>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Track your progress and achieve your targets
              </p>
            </div>
          </div>
        </motion.div>

        {/* Progress Overview - Combined Current & Historical */}
        {!loading && data?.data?.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mb-4"
          >
            <h2 className="text-xs font-bold text-gray-900 dark:text-white mb-1.5">Progress Overview</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {[
                { key: 'daily', label: 'Today', color: 'from-blue-500 to-cyan-600', source: 'current', isCurrent: true },
                { key: 'weekly', label: 'This Week', color: 'from-purple-500 to-indigo-600', source: 'current', isCurrent: true },
                { key: 'monthly', label: 'This Month', color: 'from-pink-500 to-rose-600', source: 'current', isCurrent: true },
                { key: 'quarterly', label: 'This Quarter', color: 'from-orange-500 to-amber-600', source: 'current', isCurrent: true },
                { key: 'yearly', label: 'This Year', color: 'from-green-500 to-emerald-600', source: 'current', isCurrent: true }
              ].map((period, index) => {
                const data = periodProgress[period.key as keyof typeof periodProgress];
                const percentage = data.target > 0 ? Math.round((data.progress / data.target) * 100) : 0;
                const isOnTrack = percentage >= 100;

                return (
                  <motion.div
                    key={period.key}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 + index * 0.05 }}
                    className="bg-white dark:bg-gray-800 rounded-lg p-1.5 shadow-sm border border-gray-300 dark:border-gray-600"
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <h3 className="text-[10px] font-bold text-gray-900 dark:text-white">
                        {period.label}
                      </h3>
                      <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${
                        isOnTrack
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                      }`}>
                        {percentage}%
                      </span>
                    </div>
                    <div className="flex items-baseline gap-0.5 mb-0.5">
                      <span className="text-xs font-black text-gray-900 dark:text-white">
                        {data.progress.toFixed(1)}
                      </span>
                      <span className="text-[9px] text-gray-500 dark:text-gray-400">
                        / {data.target.toFixed(1)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1 overflow-hidden relative">
                      <div
                        className={`h-full bg-gradient-to-r ${period.color} transition-all duration-500`}
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      />
                      {/* Historical marker on current progress bar */}
                      {(() => {
                        const historicalKey = period.key === 'daily' ? 'yesterday' :
                                            period.key === 'weekly' ? 'lastWeek' :
                                            period.key === 'monthly' ? 'lastMonth' :
                                            period.key === 'quarterly' ? 'lastQuarter' :
                                            period.key === 'yearly' ? 'lastYear' : null;
                        if (!historicalKey) return null;
                        const historicalData = historicalProgress[historicalKey as keyof typeof historicalProgress];
                        const historicalPercentage = historicalData.target > 0 ? Math.round((historicalData.progress / historicalData.target) * 100) : 0;
                        const position = Math.min(historicalPercentage, 100);

                        return (
                          <div
                            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 group"
                            style={{ left: `${position}%` }}
                            title={`${period.label === 'Today' ? 'Yesterday' : period.label.replace('This', 'Last')}: ${historicalPercentage}%`}
                          >
                            {/* Marker line */}
                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0.5 h-3 bg-gray-600 dark:bg-gray-400"></div>
                            {/* Arrow pointing down */}
                            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[3px] border-r-[3px] border-t-[4px] border-l-transparent border-r-transparent border-t-gray-600 dark:border-t-gray-400"></div>
                            {/* Percentage label above */}
                            <div className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[8px] font-bold text-gray-600 dark:text-gray-400 opacity-70 group-hover:opacity-100 transition-opacity">
                              {historicalPercentage}%
                            </div>
                            {/* Tooltip on hover */}
                            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-gray-900 dark:bg-gray-700 text-white text-[9px] px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
                              {period.label === 'Today' ? 'Yesterday' : period.label.replace('This', 'Last')}: {historicalData.progress.toFixed(1)}/{historicalData.target.toFixed(1)}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Filter Tabs and View Toggle */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mb-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex gap-1.5">
              {(["active", "completed", "all"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors capitalize text-xs ${
                    filter === f
                      ? "bg-purple-600 text-white"
                      : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === "grid"
                    ? "bg-purple-600 text-white"
                    : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
                title="Grid View"
              >
                <FaTh size={14} />
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === "table"
                    ? "bg-purple-600 text-white"
                    : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
                title="Table View"
              >
                <FaList size={14} />
              </button>
            </div>
          </div>
        </motion.div>

        {/* Add/Edit Form */}
        <AnimatePresence>
          {(showAddForm || editingId !== null) && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-3 -mx-4 sm:-mx-8 px-4 sm:px-8"
            >
              <div className="max-w-[1600px] mx-auto">
                <GoalForm
                  initialData={editingId ? data.data.find(g => g.id === editingId) : undefined}
                  onSaveAction={editingId ? handleEditGoal : handleAddGoal}
                  onCancelAction={handleCancelAdd}
                  activities={activities.data}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Goals Grid */}
        {loading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-center py-32"
          >
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-purple-200 dark:border-purple-800 border-t-purple-600 dark:border-t-purple-400 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400 font-medium">Loading goals...</p>
            </div>
          </motion.div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            <AnimatePresence mode="popLayout">
              {filteredData?.map((goal: GoalType, index: number) => {
                // Calculate current daily rate and projected completion
                const totalDays = Math.ceil((new Date(goal.endDate).getTime() - new Date(goal.startDate).getTime()) / (1000 * 60 * 60 * 24));
                const elapsedDays = totalDays - (goal.daysRemaining || 0);
                const currentDailyRate = elapsedDays > 0 ? (goal.currentValue || 0) / elapsedDays : 0;
                const remaining = (goal.targetValue || 0) - (goal.currentValue || 0);
                const projectedDaysToCompletion = currentDailyRate > 0 ? remaining / currentDailyRate : Infinity;
                const projectedCompletionDate = projectedDaysToCompletion !== Infinity
                  ? new Date(Date.now() + projectedDaysToCompletion * 24 * 60 * 60 * 1000)
                  : null;

                return (
                <motion.div
                  key={goal.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-all border border-gray-200 dark:border-gray-700 overflow-hidden"
                >
                  {/* Goal Header */}
                  <div className="px-2 py-1.5">
                    <div className="flex items-start justify-between mb-0.5 gap-1.5">
                      <div className="flex items-center gap-1 min-w-0 flex-1">
                        <h3 className="text-base font-bold text-gray-900 dark:text-white truncate">
                          {goal.title}
                        </h3>
                        <span className={`px-1 py-0.5 rounded text-[9px] font-bold flex-shrink-0 ${
                          goal.goalType === 'limiting'
                            ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                            : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                        }`}>
                          {goal.goalType === 'limiting' ? 'L' : 'T'}
                        </span>
                        {goal.isRecurring && (
                          <span className="px-1 py-0.5 rounded text-[9px] font-bold flex-shrink-0 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 flex items-center gap-0.5" title={`Recurring: ${goal.recurrencePattern}`}>
                            <FaRedoAlt className="text-[7px]" />
                            {goal.recurrencePattern === 'daily' ? 'D' :
                             goal.recurrencePattern === 'weekly' ? 'W' :
                             goal.recurrencePattern === 'work-weekly' ? 'WW' :
                             goal.recurrencePattern === 'monthly' ? 'M' :
                             goal.recurrencePattern === 'quarterly' ? 'Q' :
                             goal.recurrencePattern === 'yearly' ? 'Y' : 'R'}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-0.5 flex-shrink-0">
                        {runningGoals.has(goal.id!) ? (
                          <button
                            onClick={() => handleStopGoal(goal)}
                            className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                            title="Stop and log"
                          >
                            <FaStop className="text-xs" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleStartGoal(goal)}
                            className="p-1 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
                            title={goal.metricType === 'time' ? 'Start timer' : 'Log count'}
                          >
                            <FaPlay className="text-xs" />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setEditingId(goal.id!);
                            setShowAddForm(false);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                          title="Edit goal"
                        >
                          <FaEdit className="text-xs" />
                        </button>
                        <button
                          onClick={() => handleDelete(goal.id!)}
                          className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                          title="Delete goal"
                        >
                          <FaTrash className="text-xs" />
                        </button>
                      </div>
                    </div>

                    {/* Date & Activity Row */}
                    <div className="flex items-center gap-1 mb-0.5 text-[9px]">
                      <FaCalendarAlt className="text-purple-600 dark:text-purple-400 text-[7px]" />
                      <span className="text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {new Date(goal.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(goal.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                      {goal.activityTitle && (
                        <>
                          <span className="text-gray-400">•</span>
                          <FaClock className="text-blue-600 dark:text-blue-400 text-[7px]" />
                          <span className="text-gray-600 dark:text-gray-400 truncate">
                            {goal.activityTitle}
                          </span>
                        </>
                      )}
                    </div>

                    {/* People and Places Tags */}
                    {((goal.contacts && goal.contacts.length > 0) || goal.place) && (
                      <div className="flex flex-wrap gap-1 mb-0.5">
                        {/* People */}
                        {goal.contacts && goal.contacts.length > 0 && (
                          <div className="flex items-center gap-1 flex-wrap">
                            <FaUsers className="text-blue-600 dark:text-blue-400" size={8} />
                            {goal.contacts.map((contact: any) => (
                              <span key={contact.id} className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-[9px] rounded-full">
                                {contact.name}
                              </span>
                            ))}
                          </div>
                        )}
                        {/* Place */}
                        {goal.place && (
                          <div className="flex items-center gap-1 flex-wrap">
                            <FaMapMarkedAlt className="text-green-600 dark:text-green-400" size={8} />
                            <span className="px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[9px] rounded-full" title={goal.place.address}>
                              {goal.place.name}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Progress Bar */}
                    <div className="mb-0.5">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-bold text-gray-900 dark:text-white">
                          {goal.currentValue?.toFixed(goal.metricType === 'count' ? 0 : 1)} / {goal.targetValue}{goal.metricType === 'time' ? 'h' : ''}
                        </span>
                        <span className="text-base font-black text-gray-900 dark:text-white">
                          {goal.percentComplete?.toFixed(0)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min((goal.percentComplete || 0), 100)}%` }}
                          transition={{ duration: 1, ease: "easeOut" }}
                          className={`h-full bg-gradient-to-r ${getProgressColor(goal)}`}
                        />
                      </div>
                    </div>

                    {/* Stats Row - Compact */}
                    <div className="grid grid-cols-4 gap-1 mb-0.5">
                      <div className="bg-gray-100 dark:bg-gray-700 rounded p-1">
                        <span className="text-[8px] font-semibold text-gray-600 dark:text-gray-400 block">Days</span>
                        <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">
                          {goal.daysRemaining || 0}
                        </p>
                      </div>
                      <div className="bg-gray-100 dark:bg-gray-700 rounded p-1">
                        <span className="text-[8px] font-semibold text-gray-600 dark:text-gray-400 block">Current</span>
                        <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">
                          {currentDailyRate.toFixed(goal.metricType === 'count' ? 0 : 1)}
                          <span className="text-[8px] font-semibold text-gray-600 dark:text-gray-400">/d</span>
                        </p>
                      </div>
                      <div className="bg-gray-100 dark:bg-gray-700 rounded p-1">
                        <span className="text-[8px] font-semibold text-gray-600 dark:text-gray-400 block">Target</span>
                        <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">
                          {goal.dailyTarget?.toFixed(goal.metricType === 'count' ? 0 : 1) || 0}
                          <span className="text-[8px] font-semibold text-gray-600 dark:text-gray-400">/d</span>
                        </p>
                      </div>
                      {!goal.isCompleted && (
                        <>
                          {currentDailyRate > 0 && projectedCompletionDate && projectedCompletionDate < new Date(goal.endDate) ? (
                            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded p-1">
                              <span className="text-[8px] font-semibold text-green-700 dark:text-green-400 block">Finish</span>
                              <p className="text-sm font-bold text-green-800 dark:text-green-300 leading-tight">
                                {new Date(projectedCompletionDate).getDate()}<span className="text-[8px] ml-0.5">{new Date(projectedCompletionDate).toLocaleDateString('en-US', { month: 'short' })}</span>
                              </p>
                            </div>
                          ) : currentDailyRate > 0 && projectedCompletionDate && projectedCompletionDate > new Date(goal.endDate) ? (
                            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded p-1">
                              <span className="text-[8px] font-semibold text-amber-700 dark:text-amber-400 block">Finish</span>
                              <p className="text-sm font-bold text-amber-800 dark:text-amber-300 leading-tight">
                                {new Date(projectedCompletionDate).getDate()}<span className="text-[8px] ml-0.5">{new Date(projectedCompletionDate).toLocaleDateString('en-US', { month: 'short' })}</span>
                              </p>
                            </div>
                          ) : (
                            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded p-1">
                              <span className="text-[8px] font-semibold text-blue-700 dark:text-blue-400 block">Ends</span>
                              <p className="text-sm font-bold text-blue-800 dark:text-blue-300 leading-tight">
                                {new Date(goal.endDate).getDate()}<span className="text-[8px] ml-0.5">{new Date(goal.endDate).toLocaleDateString('en-US', { month: 'short' })}</span>
                              </p>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Status Badge - Compact */}
                    {(goal.isCompleted || goal.isOverdue) && (
                      <div className="mb-0.5">
                        {goal.isCompleted && (
                          <div className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded">
                            <FaCheckCircle className="text-green-600 dark:text-green-400 text-[8px]" />
                            <span className="text-[9px] font-bold text-green-700 dark:text-green-300">
                              {goal.goalType === 'limiting' ? 'Maintained' : 'Achieved'}
                            </span>
                          </div>
                        )}
                        {goal.isOverdue && !goal.isCompleted && (
                          <div className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
                            <FaTimes className="text-red-600 dark:text-red-400 text-[8px]" />
                            <span className="text-[9px] font-bold text-red-700 dark:text-red-300">
                              Overdue
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                </motion.div>
              );
              })}
            </AnimatePresence>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <button onClick={() => handleSort('title')} className="flex items-center gap-2 text-xs font-bold text-gray-900 dark:text-white hover:text-purple-600 dark:hover:text-purple-400 transition-colors">
                        Goal
                        {sortField === 'title' ? (sortDirection === 'asc' ? <FaSortUp /> : <FaSortDown />) : <FaSort className="opacity-50" />}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-center">
                      <button onClick={() => handleSort('startDate')} className="flex items-center justify-center gap-2 text-xs font-bold text-gray-900 dark:text-white hover:text-purple-600 dark:hover:text-purple-400 transition-colors w-full">
                        Start Date
                        {sortField === 'startDate' ? (sortDirection === 'asc' ? <FaSortUp /> : <FaSortDown />) : <FaSort className="opacity-50" />}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-center">
                      <button onClick={() => handleSort('endDate')} className="flex items-center justify-center gap-2 text-xs font-bold text-gray-900 dark:text-white hover:text-purple-600 dark:hover:text-purple-400 transition-colors w-full">
                        End Date
                        {sortField === 'endDate' ? (sortDirection === 'asc' ? <FaSortUp /> : <FaSortDown />) : <FaSort className="opacity-50" />}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-center">
                      <button onClick={() => handleSort('percentComplete')} className="flex items-center justify-center gap-2 text-xs font-bold text-gray-900 dark:text-white hover:text-purple-600 dark:hover:text-purple-400 transition-colors w-full">
                        Progress
                        {sortField === 'percentComplete' ? (sortDirection === 'asc' ? <FaSortUp /> : <FaSortDown />) : <FaSort className="opacity-50" />}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-center">
                      <button onClick={() => handleSort('daysRemaining')} className="flex items-center justify-center gap-2 text-xs font-bold text-gray-900 dark:text-white hover:text-purple-600 dark:hover:text-purple-400 transition-colors w-full">
                        Days
                        {sortField === 'daysRemaining' ? (sortDirection === 'asc' ? <FaSortUp /> : <FaSortDown />) : <FaSort className="opacity-50" />}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-900 dark:text-white">Current</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-900 dark:text-white">Target</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-900 dark:text-white">Projection</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-900 dark:text-white">Status</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-900 dark:text-white">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredData?.map((goal: GoalType) => {
                    const totalDays = Math.ceil((new Date(goal.endDate).getTime() - new Date(goal.startDate).getTime()) / (1000 * 60 * 60 * 24));
                    const elapsedDays = totalDays - (goal.daysRemaining || 0);
                    const currentDailyRate = elapsedDays > 0 ? (goal.currentValue || 0) / elapsedDays : 0;
                    const remaining = (goal.targetValue || 0) - (goal.currentValue || 0);
                    const projectedDaysToCompletion = currentDailyRate > 0 ? remaining / currentDailyRate : Infinity;
                    const projectedCompletionDate = projectedDaysToCompletion !== Infinity
                      ? new Date(Date.now() + projectedDaysToCompletion * 24 * 60 * 60 * 1000)
                      : null;

                    return (
                      <tr key={goal.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-gray-900 dark:text-white">{goal.title}</span>
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                              goal.goalType === 'limiting'
                                ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                                : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            }`}>
                              {goal.goalType === 'limiting' ? 'L' : 'T'}
                            </span>
                            {goal.isRecurring && (
                              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 flex items-center gap-0.5" title={`Recurring: ${goal.recurrencePattern}`}>
                                <FaRedoAlt className="text-[8px]" />
                                {goal.recurrencePattern === 'daily' ? 'D' :
                                 goal.recurrencePattern === 'weekly' ? 'W' :
                                 goal.recurrencePattern === 'work-weekly' ? 'WW' :
                                 goal.recurrencePattern === 'monthly' ? 'M' :
                                 goal.recurrencePattern === 'quarterly' ? 'Q' :
                                 goal.recurrencePattern === 'yearly' ? 'Y' : 'R'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-sm font-black text-gray-900 dark:text-white whitespace-nowrap">
                            {new Date(goal.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-sm font-black text-gray-900 dark:text-white whitespace-nowrap">
                            {new Date(goal.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-base font-black text-gray-900 dark:text-white">
                            {goal.percentComplete?.toFixed(0)}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-base font-black text-gray-900 dark:text-white">{goal.daysRemaining || 0}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-base font-black text-gray-900 dark:text-white">
                            {currentDailyRate.toFixed(goal.metricType === 'count' ? 0 : 1)}
                            <span className="text-[10px] text-gray-600 dark:text-gray-300">/d</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-base font-black text-gray-900 dark:text-white">
                            {goal.dailyTarget?.toFixed(goal.metricType === 'count' ? 0 : 1) || 0}
                            <span className="text-[10px] text-gray-600 dark:text-gray-300">/d</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {!goal.isCompleted && (
                            <>
                              {currentDailyRate > 0 && projectedCompletionDate && projectedCompletionDate < new Date(goal.endDate) ? (
                                <span className="text-sm font-black text-green-800 dark:text-green-200">
                                  {projectedCompletionDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </span>
                              ) : currentDailyRate > 0 && projectedCompletionDate && projectedCompletionDate > new Date(goal.endDate) ? (
                                <span className="text-sm font-black text-amber-800 dark:text-amber-200">
                                  {projectedCompletionDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </span>
                              ) : (
                                <span className="text-sm font-black text-blue-800 dark:text-blue-200">
                                  {new Date(goal.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </span>
                              )}
                            </>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {goal.isCompleted ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded text-xs font-bold">
                              <FaCheckCircle />
                              Done
                            </span>
                          ) : goal.isOverdue ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded text-xs font-bold">
                              <FaTimes />
                              Overdue
                            </span>
                          ) : (
                            <span className="text-sm text-gray-500 dark:text-gray-400">Active</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            {runningGoals.has(goal.id!) ? (
                              <button
                                onClick={() => handleStopGoal(goal)}
                                className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                title="Stop and log"
                              >
                                <FaStop className="text-base" />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleStartGoal(goal)}
                                className="p-1.5 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
                                title={goal.metricType === 'time' ? 'Start timer' : 'Log count'}
                              >
                                <FaPlay className="text-base" />
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setEditingId(goal.id!);
                                setShowAddForm(false);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                              className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                              title="Edit goal"
                            >
                              <FaEdit className="text-base" />
                            </button>
                            <button
                              onClick={() => handleDelete(goal.id!)}
                              className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                              title="Delete goal"
                            >
                              <FaTrash className="text-base" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && filteredData?.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <div className="text-6xl mb-4">🎯</div>
            <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
              No goals found
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {filter === "all"
                ? "Create your first goal to get started!"
                : `No ${filter} goals yet.`}
            </p>
          </motion.div>
        )}
      </div>

      <DeleteDialog
        isOpen={deleteConfirmId !== null}
        title="Delete Goal?"
        itemName={data.data.find(g => g.id === deleteConfirmId)?.title}
        onConfirmAction={confirmDelete}
        onCancelAction={cancelDelete}
      />

      {/* Count Input Dialog */}
      <AnimatePresence>
        {countInputGoalId !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setCountInputGoalId(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 max-w-sm w-full border border-gray-200 dark:border-gray-700"
            >
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                Enter Count
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                How many {data.data.find(g => g.id === countInputGoalId)?.title} did you complete?
              </p>
              <input
                type="number"
                value={countInputValue}
                onChange={(e) => setCountInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCountSubmit();
                  }
                }}
                autoFocus
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent mb-4"
                placeholder="Enter count..."
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setCountInputGoalId(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCountSubmit}
                  disabled={!countInputValue || parseInt(countInputValue) <= 0}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Submit
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Snackbar
        message={snackbar?.message || ""}
        type={snackbar?.type || 'info'}
        isOpen={!!snackbar}
        onCloseAction={() => setSnackbar(null)}
      />

      {/* Floating Add Button */}
      {!showAddForm && !editingId && (
        <motion.button
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setShowAddForm(true)}
          className="fixed bottom-6 right-6 w-12 h-12 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full shadow-lg hover:shadow-xl flex items-center justify-center text-white z-40"
        >
          <FaPlus size={18} />
        </motion.button>
      )}
    </div>
  );
}
