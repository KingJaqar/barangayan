'use client';

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

import { TableScrollArea } from '@/components/admin/table-scroll-area';
import { useToast } from '@/components/ui/toast';

// Floor for the last (filler) column under `resizableColumns` — enough room for a small
// action button or short status label, so it can't be squeezed to invisible by the other
// columns' pinned/`initialWidth` widths adding up to more than the table's available space.
const LAST_COLUMN_MIN_WIDTH = 88;

// Auto-measured (and pinned `initialWidth`) columns get this much extra breathing room over
// their tightest-fit natural size, so field values aren't crammed against the column edge.
const COLUMN_WIDTH_PADDING = 1.1;

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
  /** Commit a select as soon as its value changes instead of waiting for blur. */
  commitOnChange?: boolean;
  /** Optional guard evaluated before entering edit mode, e.g. lock amount once paid. */
  canEdit?: (row: T) => boolean;
}

export interface EditableDataTableColumn<T> {
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
  /** A plain config applies to every row; a function lets the edit control itself vary
   * per row (e.g. Transactions' Collected By/Source is a select of admins for pickup rows
   * but a free-text PayMongo source id for QR PH rows) — return undefined to make that
   * row's cell non-editable. */
  edit?: EditableCellConfig<T> | ((row: T) => EditableCellConfig<T> | undefined);
  /** Only used when `resizableColumns` is on: pins this column's starting width (px)
   * instead of auto-measuring it from its rendered content — e.g. giving Role/Address
   * more starting room than their header text alone would naturally claim. The user can
   * still drag it afterward like any other column. Ignored on the last column, which is
   * always the flexible filler regardless of this value. */
  initialWidth?: number;
  /** Floor used both for the initial measurement and while drag-resizing. */
  minWidth?: number;
  /** Opt-in text wrapping policy. Omitted preserves the table's existing behavior. */
  wrap?: 'normal' | 'nowrap' | 'break-word';
  /** Override the table-level cell overflow behavior for this column. */
  overflow?: 'hidden' | 'visible';
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
  /** Lets the user drag each header's right edge to resize that column, for tables whose
   * cell content varies a lot in length (e.g. Incident Reports' title/description column).
   * Off by default — opt in per table. */
  resizableColumns?: boolean;
  /** Pins the final column's initial width instead of using it as a flexible filler. */
  pinLastColumn?: boolean;
  /** Bumps the header/row divider lines from 1px to 2px. Off by default — opt in per table
   * (e.g. Requests, whose row content is dense enough to want a stronger separator). */
  thickBorders?: boolean;
  /** Reduces cell padding without changing the default density used by other tables. */
  density?: 'default' | 'compact';
  /** Deliberate table floor; narrower containers scroll instead of squeezing columns. */
  tableMinWidth?: number;
  /** Controls clipping for resizable cells. Defaults to the existing hidden behavior. */
  cellOverflow?: 'hidden' | 'visible';
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
  resizableColumns = false,
  pinLastColumn = false,
  thickBorders = false,
  density = 'default',
  tableMinWidth,
  cellOverflow = 'hidden',
}: EditableDataTableProps<T>) {
  const toast = useToast();
  const [editing, setEditing] = useState<{ row: string; col: string } | null>(null);
  const [draft, setDraft] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  // ── Resizable columns (opt-in) ────────────────────────────────────────────
  // Each header's width starts at its natural auto-layout size (measured right after
  // mount, before paint, so there's no flash) and is then pinned via <colgroup> once the
  // table switches to table-layout: fixed. Dragging a header's right-edge handle updates
  // just that column — the table's total width (and the scrollbars above/below it) grows
  // or shrinks accordingly, it isn't redistributed across the other columns.
  //
  // By default, the last column stays unpinned and acts as a flexible filler so row lines
  // reach the card edge. Tables that need a deliberate final-column width can opt into
  // `pinLastColumn` without changing other resizable tables.
  const thRefs = useRef<Record<string, HTMLTableCellElement | null>>({});
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const pinnedColumns = resizableColumns ? (pinLastColumn ? columns : columns.slice(0, -1)) : [];

  useLayoutEffect(() => {
    if (!resizableColumns) return;
    setColWidths((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const col of pinnedColumns) {
        if (next[col.header] === undefined) {
          const measuredWidth = col.initialWidth ?? thRefs.current[col.header]?.getBoundingClientRect().width;
          const paddedWidth = measuredWidth ? Math.round(measuredWidth * COLUMN_WIDTH_PADDING) : undefined;
          const width = paddedWidth && col.minWidth !== undefined ? Math.max(col.minWidth, paddedWidth) : paddedWidth;
          if (width) {
            next[col.header] = width;
            changed = true;
          }
        }
      }
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resizableColumns, columns]);

  function startColumnResize(e: React.MouseEvent, header: string) {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const column = columns.find((col) => col.header === header);
    const minWidth = column?.minWidth ?? 60;
    const startWidth = colWidths[header] ?? thRefs.current[header]?.getBoundingClientRect().width ?? Math.max(120, minWidth);

    function onMove(ev: MouseEvent) {
      const next = Math.max(minWidth, Math.round(startWidth + (ev.clientX - startX)));
      setColWidths((prev) => ({ ...prev, [header]: next }));
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  const columnsMeasured = resizableColumns && pinnedColumns.every((col) => colWidths[col.header] !== undefined);
  const headerPadding = density === 'compact' ? 'px-3 py-2.5' : 'px-5 py-3.5';
  const cellPadding = density === 'compact' ? 'px-3 py-2.5' : 'px-5 py-3.5';

  function startEdit(row: T, col: EditableDataTableColumn<T>) {
    if (savingRef.current) return;
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

  async function commitEdit(row: T, col: EditableDataTableColumn<T>, draftOverride?: string) {
    const edit = resolveEdit(col, row);
    if (!edit || savingRef.current) return;

    let value: string | number = draftOverride ?? draft;
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

    savingRef.current = true;
    setSaving(true);
    let error: string | null;
    try {
      ({ error } = await edit.onSave(row, value));
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'The update could not be completed.';
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
    if (error) {
      toast.showError(`Update failed: ${error}`);
      cancelEdit();
      return;
    }
    setEditing(null);
    setDraft('');
  }

  return (
    <TableScrollArea>
      <table
        // w-full only kicks in once the pinned columns are measured and the table is on
        // fixed layout — applying it during the brief unmeasured auto-layout pass would
        // stretch the very widths startColumnResize is trying to capture as "natural".
        className={`text-left text-sm ${!resizableColumns ? 'w-full min-w-max' : columnsMeasured ? 'w-full' : ''}`}
        style={{
          ...(columnsMeasured ? { tableLayout: 'fixed' as const } : {}),
          ...(tableMinWidth ? { minWidth: tableMinWidth } : {}),
        }}
      >
        {resizableColumns && (
          <colgroup>
            {columns.map((col) => (
              <col
                key={col.header}
                style={{
                  ...(colWidths[col.header] ? { width: colWidths[col.header] } : {}),
                  ...(col.minWidth ? { minWidth: col.minWidth } : {}),
                }}
              />
            ))}
          </colgroup>
        )}
        <thead
          className={`${
            thickBorders ? 'border-b-2 border-zinc-300 dark:border-zinc-600' : 'border-b border-black/10 dark:border-white/10'
          } bg-zinc-50 dark:bg-zinc-800/60`}
        >
          <tr>
            {columns.map((col, colIndex) => (
              <th
                key={col.header}
                ref={(el) => {
                  thRefs.current[col.header] = el;
                }}
                // The last (filler) column gets a floor so it can never be squeezed to
                // invisible by the other columns' pinned/initial widths adding up to more
                // than the table's available space.
                style={{
                  minWidth:
                    Math.max(
                      col.minWidth ?? 0,
                      resizableColumns && !pinLastColumn && colIndex === columns.length - 1 ? LAST_COLUMN_MIN_WIDTH : 0,
                    ) || undefined,
                }}
                className={`relative ${headerPadding} text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 ${
                  thickBorders && colIndex < columns.length - 1 ? 'border-r-2 border-zinc-300 dark:border-zinc-600' : ''
                }`}
              >
                <span className="block truncate" title={col.header}>
                  {col.header}
                </span>
                {resizableColumns && (
                  <div
                    onMouseDown={(e) => startColumnResize(e, col.header)}
                    title="Drag to resize"
                    className="absolute inset-y-0 right-0 w-1.5 cursor-col-resize select-none hover:bg-[var(--accent)]/40 active:bg-[var(--accent)]"
                  />
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-5 py-8 text-center text-zinc-500">
                {emptyLabel}
              </td>
            </tr>
          ) : (
            rows.map((row, rowIndex) => (
              <tr
                key={rowKey(row)}
                className={`${
                  thickBorders ? 'border-b-2 border-zinc-300 dark:border-zinc-600' : 'border-b border-black/5 dark:border-white/5'
                } last:border-0 ${rowIndex % 2 === 1 ? 'bg-zinc-50/60 dark:bg-zinc-900/20' : ''} ${
                  onRowClick ? 'hover:bg-zinc-100 dark:hover:bg-zinc-900/50' : ''
                }`}
              >
                {columns.map((col, colIndex) => {
                  const isEditing = editing?.row === rowKey(row) && editing?.col === col.header;
                  const edit = resolveEdit(col, row);
                  const editable = !!edit && (!edit.canEdit || edit.canEdit(row));

                  return (
                    <td
                      key={col.header}
                      style={{
                        minWidth:
                          Math.max(
                            col.minWidth ?? 0,
                            resizableColumns && !pinLastColumn && colIndex === columns.length - 1 ? LAST_COLUMN_MIN_WIDTH : 0,
                          ) || undefined,
                      }}
                      className={`${cellPadding} ${
                        (col.overflow ?? (resizableColumns ? cellOverflow : 'visible')) === 'hidden' ? 'overflow-hidden' : 'overflow-visible'
                      } ${
                        col.wrap === 'nowrap'
                          ? 'whitespace-nowrap'
                          : col.wrap === 'break-word'
                            ? 'whitespace-normal break-words'
                            : col.wrap === 'normal'
                              ? 'whitespace-normal'
                              : ''
                      } ${
                        thickBorders && colIndex < columns.length - 1 ? 'border-r-2 border-zinc-300 dark:border-zinc-600' : ''
                      } ${col.className ?? ''} ${editable && !isEditing ? 'cursor-text hover:bg-[var(--accent)]/5' : ''} ${
                        onRowClick && !editable ? 'cursor-pointer' : ''
                      }`}
                      onClick={(e) => {
                        if (editable) {
                          e.stopPropagation();
                          startEdit(row, col);
                        } else if (onRowClick) {
                          onRowClick(row);
                        }
                      }}
                    >
                      {isEditing && edit ? (
                        edit.type === 'select' ? (
                          <div className="space-y-1">
                            <select
                              autoFocus
                              value={draft}
                              disabled={saving}
                              aria-busy={saving}
                              onChange={(e) => {
                                const nextDraft = e.target.value;
                                setDraft(nextDraft);
                                if (edit.commitOnChange) void commitEdit(row, col, nextDraft);
                              }}
                              onBlur={() => {
                                if (!edit.commitOnChange) void commitEdit(row, col);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !edit.commitOnChange) void commitEdit(row, col);
                                if (e.key === 'Escape' && !savingRef.current) cancelEdit();
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full rounded border border-[var(--accent)] bg-white px-2 py-1 text-sm outline-none disabled:cursor-wait disabled:opacity-70 dark:bg-zinc-800"
                            >
                              {edit.options?.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                            {saving && <span className="block text-xs text-zinc-500">Saving…</span>}
                          </div>
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
                            className="w-full rounded border border-[var(--accent)] bg-white px-2 py-1 text-sm outline-none dark:bg-zinc-800"
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
    </TableScrollArea>
  );
}
