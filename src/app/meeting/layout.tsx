import type { ReactNode } from "react";
import "./globals.css";
import ThemeShell from "./ThemeShell";

export const metadata = {
  title: "Group Meeting Dashboard",
  description:
    "Read-only dashboard for group meeting roster from Google Sheets.",
};

export default function GroupMeetingLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <ThemeShell>{children}</ThemeShell>;
}

