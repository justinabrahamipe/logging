"use client";
import { DateTime } from "luxon";
import * as HiIcons from "react-icons/hi";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { FaStop, FaEdit, FaSave, FaTimes } from "react-icons/fa";
import TagDropdown from "@/app/(components)/TagDropdown";
import axios from "axios";

interface RunningActivityProps {
  data: LogType;
  onStopAction: (logId: number) => void;
  allLogs: LogType[];
  onUpdate?: () => void;
}

export default function RunningActivity({
  data,
  onStopAction,
  allLogs,
  onUpdate,
}: RunningActivityProps) {
  const IconComponent =
    HiIcons[data.activityIcon as keyof typeof HiIcons] ||
    HiIcons.HiOutlineQuestionMarkCircle;
  const [timeDiff, setTimeDiff] = useState("");
  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTags, setEditTags] = useState(data.tags || "");

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

  const handleSaveTags = async () => {
    const baseUrl = window.location.origin;
    try {
      await axios.put(`${baseUrl}/api/log`, {
        id: data.id,
        tags: editTags,
      });
      setIsEditing(false);
      onUpdate?.();
    } catch (error) {
      console.error("Error updating tags:", error);
    }
  };

  const handleCancelEdit = () => {
    setEditTags(data.tags || "");
    setIsEditing(false);
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
      className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border-2 border-red-500 dark:border-red-400"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
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
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => onStopAction(data.id)}
            className="w-8 h-8 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center"
          >
            <FaStop className="text-red-600 dark:text-red-400 text-sm" />
          </motion.button>
        </div>
      </div>
      {(todoInfo || tags.length > 0 || true) && (
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
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">Tags:</span>
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                >
                  <FaEdit size={10} />
                  {tags.length > 0 ? 'Edit' : 'Add'}
                </button>
              )}
            </div>
            {isEditing ? (
              <div className="space-y-2">
                <TagDropdown
                  value={editTags}
                  onChange={setEditTags}
                  allLogs={allLogs}
                  autoOpen={true}
                  onClose={handleSaveTags}
                />
              </div>
            ) : tags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-semibold rounded-lg"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 dark:text-gray-500 italic">No tags yet</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
