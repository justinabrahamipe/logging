"use client";
import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FaTimes, FaChevronDown, FaBullseye, FaCheckSquare } from "react-icons/fa";
import axios from "axios";

interface TagDropdownProps {
  value: string;
  onChange: (tags: string) => void;
  allLogs: LogType[];
  isDarkBg?: boolean;
  autoOpen?: boolean;
  onClose?: () => void;
}

interface TagOption {
  id: number;
  title: string;
  type: 'goal' | 'todo';
  isCompleted?: boolean;
  category?: string;
}

export default function TagDropdown({ value, onChange, allLogs, isDarkBg = false, autoOpen = false, onClose }: TagDropdownProps) {
  const [isOpen, setIsOpen] = useState(autoOpen);
  const [searchTerm, setSearchTerm] = useState("");
  const [availableOptions, setAvailableOptions] = useState<TagOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isMounted, setIsMounted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Handle mounting for portal
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Parse current tags
  const currentTags = useMemo(() => {
    return value
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
  }, [value]);

  // Auto-open when autoOpen prop is true
  useEffect(() => {
    if (autoOpen) {
      setIsOpen(true);
    }
  }, [autoOpen]);

  // Fetch goals and todos when dropdown opens
  useEffect(() => {
    if (isOpen && availableOptions.length === 0) {
      const fetchOptions = async () => {
        setLoading(true);
        const baseUrl = window.location.origin;
        try {
          const [goalsResponse, todosResponse] = await Promise.all([
            axios.get(`${baseUrl}/api/goal`),
            axios.get(`${baseUrl}/api/todo`)
          ]);

          const goals: TagOption[] = goalsResponse.data.data.map((goal: GoalType) => ({
            id: goal.id!,
            title: goal.title,
            type: 'goal' as const,
            isCompleted: goal.isCompleted,
            category: goal.activityCategory || undefined
          }));

          const todos: TagOption[] = todosResponse.data.data.map((todo: TodoType) => ({
            id: todo.id!,
            title: todo.title,
            type: 'todo' as const,
            isCompleted: todo.done,
            category: todo.activityCategory || undefined
          }));

          setAvailableOptions([...goals, ...todos]);
        } catch (error) {
          console.error("Error fetching tags:", error);
        } finally {
          setLoading(false);
        }
      };
      fetchOptions();
    }
  }, [isOpen, availableOptions.length]);

  // Filter options based on search and current tags
  const filteredOptions = useMemo(() => {
    // Get recent tags from localStorage
    let recentTags: string[] = [];
    try {
      recentTags = JSON.parse(localStorage.getItem('recentTags') || '[]');
    } catch (e) {
      // Ignore errors
    }

    return availableOptions
      .filter((option) =>
        searchTerm.length === 0 ||
        option.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        option.category?.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => {
        // Prioritize selected tags first
        const aSelected = currentTags.includes(a.title);
        const bSelected = currentTags.includes(b.title);

        if (aSelected && !bSelected) return -1;
        if (!aSelected && bSelected) return 1;

        // Then prioritize recent tags
        const aRecent = recentTags.indexOf(a.title);
        const bRecent = recentTags.indexOf(b.title);

        if (aRecent !== -1 && bRecent === -1) return -1;
        if (aRecent === -1 && bRecent !== -1) return 1;
        if (aRecent !== -1 && bRecent !== -1) return aRecent - bRecent;

        // Sort: incomplete first, then by type (goals then todos), then alphabetically
        if (a.isCompleted !== b.isCompleted) {
          return a.isCompleted ? 1 : -1;
        }
        if (a.type !== b.type) {
          return a.type === 'goal' ? -1 : 1;
        }
        return a.title.localeCompare(b.title);
      });
  }, [availableOptions, currentTags, searchTerm]);

  // Update dropdown position when opening (only for non-autoOpen mode)
  useEffect(() => {
    if (isOpen && !autoOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const dropdownHeight = 320; // max-h-80 = 320px
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;

      // Decide whether to show above or below
      const showAbove = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;

      setDropdownPosition({
        top: showAbove
          ? rect.top + window.scrollY - dropdownHeight - 8
          : rect.bottom + window.scrollY + 8,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
  }, [isOpen, autoOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Only check click outside if not in autoOpen mode or if containerRef exists
      if (autoOpen) {
        // In autoOpen mode, only check if click is outside dropdownRef
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
          setIsOpen(false);
          setSearchTerm("");
          onClose?.();
        }
      } else {
        // In normal mode, check both refs
        if (
          containerRef.current && !containerRef.current.contains(event.target as Node) &&
          dropdownRef.current && !dropdownRef.current.contains(event.target as Node)
        ) {
          setIsOpen(false);
          setSearchTerm("");
          onClose?.();
        }
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose, autoOpen]);

  const addTag = (title: string) => {
    const newTags = [...currentTags, title];
    onChange(newTags.join(", "));
    setSearchTerm("");
    inputRef.current?.focus();

    // Track recent tags in localStorage
    try {
      const recentTags = JSON.parse(localStorage.getItem('recentTags') || '[]') as string[];
      const updatedRecent = [title, ...recentTags.filter(t => t !== title)].slice(0, 10);
      localStorage.setItem('recentTags', JSON.stringify(updatedRecent));
    } catch (e) {
      console.error('Failed to save recent tags:', e);
    }
  };

  const removeTag = (tagToRemove: string) => {
    const newTags = currentTags.filter((tag) => tag !== tagToRemove);
    onChange(newTags.join(", "));
  };

  const clearAllTags = () => {
    onChange("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < filteredOptions.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === "Enter" && filteredOptions.length > 0) {
      e.preventDefault();
      const selectedOption = filteredOptions[selectedIndex];
      if (selectedOption) {
        if (currentTags.includes(selectedOption.title)) {
          removeTag(selectedOption.title);
        } else {
          addTag(selectedOption.title);
        }
      }
    } else if (e.key === "Backspace" && searchTerm === "" && currentTags.length > 0) {
      removeTag(currentTags[currentTags.length - 1]);
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setSearchTerm("");
      onClose?.();
    }
  };

  // Reset selected index when search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchTerm, filteredOptions.length]);

  // Scroll selected option into view
  useEffect(() => {
    if (optionRefs.current[selectedIndex]) {
      optionRefs.current[selectedIndex]?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth'
      });
    }
  }, [selectedIndex]);

  const baseInputClasses = isDarkBg
    ? "border-2 border-white/30 bg-white/10 text-white placeholder-white/60 focus:border-white/50"
    : "border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white";

  const modalContent = isOpen && (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9998
        }}
        className="bg-black/50 backdrop-blur-sm"
        onClick={() => {
          setIsOpen(false);
          setSearchTerm("");
          onClose?.();
        }}
      />

      {/* Modal Content */}
      <div
        ref={dropdownRef}
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 9999,
          maxWidth: '42rem',
          width: 'calc(100% - 2rem)',
          maxHeight: '80vh'
        }}
      >
        <motion.div
          initial={{
            opacity: 0,
            scale: 0.95
          }}
          animate={{
            opacity: 1,
            scale: 1
          }}
          exit={{
            opacity: 0,
            scale: 0.95
          }}
          transition={{ duration: 0.2 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full h-full flex flex-col overflow-hidden"
        >
              {/* Header */}
              <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                      Select Tags
                    </h3>
                    {currentTags.length > 0 && (
                      <span className="px-2.5 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs sm:text-sm font-bold rounded-full">
                        {currentTags.length} selected
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {currentTags.length > 0 && (
                      <button
                        onClick={clearAllTags}
                        className="px-3 py-1.5 text-xs sm:text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors font-medium"
                        title="Clear all tags"
                      >
                        Clear All
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setIsOpen(false);
                        setSearchTerm("");
                        onClose?.();
                      }}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <FaTimes className="text-gray-600 dark:text-gray-400" />
                    </button>
                  </div>
                </div>

                {/* Search Box */}
                <div className="relative">
                  <input
                    ref={inputRef}
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Search goals or todos..."
                    className="w-full px-4 py-3 pr-10 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    🔍
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden"
                style={{
                  scrollbarWidth: 'thin',
                  scrollbarColor: 'rgb(156 163 175) transparent'
                }}
              >
                {loading ? (
                  <div className="p-4 space-y-3">
                    {/* Loading skeleton */}
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="animate-pulse flex items-center gap-3 p-4 border-b border-gray-100 dark:border-gray-700/50">
                        <div className="w-2.5 h-2.5 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
                          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredOptions.length > 0 ? (
                  <div>
                    {/* Goals Section */}
                    {filteredOptions.some(opt => opt.type === 'goal') && (
                      <div>
                        <div className="sticky top-0 px-4 sm:px-6 py-3 text-xs sm:text-sm font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-b border-purple-100 dark:border-purple-800 flex items-center gap-2 z-10">
                          <FaBullseye className="text-purple-600 dark:text-purple-400" />
                          Goals ({filteredOptions.filter(opt => opt.type === 'goal').length})
                        </div>
                        {filteredOptions
                          .filter(opt => opt.type === 'goal')
                          .map((option, index) => {
                            const globalIndex = filteredOptions.indexOf(option);
                            const isSelected = globalIndex === selectedIndex;
                            return (
                            <motion.button
                              key={`goal-${option.id}`}
                              ref={(el) => { optionRefs.current[globalIndex] = el; }}
                              type="button"
                              whileHover={{ x: 4 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => {
                                if (currentTags.includes(option.title)) {
                                  removeTag(option.title);
                                } else {
                                  addTag(option.title);
                                }
                              }}
                              className={`w-full px-4 sm:px-6 py-3 sm:py-4 text-left hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 dark:hover:from-purple-900/20 dark:hover:to-pink-900/20 transition-all flex items-center justify-between border-b border-gray-100 dark:border-gray-700/50 ${
                                isSelected ? 'bg-purple-100 dark:bg-purple-900/30 ring-2 ring-purple-500 dark:ring-purple-400' :
                                currentTags.includes(option.title) ? 'bg-purple-100/50 dark:bg-purple-900/20 border-l-4 border-l-purple-500' : ''
                              }`}
                            >
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                                  option.isCompleted
                                    ? 'bg-green-500'
                                    : 'bg-purple-500'
                                }`} />
                                <span className={`text-gray-900 dark:text-white truncate font-medium ${option.isCompleted ? 'line-through opacity-50' : ''}`}>
                                  {option.title}
                                </span>
                                {option.category && (
                                  <span className="text-xs px-2.5 py-1 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded-lg font-semibold flex-shrink-0">
                                    {option.category}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {option.isCompleted && (
                                  <span className="text-xs text-green-600 dark:text-green-400 font-bold">
                                    ✓
                                  </span>
                                )}
                                {currentTags.includes(option.title) && (
                                  <span className="text-blue-600 dark:text-blue-400 text-xl">✓</span>
                                )}
                              </div>
                            </motion.button>
                          );
                        })}
                      </div>
                    )}

                    {/* Todos Section */}
                    {filteredOptions.some(opt => opt.type === 'todo') && (
                      <div>
                        <div className="sticky top-0 px-4 sm:px-6 py-3 text-xs sm:text-sm font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border-b border-blue-100 dark:border-blue-800 flex items-center gap-2 z-10">
                          <FaCheckSquare className="text-blue-600 dark:text-blue-400" />
                          Todos ({filteredOptions.filter(opt => opt.type === 'todo').length})
                        </div>
                        {filteredOptions
                          .filter(opt => opt.type === 'todo')
                          .map((option) => {
                            const globalIndex = filteredOptions.indexOf(option);
                            const isSelected = globalIndex === selectedIndex;
                            return (
                            <motion.button
                              key={`todo-${option.id}`}
                              ref={(el) => { optionRefs.current[globalIndex] = el; }}
                              type="button"
                              whileHover={{ x: 4 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => {
                                if (currentTags.includes(option.title)) {
                                  removeTag(option.title);
                                } else {
                                  addTag(option.title);
                                }
                              }}
                              className={`w-full px-4 sm:px-6 py-3 sm:py-4 text-left hover:bg-gradient-to-r hover:from-blue-50 hover:to-cyan-50 dark:hover:from-blue-900/20 dark:hover:to-cyan-900/20 transition-all flex items-center justify-between border-b border-gray-100 dark:border-gray-700/50 ${
                                isSelected ? 'bg-blue-100 dark:bg-blue-900/30 ring-2 ring-blue-500 dark:ring-blue-400' :
                                currentTags.includes(option.title) ? 'bg-blue-100/50 dark:bg-blue-900/20 border-l-4 border-l-blue-500' : ''
                              }`}
                            >
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                                  option.isCompleted
                                    ? 'bg-green-500'
                                    : 'bg-blue-500'
                                }`} />
                                <span className={`text-gray-900 dark:text-white truncate font-medium ${option.isCompleted ? 'line-through opacity-50' : ''}`}>
                                  {option.title}
                                </span>
                                {option.category && (
                                  <span className="text-xs px-2.5 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-lg font-semibold flex-shrink-0">
                                    {option.category}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {option.isCompleted && (
                                  <span className="text-xs text-green-600 dark:text-green-400 font-bold">
                                    ✓
                                  </span>
                                )}
                                {currentTags.includes(option.title) && (
                                  <span className="text-blue-600 dark:text-blue-400 text-xl">✓</span>
                                )}
                              </div>
                            </motion.button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="px-4 sm:px-6 py-16 text-center">
                    <div className="text-6xl mb-4 opacity-50">🎯</div>
                    <p className="text-base font-medium text-gray-600 dark:text-gray-400 mb-2">
                      {searchTerm
                        ? `No matches for "${searchTerm}"`
                        : 'No goals or todos yet'
                      }
                    </p>
                    {!searchTerm && (
                      <p className="text-sm text-gray-500 dark:text-gray-500">
                        Create some goals or todos first!
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex-shrink-0 space-y-3">
                <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  <span className="hidden sm:inline">Use ↑↓ arrow keys to navigate • </span>Press Enter to select{currentTags.length > 0 && ' • Backspace to remove last tag'}
                </div>
                <button
                  onClick={() => {
                    setIsOpen(false);
                    setSearchTerm("");
                    onClose?.();
                  }}
                  className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors"
                >
                  Done
                </button>
              </div>
        </motion.div>
      </div>
    </>
  );

  return (
    <>
      {!autoOpen && (
        <div className="relative" ref={containerRef}>
          {/* Tag Display / Click Area */}
          <div
            onClick={() => setIsOpen(true)}
            className={`w-full px-3 py-2.5 text-sm rounded-lg ${baseInputClasses} hover:border-blue-400 dark:hover:border-blue-500 cursor-pointer transition-all min-h-[44px] flex items-center`}
          >
          {currentTags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {currentTags.map((tag, idx) => (
                <motion.span
                  key={idx}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm ${
                    isDarkBg
                      ? "bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-white border border-white/20"
                      : "bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                  }`}
                >
                  <span className="truncate max-w-[200px]">{tag}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeTag(tag);
                    }}
                    className={`hover:bg-black/10 dark:hover:bg-white/10 rounded-full p-1 transition-colors ${
                      isDarkBg ? "hover:bg-white/20" : "hover:bg-blue-200 dark:hover:bg-blue-800"
                    }`}
                    title="Remove tag"
                  >
                    <FaTimes size={10} />
                  </button>
                </motion.span>
              ))}
            </div>
          ) : (
            <span className={`${isDarkBg ? "text-white/50" : "text-gray-400 dark:text-gray-500"}`}>
              Click to select goals or todos...
            </span>
          )}
        </div>

          {/* Helper text */}
          <p className={`mt-1 text-xs ${isDarkBg ? "text-white/60" : "text-gray-500 dark:text-gray-400"}`}>
            Click to add or remove tags
          </p>
        </div>
      )}

      {/* Modal via Portal */}
      {isMounted && createPortal(
        <AnimatePresence mode="wait">
          {modalContent}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
