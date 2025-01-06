"use client";
import DeleteDialog from "@/app/(common)/DeleteDialog";
import getIconFromName from "@/app/(utilities)/getIconFromName";
import axios from "axios";
import { Table } from "flowbite-react";
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
    <div className="overflow-x-auto">
      <Table hoverable>
        <Table.Head>
          <Table.HeadCell>Activity</Table.HeadCell>
          <Table.HeadCell>Times</Table.HeadCell>
        </Table.Head>
        <Table.Body className="divide-y">
          {data?.map((log: LogType) => (
            <Table.Row
              className="bg-white dark:border-gray-700 dark:bg-gray-800"
              key={log.id}
              onMouseEnter={() =>
                setActiveRow(log.id === activeRow ? null : log.id)
              }
            >
              <Table.Cell className="font-medium text-gray-900 dark:text-white">
                <div className="flex flex-row flex-wrap gap-3">
                  <div className="flex flex-row items-center gap-2">
                    {React.createElement(getIconFromName(log.activityIcon))}
                    {log.activityTitle}
                    {log.comment}
                  </div>{" "}
                  {log.activityCategory}
                </div>
              </Table.Cell>
              <Table.Cell>
                <div className="flex flex-row flex-wrap gap-3">
                  {activeRow === log.id ? (
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
                  ) : (
                    <>
                      {log.start_time
                        ? DateTime.fromISO(log.start_time.toString()).toFormat(
                            "dd/MM/yy HH:mm"
                          )
                        : null}{" "}
                      {log.end_time
                        ? DateTime.fromISO(log.end_time.toString()).toFormat(
                            "dd/MM/yy HH:mm"
                          )
                        : null}
                    </>
                  )}
                </div>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </div>
  );
}
