import Sidebar from "@/components/Sidebar";
import LockGate from "@/components/LockGate";

export default function InsLayout({ children }: { children: React.ReactNode }) {
  return (
    <LockGate>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-auto">
          <main className="flex-1 p-5">{children}</main>
        </div>
      </div>
    </LockGate>
  );
}
