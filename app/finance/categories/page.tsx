"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaPlus, FaEdit, FaTrash, FaTimes, FaCheck, FaTags } from "react-icons/fa";
import axios from "axios";
import FinanceSubmenu from "../(components)/FinanceSubmenu";

interface Category {
  id: number;
  name: string;
  type: string;
  description?: string;
  color?: string;
  icon?: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

const defaultColors = [
  "#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#6366F1",
  "#8B5CF6", "#EC4899", "#14B8A6", "#F97316", "#06B6D4"
];

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    type: "expense",
    description: "",
    color: defaultColors[0],
    icon: "",
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const baseUrl = window.location.origin;
      const response = await axios.get(`${baseUrl}/api/finance/categories`);
      setCategories(response.data.data || []);
    } catch (error) {
      console.error("Error fetching categories:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (category?: Category) => {
    if (category) {
      setEditingCategory(category);
      setFormData({
        name: category.name,
        type: category.type,
        description: category.description || "",
        color: category.color || defaultColors[0],
        icon: category.icon || "",
      });
    } else {
      setEditingCategory(null);
      setFormData({
        name: "",
        type: "expense",
        description: "",
        color: defaultColors[0],
        icon: "",
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingCategory(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const baseUrl = window.location.origin;

      if (editingCategory) {
        await axios.put(`${baseUrl}/api/finance/categories`, {
          id: editingCategory.id,
          ...formData,
        });
      } else {
        await axios.post(`${baseUrl}/api/finance/categories`, formData);
      }

      fetchCategories();
      handleCloseModal();
    } catch (error) {
      console.error("Error saving category:", error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this category?")) {
      return;
    }

    try {
      const baseUrl = window.location.origin;
      await axios.delete(`${baseUrl}/api/finance/categories?id=${id}`);
      fetchCategories();
    } catch (error) {
      console.error("Error deleting category:", error);
    }
  };

  const incomeCategories = categories.filter(c => c.type === "income");
  const expenseCategories = categories.filter(c => c.type === "expense");

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950 py-8">
        <div className="max-w-7xl mx-auto px-4">
          <FinanceSubmenu />
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-600 dark:text-gray-400">Loading categories...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <FinanceSubmenu />

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Categories
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Manage your transaction categories
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleOpenModal()}
            className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold shadow-lg flex items-center gap-2"
          >
            <FaPlus />
            Add Category
          </motion.button>
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Income Categories */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <span className="w-3 h-3 bg-green-500 rounded-full"></span>
              Income Categories ({incomeCategories.length})
            </h3>
            {incomeCategories.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 text-center">
                <p className="text-gray-600 dark:text-gray-400">No income categories yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {incomeCategories.map((category) => (
                  <motion.div
                    key={category.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center text-white"
                          style={{ backgroundColor: category.color || "#10B981" }}
                        >
                          <FaTags />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-gray-900 dark:text-white">
                            {category.name}
                          </h4>
                          {category.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {category.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleOpenModal(category)}
                          className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg"
                        >
                          <FaEdit />
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleDelete(category.id)}
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                        >
                          <FaTrash />
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Expense Categories */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <span className="w-3 h-3 bg-red-500 rounded-full"></span>
              Expense Categories ({expenseCategories.length})
            </h3>
            {expenseCategories.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 text-center">
                <p className="text-gray-600 dark:text-gray-400">No expense categories yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {expenseCategories.map((category) => (
                  <motion.div
                    key={category.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center text-white"
                          style={{ backgroundColor: category.color || "#EF4444" }}
                        >
                          <FaTags />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-gray-900 dark:text-white">
                            {category.name}
                          </h4>
                          {category.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {category.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleOpenModal(category)}
                          className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg"
                        >
                          <FaEdit />
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleDelete(category.id)}
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                        >
                          <FaTrash />
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal */}
        <AnimatePresence>
          {isModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleCloseModal}
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6 z-10"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {editingCategory ? "Edit Category" : "Add Category"}
                  </h2>
                  <button
                    onClick={handleCloseModal}
                    className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    <FaTimes />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Type *
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {["income", "expense"].map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setFormData({ ...formData, type })}
                          className={`px-4 py-2 rounded-lg capitalize transition-colors ${
                            formData.type === type
                              ? "bg-green-600 text-white"
                              : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Category Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="e.g., Groceries"
                    />
                  </div>

                  {/* Color */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Color
                    </label>
                    <div className="grid grid-cols-5 gap-2">
                      {defaultColors.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setFormData({ ...formData, color })}
                          className={`w-10 h-10 rounded-lg transition-all ${
                            formData.color === color
                              ? "ring-2 ring-offset-2 ring-green-500 dark:ring-offset-gray-800"
                              : ""
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Description (Optional)
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="Add notes about this category..."
                      rows={3}
                    />
                  </div>

                  {/* Buttons */}
                  <div className="flex gap-3 pt-4">
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleCloseModal}
                      className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-medium"
                    >
                      Cancel
                    </motion.button>
                    <motion.button
                      type="submit"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium flex items-center justify-center gap-2"
                    >
                      <FaCheck />
                      {editingCategory ? "Update" : "Create"}
                    </motion.button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
