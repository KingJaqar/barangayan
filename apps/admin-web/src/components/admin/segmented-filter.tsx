'use client';

export function SegmentedFilter({ label, options, value, onChange, disabled = false }: {
  label: string; options: readonly { value: string; label: string }[];
  value: string; onChange: (value: string) => void; disabled?: boolean;
}) {
  return <div role="group" aria-label={label} className="table-browse-segments">
    {options.map(option => <button type="button" key={option.value} aria-pressed={value === option.value}
      disabled={disabled} onClick={() => onChange(option.value)}>{option.label}</button>)}
  </div>;
}
