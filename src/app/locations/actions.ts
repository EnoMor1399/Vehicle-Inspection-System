"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { locations } from "@/db/schema";
import { getCurrentUser, canManageLocations } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { newId } from "@/lib/utils";

export type StationInput = {
  id?: string;
  name: string;
  code: string;
  region?: string;
  district?: string;
  address?: string;
  gpsAddress?: string;
  phone?: string;
  email?: string;
  managerName?: string;
  capacity?: number | null;
  equipment?: string[];
  status?: "active" | "inactive" | "maintenance";
};

export async function saveStation(input: StationInput) {
  const user = await getCurrentUser();
  if (!canManageLocations(user)) throw new Error("You do not have permission to manage inspection stations");

  const name = input.name.trim();
  const code = input.code.trim().toUpperCase();
  if (name.length < 2 || name.length > 200) throw new Error("Station name must be between 2 and 200 characters");
  if (!/^[A-Z0-9][A-Z0-9_-]{1,19}$/.test(code)) throw new Error("Station code must be 2-20 characters using letters, numbers, hyphens, or underscores");
  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) throw new Error("Enter a valid station email address");
  const capacity = input.capacity == null ? null : Math.max(0, Math.min(10000, Math.trunc(input.capacity)));
  const equipment = (input.equipment || []).map((item) => item.trim()).filter(Boolean).slice(0, 50);
  const status = input.status || "active";

  const duplicateQuery = input.id
    ? and(eq(locations.code, code), ne(locations.id, input.id))
    : eq(locations.code, code);
  const [duplicate] = await db.select({ id: locations.id }).from(locations).where(duplicateQuery).limit(1);
  if (duplicate) throw new Error("Another station already uses this code");

  const values = {
    name,
    code,
    region: input.region?.trim() || null,
    district: input.district?.trim() || null,
    address: input.address?.trim() || null,
    gpsAddress: input.gpsAddress?.trim() || null,
    phone: input.phone?.trim() || null,
    email: input.email?.trim().toLowerCase() || null,
    managerName: input.managerName?.trim() || null,
    capacity,
    equipment,
    status,
    updatedAt: new Date(),
  } as const;

  if (input.id) {
    const [before] = await db.select().from(locations).where(eq(locations.id, input.id));
    if (!before) throw new Error("Station not found");
    await db.update(locations).set(values).where(eq(locations.id, input.id));
    await logAudit({
      userId: user.id,
      userName: user.name,
      action: "update",
      entityType: "location",
      entityId: input.id,
      entityLabel: name,
      summary: `Updated inspection station ${name}`,
      before,
      after: values,
    });
  } else {
    const id = newId();
    await db.insert(locations).values({ id, ...values });
    await logAudit({
      userId: user.id,
      userName: user.name,
      action: "create",
      entityType: "location",
      entityId: id,
      entityLabel: name,
      summary: `Created inspection station ${name}`,
      after: values,
    });
  }

  revalidatePath("/locations");
  return { ok: true };
}
