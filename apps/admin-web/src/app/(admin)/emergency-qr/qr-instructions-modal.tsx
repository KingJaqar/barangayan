'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import { emergencyQrContentSchema, qrStepItemSchema } from '@barangayan/shared';
import type { QrStepItem } from '@barangayan/shared';
import { useFieldArray } from 'react-hook-form';
import type { Json } from '@barangayan/shared';

type QrInstruction = {
  id: string;
  barangay_id: string;
  section: 'why_scan' | 'how_it_works';
  title: string;
  body: string;
  content: { step: number; title: string; desc: string }[];
  icon: string;
  icon_color: string;
  icon_bg: string;
  is_active: boolean;
  sort_order: number;
};

const PRESET_ICONS = [
  'qr-code-outline',
  'help-circle-outline',
  'warning-outline',
  'shield-checkmark-outline',
  'flame-outline',
  'call-outline',
  'location-outline',
  'people-outline',
  'home-outline',
  'checkbox-outline',
];

const PRESET_COLORS = [
  { name: 'Blue', value: '#2563EB', bg: '#DBEAFE' },
  { name: 'Green', value: '#16A34A', bg: '#DCFCE7' },
  { name: 'Red', value: '#DC2626', bg: '#FEE2E2' },
  { name: 'Amber', value: '#D97706', bg: '#FEF3C7' },
  { name: 'Purple', value: '#7C3AED', bg: '#EDE9FE' },
  { name: 'Pink', value: '#DB2777', bg: '#FCE7F3' },
  { name: 'Teal', value: '#0D9488', bg: '#CCFBF1' },
  { name: 'Slate', value: '#475569', bg: '#F1F5F9' },
];

const inputClass =
  'w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[var(--accent)] dark:border-zinc-700 dark:bg-zinc-800';

function toStepArray(content: Json | undefined): QrStepItem[] {
  if (Array.isArray(content)) {
    return content.map((item, idx) => {
      if (typeof item === 'object' && item !== null && 'step' in item && 'title' in item && 'desc' in item) {
        return {
          step: (item as any).step ?? idx + 1,
          title: String((item as any).title ?? ''),
          desc: String((item as any).desc ?? ''),
        };
      }
      return { step: idx + 1, title: '', desc: '' };
    });
  }
  return [];
}

export function QrInstructionsModal({
  section,
  barangayId,
  existing,
  onClose,
  onSaved,
}: {
  section: string;
  barangayId: string;
  existing: QrInstruction | undefined;
  onClose: () => void;
  onSaved: (record: QrInstruction) => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm({
    resolver: zodResolver(emergencyQrContentSchema),
    defaultValues: {
      id: existing?.id,
      barangay_id: barangayId,
      section: section as 'why_scan' | 'how_it_works',
      title: existing?.title ?? '',
      body: existing?.body ?? '',
      content: toStepArray(existing?.content as Json | undefined),
      icon: existing?.icon ?? (section === 'why_scan' ? 'qr-code-outline' : 'help-circle-outline'),
      icon_color: existing?.icon_color ?? '#2563EB',
      icon_bg: existing?.icon_bg ?? '#DBEAFE',
      is_active: existing?.is_active ?? true,
      sort_order: existing?.sort_order ?? 0,
    },
  });

  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: 'content',
  });

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  async function handleSubmit(data: any) {
    setSubmitting(true);
    setServerError(null);

    const payload = {
      ...data,
      content: data.content.map((step: any, idx: number) => ({ ...step, step: idx + 1 })),
    };

    const supabase = createSupabaseBrowserClient();
    const { data: result, error } = await supabase
      .from('emergency_qr_content')
      .upsert(payload as any, { onConflict: 'barangay_id,section' })
      .select('*')
      .single();

    setSubmitting(false);

    if (error) {
      setServerError(error.message);
      toast.showError(`Failed to save: ${error.message}`);
      return;
    }

    toast.showSuccess(existing ? 'Content updated.' : 'Content created.');
    onSaved(result as unknown as QrInstruction);
  }

  const iconColor = form.watch('icon_color') as string;
  const iconBg = form.watch('icon_bg') as string;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-xl border border-black/10 bg-white p-6 shadow-xl dark:border-white/10 dark:bg-zinc-900 max-h-[90vh] overflow-y-auto">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">
            {existing ? 'Edit' : 'Add'} {section === 'why_scan' ? 'Why Scan' : 'How It Works'}
          </h2>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            type="button">
            ✕
          </button>
        </div>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-4">
          <label className="text-sm">
            <span className="mb-1 block font-medium">Title</span>
            <input {...form.register('title')} className={inputClass} />
            {(form.formState.errors as any).title && (
              <span className="text-xs text-red-600">{(form.formState.errors as any).title.message}</span>
            )}
          </label>

          <label className="text-sm">
            <span className="mb-1 block font-medium">Body / Subtitle</span>
            <textarea {...form.register('body')} className={inputClass} rows={2} />
          </label>

          <div className="text-sm">
            <span className="mb-1 block font-medium">Steps</span>
            <div className="flex flex-col gap-2">
              {fields.map((field, idx) => (
                <div key={field.id} className="flex items-start gap-2">
                  <span className="mt-2 text-xs text-zinc-400 w-4 shrink-0">{idx + 1}.</span>
                  <div className="flex-1 flex flex-col gap-1">
                    <input
                      {...form.register(`content.${idx}.title` as const)}
                      placeholder="Step title"
                      className={inputClass}
                    />
                    {(form.formState.errors as any).content?.[idx]?.title && (
                      <span className="text-xs text-red-600">
                        {(form.formState.errors as any).content[idx]?.title?.message}
                      </span>
                    )}
                    <input
                      {...form.register(`content.${idx}.desc` as const)}
                      placeholder="Step description"
                      className={inputClass}
                    />
                    {(form.formState.errors as any).content?.[idx]?.desc && (
                      <span className="text-xs text-red-600">
                        {(form.formState.errors as any).content[idx]?.desc?.message}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => move(idx, idx - 1)}
                      disabled={idx === 0}
                      className="text-xs text-zinc-500 disabled:opacity-30">
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => move(idx, idx + 1)}
                      disabled={idx === fields.length - 1}
                      className="text-xs text-zinc-500 disabled:opacity-30">
                      ▼
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(idx)}
                    className="text-xs text-red-600 hover:text-red-700">
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => append({ step: fields.length + 1, title: '', desc: '' })}
                className="self-start rounded-full border border-dashed border-zinc-300 px-3 py-1 text-xs font-semibold text-zinc-600 hover:border-[var(--accent)] hover:text-[var(--accent)] dark:border-zinc-700 dark:hover:border-[var(--accent)]">
                + Add Step
              </button>
            </div>
          </div>

          <div className="text-sm">
            <span className="mb-1 block font-medium">Icon</span>
            <select {...form.register('icon')} className={inputClass}>
              {PRESET_ICONS.map((icon) => (
                <option key={icon} value={icon}>
                  {icon}
                </option>
              ))}
            </select>
          </div>

          <div className="text-sm">
            <span className="mb-1 block font-medium">Icon Color</span>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => form.setValue('icon_color', color.value)}
                  className={`h-8 w-8 rounded-full border-2 ${
                    iconColor === color.value ? 'border-[var(--accent)]' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                />
              ))}
            </div>
          </div>

          <div className="text-sm">
            <span className="mb-1 block font-medium">Icon Background</span>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color.bg}
                  type="button"
                  onClick={() => form.setValue('icon_bg', color.bg)}
                  className={`h-8 w-8 rounded-full border-2 ${
                    iconBg === color.bg ? 'border-[var(--accent)]' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: color.bg }}
                  title={color.name}
                />
              ))}
            </div>
          </div>

          {serverError && <p className="text-sm text-red-600">{serverError}</p>}

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {submitting ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-full bg-zinc-200 px-5 py-2 text-sm font-semibold disabled:opacity-50 dark:bg-zinc-700">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
