"use client";
import axios from "axios";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField } from "@mui/material";
import { useEffect, useState, ChangeEvent } from "react";
import * as HiIcons from "react-icons/hi";

export default function AddEditActivityModal({
  data,
  refetchAction,
  children,
}: {
  data?: ActivityType;
  refetchAction?: () => void;
  children?: React.ReactNode;
}) {
  const [openModal, setOpenModal] = useState(false);
  const [openIconTray, setOpenIconTray] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [iconName, setIconName] = useState(data ? data.icon : "");
  const [title, setTitle] = useState(data ? data.title : "");
  const [category, setCategory] = useState(data ? data.category : "");
  const allHiIcons = Object.values(HiIcons);
  const type = data ? "Edit" : "Add";
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  useEffect(() => {
    setTitle(data?.title || "");
    setCategory(data?.category || "");
    setIconName(data?.icon || "");
  }, [data]);

  const IconComponent =
    HiIcons[iconName as keyof typeof HiIcons] ||
    HiIcons.HiOutlineQuestionMarkCircle;

  function onCloseModal() {
    setOpenModal(false);
    setOpenIconTray(false);
    if (!data) {
      setTitle("");
      setCategory("");
      setIconName("");
    }
  }

  function handleIconSelect(iconName: string) {
    setIconName(iconName);
    setOpenIconTray(false);
  }

  function handleButtonClick() {
    if (type === "Add") {
      axios
        .post(`${baseUrl}/api/activity`, {
          icon: iconName,
          title,
          category,
        })
        .then(() => {
          onCloseModal();
          if (refetchAction) refetchAction();
        })
        .catch((error) => {
          console.error("Error adding activity:", error);
        });
    }
    if (type === "Edit") {
      axios
        .put(`${baseUrl}/api/activity`, {
          oldTitle: data?.title,
          icon: iconName,
          title,
          category,
        })
        .then(() => {
          onCloseModal();
          if (refetchAction) refetchAction();
        })
        .catch((error) => {
          console.error("Error updating activity:", error);
        });
    }
  }

  return (
    <>
      <div onClick={() => setOpenModal(true)} className="cursor-pointer">
        {children || (
          type === "Add" ? (
            <span className="hover:underline">{type}</span>
          ) : (
            <HiIcons.HiOutlinePencilAlt size="24px" className="text-green-500 hover:text-green-600 transition-colors" />
          )
        )}
      </div>
      <Dialog
        open={openModal}
        onClose={onCloseModal}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{type} Activity</DialogTitle>
        <DialogContent>
          <div className="space-y-6 pt-4">
            <div className="flex flex-row w-full items-center justify-center gap-2">
              <IconComponent size={64} className="cursor-pointer" onClick={() => setOpenIconTray(!openIconTray)} />
              <HiIcons.HiOutlinePencilAlt
                size="20px"
                className="cursor-pointer text-gray-500 hover:text-gray-700"
                onClick={() => setOpenIconTray(!openIconTray)}
              />
            </div>
            {openIconTray && (
              <div className="space-y-2">
                <TextField
                  size="small"
                  fullWidth
                  placeholder="Search icons..."
                  value={searchText}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchText(e.target.value)}
                />
                <div className="flex flex-row flex-wrap gap-3 h-40 overflow-y-auto p-3 border rounded-lg">
                  {allHiIcons
                    ?.filter((i) => i.name.toLowerCase().includes(searchText.toLowerCase()))
                    ?.slice(0, 100)
                    ?.map((Icon, index) => (
                      <div key={index} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer">
                        <Icon
                          size={24}
                          onClick={() => handleIconSelect(Icon?.name)}
                        />
                      </div>
                    ))}
                </div>
              </div>
            )}
            <TextField
              label="Title"
              fullWidth
              size="small"
              value={title}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
              required
            />
            <TextField
              label="Category"
              fullWidth
              size="small"
              value={category}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setCategory(e.target.value)}
              required
            />
          </div>
        </DialogContent>
        <DialogActions className="p-4">
          <Button onClick={onCloseModal}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleButtonClick}
            disabled={!title.trim() || !category.trim()}
          >
            {type}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
