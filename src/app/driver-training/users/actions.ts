"use server";

import { revalidatePath } from "next/cache";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { trainingInstructorProfiles } from "@/db/training-readiness-schema";
import { getCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { hashPassword, validateEmail, validatePasswordStrength } from "@/lib/password";
import { canCreateDriverTrainingUsers } from "@/lib/training-access";
import {
  DRIVER_TRAINING_ACCESS_KEY,
  VEHICLE_INSPECTION_ACCESS_KEY,
} from "@/lib/system-access";
import { isUserRole } from "@/lib/user-access-policy";
import { newId } from "@/lib/utils";

const TRAINING_ACCOUNT_ROLES = new Set([
  "admin",
  "operations_manager",
  "supervisor",
  "inspector",
  "data_entry",
  "auditor",
  "compliance_officer",
  "viewer",
]);

const TRAINING_MANAGE_ROLES = new Set([
  "admin",
  "operations_manager",
  "supervisor",
  "inspector",
  "data_entry",
]);

const TRAINING_REVIEW_ROLES = new Set([
  "admin",
  "operations_manager",
  "supervisor",
]);

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function parseSpecialties(value: string) {
  return Array.from(new Set(
    value
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean)
  )).slice(0, 30);
}

function permissionsForTrainingRole(role: string): Record<string, boolean> {
  return {
    [VEHICLE_INSPECTION_ACCESS_KEY]: false,
    [DRIVER_TRAINING_ACCESS_KEY]: true,
    training_manage: TRAINING_MANAGE_ROLES.has(role),
    training_assessment_review: TRAINING_REVIEW_ROLES.has(role),
  };
}

export async function createDriverTrainingUser(formData: FormData) {
  const actor = await getCurrentUser();
  if (!canCreateDriverTrainingUsers(actor)) {
    throw new Error("Only a Super Administrator or Administrator assigned to Driver Training can create Driver Training accounts");
  }

  const name = normalizeName(field(formData, "name"));
  const email = field(formData, "email").trim().toLowerCase();
  const phone = field(formData, "phone").trim();
  const role = field(formData, "role").trim();
  const password = field(formData, "password");
  const specialties = parseSpecialties(field(formData, "specialties"));

  if (name.length < 2 || name.length > 200) {
    throw new Error("Enter a valid full name between 2 and 200 characters");
  }
  if (!validateEmail(email) || email.length > 200) {
    throw new Error("Enter a valid email address");
  }
  if (phone.length > 50) {
    throw new Error("Phone number must not exceed 50 characters");
  }
  if (!isUserRole(role) || !TRAINING_ACCOUNT_ROLES.has(role)) {
    throw new Error("Select a valid Driver Training account function");
  }
  if (actor.role !== "super_admin" && role === "admin") {
    throw new Error("Only a Super Administrator can create an Administrator account");
  }

  const passwordValidation = validatePasswordStrength(password);
  if (!passwordValidation.valid) {
    throw new Error(passwordValidation.errors[0] || "The initial password does not meet the password policy");
  }

  const passwordHash = await hashPassword(password);
  const accountId = newId();
  const createInstructorProfile = role === "inspector";
  const permissions = permissionsForTrainingRole(role);

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${email}))`);

    const [existing] = await tx
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.email}) = ${email}`)
      .limit(1);
    if (existing) {
      throw new Error("An account with this email address already exists");
    }

    const [account] = await tx
      .insert(users)
      .values({
        id: accountId,
        name,
        email,
        phone: phone || null,
        role,
        passwordHash,
        permissions,
        isActive: true,
        locationId: null,
        transporterId: null,
      })
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        phone: users.phone,
        permissions: users.permissions,
        isActive: users.isActive,
        createdAt: users.createdAt,
      });

    if (!account) {
      throw new Error("Driver Training account creation did not complete");
    }

    let instructorProfile: typeof trainingInstructorProfiles.$inferSelect | null = null;
    if (createInstructorProfile) {
      const profileId = newId();
      const instructorCode = `DTI-${new Date().getUTCFullYear()}-${profileId.slice(0, 8).toUpperCase()}`;
      [instructorProfile] = await tx
        .insert(trainingInstructorProfiles)
        .values({
          id: profileId,
          userId: account.id,
          instructorCode,
          status: "active",
          specialties,
          createdBy: actor.id,
        })
        .returning();
    }

    return { account, instructorProfile };
  });

  await logAudit({
    userId: actor.id,
    userName: actor.name,
    action: "create",
    entityType: "user",
    entityId: result.account.id,
    entityLabel: result.account.email,
    summary: `Created Driver Training account for ${result.account.name}`,
    after: {
      id: result.account.id,
      name: result.account.name,
      email: result.account.email,
      phone: result.account.phone,
      role: result.account.role,
      permissions: result.account.permissions,
      isActive: result.account.isActive,
      instructorProfileId: result.instructorProfile?.id || null,
      instructorCode: result.instructorProfile?.instructorCode || null,
    },
  });

  revalidatePath("/driver-training");
  revalidatePath("/driver-training/users");
  revalidatePath("/driver-training/instructors");
  revalidatePath("/driver-training/sessions");
  revalidatePath("/users");

  return { ok: true, userId: result.account.id };
}
