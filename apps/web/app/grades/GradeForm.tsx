import { ActionForm } from '@/components/ActionForm';
import { TextField } from '@/components/FormFields';
import type { ActionResult } from '@/lib/form';

export function GradeForm({
  action, initial,
}: {
  action: (fd: FormData) => Promise<ActionResult>;
  initial?: { code: string; name: string };
}) {
  return (
    <ActionForm action={action} submitLabel={initial ? 'Save changes' : 'Add pay grade'} cancelHref="/grades">
      <div className="grid max-w-xl gap-4">
        <TextField label="Code" name="code" required defaultValue={initial?.code} />
        <TextField label="Name" name="name" required defaultValue={initial?.name}
          hint="Placeholder until the client confirms the real grades." />
      </div>
    </ActionForm>
  );
}
