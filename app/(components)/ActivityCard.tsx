"use client";
import { Avatar, ListItem } from "flowbite-react";
import AddEditActivityModal from "./AddEditActivityModal";

export default function ActivityCard({ data }: { data: ActivityType }) {
  return (
    <>
      <ListItem className="pb-3 sm:pb-4">
        <div className="flex items-center space-x-4 rtl:space-x-reverse">
          <Avatar
            img="/images/people/profile-picture-1.jpg"
            alt="Neil image"
            rounded
            size="sm"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
              {data?.name}
            </p>
            <p className="truncate text-sm text-gray-500 dark:text-gray-400">
              {data?.type}
            </p>
          </div>
          <div className="inline-flex items-center text-base font-semibold text-gray-900 dark:text-white cursor-pointer hover:underline">
            <AddEditActivityModal data={data} />
          </div>
        </div>
      </ListItem>
    </>
  );
}
