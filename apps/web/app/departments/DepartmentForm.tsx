import { ActionForm } from '@/components/ActionForm';
import { SelectField, TextField } from '@/components/FormFields';
import { CATEGORY_LABELS } from '@/lib/format';
import type { ActionResult } from '@/lib/form';

export function DepartmentForm({
  action, initial,
}: {
  action: (fd: FormData) => Promise<ActionResult>;
  initial?: { code: string; name: string; category: string };
}) {
  return (
    <ActionForm action={action} submitLabel={initial ? 'Save changes' : 'Add department'} cancelHref="/departments">
      <div className="grid max-w-xl gap-4">
        <TextField label="Name" name="name" required defaultValue={initial?.name} />
        {/* TODO(client): real department codes are awaited from Paul. Use placeholders until then. */}
        <TextField label="Code" name="code" required defaultValue={initial?.code}
          hint="Placeholder until the client confirms the real department codes." />
        <SelectField label="Category" name="category" required defaultValue={initial?.category ?? 'government'}
          hint="The pay cycle belongs to the category."
          options={Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }))} />
      </div>
    </ActionForm>
  );
}
