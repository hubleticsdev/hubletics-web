import Link from 'next/link';
import { AuthenticatedNavbar } from '@/components/layout/AuthenticatedNavbar';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <AuthenticatedNavbar />
      <div className="flex">
        {/* Admin Sidebar */}
        <aside className="w-64 bg-white border-r border-gray-200 min-h-screen pt-20">
          <nav className="p-4 space-y-2">
            <Link
              href="/admin"
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Dashboard
            </Link>
            <Link
              href="/admin/coaches/pending"
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Pending Coaches
            </Link>
            <Link
              href="/admin/users"
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Users
            </Link>
            <Link
              href="/admin/bookings"
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Bookings
            </Link>
            <Link
              href="/admin/disputes"
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Disputes
            </Link>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8 pt-24">{children}</main>
      </div>
    </div>
  );
}

