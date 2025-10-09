"use client";
import axios from "axios";
import { useEffect, useState, useCallback, memo, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaPlus, FaSave, FaTimes, FaEdit, FaTrash } from "react-icons/fa";
import * as HiIcons from "react-icons/hi";

interface CategoryWithColor {
  name: string;
  defaultColor: string;
}

interface ActivityFormProps {
  isEdit: boolean;
  initialData: ActivityType;
  onSave: (data: ActivityType) => void;
  onCancel: () => void;
  userCustomColors: string[];
  onCustomColorChange: (index: number, color: string) => void;
  existingCategories: CategoryWithColor[];
}

const ActivityForm = memo(({ isEdit, initialData, onSave, onCancel, userCustomColors, onCustomColorChange, existingCategories }: ActivityFormProps) => {
  const [localForm, setLocalForm] = useState(initialData);
  const [openIconTray, setOpenIconTray] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [selectedCustomIndex, setSelectedCustomIndex] = useState<number | null>(null);
  const [showCategoryInput, setShowCategoryInput] = useState(false);

  const predefinedColors = [
    { name: "Blue/Purple", from: "from-blue-500", to: "to-purple-600" },
    { name: "Green/Emerald", from: "from-green-500", to: "to-emerald-600" },
    { name: "Red/Orange", from: "from-red-500", to: "to-orange-600" },
    { name: "Yellow/Orange", from: "from-yellow-500", to: "to-orange-400" },
    { name: "Pink/Rose", from: "from-pink-500", to: "to-rose-600" },
    { name: "Indigo/Purple", from: "from-indigo-500", to: "to-purple-600" },
    { name: "Cyan/Blue", from: "from-cyan-500", to: "to-blue-600" },
    { name: "Teal/Green", from: "from-teal-500", to: "to-green-600" },
    { name: "Violet/Fuchsia", from: "from-violet-500", to: "to-fuchsia-600" },
    { name: "Lime/Green", from: "from-lime-500", to: "to-green-600" },
    { name: "Amber/Orange", from: "from-amber-500", to: "to-orange-600" },
    { name: "Sky/Cyan", from: "from-sky-500", to: "to-cyan-600" },
    { name: "Purple/Pink", from: "from-purple-500", to: "to-pink-600" },
    { name: "Emerald/Teal", from: "from-emerald-500", to: "to-teal-600" },
    { name: "Orange/Red", from: "from-orange-500", to: "to-red-600" },
    { name: "Fuchsia/Purple", from: "from-fuchsia-500", to: "to-purple-600" },
    { name: "Blue/Indigo", from: "from-blue-600", to: "to-indigo-700" },
    { name: "Green/Lime", from: "from-green-600", to: "to-lime-500" },
    { name: "Rose/Red", from: "from-rose-500", to: "to-red-600" },
    { name: "Slate/Gray", from: "from-slate-500", to: "to-gray-600" },
    { name: "Purple/Blue", from: "from-purple-600", to: "to-blue-500" },
    { name: "Emerald/Cyan", from: "from-emerald-600", to: "to-cyan-500" },
    { name: "Orange/Yellow", from: "from-orange-600", to: "to-yellow-400" },
    { name: "Pink/Purple", from: "from-pink-600", to: "to-purple-500" },
  ];


  const allHiIcons = Object.values(HiIcons).filter(
    (icon) => typeof icon === "function" && icon.name
  );

  const IconComponent =
    HiIcons[localForm.icon as keyof typeof HiIcons] ||
    HiIcons.HiOutlineQuestionMarkCircle;

  const currentColor = localForm.color || "from-blue-500 to-purple-600";
  const isCustomColor = currentColor.startsWith("custom-");

  const getIconStyle = () => {
    if (isCustomColor) {
      return { backgroundColor: currentColor.replace("custom-", "") };
    }
    return {};
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(localForm);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="relative"
    >
      <form onSubmit={handleSubmit} className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border-2 border-blue-500 dark:border-blue-400">
        <div className="space-y-3">
          {/* Icon and Title */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setOpenIconTray(!openIconTray)}
              className={`flex-shrink-0 w-10 h-10 ${!isCustomColor ? `bg-gradient-to-br ${currentColor}` : ''} rounded-lg flex items-center justify-center text-white hover:scale-110 transition-transform`}
              style={getIconStyle()}
            >
              <IconComponent size={20} />
            </button>
            <input
              type="text"
              value={localForm.title || ""}
              onChange={(e) => setLocalForm({ ...localForm, title: e.target.value })}
              className="flex-1 px-3 py-2 text-sm font-semibold rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Activity title"
              autoFocus
              required
            />
          </div>

          {/* Category */}
          {showCategoryInput || !existingCategories.length ? (
            <div className="relative">
              <input
                type="text"
                value={localForm.category || ""}
                onChange={(e) => setLocalForm({ ...localForm, category: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter new category"
                required
              />
              {existingCategories.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowCategoryInput(false)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Choose existing
                </button>
              )}
            </div>
          ) : (
            <div className="relative">
              <select
                value={localForm.category || ""}
                onChange={(e) => {
                  if (e.target.value === "__new__") {
                    setShowCategoryInput(true);
                    setLocalForm({ ...localForm, category: "" });
                  } else {
                    const selectedCategory = existingCategories.find(c => c.name === e.target.value);
                    setLocalForm({
                      ...localForm,
                      category: e.target.value,
                      color: selectedCategory?.defaultColor || localForm.color
                    });
                  }
                }}
                className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
                required
              >
                <option value="">Select category</option>
                {existingCategories.map((cat) => (
                  <option key={cat.name} value={cat.name}>
                    {cat.name}
                  </option>
                ))}
                <option value="__new__">+ Add new category</option>
              </select>
            </div>
          )}

          {/* Color Picker */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
              Color
            </label>
            <div className="space-y-4">
              <div className="grid grid-cols-8 gap-1">
                {predefinedColors.map((color) => (
                  <button
                    key={color.name}
                    type="button"
                    onClick={() => setLocalForm({ ...localForm, color: `${color.from} ${color.to}` })}
                    className={`h-6 rounded bg-gradient-to-r ${color.from} ${color.to} hover:scale-110 transition-transform ${
                      currentColor === `${color.from} ${color.to}` && !isCustomColor
                        ? "ring-2 ring-blue-500"
                        : ""
                    }`}
                    title={color.name}
                  />
                ))}
              </div>
              <div className="grid grid-cols-8 gap-1">
                {userCustomColors.map((color, index) => {
                const inputId = `color-input-${index}`;
                const isSelected = selectedCustomIndex === index;
                return (
                  <div key={index} className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setLocalForm({ ...localForm, color: `custom-${color}` });
                        setSelectedCustomIndex(index);
                      }}
                      onDoubleClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        document.getElementById(inputId)?.click();
                      }}
                      className={`w-full h-6 rounded border border-gray-300 dark:border-gray-600 hover:scale-110 transition-transform ${
                        isSelected ? "ring-2 ring-blue-500" : ""
                      }`}
                      style={{ backgroundColor: color }}
                    />
                    <input
                      id={inputId}
                      type="color"
                      value={color}
                      onChange={(e) => {
                        onCustomColorChange(index, e.target.value);
                        setLocalForm({ ...localForm, color: `custom-${e.target.value}` });
                        setSelectedCustomIndex(index);
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
                    />
                  </div>
                );
              })}
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Click to select • Double-click to change custom colors
            </p>
          </div>

          {/* Icon Tray */}
          {openIconTray && (
            <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-3 bg-gray-50 dark:bg-gray-900">
              <input
                type="text"
                placeholder="Search icons..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-2"
              />
              <div className="grid grid-cols-6 gap-1 max-h-32 overflow-y-auto">
                {allHiIcons
                  .filter((Icon: any) =>
                    Icon.name.toLowerCase().includes(searchText.toLowerCase())
                  )
                  .map((Icon: any, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => {
                        setLocalForm({ ...localForm, icon: Icon.name });
                        setOpenIconTray(false);
                        setSearchText("");
                      }}
                      className="p-2 hover:bg-blue-100 dark:hover:bg-blue-900 rounded transition-colors"
                    >
                      <Icon size={20} className="text-gray-700 dark:text-gray-300" />
                    </button>
                  ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-1">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              type="submit"
              className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-3 py-2 rounded-lg text-sm font-semibold shadow hover:shadow-md transition-shadow flex items-center justify-center gap-1"
            >
              <FaSave size={12} /> Save
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              type="button"
              onClick={onCancel}
              className="px-3 py-2 rounded-lg text-sm font-semibold border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-1"
            >
              <FaTimes size={12} /> Cancel
            </motion.button>
          </div>
        </div>
      </form>
    </motion.div>
  );
});

ActivityForm.displayName = "ActivityForm";

export default function Activities() {
  const [data, setData] = useState<{ data: ActivityType[] }>({ data: [] });
  const [rerun, setRerun] = useState<boolean>(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState<ActivityType>({} as ActivityType);
  const [userCustomColors, setUserCustomColors] = useState<string[]>(Array(8).fill("#808080"));
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [snackbar, setSnackbar] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const baseUrl = window.location.origin;
      try {
        const response = await axios.get(`${baseUrl}/api/activity`);
        setData(response.data);
      } catch (error) {
        console.error("Error fetching activities:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [rerun]);

  const handleEdit = useCallback((activity: ActivityType) => {
    setEditingId(activity.id || null);
    setEditFormData(activity);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditFormData({} as ActivityType);
  }, []);

  const handleSaveEdit = useCallback(async (formData: ActivityType) => {
    const baseUrl = window.location.origin;
    try {
      const originalActivity = data.data.find(a => a.id === formData.id);
      await axios.put(`${baseUrl}/api/activity`, {
        oldTitle: originalActivity?.title,
        ...formData
      });
      setEditingId(null);
      setEditFormData({} as ActivityType);
      setRerun(prev => !prev);
      setSnackbar({ message: `"${formData.title}" updated successfully`, type: 'success' });
      setTimeout(() => setSnackbar(null), 3000);
    } catch (error: any) {
      console.error("Error updating activity:", error);
      const errorMessage = error.response?.data?.error || "Failed to update activity";
      setSnackbar({ message: errorMessage, type: 'error' });
      setTimeout(() => setSnackbar(null), 3000);
    }
  }, [data.data]);

  const handleAddActivity = useCallback(async (formData: ActivityType) => {
    if (!formData.title || formData.title.trim() === "") {
      setSnackbar({ message: "Please enter a title for your activity", type: 'error' });
      setTimeout(() => setSnackbar(null), 3000);
      return;
    }

    if (!formData.category || formData.category.trim() === "") {
      setSnackbar({ message: "Please enter a category for your activity", type: 'error' });
      setTimeout(() => setSnackbar(null), 3000);
      return;
    }

    if (!formData.icon) {
      setSnackbar({ message: "Please select an icon for your activity", type: 'error' });
      setTimeout(() => setSnackbar(null), 3000);
      return;
    }

    const baseUrl = window.location.origin;
    try {
      await axios.post(`${baseUrl}/api/activity`, formData);
      setShowAddForm(false);
      setEditFormData({} as ActivityType);
      setRerun(prev => !prev);
      setSnackbar({ message: `"${formData.title}" added successfully`, type: 'success' });
      setTimeout(() => setSnackbar(null), 3000);
    } catch (error: any) {
      console.error("Error adding activity:", error);
      const errorMessage = error.response?.data?.error || "Failed to add activity";
      setSnackbar({ message: errorMessage, type: 'error' });
      setTimeout(() => setSnackbar(null), 3000);
    }
  }, []);

  const handleCancelAdd = useCallback(() => {
    setShowAddForm(false);
    setEditFormData({} as ActivityType);
  }, []);

  const handleDelete = useCallback((id: number) => {
    setDeleteConfirmId(id);
  }, []);

  const confirmDelete = useCallback(async (id: number) => {
    const activity = data.data.find(a => a.id === id);
    const baseUrl = window.location.origin;
    try {
      await axios.delete(`${baseUrl}/api/activity`, {
        data: { title: activity?.title }
      });
      setDeleteConfirmId(null);
      setRerun(prev => !prev);
      setSnackbar({ message: `"${activity?.title}" deleted successfully`, type: 'success' });
      setTimeout(() => setSnackbar(null), 3000);
    } catch (error: any) {
      console.error("Error deleting activity:", error);
      const errorMessage = error.response?.data?.error || "Failed to delete activity";
      setSnackbar({ message: errorMessage, type: 'error' });
      setTimeout(() => setSnackbar(null), 3000);
    }
  }, [data.data]);

  const cancelDelete = useCallback(() => {
    setDeleteConfirmId(null);
  }, []);

  const handleCustomColorChange = useCallback((index: number, color: string) => {
    setUserCustomColors(prev => {
      const updated = [...prev];
      updated[index] = color;
      return updated;
    });
  }, []);

  const existingCategories = useMemo(() => {
    const categoryMap = new Map<string, { colors: Map<string, number>, firstOccurrence: number }>();

    // Count colors per category and track first occurrence
    data.data.forEach((activity, index) => {
      if (!activity.category) return;

      if (!categoryMap.has(activity.category)) {
        categoryMap.set(activity.category, {
          colors: new Map(),
          firstOccurrence: index
        });
      }

      const catData = categoryMap.get(activity.category)!;
      const color = activity.color || "from-blue-500 to-purple-600";
      catData.colors.set(color, (catData.colors.get(color) || 0) + 1);
    });

    // Determine default color for each category
    const result: CategoryWithColor[] = [];
    categoryMap.forEach((catData, categoryName) => {
      let maxCount = 0;
      let defaultColor = "from-blue-500 to-purple-600";
      let firstIndex = Infinity;

      // Find the color with max count, ties broken by earliest occurrence
      data.data.forEach((activity, index) => {
        if (activity.category === categoryName) {
          const color = activity.color || "from-blue-500 to-purple-600";
          const count = catData.colors.get(color) || 0;

          if (count > maxCount || (count === maxCount && index < firstIndex)) {
            maxCount = count;
            defaultColor = color;
            firstIndex = index;
          }
        }
      });

      result.push({ name: categoryName, defaultColor });
    });

    return result;
  }, [data.data]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-2">
            Activities
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your activity categories
          </p>
        </motion.div>

        {/* Activity Grid */}
        {loading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-center py-32"
          >
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-blue-200 dark:border-blue-800 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400 font-medium">Loading activities...</p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
          >
            {data?.data?.map((activity: ActivityType, index: number) => {
            const isEditing = editingId === activity.id;

            if (isEditing) {
              return (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                >
                  <ActivityForm
                    isEdit={true}
                    initialData={editFormData}
                    onSave={handleSaveEdit}
                    onCancel={handleCancelEdit}
                    userCustomColors={userCustomColors}
                    onCustomColorChange={handleCustomColorChange}
                    existingCategories={existingCategories}
                  />
                </motion.div>
              );
            }

            return (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="relative group"
              >
                <div className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-all border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div
                        className={`flex-shrink-0 w-10 h-10 ${activity.color?.startsWith('custom-') ? '' : `bg-gradient-to-br ${activity.color || 'from-blue-500 to-purple-600'}`} rounded-lg flex items-center justify-center text-white`}
                        style={activity.color?.startsWith('custom-') ? { backgroundColor: activity.color.replace('custom-', '') } : {}}
                      >
                        {(() => {
                          const IconComponent = HiIcons[activity.icon as keyof typeof HiIcons] || HiIcons.HiOutlineQuestionMarkCircle;
                          return <IconComponent size={20} />;
                        })()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                          {activity?.title}
                        </p>
                        <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                          {activity?.category}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleEdit(activity)}
                        className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                      >
                        <FaEdit />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleDelete(activity.id!)}
                        className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      >
                        <FaTrash />
                      </motion.button>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}

          {/* Add Form Card or Add Button Tile - at the end */}
          {showAddForm ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <ActivityForm
                isEdit={false}
                initialData={{ title: "", category: "", icon: "HiOutlineQuestionMarkCircle", color: "from-blue-500 to-purple-600" } as ActivityType}
                onSave={handleAddActivity}
                onCancel={handleCancelAdd}
                userCustomColors={userCustomColors}
                onCustomColorChange={handleCustomColorChange}
                existingCategories={existingCategories}
              />
            </motion.div>
          ) : (
            !editingId && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowAddForm(true)}
                className="p-4 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl border-2 border-dashed border-blue-300 dark:border-blue-700 hover:border-blue-500 dark:hover:border-blue-500 transition-all"
              >
                <div className="flex items-center justify-center gap-3 h-full">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white flex-shrink-0">
                    <FaPlus size={20} />
                  </div>
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Add Activity
                  </p>
                </div>
              </motion.button>
            )
          )}
          </motion.div>
        )}

        {/* Empty State */}
        {!loading && data?.data?.length === 0 && !showAddForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <div className="text-6xl mb-4">🎯</div>
            <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
              No activities yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Click the add button to create your first activity!
            </p>
          </motion.div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AnimatePresence>
        {deleteConfirmId !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={cancelDelete}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                  <FaTrash className="text-red-600 dark:text-red-400" size={20} />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                    Delete Activity?
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                    Are you sure you want to delete "{data.data.find(a => a.id === deleteConfirmId)?.title}"? This action cannot be undone.
                  </p>
                  <div className="flex gap-3">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={cancelDelete}
                      className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      Cancel
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => confirmDelete(deleteConfirmId)}
                      className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors"
                    >
                      Delete
                    </motion.button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
