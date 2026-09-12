import type { ReactNode } from "react";
import DriverTrainingNav from "./DriverTrainingNav";
import styles from "./DriverTrainingFormal.module.css";

export default function DriverTrainingLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.formal}>
      <DriverTrainingNav />
      {children}
    </div>
  );
}
