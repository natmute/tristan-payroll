import { withDefaults } from '@tristan/payroll-engine';
import { isAdmin } from '@/lib/role';
import { ukDate } from '@/lib/format';
import { describeChanges, loadVersions } from '@/lib/settings';
import { StaffOnly } from '@/components/StaffOnly';
import { ActionForm } from '@/components/ActionForm';
import { TextField } from '@/components/FormFields';
import { Card, Chip, ErrorBox, PageTitle, Td, Th } from '@/components/ui';
import { SettingsFields } from './SettingsFields';
import { saveSettings } from './actions';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  let versions;
  try {
    versions = await loadVersions();
  } catch (e) {
    return <ErrorBox message={(e as Error).message} />;
  }
  if (versions.length === 0) return <ErrorBox message="No settings versions found. Run supabase/seed.sql." />;

  const admin = await isAdmin();
  const today = new Date().toISOString().slice(0, 10);
  const latest = withDefaults(versions[0].settings);
  const inForce = versions.find((v) => v.effective_from <= today);

  // History oldest to newest, so each row can say what it changed from the one before.
  const byCreated = [...versions].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const changesOf = new Map(byCreated.map((v, i) => [
    v.id, i === 0 ? ['Initial settings'] : describeChanges(withDefaults(byCreated[i - 1].settings), withDefaults(v.settings)),
  ]));

  return (
    <StaffOnly>
      <PageTitle
        title="Tax & Deduction Settings"
        subtitle="Rates and fees used to calculate pay. Changes apply to runs with a pay date on or after the effective date. Earlier and finalised runs are never altered."
      />
      {!admin && (
        <p className="mb-4 rounded border border-slate-300 bg-slate-100 p-3 text-sm text-slate-700">View only. An Administrator can change settings.</p>
      )}
      {versions[0].effective_from > today && (
        <p className="mb-4 rounded border border-primary-200 bg-primary-50 p-3 text-sm text-primary-900">
          A change is waiting to start on {ukDate(versions[0].effective_from)}. The values below include it.
        </p>
      )}

      {admin ? (
        <ActionForm action={saveSettings} submitLabel="Save as a new version">
          <SettingsFields s={latest} />
          <Card className="mt-4">
            <h3 className="mb-3 text-base font-semibold text-primary-900">Save this change</h3>
            <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
              <TextField label="Effective from" name="effective_from" type="date" required defaultValue={today}
                hint="Runs with a pay date on or after this date use the new values." />
              <TextField label="Reason for the change" name="reason" required placeholder="For example: budget 2027 rate change" />
            </div>
          </Card>
        </ActionForm>
      ) : (
        <fieldset disabled className="opacity-90"><SettingsFields s={latest} /></fieldset>
      )}

      <section className="mt-8" aria-labelledby="history">
        <h2 id="history" className="mb-3 text-lg font-semibold text-primary-900">Change history</h2>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead><tr><Th>Effective from</Th><Th>Status</Th><Th>Saved by</Th><Th>Reason</Th><Th>What changed</Th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {versions.map((v) => (
                <tr key={v.id} className="align-top">
                  <Td>{v.effective_from === '2020-01-01' ? 'Start' : ukDate(v.effective_from)}</Td>
                  <Td>{v.effective_from > today ? <Chip tone="blue">Upcoming</Chip> : v.id === inForce?.id ? <Chip tone="green">In force</Chip> : <Chip>Superseded</Chip>}</Td>
                  <Td>{v.created_by}<span className="block text-xs text-slate-500">{ukDate(v.created_at.slice(0, 10))}</span></Td>
                  <Td>{v.reason}</Td>
                  <Td><ul className="list-disc pl-4">{(changesOf.get(v.id) ?? []).map((c) => <li key={c}>{c}</li>)}</ul></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </StaffOnly>
  );
}
