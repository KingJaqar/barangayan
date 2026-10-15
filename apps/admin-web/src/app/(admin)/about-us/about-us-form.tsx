'use client';

import { aboutUsSchema, type DeveloperProfile, type Tables } from '@barangayan/shared';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import { Building2, Eye, Pencil, Plus, Save, Users } from 'lucide-react';
import styles from './about-us.module.css';

import { logAdminAction } from '@/actions/admin-audit-actions';
import { useToast } from '@/components/ui/toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { LoadingButtonContent } from '@/components/loading/loading-button-content';

type AboutUsRow = Tables<'about_us'>;
type DeveloperProfileRow = Tables<'developer_profiles'>;

const inputClass = styles.input;

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

  const [title, setTitle] = useState(initialAbout?.title ?? 'Barangayan');
  const [mission, setMission] = useState(initialAbout?.mission ?? '');
  const [vision, setVision] = useState(initialAbout?.vision ?? '');
  const [history, setHistory] = useState(initialAbout?.history ?? '');
  const [contactEmail, setContactEmail] = useState(initialAbout?.contact_email ?? '');
  const [contactPhone, setContactPhone] = useState(initialAbout?.contact_phone ?? '');
  const [address, setAddress] = useState(initialAbout?.address ?? '');
  const [logoUrl, setLogoUrl] = useState(initialAbout?.logo_url ?? '');
  const [logoSize, setLogoSize] = useState(initialAbout?.logo_size ?? 64);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(initialAbout?.is_active ?? true);
  const [developers, setDevelopers] = useState<DeveloperDraft[]>(rowsToDrafts(initialDevelopers));
  const [showPreview, setShowPreview] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
      .subscribe();

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
        p_logo_size: logoSize,
        p_title: title,
        p_developers: developerPayload,
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

      logAdminAction({
        action: initialAbout ? 'update' : 'create',
        entityType: 'about_us',
        entityId: initialAbout?.id,
        entityLabel: title || 'Barangayan',
        changes: {
          before: (initialAbout ?? {}) as unknown as Record<string, unknown>,
          after: parsed.data as unknown as Record<string, unknown>,
        },
      }).catch(() => {});

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
    <form onSubmit={handleSubmit} className={styles.workspace}>
      <header className={styles.toolbar}>
        <div className={styles.eyebrow}>Community / About Us</div>
        <button type="button" className={styles.secondaryButton} aria-pressed={showPreview} onClick={() => setShowPreview((v) => !v)}>
          {showPreview ? <Pencil size={15} /> : <Eye size={15} />}{showPreview ? 'Back to editing' : 'Preview page'}
        </button>
      </header>

      {!showPreview && <nav className={styles.navigation} aria-label="About Us sections">
        <a href="#about-identity">01 <span>Identity</span></a>
        <a href="#about-story">02 <span>Our story</span></a>
        <a href="#about-contact">03 <span>Contact</span></a>
        <a href="#about-team">04 <span>Development team</span></a>
      </nav>}

      {showPreview ? (
        <article className={styles.preview} aria-label="About Us preview">
          <div className={styles.previewHeading}>
            <span className={styles.eyebrow}>Page preview · {isActive ? 'Published' : 'Unpublished'}</span>
            {(logoPreview || logoUrl) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoPreview ?? logoUrl} alt="Barangay logo" className={styles.logo} style={{ width: logoSize, height: logoSize }} />
            )}
            <h2>{title || 'Your barangay'}</h2>
          </div>
          <div className={styles.twoColumns}>
            {[['Mission', mission], ['Vision', vision]].map(([label, content]) => <section key={label} className={styles.previewBlock}>
              <h3>{label}</h3><ReactMarkdown rehypePlugins={[rehypeSanitize]}>{content || 'No content added yet.'}</ReactMarkdown>
            </section>)}
          </div>
          <section className={styles.previewBlock}><h3>History</h3><ReactMarkdown rehypePlugins={[rehypeSanitize]}>{history || 'No history added yet.'}</ReactMarkdown></section>
          <section className={styles.previewBlock}><h3>Contact</h3><div className={styles.contactPreview}>
            <div><span>Email</span><p>{contactEmail || 'Not provided'}</p></div>
            <div><span>Phone</span><p>{contactPhone || 'Not provided'}</p></div>
            <div><span>Address</span><p>{address || 'Not provided'}</p></div>
          </div></section>
          <section className={styles.previewBlock}><h3>Development team</h3><div className={styles.twoColumns}>
            {developers.map((dev) => <div key={dev.key} className={styles.teamPreview}>
              {(dev.photoPreview || dev.photo_url) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={dev.photoPreview ?? dev.photo_url} alt={dev.name || 'Developer photo'} />
              )}
              <div><h4>{dev.name || 'Developer name'}</h4><span>{dev.role || 'Role'}</span>{dev.bio && <p>{dev.bio}</p>}</div>
            </div>)}
            {!developers.length && <p className={styles.muted}>No developers added yet.</p>}
          </div></section>
        </article>
      ) : (
        <div className={styles.editor}>
          <section id="about-identity" className={styles.section}>
            <div className={styles.sectionIntro}><span className={styles.eyebrow}>01 / Identity</span><h2>A familiar face.</h2><p>Give residents a name and a logo they recognize.</p></div>
            <div className={styles.panel}>
              <div className={styles.logoRow}>
                <div className={styles.logoStage}>
                  {(logoPreview || logoUrl) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoPreview ?? logoUrl} alt="Logo preview" className={styles.logo} style={{ width: logoSize, height: logoSize }} />
                  ) : <Building2 size={36} strokeWidth={1} aria-hidden="true" />}
                </div>
                <div className={styles.logoControls}>
                  <label className={styles.field}><span>Barangay logo</span><input type="file" accept="image/png,image/jpeg,image/jpg,image/webp" onChange={(e) => handleLogoPick(e.target.files?.[0] ?? null)} className={styles.fileInput} /></label>
                  <p className={styles.hint}>PNG, JPG, or WebP</p>
                  <label className={styles.field}><span className={styles.rangeLabel}>Logo size <output>{logoSize}px</output></span><input type="range" min={40} max={200} step={4} value={logoSize} onChange={(e) => setLogoSize(Number(e.target.value))} /></label>
                </div>
              </div>
              <label className={styles.field}><span>Page title</span><input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Barangayan" /></label>
            </div>
          </section>

          <section id="about-story" className={styles.section}>
            <div className={styles.sectionIntro}><span className={styles.eyebrow}>02 / Our story</span><h2>Purpose. Progress.<br />A shared future.</h2><p>Tell residents what your community stands for and where it’s headed.</p><span className={styles.formatNote}>Markdown supported in all story fields.</span></div>
            <div className={styles.panel}>
              <label className={styles.field}><span>Mission</span><textarea className={inputClass} value={mission} onChange={(e) => setMission(e.target.value)} rows={4} placeholder="What guides your community every day?" /></label>
              <label className={styles.field}><span>Vision</span><textarea className={inputClass} value={vision} onChange={(e) => setVision(e.target.value)} rows={4} placeholder="The future you’re building together." /></label>
              <label className={styles.field}><span>History</span><textarea className={inputClass} value={history} onChange={(e) => setHistory(e.target.value)} rows={6} placeholder="Share the story of your barangay." /></label>
            </div>
          </section>

          <section id="about-contact" className={styles.section}>
            <div className={styles.sectionIntro}><span className={styles.eyebrow}>03 / Contact</span><h2>Keep in touch.</h2><p>Make it easy for residents to reach their barangay.</p></div>
            <div className={styles.panel}>
              <div className={styles.twoColumns}>
                <label className={styles.field}><span>Contact email</span><input className={inputClass} type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="Email address" /></label>
                <label className={styles.field}><span>Contact phone</span><input className={inputClass} type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="Phone number" /></label>
              </div>
              <label className={styles.field}><span>Address</span><input className={inputClass} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Barangay office address" /></label>
            </div>
          </section>

          <section id="about-team" className={styles.section}>
            <div className={styles.sectionIntro}><span className={styles.eyebrow}>04 / Development team</span><h2>The people<br />behind it.</h2><p>Recognize the team helping your community stay connected.</p></div>
            <div className={styles.panel}>
              <div className={styles.panelHeading}><span>Development team <span className={styles.count}>{developers.length}</span></span><button type="button" onClick={addDeveloper} className={styles.secondaryButton}><Plus size={14} />Add Developer</button></div>
              {developers.map((dev, index) => (
                <div key={dev.key} className={styles.developer}>
                  <div className={styles.developerHeading}><span>Team member {String(index + 1).padStart(2, '0')}</span><button type="button" onClick={() => removeDeveloper(dev.key)} className={styles.removeButton} aria-label={`Remove ${dev.name || `team member ${index + 1}`}`}>Remove</button></div>
                  <div className={styles.photoRow}>
                    {(dev.photoPreview || dev.photo_url) && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={dev.photoPreview ?? dev.photo_url} alt={dev.name || 'Developer photo'} />
                    )}
                    <label className={styles.field}><span>Photo</span><input type="file" accept="image/png,image/jpeg,image/jpg,image/webp" onChange={(e) => handleDeveloperPhotoPick(dev.key, e.target.files?.[0] ?? null)} className={styles.fileInput} /></label>
                  </div>
                  <div className={styles.twoColumns}>
                    <label className={styles.field}><span>Name</span><input className={inputClass} value={dev.name} onChange={(e) => updateDeveloper(dev.key, { name: e.target.value })} required /></label>
                    <label className={styles.field}><span>Role</span><input className={inputClass} value={dev.role} onChange={(e) => updateDeveloper(dev.key, { role: e.target.value })} required /></label>
                  </div>
                  <label className={styles.field}><span>Bio</span><textarea className={inputClass} value={dev.bio} onChange={(e) => updateDeveloper(dev.key, { bio: e.target.value })} rows={3} /></label>
                </div>
              ))}
              {!developers.length && <div className={styles.empty}><Users size={28} strokeWidth={1} /><h3>A little credit goes a long way.</h3><p>Add the people who brought your community’s platform to life.</p></div>}
            </div>
          </section>
        </div>
      )}
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <footer className={styles.saveBar}>
        <label className={styles.publishControl}><input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /><span><strong>Published</strong><small>Visible to residents when saved</small></span></label>
        <button type="submit" disabled={submitting || !barangayId} className={styles.primaryButton} aria-busy={submitting}>
          <LoadingButtonContent pending={submitting} pendingLabel="Saving…"><Save size={15} />Save Changes</LoadingButtonContent>
        </button>
      </footer>
    </form>
  );
}
