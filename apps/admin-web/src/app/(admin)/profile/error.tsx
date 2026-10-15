'use client';
export default function ProfileError({ retry }: { retry: () => void }) {
  return <section className="rounded-2xl border bg-white p-6 dark:bg-zinc-900"><h1 className="text-xl font-semibold">Admin profile unavailable</h1><p role="alert" className="my-4">Your profile could not be loaded. Retry to check your current access.</p><button className="rounded-lg border px-4 py-3" onClick={retry}>Retry profile</button></section>;
}
