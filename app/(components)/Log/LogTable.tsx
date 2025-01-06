"use client";

import getIconFromName from "@/app/(utilities)/getIconFromName";
import { Table } from "flowbite-react";
import { DateTime } from "luxon";
import React, { useState } from "react";
import { HiClipboardCopy, HiOutlinePencilAlt, HiTrash } from "react-icons/hi";

export default function LogTable({ data }: { data: LogType[] }) {
  const [activeRow, setActiveRow] = useState<string | null>(null);

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
              onClick={() => setActiveRow(log.id === activeRow ? null : log.id)}
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
                    <div className="flex flex-row flex-wrap justify-end items-center gap-3 ">
                      <HiOutlinePencilAlt size="32px" color="green" />
                      <HiTrash size="32px" color="red" />
                      <HiClipboardCopy size="32px" color="cyan" />
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
