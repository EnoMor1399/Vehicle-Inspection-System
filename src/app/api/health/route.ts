import { db } from "@/db";
import { sql } from "drizzle-orm";
import { users, vehicles, inspections } from "@/db/schema";
import { count } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const startTime = Date.now();
  
  try {
    // Database connectivity check
    await db.execute(sql`select 1`);
    
    // Get basic system metrics
    const [userCount] = await db.select({ count: count() }).from(users);
    const [vehicleCount] = await db.select({ count: count() }).from(vehicles);
    const [inspectionCount] = await db.select({ count: count() }).from(inspections);
    
    const responseTime = Date.now() - startTime;
    
    const healthData = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION || "1.0.0",
      environment: process.env.NODE_ENV || "development",
      uptime: process.uptime(),
      responseTime: `${responseTime}ms`,
      services: {
        database: {
          status: "connected",
          responseTime: `${responseTime}ms`,
        },
        api: {
          status: "operational",
        },
      },
      metrics: {
        totalUsers: userCount?.count || 0,
        totalVehicles: vehicleCount?.count || 0,
        totalInspections: inspectionCount?.count || 0,
      },
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        memoryUsage: {
          rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`,
          heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
          heapTotal: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`,
        },
      },
    };
    
    return Response.json(healthData);
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    return Response.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        responseTime: `${responseTime}ms`,
        error: "Database connection failed",
        services: {
          database: {
            status: "disconnected",
            error: error instanceof Error ? error.message : "Unknown error",
          },
        },
      },
      { status: 500 }
    );
  }
}
