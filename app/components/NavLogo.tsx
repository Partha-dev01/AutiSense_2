"use client";

import Link from "next/link";
import { useAuth } from "../hooks/useAuth";

export default function NavLogo() {
  const { isAuthenticated } = useAuth();

  return (
    <Link href={isAuthenticated ? "/kid-dashboard" : "/"} className="logo">
      <img src="/logo.svg" alt="" className="logo-icon" />
      Auti<em>Sense</em>
    </Link>
  );
}
