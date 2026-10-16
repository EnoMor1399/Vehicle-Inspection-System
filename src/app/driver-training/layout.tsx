import type { ReactNode } from "react";
import DriverTrainingNav from "./DriverTrainingNav";
import styles from "./DriverTrainingFormal.module.css";
import { requireDriverTrainingUser } from "@/lib/require-auth";

export default async function DriverTrainingLayout({ children }: { children: ReactNode }) {
  await requireDriverTrainingUser();

  return (
    <div className={styles.formal}>
      <DriverTrainingNav />
      {children}
    </div>
  );
}
