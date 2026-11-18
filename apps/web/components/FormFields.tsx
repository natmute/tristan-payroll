const inputCls =
  'w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 read-only:bg-slate-100';

// The label, the control and the hint are siblings (not nested), so a screen reader
// announces just the label as the field's name and the hint as its description.
function Wrap({ label, id, required, hint, children }: { label: string; id: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div className="text-sm">
      <label htmlFor={id} className="mb-1 block text-slate-700">
        {label}{required && <span className="text-red-700" aria-hidden="true"> *</span>}
      </label>
      {children}
      {hint && <p id={`${id}-hint`} className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function TextField({
  label, name, id = name, defaultValue, required, type = 'text', hint, readOnly, placeholder, inputMode,
}: {
  label: string; name: string; id?: string; defaultValue?: string | null; required?: boolean; type?: string;
  hint?: string; readOnly?: boolean; placeholder?: string; inputMode?: 'decimal' | 'text';
}) {
  return (
    <Wrap label={label} id={id} required={required} hint={hint}>
      <input
        id={id} name={name} type={type} defaultValue={defaultValue ?? ''} required={required} readOnly={readOnly}
        placeholder={placeholder} inputMode={inputMode} aria-describedby={hint ? `${id}-hint` : undefined} className={inputCls}
      />
    </Wrap>
  );
}

export function SelectField({
  label, name, id = name, defaultValue, options, required, placeholder, hint,
}: {
  label: string; name: string; id?: string; defaultValue?: string | null; options: { value: string; label: string }[];
  required?: boolean; placeholder?: string; hint?: string;
}) {
  return (
    <Wrap label={label} id={id} required={required} hint={hint}>
      <select
        id={id} name={name} defaultValue={defaultValue ?? ''} required={required}
        aria-describedby={hint ? `${id}-hint` : undefined} className={inputCls}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </Wrap>
  );
}

export function CheckField({ label, name, id = name, defaultChecked, hint, required }: { label: string; name: string; id?: string; defaultChecked?: boolean; hint?: string; required?: boolean }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <input
        id={id} type="checkbox" name={name} defaultChecked={defaultChecked} required={required}
        aria-describedby={hint ? `${id}-hint` : undefined} className="mt-0.5 h-4 w-4 rounded border-slate-300"
      />
      <div>
        <label htmlFor={id} className="text-slate-800">{label}</label>
        {hint && <p id={`${id}-hint`} className="text-xs text-slate-500">{hint}</p>}
      </div>
    </div>
  );
}
