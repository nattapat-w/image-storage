"use client";

import { AuthGate } from "@/components/AuthGate";
import { DriveBrowser } from "@/components/DriveBrowser";

export default function DashboardPage() {
  return (
    <AuthGate>
      <DriveBrowser />
    </AuthGate>
  );
}
