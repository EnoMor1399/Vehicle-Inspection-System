import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { sql } from "drizzle-orm";
import { AuthForm } from "./AuthForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // Check if any users exist; if not, suggest seeding first
  const [userCount] = await db.select({ n: sql<number>`count(*)::int` }).from(users);
  const hasUsers = (userCount?.n || 0) > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-0 bg-white rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl max-h-[95vh] sm:max-h-none overflow-y-auto lg:overflow-y-visible">
        {/* Left - Branding */}
        <div className="relative bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 sm:p-8 lg:p-12 flex flex-col justify-between min-h-[200px] sm:min-h-[300px] lg:min-h-[640px]">
          <div className="absolute inset-0 opacity-10" style={{
            backgroundImage: "radial-gradient(circle at 20% 30%, rgba(3,151,3,0.7) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(2,107,2,0.5) 0%, transparent 50%)"
          }} />
          <div className="relative z-10">
            <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6 lg:mb-8">
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl grid place-items-center shadow-lg" style={{ background: "linear-gradient(135deg, #039703, #026b02)" }}>
                <svg className="h-6 w-6 sm:h-7 sm:w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
                </svg>
              </div>
              <div>
                <p className="text-base sm:text-lg font-bold">Road Safety Limited</p>
                <p className="text-xs text-slate-300">Vehicle Inspection Management System</p>
              </div>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight">
              Enterprise-grade<br />
              <span className="bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(90deg, #039703, #026b02)" }}>
                vehicle inspection
              </span><br />
              management
            </h1>
          </div>
        </div>

        {/* Right - Auth Form */}
        <div className="p-5 sm:p-6 md:p-8 lg:p-12 flex flex-col justify-center">
          <AuthForm hasUsers={hasUsers} showDemoAccounts={process.env.NODE_ENV !== "production"} />
        </div>
      </div>
    </div>
  );
}
