'use client';
import { beginAttempt, notify } from '@/lib/notify';

import Image from 'next/image';
import { AdminSelect } from '@/components/admin/dropdown/admin-select';
import { Armchair, BriefcaseBusiness, Camera, CircleHelp, ContactRound, GraduationCap, Link2, Mars, Search, ShieldCheck, Store, UserRound, Venus, VenusAndMars, Pencil, MapPin } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition, type FormEvent } from 'react';
import { ProfileDialog } from '@/components/admin/profile-dialog';
import { useProfileNavigation } from '@/components/admin/profile-navigation-guard';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { formatAdminTimestamp } from '@/lib/admin-tables/pilot-config';
import { hasStructuredName, ownedAvatarPath, profilePatchSchema, type Outcome, type ProfileDetails, type ProfilePatch, type ResidentSection, type StaffSummary } from '@/lib/admin-profile/schema';
import { readAdminProfile, readAssociatedResident, saveAdminProfile, unlinkResidentAssociation } from './actions';
import { ProfileSecurity } from './profile-security';
import { AssociationControl } from './association-control';
import styles from './profile.module.css';

// Feature-detected browser API; the workspace TypeScript DOM version predates
// these standard interfaces. Older browsers retain unload/link protection.
type ProfileHistoryEvent = Event & { navigationType: string; destination: { sameDocument: boolean; key: string } };
type ProfileHistory = {
  addEventListener: (type: 'navigate', listener: (event: ProfileHistoryEvent) => void) => void;
  removeEventListener: (type: 'navigate', listener: (event: ProfileHistoryEvent) => void) => void;
  traverseTo: (key: string) => { finished: Promise<unknown> };
};

function ProfileValues({ profile }: { profile: ProfileDetails }) {
  const values: [string, string | boolean | null][] = [
    ['Display name', profile.full_name], ['Contact email', profile.email], ['Mobile number', profile.mobile_number],
    ...(hasStructuredName(profile) ? [['First name', profile.first_name], ['Middle name', profile.middle_name], ['Last name', profile.last_name], ['Suffix', profile.suffix]] as [string, string | null][] : []),
    ['Home address', profile.home_address], ['City', profile.city], ['Province', profile.province], ['Date of birth', profile.birth_date], ['Sex', profile.sex],
    ['Employment', profile.employment_status?.replaceAll('_', ' ') ?? null], ['Occupation', profile.occupation],
    ['Contact email verification', profile.role === 'admin' ? 'Not applicable — admin contact verification is unavailable' : profile.email_verification_status], ['ID verification', profile.id_verification_status],
    ['Location verification', profile.location_verified],
  ];
  return <dl className={styles.details}>{values.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{typeof value === 'boolean' ? (value ? 'Verified' : 'Not verified') : value || 'Not provided'}</dd></div>)}</dl>;
}

function ProfileAvatar({ profile }: { profile: ProfileDetails }) {
  const [failed, setFailed] = useState(false);
  const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const avatar = apiUrl && ownedAvatarPath(profile.avatar_url, profile.id, apiUrl) ? profile.avatar_url : null;
  return <div className={styles.avatar}>{avatar && !failed ? <Image src={avatar} alt={`${profile.full_name}'s ${profile.role} photo`} width={88} height={88} unoptimized onError={() => setFailed(true)} /> : <span aria-label={`${profile.role} initials`}>{profile.full_name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()}</span>}</div>;
}

function draftFor(profile: ProfileDetails) {
  return {
    full_name: profile.full_name, email: profile.email ?? '', mobile_number: profile.mobile_number ?? '',
    first_name: profile.first_name ?? '', middle_name: profile.middle_name ?? '', last_name: profile.last_name ?? '', suffix: profile.suffix ?? '',
    home_address: profile.home_address ?? '', city: profile.city ?? '', province: profile.province ?? '',
    birth_date: profile.birth_date ?? '', sex: profile.sex ?? '', employment_status: profile.employment_status ?? '', occupation: profile.occupation ?? '',
  };
}

export function ProfileWorkspace({ profile, barangayName, staff, initialResident, security, credentialsEnabled }: {
  profile: ProfileDetails; barangayName: string; staff: StaffSummary | null; initialResident: ResidentSection;
  security: { email: string | null; newEmail: string | null; confirmed: boolean; providers: string[] };
  credentialsEnabled: boolean;
}) {
  const router = useRouter();
  const { setProfileDirty, setProfileBusy, requestLeave, blockNavigation } = useProfileNavigation();
  const [saved, setSaved] = useState(profile);
  const [draft, setDraft] = useState(() => draftFor(profile));
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const [accountBusy, setAccountBusy] = useState(false);
  const [accessExpired, setAccessExpired] = useState(false);
  const [resident, setResident] = useState(initialResident);
  const [residentLoading, setResidentLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [showUnlink, setShowUnlink] = useState(false);
  const busy = useRef(false);
  const readingResident = useRef(false);
  const summary = useRef<HTMLParagraphElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const [photoEditing, setPhotoEditing] = useState(false);
  const structured = hasStructuredName(saved);
  const original = draftFor(saved);
  const patch = Object.fromEntries((Object.keys(draft) as (keyof typeof draft)[])
    .filter(key => draft[key] !== original[key] && (key !== 'full_name' || !structured))
    .map(key => [key, draft[key].trim() || (['full_name', 'first_name', 'last_name'].includes(key) ? '' : null)])) as ProfilePatch;
  const changed = Object.keys(patch).length > 0 || Boolean(photo) || removePhoto;
  const dirty = (editing || photoEditing) && changed;
  const validation = profilePatchSchema.safeParse(patch);
  const fieldErrors: Partial<Record<keyof ProfilePatch, string[]>> = validation.success ? {} : validation.error.flatten().fieldErrors;
  const photoValid = !photo || (['image/jpeg', 'image/png', 'image/webp'].includes(photo.type) && photo.size > 0 && photo.size <= 2 * 1024 * 1024);
  const valid = photoValid && (Object.keys(patch).length === 0 ? Boolean(photo || removePhoto) : validation.success);

  useEffect(() => {
    setProfileDirty(dirty);
    return () => setProfileDirty(false);
  }, [dirty, setProfileDirty]);
  useEffect(() => {
    setProfileBusy(saving || unlinking || accountBusy || reloading || refreshing);
    return () => setProfileBusy(false);
  }, [saving, unlinking, accountBusy, reloading, refreshing, setProfileBusy]);
  useEffect(() => {
    if (!dirty && !saving && !unlinking && !accountBusy && !reloading && !refreshing) return;
    function unload(event: BeforeUnloadEvent) { event.preventDefault(); event.returnValue = ''; }
    function anchor(event: MouseEvent) {
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!(link instanceof HTMLAnchorElement) || link.target === '_blank' || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0 || link.closest('#admin-sidebar')) return;
      const target = new URL(link.href);
      if (target.origin === window.location.origin && blockNavigation(() => router.push(`${target.pathname}${target.search}${target.hash}`))) { event.preventDefault(); event.stopPropagation(); }
    }
    const navigation = (window as Window & { navigation?: ProfileHistory }).navigation;
    function traverse(event: ProfileHistoryEvent) {
      if (event.navigationType !== 'traverse' || !event.cancelable || !event.destination.sameDocument || !navigation) return;
      const key = event.destination.key;
      if (blockNavigation(() => { void navigation.traverseTo(key).finished.catch(() => { setMessage('Navigation could not be completed. Your profile is still available.'); setError(true); }); })) event.preventDefault();
    }
    navigation?.addEventListener('navigate', traverse);
    window.addEventListener('beforeunload', unload);
    document.addEventListener('click', anchor, true);
    return () => { navigation?.removeEventListener('navigate', traverse); window.removeEventListener('beforeunload', unload); document.removeEventListener('click', anchor, true); };
  }, [dirty, saving, unlinking, accountBusy, reloading, refreshing, blockNavigation, router]);
  useEffect(() => { if (message) summary.current?.focus(); }, [message]);
  function editPhoto() {
    if (busy.current || editing || accountBusy || conflict || reloading || refreshing || accessExpired) return;
    setDraft(draftFor(saved)); setPhoto(null); setRemovePhoto(false); setPhotoEditing(true); setMessage(null);
  }
  function accountOperation(value: boolean) { busy.current = value; setAccountBusy(value); }
  const noticeAttempt = useRef<ReturnType<typeof beginAttempt> | undefined>(undefined);
  function announce(value: string, failure = false) {
    setMessage(value); setError(failure);
    const uncertain = /could not be confirmed|cleanup|could not be retired|saved, but|incomplete/i.test(value);
    notify[uncertain ? 'warning' : failure ? 'error' : 'success'](value, { id: noticeAttempt.current });
  }
  function expireAccess() { setAccessExpired(true); setPhoto(null); setResident({ state: 'error', message: 'Sign in again to view associated account details.' }); }
  function cancel() { requestLeave(() => { setDraft(draftFor(saved)); setPhoto(null); setRemovePhoto(false); setEditing(false); setPhotoEditing(false); setConflict(false); setMessage(null); }); }
  async function reload() {
    if (busy.current || refreshing) return;
    busy.current = true; setReloading(true);
    noticeAttempt.current = beginAttempt('profile-reload');
    try {
      const result = await readAdminProfile();
      if (!result.ok) { if (result.code === 'access') expireAccess(); announce(result.message, true); return; }
      setSaved(result.value.profile); setDraft(draftFor(result.value.profile)); setPhoto(null); setRemovePhoto(false); setEditing(false); setPhotoEditing(false); setConflict(false); setResident(result.value.resident);
      announce('Current profile loaded. Review it before editing again.'); startRefresh(() => router.refresh());
    } catch { announce('Current details could not be loaded. Your draft is kept. Try reloading again.', true); }
    finally { busy.current = false; setReloading(false); }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy.current || refreshing || !dirty || !valid || conflict) return;
    busy.current = true; setSaving(true); setMessage(null);
    noticeAttempt.current = beginAttempt('admin-profile-save');
    const client = createSupabaseBrowserClient();
    const savePatch = { ...patch };
    let newPath: string | null = null;
    let newUrl: string | null = null;
    let committed = false;
    try {
      if (photo) {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(photo.type) || photo.size === 0 || photo.size > 2 * 1024 * 1024) { announce('Choose a JPEG, PNG or WebP image up to 2 MiB.', true); return; }
        if (typeof createImageBitmap === 'function') {
          try { const decoded = await createImageBitmap(photo); decoded.close(); }
          catch { announce('This image could not be read. Choose a valid JPEG, PNG or WebP photo.', true); return; }
        }
        const extension = photo.type === 'image/jpeg' ? 'jpg' : photo.type === 'image/png' ? 'png' : 'webp';
        newPath = `${saved.id}/${crypto.randomUUID()}.${extension}`;
        newUrl = client.storage.from('profile-photos').getPublicUrl(newPath).data.publicUrl;
        const uploaded = await client.storage.from('profile-photos').upload(newPath, photo, { contentType: photo.type, upsert: false });
        if (uploaded.error) {
          // A failed response can follow a completed upload. Confirm that no
          // profile references it before retiring this attempt's immutable file.
          const current = await readAdminProfile();
          let warning = 'The photo upload could not be confirmed. Your saved photo was kept.';
          if (current.ok && current.value.profile.avatar_url !== newUrl) {
            const removed = await client.storage.from('profile-photos').remove([newPath]);
            if (removed.error) { setConflict(true); warning += ' Unused photo cleanup is incomplete. Reload before retrying.'; }
          } else { setConflict(true); warning += ' Upload cleanup could not be confirmed. Reload before retrying.'; }
          if (!current.ok || current.value.profile.updated_at !== saved.updated_at) setConflict(true);
          if (!current.ok && current.code === 'access') expireAccess();
          announce(warning, true); return;
        }
        savePatch.avatar_url = newUrl;
      } else if (removePhoto) savePatch.avatar_url = null;
      const result = await saveAdminProfile({ expected: saved.updated_at, patch: savePatch });
      // Reconcile both errors and successes against persisted state before cleanup.
      const current = await readAdminProfile();
      const persisted = current.ok && current.value.profile.updated_at !== saved.updated_at &&
        Object.entries(savePatch).every(([key, value]) => current.value.profile[key as keyof ProfileDetails] === value);
      if (!result.ok && !persisted) {
        if (newPath && current.ok && current.value.profile.avatar_url !== newUrl) {
          const removed = await client.storage.from('profile-photos').remove([newPath]);
          if (removed.error) announce(`${result.message} The unused photo also could not be removed. Reload before retrying.`, true);
          else announce(result.message, true);
        } else announce(current.ok ? result.message : 'The save outcome could not be confirmed. Keep this draft and reload current details before retrying.', true);
        if (result.code === 'access') expireAccess();
        setConflict(result.code === 'conflict' || !current.ok || result.code === 'unavailable');
        return;
      }
      let warning = result.ok ? result.warning : undefined;
      committed = true;
      if (current.ok) { setSaved(current.value.profile); setDraft(draftFor(current.value.profile)); }
      else warning = 'Profile saved, but current details could not be loaded. Reload before editing again.';
      if (('avatar_url' in savePatch) && saved.avatar_url && current.ok && current.value.profile.avatar_url !== saved.avatar_url) {
        const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const oldPath = apiUrl ? ownedAvatarPath(saved.avatar_url, saved.id, apiUrl) : null;
        if (oldPath) {
          const removed = await client.storage.from('profile-photos').remove([oldPath]);
          if (removed.error) warning = 'Profile saved. The previous photo could not be retired; do not repeat Save.';
        }
      }
      setPhoto(null); setRemovePhoto(false); setEditing(false); setPhotoEditing(false); setConflict(!current.ok);
      announce(warning ?? 'Admin profile saved. Your resident account and sign-in credentials were kept separate.');
      startRefresh(() => router.refresh());
    } catch {
      // A lost transport response may have committed. Retain uploaded data and
      // stop resubmission until a fresh read resolves the outcome.
      setConflict(true);
      if (committed) { setEditing(false); setPhotoEditing(false); setPhoto(null); setRemovePhoto(false); announce('Profile saved. Photo cleanup or current-detail loading is incomplete. Reload the saved profile; do not repeat Save.'); }
      else announce('The outcome could not be confirmed. Reload current details before trying again; your draft is kept.', true);
    } finally { busy.current = false; setSaving(false); }
  }

  async function retryResident() {
    if (readingResident.current) return;
    readingResident.current = true;
    setResidentLoading(true);
    noticeAttempt.current = beginAttempt('associated-account-read');
    try { const result = await readAssociatedResident(); if (result.ok) { setResident(result.value); announce('Associated account details refreshed.'); } else { if (result.code === 'access') expireAccess(); announce(result.message, true); } }
    catch { announce('Associated account details could not be loaded. Try again.', true); }
    finally { readingResident.current = false; setResidentLoading(false); }
  }
  async function unlink() {
    if (busy.current || refreshing || (resident.state !== 'linked' && resident.state !== 'unavailable')) return;
    busy.current = true; setUnlinking(true);
    noticeAttempt.current = beginAttempt('unlink-account');
    try {
      const result: Outcome<boolean> = await unlinkResidentAssociation({ residentId: resident.state === 'linked' ? resident.profile.id : resident.residentId, linkedAt: resident.linkedAt });
      const refreshed = await readAssociatedResident();
      if (refreshed.ok) setResident(refreshed.value);
      if (result.ok || (refreshed.ok && refreshed.value.state === 'none')) { setShowUnlink(false); announce('Association removed. Both accounts and their data are preserved.'); }
      else { setShowUnlink(false); if (result.code === 'access') expireAccess(); announce(result.message, true); }
    } catch { setShowUnlink(false); announce('The unlink outcome could not be confirmed. Retry the account section before trying again.', true); }
    finally { busy.current = false; setUnlinking(false); }
  }

  return <div className={styles.page}>
    <div className={styles.profileCard}>
    <header className={styles.header}>
      <div className={styles.avatarEditor}>
        <ProfileAvatar key={saved.avatar_url} profile={saved} />
        <button type="button" className={styles.cameraButton} aria-label="Edit profile picture" title="Edit profile picture" disabled={editing || photoEditing || saving || accountBusy || conflict || reloading || refreshing || accessExpired} onClick={editPhoto}><Camera size={20} aria-hidden="true" /></button>
      </div>
      <div className={styles.identity}>
        <p className={styles.eyebrow}><span className={styles.badge}>Admin account</span></p>
        <div className={styles.identityRow}><h1 className={styles.title}>{saved.full_name}</h1>

        </div>
        <p className={styles.location}><MapPin size={15} aria-hidden="true" />{barangayName}</p>
        <div className={styles.accountFacts}><span><strong>{staff ? staff.official_role.replaceAll('_', ' ') : 'Administrator'}</strong>Staff role</span><span><strong>{staff ? (staff.is_active ? 'Active' : 'Inactive') : 'Not available'}</strong>Staff status</span><span><strong>{resident.state === 'linked' ? 'Linked' : resident.state === 'none' ? 'Not linked' : 'Unavailable'}</strong>Resident account</span></div>
      </div>
    </header>
    </div>
    <nav className={styles.sectionNav} aria-label="Profile sections">
      <button type="button" onClick={() => document.getElementById('admin-profile-heading')?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })}><UserRound size={16} aria-hidden="true" />Profile</button>
      <button type="button" onClick={() => document.getElementById('profile-staff')?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })}><ContactRound size={16} aria-hidden="true" />Staff info</button>
      <button type="button" onClick={() => document.getElementById('profile-security')?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })}><ShieldCheck size={16} aria-hidden="true" />Security</button>
      <button type="button" onClick={() => document.getElementById('resident-account-heading')?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })}><Link2 size={16} aria-hidden="true" />Resident account</button>
    </nav>
    {message && !photoEditing && <p ref={summary} tabIndex={-1} role={error ? 'alert' : 'status'} className={`${styles.message} ${error ? styles.error : ''}`}>{message}</p>}
    {(reloading || refreshing) && <p role="status" className="mb-4">Loading current profile details…</p>}
    {!editing && conflict && <button type="button" disabled={reloading || refreshing} className={styles.button} onClick={reload}>Reload saved profile</button>}
    {accessExpired && <a href="/login" className={`${styles.button} inline-block mb-5`}>Sign in again</a>}
    <div className={styles.grid}>
      <section className={`${styles.section} ${styles.wide}`} aria-labelledby="admin-profile-heading"><div className={styles.sectionHeading}><h2 id="admin-profile-heading">Admin profile</h2>{!editing && !accessExpired && <button disabled={photoEditing || accountBusy || conflict || reloading || refreshing} className={styles.button} onClick={() => { if (busy.current) return; setDraft(draftFor(saved)); setEditing(true); setMessage(null); }}><Pencil size={15} aria-hidden="true" />Edit profile</button>}</div><p className={styles.subtitle}>Changes here affect your admin profile only. Contact email is separate from sign-in email.</p>
        {editing ? <form onSubmit={save} className={`${styles.form} ${styles.editForm}`} aria-busy={saving}>
          <div className={styles.contactGrid}>
            <div className={structured ? styles.wide : styles.controlGroup}>
          {!structured ? <label className={styles.field}>Display name<input autoFocus maxLength={150} required aria-invalid={Boolean(fieldErrors.full_name?.length)} aria-describedby="profile-name-error" value={draft.full_name} onChange={event => setDraft({ ...draft, full_name: event.target.value })} disabled={saving} /></label> : <div className={styles.formGrid}>{(['first_name', 'middle_name', 'last_name', 'suffix'] as const).map(key => <label className={styles.field} key={key}>{({ first_name: 'First name', middle_name: 'Middle name', last_name: 'Last name', suffix: 'Suffix' })[key]}<input required={key === 'first_name' || key === 'last_name'} maxLength={key === 'suffix' ? 20 : 100} value={draft[key]} onChange={event => setDraft({ ...draft, [key]: event.target.value })} disabled={saving} aria-invalid={Boolean(fieldErrors[key]?.length)} aria-describedby={`${key}-error`} />{fieldErrors[key] && <span id={`${key}-error`} className={styles.error}>{fieldErrors[key]?.[0]}</span>}</label>)}</div>}
          {fieldErrors.full_name && <p id="profile-name-error" className={styles.error}>{fieldErrors.full_name[0]}</p>}
            </div>
            <div className={styles.controlGroup}>
          <label className={styles.field}>Contact email<input type="email" maxLength={254} autoComplete="email" value={draft.email} onChange={event => setDraft({ ...draft, email: event.target.value })} disabled={saving} aria-invalid={Boolean(fieldErrors.email?.length)} aria-describedby="profile-contact-hint profile-email-error" /></label>
          {fieldErrors.email && <p id="profile-email-error" className={styles.error}>{fieldErrors.email[0]}</p>}
            </div>
            <div className={styles.controlGroup}>
<label className={styles.field}>Mobile number<input type="tel" inputMode="numeric" maxLength={11} pattern="09[0-9]{9}" autoComplete="tel" aria-invalid={Boolean(fieldErrors.mobile_number?.length)} aria-describedby="profile-mobile-error" value={draft.mobile_number} onChange={event => setDraft({ ...draft, mobile_number: event.target.value })} disabled={saving} /></label>
          {fieldErrors.mobile_number && <p id="profile-mobile-error" className={styles.error}>{fieldErrors.mobile_number[0]}</p>}
            </div>
          </div>
          <p id="profile-contact-hint" className={styles.subtitle}>Changing this address resets its profile verification. It does not change login or the resident account.</p>
          <div className={styles.formGrid}>
            {(['home_address', 'city', 'province', 'birth_date', 'occupation'] as const).map(key => <label className={`${styles.field} ${key === 'home_address' ? styles.wide : ''}`} key={key}>
              {({ home_address: 'Home address', city: 'City', province: 'Province', birth_date: 'Date of birth', occupation: 'Occupation' })[key]}
              <input type={key === 'birth_date' ? 'date' : 'text'} max={key === 'birth_date' ? new Date().toISOString().slice(0, 10) : undefined} maxLength={key === 'home_address' ? 500 : 150} value={draft[key]} onChange={event => setDraft({ ...draft, [key]: event.target.value })} disabled={saving} aria-invalid={Boolean(fieldErrors[key]?.length)} aria-describedby={`${key}-error`} />
              {fieldErrors[key] && <span id={`${key}-error`} className={styles.error}>{fieldErrors[key]?.[0]}</span>}
            </label>)}
            <label className={styles.field}>Sex<AdminSelect className={styles.compactSelect} icon={<VenusAndMars size={17} />} aria-label="Sex" value={draft.sex} disabled={saving} onValueChange={value => setDraft({ ...draft, sex: value })} options={[{value:'',label:'Not provided',icon:<CircleHelp size={17} />},{value:'male',label:'Male',icon:<Mars size={17} />},{value:'female',label:'Female',icon:<Venus size={17} />}]} /></label>
            <label className={styles.field}>Employment<AdminSelect className={styles.compactSelect} icon={<BriefcaseBusiness size={17} />} aria-label="Employment" value={draft.employment_status} disabled={saving} onValueChange={value => setDraft({ ...draft, employment_status: value })} options={[{value:'',label:'Not provided',icon:<CircleHelp size={17} />},{value:'employed',label:'Employed',icon:<BriefcaseBusiness size={17} />},{value:'unemployed',label:'Unemployed',icon:<Search size={17} />},{value:'student',label:'Student',icon:<GraduationCap size={17} />},{value:'self_employed',label:'Self-employed',icon:<Store size={17} />},{value:'retired',label:'Retired',icon:<Armchair size={17} />}]} /></label>
          </div>
          <p className={styles.subtitle}>Verification statuses are read-only and updated through the verification workflows.</p>
          {conflict && <p role="alert">Reload and review current details before saving again. Your draft is kept until you choose to discard it.</p>}
          <div className={styles.actions}><button className={`${styles.button} ${styles.primary}`} disabled={saving || accountBusy || accessExpired || !dirty || !valid || conflict}>{saving ? 'Saving…' : 'Save admin profile'}</button><button type="button" className={styles.button} disabled={saving} onClick={cancel}>Cancel</button>{conflict && <button type="button" className={styles.button} disabled={saving} onClick={() => requestLeave(() => { void reload(); })}>Discard draft and reload</button>}</div>
        </form> : <ProfileValues profile={saved} />}
      </section>
      <section id="profile-staff" className={styles.section}><h2>Staff information</h2><p className={styles.subtitle}>Read-only. Staff management controls your role and status.</p>{staff ? <dl className={styles.details}><div><dt>Position</dt><dd>{staff.official_role.replaceAll('_', ' ')}</dd></div><div><dt>Status</dt><dd>{staff.is_active ? 'Active' : 'Inactive'}</dd></div><div><dt>Date hired</dt><dd>{staff.date_hired}</dd></div></dl> : <p className="mt-4">No staff roster information is available.</p>}</section>
      <div id="profile-security" className={styles.securitySection}><ProfileSecurity security={security} enabled={credentialsEnabled && !accessExpired} disabled={editing || photoEditing || saving || unlinking || accountBusy || reloading || refreshing} onBusy={accountOperation} /></div>
      <section className={`${styles.section} ${styles.wide}`} aria-labelledby="resident-account-heading"><h2 id="resident-account-heading">Associated resident account</h2><p className={styles.subtitle}>A separate account. These details are read-only; admin changes do not update it.</p>
        {resident.state === 'linked' ? <><div className="mt-5 flex items-center gap-4"><ProfileAvatar key={resident.profile.avatar_url} profile={resident.profile} /><h3 className="min-w-0 break-words text-lg font-semibold">{resident.profile.full_name}</h3></div><ProfileValues profile={resident.profile} /><p className="mt-4">Household members: {resident.householdCount ?? 'Unavailable'}</p><p className={styles.subtitle}>Linked on {formatAdminTimestamp(resident.linkedAt)}.</p></> : <p className="mt-5" role={resident.state === 'error' ? 'alert' : undefined}>{resident.message}</p>}
        <div className={styles.actions}><button type="button" className={styles.button} disabled={residentLoading || saving || unlinking || reloading || refreshing} onClick={retryResident}>{residentLoading ? 'Loading account…' : 'Retry account details'}</button>{(resident.state === 'linked' || resident.state === 'unavailable') && <button type="button" className={styles.button} disabled={editing || photoEditing || saving || unlinking || accountBusy || accessExpired || reloading || refreshing} onClick={() => setShowUnlink(true)}>Unlink resident account</button>}</div>
        {resident.state === 'none' && <AssociationControl enabled={credentialsEnabled && !accessExpired} disabled={editing || photoEditing || saving || unlinking || accountBusy || reloading || refreshing} onBusy={accountOperation} onLinked={() => { void retryResident(); }} />}
      </section>
      <details className={`${styles.section} ${styles.wide}`}><summary className="cursor-pointer font-semibold">Additional admin details</summary><dl className={styles.details}><div><dt>Account ID</dt><dd>{saved.id}</dd></div><div><dt>Created</dt><dd>{formatAdminTimestamp(saved.created_at)}</dd></div><div><dt>Last updated</dt><dd>{formatAdminTimestamp(saved.updated_at)}</dd></div><div><dt>Theme / font</dt><dd>{saved.theme_preference} / {saved.font_preference}</dd></div><div><dt>Push notifications</dt><dd>{saved.push_notifications_enabled ? 'Enabled' : 'Disabled'}</dd></div></dl></details>
    </div>
    {photoEditing && <ProfileDialog label="Edit profile picture" onClose={() => { if (!saving) cancel(); }} preventClose={saving}>
      <section className={`${styles.section} ${styles.modal}`}>
        <h2>Edit profile picture</h2>
        <p id="photo-hint" className={styles.subtitle}>Choose a JPEG, PNG or WebP up to 2 MiB. Changes apply when you save.</p>
        {message && <p ref={summary} tabIndex={-1} role={error ? 'alert' : 'status'} className={styles.message}>{message}</p>}
        <form onSubmit={save} className={styles.form} aria-busy={saving}>
          <input ref={photoInput} type="file" hidden accept="image/jpeg,image/png,image/webp" disabled={saving} aria-label="Choose profile picture" aria-describedby="photo-hint" onChange={event => { setPhoto(event.target.files?.[0] ?? null); setRemovePhoto(false); }} />
          <button autoFocus type="button" className={styles.button} disabled={saving} onClick={() => photoInput.current?.click()}><Camera size={18} aria-hidden="true" />{photo ? 'Choose another photo' : 'Choose photo'}</button>
          {photo && <p className={styles.subtitle}>{photo.name}</p>}
          {!photoValid && <p role="alert" className={styles.error}>Choose a JPEG, PNG or WebP image up to 2 MiB.</p>}
          {saved.avatar_url && <label className="flex items-center gap-2"><input type="checkbox" checked={removePhoto} disabled={saving || Boolean(photo)} onChange={event => setRemovePhoto(event.target.checked)} />Remove current photo</label>}
          {conflict && <p role="alert">Reload current details before saving again.</p>}
          <div className={styles.actions}>
            <button className={`${styles.button} ${styles.primary}`} disabled={saving || accountBusy || accessExpired || !dirty || !valid || conflict}>{saving ? 'Saving…' : 'Save photo'}</button>
            <button type="button" className={styles.button} disabled={saving} onClick={cancel}>Cancel</button>
            {conflict && <button type="button" className={styles.button} disabled={saving} onClick={() => requestLeave(() => { void reload(); })}>Discard draft and reload</button>}
          </div>
        </form>
      </section>
    </ProfileDialog>}
    {showUnlink && <ProfileDialog label="Unlink resident account" onClose={() => { if (!unlinking) setShowUnlink(false); }} preventClose={unlinking}><div className={`${styles.section} ${styles.modal}`}><h2>Unlink resident account?</h2><p>{saved.full_name} (Admin account) and {resident.state === 'linked' ? resident.profile.full_name : 'the unavailable linked profile'} (Resident account) will remain separate accounts. Neither account nor its data will be deleted. A new link requires fresh ownership proof.</p><div className={styles.actions}><button autoFocus className={styles.button} disabled={unlinking} onClick={() => setShowUnlink(false)}>Keep association</button><button className={`${styles.button} ${styles.primary}`} disabled={unlinking} onClick={unlink}>{unlinking ? 'Unlinking…' : 'Unlink accounts'}</button></div></div></ProfileDialog>}
  </div>;
}
