"use client";
import DeleteDialog from "@/app/(common)/DeleteDialog";
import getIconFromName from "@/app/(utilities)/getIconFromName";
import axios from "axios";
import { DateTime } from "luxon";
import React, { useEffect, useState } from "react";
import { HiClipboardCopy, HiOutlinePencilAlt } from "react-icons/hi";

export default function LogTable({
  data,
  setRerun,
}: {
  data: LogType[];
  setRerun: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const [baseUrl, setBaseUrl] = useState<string>("");
  const [activeRow, setActiveRow] = useState<string | null>(null);

  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  function handleDelete(id: number) {
    // delete the log
    axios
      .delete(`${baseUrl}/api/log`, {
        data: {
          id: id,
        },
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

  function handleDuplicate(
    activityTitle: string,
    activityCategory: string,
    activityIcon: string,
    comment: string
  ) {
    // duplicate the log
    axios
      .post(`${baseUrl}/api/log`, {
        activityTitle,
        activityCategory,
        activityIcon,
        start_time: new Date().toISOString(),
        comment,
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
      {data?.length !== 0 && (
        <div className="overflow-x-auto rounded-lg">
          <div className="grid grid-cols-2 gap-4 bg-gray-800 px-4 py-2 font-bold ">
            <div className="">Activity</div>
            <div>Times</div>
          </div>
          <div className="divide-y">
            {data?.map((log: LogType) => (
              <>
                <div
                  className="grid grid-cols-2 gap-4 bg-gray-900 p-4 cursor-pointer"
                  key={log.id}
                  onClick={() =>
                    setActiveRow(log.id === activeRow ? null : log.id)
                  }
                >
                  <div className="font-medium dark:text-white">
                    <div className="flex flex-row flex-wrap gap-3">
                      <div className="flex flex-row items-center gap-2">
                        {React.createElement(getIconFromName(log.activityIcon))}
                        {log.activityTitle}
                        {log.comment}
                      </div>{" "}
                      {log.activityCategory}
                    </div>
                  </div>
                  <div>
                    <div className="flex flex-row  gap-3 align-middle justify-start">
                      <div className="flex flex-row flex-wrap gap-2">
                        {" "}
                        {log.start_time ? (
                          <div>
                            {DateTime.fromISO(
                              log.start_time.toString()
                            ).toFormat("dd/MM/yy HH:mm")}
                          </div>
                        ) : null}{" "}
                        {log.end_time ? (
                          <div>
                            {DateTime.fromISO(log.end_time.toString()).toFormat(
                              "dd/MM/yy HH:mm"
                            )}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    {activeRow === log.id && (
                      <div className="col-span-2 p-3">
                        <div className="flex flex-row flex-wrap justify-end items-center gap-6">
                          <HiOutlinePencilAlt size="28px" color="green" />
                          <DeleteDialog
                            id={log.id}
                            itemToDelete={log.activityTitle}
                            deleteFunction={handleDelete}
                            iconSize="28px"
                          />
                          <HiClipboardCopy
                            size="28px"
                            color="cyan"
                            onClick={() =>
                              handleDuplicate(
                                log.activityTitle,
                                log.activityCategory,
                                log.activityIcon,
                                log.comment || ""
                              )
                            }
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
