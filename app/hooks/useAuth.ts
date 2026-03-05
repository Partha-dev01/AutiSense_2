/**
 * useAuth — Client-side authentication hook.
 *
 * Reads auth state from the shared AuthProvider context.
 * No per-page session fetches — auth state is shared app-wide.
 *
 * @example
 *   const { user, loading, isAuthenticated } = useAuth();
 */
"use client";

import { useContext } from "react";
import { AuthContext, type AuthContextValue } from "../contexts/AuthContext";

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
