"use client";

import { useState } from "react";
import { HiOutlineExclamationCircle, HiTrash } from "react-icons/hi";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, IconButton } from "@mui/material";

interface DeleteDialogProps {
  id: number;
  itemToDelete: string;
  deleteAction: (id: number) => void;
  iconSize?: string | number;
}

export default function DeleteDialog({
  id,
  itemToDelete,
  deleteAction,
  iconSize,
}: DeleteDialogProps) {
  const [openModal, setOpenModal] = useState(false);
  function handleDelete() {
    deleteAction(id);
    setOpenModal(false);
  }
  return (
    <>
      <IconButton
        onClick={() => setOpenModal(true)}
        color="error"
        size="small"
        className="touch-target"
      >
        <HiTrash size={iconSize || "20px"} />
      </IconButton>
      <Dialog
        open={openModal}
        onClose={() => setOpenModal(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          className: "rounded-xl sm:rounded-2xl"
        }}
      >
        <DialogContent className="text-center pt-6 pb-4">
          <HiOutlineExclamationCircle className="mx-auto mb-4 h-14 w-14 text-gray-400 dark:text-gray-200" />
          <h3 className="mb-5 text-base md:text-lg font-normal text-gray-500 dark:text-gray-400">
            Are you sure you want to delete {itemToDelete}?
          </h3>
        </DialogContent>
        <DialogActions className="flex justify-center gap-2 md:gap-4 pb-4 px-4">
          <Button
            onClick={handleDelete}
            variant="contained"
            color="error"
            className="px-4 md:px-6 py-2 md:py-2.5 text-sm md:text-base touch-target"
          >
            Yes
          </Button>
          <Button
            onClick={() => setOpenModal(false)}
            variant="outlined"
            color="inherit"
            className="px-4 md:px-6 py-2 md:py-2.5 text-sm md:text-base touch-target"
          >
            No
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
