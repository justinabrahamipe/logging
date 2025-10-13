"use client";
import { motion } from "framer-motion";
import * as HiIcons from "react-icons/hi";
import { FaPlay } from "react-icons/fa";

interface ActivityPresetProps {
  data: ActivityType;
  onStart: (activity: ActivityType) => void;
}

export default function ActivityPreset({
  data,
  onStart,
}: ActivityPresetProps) {
  const IconComponent =
    HiIcons[data.icon as keyof typeof HiIcons] ||
    HiIcons.HiOutlineQuestionMarkCircle;

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onStart(data)}
      className="w-full p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-all border border-gray-200 dark:border-gray-700 text-left"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div
            className={`flex-shrink-0 w-10 h-10 ${data.color?.startsWith('custom-') ? '' : `bg-gradient-to-br ${data.color || 'from-green-500 to-emerald-600'}`} rounded-lg flex items-center justify-center text-white`}
            style={data.color?.startsWith('custom-') ? { backgroundColor: data.color.replace('custom-', '') } : {}}
          >
            <IconComponent size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
              {data?.title}
            </p>
            <p className="truncate text-xs text-gray-500 dark:text-gray-400">
              {data?.category}
            </p>
          </div>
        </div>
        <motion.div
          whileHover={{ scale: 1.2 }}
          className="flex-shrink-0 w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center"
        >
          <FaPlay className="text-green-600 dark:text-green-400 text-sm ml-0.5" />
        </motion.div>
      </div>
    </motion.button>
  );
}
