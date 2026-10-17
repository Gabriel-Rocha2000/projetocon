"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import ProtectedRoute from "./ProtectedRoute";
import DeveloperGate from "./DeveloperGate";
import { STUDY_RETURN_KEY } from "@/lib/developerMode";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const developer = pathname.startsWith("/desenvolvedor");
  useEffect(() => {
    if (!developer && pathname !== "/configuracoes" && pathname !== "/login") {
      sessionStorage.setItem(STUDY_RETURN_KEY, pathname);
    }
  }, [developer, pathname]);
  return <ProtectedRoute>
    <div className={`shell ${developer ? "developerShell" : "studyShell"}`}>
      <Sidebar />
      <main className="content">{developer ? <DeveloperGate>{children}</DeveloperGate> : children}</main>
    </div>
  </ProtectedRoute>;
}
