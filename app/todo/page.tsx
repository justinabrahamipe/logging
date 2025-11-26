"use client";
import axios from "axios";
import { useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
	FaCalendarAlt,
	FaClock,
	FaCheckCircle,
	FaCircle,
	FaEdit,
	FaTrash,
	FaPlay,
	FaStop,
	FaUsers,
	FaMapMarkedAlt,
	FaExclamationTriangle,
} from "react-icons/fa";
import TodoForm from "./(components)/TodoForm";
import QuickAddTodo from "./(components)/QuickAddTodo";
import Snackbar from "../(components)/Snackbar";
import {
	getRelativeDate,
	getPriorityColor,
	isDateInRange,
} from "./(components)/utils";

// Loading skeleton component
const TodoSkeleton = () => (
	<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
		{[1, 2, 3, 4].map((i) => (
			<div
				key={i}
				className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 animate-pulse"
			>
				<div className="flex items-center gap-3">
					<div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded-full" />
					<div className="flex-1 space-y-2">
						<div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
					</div>
					<div className="w-6 h-6 bg-gray-200 dark:bg-gray-700 rounded-full" />
				</div>
			</div>
		))}
	</div>
);

// Delete confirmation dialog
const DeleteDialog = ({
	isOpen,
	todoTitle,
	onConfirm,
	onCancel,
}: {
	isOpen: boolean;
	todoTitle: string;
	onConfirm: () => void;
	onCancel: () => void;
}) => (
	<AnimatePresence>
		{isOpen && (
			<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					className="absolute inset-0 bg-black/50"
					onClick={onCancel}
				/>
				<motion.div
					initial={{ opacity: 0, scale: 0.9 }}
					animate={{ opacity: 1, scale: 1 }}
					exit={{ opacity: 0, scale: 0.9 }}
					className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-sm"
				>
					<div className="flex items-center gap-3 mb-4">
						<div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
							<FaExclamationTriangle className="text-red-600 dark:text-red-400" />
						</div>
						<h3 className="text-lg font-semibold text-gray-900 dark:text-white">
							Delete Todo
						</h3>
					</div>
					<p className="text-gray-600 dark:text-gray-400 mb-6">
						Are you sure you want to delete <strong>&quot;{todoTitle}&quot;</strong>? This action cannot be undone.
					</p>
					<div className="flex gap-3">
						<button
							onClick={onCancel}
							className="flex-1 px-4 py-2.5 rounded-lg font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
						>
							Cancel
						</button>
						<button
							onClick={onConfirm}
							className="flex-1 px-4 py-2.5 rounded-lg font-medium text-white bg-red-600 hover:bg-red-700 transition-colors"
						>
							Delete
						</button>
					</div>
				</motion.div>
			</div>
		)}
	</AnimatePresence>
);

export default function TodoPage() {
	const [data, setData] = useState<{ data: TodoType[] }>({ data: [] });
	const [activities, setActivities] = useState<{ data: ActivityType[] }>({
		data: [],
	});
	const [runningLogs, setRunningLogs] = useState<{ data: LogType[] }>({
		data: [],
	});
	const [rerun, refetchAction] = useState<boolean>(false);
	const [isLoading, setIsLoading] = useState(true);

	// Delete dialog state
	const [deleteDialog, setDeleteDialog] = useState<{
		isOpen: boolean;
		todoId: number | null;
		todoTitle: string;
	}>({ isOpen: false, todoId: null, todoTitle: "" });

	// Filter state - initialize with defaults, load from localStorage after mount
	const [filter, setFilter] = useState<"all" | "active" | "completed">("active");
	const [dateFilter, setDateFilter] = useState<
		"all" | "past" | "today" | "tomorrow" | "week" | "month"
	>("today");
	// Track saved preferences to compare against (avoids reading localStorage during render)
	const [savedPrefs, setSavedPrefs] = useState<{
		filter: string;
		dateFilter: string;
	}>({ filter: "active", dateFilter: "today" });

	// Load saved preferences from localStorage after mount (avoids hydration mismatch)
	useEffect(() => {
		const savedFilter = localStorage.getItem("todoFilterPreference") || "active";
		const savedDateFilter = localStorage.getItem("todoDateFilterPreference") || "today";
		setSavedPrefs({ filter: savedFilter, dateFilter: savedDateFilter });
		setFilter(savedFilter as "all" | "active" | "completed");
		setDateFilter(savedDateFilter as "all" | "past" | "today" | "tomorrow" | "week" | "month");
	}, []);

	const [editingId, setEditingId] = useState<number | null>(null);
	const [editFormData, setEditFormData] = useState<TodoType>({} as TodoType);
	const [snackbar, setSnackbar] = useState<{
		message: string;
		type: "success" | "error" | "info";
	} | null>(null);
	const [hoveredId, setHoveredId] = useState<number | null>(null);

	// Check if current filters differ from saved preferences
	const hasUnsavedChanges = useCallback(() => {
		return filter !== savedPrefs.filter || dateFilter !== savedPrefs.dateFilter;
	}, [filter, dateFilter, savedPrefs]);

	// Fetch all data in parallel on mount and when rerun changes
	useEffect(() => {
		const fetchAllData = async () => {
			setIsLoading(true);
			const baseUrl = window.location.origin;

			try {
				// Fetch all data in parallel for better performance
				const [todosRes, activitiesRes, logsRes] = await Promise.all([
					axios.get(`${baseUrl}/api/todo`),
					axios.get(`${baseUrl}/api/activity`),
					axios.get(`${baseUrl}/api/log`),
				]);

				setData(todosRes.data);
				setActivities(activitiesRes.data);

				// Filter running logs
				const filtered = logsRes.data.data.filter(
					(log: LogType) => !log.end_time,
				);
				setRunningLogs({ data: filtered });
			} catch (error) {
				console.error("Error fetching data:", error);
			} finally {
				setIsLoading(false);
			}
		};

		fetchAllData();
	}, [rerun]);

	const handleToggleDone = useCallback(
		async (todo: TodoType) => {
			const newStatus = !todo.done;

			// Optimistic update
			setData(prev => ({
				data: prev.data.map(t =>
					t.id === todo.id ? { ...t, done: newStatus } : t
				)
			}));

			// If marking as done and has an activity, create a log entry
			if (newStatus && todo.activityTitle) {
				const activity = activities.data.find(
					(a) => a.title === todo.activityTitle,
				);

				if (activity) {
					const now = new Date().toISOString();
					const newLog = {
						activityTitle: activity.title,
						activityCategory: activity.category,
						activityIcon: activity.icon,
						activityColor: activity.color || null,
						start_time: now,
						end_time: now,
						comment: `TODO-${todo.id}|${todo.title}${todo.description ? "|" + todo.description : ""}`,
					};

					const baseUrl = window.location.origin;
					try {
						await axios.post(`${baseUrl}/api/log`, newLog);
						setSnackbar({
							message: `"${todo.title}" completed and logged`,
							type: "success",
						});
					} catch (error) {
						console.error("Error creating log:", error);
						setSnackbar({
							message: `"${todo.title}" marked as completed but failed to log`,
							type: "error",
						});
					}
					setTimeout(() => setSnackbar(null), 3000);
				}
			} else {
				setSnackbar({
					message: `"${todo.title}" marked as ${newStatus ? "completed" : "incomplete"}`,
					type: "info",
				});
				setTimeout(() => setSnackbar(null), 3000);
			}

			const baseUrl = window.location.origin;
			try {
				// Only send necessary fields, exclude createdOn, todoContacts, todoPlaces
				const { createdOn, todoContacts, todoPlaces, ...updateData } = todo;
				await axios.put(`${baseUrl}/api/todo`, {
					...updateData,
					done: newStatus,
				});
			} catch (error) {
				console.error("Error updating todo:", error);
				// Revert on error
				setData(prev => ({
					data: prev.data.map(t =>
						t.id === todo.id ? { ...t, done: !newStatus } : t
					)
				}));
			}
		},
		[activities.data],
	);

	const handleEdit = useCallback((todo: TodoType) => {
		setEditingId(todo.id || null);
		setEditFormData(todo);
	}, []);

	const handleCancelEdit = useCallback(() => {
		setEditingId(null);
		setEditFormData({} as TodoType);
	}, []);

	const handleSaveEdit = useCallback(async (formData: TodoType) => {
		const baseUrl = window.location.origin;
		try {
			// Exclude createdOn, todoContacts, todoPlaces from PUT request
			const { createdOn, todoContacts, todoPlaces, ...updateData } = formData;
			await axios.put(`${baseUrl}/api/todo`, updateData);
			setEditingId(null);
			setEditFormData({} as TodoType);
			refetchAction((x) => !x);
			setSnackbar({
				message: `"${formData.title}" updated`,
				type: "success",
			});
			setTimeout(() => setSnackbar(null), 3000);
		} catch (error) {
			console.error("Error updating todo:", error);
			setSnackbar({ message: "Failed to update todo", type: "error" });
			setTimeout(() => setSnackbar(null), 3000);
		}
	}, []);

	const handleAddTodo = useCallback(async (formData: TodoType) => {
		if (!formData.title || formData.title.trim() === "") {
			setSnackbar({
				message: "Please enter a title for your todo",
				type: "error",
			});
			setTimeout(() => setSnackbar(null), 3000);
			return;
		}

		const baseUrl = window.location.origin;
		try {
			await axios.post(`${baseUrl}/api/todo`, formData);
			refetchAction((x) => !x);
			setSnackbar({
				message: `"${formData.title}" added`,
				type: "success",
			});
			setTimeout(() => setSnackbar(null), 3000);
		} catch (error: unknown) {
			console.error("Error adding todo:", error);
			const axiosError = error as { response?: { data?: { error?: string } }; message?: string };
			const errorMessage = axiosError.response?.data?.error || axiosError.message || "Failed to add todo";
			setSnackbar({ message: errorMessage, type: "error" });
			setTimeout(() => setSnackbar(null), 3000);
		}
	}, []);

	const openDeleteDialog = useCallback((todo: TodoType) => {
		setDeleteDialog({
			isOpen: true,
			todoId: todo.id!,
			todoTitle: todo.title,
		});
	}, []);

	const closeDeleteDialog = useCallback(() => {
		setDeleteDialog({ isOpen: false, todoId: null, todoTitle: "" });
	}, []);

	const confirmDelete = useCallback(async () => {
		if (!deleteDialog.todoId) return;

		const baseUrl = window.location.origin;
		try {
			await axios.delete(`${baseUrl}/api/todo`, {
				data: { id: deleteDialog.todoId },
			});
			refetchAction((prev) => !prev);
			setSnackbar({
				message: `"${deleteDialog.todoTitle}" deleted`,
				type: "success",
			});
			setTimeout(() => setSnackbar(null), 3000);
		} catch (error) {
			console.error("Error deleting todo:", error);
			setSnackbar({ message: "Failed to delete todo", type: "error" });
			setTimeout(() => setSnackbar(null), 3000);
		}
		closeDeleteDialog();
	}, [deleteDialog, closeDeleteDialog]);

	const handleStartActivity = useCallback(
		async (todo: TodoType) => {
			const activity = activities.data.find(
				(a) => a.title === todo.activityTitle,
			);
			if (!activity) {
				setSnackbar({ message: "Activity not found", type: "error" });
				setTimeout(() => setSnackbar(null), 3000);
				return;
			}

			const newLog = {
				activityTitle: activity.title,
				activityCategory: activity.category,
				activityIcon: activity.icon,
				activityColor: activity.color || null,
				start_time: new Date().toISOString(),
				end_time: null,
				comment: `TODO-${todo.id}|${todo.title}${todo.description ? "|" + todo.description : ""}`,
			};

			const baseUrl = window.location.origin;
			try {
				await axios.post(`${baseUrl}/api/log`, newLog);
				refetchAction((prev) => !prev);
				setSnackbar({
					message: `Started "${activity.title}"`,
					type: "info",
				});
				setTimeout(() => setSnackbar(null), 3000);
			} catch (error) {
				console.error("Error starting activity:", error);
				setSnackbar({ message: "Failed to start activity", type: "error" });
				setTimeout(() => setSnackbar(null), 3000);
			}
		},
		[activities.data],
	);

	const handleStopActivity = useCallback(
		async (logId: string, activityTitle: string) => {
			const baseUrl = window.location.origin;
			try {
				await axios.put(`${baseUrl}/api/log`, {
					id: logId,
					end_time: new Date().toISOString(),
				});
				refetchAction((prev) => !prev);
				setSnackbar({ message: `Stopped "${activityTitle}"`, type: "success" });
				setTimeout(() => setSnackbar(null), 3000);
			} catch (error) {
				console.error("Error stopping activity:", error);
				setSnackbar({ message: "Failed to stop activity", type: "error" });
				setTimeout(() => setSnackbar(null), 3000);
			}
		},
		[],
	);

	const handleSaveAsDefault = useCallback(() => {
		localStorage.setItem("todoFilterPreference", filter);
		localStorage.setItem("todoDateFilterPreference", dateFilter);
		setSavedPrefs({ filter, dateFilter });
		setSnackbar({ message: "Current view saved as default", type: "success" });
		setTimeout(() => setSnackbar(null), 3000);
	}, [filter, dateFilter]);

	// Memoize filtered data for performance
	const filteredData = useMemo(() => {
		return data?.data
			?.filter((todo) => {
				if (filter === "completed" && !todo.done) return false;
				if (filter === "active" && todo.done) return false;

				if (dateFilter !== "all") {
					const matchesWorkDate = isDateInRange(todo.work_date, dateFilter);
					const matchesDeadline = isDateInRange(todo.deadline, dateFilter);
					return matchesWorkDate || matchesDeadline;
				}

				return true;
			})
			.sort((a, b) => {
				const priorityA = (a.importance || 0) * (a.urgency || 0);
				const priorityB = (b.importance || 0) * (b.urgency || 0);
				return priorityB - priorityA;
			});
	}, [data?.data, filter, dateFilter]);

	// Memoize stats for performance
	const stats = useMemo(() => ({
		total: data?.data?.length || 0,
		completed: data?.data?.filter((t) => t.done).length || 0,
		active: data?.data?.filter((t) => !t.done).length || 0,
	}), [data?.data]);

	return (
		<div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900 p-4 sm:p-8">
			<div className="max-w-7xl mx-auto">
				{/* Header */}
				<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
					<div>
						<h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-2">
							Todo List
						</h1>
						<p className="text-gray-600 dark:text-gray-400">
							Manage your tasks and stay productive
						</p>
					</div>

					{/* Stats - inline with header */}
					<div className="flex items-center gap-3">
						<div className="flex items-center gap-2">
							<div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
								<span className="text-base font-bold text-gray-900 dark:text-white">
									{stats.total}
								</span>
							</div>
							<span className="text-sm font-medium text-gray-700 dark:text-gray-300">
								Total
							</span>
						</div>

						<div className="h-8 w-px bg-gray-300 dark:bg-gray-600"></div>

						<div className="flex items-center gap-2">
							<div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
								<span className="text-base font-bold text-blue-600 dark:text-blue-400">
									{stats.active}
								</span>
							</div>
							<span className="text-sm font-medium text-gray-700 dark:text-gray-300">
								Active
							</span>
						</div>

						<div className="h-8 w-px bg-gray-300 dark:bg-gray-600"></div>

						<div className="flex items-center gap-2">
							<div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
								<span className="text-base font-bold text-green-600 dark:text-green-400">
									{stats.completed}
								</span>
							</div>
							<span className="text-sm font-medium text-gray-700 dark:text-gray-300">
								Done
							</span>
						</div>
					</div>
				</div>

				{/* Filter Tabs */}
				<div className="mb-6">
					<div className="flex flex-wrap gap-2 items-center">
						{(
							["today", "tomorrow", "week", "month", "past", "all"] as const
						).map((df) => (
							<button
								key={df}
								onClick={() => setDateFilter(df)}
								className={`px-4 py-2 rounded-lg font-medium transition-colors capitalize text-sm ${
									dateFilter === df
										? "bg-purple-600 text-white"
										: "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
								}`}
							>
								{df === "week"
									? "This Week"
									: df === "month"
										? "This Month"
										: df}
							</button>
						))}
						<div className="w-px bg-gray-300 dark:bg-gray-600 h-8 mx-1"></div>
						{(["active", "completed", "all"] as const).map((f) => (
							<button
								key={f}
								onClick={() => setFilter(f)}
								className={`px-4 py-2 rounded-lg font-medium transition-colors capitalize text-sm ${
									filter === f
										? "bg-blue-600 text-white"
										: "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
								}`}
							>
								{f}
							</button>
						))}
						{hasUnsavedChanges() && (
							<>
								<div className="w-px bg-gray-300 dark:bg-gray-600 h-8 mx-1"></div>
								<button
									onClick={handleSaveAsDefault}
									className="px-4 py-2 rounded-lg font-medium text-sm bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700 transition-all shadow-sm"
									title="Save current filter view as default"
								>
									Save as Default
								</button>
							</>
						)}
					</div>
				</div>

				{/* Quick Add */}
				<div className="mb-6">
					<QuickAddTodo
						onAddAction={handleAddTodo}
						activities={activities.data}
					/>
				</div>

				{/* Todo Cards */}
				<div className="space-y-4">
					{isLoading ? (
						<TodoSkeleton />
					) : (
						<>
							<AnimatePresence mode="popLayout">
								{filteredData?.map((todo: TodoType) => {
									const isEditing = editingId === todo.id;

									if (isEditing) {
										return (
											<div key={todo.id} className="col-span-full">
												<TodoForm
													isEdit={true}
													initialData={editFormData}
													onSaveAction={handleSaveEdit}
													onCancelAction={handleCancelEdit}
													activities={activities.data}
												/>
											</div>
										);
									}

									return null;
								})}
							</AnimatePresence>

							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<AnimatePresence mode="popLayout">
									{filteredData?.map((todo: TodoType) => {
										const points = (todo.importance || 0) * (todo.urgency || 0);
										const isEditing = editingId === todo.id;

										if (isEditing) {
											return null;
										}

										const isHovered = hoveredId === todo.id;

										return (
											<motion.div
												key={todo.id}
												initial={{ opacity: 0, y: 10 }}
												animate={{ opacity: 1, y: 0 }}
												exit={{ opacity: 0, scale: 0.95 }}
												layout
												onMouseEnter={() => setHoveredId(todo.id || null)}
												onMouseLeave={() => setHoveredId(null)}
												className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-all overflow-hidden border border-gray-200 dark:border-gray-700 ${
													todo.done ? "opacity-60" : ""
												}`}
											>
												<div className="px-3 py-2">
													<div className="flex items-center gap-2">
														{/* Checkbox */}
														<button
															onClick={() => handleToggleDone(todo)}
															className="flex-shrink-0 touch-manipulation"
														>
															{todo.done ? (
																<FaCheckCircle className="text-base text-green-500" />
															) : (
																<FaCircle className="text-base text-gray-300 dark:text-gray-600" />
															)}
														</button>

														{/* Title with TODO number */}
														<div className="flex-1 min-w-0 flex items-center gap-2">
															<span className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-mono rounded flex-shrink-0">
																#{todo.id}
															</span>
															<h3
																className={`text-sm font-medium truncate ${
																	todo.done
																		? "line-through text-gray-500"
																		: "text-gray-900 dark:text-white"
																}`}
															>
																{todo.title}
															</h3>
														</div>

														{/* Dates */}
														{(todo.work_date || todo.deadline) && (
															<div className="flex items-center gap-2 flex-shrink-0">
																{todo.work_date && (
																	<div className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
																		<FaClock size={10} />
																		<span>{getRelativeDate(todo.work_date)}</span>
																	</div>
																)}
																{todo.deadline && (
																	<div className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
																		<FaCalendarAlt size={10} />
																		<span>{getRelativeDate(todo.deadline)}</span>
																	</div>
																)}
															</div>
														)}

														{/* Priority Badge */}
														<div
															className={`w-6 h-6 rounded-full text-white text-xs font-bold bg-gradient-to-r ${getPriorityColor(
																points,
															)} flex items-center justify-center flex-shrink-0`}
														>
															{points}
														</div>

														{/* Start/Stop Activity Button */}
														{todo.activityTitle &&
															(() => {
																const runningLog = runningLogs.data.find(
																	(log) =>
																		log.activityTitle === todo.activityTitle &&
																		log.comment === todo.title,
																);

																if (runningLog) {
																	return (
																		<button
																			onClick={() =>
																				handleStopActivity(
																					runningLog.id.toString(),
																					todo.activityTitle!,
																				)
																			}
																			className="p-1 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-all flex-shrink-0 touch-manipulation"
																			title={`Stop activity: ${todo.activityTitle}`}
																		>
																			<FaStop className="text-sm" />
																		</button>
																	);
																}

																return (
																	<button
																		onClick={() => handleStartActivity(todo)}
																		className="p-1 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 transition-all flex-shrink-0 touch-manipulation"
																		title={`Start activity: ${todo.activityTitle}`}
																	>
																		<FaPlay className="text-sm" />
																	</button>
																);
															})()}

														{/* Edit Button */}
														<button
															onClick={() => handleEdit(todo)}
															className="p-1 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all flex-shrink-0 touch-manipulation"
														>
															<FaEdit className="text-sm" />
														</button>

														{/* Delete Button */}
														<button
															onClick={() => openDeleteDialog(todo)}
															className="p-1 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-all flex-shrink-0 touch-manipulation"
														>
															<FaTrash className="text-sm" />
														</button>
													</div>

													{/* Description, Activity, and Tags - expands on hover */}
													{(todo.description || todo.activityTitle || (todo.todoContacts && todo.todoContacts.length > 0) || (todo.todoPlaces && todo.todoPlaces.length > 0)) && (
														<div
															className={`overflow-hidden transition-all duration-300 ease-in-out ${
																isHovered ? "max-h-32" : "max-h-0"
															}`}
														>
															<div className="mt-1.5 ml-7 pr-2 space-y-0.5">
																{todo.description && (
																	<p className="text-sm text-gray-500 dark:text-gray-400">
																		{todo.description}
																	</p>
																)}
																{todo.activityTitle && (
																	<p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
																		<span className="font-medium">Activity:</span>
																		<span>{todo.activityTitle}</span>
																		{todo.activityCategory && (
																			<span className="text-gray-400 dark:text-gray-600">
																				({todo.activityCategory})
																			</span>
																		)}
																	</p>
																)}

																{/* People and Places Tags */}
																{((todo.todoContacts && todo.todoContacts.length > 0) || (todo.todoPlaces && todo.todoPlaces.length > 0)) && (
																	<div className="flex flex-wrap gap-2 pt-0.5">
																		{todo.todoContacts && todo.todoContacts.length > 0 && (
																			<div className="flex items-center gap-1 flex-wrap">
																				<FaUsers className="text-blue-600 dark:text-blue-400" size={10} />
																				{todo.todoContacts.map((tc: any) => (
																					<span
																						key={tc.id}
																						className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs rounded-full"
																					>
																						{tc.contact.name}
																					</span>
																				))}
																			</div>
																		)}

																		{todo.todoPlaces && todo.todoPlaces.length > 0 && (
																			<div className="flex items-center gap-1 flex-wrap">
																				<FaMapMarkedAlt className="text-green-600 dark:text-green-400" size={10} />
																				{todo.todoPlaces.map((tp: any) => (
																					<span
																						key={tp.id}
																						className="px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs rounded-full"
																						title={tp.place.address}
																					>
																						{tp.place.name}
																					</span>
																				))}
																			</div>
																		)}
																	</div>
																)}
															</div>
														</div>
													)}
												</div>
											</motion.div>
										);
									})}
								</AnimatePresence>
							</div>

							{filteredData?.length === 0 && (
								<div className="text-center py-16">
									<div className="text-6xl mb-4">📝</div>
									<h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
										No todos found
									</h3>
									<p className="text-gray-600 dark:text-gray-400">
										{filter === "all"
											? "Add your first todo to get started!"
											: `No ${filter} todos yet.`}
									</p>
								</div>
							)}
						</>
					)}
				</div>
			</div>

			<Snackbar
				message={snackbar?.message || ""}
				type={snackbar?.type || "info"}
				isOpen={!!snackbar}
				onCloseAction={() => setSnackbar(null)}
			/>

			<DeleteDialog
				isOpen={deleteDialog.isOpen}
				todoTitle={deleteDialog.todoTitle}
				onConfirm={confirmDelete}
				onCancel={closeDeleteDialog}
			/>
		</div>
	);
}
