"use client";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DateTime } from "luxon";
import { DayPicker } from "react-day-picker";
import { FaCalendar } from "react-icons/fa";
import "react-day-picker/dist/style.css";

interface DatePickerProps {
  value: string;
  onChangeAction: (value: string) => void;
  placeholder?: string;
  className?: string;
  disableFuture?: boolean;
  disablePast?: boolean;
}

export default function DatePicker({
  value,
  onChangeAction,
  placeholder = "Select date",
  className = "",
  disableFuture = false,
  disablePast = false,
}: DatePickerProps) {
  const [showCalendar, setShowCalendar] = useState(false);
  const [position, setPosition] = useState<{ top?: number; bottom?: number; left: number }>({ left: 0 });
  const calendarRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close calendar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setShowCalendar(false);
      }
    };

    if (showCalendar) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showCalendar]);

  // Calculate position when calendar opens
  useEffect(() => {
    if (showCalendar && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const calendarHeight = 320;

      let newPosition: { top?: number; bottom?: number; left: number };

      if (spaceBelow < calendarHeight && spaceAbove > spaceBelow) {
        // Position above
        newPosition = {
          bottom: window.innerHeight - rect.top + 8,
          left: rect.left,
        };
      } else {
        // Position below
        newPosition = {
          top: rect.bottom + 8,
          left: rect.left,
        };
      }

      setPosition(newPosition);
    }
  }, [showCalendar]);

  const getDisabledDays = () => {
    if (disableFuture && disablePast) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      return { after: new Date(), before: yesterday };
    }
    if (disableFuture) {
      return { after: new Date() };
    }
    if (disablePast) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      return { before: yesterday };
    }
    return undefined;
  };

  return (
    <div className="relative" ref={calendarRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setShowCalendar(!showCalendar)}
        className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors cursor-pointer hover:border-gray-400 dark:hover:border-gray-500 w-full ${className}`}
      >
        <FaCalendar className="text-gray-500 dark:text-gray-400" />
        <span className={value ? "" : "text-gray-500 dark:text-gray-400"}>
          {value ? DateTime.fromISO(value).toFormat("MMM dd, yyyy") : placeholder}
        </span>
      </button>

      {/* Calendar Popup */}
      <AnimatePresence>
        {showCalendar && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed z-[9999] bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-3"
            style={{
              minWidth: "300px",
              maxWidth: "320px",
              top: position.top !== undefined ? `${position.top}px` : 'auto',
              bottom: position.bottom !== undefined ? `${position.bottom}px` : 'auto',
              left: `${position.left}px`,
            }}
          >
            <style jsx global>{`
              .rdp {
                --rdp-cell-size: 32px;
                --rdp-accent-color: #3b82f6;
                --rdp-background-color: #dbeafe;
                margin: 0;
              }
              .dark .rdp {
                --rdp-accent-color: #60a5fa;
                --rdp-background-color: #1e3a8a;
              }
              .rdp-months {
                justify-content: center;
              }
              .rdp-month {
                margin: 0;
              }
              .rdp-caption {
                display: flex;
                justify-content: center;
                padding: 0.25rem 0;
                font-weight: 600;
                font-size: 0.875rem;
              }
              .rdp-head_cell {
                font-weight: 600;
                font-size: 0.65rem;
                color: #6b7280;
                text-transform: uppercase;
              }
              .dark .rdp-head_cell {
                color: #9ca3af;
              }
              .rdp-button:hover:not([disabled]):not(.rdp-day_selected) {
                background-color: #f3f4f6;
              }
              .dark .rdp-button:hover:not([disabled]):not(.rdp-day_selected) {
                background-color: #374151;
              }
              .rdp-day_today:not(.rdp-day_selected) {
                font-weight: bold;
                color: #3b82f6;
              }
              .dark .rdp-day_today:not(.rdp-day_selected) {
                color: #60a5fa;
              }
              .rdp-day_selected {
                background-color: #3b82f6 !important;
                color: white !important;
                font-weight: 600;
              }
              .dark .rdp-day_selected {
                background-color: #2563eb !important;
              }
              .rdp-day {
                border-radius: 0.375rem;
                transition: all 0.2s;
                font-size: 0.8rem;
              }
            `}</style>
            <DayPicker
              mode="single"
              selected={value ? new Date(value) : undefined}
              onSelect={(date) => {
                if (date) {
                  const formatted = DateTime.fromJSDate(date).toFormat("yyyy-MM-dd");
                  onChangeAction(formatted);
                  setShowCalendar(false);
                }
              }}
              disabled={getDisabledDays()}
              className="text-gray-900 dark:text-white"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
