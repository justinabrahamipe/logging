"use client";
import * as HiIcons from "react-icons/hi";

export default function LogCandidate({ data }: { data: ActivityType }) {
  const IconComponent =
    HiIcons[data.icon as keyof typeof HiIcons] ||
    HiIcons.HiOutlineQuestionMarkCircle;

  return (
    <>
      <div className="p-3 border border-gray-50 border-opacity-10 border-r-2 rounded-lg hover:bg-slate-900 min-w-96">
        <div className="flex items-center space-x-4 rtl:space-x-reverse">
          <IconComponent size={24} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
              {data?.title}
            </p>
            <p className="truncate text-sm text-gray-500 dark:text-gray-400">
              {data?.category}
            </p>
          </div>
          <div className="inline-flex items-center text-base text-gray-900 dark:text-white cursor-pointer ">
            <HiIcons.HiPlay size={36} color="green" />
          </div>
        </div>
      </div>
    </>
  );
}
