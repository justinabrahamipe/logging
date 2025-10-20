"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaPlay, FaPause, FaStop, FaBook, FaChevronLeft, FaChevronRight, FaClock, FaBullseye, FaPlus, FaMinus } from "react-icons/fa";
import axios from "axios";

// Bible books structure
const OLD_TESTAMENT = [
  { name: "Genesis", abbr: "genesis", chapters: 50 },
  { name: "Exodus", abbr: "exodus", chapters: 40 },
  { name: "Leviticus", abbr: "leviticus", chapters: 27 },
  { name: "Numbers", abbr: "numbers", chapters: 36 },
  { name: "Deuteronomy", abbr: "deuteronomy", chapters: 34 },
  { name: "Joshua", abbr: "joshua", chapters: 24 },
  { name: "Judges", abbr: "judges", chapters: 21 },
  { name: "Ruth", abbr: "ruth", chapters: 4 },
  { name: "1 Samuel", abbr: "1samuel", chapters: 31 },
  { name: "2 Samuel", abbr: "2samuel", chapters: 24 },
  { name: "1 Kings", abbr: "1kings", chapters: 22 },
  { name: "2 Kings", abbr: "2kings", chapters: 25 },
  { name: "1 Chronicles", abbr: "1chronicles", chapters: 29 },
  { name: "2 Chronicles", abbr: "2chronicles", chapters: 36 },
  { name: "Ezra", abbr: "ezra", chapters: 10 },
  { name: "Nehemiah", abbr: "nehemiah", chapters: 13 },
  { name: "Esther", abbr: "esther", chapters: 10 },
  { name: "Job", abbr: "job", chapters: 42 },
  { name: "Psalms", abbr: "psalms", chapters: 150 },
  { name: "Proverbs", abbr: "proverbs", chapters: 31 },
  { name: "Ecclesiastes", abbr: "ecclesiastes", chapters: 12 },
  { name: "Song of Solomon", abbr: "song+of+solomon", chapters: 8 },
  { name: "Isaiah", abbr: "isaiah", chapters: 66 },
  { name: "Jeremiah", abbr: "jeremiah", chapters: 52 },
  { name: "Lamentations", abbr: "lamentations", chapters: 5 },
  { name: "Ezekiel", abbr: "ezekiel", chapters: 48 },
  { name: "Daniel", abbr: "daniel", chapters: 12 },
  { name: "Hosea", abbr: "hosea", chapters: 14 },
  { name: "Joel", abbr: "joel", chapters: 3 },
  { name: "Amos", abbr: "amos", chapters: 9 },
  { name: "Obadiah", abbr: "obadiah", chapters: 1 },
  { name: "Jonah", abbr: "jonah", chapters: 4 },
  { name: "Micah", abbr: "micah", chapters: 7 },
  { name: "Nahum", abbr: "nahum", chapters: 3 },
  { name: "Habakkuk", abbr: "habakkuk", chapters: 3 },
  { name: "Zephaniah", abbr: "zephaniah", chapters: 3 },
  { name: "Haggai", abbr: "haggai", chapters: 2 },
  { name: "Zechariah", abbr: "zechariah", chapters: 14 },
  { name: "Malachi", abbr: "malachi", chapters: 4 },
];

const NEW_TESTAMENT = [
  { name: "Matthew", abbr: "matthew", chapters: 28 },
  { name: "Mark", abbr: "mark", chapters: 16 },
  { name: "Luke", abbr: "luke", chapters: 24 },
  { name: "John", abbr: "john", chapters: 21 },
  { name: "Acts", abbr: "acts", chapters: 28 },
  { name: "Romans", abbr: "romans", chapters: 16 },
  { name: "1 Corinthians", abbr: "1corinthians", chapters: 16 },
  { name: "2 Corinthians", abbr: "2corinthians", chapters: 13 },
  { name: "Galatians", abbr: "galatians", chapters: 6 },
  { name: "Ephesians", abbr: "ephesians", chapters: 6 },
  { name: "Philippians", abbr: "philippians", chapters: 4 },
  { name: "Colossians", abbr: "colossians", chapters: 4 },
  { name: "1 Thessalonians", abbr: "1thessalonians", chapters: 5 },
  { name: "2 Thessalonians", abbr: "2thessalonians", chapters: 3 },
  { name: "1 Timothy", abbr: "1timothy", chapters: 6 },
  { name: "2 Timothy", abbr: "2timothy", chapters: 4 },
  { name: "Titus", abbr: "titus", chapters: 3 },
  { name: "Philemon", abbr: "philemon", chapters: 1 },
  { name: "Hebrews", abbr: "hebrews", chapters: 13 },
  { name: "James", abbr: "james", chapters: 5 },
  { name: "1 Peter", abbr: "1peter", chapters: 5 },
  { name: "2 Peter", abbr: "2peter", chapters: 3 },
  { name: "1 John", abbr: "1john", chapters: 5 },
  { name: "2 John", abbr: "2john", chapters: 1 },
  { name: "3 John", abbr: "3john", chapters: 1 },
  { name: "Jude", abbr: "jude", chapters: 1 },
  { name: "Revelation", abbr: "revelation", chapters: 22 },
];

const ALL_BOOKS = [...OLD_TESTAMENT, ...NEW_TESTAMENT];

interface Verse {
  book_name: string;
  chapter: number;
  verse: number;
  text: string;
}

interface ChapterData {
  reference: string;
  verses: Verse[];
  text: string;
}

export default function BiblePage() {
  const [selectedBook, setSelectedBook] = useState(ALL_BOOKS[0]);
  const [selectedChapter, setSelectedChapter] = useState(1);
  const [chapterData, setChapterData] = useState<ChapterData | null>(null);
  const [loading, setLoading] = useState(false);
  const [isLogging, setIsLogging] = useState(false);
  const [logStartTime, setLogStartTime] = useState<Date | null>(null);
  const [currentLogId, setCurrentLogId] = useState<number | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [bibleGoals, setBibleGoals] = useState<GoalType[]>([]);
  const [chaptersRead, setChaptersRead] = useState<string[]>([]); // Track chapters read during logging
  const [startingChapter, setStartingChapter] = useState<string>(""); // Track where logging started
  const [manualChapterCount, setManualChapterCount] = useState<number>(0); // Manual counter for chapters
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Fetch Bible goals on mount
  useEffect(() => {
    fetchBibleGoals();
  }, []);

  const fetchBibleGoals = async () => {
    try {
      const baseUrl = window.location.origin;
      const response = await axios.get(`${baseUrl}/api/goal`);
      const goals = response.data.data || [];
      // Filter for Bible reading goals (assuming activity title is "Bible Reading")
      const bibleGoals = goals.filter(
        (goal: GoalType) =>
          goal.activityTitle === "Bible Reading" &&
          goal.isActive &&
          !goal.isCompleted
      );
      setBibleGoals(bibleGoals);
    } catch (error) {
      console.error("Error fetching Bible goals:", error);
    }
  };

  // Load chapter data and track chapters read during logging
  useEffect(() => {
    loadChapter();

    // Track chapter changes during logging
    if (isLogging) {
      const chapterKey = `${selectedBook.name} ${selectedChapter}`;
      if (!chaptersRead.includes(chapterKey)) {
        setChaptersRead(prev => [...prev, chapterKey]);
        // Auto-increment manual counter when a new chapter is read
        setManualChapterCount(prev => prev + 1);
      }
    }
  }, [selectedBook, selectedChapter]);

  const loadChapter = async () => {
    setLoading(true);
    try {
      // Using bible-api.com
      const reference = `${selectedBook.abbr}+${selectedChapter}`;
      const response = await fetch(`https://bible-api.com/${reference}?translation=kjv`);
      const data = await response.json();
      setChapterData(data);
    } catch (error) {
      console.error("Error loading chapter:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartLogging = async () => {
    try {
      const baseUrl = window.location.origin;
      const startTime = new Date();
      const startChapter = `${selectedBook.name} ${selectedChapter}`;

      // Create a log entry for Bible reading
      const logData: any = {
        activityTitle: "Bible Reading",
        activityCategory: "Spiritual",
        activityIcon: "HiBookOpen",
        activityColor: "from-purple-500 to-indigo-600",
        start_time: startTime.toISOString(),
        comment: startChapter,
      };

      // If there's an active Bible reading goal with count metric, link it
      const countGoal = bibleGoals.find(g => g.metricType === "count");
      if (countGoal) {
        logData.goalId = countGoal.id;
        logData.goalCount = 1; // Will be updated when stopping
      }

      const response = await axios.post(`${baseUrl}/api/log`, logData);

      setCurrentLogId(response.data.id);
      setLogStartTime(startTime);
      setIsLogging(true);
      setStartingChapter(startChapter);
      setChaptersRead([startChapter]); // Initialize with starting chapter
      setManualChapterCount(1); // Initialize counter to 1
    } catch (error) {
      console.error("Error starting log:", error);
    }
  };

  const handleStopLogging = async () => {
    if (!currentLogId || !logStartTime) return;

    try {
      const baseUrl = window.location.origin;
      const endTime = new Date();

      // Build comment with all chapters read
      let comment = "";

      if (chaptersRead.length === 1) {
        comment = chaptersRead[0];
      } else {
        comment = `${manualChapterCount} chapters: ${chaptersRead.join(", ")}`;
      }

      // Prepare update data
      const updateData: any = {
        id: currentLogId,
        end_time: endTime.toISOString(),
        comment: comment,
      };

      // Update goal count if there's a goal linked - use manual counter
      const countGoal = bibleGoals.find(g => g.metricType === "count");
      if (countGoal) {
        updateData.goalCount = manualChapterCount; // Use manual counter value
      }

      await axios.put(`${baseUrl}/api/log`, updateData);

      setIsLogging(false);
      setCurrentLogId(null);
      setLogStartTime(null);
      setChaptersRead([]);
      setStartingChapter("");
      setManualChapterCount(0);
    } catch (error) {
      console.error("Error stopping log:", error);
    }
  };

  const handleSpeak = () => {
    if (!chapterData) return;

    if (isSpeaking) {
      // Stop speaking
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    // Start speaking
    const utterance = new SpeechSynthesisUtterance(chapterData.text);
    utterance.rate = 0.9; // Slightly slower for better comprehension
    utterance.pitch = 1;
    utterance.volume = 1;

    utterance.onend = () => {
      setIsSpeaking(false);

      // When audio finishes, automatically move to next chapter if logging
      if (isLogging) {
        navigateChapter("next");
      }
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
    };

    speechRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  };

  const navigateChapter = (direction: "prev" | "next") => {
    if (direction === "prev") {
      if (selectedChapter > 1) {
        setSelectedChapter(selectedChapter - 1);
      } else {
        // Go to previous book's last chapter
        const currentBookIndex = ALL_BOOKS.findIndex(b => b.abbr === selectedBook.abbr);
        if (currentBookIndex > 0) {
          const prevBook = ALL_BOOKS[currentBookIndex - 1];
          setSelectedBook(prevBook);
          setSelectedChapter(prevBook.chapters);
        }
      }
    } else {
      if (selectedChapter < selectedBook.chapters) {
        setSelectedChapter(selectedChapter + 1);
      } else {
        // Go to next book's first chapter
        const currentBookIndex = ALL_BOOKS.findIndex(b => b.abbr === selectedBook.abbr);
        if (currentBookIndex < ALL_BOOKS.length - 1) {
          const nextBook = ALL_BOOKS[currentBookIndex + 1];
          setSelectedBook(nextBook);
          setSelectedChapter(1);
        }
      }
    }
  };

  const getElapsedTime = () => {
    if (!logStartTime) return "00:00:00";
    const now = new Date();
    const diff = now.getTime() - logStartTime.getTime();
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Update elapsed time every second when logging
  const [elapsedTime, setElapsedTime] = useState("00:00:00");
  useEffect(() => {
    if (isLogging) {
      const interval = setInterval(() => {
        setElapsedTime(getElapsedTime());
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isLogging, logStartTime]);

  // Stop speech when component unmounts or user navigates away
  useEffect(() => {
    return () => {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Stop speech when tab becomes hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && window.speechSynthesis.speaking) {
        window.speechSynthesis.pause();
      } else if (!document.hidden && window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950 py-4 md:py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="mb-4">
            {/* Title Row */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 md:gap-3 min-w-0">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                  <FaBook className="text-white text-lg md:text-2xl" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-xl md:text-3xl font-bold text-gray-900 dark:text-white truncate">
                    Holy Bible
                  </h1>
                  <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 hidden sm:block">King James Version</p>
                </div>
              </div>

              {/* Start/Stop Button */}
              <div className="flex-shrink-0">
                {!isLogging ? (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleStartLogging}
                    className="px-3 md:px-6 py-2 md:py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold shadow-lg flex items-center gap-2 text-sm md:text-base"
                  >
                    <FaPlay size={12} className="md:w-[14px]" />
                    <span className="hidden sm:inline">Start Logging</span>
                    <span className="sm:hidden">Start</span>
                  </motion.button>
                ) : (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleStopLogging}
                    className="px-3 md:px-6 py-2 md:py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold shadow-lg flex items-center gap-2 text-sm md:text-base"
                  >
                    <FaStop size={12} className="md:w-[14px]" />
                    <span className="hidden sm:inline">Stop Logging</span>
                    <span className="sm:hidden">Stop</span>
                  </motion.button>
                )}
              </div>
            </div>

            {/* Logging Controls Row (when logging) */}
            {isLogging && (
              <div className="flex flex-wrap items-center gap-2 md:gap-3">
                <div className="flex items-center gap-2 px-3 md:px-4 py-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                  <FaClock className="text-red-600 dark:text-red-400 animate-pulse text-sm" />
                  <span className="text-xs md:text-sm font-mono font-bold text-red-600 dark:text-red-400">
                    {elapsedTime}
                  </span>
                </div>

                {/* Manual Chapter Counter with +/- buttons */}
                <div className="flex items-center gap-1.5 md:gap-2 px-2.5 md:px-3 py-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <FaBook className="text-purple-600 dark:text-purple-400" size={12} />
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setManualChapterCount(Math.max(0, manualChapterCount - 1))}
                    className="w-5 h-5 md:w-6 md:h-6 flex items-center justify-center bg-purple-200 dark:bg-purple-800 hover:bg-purple-300 dark:hover:bg-purple-700 rounded-md transition-colors"
                  >
                    <FaMinus className="text-purple-700 dark:text-purple-300" size={8} />
                  </motion.button>
                  <span className="text-xs md:text-sm font-bold text-purple-700 dark:text-purple-400 min-w-[2.5rem] md:min-w-[3rem] text-center">
                    {manualChapterCount} <span className="hidden sm:inline">{manualChapterCount === 1 ? 'Ch' : 'Chs'}</span>
                  </span>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setManualChapterCount(manualChapterCount + 1)}
                    className="w-5 h-5 md:w-6 md:h-6 flex items-center justify-center bg-purple-200 dark:bg-purple-800 hover:bg-purple-300 dark:hover:bg-purple-700 rounded-md transition-colors"
                  >
                    <FaPlus className="text-purple-700 dark:text-purple-300" size={8} />
                  </motion.button>
                </div>

                {bibleGoals.length > 0 && (
                  <div className="flex items-center gap-2 px-2.5 md:px-3 py-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                    <FaBullseye className="text-purple-600 dark:text-purple-400" size={12} />
                    <span className="text-xs font-medium text-purple-700 dark:text-purple-400">
                      {bibleGoals.length} Goal{bibleGoals.length > 1 ? 's' : ''}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Book Selection Sidebar */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-1"
          >
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sticky top-20">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Books</h2>

              {/* Old Testament */}
              <div className="mb-6">
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
                  Old Testament
                </h3>
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {OLD_TESTAMENT.map((book) => (
                    <button
                      key={book.abbr}
                      onClick={() => {
                        setSelectedBook(book);
                        setSelectedChapter(1);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        selectedBook.abbr === book.abbr
                          ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 font-semibold"
                          : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      }`}
                    >
                      {book.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* New Testament */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
                  New Testament
                </h3>
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {NEW_TESTAMENT.map((book) => (
                    <button
                      key={book.abbr}
                      onClick={() => {
                        setSelectedBook(book);
                        setSelectedChapter(1);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        selectedBook.abbr === book.abbr
                          ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 font-semibold"
                          : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      }`}
                    >
                      {book.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Main Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-3"
          >
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              {/* Chapter Navigation */}
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                      {selectedBook.name} {selectedChapter}
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {selectedBook.chapters} chapters
                    </p>
                  </div>

                  {/* Audio Control */}
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleSpeak}
                    className={`px-4 py-2 rounded-lg font-semibold shadow-md flex items-center gap-2 ${
                      isSpeaking
                        ? "bg-red-600 hover:bg-red-700 text-white"
                        : "bg-blue-600 hover:bg-blue-700 text-white"
                    }`}
                  >
                    {isSpeaking ? (
                      <>
                        <FaPause size={14} />
                        Stop Audio
                      </>
                    ) : (
                      <>
                        <FaPlay size={14} />
                        Listen
                      </>
                    )}
                  </motion.button>
                </div>

                {/* Chapter Selector */}
                <div className="flex items-center gap-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => navigateChapter("prev")}
                    disabled={selectedBook.abbr === ALL_BOOKS[0].abbr && selectedChapter === 1}
                    className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FaChevronLeft className="text-gray-700 dark:text-gray-300" />
                  </motion.button>

                  <div className="flex-1 flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                    {Array.from({ length: selectedBook.chapters }, (_, i) => i + 1).map((chapter) => (
                      <button
                        key={chapter}
                        onClick={() => setSelectedChapter(chapter)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          selectedChapter === chapter
                            ? "bg-purple-600 text-white"
                            : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                        }`}
                      >
                        {chapter}
                      </button>
                    ))}
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => navigateChapter("next")}
                    disabled={
                      selectedBook.abbr === ALL_BOOKS[ALL_BOOKS.length - 1].abbr &&
                      selectedChapter === selectedBook.chapters
                    }
                    className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FaChevronRight className="text-gray-700 dark:text-gray-300" />
                  </motion.button>
                </div>
              </div>

              {/* Chapter Content */}
              <div className="p-6">
                <AnimatePresence mode="wait">
                  {loading ? (
                    <motion.div
                      key="loading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-center py-12"
                    >
                      <div className="inline-block w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                      <p className="mt-4 text-gray-600 dark:text-gray-400">Loading chapter...</p>
                    </motion.div>
                  ) : chapterData ? (
                    <motion.div
                      key={`${selectedBook.abbr}-${selectedChapter}`}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="prose dark:prose-invert max-w-none"
                    >
                      <div className="space-y-4">
                        {chapterData.verses.map((verse) => (
                          <p
                            key={verse.verse}
                            className="text-gray-800 dark:text-gray-200 leading-relaxed"
                          >
                            <span className="text-purple-600 dark:text-purple-400 font-bold mr-2">
                              {verse.verse}
                            </span>
                            {verse.text}
                          </p>
                        ))}
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="error"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-center py-12"
                    >
                      <p className="text-gray-600 dark:text-gray-400">Failed to load chapter</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
