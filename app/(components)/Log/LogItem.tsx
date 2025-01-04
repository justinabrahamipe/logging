"use client";
// import axios from "axios";
import { DateTime } from "luxon";
import * as HiIcons from "react-icons/hi";
import { useEffect, useState } from "react";
import axios from "axios";

export default function LogItem({
  data,
  setRerun,
}: {
  data: LogType;
  setRerun: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const IconComponent =
    HiIcons[data.activityIcon as keyof typeof HiIcons] ||
    HiIcons.HiOutlineQuestionMarkCircle;
  const [timeDiff, setTimeDiff] = useState("");

  useEffect(() => {
    if (data?.start_time) {
      const interval = setInterval(() => {
        if (data.start_time) {
          setTimeDiff(getTimeDiffFromNowInHHMMSS(data.start_time.toString()));
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [data?.start_time]);

  function getTimeDiffFromNowInHHMMSS(isoTime: string): string {
    const isoTimeDate = DateTime.fromISO(isoTime);
    const now = DateTime.now();
    const diff = now.diff(isoTimeDate, ["hours", "minutes", "seconds"]);

    return `${diff.hours.toFixed(0).padStart(2, "0")}:${diff.minutes
      .toFixed(0)
      .padStart(2, "0")}:${diff.seconds.toFixed(0).padStart(2, "0")}`;
  }
  const baseUrl = window.location.origin;
  function handleStop() {
    // stop the activity
    axios
      .put(`${baseUrl}/api/log`, {
        id: data.id,
        end_time: new Date().toISOString(),
      })
      .then((response) => {
        console.log("Success:", response.data);
        setRerun((prev) => !prev);
      })
      .catch((error) => {
        console.error(
          "Error:",
          error.response ? error.response.data : error.message
        );
      });
  }
  return (
    <>
      <div className="p-3 border border-gray-50 border-opacity-10 border-r-2 rounded-lg hover:bg-slate-900 min-w-96">
        <div className="flex items-center space-x-4 rtl:space-x-reverse">
          <IconComponent size={24} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
              {data?.activityTitle}
            </p>
            <p className="truncate text-sm text-gray-500 dark:text-gray-400">
              {data?.activityCategory}
            </p>
          </div>
          <div>{data?.start_time ? timeDiff : "N/A"}</div>
          <div className="inline-flex items-center text-base text-gray-900 dark:text-white cursor-pointer ">
            <HiIcons.HiStop size={36} color="red" onClick={handleStop} />
          </div>
        </div>
      </div>
    </>
  );
}
