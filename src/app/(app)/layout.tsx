import { AuthenticatedNavbar } from '@/components/layout/AuthenticatedNavbar';
import { Footer } from '@/components/layout/Footer';

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <AuthenticatedNavbar />
      {children}
      <Footer />
    </>
  );
}

