"use client";

import getIconFromName from "@/app/(utilities)/getIconFromName";
import { Table } from "flowbite-react";
import React from "react";
import { DateTime } from "luxon";
import { HiTrash, HiOutlinePencilAlt } from "react-icons/hi";

export default function LogTable({ data }: { data: LogType[] }) {
  return (
    <div className="overflow-x-auto">
      <Table hoverable>
        <Table.Head>
          <Table.HeadCell>Activity</Table.HeadCell>
          <Table.HeadCell>Times</Table.HeadCell>
          <Table.HeadCell>
            <span className="sr-only">Edit</span>
          </Table.HeadCell>
        </Table.Head>
        <Table.Body className="divide-y">
          {data?.map((log: LogType) => (
            <Table.Row
              className="bg-white dark:border-gray-700 dark:bg-gray-800"
              key={log.id}
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
                </div>
              </Table.Cell>
              <Table.Cell>
                <div className="flex flex-row flex-wrap gap-3">
                  <HiOutlinePencilAlt size="24px" color="green" />
                  <HiTrash size="24px" color="red" />
                </div>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </div>
  );
}
