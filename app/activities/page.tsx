import axios from "axios";
import ActivityCard from "../components/ActivityCard";
import { Button } from "flowbite-react";
import { HiDocumentAdd } from "react-icons/hi";
import AddEditActivityModal from "../components/AddEditActivityModal";

export default async function Activities() {
  const data = await axios.get("http://localhost:3000/api/activity");
  return (
    <div className="grid grid-rows-[20px_1fr_20px] min-h-screen p-4 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-2 row-start-2 items-center sm:items-start">
        Activities
        <Button outline pill>
          <HiDocumentAdd className="h-6 w-6" /> <AddEditActivityModal type={"Add"} data={null}/>
        </Button>
        <div className="flex flex-row gap-16 flex-wrap">
          {" "}
          {data?.data?.data?.map((activity: any) => (
            <div key={activity.id}>
              <ActivityCard name={activity.name} type={activity.type} />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
