"use client";
import { Avatar, ListItem } from "flowbite-react";
import AddEditActivityModal from "./AddEditActivityModal";
import { useState } from "react";

export default function ActivityCard({ name, type }) {
  const [openModal, setOpenModal] = useState(false);
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
              {name}
            </p>
            <p className="truncate text-sm text-gray-500 dark:text-gray-400">
              {type}
            </p>
          </div>
          <div
            className="inline-flex items-center text-base font-semibold text-gray-900 dark:text-white cursor-pointer hover:underline"
    
          >
             <AddEditActivityModal type='Edit' data={name,type} />
          </div>
        </div>
      </ListItem>
    </>
  );
}
