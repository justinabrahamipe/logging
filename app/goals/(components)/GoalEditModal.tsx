"use client";
import { motion, AnimatePresence } from "framer-motion";
import { FaTimes } from "react-icons/fa";
import GoalForm from "./GoalForm";

interface GoalEditModalProps {
  isOpen: boolean;
  goal: GoalType | null | undefined;
  activities: ActivityType[];
  onSaveAction: (data: GoalType) => void;
  onCancelAction: () => void;
}

export default function GoalEditModal({ isOpen, goal, activities, onSaveAction, onCancelAction }: GoalEditModalProps) {
  if (!goal) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onCancelAction}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 flex items-center justify-between z-10">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Edit Goal
              </h2>
              <button
                onClick={onCancelAction}
                className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <FaTimes size={20} />
              </button>
            </div>
            <div className="p-6">
              <GoalForm
                initialData={goal}
                onSaveAction={onSaveAction}
                onCancelAction={onCancelAction}
                activities={activities}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
