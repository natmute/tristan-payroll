import { isAdmin } from '@/lib/role';
import { EmptyState } from './ui';

// Wrap screens only administrators may use (the payroll officer role can view but not edit these).
export async function AdminOnly({ children }: { children: React.ReactNode }) {
  if (await isAdmin()) return <>{children}</>;
  return <EmptyState>Only an Administrator can change this. Switch role to continue.</EmptyState>;
}
