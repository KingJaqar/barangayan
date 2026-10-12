export function AdminPageHeader({ title, description }: { title: string; description: string }) {
  return <div className="mb-8">
    <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-[var(--ab-text)]">{title}</h1>
    <p className="ab-muted mt-1 text-[15px]">{description}</p>
  </div>;
}
