// Mirrors the mobile app's own PlaceholderPanel naming/spirit — reachable from the
// sidebar so the navigation itself is complete, but with no data wiring. See the plan's
// §1.3 for why each of these six routes is static this phase.
export function StaticPlaceholder({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-zinc-300 py-24 text-center dark:border-zinc-700">
      <span className="text-4xl">{icon}</span>
      <h1 className="text-xl font-bold">{title}</h1>
      <p className="max-w-sm text-sm text-zinc-500">{description}</p>
      <span className="rounded-full bg-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
        Coming soon
      </span>
    </div>
  );
}
