import { isStaff } from '@/lib/role';
import { EmptyState } from './ui';

// Wrap staff-only pages. Real access control comes with real auth in the full build.
export async function StaffOnly({ children }: { children: React.ReactNode }) {
  if (await isStaff()) return <>{children}</>;
  return <EmptyState>This screen is not available to the Employee role. Switch role to continue.</EmptyState>;
}
