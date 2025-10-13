"use client";
import axios from "axios";
import { useEffect, useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { FaPlus, FaEdit, FaTrash } from "react-icons/fa";
import * as HiIcons from "react-icons/hi";
import ActivityForm from "./(components)/ActivityForm";
import DeleteDialog from "../(components)/DeleteDialog";
import Snackbar from "../(components)/Snackbar";
import { CategoryWithColor } from "./(components)/constants";

export default function Activities() {
  const [data, setData] = useState<{ data: ActivityType[] }>({ data: [] });
  const [rerun, refetchAction] = useState<boolean>(false);
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
      refetchAction(prev => !prev);
      setSnackbar({ message: `"${formData.title}" updated successfully`, type: 'success' });
      setTimeout(() => setSnackbar(null), 3000);
    } catch (error: unknown) {
      console.error("Error updating activity:", error);
      const errorMessage = (error as { response?: { data?: { error?: string } } }).response?.data?.error || "Failed to update activity";
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
      refetchAction(prev => !prev);
      setSnackbar({ message: `"${formData.title}" added successfully`, type: 'success' });
      setTimeout(() => setSnackbar(null), 3000);
    } catch (error: unknown) {
      console.error("Error adding activity:", error);
      const errorMessage = (error as { response?: { data?: { error?: string } } }).response?.data?.error || "Failed to add activity";
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

  const confirmDelete = useCallback(async () => {
    if (!deleteConfirmId) return;
    const activity = data.data.find(a => a.id === deleteConfirmId);
    const baseUrl = window.location.origin;
    try {
      await axios.delete(`${baseUrl}/api/activity`, {
        data: { title: activity?.title }
      });
      setDeleteConfirmId(null);
      refetchAction(prev => !prev);
      setSnackbar({ message: `"${activity?.title}" deleted successfully`, type: 'success' });
      setTimeout(() => setSnackbar(null), 3000);
    } catch (error: unknown) {
      console.error("Error deleting activity:", error);
      const errorMessage = (error as { response?: { data?: { error?: string } } }).response?.data?.error || "Failed to delete activity";
      setSnackbar({ message: errorMessage, type: 'error' });
      setTimeout(() => setSnackbar(null), 3000);
    }
  }, [deleteConfirmId, data.data]);

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

    const result: CategoryWithColor[] = [];
    categoryMap.forEach((catData, categoryName) => {
      let maxCount = 0;
      let defaultColor = "from-blue-500 to-purple-600";
      let firstIndex = Infinity;

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
                    initialData={editFormData}
                    onSaveAction={handleSaveEdit}
                    onCancelAction={handleCancelEdit}
                    userCustomColors={userCustomColors}
                    onCustomColorChangeAction={handleCustomColorChange}
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

          {showAddForm ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <ActivityForm
                initialData={{ title: "", category: "", icon: "HiOutlineQuestionMarkCircle", color: "from-blue-500 to-purple-600" } as ActivityType}
                onSaveAction={handleAddActivity}
                onCancelAction={handleCancelAdd}
                userCustomColors={userCustomColors}
                onCustomColorChangeAction={handleCustomColorChange}
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

      <DeleteDialog
        isOpen={deleteConfirmId !== null}
        title="Delete Activity?"
        itemName={data.data.find(a => a.id === deleteConfirmId)?.title}
        onConfirmAction={confirmDelete}
        onCancelAction={cancelDelete}
      />

      <Snackbar
        message={snackbar?.message || ""}
        type={snackbar?.type || 'info'}
        isOpen={!!snackbar}
        onCloseAction={() => setSnackbar(null)}
      />
    </div>
  );
}
