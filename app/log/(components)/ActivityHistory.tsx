"use client";
import { DateTime } from "luxon";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as HiIcons from "react-icons/hi";
import { FaTrash, FaEdit, FaSave, FaTimes, FaStop, FaCalendar, FaCheckSquare, FaSquare, FaClock } from "react-icons/fa";
import axios from "axios";
import { DayPicker } from "react-day-picker";
import DateTimePicker from "@/app/(common)/DateTimePicker";
import "react-day-picker/dist/style.css";

interface ActivityHistoryProps {
	data: LogType[];
	refetchAction: React.Dispatch<React.SetStateAction<boolean>>;
	activities: ActivityType[];
	onStopAction?: (logId: number) => void;
}

export default function ActivityHistory({
	data,
	refetchAction,
	activities,
	onStopAction,
}: ActivityHistoryProps) {
	const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
	const [hoveredLogId, setHoveredLogId] = useState<number | null>(null);
	const [editingId, setEditingId] = useState<number | null>(null);
	const [editForm, setEditForm] = useState<Partial<LogType>>({});
	const [selectedDate, setSelectedDate] = useState<string>(DateTime.now().toFormat("yyyy-MM-dd"));
	const [selectedLogs, setSelectedLogs] = useState<number[]>([]);
	const [bulkEditMode, setBulkEditMode] = useState(false);
	const [bulkEditForm, setBulkEditForm] = useState<{ comment?: string; tags?: string }>({});
	const [showCalendar, setShowCalendar] = useState(false);
	const calendarRef = useRef<HTMLDivElement>(null);

	// Close calendar when clicking outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
				setShowCalendar(false);
			}
		};

		if (showCalendar) {
			document.addEventListener('mousedown', handleClickOutside);
		}

		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	}, [showCalendar]);

	// Parse TODO info from comment
	const parseTodoInfo = (comment: string | null | undefined) => {
		if (!comment || !comment.startsWith("TODO-")) return null;
		const parts = comment.split("|");
		return {
			todoId: parts[0], // "TODO-123"
			title: parts[1] || "",
			description: parts[2] || "",
		};
	};

	// Parse tags from tags string
	const parseTags = (tags: string | null | undefined) => {
		if (!tags) return [];
		return tags
			.split(",")
			.map((tag) => tag.trim())
			.filter((tag) => tag.length > 0);
	};

	const handleDelete = async (id: number) => {
		const baseUrl = window.location.origin;
		try {
			await axios.delete(`${baseUrl}/api/log`, {
				data: { id },
			});
			setDeleteConfirmId(null);
			refetchAction((prev) => !prev);
		} catch (error) {
			console.error("Error deleting log:", error);
		}
	};

	const handleEdit = (log: LogType) => {
		setEditingId(log.id);
		setEditForm({
			...log,
			tags: log.tags || "",
			comment: log.comment || "",
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
			const selectedActivity = activities.find(
				(a) => a.title === editForm.activityTitle,
			);
			await axios.put(`${baseUrl}/api/log`, {
				id: editingId,
				comment: editForm.comment,
				activityTitle: editForm.activityTitle,
				activityCategory:
					selectedActivity?.category || editForm.activityCategory,
				activityIcon: selectedActivity?.icon || editForm.activityIcon,
				activityColor: selectedActivity?.color || editForm.activityColor,
				start_time: editForm.start_time,
				end_time: editForm.end_time,
				tags: editForm.tags,
			});
			setEditingId(null);
			setEditForm({});
			refetchAction((prev) => !prev);
		} catch (error) {
			console.error("Error updating log:", error);
		}
	};

	const handleBulkDelete = async () => {
		if (selectedLogs.length === 0) return;
		const baseUrl = window.location.origin;
		try {
			await Promise.all(
				selectedLogs.map((id) =>
					axios.delete(`${baseUrl}/api/log`, { data: { id } })
				)
			);
			setSelectedLogs([]);
			refetchAction((prev) => !prev);
		} catch (error) {
			console.error("Error bulk deleting logs:", error);
		}
	};

	const handleBulkEdit = async () => {
		if (selectedLogs.length === 0) return;
		const baseUrl = window.location.origin;
		try {
			await Promise.all(
				selectedLogs.map((id) =>
					axios.put(`${baseUrl}/api/log`, {
						id,
						comment: bulkEditForm.comment,
						tags: bulkEditForm.tags,
					})
				)
			);
			setSelectedLogs([]);
			setBulkEditMode(false);
			setBulkEditForm({});
			refetchAction((prev) => !prev);
		} catch (error) {
			console.error("Error bulk editing logs:", error);
		}
	};

	const toggleSelectLog = (id: number) => {
		setSelectedLogs((prev) =>
			prev.includes(id) ? prev.filter((logId) => logId !== id) : [...prev, id]
		);
	};

	const toggleSelectAll = () => {
		if (selectedLogs.length === filteredLogs.length) {
			setSelectedLogs([]);
		} else {
			setSelectedLogs(filteredLogs.map((log) => log.id));
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

	// Filter logs by selected date
	const filteredLogs = selectedDate
		? data.filter((log) => {
				if (!log.start_time) return false;
				const logDate = DateTime.fromJSDate(new Date(log.start_time)).toFormat("yyyy-MM-dd");
				return logDate === selectedDate;
		  })
		: data;

	const allLogs = filteredLogs;

	// Calculate total time for filtered logs
	const totalDuration = allLogs.reduce((total, log) => {
		if (!log.start_time || !log.end_time) return total;
		const start = DateTime.fromJSDate(new Date(log.start_time));
		const end = DateTime.fromJSDate(new Date(log.end_time));
		const diff = end.diff(start, ["hours"]).hours;
		return total + diff;
	}, 0);

	const formatTotalDuration = (hours: number) => {
		const h = Math.floor(hours);
		const m = Math.floor((hours - h) * 60);
		if (h > 0) {
			return `${h}h ${m}m`;
		}
		return `${m}m`;
	};

	const setQuickDate = (daysAgo: number) => {
		const date = DateTime.now().minus({ days: daysAgo }).toFormat("yyyy-MM-dd");
		setSelectedDate(date);
		setSelectedLogs([]);
	};

	const navigateDate = (direction: 'prev' | 'next') => {
		const currentDate = DateTime.fromISO(selectedDate);
		const newDate = direction === 'prev'
			? currentDate.minus({ days: 1 })
			: currentDate.plus({ days: 1 });
		setSelectedDate(newDate.toFormat("yyyy-MM-dd"));
		setSelectedLogs([]);
	};

	return (
		<>
			{/* Enhanced Date Filter and Bulk Actions */}
			<div className="mb-6 space-y-4">
				{/* Date Picker Section */}
				<div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
					<div className="flex flex-wrap gap-3 items-center">
						{/* Quick Filters */}
						<div className="flex items-center gap-2">
							<span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
								Quick:
							</span>
							<motion.button
								whileHover={{ scale: 1.05 }}
								whileTap={{ scale: 0.95 }}
								onClick={() => setQuickDate(0)}
								className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
									selectedDate === DateTime.now().toFormat("yyyy-MM-dd")
										? "bg-blue-600 text-white"
										: "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
								}`}
							>
								Today
							</motion.button>
							<motion.button
								whileHover={{ scale: 1.05 }}
								whileTap={{ scale: 0.95 }}
								onClick={() => setQuickDate(1)}
								className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
									selectedDate === DateTime.now().minus({ days: 1 }).toFormat("yyyy-MM-dd")
										? "bg-blue-600 text-white"
										: "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
								}`}
							>
								Yesterday
							</motion.button>
							<motion.button
								whileHover={{ scale: 1.05 }}
								whileTap={{ scale: 0.95 }}
								onClick={() => {
									setSelectedDate("");
									setSelectedLogs([]);
								}}
								className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
									selectedDate === ""
										? "bg-blue-600 text-white"
										: "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
								}`}
							>
								All Time
							</motion.button>
						</div>

						<div className="h-6 w-px bg-gray-300 dark:bg-gray-600"></div>

						{/* Date Navigation */}
						<div className="flex items-center gap-2">
							<motion.button
								whileHover={{ scale: 1.1 }}
								whileTap={{ scale: 0.9 }}
								onClick={() => navigateDate('prev')}
								disabled={!selectedDate}
								className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
								title="Previous day"
							>
								←
							</motion.button>

							{/* Custom Date Picker with DayPicker */}
							<div className="relative" ref={calendarRef}>
								<motion.button
									whileHover={{ scale: 1.02 }}
									whileTap={{ scale: 0.98 }}
									onClick={() => setShowCalendar(!showCalendar)}
									className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border-2 border-blue-200 dark:border-blue-700 hover:border-blue-300 dark:hover:border-blue-600 transition-colors cursor-pointer"
								>
									<FaCalendar className="text-blue-600 dark:text-blue-400" />
									<span className="text-sm font-semibold text-gray-900 dark:text-white">
										{selectedDate ? DateTime.fromISO(selectedDate).toFormat("MMM dd, yyyy") : "Select date"}
									</span>
									{selectedDate && (
										<span className="text-xs font-medium text-blue-600 dark:text-blue-400">
											{DateTime.fromISO(selectedDate).toFormat("cccc")}
										</span>
									)}
								</motion.button>

								{/* Calendar Popup */}
								<AnimatePresence>
									{showCalendar && (
										<motion.div
											initial={{ opacity: 0, y: -10, scale: 0.95 }}
											animate={{ opacity: 1, y: 0, scale: 1 }}
											exit={{ opacity: 0, y: -10, scale: 0.95 }}
											transition={{ duration: 0.2 }}
											className="absolute top-full mt-2 z-50 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4"
											style={{ minWidth: '320px' }}
										>
											<style jsx global>{`
												.rdp {
													--rdp-cell-size: 40px;
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
													padding: 0.5rem 0;
													font-weight: 600;
													font-size: 0.95rem;
												}
												.rdp-head_cell {
													font-weight: 600;
													font-size: 0.75rem;
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
													border-radius: 0.5rem;
													transition: all 0.2s;
												}
											`}</style>
											<DayPicker
												mode="single"
												selected={selectedDate ? new Date(selectedDate) : undefined}
												onSelect={(date) => {
													if (date) {
														const formatted = DateTime.fromJSDate(date).toFormat("yyyy-MM-dd");
														setSelectedDate(formatted);
														setSelectedLogs([]);
														setShowCalendar(false);
													}
												}}
												disabled={{ after: new Date() }}
												className="text-gray-900 dark:text-white"
											/>
										</motion.div>
									)}
								</AnimatePresence>
							</div>

							<motion.button
								whileHover={{ scale: 1.1 }}
								whileTap={{ scale: 0.9 }}
								onClick={() => navigateDate('next')}
								disabled={!selectedDate || selectedDate === DateTime.now().toFormat("yyyy-MM-dd")}
								className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
								title="Next day"
							>
								→
							</motion.button>
						</div>

						{/* Stats Summary */}
						{allLogs.length > 0 && (
							<>
								<div className="h-6 w-px bg-gray-300 dark:bg-gray-600"></div>

								<div className="flex flex-wrap gap-4">
									<div className="flex items-center gap-2">
										<div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
											<span className="text-sm font-bold text-blue-600 dark:text-blue-400">
												{allLogs.length}
											</span>
										</div>
										<span className="text-xs font-medium text-gray-700 dark:text-gray-300">
											{allLogs.length === 1 ? 'Entry' : 'Entries'}
										</span>
									</div>

									<div className="flex items-center gap-2">
										<div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center">
											<FaClock className="text-indigo-600 dark:text-indigo-400 text-sm" />
										</div>
										<span className="text-xs font-medium text-gray-700 dark:text-gray-300">
											{formatTotalDuration(totalDuration)}
										</span>
									</div>

									<div className="flex items-center gap-2">
										<div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
											<FaCheckSquare className="text-green-600 dark:text-green-400 text-sm" />
										</div>
										<span className="text-xs font-medium text-gray-700 dark:text-gray-300">
											{allLogs.filter(log => log.end_time).length}/{allLogs.length}
										</span>
									</div>
								</div>
							</>
						)}
					</div>
				</div>

				{/* Bulk Actions */}
				{selectedLogs.length > 0 && (
					<motion.div
						initial={{ opacity: 0, y: -10 }}
						animate={{ opacity: 1, y: 0 }}
						className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-lg p-4"
					>
						<div className="flex flex-wrap gap-3 items-center">
							<div className="flex items-center gap-2">
								<div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
									<FaCheckSquare className="text-white" size={16} />
								</div>
								<span className="text-sm font-bold text-white">
									{selectedLogs.length} item{selectedLogs.length > 1 ? 's' : ''} selected
								</span>
							</div>

							<div className="h-6 w-px bg-white/30"></div>

							{!bulkEditMode ? (
								<>
									<motion.button
										whileHover={{ scale: 1.05 }}
										whileTap={{ scale: 0.95 }}
										onClick={() => setBulkEditMode(true)}
										className="px-4 py-2 bg-white hover:bg-gray-100 text-blue-600 text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 shadow-md"
									>
										<FaEdit size={14} />
										Edit Selected
									</motion.button>
									<motion.button
										whileHover={{ scale: 1.05 }}
										whileTap={{ scale: 0.95 }}
										onClick={handleBulkDelete}
										className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 shadow-md"
									>
										<FaTrash size={14} />
										Delete Selected
									</motion.button>
									<motion.button
										whileHover={{ scale: 1.05 }}
										whileTap={{ scale: 0.95 }}
										onClick={() => setSelectedLogs([])}
										className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-lg transition-colors"
									>
										Clear Selection
									</motion.button>
								</>
							) : (
								<>
									<input
										type="text"
										placeholder="Description"
										value={bulkEditForm.comment || ""}
										onChange={(e) => setBulkEditForm({ ...bulkEditForm, comment: e.target.value })}
										className="flex-1 min-w-[200px] px-4 py-2 text-sm rounded-lg border-2 border-white/30 bg-white/10 text-white placeholder-white/60 focus:outline-none focus:border-white/50 backdrop-blur-sm"
									/>
									<input
										type="text"
										placeholder="Tags (comma-separated)"
										value={bulkEditForm.tags || ""}
										onChange={(e) => setBulkEditForm({ ...bulkEditForm, tags: e.target.value })}
										className="flex-1 min-w-[200px] px-4 py-2 text-sm rounded-lg border-2 border-white/30 bg-white/10 text-white placeholder-white/60 focus:outline-none focus:border-white/50 backdrop-blur-sm"
									/>
									<motion.button
										whileHover={{ scale: 1.05 }}
										whileTap={{ scale: 0.95 }}
										onClick={handleBulkEdit}
										className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 shadow-md"
									>
										<FaSave size={14} />
										Save
									</motion.button>
									<motion.button
										whileHover={{ scale: 1.05 }}
										whileTap={{ scale: 0.95 }}
										onClick={() => {
											setBulkEditMode(false);
											setBulkEditForm({});
										}}
										className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
									>
										<FaTimes size={14} />
										Cancel
									</motion.button>
								</>
							)}
						</div>
					</motion.div>
				)}
			</div>

			<div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
				{allLogs?.length === 0 ? (
					<div className="text-center py-16">
						<div className="text-6xl mb-4">📋</div>
						<h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
							{selectedDate ? "No logs for this date" : "No history yet"}
						</h3>
						<p className="text-gray-600 dark:text-gray-400">
							{selectedDate ? "Try selecting a different date" : "Your activities will appear here"}
						</p>
					</div>
				) : (
					<div className="overflow-x-auto">
						<table className="w-full">
							<thead>
								<tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
									<th className="px-4 py-4 text-left">
										<button
											onClick={toggleSelectAll}
											className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
										>
											{selectedLogs.length === allLogs.length && allLogs.length > 0 ? (
												<FaCheckSquare size={18} />
											) : (
												<FaSquare size={18} />
											)}
										</button>
									</th>
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
										const todoInfo = parseTodoInfo(log?.comment || "");
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
												onMouseEnter={() =>
													!isEditing && setHoveredLogId(log.id)
												}
												onMouseLeave={() => setHoveredLogId(null)}
												className={`${!isEditing && "hover:bg-gray-50 dark:hover:bg-gray-900/30"} transition-colors ${isEditing && "bg-blue-50 dark:bg-blue-900/10"}`}
											>
												{/* Checkbox */}
												<td className="px-4 py-4">
													<button
														onClick={() => toggleSelectLog(log.id)}
														className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
													>
														{selectedLogs.includes(log.id) ? (
															<FaCheckSquare size={18} />
														) : (
															<FaSquare size={18} />
														)}
													</button>
												</td>
												{/* Activity */}
												<td className="px-6 py-4">
													{isEditing ? (
														<select
															value={editForm.activityTitle || ""}
															onChange={(e) => {
																const selected = activities.find(
																	(a) => a.title === e.target.value,
																);
																setEditForm({
																	...editForm,
																	activityTitle: e.target.value,
																	activityCategory: selected?.category || "",
																	activityIcon: selected?.icon || "",
																	activityColor: selected?.color || "",
																});
															}}
															className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
														>
															{activities.map((activity) => (
																<option
																	key={activity.id}
																	value={activity.title}
																>
																	{activity.title}
																</option>
															))}
														</select>
													) : (
														<div className="flex items-center gap-3">
															<div
																className={`flex-shrink-0 w-10 h-10 ${log.activityColor?.startsWith("custom-") ? "" : `bg-gradient-to-br ${log.activityColor || "from-blue-500 to-purple-600"}`} rounded-lg flex items-center justify-center text-white`}
																style={
																	log.activityColor?.startsWith("custom-")
																		? {
																				backgroundColor:
																					log.activityColor.replace(
																						"custom-",
																						"",
																					),
																			}
																		: {}
																}
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
															value={editForm.comment || ""}
															onChange={(e) =>
																setEditForm({
																	...editForm,
																	comment: e.target.value,
																})
															}
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
																		<div
																			className={`overflow-hidden transition-all duration-200 ${
																				isHovered ? "max-h-20" : "max-h-0"
																			}`}
																		>
																			<p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
																				{todoInfo.description}
																			</p>
																		</div>
																	)}
																</>
															) : (
																<p className="text-sm text-gray-600 dark:text-gray-400 truncate">
																	{log.comment || (
																		<span className="italic text-gray-400">
																			No description
																		</span>
																	)}
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
															value={editForm.tags || ""}
															onChange={(e) =>
																setEditForm({
																	...editForm,
																	tags: e.target.value,
																})
															}
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
																<span className="text-sm text-gray-400 italic">
																	-
																</span>
															)}
														</div>
													)}
												</td>

												{/* Time (Start & End) */}
												<td className="px-6 py-4">
													{isEditing ? (
														<div className="space-y-2">
															<DateTimePicker
																value={editForm.start_time}
																onChangeAction={(date) =>
																	setEditForm({
																		...editForm,
																		start_time: date,
																	})
																}
																placeholder="Start time"
																disableFuture
															/>
															<DateTimePicker
																value={editForm.end_time}
																onChangeAction={(date) =>
																	setEditForm({
																		...editForm,
																		end_time: date,
																	})
																}
																placeholder="End time (optional)"
																disableFuture
															/>
														</div>
													) : (
														<div className="text-sm text-gray-900 dark:text-white font-mono space-y-1">
															<div className="flex items-center gap-2">
																<span className="text-xs text-gray-500 dark:text-gray-400">
																	Start:
																</span>
																<span>
																	{formatTime(
																		log.start_time?.toString() || null,
																	)}
																</span>
															</div>
															<div className="flex items-center gap-2">
																<span className="text-xs text-gray-500 dark:text-gray-400">
																	End:
																</span>
																<span>
																	{formatTime(log.end_time?.toString() || null)}
																</span>
															</div>
														</div>
													)}
												</td>

												{/* Duration */}
												<td className="px-6 py-4">
													{!isEditing && (
														<div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400">
															{calculateDuration(
																log.start_time?.toString() || null,
																log.end_time?.toString() || null,
															)}
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
																{!log.end_time && onStopAction && (
																	<motion.button
																		whileHover={{ scale: 1.1 }}
																		whileTap={{ scale: 0.9 }}
																		onClick={() => onStopAction(log.id)}
																		className="p-2 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors"
																		title="Stop activity"
																	>
																		<FaStop size={14} />
																	</motion.button>
																)}
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
									<FaTrash
										className="text-red-600 dark:text-red-400"
										size={20}
									/>
								</div>
								<div className="flex-1">
									<h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
										Delete Log?
									</h3>
									<p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
										Are you sure you want to delete this log entry? This action
										cannot be undone.
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
