"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { FaSave, FaTimes, FaClock, FaHashtag, FaCalendarAlt } from "react-icons/fa";
import * as HiIcons from "react-icons/hi";

interface GoalFormProps {
  initialData?: GoalType;
  onSaveAction: (data: GoalType) => void;
  onCancelAction: () => void;
  activities: ActivityType[];
}

export default function GoalForm({ initialData, onSaveAction, onCancelAction, activities }: GoalFormProps) {
  // Helper function to format date to YYYY-MM-DD
  const formatDateForInput = (date: Date | string | null | undefined): string => {
    if (!date) return "";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "";
    return d.toISOString().split('T')[0];
  };

  const [openIconTray, setOpenIconTray] = useState(false);
  const [searchText, setSearchText] = useState("");

  const [formData, setFormData] = useState<GoalType>({
    title: initialData?.title || "",
    description: initialData?.description || "",
    goalType: initialData?.goalType || "achievement",
    metricType: initialData?.metricType || "time",
    targetValue: initialData?.targetValue || 0,
    periodType: initialData?.periodType || "month",
    startDate: initialData?.startDate ? formatDateForInput(initialData.startDate) : new Date().toISOString().split('T')[0],
    endDate: initialData?.endDate ? formatDateForInput(initialData.endDate) : "",
    activityTitle: initialData?.activityTitle || "",
    activityCategory: initialData?.activityCategory || "",
    color: initialData?.color || "from-blue-500 to-purple-600",
    icon: initialData?.icon || "HiOutlineFlag",
    isActive: initialData?.isActive !== undefined ? initialData.isActive : true,
    isRecurring: initialData?.isRecurring || false,
    recurrencePattern: initialData?.recurrencePattern || "monthly",
    recurrenceConfig: initialData?.recurrenceConfig || null,
  });

  const [customDaysOfWeek, setCustomDaysOfWeek] = useState<number[]>(() => {
    if (initialData?.recurrenceConfig) {
      try {
        const config = JSON.parse(initialData.recurrenceConfig);
        return config.daysOfWeek || [];
      } catch {
        return [];
      }
    }
    return [];
  });

  const [customDayOfMonth, setCustomDayOfMonth] = useState<number>(() => {
    if (initialData?.recurrenceConfig) {
      try {
        const config = JSON.parse(initialData.recurrenceConfig);
        return config.dayOfMonth || 1;
      } catch {
        return 1;
      }
    }
    return 1;
  });

  // Calculate end date based on period type
  useEffect(() => {
    if (formData.startDate && formData.periodType !== 'custom') {
      const start = new Date(formData.startDate);
      let end = new Date(start);

      switch (formData.periodType) {
        case 'week':
          end.setDate(start.getDate() + 7 - 1); // 7 days total, so end on day 6
          break;
        case 'month':
          // Set to next month, then back one day to get last day of current month
          end.setMonth(start.getMonth() + 1);
          end.setDate(0); // Day 0 = last day of previous month
          break;
        case '3months':
          end.setMonth(start.getMonth() + 3);
          end.setDate(0);
          break;
        case '6months':
          end.setMonth(start.getMonth() + 6);
          end.setDate(0);
          break;
        case 'year':
          end.setFullYear(start.getFullYear() + 1);
          end.setDate(0);
          break;
      }

      setFormData(prev => ({ ...prev, endDate: end.toISOString().split('T')[0] }));
    }
  }, [formData.startDate, formData.periodType]);

  const handleActivityChange = (activityTitle: string) => {
    const activity = activities.find(a => a.title === activityTitle);
    setFormData({
      ...formData,
      activityTitle: activityTitle || "",
      activityCategory: activity?.category || "",
      icon: activity?.icon || formData.icon,
      color: activity?.color || formData.color,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Build recurrence config based on pattern
    let recurrenceConfig = null;
    if (formData.isRecurring) {
      if (formData.recurrencePattern === 'custom-weekly' && customDaysOfWeek.length > 0) {
        recurrenceConfig = JSON.stringify({ daysOfWeek: customDaysOfWeek });
      } else if (formData.recurrencePattern === 'custom-monthly') {
        recurrenceConfig = JSON.stringify({ dayOfMonth: customDayOfMonth });
      }
    }

    onSaveAction({
      ...initialData,
      ...formData,
      targetValue: Number(formData.targetValue),
      recurrenceConfig,
    });
  };

  const colorOptions = [
    { name: "Blue-Purple", value: "from-blue-500 to-purple-600" },
    { name: "Green-Emerald", value: "from-green-500 to-emerald-600" },
    { name: "Red-Orange", value: "from-red-500 to-orange-600" },
    { name: "Pink-Rose", value: "from-pink-500 to-rose-600" },
    { name: "Yellow-Orange", value: "from-yellow-500 to-orange-600" },
    { name: "Indigo-Purple", value: "from-indigo-500 to-purple-600" },
    { name: "Teal-Cyan", value: "from-teal-500 to-cyan-600" },
    { name: "Purple-Pink", value: "from-purple-500 to-pink-500" },
    { name: "Cyan-Blue", value: "from-cyan-500 to-blue-500" },
    { name: "Lime-Green", value: "from-lime-500 to-green-500" },
    { name: "Orange-Red", value: "from-orange-500 to-red-500" },
    { name: "Fuchsia-Purple", value: "from-fuchsia-500 to-purple-500" },
    { name: "Sky-Indigo", value: "from-sky-500 to-indigo-500" },
    { name: "Emerald-Teal", value: "from-emerald-500 to-teal-500" },
    { name: "Rose-Red", value: "from-rose-500 to-red-500" },
    { name: "Violet-Fuchsia", value: "from-violet-500 to-fuchsia-500" },
  ];

  const iconOptions = [
    "HiOutlineFlag",
    "HiOutlineFire",
    "HiOutlineLightningBolt",
    "HiOutlineTrendingUp",
    "HiOutlineAcademicCap",
    "HiOutlineHeart",
    "HiOutlineStar",
    "HiOutlineBookOpen",
    "HiOutlineBeaker",
    "HiOutlineBriefcase",
    "HiOutlineCake",
    "HiOutlineCamera",
    "HiOutlineChartBar",
    "HiOutlineChatAlt",
    "HiOutlineCode",
    "HiOutlineCog",
    "HiOutlineCube",
    "HiOutlineCurrencyDollar",
    "HiOutlineGlobe",
    "HiOutlineLightBulb",
    "HiOutlineMusicNote",
    "HiOutlinePencil",
    "HiOutlineShoppingCart",
    "HiOutlineTruck",
  ];

  const allHiIcons = Object.values(HiIcons).filter(
    (icon) => typeof icon === "function" && icon.name
  );

  const IconComponent =
    HiIcons[formData.icon as keyof typeof HiIcons] ||
    HiIcons.HiOutlineFlag;

  const currentColor = formData.color || "from-blue-500 to-purple-600";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 border border-gray-200 dark:border-gray-700"
    >
      <form onSubmit={handleSubmit} className="space-y-2">
        {/* Title with Icon Button, Goal Type, Metric Type, Recurring */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
          <div className="sm:col-span-5">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Goal Title *
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setOpenIconTray(!openIconTray)}
                className={`flex-shrink-0 w-10 h-10 bg-gradient-to-br ${currentColor} rounded-lg flex items-center justify-center text-white hover:scale-110 transition-transform`}
              >
                <IconComponent size={20} />
              </button>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="flex-1 px-2.5 py-1 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-1 focus:ring-purple-500 dark:bg-gray-700 dark:text-white text-sm"
                placeholder="e.g., Workout 50 hours"
                required
              />
            </div>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Goal Type *
            </label>
            <select
              value={formData.goalType}
              onChange={(e) => setFormData({ ...formData, goalType: e.target.value as any })}
              className="w-full px-2.5 py-1 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-1 focus:ring-purple-500 dark:bg-gray-700 dark:text-white text-sm"
            >
              <option value="achievement">Achievement</option>
              <option value="limiting">Limiting</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Metric *
            </label>
            <select
              value={formData.metricType}
              onChange={(e) => setFormData({ ...formData, metricType: e.target.value as any })}
              className="w-full px-2.5 py-1 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-1 focus:ring-purple-500 dark:bg-gray-700 dark:text-white text-sm"
            >
              <option value="time">Time (hrs)</option>
              <option value="count">Count</option>
            </select>
          </div>

          <div className="sm:col-span-3">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Recurring
            </label>
            <div className="flex items-center h-[34px]">
              <input
                type="checkbox"
                id="isRecurring"
                checked={formData.isRecurring}
                onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
                className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
              />
              <label htmlFor="isRecurring" className="ml-2 text-xs text-gray-700 dark:text-gray-300">
                {formData.isRecurring ? 'Yes' : 'No'}
              </label>
            </div>
          </div>
        </div>

        {/* Target Value, Activity Link, Period, Start & End Date */}
        <div className="grid grid-cols-2 sm:grid-cols-12 gap-2">
          <div className="sm:col-span-1.5">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Target *
            </label>
            <input
              type="number"
              value={formData.targetValue}
              onChange={(e) => setFormData({ ...formData, targetValue: parseFloat(e.target.value) })}
              className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-1 focus:ring-purple-500 dark:bg-gray-700 dark:text-white text-sm"
              placeholder="50"
              step={formData.metricType === 'time' ? '0.5' : '1'}
              min="0"
              required
            />
          </div>

          <div className="sm:col-span-2.5">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Activity
            </label>
            <select
              value={formData.activityTitle || ""}
              onChange={(e) => handleActivityChange(e.target.value)}
              className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-1 focus:ring-purple-500 dark:bg-gray-700 dark:text-white text-sm"
            >
              <option value="">None</option>
              {activities.map((activity) => (
                <option key={activity.id} value={activity.title}>
                  {activity.title}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Period *
            </label>
            <select
              value={formData.periodType}
              onChange={(e) => setFormData({ ...formData, periodType: e.target.value as any })}
              className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-1 focus:ring-purple-500 dark:bg-gray-700 dark:text-white text-sm"
            >
              <option value="week">1 Week</option>
              <option value="month">1 Month</option>
              <option value="3months">3 Months</option>
              <option value="6months">6 Months</option>
              <option value="year">1 Year</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          <div className="sm:col-span-3">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Start *
            </label>
            <input
              type="date"
              value={formData.startDate as string}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-1 focus:ring-purple-500 dark:bg-gray-700 dark:text-white text-sm"
              required
            />
          </div>

          <div className="sm:col-span-3">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              End *
            </label>
            <input
              type="date"
              value={formData.endDate as string}
              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-1 focus:ring-purple-500 dark:bg-gray-700 dark:text-white text-sm"
              disabled={formData.periodType !== 'custom'}
              required
            />
          </div>
        </div>

        {/* Recurring Pattern (only show when recurring is checked) */}
        {formData.isRecurring && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Pattern *
              </label>
              <select
                value={formData.recurrencePattern || 'monthly'}
                onChange={(e) => setFormData({ ...formData, recurrencePattern: e.target.value })}
                className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-1 focus:ring-purple-500 dark:bg-gray-700 dark:text-white text-sm"
                required={formData.isRecurring}
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="work-weekly">Work Week</option>
                <option value="custom-weekly">Custom Days</option>
                <option value="monthly">Monthly</option>
                <option value="custom-monthly">Day of Month</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>

            {formData.recurrencePattern === 'custom-weekly' && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Days of Week *
                </label>
                <div className="grid grid-cols-7 gap-1">
                  {[
                    { label: 'Mon', value: 1 },
                    { label: 'Tue', value: 2 },
                    { label: 'Wed', value: 3 },
                    { label: 'Thu', value: 4 },
                    { label: 'Fri', value: 5 },
                    { label: 'Sat', value: 6 },
                    { label: 'Sun', value: 0 }
                  ].map((day) => (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => {
                        if (customDaysOfWeek.includes(day.value)) {
                          setCustomDaysOfWeek(customDaysOfWeek.filter(d => d !== day.value));
                        } else {
                          setCustomDaysOfWeek([...customDaysOfWeek, day.value]);
                        }
                      }}
                      className={`px-1 py-1.5 rounded text-xs font-semibold ${
                        customDaysOfWeek.includes(day.value)
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {formData.recurrencePattern === 'custom-monthly' && (
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Day of Month *
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={customDayOfMonth}
                  onChange={(e) => setCustomDayOfMonth(parseInt(e.target.value) || 1)}
                  className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-1 focus:ring-purple-500 dark:bg-gray-700 dark:text-white text-sm"
                  placeholder="Day"
                  required={formData.recurrencePattern === 'custom-monthly'}
                />
              </div>
            )}
          </div>
        )}

        {/* Color */}
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Color
          </label>
          <div className="grid grid-cols-8 gap-1">
            {colorOptions.map((color) => (
              <button
                key={color.value}
                type="button"
                onClick={() => setFormData({ ...formData, color: color.value })}
                className={`h-6 rounded bg-gradient-to-r ${color.value} hover:scale-110 transition-transform ${
                  currentColor === color.value
                    ? "ring-2 ring-purple-500"
                    : ""
                }`}
                title={color.name}
              />
            ))}
          </div>
        </div>

        {/* Icon Tray */}
        {openIconTray && (
          <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-3 bg-gray-50 dark:bg-gray-900">
            <input
              type="text"
              placeholder="Search icons..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent mb-2"
            />
            <div className="grid grid-cols-8 gap-1 max-h-32 overflow-y-auto">
              {allHiIcons
                .filter((Icon: any) =>
                  Icon.name.toLowerCase().includes(searchText.toLowerCase())
                )
                .map((Icon: any, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, icon: Icon.name });
                      setOpenIconTray(false);
                      setSearchText("");
                    }}
                    className="p-2 hover:bg-purple-100 dark:hover:bg-purple-900 rounded transition-colors"
                  >
                    <Icon size={20} className="text-gray-700 dark:text-gray-300" />
                  </button>
                ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-1">
          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onCancelAction}
            className="px-4 py-1.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-semibold text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </motion.button>
          <motion.button
            type="submit"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-1.5 rounded-lg font-semibold text-sm hover:from-purple-700 hover:to-pink-700"
          >
            {initialData?.id ? "Update" : "Create"}
          </motion.button>
        </div>
      </form>
    </motion.div>
  );
}
