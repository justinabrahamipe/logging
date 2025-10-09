export const getRelativeDate = (dateString: string) => {
  const date = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  const diffTime = targetDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  if (diffDays > 1 && diffDays <= 7) return `In ${diffDays} days`;
  if (diffDays < -1 && diffDays >= -7) return `${Math.abs(diffDays)} days ago`;

  return date.toLocaleDateString('en-GB');
};

export const getPriorityColor = (points: number) => {
  if (points >= 7) return "from-red-500 to-orange-500";
  if (points >= 4) return "from-yellow-500 to-orange-400";
  return "from-green-500 to-emerald-500";
};

export const isDateInRange = (dateString: string | undefined, range: string) => {
  if (!dateString) return false;

  const date = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  if (range === "past") {
    return targetDate < today;
  }

  if (range === "today") {
    return targetDate.getTime() === today.getTime();
  }

  if (range === "tomorrow") {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return targetDate.getTime() === tomorrow.getTime();
  }

  if (range === "week") {
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);
    return targetDate >= today && targetDate <= weekEnd;
  }

  if (range === "month") {
    const monthEnd = new Date(today);
    monthEnd.setMonth(monthEnd.getMonth() + 1);
    return targetDate >= today && targetDate <= monthEnd;
  }

  return false;
};
