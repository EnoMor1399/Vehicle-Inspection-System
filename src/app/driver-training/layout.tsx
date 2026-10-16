import type { ReactNode } from "react";
import DriverTrainingNav from "./DriverTrainingNav";
import styles from "./DriverTrainingFormal.module.css";
import { requireDriverTrainingUser } from "@/lib/require-auth";
import { canManageTrainingUsers } from "@/lib/training-access";

export default async function DriverTrainingLayout({ children }: { children: ReactNode }) {
  const user = await requireDriverTrainingUser();

  return (
    <div className={styles.formal}>
      <DriverTrainingNav canManageUsers={canManageTrainingUsers(user)} />
      {children}
    </div>
  );
}
