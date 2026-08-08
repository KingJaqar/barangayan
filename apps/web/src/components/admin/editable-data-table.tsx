'use client';

import { useState, type ReactNode } from 'react';

import { useToast } from '@/components/ui/toast';

export interface EditableSelectOption {
  value: string;
  label: string;
}

export interface EditableCellConfig<T> {
  type: 'text' | 'number' | 'select' | 'datetime' | 'date';
  options?: EditableSelectOption[]; // required when type === 'select'
  getValue: (row: T) => string | number;
  /** Return { error: null } on success, { error: <message> } on failure — never throw. */
  onSave: (row: T, value: string | number) => Promise<{ error: string | null }>;
  /** Optional guard evaluated before entering edit mode, e.g. lock amount once paid. */
  canEdit?: (row: T) => boolean;
}

export interface EditableDataTableColumn<T> {
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
  /** A plain config applies to every row; a function lets the edit control itself vary
   * per row (e.g. Transactions' Collected By/Source is a select of admins for cash rows
   * but a free-text PayMongo source id for QR Ph rows) — return undefined to make that
   * row's cell non-editable. */
  edit?: EditableCellConfig<T> | ((row: T) => EditableCellConfig<T> | undefined);
}

function resolveEdit<T>(col: EditableDataTableColumn<T>, row: T): EditableCellConfig<T> | undefined {
  if (!col.edit) return undefined;
  return typeof col.edit === 'function' ? col.edit(row) : col.edit;
}

/** ISO timestamp -> the local-time string a <input type="datetime-local"> expects. */
function toDatetimeLocal(iso: string | number): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** The reverse — a datetime-local string back to an ISO timestamp for storage. */
function fromDatetimeLocal(local: string): string | null {
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

interface EditableDataTableProps<T> {
  columns: EditableDataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyLabel?: string;
  onRowClick?: (row: T) => void;
}

/** Same shell/markup as the read-only DataTable, plus click-to-edit cells: clicking a
 * cell with an `edit` config swaps it for an inline input/select, Enter or blur saves,
 * Escape cancels. Every save path is wired to useToast — this is also how the
 * "silent failure" mutation gap across the admin panel gets closed, by construction. */
export function EditableDataTable<T>({
  columns,
  rows,
  rowKey,
  emptyLabel = 'Nothing here yet.',
  onRowClick,
}: EditableDataTableProps<T>) {
  const toast = useToast();
  const [editing, setEditing] = useState<{ row: string; col: string } | null>(null);
  const [draft, setDraft] = useState<string>('');
  const [saving, setSaving] = useState(false);

  function startEdit(row: T, col: EditableDataTableColumn<T>) {
    const edit = resolveEdit(col, row);
    if (!edit || (edit.canEdit && !edit.canEdit(row))) return;
    setEditing({ row: rowKey(row), col: col.header });
    const raw = String(edit.getValue(row));
    setDraft(edit.type === 'datetime' ? toDatetimeLocal(raw) : raw);
  }

  function cancelEdit() {
    setEditing(null);
    setDraft('');
  }

  async function commitEdit(row: T, col: EditableDataTableColumn<T>) {
    const edit = resolveEdit(col, row);
    if (!edit || saving) return;

    let value: string | number = draft;
    if (edit.type === 'number') {
      value = Number(draft);
    } else if (edit.type === 'datetime') {
      const iso = fromDatetimeLocal(draft);
      if (!iso) {
        toast.showError('Enter a valid date and time.');
        return;
      }
      value = iso;
    }

    setSaving(true);
    const { error } = await edit.onSave(row, value);
    setSaving(false);
    if (error) {
      toast.showError(`Update failed: ${error}`);
      return;
    }
    setEditing(null);
    setDraft('');
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/10">
      <table className="w-full min-w-max text-left text-sm">
        <thead className="border-b border-black/10 bg-zinc-100 dark:border-white/10 dark:bg-zinc-900">
          <tr>
            {columns.map((col) => (
              <th key={col.header} className="px-4 py-3 font-semibold text-zinc-600 dark:text-zinc-300">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-zinc-500">
                {emptyLabel}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={rowKey(row)}
                className={`border-b border-black/5 last:border-0 dark:border-white/5 ${
                  onRowClick ? 'hover:bg-zinc-50 dark:hover:bg-zinc-900/50' : ''
                }`}>
                {columns.map((col) => {
                  const isEditing = editing?.row === rowKey(row) && editing?.col === col.header;
                  const edit = resolveEdit(col, row);
                  const editable = !!edit && (!edit.canEdit || edit.canEdit(row));

                  return (
                    <td
                      key={col.header}
                      className={`px-4 py-3 ${col.className ?? ''} ${
                        editable && !isEditing ? 'cursor-text hover:bg-[#0F6E5B]/5' : ''
                      } ${onRowClick && !editable ? 'cursor-pointer' : ''}`}
                      onClick={(e) => {
                        if (editable) {
                          e.stopPropagation();
                          startEdit(row, col);
                        } else if (onRowClick) {
                          onRowClick(row);
                        }
                      }}>
                      {isEditing && edit ? (
                        edit.type === 'select' ? (
                          <select
                            autoFocus
                            value={draft}
                            disabled={saving}
                            onChange={(e) => setDraft(e.target.value)}
                            onBlur={() => commitEdit(row, col)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitEdit(row, col);
                              if (e.key === 'Escape') cancelEdit();
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full rounded border border-[#0F6E5B] bg-white px-2 py-1 text-sm outline-none dark:bg-zinc-800">
                            {edit.options?.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            autoFocus
                            type={
                              edit.type === 'number'
                                ? 'number'
                                : edit.type === 'datetime'
                                  ? 'datetime-local'
                                  : edit.type === 'date'
                                    ? 'date'
                                    : 'text'
                            }
                            value={draft}
                            disabled={saving}
                            onChange={(e) => setDraft(e.target.value)}
                            onBlur={() => commitEdit(row, col)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitEdit(row, col);
                              if (e.key === 'Escape') cancelEdit();
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full rounded border border-[#0F6E5B] bg-white px-2 py-1 text-sm outline-none dark:bg-zinc-800"
                          />
                        )
                      ) : (
                        col.render(row)
                      )}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
