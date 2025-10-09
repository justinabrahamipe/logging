"use client";
import { useState, memo } from "react";
import { motion } from "framer-motion";
import { FaSave, FaTimes } from "react-icons/fa";
import * as HiIcons from "react-icons/hi";
import { IconType } from "react-icons";
import { PREDEFINED_COLORS, CategoryWithColor } from "./constants";

interface ActivityFormProps {
  initialData: ActivityType;
  onSave: (data: ActivityType) => void;
  onCancel: () => void;
  userCustomColors: string[];
  onCustomColorChange: (index: number, color: string) => void;
  existingCategories: CategoryWithColor[];
}

const ActivityForm = memo(({ initialData, onSave, onCancel, userCustomColors, onCustomColorChange, existingCategories }: ActivityFormProps) => {
  const [localForm, setLocalForm] = useState(initialData);
  const [openIconTray, setOpenIconTray] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [selectedCustomIndex, setSelectedCustomIndex] = useState<number | null>(null);
  const [showCategoryInput, setShowCategoryInput] = useState(false);

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

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
              Color
            </label>
            <div className="space-y-4">
              <div className="grid grid-cols-8 gap-1">
                {PREDEFINED_COLORS.map((color) => (
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
                  .filter((Icon: IconType) =>
                    Icon.name.toLowerCase().includes(searchText.toLowerCase())
                  )
                  .map((Icon: IconType, index) => (
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

export default ActivityForm;
