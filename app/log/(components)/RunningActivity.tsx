"use client";
import { DateTime } from "luxon";
import * as HiIcons from "react-icons/hi";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaStop, FaEdit, FaSave, FaTimes, FaUsers, FaMapMarkedAlt, FaTasks, FaBullseye } from "react-icons/fa";
import TagDropdown from "@/app/(components)/TagDropdown";
import { Autocomplete, TextField, Chip } from "@mui/material";
import axios from "axios";

interface Contact {
  id: number;
  name: string;
  photoUrl?: string;
}

interface Place {
  id: number;
  name: string;
  address: string;
}

interface RunningActivityProps {
  data: LogType;
  onStopAction: (logId: number) => void;
  allLogs: LogType[];
  onUpdate?: () => void;
  onOptimisticUpdate?: (
    logId: number,
    updates: Partial<LogType>,
    apiCall: () => Promise<any>
  ) => Promise<void>;
}

export default function RunningActivity({
  data,
  onStopAction,
  allLogs,
  onUpdate,
  onOptimisticUpdate,
}: RunningActivityProps) {
  const IconComponent =
    HiIcons[data.activityIcon as keyof typeof HiIcons] ||
    HiIcons.HiOutlineQuestionMarkCircle;
  const [timeDiff, setTimeDiff] = useState("");
  const [isHovered, setIsHovered] = useState(false);
  const isTempActivity = data.id < 0; // Temporary activities have negative IDs
  const [showTagsModal, setShowTagsModal] = useState(false);
  const [editTags, setEditTags] = useState(data.tags || "");
  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const [allPlaces, setAllPlaces] = useState<Place[]>([]);
  const [allTodos, setAllTodos] = useState<TodoType[]>([]);
  const [allGoals, setAllGoals] = useState<GoalType[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<Contact[]>([]);
  const [selectedPlaces, setSelectedPlaces] = useState<Place[]>([]);
  const [selectedTodo, setSelectedTodo] = useState<TodoType | null>(null);
  const [selectedGoal, setSelectedGoal] = useState<GoalType | null>(null);
  const [goalCount, setGoalCount] = useState<number | null>(null);

  // Parse TODO info from comment
  const parseTodoInfo = (comment: string | null | undefined) => {
    if (!comment || !comment.startsWith('TODO-')) return null;
    const parts = comment.split('|');
    return {
      todoId: parts[0], // "TODO-123"
      title: parts[1] || '',
      description: parts[2] || '',
    };
  };

  // Parse tags from tags string
  const parseTags = (tags: string | null | undefined) => {
    if (!tags) return [];
    return tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
  };

  const todoInfo = parseTodoInfo(data.comment);
  const tags = parseTags(data.tags);

  // Fetch all data for tag selection
  useEffect(() => {
    const fetchData = async () => {
      const baseUrl = window.location.origin;
      try {
        const [contactsRes, placesRes, todosRes, goalsRes] = await Promise.all([
          axios.get(`${baseUrl}/api/contacts?limit=1000`),
          axios.get(`${baseUrl}/api/places?limit=1000`),
          axios.get(`${baseUrl}/api/todo`),
          axios.get(`${baseUrl}/api/goal`)
        ]);
        setAllContacts(contactsRes.data.data || []);
        setAllPlaces(placesRes.data.data || []);
        setAllTodos(todosRes.data.data || []);
        setAllGoals(goalsRes.data.data || []);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };
    fetchData();
  }, []);

  // Initialize selected tags from log data
  useEffect(() => {
    const logContacts = data.logContacts?.map(lc => lc.contact) || [];
    const logPlaces = data.logPlaces?.map(lp => lp.place) || [];
    setSelectedContacts(logContacts);
    setSelectedPlaces(logPlaces);
    setSelectedTodo((data as any).todo || null);
    setSelectedGoal((data as any).goal || null);
    setGoalCount(data.goalCount || null);
  }, [data]);

  const handleSaveTags = async () => {
    // Close modal immediately for instant feedback
    setShowTagsModal(false);

    if (onOptimisticUpdate) {
      // Use optimistic update for instant UI feedback
      const updates: Partial<LogType> = {
        tags: editTags,
        goalCount: goalCount,
        // Note: We can't easily update the nested relations optimistically
        // but the tags and goalCount are the most important for instant feedback
      };

      const baseUrl = window.location.origin;
      const apiCall = () => axios.put(`${baseUrl}/api/log`, {
        id: data.id,
        tags: editTags,
        todoId: selectedTodo?.id || null,
        goalId: selectedGoal?.id || null,
        goalCount: goalCount || null,
        contactIds: selectedContacts.map(c => c.id),
        placeIds: selectedPlaces.map(p => p.id),
      });

      try {
        await onOptimisticUpdate(data.id, updates, apiCall);
        // After successful API call, do a full refetch to get the complete updated data
        // including the relations (contacts, places, todo, goal)
        onUpdate?.();
      } catch (error) {
        console.error("Error updating tags:", error);
        alert("Failed to update tags. Please try again.");
      }
    } else {
      // Fallback to old behavior if optimistic update not available
      const baseUrl = window.location.origin;
      try {
        await axios.put(`${baseUrl}/api/log`, {
          id: data.id,
          tags: editTags,
          todoId: selectedTodo?.id || null,
          goalId: selectedGoal?.id || null,
          goalCount: goalCount || null,
          contactIds: selectedContacts.map(c => c.id),
          placeIds: selectedPlaces.map(p => p.id),
        });
        onUpdate?.();
      } catch (error) {
        console.error("Error updating tags:", error);
        alert("Failed to update tags. Please try again.");
      }
    }
  };

  useEffect(() => {
    if (data?.start_time) {
      const interval = setInterval(() => {
        if (data.start_time) {
          setTimeDiff(getTimeDiffFromNowInHHMMSS(data.start_time.toString()));
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [data?.start_time]);

  function getTimeDiffFromNowInHHMMSS(isoTime: string): string {
    const isoTimeDate = DateTime.fromISO(isoTime);
    const now = DateTime.now();
    const diff = now.diff(isoTimeDate, ["hours", "minutes", "seconds"]);

    return `${diff.hours.toFixed(0).padStart(2, "0")}:${diff.minutes
      .toFixed(0)
      .padStart(2, "0")}:${diff.seconds.toFixed(0).padStart(2, "0")}`;
  }

  return (
    <div
      className={`p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border-2 transition-colors duration-300 ${
        isTempActivity
          ? 'border-yellow-500 dark:border-yellow-400'
          : 'border-red-500 dark:border-red-400'
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <AnimatePresence>
        {isTempActivity && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="mb-2 flex items-center gap-2 text-xs text-yellow-600 dark:text-yellow-400 overflow-hidden"
          >
            <div className="w-3 h-3 border-2 border-yellow-600 dark:border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
            <span>Saving...</span>
          </motion.div>
        )}
      </AnimatePresence>
      <div className={`flex items-center justify-between gap-3 ${todoInfo ? 'mb-3' : ''}`}>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div
            className={`flex-shrink-0 w-10 h-10 ${data.activityColor?.startsWith('custom-') ? '' : `bg-gradient-to-br ${data.activityColor || 'from-red-500 to-orange-600'}`} rounded-lg flex items-center justify-center text-white animate-pulse`}
            style={data.activityColor?.startsWith('custom-') ? { backgroundColor: data.activityColor.replace('custom-', '') } : {}}
          >
            <IconComponent size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
              {data?.activityTitle}
            </p>
            <p className="truncate text-xs text-gray-500 dark:text-gray-400">
              {data?.activityCategory}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-lg font-mono font-bold text-red-600 dark:text-red-400">
            {data?.start_time ? timeDiff : "N/A"}
          </div>
          <motion.button
            whileHover={isTempActivity ? {} : { scale: 1.1 }}
            whileTap={isTempActivity ? {} : { scale: 0.9 }}
            onClick={() => onStopAction(data.id)}
            disabled={isTempActivity}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
              isTempActivity
                ? 'bg-gray-200 dark:bg-gray-700 cursor-not-allowed opacity-50'
                : 'bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50'
            }`}
            title={isTempActivity ? 'Activity is being saved...' : 'Stop activity'}
          >
            <FaStop className={`text-sm transition-colors duration-300 ${
              isTempActivity
                ? 'text-gray-400 dark:text-gray-500'
                : 'text-red-600 dark:text-red-400'
            }`} />
          </motion.button>
        </div>
      </div>
      {(todoInfo || tags.length > 0 || selectedTodo || selectedGoal || selectedContacts.length > 0 || selectedPlaces.length > 0 || true) && (
        <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
          {todoInfo && (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-mono rounded">
                  {todoInfo.todoId}
                </span>
                <span className="text-sm text-gray-900 dark:text-white font-medium">
                  {todoInfo.title}
                </span>
              </div>
              {todoInfo.description && (
                <div className={`overflow-hidden transition-all duration-200 ${
                  isHovered ? 'max-h-20' : 'max-h-0'
                }`}>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                    {todoInfo.description}
                  </p>
                </div>
              )}
            </>
          )}
          <div className={`${todoInfo ? 'mt-2' : ''}`}>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">Tags:</span>
              {!isTempActivity && (
                <button
                  onClick={() => setShowTagsModal(true)}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                >
                  <FaEdit size={10} />
                  Edit
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1">
              {/* Text Tags */}
              {tags.map((tag, idx) => (
                <span
                  key={`tag-${idx}`}
                  className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded-full"
                >
                  #{tag}
                </span>
              ))}

              {/* Todo Tag */}
              {selectedTodo && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-xs rounded-full">
                  <FaTasks size={10} />
                  {selectedTodo.title}
                </span>
              )}

              {/* Goal Tag */}
              {selectedGoal && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-400 text-xs rounded-full">
                  <FaBullseye size={10} />
                  {selectedGoal.title}
                  {data.goalCount && (
                    <span className="ml-1 px-1.5 py-0.5 bg-pink-200 dark:bg-pink-800/50 rounded text-xs font-bold">
                      {data.goalCount}
                    </span>
                  )}
                </span>
              )}

              {/* People Tags */}
              {selectedContacts.map((contact) => (
                <span
                  key={`contact-${contact.id}`}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs rounded-full"
                >
                  <FaUsers size={10} />
                  {contact.name}
                </span>
              ))}

              {/* Places Tags */}
              {selectedPlaces.map((place) => (
                <span
                  key={`place-${place.id}`}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs rounded-full"
                >
                  <FaMapMarkedAlt size={10} />
                  {place.name}
                </span>
              ))}

              {/* No tags placeholder */}
              {tags.length === 0 &&
               !selectedTodo &&
               !selectedGoal &&
               selectedContacts.length === 0 &&
               selectedPlaces.length === 0 && (
                <span className="text-xs text-gray-400 italic">-</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tags Edit Modal */}
      {showTagsModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowTagsModal(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                Edit Tags
              </h3>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setShowTagsModal(false)}
                className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <FaTimes size={18} />
              </motion.button>
            </div>

            <div className="space-y-4">
              {/* Todo */}
              <div>
                <label className="flex items-center gap-2 mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                  <FaTasks className="text-purple-600 dark:text-purple-400" size={14} />
                  Todo
                </label>
                <Autocomplete
                  size="small"
                  options={allTodos}
                  getOptionLabel={(option) => option.title}
                  value={selectedTodo}
                  onChange={(_, newValue) => setSelectedTodo(newValue)}
                  renderOption={(props, option) => (
                    <li {...props} key={option.id}>
                      <div className="flex flex-col py-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{option.title}</span>
                          {option.done && (
                            <span className="px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs rounded">
                              Done
                            </span>
                          )}
                        </div>
                        {option.description && (
                          <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
                            {option.description}
                          </span>
                        )}
                      </div>
                    </li>
                  )}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder="Select a todo"
                      size="small"
                    />
                  )}
                />
              </div>

              {/* Goal */}
              <div>
                <label className="flex items-center gap-2 mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                  <FaBullseye className="text-pink-600 dark:text-pink-400" size={14} />
                  Goal
                </label>
                <Autocomplete
                  size="small"
                  options={allGoals}
                  getOptionLabel={(option) => option.title}
                  value={selectedGoal}
                  onChange={(_, newValue) => setSelectedGoal(newValue)}
                  renderOption={(props, option) => (
                    <li {...props} key={option.id}>
                      <div className="flex flex-col py-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{option.title}</span>
                          <span className={`px-1.5 py-0.5 text-xs rounded ${
                            option.goalType === 'limiting'
                              ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
                              : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                          }`}>
                            {option.goalType === 'limiting' ? 'Limiting' : 'Achievement'}
                          </span>
                        </div>
                        {option.description && (
                          <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
                            {option.description}
                          </span>
                        )}
                      </div>
                    </li>
                  )}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder="Select a goal"
                      size="small"
                    />
                  )}
                />

                {/* Goal Count Input - Only show if goal is selected */}
                {selectedGoal && (
                  <div className="mt-2">
                    <TextField
                      size="small"
                      type="number"
                      label="Goal Count (optional)"
                      value={goalCount || ""}
                      onChange={(e) => setGoalCount(e.target.value ? parseInt(e.target.value) : null)}
                      placeholder="e.g., 3 for 3 chapters"
                      fullWidth
                      helperText="For count-based goals (chapters, reps, pages, etc.)"
                    />
                  </div>
                )}
              </div>

              {/* People */}
              <div>
                <label className="flex items-center gap-2 mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                  <FaUsers className="text-blue-600 dark:text-blue-400" size={14} />
                  People
                </label>
                <Autocomplete
                  multiple
                  size="small"
                  options={allContacts}
                  getOptionLabel={(option) => option.name}
                  value={selectedContacts}
                  onChange={(_, newValue) => setSelectedContacts(newValue)}
                  renderOption={(props, option) => (
                    <li {...props} key={option.id}>
                      <div className="flex items-center gap-2 py-1">
                        {option.photoUrl ? (
                          <img
                            src={option.photoUrl}
                            alt={option.name}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                            <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                              {option.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <span className="font-medium">{option.name}</span>
                      </div>
                    </li>
                  )}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder="Select people"
                      size="small"
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

              {/* Places */}
              <div>
                <label className="flex items-center gap-2 mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                  <FaMapMarkedAlt className="text-green-600 dark:text-green-400" size={14} />
                  Places
                </label>
                <Autocomplete
                  multiple
                  size="small"
                  options={allPlaces}
                  getOptionLabel={(option) => option.name}
                  value={selectedPlaces}
                  onChange={(_, newValue) => setSelectedPlaces(newValue)}
                  renderOption={(props, option) => (
                    <li {...props} key={option.id}>
                      <div className="flex flex-col py-1">
                        <span className="font-medium">{option.name}</span>
                        {option.address && (
                          <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
                            {option.address}
                          </span>
                        )}
                      </div>
                    </li>
                  )}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder="Select places"
                      size="small"
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
            </div>

            <div className="flex gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSaveTags}
                className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
              >
                Save
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
