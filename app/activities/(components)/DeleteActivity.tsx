"use client";

import axios from "axios";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from "@mui/material";
import { useState } from "react";
import { HiOutlineExclamationCircle, HiTrash } from "react-icons/hi";

export default function DeleteActivity({
  data,
  refetchAction,
}: {
  data: ActivityType;
  refetchAction?: () => void;
}) {
  const [openModal, setOpenModal] = useState(false);
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  function handleDelete() {
    axios
      .delete(`${baseUrl}/api/activity`, {
        data: {
          title: data?.title,
        },
      })
      .then(() => {
        if (refetchAction) refetchAction();
      })
      .catch((error) => {
        console.error("Error deleting activity:", error);
      });
    setOpenModal(false);
  }

  return (
    <>
      <HiTrash
        size="24px"
        className="cursor-pointer text-red-500 hover:text-red-600 transition-colors"
        onClick={() => setOpenModal(true)}
      />
      <Dialog
        open={openModal}
        onClose={() => setOpenModal(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle className="text-center">Delete Activity</DialogTitle>
        <DialogContent>
          <div className="text-center py-4">
            <HiOutlineExclamationCircle className="mx-auto mb-4 h-14 w-14 text-gray-400 dark:text-gray-200" />
            <p className="text-lg text-gray-500 dark:text-gray-400">
              Are you sure you want to delete <strong>{data?.title}</strong>?
            </p>
          </div>
        </DialogContent>
        <DialogActions className="justify-center gap-4 pb-4">
          <Button
            variant="contained"
            color="error"
            onClick={handleDelete}
          >
            Yes, Delete
          </Button>
          <Button
            variant="outlined"
            onClick={() => setOpenModal(false)}
          >
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
