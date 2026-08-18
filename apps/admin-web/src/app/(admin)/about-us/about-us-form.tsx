'use client';

import { aboutUsSchema, type DeveloperProfile, type Tables } from '@barangayan/shared';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';

import { useToast } from '@/components/ui/toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type AboutUsRow = Tables<'about_us'>;
type DeveloperProfileRow = Tables<'developer_profiles'>;

const inputClass =
  'w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[var(--accent)] dark:border-zinc-700 dark:bg-zinc-800';

function getExtension(filename: string): string {
  const idx = filename.lastIndexOf('.');
  return idx >= 0 ? filename.slice(idx) : '';
}

/** Extracts the storage object path from a public URL for the site-content bucket. */
function extractStoragePath(publicUrl: string): string | null {
  const marker = '/object/public/site-content/';
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(publicUrl.slice(idx + marker.length));
}

interface DeveloperDraft {
  key: string;
  name: string;
  role: string;
  bio: string;
  photo_url: string;
  photoFile: File | null;
  photoPreview: string | null;
}

function rowsToDrafts(rows: DeveloperProfileRow[]): DeveloperDraft[] {
  return rows.map((r) => ({
    key: r.id,
    name: r.name,
    role: r.role,
    bio: r.bio,
    photo_url: r.photo_url ?? '',
    photoFile: null,
    photoPreview: null,
  }));
}

export function AboutUsForm({
  barangayId,
  initialAbout,
  initialDevelopers,
}: {
  barangayId: string;
  initialAbout: AboutUsRow | null;
  initialDevelopers: DeveloperProfileRow[];
}) {
  const router = useRouter();
  const toast = useToast();

  const [mission, setMission] = useState(initialAbout?.mission ?? '');
  const [vision, setVision] = useState(initialAbout?.vision ?? '');
  const [history, setHistory] = useState(initialAbout?.history ?? '');
  const [contactEmail, setContactEmail] = useState(initialAbout?.contact_email ?? '');
  const [contactPhone, setContactPhone] = useState(initialAbout?.contact_phone ?? '');
  const [address, setAddress] = useState(initialAbout?.address ?? '');
  const [logoUrl, setLogoUrl] = useState(initialAbout?.logo_url ?? '');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(initialAbout?.is_active ?? true);
  const [developers, setDevelopers] = useState<DeveloperDraft[]>(rowsToDrafts(initialDevelopers));
  const [showPreview, setShowPreview] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    if (!barangayId) return;
    const supabase = createSupabaseBrowserClient();
    const channelName = `admin-about-us:${barangayId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'about_us', filter: `barangay_id=eq.${barangayId}` },
        () => router.refresh(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'developer_profiles', filter: `barangay_id=eq.${barangayId}` },
        () => router.refresh(),
      )
      .subscribe((status) => setIsLive(status === 'SUBSCRIBED'));

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router, barangayId]);

  function addDeveloper() {
    setDevelopers((list) => [
      ...list,
      { key: `new-${Date.now()}`, name: '', role: '', bio: '', photo_url: '', photoFile: null, photoPreview: null },
    ]);
  }

  function updateDeveloper(key: string, patch: Partial<DeveloperDraft>) {
    setDevelopers((list) => list.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  }

  function removeDeveloper(key: string) {
    setDevelopers((list) => list.filter((d) => d.key !== key));
  }

  function handleLogoPick(file: File | null) {
    setLogoFile(file);
    setLogoPreview(file ? URL.createObjectURL(file) : null);
  }

  function handleDeveloperPhotoPick(key: string, file: File | null) {
    updateDeveloper(key, { photoFile: file, photoPreview: file ? URL.createObjectURL(file) : null });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const parsed = aboutUsSchema.safeParse({
      mission,
      vision,
      history,
      contact_email: contactEmail,
      contact_phone: contactPhone,
      address,
      logo_url: logoUrl,
      is_active: isActive,
      sort_order: 0,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid input');
      return;
    }

    for (const dev of developers) {
      const check = { name: dev.name, role: dev.role, bio: dev.bio, photo_url: dev.photo_url };
      if (!check.name.trim() || !check.role.trim()) {
        setError('Every developer needs a name and role.');
        return;
      }
    }

    if (!barangayId) {
      setError('Missing barangay context.');
      return;
    }

    setSubmitting(true);
    const supabase = createSupabaseBrowserClient();
    const uploadedPaths: string[] = [];

    try {
      // 1. Upload logo first (if a new file was picked)
      let finalLogoUrl = parsed.data.logo_url || null;
      if (logoFile) {
        const ext = getExtension(logoFile.name);
        const path = `${barangayId}/logo${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('site-content')
          .upload(path, logoFile, { upsert: true, contentType: logoFile.type });
        if (uploadErr) {
          toast.showError(`Logo upload failed: ${uploadErr.message}`);
          setError(uploadErr.message);
          return;
        }
        uploadedPaths.push(path);
        finalLogoUrl = supabase.storage.from('site-content').getPublicUrl(path).data.publicUrl;
        setLogoUrl(finalLogoUrl);
      }

      // 2. Upload developer photos (if new files were picked)
      const developerPayload: DeveloperProfile[] = [];
      for (let i = 0; i < developers.length; i++) {
        const dev = developers[i]!;
        let photoUrl = dev.photo_url || undefined;
        if (dev.photoFile) {
          const ext = getExtension(dev.photoFile.name);
          const path = `${barangayId}/developers/${crypto.randomUUID()}${ext}`;
          const { error: uploadErr } = await supabase.storage
            .from('site-content')
            .upload(path, dev.photoFile, { upsert: true, contentType: dev.photoFile.type });
          if (uploadErr) {
            toast.showError(`Photo upload failed for ${dev.name || 'developer'}: ${uploadErr.message}`);
            setError(uploadErr.message);
            return;
          }
          uploadedPaths.push(path);
          photoUrl = supabase.storage.from('site-content').getPublicUrl(path).data.publicUrl;
        }
        developerPayload.push({
          name: dev.name,
          role: dev.role,
          bio: dev.bio,
          photo_url: photoUrl,
          sort_order: i,
        });
      }

      // 3. Atomic DB save via RPC
      const { error: rpcError } = await supabase.rpc('save_about_us_with_developers', {
        p_barangay_id: barangayId,
        p_mission: parsed.data.mission,
        p_vision: parsed.data.vision,
        p_history: parsed.data.history,
        p_contact_email: parsed.data.contact_email || '',
        p_contact_phone: parsed.data.contact_phone || '',
        p_address: parsed.data.address || '',
        p_logo_url: finalLogoUrl ?? '',
        p_developers: JSON.stringify(developerPayload),
        p_is_active: parsed.data.is_active,
        p_sort_order: 0,
      });

      if (rpcError) {
        // Roll back the freshly uploaded files since the DB write failed.
        if (uploadedPaths.length) {
          await supabase.storage.from('site-content').remove(uploadedPaths);
        }
        if (rpcError.code === '42501') {
          toast.showError('Permission denied. You must be an admin.');
        } else {
          toast.showError(`Save failed: ${rpcError.message}`);
        }
        setError(rpcError.message);
        return;
      }

      // 4. DB succeeded — now it's safe to delete replaced old assets.
      if (logoFile && initialAbout?.logo_url) {
        const oldPath = extractStoragePath(initialAbout.logo_url);
        if (oldPath) await supabase.storage.from('site-content').remove([oldPath]);
      }
      for (const dev of developers) {
        if (dev.photoFile && dev.photo_url) {
          const oldPath = extractStoragePath(dev.photo_url);
          if (oldPath) await supabase.storage.from('site-content').remove([oldPath]);
        }
      }
      // Photos belonging to removed developer rows.
      const keptIds = new Set(developers.map((d) => d.key));
      for (const original of initialDevelopers) {
        if (!keptIds.has(original.id) && original.photo_url) {
          const oldPath = extractStoragePath(original.photo_url);
          if (oldPath) await supabase.storage.from('site-content').remove([oldPath]);
        }
      }

      toast.showSuccess('Saved successfully.');
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
      toast.showError(message);
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="flex items-center justify-end gap-3">
        <div className="flex items-center gap-1.5">
          <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${isLive ? 'bg-green-500' : 'bg-zinc-300'}`}>
            {isLive && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />}
          </span>
          <span className="text-xs text-zinc-500">{isLive ? 'Live' : 'Offline'}</span>
        </div>
        <button
          type="button"
          onClick={() => setShowPreview((v) => !v)}
          className="text-xs font-semibold text-[var(--accent)] hover:underline">
          {showPreview ? 'Edit' : 'Preview'}
        </button>
      </div>

      {showPreview ? (
        <div className="prose prose-sm max-w-none rounded-xl border border-black/10 bg-white p-6 dark:prose-invert dark:border-white/10 dark:bg-zinc-900">
          {(logoPreview || logoUrl) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoPreview ?? logoUrl} alt="Barangay logo" className="mb-4 h-20 w-20 rounded-full object-cover" />
          )}
          <h2>Mission</h2>
          <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{mission}</ReactMarkdown>
          <h2>Vision</h2>
          <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{vision}</ReactMarkdown>
          <h2>History</h2>
          <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{history}</ReactMarkdown>
          <h2>Contact</h2>
          <p>
            {contactEmail} {contactPhone} {address}
          </p>
          <h2>Development Team</h2>
          <ul>
            {developers.map((d) => (
              <li key={d.key}>
                <strong>{d.name}</strong> — {d.role}
                {d.bio ? `: ${d.bio}` : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <>
          <section className="rounded-xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-zinc-900">
            <h2 className="mb-4 text-sm font-semibold text-zinc-600 dark:text-zinc-300">Barangay Profile</h2>
            <div className="mb-4 flex items-center gap-4">
              {(logoPreview || logoUrl) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoPreview ?? logoUrl} alt="Logo preview" className="h-16 w-16 rounded-full object-cover" />
              )}
              <label className="text-sm">
                <span className="mb-1 block font-medium">Logo</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={(e) => handleLogoPick(e.target.files?.[0] ?? null)}
                  className="text-sm"
                />
              </label>
            </div>

            <div className="flex flex-col gap-4">
              <label className="text-sm">
                <span className="mb-1 block font-medium">Mission (Markdown supported)</span>
                <textarea className={inputClass} value={mission} onChange={(e) => setMission(e.target.value)} rows={3} />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">Vision (Markdown supported)</span>
                <textarea className={inputClass} value={vision} onChange={(e) => setVision(e.target.value)} rows={3} />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">History (Markdown supported)</span>
                <textarea className={inputClass} value={history} onChange={(e) => setHistory(e.target.value)} rows={5} />
              </label>

              <div className="grid grid-cols-2 gap-4">
                <label className="text-sm">
                  <span className="mb-1 block font-medium">Contact Email</span>
                  <input className={inputClass} type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block font-medium">Contact Phone</span>
                  <input className={inputClass} value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
                </label>
              </div>

              <label className="text-sm">
                <span className="mb-1 block font-medium">Address</span>
                <input className={inputClass} value={address} onChange={(e) => setAddress(e.target.value)} />
              </label>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300"
                />
                <span className="font-medium">Published (visible to residents)</span>
              </label>
            </div>
          </section>

          <section className="rounded-xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-zinc-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">Development Team</h2>
              <button
                type="button"
                onClick={addDeveloper}
                className="rounded-full border border-[var(--accent)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                + Add Developer
              </button>
            </div>

            <div className="flex flex-col gap-4">
              {developers.map((dev) => (
                <div key={dev.key} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
                  <div className="mb-3 flex items-center gap-4">
                    {(dev.photoPreview || dev.photo_url) && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={dev.photoPreview ?? dev.photo_url}
                        alt={dev.name || 'Developer photo'}
                        className="h-12 w-12 rounded-full object-cover"
                      />
                    )}
                    <label className="text-sm">
                      <span className="mb-1 block font-medium">Photo</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp"
                        onChange={(e) => handleDeveloperPhotoPick(dev.key, e.target.files?.[0] ?? null)}
                        className="text-sm"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => removeDeveloper(dev.key)}
                      className="ml-auto text-xs font-semibold text-red-600 hover:underline">
                      Remove
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="text-sm">
                      <span className="mb-1 block font-medium">Name</span>
                      <input
                        className={inputClass}
                        value={dev.name}
                        onChange={(e) => updateDeveloper(dev.key, { name: e.target.value })}
                        required
                      />
                    </label>
                    <label className="text-sm">
                      <span className="mb-1 block font-medium">Role</span>
                      <input
                        className={inputClass}
                        value={dev.role}
                        onChange={(e) => updateDeveloper(dev.key, { role: e.target.value })}
                        required
                      />
                    </label>
                  </div>
                  <label className="mt-3 block text-sm">
                    <span className="mb-1 block font-medium">Bio</span>
                    <textarea
                      className={inputClass}
                      value={dev.bio}
                      onChange={(e) => updateDeveloper(dev.key, { bio: e.target.value })}
                      rows={2}
                    />
                  </label>
                </div>
              ))}
              {developers.length === 0 && (
                <p className="py-6 text-center text-sm text-zinc-500">No developers added yet.</p>
              )}
            </div>
          </section>
        </>
      )}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div>
        <button
          type="submit"
          disabled={submitting || !barangayId}
          className="rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {submitting ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}
