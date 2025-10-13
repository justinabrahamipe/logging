"use client";
import axios from "axios";
import {
  Button,
  Datepicker,
  Label,
  Modal,
  Radio,
  TextInput,
} from "flowbite-react";
import { useEffect, useState } from "react";
import * as HiIcons from "react-icons/hi";
import { format } from "date-fns";

export default function AddEditActivityModal({
  data,
  refetchAction,
  children,
}: {
  data?: TodoType;
  refetchAction: React.Dispatch<React.SetStateAction<boolean>>;
  children?: React.ReactNode;
}) {
  const [openModal, setOpenModal] = useState(false);
  const [params, setParams] = useState<TodoType>(
    data ? data : ({} as TodoType)
  );
  const type = data ? "Edit" : "Add";
  useEffect(() => {
    setParams(data || ({} as TodoType));
  }, [data]);
  function onCloseModal() {
    setOpenModal(false);
    setParams({} as TodoType);
  }
  function handleButtonClick() {
    const baseUrl = window.location.origin;
    if (type === "Add") {
      // Add new todo
      axios
        .post(`${baseUrl}/api/todo`, {
        //  Title: params.title,
          ...params,
        })
        .then((response) => {
          console.log("Success:", response.data);
          onCloseModal();
          refetchAction((x: boolean) => !x);
        })
        .catch((error) => {
          console.error(
            "Error:",
            error.response ? error.response.data : error.message
          );
        });
    }
    if (type === "Edit") {
      // Edit activity
      axios
        .put(`${baseUrl}/api/todo`, {
          ...params,
        })
        .then((response) => {
          console.log("Success:", response.data);
          onCloseModal();
          refetchAction((x: boolean) => !x);
        })
        .catch((error) => {
          console.error(
            "Error:",
            error.response ? error.response.data : error.message
          );
        });
    }
  }
  return (
    <>
      <div onClick={() => setOpenModal(true)}>
        {children || (
          type === "Add" ? (
            <div className="cursor-pointer hover:underline">{type}</div>
          ) : (
            <HiIcons.HiOutlinePencilAlt size="24px" color="green" />
          )
        )}
      </div>
      <Modal show={openModal} size="md" onClose={onCloseModal} popup>
        <Modal.Header />
        <Modal.Body>
          <div className="space-y-6">
            <h3 className="text-xl font-medium text-gray-900 dark:text-white">
              {type} todo
            </h3>
            <div>
              <div className="mb-2 block">
                <Label htmlFor="text" value="Title" />
              </div>
              <TextInput
                id="title"
                placeholder="Title"
                value={params.title}
                onChange={(event) =>
                  setParams({ ...params, title: event.target.value })
                }
                required
              />
            </div>
            <div>
              <div className="mb-2 block">
                <Label htmlFor="text" value="Description" />
              </div>
              <TextInput
                id="title"
                placeholder="Description"
                value={params.description}
                onChange={(event) =>
                  setParams({ ...params, description: event.target.value })
                }
                required
              />
            </div>
            <div className="flex justify-around flex-row">
              <div className="flex gap-2 flex-col">
                <div className="mb-2 block">
                  <Label htmlFor="text" value="Urgency" />
                </div>
                <div className="flex max-w-md flex-row gap-4">
                  <div className="flex items-center gap-2">
                    <Radio
                      id="1"
                      name="urgency"
                      value="1"
                      defaultChecked
                      onChange={(event) =>
                        setParams({
                          ...params,
                          urgency: Number(event.target.value),
                        })
                      }
                    />
                    <Label htmlFor="1">1</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Radio
                      id="2"
                      name="urgency"
                      value="2"
                      onChange={(event) =>
                        setParams({
                          ...params,
                          urgency: Number(event.target.value),
                        })
                      }
                    />
                    <Label htmlFor="2">2</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Radio
                      id="3"
                      name="urgency"
                      value="3"
                      onChange={(event) =>
                        setParams({
                          ...params,
                          urgency: Number(event.target.value),
                        })
                      }
                    />
                    <Label htmlFor="3">3</Label>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 flex-col">
                <div className="mb-2 block">
                  <Label htmlFor="text" value="Importance" />
                </div>
                <div className="flex max-w-md flex-row gap-4">
                  <div className="flex items-center gap-2">
                    <Radio
                      id="1"
                      name="importance"
                      value="1"
                      defaultChecked
                      onChange={(event) =>
                        setParams({
                          ...params,
                          importance: Number(event.target.value),
                        })
                      }
                    />
                    <Label htmlFor="1">1</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Radio
                      id="2"
                      name="importance"
                      value="2"
                      onChange={(event) =>
                        setParams({
                          ...params,
                          importance: Number(event.target.value),
                        })
                      }
                    />
                    <Label htmlFor="2">2</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Radio
                      id="3"
                      name="importance"
                      value="3"
                      onChange={(event) =>
                        setParams({
                          ...params,
                          importance: Number(event.target.value),
                        })
                      }
                    />
                    <Label htmlFor="3">3</Label>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-2 flex-col">
              <div>
                <div className="mb-2 block">
                  <Label htmlFor="text" value="Deadline" />
                </div>
                <Datepicker
                  autoHide
                  // value={params.deadline}
                  onChange={(e) =>
                    setParams({
                      ...params,
                      deadline: format(new Date(e || ""), "yyyy-MM-dd"),
                    })
                  }
                />
              </div>
              <div>
                <div className="mb-2 block">
                  <Label htmlFor="text" value="Work date" />
                </div>
                <Datepicker
                  autoHide
                  // value={params.work_date}
                  onChange={(e) =>
                    setParams({
                      ...params,
                      work_date: format(new Date(e || ""), "yyyy-MM-dd"),
                    })
                  }
                />
              </div>
            </div>

            <div className="w-full">
              <Button onClick={handleButtonClick}>{type}</Button>
            </div>
          </div>
        </Modal.Body>
      </Modal>
    </>
  );
}
