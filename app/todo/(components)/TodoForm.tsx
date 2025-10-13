"use client";
import { useState, memo } from "react";
import { motion } from "framer-motion";
import { FaSave, FaTimes } from "react-icons/fa";
import DatePicker from "@/app/(common)/DatePicker";

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

          <DatePicker
            value={localForm.work_date || ""}
            onChangeAction={(value) => setLocalForm({ ...localForm, work_date: value })}
            placeholder="Work Date"
            className="text-xs"
          />

          <DatePicker
            value={localForm.deadline || ""}
            onChangeAction={(value) => setLocalForm({ ...localForm, deadline: value })}
            placeholder="Deadline"
            className="text-xs"
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

export default TodoForm;
