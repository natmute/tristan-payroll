'use server';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { ROLES, type Role } from '@/lib/role';

export async function setRole(formData: FormData) {
  const role = String(formData.get('role'));
  if (!ROLES.includes(role as Role)) return;
  (await cookies()).set('demo_role', role, { path: '/', sameSite: 'lax' });
  revalidatePath('/', 'layout');
}
