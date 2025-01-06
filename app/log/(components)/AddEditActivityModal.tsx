"use client";
import axios from "axios";
import { Button, Label, Modal, TextInput } from "flowbite-react";
import { useState } from "react";
import * as HiIcons from "react-icons/hi";

export default function AddEditActivityModal({
  data,
}: {
  data?: ActivityType;
}) {
  const [openModal, setOpenModal] = useState(false);
  const [openIconTray, setOpenIconTray] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [iconName, setIconName] = useState(data ? data.icon : "");
  const [title, setTitle] = useState(data ? data.title : "");
  const [category, setCategory] = useState(data ? data.category : "");
  const allHiIcons = Object.values(HiIcons);
  const type = data ? "Edit" : "Add";
  const IconComponent =
    HiIcons[iconName as keyof typeof HiIcons] ||
    HiIcons.HiOutlineQuestionMarkCircle;
  function onCloseModal() {
    setOpenModal(false);
    setOpenIconTray(false);
    setTitle("");
    setCategory("");
  }
  function handleButtonClick() {
    const baseUrl = window.location.origin;
    if (type === "Add") {
      // Add new activity
      axios
        .post(`${baseUrl}/api/activity`, {
          icon: iconName,
          title,
          category,
        })
        .then((response) => {
          console.log("Success:", response.data);
          onCloseModal();
          window.location.reload()
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
        .put(`${baseUrl}/api/activity`, {
          oldTitle: data?.title,
          icon: iconName,
          title,
          category,
        })
        .then((response) => {
          console.log("Success:", response.data);
          onCloseModal();
          window.location.reload()
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
        {type === "Add" ? (
          <div className="cursor-pointer hover:underline">{type}</div>
        ) : (
          <HiIcons.HiOutlinePencilAlt size="24px" color="green" />
        )}
      </div>
      <Modal show={openModal} size="md" onClose={onCloseModal} popup>
        <Modal.Header />
        <Modal.Body>
          <div className="space-y-6">
            <h3 className="text-xl font-medium text-gray-900 dark:text-white">
              {type} activity
            </h3>
            <div className="flex flex-row w-full align-middle justify-center">
              <IconComponent size={96} className="self-center cursor-pointer" />
              <HiIcons.HiOutlinePencilAlt
                size="24px"
                onClick={() => setOpenIconTray(true)}
              />
            </div>
            {openIconTray && (
              <div>
                <TextInput
                  id="search"
                  type="text"
                  placeholder="search"
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  className="w-full"
                />{" "}
                <div className="flex flex-row flex-wrap gap-4 h-40 overflow-y-scroll p-5 mt-1">
                  {allHiIcons
                    ?.filter((i) => i.name.includes(searchText))
                    ?.map((Icon, index) => (
                      <div key={index}>
                        <Icon
                          size={24}
                          className="cursor-pointer"
                          onClick={() => {
                            setIconName(Icon.name);
                            setOpenIconTray(false);
                          }}
                        />
                      </div>
                    ))}
                </div>
              </div>
            )}
            <div>
              <div className="mb-2 block">
                <Label htmlFor="text" value="Title" />
              </div>
              <TextInput
                id="title"
                placeholder="Title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
              />
            </div>
            <div>
              <div className="mb-2 block">
                <Label htmlFor="text" value="Category" />
              </div>
              <TextInput
                id="category"
                placeholder="Category"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                required
              />
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
