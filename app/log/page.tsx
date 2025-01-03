"use client";
import axios from "axios";
import { useEffect, useState } from "react";
import LogCandidate from "../(components)/Log/LogCandidate";

export default function Activities() {
  const [data, setData] = useState<{ data: ActivityType[] }>({ data: [] });

  useEffect(() => {
    const fetchData = async () => {
      const baseUrl = window.location.origin;
      try {
        const response = await axios.get(`${baseUrl}/api/activity`);
        setData(response.data);
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
          {data?.data?.map((activity: ActivityType) => (
            <div key={activity.id}>
              <LogCandidate data={activity} />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
