"use client";
import * as HiIcons from "react-icons/hi";
import DeleteActivity from "./DeleteActivity";
import AddEditActivityModal from "./AddEditActivityModal";

export default function ActivityCard({
  data,
  refetchAction,
}: {
  data: ActivityType;
  refetchAction: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const IconComponent =
    HiIcons[data.icon as keyof typeof HiIcons] ||
    HiIcons.HiOutlineQuestionMarkCircle;

  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-all border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white">
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
        <div className="flex items-center gap-2 flex-shrink-0">
          <AddEditActivityModal data={data} refetchAction={refetchAction} />
          <DeleteActivity data={data} refetchAction={refetchAction} />
        </div>
      </div>
    </div>
  );
}
