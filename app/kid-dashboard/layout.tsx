"use client";

import BottomNav from "../components/BottomNav";

export default function KidDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ minHeight: "100vh", paddingBottom: 80 }}>
      {children}
      <BottomNav />
    </div>
  );
}
