import * as HiIcons from "react-icons/hi";

export default function getIconFromName(name: string) {
  const IconComponent =
    HiIcons[name as keyof typeof HiIcons] ||
    HiIcons.HiOutlineQuestionMarkCircle;
  return IconComponent;
}
