#!/usr/bin/env node

/**
 * Pre-flight Check Script
 * Validates system readiness before deployment
 */

import { db } from "@/db";
import { sql } from "drizzle-orm";
import { getEnv } from "@/lib/config";

const CHECKS = {
  passed: 0,
  failed: 0,
  warnings: 0,
};

function log(level: "pass" | "fail" | "warn", message: string) {
  const icons = {
    pass: "✅",
    fail: "❌",
    warn: "⚠️",
  };
  
  console.log(`${icons[level]} ${message}`);
  CHECKS[level === "pass" ? "passed" : level === "fail" ? "failed" : "warnings"]++;
}

async function checkDatabase() {
  console.log("\n📊 Database Checks");
  console.log("─".repeat(50));
  
  try {
    // Check connection
    await db.execute(sql`SELECT 1`);
    log("pass", "Database connection successful");
    
    // Check table count
    const tableCountResult = await db.execute(sql`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    const tableCount = Number((tableCountResult.rows[0] as any).count);
    if (tableCount > 0) {
      log("pass", `Database has ${tableCount} tables`);
    } else {
      log("fail", "Database has no tables - run migrations");
    }
    
    // Check for critical tables
    const criticalTables = ["users", "vehicles", "inspections", "transporters"];
    for (const table of criticalTables) {
      const existsResult = await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = ${table}
        )
      `);
      
      if ((existsResult.rows[0] as any).exists) {
        log("pass", `Table '${table}' exists`);
      } else {
        log("fail", `Critical table '${table}' is missing`);
      }
    }
  } catch (error) {
    log("fail", `Database check failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

async function checkEnvironment() {
  console.log("\n🔧 Environment Checks");
  console.log("─".repeat(50));
  
  try {
    const env = getEnv();
    log("pass", "Environment variables validated");
    
    if (env.NODE_ENV === "production") {
      log("pass", "Running in production mode");
      
      // Check for required production secrets
      const requiredSecrets = ["JWT_SECRET", "SESSION_SECRET", "CSRF_SECRET", "API_KEY_SALT", "FIELD_ENCRYPTION_KEY", "CERTIFICATE_SIGNING_SECRET"];
      for (const secret of requiredSecrets) {
        if (process.env[secret]) {
          log("pass", `${secret} is configured`);
        } else {
          log("fail", `${secret} is missing (required in production)`);
        }
      }
    } else {
      log("warn", `Running in ${env.NODE_ENV} mode`);
    }
    
    // Check database URL
    if (env.DATABASE_URL) {
      log("pass", "DATABASE_URL is configured");
    } else {
      log("fail", "DATABASE_URL is missing");
    }
  } catch (error) {
    log("fail", `Environment check failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

async function checkFileSystem() {
  console.log("\n📁 File System Checks");
  console.log("─".repeat(50));
  
  const fs = await import("fs/promises");
  const path = await import("path");
  
  // Check for required directories
  const requiredDirs = ["public", ".next"];
  for (const dir of requiredDirs) {
    try {
      await fs.access(path.default.join(process.cwd(), dir));
      log("pass", `Directory '${dir}' exists`);
    } catch {
      log("fail", `Directory '${dir}' is missing`);
    }
  }
  
  // Check for build output
  try {
    await fs.access(path.default.join(process.cwd(), ".next", "BUILD_ID"));
    log("pass", "Build output exists");
  } catch {
    log("fail", "Build output missing - run 'npm run build'");
  }
  
  // Check disk space (Unix only)
  if (process.platform !== "win32") {
    try {
      const { execSync } = await import("child_process");
      const output = execSync("df -k . | tail -1").toString();
      const parts = output.split(/\s+/);
      const available = parseInt(parts[3]);
      const availableMB = available / 1024;
      
      if (availableMB > 1024) {
        log("pass", `Disk space available: ${availableMB.toFixed(0)} MB`);
      } else if (availableMB > 512) {
        log("warn", `Low disk space: ${availableMB.toFixed(0)} MB`);
      } else {
        log("fail", `Critical disk space: ${availableMB.toFixed(0)} MB`);
      }
    } catch {
      log("warn", "Could not check disk space");
    }
  }
}

async function checkNetwork() {
  console.log("\n🌐 Network Checks");
  console.log("─".repeat(50));
  
  const env = getEnv();
  
  // Check if app URL is accessible
  if (env.NEXT_PUBLIC_APP_URL) {
    try {
      const response = await fetch(`${env.NEXT_PUBLIC_APP_URL}/api/health`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });
      
      if (response.ok) {
        log("pass", "Application health endpoint is accessible");
      } else {
        log("warn", `Health endpoint returned ${response.status}`);
      }
    } catch (error) {
      log("warn", `Could not reach application: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  } else {
    log("warn", "NEXT_PUBLIC_APP_URL not configured");
  }
}

async function checkSecurity() {
  console.log("\n🔒 Security Checks");
  console.log("─".repeat(50));
  
  const env = getEnv();
  
  // Check rate limiting configuration
  if (env.RATE_LIMIT_MAX_REQUESTS && env.RATE_LIMIT_WINDOW_MS) {
    log("pass", "Rate limiting is configured");
  } else {
    log("warn", "Rate limiting not configured");
  }
  
  // Check session timeout
  if (env.SESSION_TIMEOUT_MINUTES) {
    log("pass", `Session timeout: ${env.SESSION_TIMEOUT_MINUTES} minutes`);
  } else {
    log("warn", "Session timeout not configured");
  }
  
  // Check for HTTPS in production
  if (env.NODE_ENV === "production") {
    if (env.NEXT_PUBLIC_APP_URL?.startsWith("https://")) {
      log("pass", "HTTPS is configured");
    } else {
      log("fail", "HTTPS is required in production");
    }
  }
}

async function main() {
  console.log("🚀 VIMS Enterprise Pre-flight Checks");
  console.log("═".repeat(50));
  
  const startTime = Date.now();
  
  await checkEnvironment();
  await checkDatabase();
  await checkFileSystem();
  await checkNetwork();
  await checkSecurity();
  
  const duration = Date.now() - startTime;
  
  console.log("\n" + "═".repeat(50));
  console.log("📋 Summary");
  console.log("─".repeat(50));
  console.log(`✅ Passed: ${CHECKS.passed}`);
  console.log(`❌ Failed: ${CHECKS.failed}`);
  console.log(`⚠️  Warnings: ${CHECKS.warnings}`);
  console.log(`⏱️  Duration: ${duration}ms`);
  console.log("═".repeat(50));
  
  if (CHECKS.failed > 0) {
    console.log("\n❌ Pre-flight checks FAILED");
    console.log("Please fix the issues above before deploying.");
    process.exit(1);
  } else if (CHECKS.warnings > 0) {
    console.log("\n⚠️  Pre-flight checks PASSED with warnings");
    console.log("Review warnings before deploying to production.");
    process.exit(0);
  } else {
    console.log("\n✅ All pre-flight checks PASSED");
    console.log("System is ready for deployment!");
    process.exit(0);
  }
}

main().catch((error) => {
  console.error("❌ Pre-flight check script failed:", error);
  process.exit(1);
});
