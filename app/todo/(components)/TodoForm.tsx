"use client";
import { useState, memo, useEffect } from "react";
import { motion } from "framer-motion";
import { FaSave, FaTimes, FaUsers, FaMapMarkedAlt, FaBullseye, FaSync } from "react-icons/fa";
import DatePicker from "@/app/(common)/DatePicker";
import { Autocomplete, TextField, Chip } from "@mui/material";
import axios from "axios";

interface Contact {
  id: number;
  name: string;
  photoUrl?: string | null;
}

interface Place {
  id: number;
  name: string;
  address: string;
}

interface Goal {
  id: number;
  title: string;
  color?: string | null;
  icon?: string | null;
}

interface TodoFormProps {
  isEdit: boolean;
  initialData: TodoType;
  onSaveAction: (data: TodoType) => void;
  onCancelAction: () => void;
  activities: ActivityType[];
}

const TodoForm = memo(({ isEdit, initialData, onSaveAction, onCancelAction, activities }: TodoFormProps) => {
  const [localForm, setLocalForm] = useState(initialData);
  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const [allPlaces, setAllPlaces] = useState<Place[]>([]);
  const [allGoals, setAllGoals] = useState<Goal[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<Contact[]>([]);
  const [selectedPlaces, setSelectedPlaces] = useState<Place[]>([]);
  const [selectedGoals, setSelectedGoals] = useState<Goal[]>([]);
  // Recurring task state
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrencePattern, setRecurrencePattern] = useState<'daily' | 'weekly' | 'monthly' | 'custom'>('weekly');
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [recurrenceEndType, setRecurrenceEndType] = useState<'count' | 'date'>('count');
  const [recurrenceCount, setRecurrenceCount] = useState(4);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [workDateOffset, setWorkDateOffset] = useState(0);

  // Fetch contacts, places, and goals
  useEffect(() => {
    const fetchData = async () => {
      const baseUrl = window.location.origin;
      try {
        const [contactsRes, placesRes, goalsRes] = await Promise.all([
          axios.get(`${baseUrl}/api/contacts?limit=1000`),
          axios.get(`${baseUrl}/api/places?limit=1000`),
          axios.get(`${baseUrl}/api/goal`)
        ]);
        setAllContacts(contactsRes.data.data || []);
        setAllPlaces(placesRes.data.data || []);
        setAllGoals(goalsRes.data.data || []);
      } catch (error) {
        console.error("Error fetching contacts/places/goals:", error);
      }
    };
    fetchData();
  }, []);

  // Initialize selected contacts/places/goals from initialData
  useEffect(() => {
    if (initialData.contacts && Array.isArray(initialData.contacts)) {
      setSelectedContacts(initialData.contacts);
    }
    if (initialData.place) {
      setSelectedPlaces([initialData.place]);
    }
    if (initialData.goal) {
      setSelectedGoals([initialData.goal]);
    }
  }, [initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const dataToSubmit: any = {
      ...localForm,
      contactIds: selectedContacts.map(c => c.id),
      placeId: selectedPlaces.length > 0 ? selectedPlaces[0].id : null,
      goalId: selectedGoals.length > 0 ? selectedGoals[0].id : null,
    };

    // Add recurring task data if enabled
    if (isRecurring && !isEdit) {
      dataToSubmit.isRecurring = true;
      dataToSubmit.recurrencePattern = recurrencePattern;
      dataToSubmit.recurrenceInterval = recurrenceInterval;
      dataToSubmit.workDateOffset = workDateOffset;
      if (recurrenceEndType === 'count') {
        dataToSubmit.recurrenceCount = recurrenceCount;
      } else {
        dataToSubmit.recurrenceEndDate = recurrenceEndDate;
      }
    }

    onSaveAction(dataToSubmit);
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLocalForm({ ...localForm, description: e.target.value });
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  };

  const getLevelLabel = (level: number) => {
    if (level === 3) return "High";
    if (level === 2) return "Med";
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
      className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 mb-4"
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

        {/* Recurring Task Section - Only show for new todos */}
        {!isEdit && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                id="isRecurring"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="isRecurring" className="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                <FaSync className="text-orange-500" size={12} />
                Make this recurring
              </label>
            </div>

            {isRecurring && (
              <div className="space-y-2 mt-2 pl-6">
                {/* Pattern Selection */}
                <div className="flex gap-1">
                  {(['daily', 'weekly', 'monthly', 'custom'] as const).map((pattern) => (
                    <button
                      key={pattern}
                      type="button"
                      onClick={() => setRecurrencePattern(pattern)}
                      className={`flex-1 py-1 px-2 rounded text-xs font-medium transition-colors ${
                        recurrencePattern === pattern
                          ? "bg-orange-500 text-white"
                          : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                      }`}
                    >
                      {pattern.charAt(0).toUpperCase() + pattern.slice(1)}
                    </button>
                  ))}
                </div>

                {/* Custom Interval */}
                {recurrencePattern === 'custom' && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 dark:text-gray-400">Every</span>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={recurrenceInterval}
                      onChange={(e) => setRecurrenceInterval(Number(e.target.value) || 1)}
                      className="w-16 px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <span className="text-xs text-gray-600 dark:text-gray-400">days</span>
                  </div>
                )}

                {/* End Type */}
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                    <input
                      type="radio"
                      name="recurrenceEndType"
                      checked={recurrenceEndType === 'count'}
                      onChange={() => setRecurrenceEndType('count')}
                      className="w-3 h-3"
                    />
                    After
                    <input
                      type="number"
                      min="1"
                      max="52"
                      value={recurrenceCount}
                      onChange={(e) => setRecurrenceCount(Number(e.target.value) || 1)}
                      disabled={recurrenceEndType !== 'count'}
                      className="w-14 px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                    />
                    times
                  </label>
                  <label className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                    <input
                      type="radio"
                      name="recurrenceEndType"
                      checked={recurrenceEndType === 'date'}
                      onChange={() => setRecurrenceEndType('date')}
                      className="w-3 h-3"
                    />
                    Until
                    <input
                      type="date"
                      value={recurrenceEndDate}
                      onChange={(e) => setRecurrenceEndDate(e.target.value)}
                      disabled={recurrenceEndType !== 'date'}
                      className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                    />
                  </label>
                </div>

                {/* Work Date Offset */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 dark:text-gray-400">Work date:</span>
                  <input
                    type="number"
                    min="0"
                    max="30"
                    value={workDateOffset}
                    onChange={(e) => setWorkDateOffset(Number(e.target.value) || 0)}
                    className="w-14 px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  <span className="text-xs text-gray-600 dark:text-gray-400">days before deadline</span>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-4">
          <div className="w-1/3">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Urgency
            </label>
            <div className="flex gap-2">
              {[1, 2, 3].map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setLocalForm({ ...localForm, urgency: level })}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
                    localForm.urgency === level
                      ? "bg-blue-600 text-white shadow-md"
                      : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                  }`}
                >
                  {getLevelLabel(level)}
                </button>
              ))}
            </div>
          </div>

          <div className="w-1/3">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Importance
            </label>
            <div className="flex gap-2">
              {[1, 2, 3].map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setLocalForm({ ...localForm, importance: level })}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
                    localForm.importance === level
                      ? "bg-blue-600 text-white shadow-md"
                      : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                  }`}
                >
                  {getLevelLabel(level)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* People Selection */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FaUsers className="text-blue-600 dark:text-blue-400" size={12} />
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Tag People
            </label>
          </div>
          <Autocomplete
            multiple
            size="small"
            options={allContacts}
            getOptionLabel={(option) => option.name}
            value={selectedContacts}
            onChange={(_, newValue) => setSelectedContacts(newValue)}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder="Select people"
                size="small"
                className="text-sm"
              />
            )}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip
                  {...getTagProps({ index })}
                  key={option.id}
                  label={option.name}
                  size="small"
                />
              ))
            }
          />
        </div>

        {/* Places Selection */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FaMapMarkedAlt className="text-green-600 dark:text-green-400" size={12} />
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Tag Places
            </label>
          </div>
          <Autocomplete
            multiple
            size="small"
            options={allPlaces}
            getOptionLabel={(option) => option.name}
            value={selectedPlaces}
            onChange={(_, newValue) => setSelectedPlaces(newValue)}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder="Select places"
                size="small"
                className="text-sm"
              />
            )}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip
                  {...getTagProps({ index })}
                  key={option.id}
                  label={option.name}
                  size="small"
                />
              ))
            }
          />
        </div>

        {/* Goals Selection */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FaBullseye className="text-purple-600 dark:text-purple-400" size={12} />
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Tag Goals
            </label>
          </div>
          <Autocomplete
            multiple
            size="small"
            options={allGoals}
            getOptionLabel={(option) => option.title}
            value={selectedGoals}
            onChange={(_, newValue) => setSelectedGoals(newValue)}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder="Select goals"
                size="small"
                className="text-sm"
              />
            )}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip
                  {...getTagProps({ index })}
                  key={option.id}
                  label={option.title}
                  size="small"
                  style={{ backgroundColor: option.color || undefined }}
                />
              ))
            }
          />
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
            onClick={onCancelAction}
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
