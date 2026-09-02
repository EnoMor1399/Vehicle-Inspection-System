import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).optional();
const optionalEmail = z.union([z.literal(""), z.string().trim().max(200).email()]).optional();
const optionalDate = z.union([
  z.literal(""),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must use YYYY-MM-DD").refine(
    (value) => !Number.isNaN(new Date(`${value}T12:00:00Z`).getTime()),
    "Date is invalid"
  ),
]).optional();

const optionalWholeNumber = (min: number, max: number, label: string) => z.union([
  z.literal(""),
  z.string().trim().regex(/^\d+$/, `${label} must be a whole number`).refine((value) => {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed >= min && parsed <= max;
  }, `${label} must be between ${min} and ${max}`),
]).optional();

const optionalDecimal = (min: number, max: number, label: string) => z.union([
  z.literal(""),
  z.string().trim().regex(/^\d+(?:\.\d{1,2})?$/, `${label} must be a number with up to 2 decimal places`).refine((value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= min && parsed <= max;
  }, `${label} must be between ${min} and ${max}`),
]).optional();

export const vehicleAdminSchema = z.object({
  transporterId: z.union([z.string().uuid(), z.literal(""), z.null()]).optional(),
  registrationNumber: z.string().trim().min(2).max(50),
  oldRegistrationNumber: optionalText(50),
  make: z.string().trim().min(1).max(100),
  model: optionalText(100),
  variant: optionalText(100),
  bodyType: optionalText(50),
  category: optionalText(50),
  vehicleClass: optionalText(50),
  colour: optionalText(50),
  manufacturingYear: optionalWholeNumber(1886, new Date().getFullYear() + 1, "Manufacturing year"),
  countryOfManufacture: optionalText(100),
  engineNumber: optionalText(100),
  chassisNumber: optionalText(100),
  vin: optionalText(50),
  fuelType: z.enum(["petrol", "diesel", "electric", "hybrid", "cng", "lpg", ""]).optional(),
  transmission: z.enum(["manual", "automatic", "cvt", "semi-automatic", ""]).optional(),
  engineCapacity: optionalWholeNumber(0, 100_000, "Engine capacity"),
  seatingCapacity: optionalWholeNumber(0, 500, "Seating capacity"),
  grossWeight: optionalDecimal(0, 100_000_000, "Gross weight"),
  netWeight: optionalDecimal(0, 100_000_000, "Net weight"),
  numberOfAxles: optionalWholeNumber(1, 20, "Number of axles"),
  odometerReading: optionalWholeNumber(0, 20_000_000, "Odometer reading"),
  ownerName: optionalText(200),
  ownerContact: optionalText(100),
  insuranceCompany: optionalText(200),
  policyNumber: optionalText(100),
  insuranceExpiry: optionalDate,
  roadworthyExpiry: optionalDate,
  roadFundExpiry: optionalDate,
  status: z.enum(["active", "under_inspection", "failed", "passed", "suspended", "decommissioned"]).optional(),
}).strict();

export const transporterAdminSchema = z.object({
  companyName: z.string().trim().min(2).max(255),
  registrationNumber: optionalText(100),
  tinNumber: optionalText(100),
  gpsAddress: optionalText(100),
  contactPerson: optionalText(200),
  mobile: optionalText(50),
  email: optionalEmail,
  physicalAddress: optionalText(2000),
  region: optionalText(100),
  district: optionalText(100),
  insuranceCompany: optionalText(200),
  insuranceExpiry: optionalDate,
}).strict();

export const stationAdminSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(200),
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9][A-Z0-9_-]{1,19}$/, "Station code must be 2-20 characters using letters, numbers, hyphens, or underscores"),
  region: optionalText(100),
  district: optionalText(100),
  address: optionalText(2000),
  gpsAddress: optionalText(100),
  phone: optionalText(50),
  email: optionalEmail,
  managerName: optionalText(200),
  capacity: z.number().int().min(0).max(10_000).nullable().optional(),
  equipment: z.array(z.string().trim().min(1).max(200)).max(50).optional(),
  status: z.enum(["active", "inactive", "maintenance"]).optional(),
}).strict();

export function adminValidationMessage(error: z.ZodError): string {
  const first = error.issues[0];
  if (!first) return "Invalid administrative input";
  const field = first.path.join(".");
  return field ? `${field}: ${first.message}` : first.message;
}
