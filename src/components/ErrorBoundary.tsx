"use client";

import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);

    // Error reporting is best effort and must never block recovery UI.
    void this.logErrorToService(error, errorInfo);
  }

  private async logErrorToService(error: Error, errorInfo: ErrorInfo) {
    try {
      if (process.env.NODE_ENV === "production") {
        await fetch("/api/errors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: error.message,
            stack: error.stack,
            componentStack: errorInfo.componentStack,
            timestamp: new Date().toISOString(),
            url: window.location.href,
          }),
          keepalive: true,
        });
      }
    } catch (loggingError) {
      console.error("Failed to log error:", loggingError);
    }
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
          <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                <svg
                  className="h-5 w-5 text-red-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Something went wrong</h2>
                <p className="text-sm text-slate-600">An unexpected error occurred</p>
              </div>
            </div>

            {process.env.NODE_ENV === "development" && this.state.error && (
              <div className="mb-4 p-3 bg-red-50 rounded-lg border border-red-200">
                <p className="text-sm font-medium text-red-900 mb-1">Error Details:</p>
                <p className="text-xs text-red-700 font-mono break-all">
                  {this.state.error.message}
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="flex-1 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors text-sm font-medium"
              >
                Reload Page
              </button>
              <a
                href="/"
                className="flex-1 px-4 py-2 bg-slate-100 text-slate-900 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium text-center"
              >
                Go Home
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
