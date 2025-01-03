import axios from "axios";
import ActivityCard from "../(components)/Activity/ActivityCard";
import { Button } from "flowbite-react";
import { HiDocumentAdd } from "react-icons/hi";
import AddEditActivityModal from "../(components)/Activity/AddEditActivityModal";

export default async function Activities() {
  let data;
  const baseUrl = process.env.NEXT_PUBLIC_VERCEL_URL
    ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
    : "http://localhost:3000";
  try {
    const response = await axios.get(`${baseUrl}/api/activity`);
    data = response.data;
  } catch (error) {
    console.error("Error fetching activities:", error);
    data = { data: [] }; // Fallback to an empty array
  }
  return (
    <div className="grid grid-rows-[20px_1fr_20px]  p-4 pb-20 gap-4 sm:p-5 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-2 row-start-2 items-center sm:items-start">
        <div className="min-w-full flex flex-row justify-between">
          {" "}
          <h1 className="font-bold text-5xl"> Activities</h1>
          <Button outline pill>
            <HiDocumentAdd className="h-6 w-6" /> <AddEditActivityModal />
          </Button>
        </div>
        <div className="flex flex-row gap-4 flex-wrap">
          {" "}
          {data?.data?.map((activity: ActivityType) => (
            <div key={activity.id}>
              <ActivityCard data={activity} />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
