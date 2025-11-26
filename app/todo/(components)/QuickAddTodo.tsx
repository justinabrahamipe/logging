"use client";
import { useState, memo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
	FaPlus,
	FaChevronDown,
	FaTimes,
	FaCalendarAlt,
	FaClock,
	FaBullseye,
	FaSync,
	FaUsers,
	FaMapMarkerAlt,
} from "react-icons/fa";
import DatePicker from "@/app/(common)/DatePicker";
import { Autocomplete, TextField, Chip } from "@mui/material";
import axios from "axios";

interface Contact {
	id: number;
	name: string;
	photoUrl?: string;
}
interface Place {
	id: number;
	name: string;
	address: string;
}
interface Goal {
	id: number;
	title: string;
	color?: string;
	icon?: string;
}

interface QuickAddTodoProps {
	onAddAction: (data: TodoType) => void;
	activities: ActivityType[];
}

const QuickAddTodo = memo(({ onAddAction, activities }: QuickAddTodoProps) => {
	const [title, setTitle] = useState("");
	const [isExpanded, setIsExpanded] = useState(false);
	const [stickyForm, setStickyForm] = useState<Partial<TodoType>>({
		urgency: 1,
		importance: 1,
	});
	const [allContacts, setAllContacts] = useState<Contact[]>([]);
	const [allPlaces, setAllPlaces] = useState<Place[]>([]);
	const [allGoals, setAllGoals] = useState<Goal[]>([]);
	const [selectedContacts, setSelectedContacts] = useState<Contact[]>([]);
	const [selectedPlaces, setSelectedPlaces] = useState<Place[]>([]);
	const [selectedGoals, setSelectedGoals] = useState<Goal[]>([]);
	const inputRef = useRef<HTMLInputElement>(null);
	const [isDark, setIsDark] = useState(false);

	// Track dark mode
	useEffect(() => {
		const checkDark = () =>
			setIsDark(document.documentElement.classList.contains("dark"));
		checkDark();
		const observer = new MutationObserver(checkDark);
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class"],
		});
		return () => observer.disconnect();
	}, []);

	// Recurring state
	const [isRecurring, setIsRecurring] = useState(false);
	const [recurrencePattern, setRecurrencePattern] = useState<
		"daily" | "weekly" | "monthly" | "yearly" | "custom"
	>("weekly");
	const [recurrenceInterval, setRecurrenceInterval] = useState(1);
	const [customUnit, setCustomUnit] = useState<
		"days" | "weeks" | "months" | "years"
	>("weeks");
	const [weeklyDays, setWeeklyDays] = useState<number[]>([]);
	const [recurrenceEndType, setRecurrenceEndType] = useState<
		"count" | "date" | "never"
	>("count");
	const [recurrenceCount, setRecurrenceCount] = useState(4);
	const [recurrenceEndDate, setRecurrenceEndDate] = useState("");
	const [workDateOffset, setWorkDateOffset] = useState(0);

	useEffect(() => {
		if (!isExpanded) return;
		const fetchData = async () => {
			const baseUrl = window.location.origin;
			try {
				const [contactsRes, placesRes, goalsRes] = await Promise.all([
					axios.get(`${baseUrl}/api/contacts?limit=1000`),
					axios.get(`${baseUrl}/api/places?limit=1000`),
					axios.get(`${baseUrl}/api/goal`),
				]);
				setAllContacts(contactsRes.data.data || []);
				setAllPlaces(placesRes.data.data || []);
				setAllGoals(goalsRes.data.data || []);
			} catch (error) {
				console.error("Error fetching data:", error);
			}
		};
		fetchData();
	}, [isExpanded]);

	const handleQuickAdd = () => {
		if (!title.trim()) return;
		const dataToSubmit = {
			title: title.trim(),
			urgency: stickyForm.urgency || 1,
			importance: stickyForm.importance || 1,
			description: stickyForm.description,
			work_date: stickyForm.work_date,
			deadline: stickyForm.deadline,
			activityTitle: stickyForm.activityTitle,
			activityCategory: stickyForm.activityCategory,
			contactIds: selectedContacts.map((c) => c.id),
			placeIds: selectedPlaces.map((p) => p.id),
			goalIds: selectedGoals.map((g) => g.id),
		} as TodoType;

		if (isRecurring && stickyForm.deadline) {
			(dataToSubmit as any).isRecurring = true;
			(dataToSubmit as any).recurrencePattern =
				recurrencePattern === "custom" ? customUnit : recurrencePattern;
			(dataToSubmit as any).recurrenceInterval = recurrenceInterval;
			(dataToSubmit as any).workDateOffset = workDateOffset;
			if (recurrencePattern === "weekly" && weeklyDays.length > 0) {
				(dataToSubmit as any).weeklyDays = weeklyDays;
			}
			if (recurrenceEndType === "count")
				(dataToSubmit as any).recurrenceCount = recurrenceCount;
			else if (recurrenceEndType === "date")
				(dataToSubmit as any).recurrenceEndDate = recurrenceEndDate;
			else if (recurrenceEndType === "never")
				(dataToSubmit as any).recurrenceCount = 365;
		}
		onAddAction(dataToSubmit);
		setTitle("");
		inputRef.current?.focus();
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleQuickAdd();
		}
	};

	const clearField = (field: keyof TodoType) => {
		setStickyForm((prev) => {
			const u = { ...prev };
			delete u[field];
			return u;
		});
	};

	const clearActivity = () => {
		setStickyForm((prev) => {
			const u = { ...prev };
			delete u.activityTitle;
			delete u.activityCategory;
			return u;
		});
	};

	const priority = (stickyForm.urgency || 1) * (stickyForm.importance || 1);
	const hasStickyValues =
		stickyForm.work_date ||
		stickyForm.deadline ||
		stickyForm.activityTitle ||
		stickyForm.description ||
		(stickyForm.urgency && stickyForm.urgency > 1) ||
		(stickyForm.importance && stickyForm.importance > 1) ||
		selectedContacts.length > 0 ||
		selectedPlaces.length > 0 ||
		selectedGoals.length > 0 ||
		isRecurring;

	const formatDate = (d: string) => {
		const date = new Date(d),
			today = new Date(),
			tmrw = new Date(today);
		tmrw.setDate(tmrw.getDate() + 1);
		if (date.toDateString() === today.toDateString()) return "Today";
		if (date.toDateString() === tmrw.toDateString()) return "Tomorrow";
		return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
	};

	const inputStyles = {
		"& .MuiOutlinedInput-root": {
			fontSize: "0.8rem",
			backgroundColor: isDark ? "rgb(55 65 81)" : "rgb(249 250 251)",
			color: isDark ? "rgb(255 255 255)" : "rgb(17 24 39)",
			"& fieldset": {
				borderColor: isDark ? "rgb(75 85 99)" : "rgb(229 231 235)",
			},
			"&:hover fieldset": {
				borderColor: isDark ? "rgb(107 114 128)" : "rgb(209 213 219)",
			},
		},
		"& .MuiInputBase-input": {
			padding: "6px 8px",
			color: isDark ? "rgb(255 255 255)" : "rgb(17 24 39)",
			"&::placeholder": {
				color: isDark ? "rgb(156 163 175)" : "rgb(156 163 175)",
			},
		},
		"& .MuiChip-root": {
			backgroundColor: isDark ? "rgb(75 85 99)" : "rgb(229 231 235)",
			color: isDark ? "rgb(255 255 255)" : "rgb(17 24 39)",
		},
		"& .MuiSvgIcon-root": {
			color: isDark ? "rgb(156 163 175)" : "rgb(107 114 128)",
		},
	};

	return (
		<div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
			{/* Main Input */}
			<div className="flex items-center gap-2 p-2">
				<button
					onClick={handleQuickAdd}
					disabled={!title.trim()}
					className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all ${
						title.trim()
							? "bg-blue-500 text-white shadow-md shadow-blue-500/30"
							: "bg-gray-100 dark:bg-gray-700 text-gray-400"
					}`}
				>
					<FaPlus size={14} />
				</button>
				<input
					ref={inputRef}
					type="text"
					value={title}
					onChange={(e) => setTitle(e.target.value)}
					onKeyDown={handleKeyDown}
					placeholder="What needs to be done?"
					className="flex-1 py-2 px-1 text-sm bg-transparent border-none outline-none text-gray-900 dark:text-white placeholder-gray-400"
				/>
				{priority > 1 && (
					<span
						className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center text-white ${
							priority >= 7
								? "bg-red-500"
								: priority >= 4
									? "bg-amber-500"
									: "bg-green-500"
						}`}
					>
						{priority}
					</span>
				)}
				<button
					onClick={() => setIsExpanded(!isExpanded)}
					className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
						hasStickyValues
							? "bg-blue-50 dark:bg-blue-900/30 text-blue-500"
							: "text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
					}`}
				>
					<motion.div
						animate={{ rotate: isExpanded ? 180 : 0 }}
						transition={{ duration: 0.2 }}
					>
						<FaChevronDown size={12} />
					</motion.div>
				</button>
			</div>

			{/* Quick Tags */}
			{!isExpanded && hasStickyValues && (
				<div className="px-3 pb-2 flex flex-wrap gap-1.5">
					{stickyForm.deadline && (
						<span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 text-xs rounded-lg">
							<FaCalendarAlt size={8} />
							{formatDate(stickyForm.deadline)}
							<button
								onClick={() => clearField("deadline")}
								className="ml-0.5 opacity-60 hover:opacity-100"
							>
								<FaTimes size={8} />
							</button>
						</span>
					)}
					{stickyForm.work_date && (
						<span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs rounded-lg">
							<FaClock size={8} />
							{formatDate(stickyForm.work_date)}
							<button
								onClick={() => clearField("work_date")}
								className="ml-0.5 opacity-60 hover:opacity-100"
							>
								<FaTimes size={8} />
							</button>
						</span>
					)}
					{stickyForm.activityTitle && (
						<span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 text-xs rounded-lg">
							{stickyForm.activityTitle}
							<button
								onClick={clearActivity}
								className="ml-0.5 opacity-60 hover:opacity-100"
							>
								<FaTimes size={8} />
							</button>
						</span>
					)}
					{selectedContacts.length > 0 && (
						<span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-xs rounded-lg">
							<FaUsers size={8} />
							{selectedContacts.length}
						</span>
					)}
					{selectedPlaces.length > 0 && (
						<span className="inline-flex items-center gap-1 px-2 py-0.5 bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 text-xs rounded-lg">
							<FaMapMarkerAlt size={8} />
							{selectedPlaces.length}
						</span>
					)}
					{selectedGoals.length > 0 && (
						<span className="inline-flex items-center gap-1 px-2 py-0.5 bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 text-xs rounded-lg">
							<FaBullseye size={8} />
							{selectedGoals.length}
						</span>
					)}
					{isRecurring && (
						<span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 text-xs rounded-lg">
							<FaSync size={8} />
							Repeat
						</span>
					)}
				</div>
			)}

			{/* Expanded Panel */}
			<AnimatePresence>
				{isExpanded && (
					<motion.div
						initial={{ height: 0, opacity: 0 }}
						animate={{ height: "auto", opacity: 1 }}
						exit={{ height: 0, opacity: 0 }}
						transition={{ duration: 0.15 }}
						className="overflow-hidden border-t border-gray-100 dark:border-gray-700"
					>
						<div className="p-2 space-y-2 bg-gray-50/50 dark:bg-gray-800/50">
							{/* Row 1: Description */}
							<textarea
								value={stickyForm.description || ""}
								onChange={(e) => {
									setStickyForm({ ...stickyForm, description: e.target.value });
									e.target.style.height = "auto";
									e.target.style.height = e.target.scrollHeight + "px";
								}}
								className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
								placeholder="Add notes..."
								rows={1}
							/>

							{/* Row 2: Activity + Dates */}
							<div className="flex gap-2">
								<select
									value={stickyForm.activityTitle || ""}
									onChange={(e) => {
										const act = activities.find(
											(a) => a.title === e.target.value,
										);
										setStickyForm({
											...stickyForm,
											activityTitle: e.target.value || undefined,
											activityCategory: act?.category,
										});
									}}
									className="flex-1 px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
								>
									<option value="">Activity</option>
									{activities.map((a) => (
										<option key={a.id} value={a.title}>
											{a.title}
										</option>
									))}
								</select>
								<div className="flex-1">
									<DatePicker
										value={stickyForm.work_date || ""}
										onChangeAction={(v) =>
											setStickyForm({ ...stickyForm, work_date: v })
										}
										placeholder="Work"
										className="text-sm"
									/>
								</div>
								<div className="flex-1">
									<DatePicker
										value={stickyForm.deadline || ""}
										onChangeAction={(v) =>
											setStickyForm({ ...stickyForm, deadline: v })
										}
										placeholder="Due"
										className="text-sm"
									/>
								</div>
							</div>

							{/* Row 3: Priority + Repeat */}
							<div className="flex gap-4">
								<div className="w-1/3">
									<span className="block text-[10px] text-gray-500 dark:text-gray-400 mb-1">
										Urgency
									</span>
									<div className="flex gap-1">
										{[
											{ v: 1, l: "Low" },
											{ v: 2, l: "Med" },
											{ v: 3, l: "High" },
										].map(({ v, l }) => (
											<button
												key={v}
												onClick={() =>
													setStickyForm({ ...stickyForm, urgency: v })
												}
												className={`flex-1 py-2 rounded-lg text-xs font-semibold ${
													stickyForm.urgency === v
														? "bg-blue-500 text-white shadow-md"
														: "bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600"
												}`}
											>
												{l}
											</button>
										))}
									</div>
								</div>
								<div className="w-1/3">
									<span className="block text-[10px] text-gray-500 dark:text-gray-400 mb-1">
										Importance
									</span>
									<div className="flex gap-1">
										{[
											{ v: 1, l: "Low" },
											{ v: 2, l: "Med" },
											{ v: 3, l: "High" },
										].map(({ v, l }) => (
											<button
												key={v}
												onClick={() =>
													setStickyForm({ ...stickyForm, importance: v })
												}
												className={`flex-1 py-2 rounded-lg text-xs font-semibold ${
													stickyForm.importance === v
														? "bg-blue-500 text-white shadow-md"
														: "bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600"
												}`}
											>
												{l}
											</button>
										))}
									</div>
								</div>
								<div className="w-1/3">
									<span className="block text-[10px] text-gray-500 dark:text-gray-400 mb-1">
										&nbsp;
									</span>
									<button
										type="button"
										onClick={() => setIsRecurring(!isRecurring)}
										className={`w-full py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5 ${isRecurring ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 ring-1 ring-amber-300 dark:ring-amber-700" : "bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 ring-1 ring-gray-200 dark:ring-gray-600"}`}
									>
										<FaSync
											size={10}
											className={
												isRecurring ? "text-amber-500" : "text-gray-400"
											}
										/>
										Repeat
									</button>
								</div>
							</div>

							{/* Row 4: Tags */}
							<div className="flex gap-2">
								<div className="flex-1">
									<Autocomplete
										multiple
										size="small"
										options={allContacts}
										getOptionLabel={(o) => o.name}
										value={selectedContacts}
										onChange={(_, v) => setSelectedContacts(v)}
										slotProps={{
											paper: {
												sx: {
													backgroundColor: isDark
														? "rgb(55 65 81)"
														: "rgb(255 255 255)",
													color: isDark ? "rgb(255 255 255)" : "rgb(17 24 39)",
												},
											},
										}}
										renderInput={(p) => (
											<TextField
												{...p}
												placeholder="People"
												size="small"
												sx={inputStyles}
											/>
										)}
										renderTags={(v, g) =>
											v.map((o, i) => (
												<Chip
													{...g({ index: i })}
													key={o.id}
													label={o.name}
													size="small"
													sx={{
														height: "22px",
														fontSize: "0.7rem",
														backgroundColor: isDark
															? "rgb(75 85 99)"
															: undefined,
														color: isDark ? "white" : undefined,
													}}
												/>
											))
										}
									/>
								</div>
								<div className="flex-1">
									<Autocomplete
										multiple
										size="small"
										options={allPlaces}
										getOptionLabel={(o) => o.name}
										value={selectedPlaces}
										onChange={(_, v) => setSelectedPlaces(v)}
										slotProps={{
											paper: {
												sx: {
													backgroundColor: isDark
														? "rgb(55 65 81)"
														: "rgb(255 255 255)",
													color: isDark ? "rgb(255 255 255)" : "rgb(17 24 39)",
												},
											},
										}}
										renderInput={(p) => (
											<TextField
												{...p}
												placeholder="Places"
												size="small"
												sx={inputStyles}
											/>
										)}
										renderTags={(v, g) =>
											v.map((o, i) => (
												<Chip
													{...g({ index: i })}
													key={o.id}
													label={o.name}
													size="small"
													sx={{
														height: "22px",
														fontSize: "0.7rem",
														backgroundColor: isDark
															? "rgb(75 85 99)"
															: undefined,
														color: isDark ? "white" : undefined,
													}}
												/>
											))
										}
									/>
								</div>
								<div className="flex-1">
									<Autocomplete
										multiple
										size="small"
										options={allGoals}
										getOptionLabel={(o) => o.title}
										value={selectedGoals}
										onChange={(_, v) => setSelectedGoals(v)}
										slotProps={{
											paper: {
												sx: {
													backgroundColor: isDark
														? "rgb(55 65 81)"
														: "rgb(255 255 255)",
													color: isDark ? "rgb(255 255 255)" : "rgb(17 24 39)",
												},
											},
										}}
										renderInput={(p) => (
											<TextField
												{...p}
												placeholder="Goals"
												size="small"
												sx={inputStyles}
											/>
										)}
										renderTags={(v, g) =>
											v.map((o, i) => (
												<Chip
													{...g({ index: i })}
													key={o.id}
													label={o.title}
													size="small"
													sx={{
														height: "22px",
														fontSize: "0.7rem",
														backgroundColor:
															o.color || (isDark ? "rgb(75 85 99)" : undefined),
														color: isDark ? "white" : undefined,
													}}
												/>
											))
										}
									/>
								</div>
							</div>

							{/* Recurrence Options */}
							{isRecurring && (
								<div className="px-2 py-1.5 space-y-1.5 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 ring-1 ring-amber-200/50 dark:ring-amber-800/50">
									<div className="flex gap-0.5">
										{(
											[
												{ k: "daily", l: "D" },
												{ k: "weekly", l: "W" },
												{ k: "monthly", l: "M" },
												{ k: "yearly", l: "Y" },
												{ k: "custom", l: "?" },
											] as const
										).map(({ k, l }) => (
											<button
												key={k}
												onClick={() => setRecurrencePattern(k)}
												className={`w-7 h-7 rounded-lg text-xs font-medium ${recurrencePattern === k ? "bg-amber-500 text-white" : "bg-white/60 dark:bg-gray-800/60 text-gray-600 dark:text-gray-300"}`}
											>
												{l}
											</button>
										))}
									</div>
									<div className="flex items-center gap-2">
										<span className="text-xs text-gray-500">Every</span>
										<input
											type="number"
											min="1"
											max="99"
											value={recurrenceInterval}
											onChange={(e) =>
												setRecurrenceInterval(Number(e.target.value) || 1)
											}
											className="w-12 px-2 py-1 text-center text-sm rounded-lg border border-amber-200 dark:border-amber-800 bg-white dark:bg-gray-800"
										/>
										{recurrencePattern === "custom" ? (
											<select
												value={customUnit}
												onChange={(e) => setCustomUnit(e.target.value as any)}
												className="px-2 py-1 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800"
											>
												<option value="days">Days</option>
												<option value="weeks">Weeks</option>
												<option value="months">Months</option>
												<option value="years">Years</option>
											</select>
										) : (
											<span className="text-xs text-gray-500">
												{recurrencePattern.replace(
													"ly",
													recurrenceInterval > 1 ? "s" : "",
												)}
											</span>
										)}
									</div>
									{recurrencePattern === "weekly" && (
										<div className="flex justify-between">
											{["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
												<button
													key={i}
													onClick={() =>
														setWeeklyDays((p) =>
															p.includes(i)
																? p.filter((x) => x !== i)
																: [...p, i].sort(),
														)
													}
													className={`w-7 h-7 rounded-full text-xs font-medium ${weeklyDays.includes(i) ? "bg-amber-500 text-white" : "bg-white/60 dark:bg-gray-800/60 text-gray-500"}`}
												>
													{d}
												</button>
											))}
										</div>
									)}
									<div className="flex items-center gap-3 text-xs">
										<span className="text-gray-500">Ends:</span>
										{[
											{ v: "never", l: "Never" },
											{ v: "count", l: "After" },
											{ v: "date", l: "On" },
										].map(({ v, l }) => (
											<label
												key={v}
												className="flex items-center gap-1 cursor-pointer"
											>
												<input
													type="radio"
													name="endType"
													checked={recurrenceEndType === v}
													onChange={() => setRecurrenceEndType(v as any)}
													className="w-3 h-3 accent-amber-500"
												/>
												<span
													className={
														recurrenceEndType === v
															? "text-amber-600 font-medium"
															: "text-gray-500"
													}
												>
													{l}
												</span>
											</label>
										))}
										{recurrenceEndType === "count" && (
											<input
												type="number"
												min="1"
												value={recurrenceCount}
												onChange={(e) =>
													setRecurrenceCount(Number(e.target.value) || 1)
												}
												className="w-12 px-1 py-0.5 text-center text-xs rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800"
											/>
										)}
										{recurrenceEndType === "date" && (
											<div className="w-28">
												<DatePicker
													value={recurrenceEndDate}
													onChangeAction={setRecurrenceEndDate}
													placeholder="End"
													className="text-xs"
												/>
											</div>
										)}
									</div>
									<div className="flex items-center gap-2 text-xs text-gray-500">
										<span>Remind</span>
										<input
											type="number"
											min="0"
											max="30"
											value={workDateOffset}
											onChange={(e) =>
												setWorkDateOffset(Number(e.target.value) || 0)
											}
											className="w-10 px-1 py-0.5 text-center rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800"
										/>
										<span>days before</span>
									</div>
									{!stickyForm.deadline && (
										<p className="text-xs text-amber-600 dark:text-amber-400">
											Set a due date to enable recurring
										</p>
									)}
								</div>
							)}

							{/* Submit */}
							<button
								onClick={handleQuickAdd}
								disabled={!title.trim()}
								className={`w-full py-2 rounded-xl font-medium text-sm transition-all ${
									title.trim()
										? "bg-blue-500 text-white shadow-lg shadow-blue-500/25 hover:bg-blue-600"
										: "bg-gray-200 dark:bg-gray-700 text-gray-400"
								}`}
							>
								Add Todo
							</button>
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
});

QuickAddTodo.displayName = "QuickAddTodo";
export default QuickAddTodo;
