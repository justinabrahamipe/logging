"use client";
import { DateTime } from "luxon";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as HiIcons from "react-icons/hi";
import { FaTrash, FaEdit, FaSave, FaTimes } from "react-icons/fa";
import axios from "axios";

export default function ActivityHistory({
  data,
  setRerun,
  activities,
}: {
  data: LogType[];
  setRerun: React.Dispatch<React.SetStateAction<boolean>>;
  activities: ActivityType[];
}) {
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [hoveredLogId, setHoveredLogId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<LogType>>({});

  // Parse TODO info from comment
  const parseTodoInfo = (comment: string | null) => {
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

  const handleDelete = async (id: string) => {
    const baseUrl = window.location.origin;
    try {
      await axios.delete(`${baseUrl}/api/log`, {
        data: { id: parseInt(id) }
      });
      setDeleteConfirmId(null);
      setRerun((prev) => !prev);
    } catch (error) {
      console.error("Error deleting log:", error);
    }
  };

  const handleEdit = (log: LogType) => {
    setEditingId(log.id);
    setEditForm({
      ...log,
      tags: log.tags || '',
      comment: log.comment || '',
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    const baseUrl = window.location.origin;
    try {
      const selectedActivity = activities.find(a => a.title === editForm.activityTitle);
      await axios.put(`${baseUrl}/api/log`, {
        id: editingId,
        comment: editForm.comment,
        activityTitle: editForm.activityTitle,
        activityCategory: selectedActivity?.category || editForm.activityCategory,
        activityIcon: selectedActivity?.icon || editForm.activityIcon,
        activityColor: selectedActivity?.color || editForm.activityColor,
        start_time: editForm.start_time,
        end_time: editForm.end_time,
        tags: editForm.tags,
      });
      setEditingId(null);
      setEditForm({});
      setRerun((prev) => !prev);
    } catch (error) {
      console.error("Error updating log:", error);
    }
  };

  const calculateDuration = (start: string | null, end: string | null) => {
    if (!start) return "N/A";
    if (!end) return "Running...";
    const startTime = DateTime.fromISO(start);
    const endTime = DateTime.fromISO(end);
    const diff = endTime.diff(startTime, ["hours", "minutes", "seconds"]);
    const hours = Math.floor(diff.hours);
    const minutes = Math.floor(diff.minutes);
    const seconds = Math.floor(diff.seconds);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const formatTime = (time: string | null) => {
    if (!time) return "N/A";
    return DateTime.fromISO(time).toFormat("dd/MM/yy HH:mm");
  };

  // Show all logs (including running ones)
  const allLogs = data;

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {allLogs?.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">📋</div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              No history yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Your activities will appear here
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Activity
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">
                    Description
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider hidden lg:table-cell">
                    Tags
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Time
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                <AnimatePresence>
                  {allLogs.map((log: LogType, index: number) => {
                    const IconComponent =
                      HiIcons[log.activityIcon as keyof typeof HiIcons] ||
                      HiIcons.HiOutlineQuestionMarkCircle;
                    const todoInfo = parseTodoInfo(log.comment);
                    const tags = parseTags(log.tags);
                    const isHovered = hoveredLogId === log.id;

                    const isEditing = editingId === log.id;

                    return (
                      <motion.tr
                        key={log.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ delay: index * 0.03 }}
                        onMouseEnter={() => !isEditing && setHoveredLogId(log.id)}
                        onMouseLeave={() => setHoveredLogId(null)}
                        className={`${!isEditing && 'hover:bg-gray-50 dark:hover:bg-gray-900/30'} transition-colors ${isEditing && 'bg-blue-50 dark:bg-blue-900/10'}`}
                      >
                        {/* Activity */}
                        <td className="px-6 py-4">
                          {isEditing ? (
                            <select
                              value={editForm.activityTitle || ''}
                              onChange={(e) => {
                                const selected = activities.find(a => a.title === e.target.value);
                                setEditForm({
                                  ...editForm,
                                  activityTitle: e.target.value,
                                  activityCategory: selected?.category || '',
                                  activityIcon: selected?.icon || '',
                                  activityColor: selected?.color || '',
                                });
                              }}
                              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            >
                              {activities.map((activity) => (
                                <option key={activity.id} value={activity.title}>
                                  {activity.title}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <div className="flex items-center gap-3">
                              <div
                                className={`flex-shrink-0 w-10 h-10 ${log.activityColor?.startsWith('custom-') ? '' : `bg-gradient-to-br ${log.activityColor || 'from-blue-500 to-purple-600'}`} rounded-lg flex items-center justify-center text-white`}
                                style={log.activityColor?.startsWith('custom-') ? { backgroundColor: log.activityColor.replace('custom-', '') } : {}}
                              >
                                <IconComponent size={18} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                  {log.activityTitle}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                  {log.activityCategory}
                                </p>
                              </div>
                            </div>
                          )}
                        </td>

                        {/* Description */}
                        <td className="px-6 py-4 hidden md:table-cell">
                          {isEditing ? (
                            <textarea
                              value={editForm.comment || ''}
                              onChange={(e) => setEditForm({ ...editForm, comment: e.target.value })}
                              placeholder="Description"
                              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                              rows={2}
                            />
                          ) : (
                            <div className="max-w-xs">
                              {todoInfo ? (
                                <>
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-mono rounded">
                                      {todoInfo.todoId}
                                    </span>
                                    <span className="text-sm text-gray-900 dark:text-white font-medium truncate">
                                      {todoInfo.title}
                                    </span>
                                  </div>
                                  {todoInfo.description && (
                                    <div className={`overflow-hidden transition-all duration-200 ${
                                      isHovered ? 'max-h-20' : 'max-h-0'
                                    }`}>
                                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        {todoInfo.description}
                                      </p>
                                    </div>
                                  )}
                                </>
                              ) : (
                                <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                                  {log.comment || <span className="italic text-gray-400">No description</span>}
                                </p>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Tags */}
                        <td className="px-6 py-4 hidden lg:table-cell">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editForm.tags || ''}
                              onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
                              placeholder="Tags (comma-separated)"
                              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {tags.length > 0 ? (
                                tags.map((tag, idx) => (
                                  <span
                                    key={idx}
                                    className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded-full"
                                  >
                                    #{tag}
                                  </span>
                                ))
                              ) : (
                                <span className="text-sm text-gray-400 italic">-</span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Time (Start & End) */}
                        <td className="px-6 py-4">
                          {isEditing ? (
                            <div className="space-y-2">
                              <input
                                type="datetime-local"
                                value={editForm.start_time ? DateTime.fromJSDate(new Date(editForm.start_time)).toFormat("yyyy-MM-dd'T'HH:mm") : ''}
                                onChange={(e) => setEditForm({ ...editForm, start_time: new Date(e.target.value) })}
                                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              />
                              <input
                                type="datetime-local"
                                value={editForm.end_time ? DateTime.fromJSDate(new Date(editForm.end_time)).toFormat("yyyy-MM-dd'T'HH:mm") : ''}
                                onChange={(e) => setEditForm({ ...editForm, end_time: e.target.value ? new Date(e.target.value) : null })}
                                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              />
                            </div>
                          ) : (
                            <div className="text-sm text-gray-900 dark:text-white font-mono space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500 dark:text-gray-400">Start:</span>
                                <span>{formatTime(log.start_time?.toString() || null)}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500 dark:text-gray-400">End:</span>
                                <span>{formatTime(log.end_time?.toString() || null)}</span>
                              </div>
                            </div>
                          )}
                        </td>

                        {/* Duration */}
                        <td className="px-6 py-4">
                          {!isEditing && (
                            <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400">
                              {calculateDuration(log.start_time?.toString() || null, log.end_time?.toString() || null)}
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            {isEditing ? (
                              <>
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={handleSaveEdit}
                                  className="p-2 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                                  title="Save"
                                >
                                  <FaSave size={14} />
                                </motion.button>
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={handleCancelEdit}
                                  className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900/20 rounded-lg transition-colors"
                                  title="Cancel"
                                >
                                  <FaTimes size={14} />
                                </motion.button>
                              </>
                            ) : (
                              <>
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => handleEdit(log)}
                                  className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                  title="Edit log"
                                >
                                  <FaEdit size={14} />
                                </motion.button>
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => setDeleteConfirmId(log.id)}
                                  className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                  title="Delete log"
                                >
                                  <FaTrash size={14} />
                                </motion.button>
                              </>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
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
            onClick={() => setDeleteConfirmId(null)}
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
                    Delete Log?
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                    Are you sure you want to delete this log entry? This action cannot be undone.
                  </p>
                  <div className="flex gap-3">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setDeleteConfirmId(null)}
                      className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      Cancel
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleDelete(deleteConfirmId)}
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
    </>
  );
}
