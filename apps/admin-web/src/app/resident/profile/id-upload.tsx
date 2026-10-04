'use client';
import { createRequestKey, ID_TYPES, publishIdEvidence, SUPPORTING_FILE_MAX_BYTES } from '@barangayan/shared';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
export function IdUpload() {
  const router = useRouter();
  const heading = useRef<HTMLHeadingElement>(null);
  const [type, setType] = useState('');
  const [other, setOther] = useState('');
  const [files, setFiles] = useState<{ front?: File; back?: File }>({});
  const operation = useRef<string | null>(null);
  const busy = useRef(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    if (window.location.hash === '#upload-valid-id') {
      heading.current?.scrollIntoView({ block: 'start' });
      heading.current?.focus({ preventScroll: true });
    }
  }, []);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setMessage(null);
    try {
      if (!type || (type === 'Other' && !other.trim()) || !files.front || !files.back)
        throw new Error('Choose the ID type and both sides.');
      const client = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await client.auth.getUser();
      if (!user) throw new Error('Sign in again.');
      operation.current ??= createRequestKey();
      const paths: string[] = [];
      for (const side of ['front', 'back'] as const) {
        const file = files[side]!;
        if (
          !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
          !file.size ||
          file.size > SUPPORTING_FILE_MAX_BYTES
        )
          throw new Error('Each ID image must be JPG, PNG or WEBP up to 5 MB.');
        const extension = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1];
        const path = `${user.id}/versions/${operation.current}/id-${side}.${extension}`;
        const bytes = new Uint8Array(await file.arrayBuffer());
        const bucket = client.storage.from('id-documents');
        const { error } = await bucket.upload(path, bytes, { contentType: file.type, upsert: false });
        if (error) {
          const { data } = await bucket.download(path);
          const saved = data ? new Uint8Array(await data.arrayBuffer()) : null;
          if (!saved || saved.length !== bytes.length || saved.some((v, i) => v !== bytes[i])) throw error;
        }
        paths.push(path);
      }
      await publishIdEvidence(client, {
        submissionId: operation.current,
        idType: type === 'Other' ? `Other: ${other.trim()}` : type,
        frontPath: paths[0],
        backPath: paths[1],
      });
      setMessage(
        'Your ID was submitted for verification. Approval is required before requesting a document.',
      );
      router.refresh();
    } catch (failure) {
      setMessage((failure as { message: string }).message);
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  return (
    <form onSubmit={submit} className="mt-8 flex flex-col gap-4 rounded-xl border p-5">
      <h2 ref={heading} id="upload-valid-id" tabIndex={-1} className="scroll-mt-24 font-semibold">
        Upload Valid ID
      </h2>
      <label>
        ID type
        <select
          required
          className="block w-full rounded-lg border p-3"
          value={type}
          onChange={(event) => {
            setType(event.target.value);
            operation.current = null;
          }}
        >
          <option value="">Choose ID type</option>
          {ID_TYPES.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </label>
      {type === 'Other' ? (
        <label>
          Specify ID type
          <input
            required
            maxLength={200}
            value={other}
            onChange={(event) => {
              setOther(event.target.value);
              operation.current = null;
            }}
          />
        </label>
      ) : null}
      {(['front', 'back'] as const).map((side) => (
        <label key={side}>
          {side === 'front' ? 'Front side' : 'Back side'}
          <input
            required
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={saving}
            onChange={(event) => {
              setFiles((previous) => ({ ...previous, [side]: event.target.files?.[0] }));
              operation.current = null;
            }}
          />
        </label>
      ))}
      <p className="text-sm">
        Each image: JPG, PNG or WEBP, maximum 5 MB. Replacing your ID requires a new review.
      </p>
      {message ? <p role="status">{message}</p> : null}
      <button disabled={saving} className="min-h-12 rounded-lg bg-[var(--accent)] px-5 py-3 text-white">
        {saving ? 'Submitting…' : 'Submit ID for verification'}
      </button>
    </form>
  );
}
