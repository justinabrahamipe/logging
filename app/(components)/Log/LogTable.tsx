"use client";

import getIconFromName from "@/app/(utilities)/getIconFromName";
import { Table } from "flowbite-react";
import React from "react";

export default function LogTable({ data }: { data: LogType[] }) {
  return (
    <div className="overflow-x-auto">
      <Table hoverable>
        <Table.Head>
          <Table.HeadCell>Activity name</Table.HeadCell>
          <Table.HeadCell>Category</Table.HeadCell>
          <Table.HeadCell>Start time</Table.HeadCell>
          <Table.HeadCell>End time</Table.HeadCell>
          <Table.HeadCell>Comment</Table.HeadCell>
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
              <Table.Cell className="whitespace-nowrap font-medium text-gray-900 dark:text-white">
                <div className="flex flex-row items-center gap-2">
                  {React.createElement(getIconFromName(log.activityIcon))}
                  {log.activityTitle}
                </div>
              </Table.Cell>
              <Table.Cell> {log.activityCategory}</Table.Cell>
              <Table.Cell> {log.start_time?.toString()}</Table.Cell>
              <Table.Cell> {log.end_time?.toString()}</Table.Cell>
              <Table.Cell> {log.comment}</Table.Cell>
              <Table.Cell>
                <a
                  href="#"
                  className="font-medium text-cyan-600 hover:underline dark:text-cyan-500"
                >
                  Edit
                </a>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </div>
  );
}
