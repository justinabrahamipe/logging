"use client";

import { Button, Modal } from "flowbite-react";
import { useState } from "react";
import { HiOutlineExclamationCircle, HiTrash } from "react-icons/hi";

export default function DeleteDialog({
  id,
  itemToDelete,
  deleteFunction,
  iconSize,
}: {
  id: number;
  itemToDelete: string;
  deleteFunction: (id: number) => void;
  iconSize?: string | number;
}) {
  const [openModal, setOpenModal] = useState(false);
  function handleDelete() {
    deleteFunction(id);
    setOpenModal(false);
  }
  return (
    <>
      <HiTrash
        size={iconSize || "24px"}
        color="red"
        onClick={() => setOpenModal(true)}
      />
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
              Are you sure you want to delete {itemToDelete}?
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
