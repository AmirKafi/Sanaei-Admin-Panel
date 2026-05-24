import { AdminSidebar } from "@/components/admin-sidebar"
import { AutoSyncProvider } from "@/components/auto-sync-provider"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AutoSyncProvider>
      <div className="flex min-h-screen">
        <AdminSidebar />
        <main className="flex-1 lg:pl-64">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </AutoSyncProvider>
  )
}
