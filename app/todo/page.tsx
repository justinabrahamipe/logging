"use client";
import axios from "axios";
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
	FaPlus,
	FaCalendarAlt,
	FaClock,
	FaCheckCircle,
	FaCircle,
	FaEdit,
	FaTrash,
	FaPlay,
	FaStop,
} from "react-icons/fa";
import TodoForm from "./(components)/TodoForm";
import Snackbar from "../(components)/Snackbar";
import {
	getRelativeDate,
	getPriorityColor,
	isDateInRange,
} from "./(components)/utils";

export default function TodoPage() {
	const [data, setData] = useState<{ data: TodoType[] }>({ data: [] });
	const [activities, setActivities] = useState<{ data: ActivityType[] }>({
		data: [],
	});
	const [runningLogs, setRunningLogs] = useState<{ data: LogType[] }>({
		data: [],
	});
	const [rerun, refetchAction] = useState<boolean>(false);

	// Load saved preferences or use defaults
	const [filter, setFilter] = useState<"all" | "active" | "completed">(() => {
		if (typeof window !== "undefined") {
			const saved = localStorage.getItem("todoFilterPreference");
			return (saved as "all" | "active" | "completed") || "active";
		}
		return "active";
	});

	const [dateFilter, setDateFilter] = useState<
		"all" | "past" | "today" | "tomorrow" | "week" | "month"
	>(() => {
		if (typeof window !== "undefined") {
			const saved = localStorage.getItem("todoDateFilterPreference");
			return (
				(saved as "all" | "past" | "today" | "tomorrow" | "week" | "month") ||
				"today"
			);
		}
		return "today";
	});

	const [editingId, setEditingId] = useState<number | null>(null);
	const [showAddForm, setShowAddForm] = useState(false);
	const [editFormData, setEditFormData] = useState<TodoType>({} as TodoType);
	const [snackbar, setSnackbar] = useState<{
		message: string;
		type: "success" | "error" | "info";
	} | null>(null);
	const [hoveredId, setHoveredId] = useState<number | null>(null);

	// Check if current filters differ from saved preferences
	const hasUnsavedChanges = () => {
		if (typeof window === "undefined") return false;
		const savedFilter =
			localStorage.getItem("todoFilterPreference") || "active";
		const savedDateFilter =
			localStorage.getItem("todoDateFilterPreference") || "today";
		return filter !== savedFilter || dateFilter !== savedDateFilter;
	};

	useEffect(() => {
		// Fetch activities
		const fetchActivities = async () => {
			const baseUrl = window.location.origin;
			try {
				const response = await axios.get(`${baseUrl}/api/activity`);
				setActivities(response.data);
			} catch (error) {
				console.error("Error fetching activities:", error);
			}
		};
		fetchActivities();
	}, []);

	useEffect(() => {
		// Fetch running logs
		const fetchRunningLogs = async () => {
			const baseUrl = window.location.origin;
			try {
				const response = await axios.get(`${baseUrl}/api/log`);
				const filtered = response.data.data.filter(
					(log: LogType) => !log.end_time,
				);
				setRunningLogs({ data: filtered });
			} catch (error) {
				console.error("Error fetching logs:", error);
			}
		};
		fetchRunningLogs();
	}, [rerun]);

	useEffect(() => {
		const fetchData = async () => {
			const baseUrl = window.location.origin;
			try {
				const response = await axios.get(`${baseUrl}/api/todo`);
				setData(response.data);
			} catch (error) {
				console.error("Error fetching todos:", error);
			}
		};
		fetchData();
	}, [rerun]);

	const handleToggleDone = useCallback(
		async (todo: TodoType) => {
			const newStatus = !todo.done;

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
				await axios.put(`${baseUrl}/api/todo`, {
					...todo,
					done: newStatus,
				});
				refetchAction((x) => !x);
			} catch (error) {
				console.error("Error updating todo:", error);
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
			await axios.put(`${baseUrl}/api/todo`, formData);
			setEditingId(null);
			setEditFormData({} as TodoType);
			refetchAction((x) => !x);
			setSnackbar({
				message: `"${formData.title}" updated successfully`,
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
			const response = await axios.post(`${baseUrl}/api/todo`, formData);
			console.log("Todo added successfully:", response.data);
			setShowAddForm(false);
			setEditFormData({} as TodoType);
			refetchAction((x) => !x);
			setSnackbar({
				message: `"${formData.title}" added successfully`,
				type: "success",
			});
			setTimeout(() => setSnackbar(null), 3000);
		} catch (error: unknown) {
			console.error("Full error object:", error);
			const errorMessage =
				(error as { response?: { data?: { error?: string } }; message?: string }).response?.data?.error ||
				(error as { message?: string }).message ||
				"Failed to add todo";
			setSnackbar({ message: errorMessage, type: "error" });
			setTimeout(() => setSnackbar(null), 3000);
		}
	}, []);

	const handleCancelAdd = useCallback(() => {
		setShowAddForm(false);
		setEditFormData({} as TodoType);
	}, []);

	const handleDelete = useCallback(
		async (id: number) => {
			const todo = data.data.find((t) => t.id === id);
			if (confirm("Are you sure you want to delete this todo?")) {
				const baseUrl = window.location.origin;
				try {
					await axios.delete(`${baseUrl}/api/todo`, {
						data: { id: id },
					});
					refetchAction((prev) => !prev);
					setSnackbar({
						message: `"${todo?.title}" deleted successfully`,
						type: "success",
					});
					setTimeout(() => setSnackbar(null), 3000);
				} catch (error) {
					console.error("Error deleting todo:", error);
					setSnackbar({ message: "Failed to delete todo", type: "error" });
					setTimeout(() => setSnackbar(null), 3000);
				}
			}
		},
		[data.data],
	);

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
					message: `Started activity "${activity.title}" for "${todo.title}"`,
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
		setSnackbar({ message: "Current view saved as default", type: "success" });
		setTimeout(() => setSnackbar(null), 3000);
	}, [filter, dateFilter]);

	const filteredData = data?.data
		?.filter((todo) => {
			// Filter by status
			if (filter === "completed" && !todo.done) return false;
			if (filter === "active" && todo.done) return false;

			// Filter by date
			if (dateFilter !== "all") {
				// Check both work_date and deadline
				const matchesWorkDate = isDateInRange(todo.work_date, dateFilter);
				const matchesDeadline = isDateInRange(todo.deadline, dateFilter);
				return matchesWorkDate || matchesDeadline;
			}

			return true;
		})
		.sort((a, b) => {
			// Sort by priority (highest first)
			const priorityA = (a.importance || 0) * (a.urgency || 0);
			const priorityB = (b.importance || 0) * (b.urgency || 0);
			return priorityB - priorityA;
		});

	const stats = {
		total: data?.data?.length || 0,
		completed: data?.data?.filter((t) => t.done).length || 0,
		active: data?.data?.filter((t) => !t.done).length || 0,
	};

	return (
		<div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900 p-4 sm:p-8">
			<div className="max-w-7xl mx-auto">
				{/* Header */}
				<motion.div
					initial={{ opacity: 0, y: -20 }}
					animate={{ opacity: 1, y: 0 }}
					className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8"
				>
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
				</motion.div>

				{/* Filter Tabs */}
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ delay: 0.2 }}
					className="mb-6"
				>
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
								<motion.button
									initial={{ opacity: 0, scale: 0.9 }}
									animate={{ opacity: 1, scale: 1 }}
									exit={{ opacity: 0, scale: 0.9 }}
									whileHover={{ scale: 1.02 }}
									whileTap={{ scale: 0.98 }}
									onClick={handleSaveAsDefault}
									className="px-4 py-2 rounded-lg font-medium text-sm bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700 transition-all shadow-sm"
									title="Save current filter view as default"
								>
									Save as Default
								</motion.button>
							</>
						)}
					</div>
				</motion.div>

				{/* Todo Cards */}
				<div className="space-y-4">
					<AnimatePresence mode="popLayout">
						{filteredData?.map((todo: TodoType) => {
							const isEditing = editingId === todo.id;

							if (isEditing) {
								return (
									<div key={todo.id} className="col-span-full">
										<TodoForm
											isEdit={true}
											initialData={editFormData}
											onSave={handleSaveEdit}
											onCancel={handleCancelEdit}
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
							{filteredData?.map((todo: TodoType, index: number) => {
								const points = (todo.importance || 0) * (todo.urgency || 0);
								const isEditing = editingId === todo.id;

								if (isEditing) {
									return null;
								}

								const isHovered = hoveredId === todo.id;

								return (
									<motion.div
										key={todo.id}
										initial={{ opacity: 0, y: 20 }}
										animate={{ opacity: 1, y: 0 }}
										exit={{ opacity: 0, x: -100 }}
										transition={{ delay: index * 0.05 }}
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
												<motion.button
													whileHover={{ scale: 1.1 }}
													whileTap={{ scale: 0.9 }}
													onClick={() => handleToggleDone(todo)}
													className="flex-shrink-0"
												>
													{todo.done ? (
														<FaCheckCircle className="text-base text-green-500" />
													) : (
														<FaCircle className="text-base text-gray-300 dark:text-gray-600" />
													)}
												</motion.button>

												{/* Title with TODO number */}
												<div className="flex-1 min-w-0 flex items-center gap-2">
													<span className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-mono rounded flex-shrink-0">
														#{todo.id}
													</span>
													<h3
														className={`text-sm font-medium ${
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

												{/* Start/Stop Activity Button - visible if activity is tagged */}
												{todo.activityTitle &&
													(() => {
														const runningLog = runningLogs.data.find(
															(log) =>
																log.activityTitle === todo.activityTitle &&
																log.comment === todo.title,
														);

														if (runningLog) {
															return (
																<motion.button
																	whileHover={{ scale: 1.1 }}
																	whileTap={{ scale: 0.9 }}
																	onClick={() =>
																		handleStopActivity(
																			runningLog.id.toString(),
																			todo.activityTitle!,
																		)
																	}
																	className="p-1 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-all flex-shrink-0"
																	title={`Stop activity: ${todo.activityTitle}`}
																>
																	<FaStop className="text-sm" />
																</motion.button>
															);
														}

														return (
															<motion.button
																whileHover={{ scale: 1.1 }}
																whileTap={{ scale: 0.9 }}
																onClick={() => handleStartActivity(todo)}
																className="p-1 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 transition-all flex-shrink-0"
																title={`Start activity: ${todo.activityTitle}`}
															>
																<FaPlay className="text-sm" />
															</motion.button>
														);
													})()}

												{/* Edit Button - always visible */}
												<motion.button
													whileHover={{ scale: 1.1 }}
													whileTap={{ scale: 0.9 }}
													onClick={() => handleEdit(todo)}
													className="p-1 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all flex-shrink-0"
												>
													<FaEdit className="text-sm" />
												</motion.button>

												{/* Delete Button - always visible */}
												<motion.button
													whileHover={{ scale: 1.1 }}
													whileTap={{ scale: 0.9 }}
													onClick={() => handleDelete(todo.id!)}
													className="p-1 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-all flex-shrink-0"
												>
													<FaTrash className="text-sm" />
												</motion.button>
											</div>

											{/* Description and Activity - expands on hover */}
											{(todo.description || todo.activityTitle) && (
												<div
													className={`overflow-hidden transition-all duration-300 ease-in-out ${
														isHovered ? "max-h-20" : "max-h-0"
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
													</div>
												</div>
											)}
										</div>
									</motion.div>
								);
							})}
						</AnimatePresence>
					</div>

					{/* Add Form - full width */}
					<AnimatePresence>
						{showAddForm && (
							<motion.div
								initial={{ opacity: 0, scale: 0.9 }}
								animate={{ opacity: 1, scale: 1 }}
								exit={{ opacity: 0, scale: 0.9 }}
							>
								<TodoForm
									isEdit={false}
									initialData={
										{ title: "", urgency: 1, importance: 1 } as TodoType
									}
									onSave={handleAddTodo}
									onCancel={handleCancelAdd}
									activities={activities.data}
								/>
							</motion.div>
						)}
					</AnimatePresence>

					{filteredData?.length === 0 && !showAddForm && (
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							className="text-center py-16"
						>
							<div className="text-6xl mb-4">📝</div>
							<h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
								No todos found
							</h3>
							<p className="text-gray-600 dark:text-gray-400">
								{filter === "all"
									? "Add your first todo to get started!"
									: `No ${filter} todos yet.`}
							</p>
						</motion.div>
					)}
				</div>
			</div>

			<Snackbar
				message={snackbar?.message || ""}
				type={snackbar?.type || "info"}
				isOpen={!!snackbar}
				onCloseAction={() => setSnackbar(null)}
			/>

			{/* Floating Add Button */}
			{!showAddForm && !editingId && (
				<motion.button
					initial={{ opacity: 0, scale: 0 }}
					animate={{ opacity: 1, scale: 1 }}
					exit={{ opacity: 0, scale: 0 }}
					whileHover={{ scale: 1.1 }}
					whileTap={{ scale: 0.9 }}
					onClick={() => {
						setShowAddForm(true);
						setEditFormData({
							title: "",
							urgency: 1,
							importance: 1,
						} as TodoType);
					}}
					className="fixed bottom-8 right-8 w-14 h-14 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full shadow-lg hover:shadow-xl flex items-center justify-center text-white z-40"
				>
					<FaPlus size={20} />
				</motion.button>
			)}
		</div>
	);
}
