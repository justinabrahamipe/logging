"use client";

import axios from "axios";
import { Button, Modal } from "flowbite-react";
import { useState } from "react";
import { HiOutlineExclamationCircle, HiTrash } from "react-icons/hi";

export default function DeleteActivity({
  data,
  setRerun,
}: {
  data: ActivityType;
  setRerun: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const [openModal, setOpenModal] = useState(false);
  const baseUrl = window.location.origin;
  function handleDelete() {
    console.log("Deleting activity:", data?.title);
    axios
      .delete(`${baseUrl}/api/activity`, {
        data: {
          title: data?.title,
        },
      })
      .then((response) => {
        console.log("Success:", response.data);
        setRerun((x: boolean) => !x);
      });
    setOpenModal(false);
  }
  return (
    <>
      <HiTrash size="24px" color="red" onClick={() => setOpenModal(true)} />
      <Modal
        show={openModal}
        size="md"
        onClose={() => setOpenModal(false)}
        popup
      >
        <Modal.Header />
        <Modal.Body>
          <div className="text-center">
            <HiOutlineExclamationCircle className="mx-auto mb-4 h-14 w-14 text-gray-400 dark:text-gray-200" />
            <h3 className="mb-5 text-lg font-normal text-gray-500 dark:text-gray-400">
              Are you sure you want to delete {data?.title}?
            </h3>
            <div className="flex justify-center gap-4">
              <Button color="failure" onClick={handleDelete}>
                {"Yes"}
              </Button>
              <Button color="gray" onClick={() => setOpenModal(false)}>
                No
              </Button>
            </div>
          </div>
        </Modal.Body>
      </Modal>
    </>
  );
}
