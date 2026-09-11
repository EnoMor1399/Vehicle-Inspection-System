import type { ReactNode } from "react";
import DriverTrainingNav from "./DriverTrainingNav";

export default function DriverTrainingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <DriverTrainingNav />
      {children}
    </>
  );
}
