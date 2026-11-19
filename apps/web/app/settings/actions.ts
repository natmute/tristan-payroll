'use server';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/supabase';
import { actor, logAction } from '@/lib/audit';
import { requireRole } from '@/lib/role';
import { FormError, isoDate, required, run, type ActionResult } from '@/lib/form';
import { applyForm, describeChanges, loadVersions } from '@/lib/settings';
import { withDefaults } from '@tristan/payroll-engine';

// Saving never edits an old version. It adds a new one, effective from a date, with a reason.
// Runs already finalised keep the copy of the settings they used.
export async function saveSettings(fd: FormData): Promise<ActionResult> {
  const result = await run(async () => {
    await requireRole(['admin']);
    const effectiveFrom = isoDate(required(fd, 'effective_from', 'Effective from'), 'Effective from');
    const reason = required(fd, 'reason', 'Reason for the change');

    const today = new Date().toISOString().slice(0, 10);
    if (effectiveFrom < today) throw new FormError('A change cannot start in the past. Pick today or a later date.');

    const versions = await loadVersions();
    const latest = versions[0];
    if (latest && effectiveFrom < latest.effective_from) {
      throw new FormError(`A change is already set to start on ${latest.effective_from}. Choose that date or later.`);
    }
    const base = withDefaults(latest.settings);
    const next = applyForm(base, fd);
    const changes = describeChanges(base, next);
    if (changes.length === 0) throw new FormError('Nothing was changed.');

    const who = await actor();
    const { data, error } = await db().from('settings_versions')
      .insert({ effective_from: effectiveFrom, settings: next, reason, created_by: who.name }).select('id').single();
    if (error) throw new FormError(`Could not save: ${error.message}`);
    await logAction('settings.update', 'settings_version', data.id, { effective_from: effectiveFrom, reason, changes });
  });
  if (result) return result;
  revalidatePath('/settings');
  revalidatePath('/');
}
