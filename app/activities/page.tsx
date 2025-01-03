import axios from "axios";
import ActivityCard from "../(components)/ActivityCard";
import { Button } from "flowbite-react";
import { HiDocumentAdd } from "react-icons/hi";
import AddEditActivityModal from "../(components)/AddEditActivityModal";

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
    <div className="grid grid-rows-[20px_1fr_20px] min-h-screen p-4 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-2 row-start-2 items-center sm:items-start">
        Activities
        <Button outline pill>
          <HiDocumentAdd className="h-6 w-6" />{" "}
          <AddEditActivityModal />
        </Button>
        <div className="flex flex-row gap-16 flex-wrap">
          {" "}
          {data?.data?.data?.map((activity: ActivityType) => (
            <div key={activity.id}>
              <ActivityCard data={activity} />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
