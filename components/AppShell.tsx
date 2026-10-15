import Sidebar from "./Sidebar";
import ProtectedRoute from "./ProtectedRoute";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <div className="shell">
        <Sidebar />
        <main className="content">{children}</main>
      </div>
    </ProtectedRoute>
  );
}
