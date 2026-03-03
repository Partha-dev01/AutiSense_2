"use client";

import { useEffect } from "react";
import { useAuth } from "./useAuth";

/**
 * Client-side auth guard for protected pages.
 * Redirects to /auth/login if the user is not authenticated.
 * Returns { loading, isAuthenticated } so the page can show a loading state.
 */
export function useAuthGuard() {
  const { user, loading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      const returnTo = encodeURIComponent(window.location.pathname);
      window.location.href = `/auth/login?returnTo=${returnTo}`;
    }
  }, [loading, isAuthenticated]);

  return { loading, isAuthenticated, user };
}
