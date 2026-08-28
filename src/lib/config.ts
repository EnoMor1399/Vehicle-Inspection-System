import { z } from "zod";

// Environment variable validation schema
const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),
  DATABASE_POOL_SIZE: z.coerce.number().min(1).max(100).default(20),
  
  // Application
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  APP_VERSION: z.string().default("2.2.0"),
  
  // Authentication
  JWT_SECRET: z.string().min(32).optional(),
  SESSION_SECRET: z.string().min(32).optional(),
  CSRF_SECRET: z.string().min(32).optional(),
  
  // API Keys
  API_KEY_SALT: z.string().min(32).optional(),
  FIELD_ENCRYPTION_KEY: z.string().min(32).optional(),
  CERTIFICATE_SIGNING_SECRET: z.string().min(32).optional(),
  
  // Email (Optional)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().email().optional(),
  
  // Error Tracking (Optional)
  SENTRY_DSN: z.string().url().optional(),
  ERROR_TRACKING_WEBHOOK: z.string().url().optional(),
  
  // File Storage (Optional)
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  
  // Security
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().min(1).default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().min(1000).default(60000),
  SESSION_TIMEOUT_MINUTES: z.coerce.number().min(1).default(30),
  MAX_LOGIN_ATTEMPTS: z.coerce.number().min(1).default(5),
  ACCOUNT_LOCKOUT_MINUTES: z.coerce.number().min(1).default(15),
  PASSWORD_MIN_LENGTH: z.coerce.number().min(10).max(64).default(12),
  PASSWORD_BCRYPT_ROUNDS: z.coerce.number().min(10).max(14).default(12),
  REQUIRE_PRIVILEGED_2FA: z.coerce.boolean().default(false),
  ALLOWED_ORIGINS: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional().or(z.literal("")),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  
  // 2FA
  TWO_FACTOR_ISSUER: z.string().default("RSL VIMS"),
  
  // Logging
  LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info"),
  LOG_FORMAT: z.enum(["json", "text"]).default("json"),
});

export type Env = z.infer<typeof envSchema>;

// Validate environment variables
export function validateEnv(): Env {
  try {
    const env = envSchema.parse(process.env);
    
    // Additional validation for production
    if (env.NODE_ENV === "production") {
      const requiredInProduction = [
        "JWT_SECRET",
        "SESSION_SECRET",
        "CSRF_SECRET",
        "API_KEY_SALT",
        "FIELD_ENCRYPTION_KEY",
        "CERTIFICATE_SIGNING_SECRET",
      ];
      
      const missing = requiredInProduction.filter((key) => !process.env[key]);
      
      if (missing.length > 0) {
        throw new Error(
          `Missing required environment variables in production: ${missing.join(", ")}`
        );
      }
    }
    
    return env;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const formatted = error.issues.map((issue) => {
        const path = issue.path.join(".");
        return `  - ${path}: ${issue.message}`;
      });
      
      console.error("❌ Environment validation failed:");
      console.error(formatted.join("\n"));
      console.error("\nPlease check your .env file and ensure all required variables are set.");
      process.exit(1);
    }
    
    console.error("❌ Environment validation error:", error);
    process.exit(1);
  }
}

// Get validated environment
let validatedEnv: Env | null = null;

export function getEnv(): Env {
  if (!validatedEnv) {
    validatedEnv = validateEnv();
  }
  return validatedEnv;
}

// Helper function to check if running in production
export function isProduction(): boolean {
  return getEnv().NODE_ENV === "production";
}

// Helper function to check if running in development
export function isDevelopment(): boolean {
  return getEnv().NODE_ENV === "development";
}

// Helper function to check if running in test
export function isTest(): boolean {
  return getEnv().NODE_ENV === "test";
}
