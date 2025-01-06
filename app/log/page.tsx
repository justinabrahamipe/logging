"use client";
import axios from "axios";
import { useEffect, useState } from "react";
import LogCandidate from "../(components)/Log/LogCandidate";
import LogItem from "../(components)/Log/LogItem";
import LogTable from "../(components)/Log/LogTable";

export default function Log() {
  const [activityData, setActivityData] = useState<{ data: ActivityType[] }>({
    data: [],
  });
  const [logData, setLogData] = useState<{ data: LogType[] }>({
    data: [],
  });
  const [runningLogData, setRunningLogData] = useState<{ data: LogType[] }>({
    data: [],
  });
  const [rerun, setRerun] = useState<boolean>(false);

  useEffect(() => {
    const fetchData = async () => {
      const baseUrl = window.location.origin;
      try {
        const response = await axios.get(`${baseUrl}/api/log`);
        const filteredData = response.data.data.filter(
          (log: LogType) => !log.end_time
        );
        setRunningLogData({ data: filteredData });
        setLogData({ data: response.data.data });
      } catch (error) {
        console.error("Error fetching activities:", error);
      }
    };

    fetchData();
  }, [rerun]);

  useEffect(() => {
    const fetchData = async () => {
      const baseUrl = window.location.origin;
      try {
        const response = await axios.get(`${baseUrl}/api/activity`);
        setActivityData(response.data);
      } catch (error) {
        console.error("Error fetching activities:", error);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="grid grid-rows-[20px_1fr_20px]  p-4 pb-20 gap-4 sm:p-5 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-5 row-start-2 items-center sm:items-start">
        <h1 className="font-bold text-5xl"> Log</h1>
        <h1 className="font-bold text-2xl"> Running</h1>
        <div className="flex flex-row gap-4 flex-wrap">
          {runningLogData?.data?.map((log: LogType) => (
            <div key={log.id}>
              <LogItem data={log} setRerun={setRerun} />
            </div>
          ))}
        </div>
        <div className="flex flex-row gap-4 flex-wrap">
          {activityData?.data?.map((activity: ActivityType) => (
            <div key={activity.id}>
              <LogCandidate data={activity} setRerun={setRerun} />
            </div>
          ))}
        </div>
        <div className="w-full">
          <LogTable data={logData.data} setRerun={setRerun} />
        </div>
      </main>
    </div>
  );
}
