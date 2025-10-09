"use client";
import axios from "axios";
import { useEffect, useState, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaPlus, FaSave, FaTimes, FaCalendarAlt, FaClock, FaFlag, FaCheckCircle, FaCircle, FaEdit, FaTrash, FaPlay, FaStop } from "react-icons/fa";

interface TodoFormProps {
  isEdit: boolean;
  initialData: TodoType;
  onSave: (data: TodoType) => void;
  onCancel: () => void;
  activities: ActivityType[];
}

const TodoForm = memo(({ isEdit, initialData, onSave, onCancel, activities }: TodoFormProps) => {
  const [localForm, setLocalForm] = useState(initialData);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(localForm);
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLocalForm({ ...localForm, description: e.target.value });
    // Auto-resize textarea
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  };

  const getLevelLabel = (level: number) => {
    if (level === 3) return "High";
    if (level === 2) return "Medium";
    return "Low";
  };

  const getPriorityPoints = () => {
    return (localForm.urgency || 1) * (localForm.importance || 1);
  };

  const getPriorityColor = (points: number) => {
    if (points >= 7) return "from-red-500 to-orange-500";
    if (points >= 4) return "from-yellow-500 to-orange-400";
    return "from-green-500 to-emerald-500";
  };

  const getPriorityLabel = (points: number) => {
    if (points >= 7) return "High";
    if (points >= 4) return "Medium";
    return "Low";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 mb-4 max-w-2xl"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {isEdit ? "Edit Todo" : "Add New Todo"}
        </h3>
        <div
          className={`w-8 h-8 rounded-full text-white text-sm font-bold bg-gradient-to-r ${getPriorityColor(
            getPriorityPoints()
          )} flex items-center justify-center shadow-lg`}
        >
          {getPriorityPoints()}
        </div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <input
            type="text"
            value={localForm.title || ""}
            onChange={(e) => setLocalForm({ ...localForm, title: e.target.value })}
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Title"
            autoFocus
          />
        </div>

        <div>
          <textarea
            value={localForm.description || ""}
            onChange={handleDescriptionChange}
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none overflow-hidden"
            placeholder="Description (Optional)"
            rows={1}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <select
            value={localForm.activityTitle || ""}
            onChange={(e) => {
              const selectedActivity = activities.find(a => a.title === e.target.value);
              setLocalForm({
                ...localForm,
                activityTitle: e.target.value || undefined,
                activityCategory: selectedActivity?.category || undefined
              });
            }}
            className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Activity (Optional)</option>
            {activities.map((activity) => (
              <option key={activity.id} value={activity.title}>
                {activity.title}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={localForm.work_date || ""}
            onChange={(e) => setLocalForm({ ...localForm, work_date: e.target.value })}
            className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Work Date"
          />

          <input
            type="date"
            value={localForm.deadline || ""}
            onChange={(e) => setLocalForm({ ...localForm, deadline: e.target.value })}
            className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Deadline"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Urgency
            </label>
            <div className="flex gap-1">
              {[1, 2, 3].map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setLocalForm({ ...localForm, urgency: level })}
                  className={`flex-1 py-1 rounded text-xs font-medium transition-colors ${
                    localForm.urgency === level
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                  }`}
                >
                  {getLevelLabel(level)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Importance
            </label>
            <div className="flex gap-1">
              {[1, 2, 3].map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setLocalForm({ ...localForm, importance: level })}
                  className={`flex-1 py-1 rounded text-xs font-medium transition-colors ${
                    localForm.importance === level
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                  }`}
                >
                  {getLevelLabel(level)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-lg hover:shadow-xl transition-shadow flex items-center justify-center gap-1"
          >
            <FaSave size={12} /> {isEdit ? "Save" : "Add"}
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-1"
          >
            <FaTimes size={12} /> Cancel
          </motion.button>
        </div>
      </form>
    </motion.div>
  );
});

TodoForm.displayName = "TodoForm";

export default function TodoPage() {
  const [data, setData] = useState<{ data: TodoType[] }>({ data: [] });
  const [activities, setActivities] = useState<{ data: ActivityType[] }>({ data: [] });
  const [runningLogs, setRunningLogs] = useState<{ data: LogType[] }>({ data: [] });
  const [rerun, setRerun] = useState<boolean>(false);

  // Load saved preferences or use defaults
  const [filter, setFilter] = useState<"all" | "active" | "completed">(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('todoFilterPreference');
      return (saved as "all" | "active" | "completed") || "active";
    }
    return "active";
  });

  const [dateFilter, setDateFilter] = useState<"all" | "past" | "today" | "tomorrow" | "week" | "month">(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('todoDateFilterPreference');
      return (saved as "all" | "past" | "today" | "tomorrow" | "week" | "month") || "today";
    }
    return "today";
  });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editFormData, setEditFormData] = useState<TodoType>({} as TodoType);
  const [snackbar, setSnackbar] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  // Check if current filters differ from saved preferences
  const hasUnsavedChanges = () => {
    if (typeof window === 'undefined') return false;
    const savedFilter = localStorage.getItem('todoFilterPreference') || 'active';
    const savedDateFilter = localStorage.getItem('todoDateFilterPreference') || 'today';
    return filter !== savedFilter || dateFilter !== savedDateFilter;
  };

  useEffect(() => {
    // Fetch activities
    const fetchActivities = async () => {
      const baseUrl = window.location.origin;
      try {
        const response = await axios.get(`${baseUrl}/api/activity`);
        setActivities(response.data);
      } catch (error) {
        console.error("Error fetching activities:", error);
      }
    };
    fetchActivities();
  }, []);

  useEffect(() => {
    // Fetch running logs
    const fetchRunningLogs = async () => {
      const baseUrl = window.location.origin;
      try {
        const response = await axios.get(`${baseUrl}/api/log`);
        const filtered = response.data.data.filter((log: LogType) => !log.end_time);
        setRunningLogs({ data: filtered });
      } catch (error) {
        console.error("Error fetching logs:", error);
      }
    };
    fetchRunningLogs();
  }, [rerun]);

  useEffect(() => {
    // API calls disabled - using mock data
    const mockData = [
      {
        id: 1,
        title: "Complete project documentation",
        description: "Write comprehensive docs for the new features",
        urgency: 3,
        importance: 3,
        work_date: "2025-10-09",
        deadline: "2025-10-15",
        done: false,
        activityTitle: "jhg",
        activityCategory: "jg",
      },
      {
        id: 2,
        title: "Review pull requests",
        description: "Review pending PRs from the team",
        urgency: 2,
        importance: 2,
        work_date: "2025-10-08",
        deadline: "2025-10-10",
        done: false,
      },
      {
        id: 3,
        title: "Fix authentication bug",
        description: "Users unable to login with Google OAuth",
        urgency: 3,
        importance: 2,
        work_date: "2025-10-08",
        deadline: "2025-10-09",
        done: true,
      },
    ];

    setData({ data: mockData as TodoType[] });

    // const fetchData = async () => {
    //   const baseUrl = window.location.origin;
    //   try {
    //     const response = await axios.get(`${baseUrl}/api/todo`);
    //     setData(response.data);
    //   } catch (error) {
    //     console.error("Error fetching todos:", error);
    //   }
    // };
    // fetchData();
  }, [rerun]);

  const handleToggleDone = useCallback(async (todo: TodoType) => {
    const newStatus = !todo.done;

    // If marking as done and has an activity, create a log entry
    if (newStatus && todo.activityTitle) {
      const activity = activities.data.find(a => a.title === todo.activityTitle);

      if (activity) {
        const now = new Date().toISOString();
        const newLog = {
          activityTitle: activity.title,
          activityCategory: activity.category,
          activityIcon: activity.icon,
          activityColor: activity.color || null,
          start_time: now,
          end_time: now,
          comment: `TODO-${todo.id}|${todo.title}${todo.description ? '|' + todo.description : ''}`,
        };

        const baseUrl = window.location.origin;
        try {
          await axios.post(`${baseUrl}/api/log`, newLog);
          setSnackbar({
            message: `"${todo.title}" completed and logged`,
            type: 'success'
          });
        } catch (error) {
          console.error("Error creating log:", error);
          setSnackbar({
            message: `"${todo.title}" marked as completed but failed to log`,
            type: 'error'
          });
        }
        setTimeout(() => setSnackbar(null), 3000);
      }
    } else {
      setSnackbar({
        message: `"${todo.title}" marked as ${newStatus ? 'completed' : 'incomplete'}`,
        type: 'info'
      });
      setTimeout(() => setSnackbar(null), 3000);
    }

    // Update in state only - API disabled
    setData(prevData => ({
      data: prevData.data.map(t =>
        t.id === todo.id ? { ...t, done: newStatus } : t
      )
    }));

    // const baseUrl = window.location.origin;
    // try {
    //   await axios.put(`${baseUrl}/api/todo`, {
    //     ...todo,
    //     done: !todo.done,
    //   });
    //   setRerun((x) => !x);
    // } catch (error) {
    //   console.error("Error updating todo:", error);
    // }
  }, [activities.data]);

  const handleEdit = useCallback((todo: TodoType) => {
    setEditingId(todo.id || null);
    setEditFormData(todo);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditFormData({} as TodoType);
  }, []);

  const handleSaveEdit = useCallback(async (formData: TodoType) => {
    // Update in state only - API disabled
    setData(prevData => ({
      data: prevData.data.map(t =>
        t.id === formData.id ? formData : t
      )
    }));
    setEditingId(null);
    setEditFormData({} as TodoType);
    setSnackbar({ message: `"${formData.title}" updated successfully`, type: 'success' });
    setTimeout(() => setSnackbar(null), 3000);

    // const baseUrl = window.location.origin;
    // try {
    //   await axios.put(`${baseUrl}/api/todo`, formData);
    //   setEditingId(null);
    //   setEditFormData({} as TodoType);
    //   setRerun((x) => !x);
    // } catch (error) {
    //   console.error("Error updating todo:", error);
    // }
  }, []);

  const handleAddTodo = useCallback(async (formData: TodoType) => {
    if (!formData.title || formData.title.trim() === "") {
      setSnackbar({ message: "Please enter a title for your todo", type: 'error' });
      setTimeout(() => setSnackbar(null), 3000);
      return;
    }

    // Add to state only - API disabled
    const newTodo = {
      ...formData,
      id: Date.now(), // Generate temporary ID
    };

    setData(prevData => ({
      data: [...prevData.data, newTodo as TodoType]
    }));
    setShowAddForm(false);
    setEditFormData({} as TodoType);
    setSnackbar({ message: `"${formData.title}" added successfully`, type: 'success' });
    setTimeout(() => setSnackbar(null), 3000);

    // const baseUrl = window.location.origin;
    // try {
    //   const response = await axios.post(`${baseUrl}/api/todo`, formData);
    //   console.log("Todo added successfully:", response.data);
    //   setShowAddForm(false);
    //   setEditFormData({} as TodoType);
    //   setRerun((x) => !x);
    // } catch (error: any) {
    //   console.error("Full error object:", error);
    //   const errorMessage = error.response?.data?.error || error.message || "Failed to add todo";
    //   alert(`Error: ${errorMessage}`);
    // }
  }, []);

  const handleCancelAdd = useCallback(() => {
    setShowAddForm(false);
    setEditFormData({} as TodoType);
  }, []);

  const handleDelete = useCallback((id: number) => {
    const todo = data.data.find(t => t.id === id);
    if (confirm("Are you sure you want to delete this todo?")) {
      setData(prevData => ({
        data: prevData.data.filter(t => t.id !== id)
      }));
      setSnackbar({ message: `"${todo?.title}" deleted successfully`, type: 'success' });
      setTimeout(() => setSnackbar(null), 3000);
    }
  }, [data.data]);

  const handleStartActivity = useCallback(async (todo: TodoType) => {
    const activity = activities.data.find(a => a.title === todo.activityTitle);
    if (!activity) {
      setSnackbar({ message: "Activity not found", type: 'error' });
      setTimeout(() => setSnackbar(null), 3000);
      return;
    }

    const newLog = {
      activityTitle: activity.title,
      activityCategory: activity.category,
      activityIcon: activity.icon,
      activityColor: activity.color || null,
      start_time: new Date().toISOString(),
      end_time: null,
      comment: `TODO-${todo.id}|${todo.title}${todo.description ? '|' + todo.description : ''}`,
    };

    const baseUrl = window.location.origin;
    try {
      await axios.post(`${baseUrl}/api/log`, newLog);
      setRerun(prev => !prev);
      setSnackbar({ message: `Started activity "${activity.title}" for "${todo.title}"`, type: 'info' });
      setTimeout(() => setSnackbar(null), 3000);
    } catch (error) {
      console.error("Error starting activity:", error);
      setSnackbar({ message: "Failed to start activity", type: 'error' });
      setTimeout(() => setSnackbar(null), 3000);
    }
  }, [activities.data]);

  const handleStopActivity = useCallback(async (logId: string, activityTitle: string) => {
    const baseUrl = window.location.origin;
    try {
      await axios.put(`${baseUrl}/api/log`, {
        id: logId,
        end_time: new Date().toISOString(),
      });
      setRerun(prev => !prev);
      setSnackbar({ message: `Stopped "${activityTitle}"`, type: 'success' });
      setTimeout(() => setSnackbar(null), 3000);
    } catch (error) {
      console.error("Error stopping activity:", error);
      setSnackbar({ message: "Failed to stop activity", type: 'error' });
      setTimeout(() => setSnackbar(null), 3000);
    }
  }, []);

  const handleSaveAsDefault = useCallback(() => {
    localStorage.setItem('todoFilterPreference', filter);
    localStorage.setItem('todoDateFilterPreference', dateFilter);
    setSnackbar({ message: 'Current view saved as default', type: 'success' });
    setTimeout(() => setSnackbar(null), 3000);
  }, [filter, dateFilter]);

  const getRelativeDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    if (diffDays === -1) return "Yesterday";
    if (diffDays > 1 && diffDays <= 7) return `In ${diffDays} days`;
    if (diffDays < -1 && diffDays >= -7) return `${Math.abs(diffDays)} days ago`;

    return date.toLocaleDateString('en-GB');
  };

  const getPriorityColor = (points: number) => {
    if (points >= 7) return "from-red-500 to-orange-500";
    if (points >= 4) return "from-yellow-500 to-orange-400";
    return "from-green-500 to-emerald-500";
  };

  const getPriorityLabel = (points: number) => {
    if (points >= 7) return "High";
    if (points >= 4) return "Medium";
    return "Low";
  };

  const isDateInRange = (dateString: string | undefined, range: string) => {
    if (!dateString) return false;

    const date = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    if (range === "past") {
      return targetDate < today;
    }

    if (range === "today") {
      return targetDate.getTime() === today.getTime();
    }

    if (range === "tomorrow") {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return targetDate.getTime() === tomorrow.getTime();
    }

    if (range === "week") {
      const weekEnd = new Date(today);
      weekEnd.setDate(weekEnd.getDate() + 7);
      return targetDate >= today && targetDate <= weekEnd;
    }

    if (range === "month") {
      const monthEnd = new Date(today);
      monthEnd.setMonth(monthEnd.getMonth() + 1);
      return targetDate >= today && targetDate <= monthEnd;
    }

    return false;
  };

  const filteredData = data?.data
    ?.filter((todo) => {
      // Filter by status
      if (filter === "completed" && !todo.done) return false;
      if (filter === "active" && todo.done) return false;

      // Filter by date
      if (dateFilter !== "all") {
        // Check both work_date and deadline
        const matchesWorkDate = isDateInRange(todo.work_date, dateFilter);
        const matchesDeadline = isDateInRange(todo.deadline, dateFilter);
        return matchesWorkDate || matchesDeadline;
      }

      return true;
    })
    .sort((a, b) => {
      // Sort by priority (highest first)
      const priorityA = (a.importance || 0) * (a.urgency || 0);
      const priorityB = (b.importance || 0) * (b.urgency || 0);
      return priorityB - priorityA;
    });

  const stats = {
    total: data?.data?.length || 0,
    completed: data?.data?.filter((t) => t.done).length || 0,
    active: data?.data?.filter((t) => !t.done).length || 0,
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8"
        >
          <div>
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-2">
              Todo List
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Manage your tasks and stay productive
            </p>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-3 gap-4 mb-8"
        >
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats.total}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Total</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
            <div className="text-2xl font-bold text-blue-600">
              {stats.active}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Active</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
            <div className="text-2xl font-bold text-green-600">
              {stats.completed}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Done</div>
          </div>
        </motion.div>

        {/* Filter Tabs */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-6"
        >
          <div className="flex flex-wrap gap-2 items-center">
            {(["today", "tomorrow", "week", "month", "past", "all"] as const).map((df) => (
              <button
                key={df}
                onClick={() => setDateFilter(df)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors capitalize text-sm ${
                  dateFilter === df
                    ? "bg-purple-600 text-white"
                    : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                {df === "week" ? "This Week" : df === "month" ? "This Month" : df}
              </button>
            ))}
            <div className="w-px bg-gray-300 dark:bg-gray-600 h-8 mx-1"></div>
            {(["active", "completed", "all"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors capitalize text-sm ${
                  filter === f
                    ? "bg-blue-600 text-white"
                    : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                {f}
              </button>
            ))}
            {hasUnsavedChanges() && (
              <>
                <div className="w-px bg-gray-300 dark:bg-gray-600 h-8 mx-1"></div>
                <motion.button
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSaveAsDefault}
                  className="px-4 py-2 rounded-lg font-medium text-sm bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700 transition-all shadow-sm"
                  title="Save current filter view as default"
                >
                  Save as Default
                </motion.button>
              </>
            )}
          </div>
        </motion.div>

        {/* Todo Cards */}
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {filteredData?.map((todo: TodoType, index: number) => {
              const points = (todo.importance || 0) * (todo.urgency || 0);
              const isEditing = editingId === todo.id;

              if (isEditing) {
                return (
                  <div key={todo.id} className="col-span-full">
                    <TodoForm
                      isEdit={true}
                      initialData={editFormData}
                      onSave={handleSaveEdit}
                      onCancel={handleCancelEdit}
                      activities={activities.data}
                    />
                  </div>
                );
              }

              return null;
            })}
          </AnimatePresence>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AnimatePresence mode="popLayout">
              {filteredData?.map((todo: TodoType, index: number) => {
                const points = (todo.importance || 0) * (todo.urgency || 0);
                const isEditing = editingId === todo.id;

                if (isEditing) {
                  return null;
                }

              const isHovered = hoveredId === todo.id;

              return (
                <motion.div
                  key={todo.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ delay: index * 0.05 }}
                  layout
                  onMouseEnter={() => setHoveredId(todo.id || null)}
                  onMouseLeave={() => setHoveredId(null)}
                  className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-all overflow-hidden border border-gray-200 dark:border-gray-700 ${
                    todo.done ? "opacity-60" : ""
                  }`}
                >
                  <div className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {/* Checkbox */}
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleToggleDone(todo)}
                        className="flex-shrink-0"
                      >
                        {todo.done ? (
                          <FaCheckCircle className="text-base text-green-500" />
                        ) : (
                          <FaCircle className="text-base text-gray-300 dark:text-gray-600" />
                        )}
                      </motion.button>

                      {/* Title with TODO number */}
                      <div className="flex-1 min-w-0 flex items-center gap-2">
                        <span className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-mono rounded flex-shrink-0">
                          #{todo.id}
                        </span>
                        <h3
                          className={`text-sm font-medium ${
                            todo.done
                              ? "line-through text-gray-500"
                              : "text-gray-900 dark:text-white"
                          }`}
                        >
                          {todo.title}
                        </h3>
                      </div>

                      {/* Dates */}
                      {(todo.work_date || todo.deadline) && (
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {todo.work_date && (
                            <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                              <FaClock size={10} />
                              <span>{getRelativeDate(todo.work_date)}</span>
                            </div>
                          )}
                          {todo.deadline && (
                            <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                              <FaCalendarAlt size={10} />
                              <span>{getRelativeDate(todo.deadline)}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Priority Badge */}
                      <div
                        className={`w-6 h-6 rounded-full text-white text-xs font-bold bg-gradient-to-r ${getPriorityColor(
                          points
                        )} flex items-center justify-center flex-shrink-0`}
                      >
                        {points}
                      </div>

                      {/* Start/Stop Activity Button - visible if activity is tagged */}
                      {todo.activityTitle && (() => {
                        const runningLog = runningLogs.data.find(log =>
                          log.activityTitle === todo.activityTitle && log.comment === todo.title
                        );

                        if (runningLog) {
                          return (
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => handleStopActivity(runningLog.id.toString(), todo.activityTitle!)}
                              className="p-1 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-all flex-shrink-0"
                              title={`Stop activity: ${todo.activityTitle}`}
                            >
                              <FaStop className="text-sm" />
                            </motion.button>
                          );
                        }

                        return (
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleStartActivity(todo)}
                            className="p-1 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 transition-all flex-shrink-0"
                            title={`Start activity: ${todo.activityTitle}`}
                          >
                            <FaPlay className="text-sm" />
                          </motion.button>
                        );
                      })()}

                      {/* Edit Button - always visible */}
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleEdit(todo)}
                        className="p-1 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all flex-shrink-0"
                      >
                        <FaEdit className="text-sm" />
                      </motion.button>

                      {/* Delete Button - always visible */}
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleDelete(todo.id!)}
                        className="p-1 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-all flex-shrink-0"
                      >
                        <FaTrash className="text-sm" />
                      </motion.button>
                    </div>

                    {/* Description and Activity - expands on hover */}
                    {(todo.description || todo.activityTitle) && (
                      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${
                        isHovered ? "max-h-20" : "max-h-0"
                      }`}>
                        <div className="mt-1.5 ml-7 pr-2 space-y-0.5">
                          {todo.description && (
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {todo.description}
                            </p>
                          )}
                          {todo.activityTitle && (
                            <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
                              <span className="font-medium">Activity:</span>
                              <span>{todo.activityTitle}</span>
                              {todo.activityCategory && (
                                <span className="text-gray-400 dark:text-gray-600">({todo.activityCategory})</span>
                              )}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
            </AnimatePresence>
          </div>

          {/* Add Form - full width */}
          <AnimatePresence>
            {showAddForm && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
              >
                <TodoForm
                  isEdit={false}
                  initialData={{ title: "", urgency: 1, importance: 1 } as TodoType}
                  onSave={handleAddTodo}
                  onCancel={handleCancelAdd}
                  activities={activities.data}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {filteredData?.length === 0 && !showAddForm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16"
            >
              <div className="text-6xl mb-4">📝</div>
              <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                No todos found
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {filter === "all"
                  ? "Add your first todo to get started!"
                  : `No ${filter} todos yet.`}
              </p>
            </motion.div>
          )}
        </div>

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

      {/* Floating Add Button */}
      {!showAddForm && !editingId && (
        <motion.button
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => {
            setShowAddForm(true);
            setEditFormData({ title: "", urgency: 1, importance: 1 } as TodoType);
          }}
          className="fixed bottom-8 right-8 w-14 h-14 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full shadow-lg hover:shadow-xl flex items-center justify-center text-white z-40"
        >
          <FaPlus size={20} />
        </motion.button>
      )}
    </div>
  );
}
