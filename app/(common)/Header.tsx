import Link from "next/link";
import {
  DarkThemeToggle,
  Navbar,
  NavbarBrand,
  NavbarCollapse,
  NavbarLink,
  NavbarToggle,
} from "flowbite-react";

export default function Header() {
  return (
    <Navbar fluid rounded>
      <NavbarBrand as={Link} href="/">
        <span className="self-center whitespace-nowrap text-xl font-semibold  dark:text-white">
          Total logger
        </span>
      </NavbarBrand>
      <NavbarToggle />
      <NavbarCollapse>
        <NavbarLink href="/activities" active>
          Activities
        </NavbarLink>
        <NavbarLink href="/log" active>
          Log
        </NavbarLink>
        <DarkThemeToggle />
      </NavbarCollapse>
    </Navbar>
  );
}
