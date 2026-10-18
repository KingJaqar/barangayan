'use client';

import { AdminSelect } from '@/components/admin/dropdown/admin-select';
import type { AdminSelectKind } from '@/components/admin/dropdown/select-iconography';

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';

import { TableScrollArea } from '@/components/admin/table-scroll-area';
import { BROWSE_ROW_HEIGHT, BROWSE_VISIBLE_ROWS } from '@/components/admin/table-browse-layout';
import { useSearchParams } from 'next/navigation';
import { PAGE_SIZES, type PageSize } from '@/lib/admin-tables/browse-state';
import { beginAttempt, notify as toast } from '@/lib/notify';
import { Spinner } from '@/components/loading/spinner';
import { useBrowseViewport } from './table-browse-panel';
import type { SortDescriptor, SortDirection } from '@/lib/admin-tables/sort-definitions';
import { useRowContextMenu } from './row-context-menu';
import styles from './editable-data-table.module.css';

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
  selectKind?: AdminSelectKind;
  getValue: (row: T) => string | number;
  /** Return { error: null } on success, { error: <message> } on failure — never throw. */
  onSave: (row: T, value: string | number) => Promise<{ error: string | null; row?: unknown }>;
  /** Commit a select as soon as its value changes instead of waiting for blur. */
  commitOnChange?: boolean;
  /** Optional guard evaluated before entering edit mode, e.g. lock amount once paid. */
  canEdit?: (row: T) => boolean;
}

export interface EditableDataTableColumn<T> {
  /** Stable identity; legacy callers continue to use their header as the identity. */
  id?: string;
  header: string;
  render: (row: T, rowIndex: number) => ReactNode;
  className?: string;
  /** A plain config applies to every row; a function lets the edit control itself vary
   * per row (e.g. Transactions' Collected By/Source is a select of admins for pickup rows
   * but a free-text PayMongo source id for QR PH rows) — return undefined to make that
   * row's cell non-editable. */
  edit?: EditableCellConfig<T> | ((row: T) => EditableCellConfig<T> | undefined);
  /** Editors for multiple stored values displayed together in a single cell. */
  rowEdit?: { label: string; edit: EditableCellConfig<T> }[];
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
  /** Keep this column visible at the left edge during horizontal scrolling. */
  frozen?: boolean;
}

function positive(value: string | null, fallback = 1) {
  return value && /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : fallback;
}
function columnId<T>(col: EditableDataTableColumn<T>) { return col.id ?? col.header; }
export interface TableEditHandle { settle: () => Promise<boolean>; cancel: () => void; editRow: (key: string) => Promise<void> }
type RowEditField<T> = { owner: string; col: EditableDataTableColumn<T>; edit: EditableCellConfig<T>; saved: string };

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
  /** Opt in to right-click menus using the mounted controls in this column. */
  contextMenuColumnId?: string;
  sorting?: { descriptor: SortDescriptor; direction: SortDirection; choices: readonly SortDescriptor[];
    onChange: (key: string, direction: SortDirection) => void };
  editHandleRef?: RefObject<TableEditHandle | null>;
  onEditingChange?: (editing: boolean) => void;
  columns: EditableDataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyLabel?: string;
  onRowClick?: (row: T, trigger?: HTMLElement) => void;
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
 * Escape cancels. Every save path uses the admin notification adapter — this is also how the
 * "silent failure" mutation gap across the admin panel gets closed, by construction. */
export function EditableDataTable<T>({
  contextMenuColumnId,
  columns: columnsProp,
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
  sorting,
  editHandleRef,
  onEditingChange,
}: EditableDataTableProps<T>) {
  const contextMenu = useRowContextMenu();
  const { bounded } = useBrowseViewport();
  // Browse tables always lead with a running row number that continues across pages: page 2 at
  // 10 per page starts at 11. The URL is the source of truth for page/pageSize (same parsing as
  // parseBrowseState), so every screen numbers correctly without per-screen wiring.
  const params = useSearchParams();
  const rowOffset = (positive(params.get('page')) - 1) * (PAGE_SIZES.includes(positive(params.get('pageSize'), 10) as PageSize) ? positive(params.get('pageSize'), 10) : 10);
  const columns = useMemo<EditableDataTableColumn<T>[]>(() => bounded ? [{ id: '__row', header: '#', initialWidth: 64, minWidth: 48,
    frozen: columnsProp.some(col => col.frozen),
    wrap: 'nowrap', className: 'tabular-nums text-zinc-500', render: (_row, index) => rowOffset + index + 1 }, ...columnsProp] : columnsProp,
    [bounded, columnsProp, rowOffset]);
  const [editing, setEditing] = useState<{ row: string; col: string } | null>(null);
  const [rowEditing, setRowEditing] = useState<{ key: string; drafts: Record<string, string>; fields: RowEditField<T>[] } | null>(null);
  const rowSnapshot = useRef<{ row: T; fields: RowEditField<T>[] } | null>(null);
  const [draft, setDraft] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const savePromise = useRef<Promise<boolean> | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const editSnapshot = useRef<{ row: T; col: EditableDataTableColumn<T> } | null>(null);
  const editTrigger = useRef<HTMLElement | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const resizeCleanup = useRef<(() => void) | null>(null);
  const focusFrame = useRef(0);
  const mounted = useRef(true);
  useLayoutEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; resizeCleanup.current?.(); cancelAnimationFrame(focusFrame.current); };
  }, []);
  const editingActive = editing !== null || rowEditing !== null;
  useEffect(() => { onEditingChange?.(editingActive); }, [editingActive, onEditingChange]);

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
    const table = tableRef.current;
    const frozenHeaders = columns.flatMap((col, index) => {
      const header = thRefs.current[columnId(col)];
      return col.frozen && header ? [{ header, index }] : [];
    });
    if (!table || !frozenHeaders.length) return;
    function updateOffsets() {
      let left = 0;
      for (const { header, index } of frozenHeaders) {
        table!.style.setProperty(`--frozen-left-${index}`, `${left}px`);
        // Use rendered CSS widths: table floors can stretch columns beyond colWidths.
        left += parseFloat(getComputedStyle(header).width);
      }
    }
    updateOffsets();
    const observer = new ResizeObserver(updateOffsets);
    for (const { header } of frozenHeaders) observer.observe(header);
    return () => observer.disconnect();
  }, [columns]);

  useLayoutEffect(() => {
    if (!resizableColumns) return;
    setColWidths((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const col of pinnedColumns) {
        if (next[columnId(col)] === undefined) {
          const measuredWidth = col.initialWidth ?? thRefs.current[columnId(col)]?.getBoundingClientRect().width;
          const paddedWidth = measuredWidth ? Math.round(measuredWidth * COLUMN_WIDTH_PADDING) : undefined;
          const width = paddedWidth && col.minWidth !== undefined ? Math.max(col.minWidth, paddedWidth) : paddedWidth;
          if (width) {
            next[columnId(col)] = width;
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
    resizeCleanup.current?.();
    const startX = e.clientX;
    const column = columns.find((col) => columnId(col) === header);
    const minWidth = column?.minWidth ?? 60;
    const startWidth = colWidths[header] ?? thRefs.current[header]?.getBoundingClientRect().width ?? Math.max(120, minWidth);

    function onMove(ev: MouseEvent) {
      const next = Math.max(minWidth, Math.round(startWidth + (ev.clientX - startX)));
      setColWidths((prev) => ({ ...prev, [header]: next }));
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      resizeCleanup.current = null;
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    resizeCleanup.current = onUp;
  }

  const columnsMeasured = resizableColumns && pinnedColumns.every((col) => colWidths[columnId(col)] !== undefined);
  const headerPadding = density === 'compact' ? 'px-3 py-2.5' : 'px-5 py-3.5';
  const cellPadding = density === 'compact' ? 'px-3 py-2.5' : 'px-5 py-3.5';

  function startEdit(row: T, col: EditableDataTableColumn<T>) {
    if (savingRef.current || rowEditing || (bounded && editing)) return;
    const edit = resolveEdit(col, row);
    if (!edit || (edit.canEdit && !edit.canEdit(row))) return;
    setEditing({ row: rowKey(row), col: columnId(col) });
    editSnapshot.current = { row, col };
    setSaveError(null);
    const raw = String(edit.getValue(row));
    setDraft(edit.type === 'datetime' ? toDatetimeLocal(raw) : raw);
  }

  function cancelEdit() {
    if (savingRef.current) return;
    setEditing(null);
    setRowEditing(null);
    rowSnapshot.current = null;
    setDraft('');
    setSaveError(null);
    editSnapshot.current = null;
    if (bounded) {
      cancelAnimationFrame(focusFrame.current);
      focusFrame.current = requestAnimationFrame(() => {
      if (editTrigger.current?.isConnected) editTrigger.current.focus({ preventScroll: true });
      else tableRef.current?.closest<HTMLElement>('[role=region]')?.focus({ preventScroll: true });
      });
    }
  }

  async function startRowEdit(key: string) {
    if (savingRef.current) return;
    if (rowEditing?.key === key) return;
    if (!await settleEdit()) return;
    const row = rows.find(item => rowKey(item) === key);
    if (!row) return;
    const fields = columns.flatMap(col => {
      const single = resolveEdit<T>(col, row);
      const configs = col.rowEdit ?? (single ? [{ label: col.header, edit: single }] : []);
      return configs.flatMap(({ label, edit }, index) => {
        if (edit.canEdit && !edit.canEdit(row)) return [];
        const raw = String(edit.getValue(row));
        return [{ owner: columnId(col), col: { ...col, id: `${columnId(col)}:${index}`, header: label }, edit, saved: edit.type === 'datetime' ? toDatetimeLocal(raw) : raw }];
      });
    });
    if (!fields.length) return;
    editTrigger.current = tableRef.current?.querySelector<HTMLElement>('button:focus') ?? null;
    rowSnapshot.current = { row, fields };
    setSaveError(null);
    setRowEditing({ key, fields, drafts: Object.fromEntries(fields.map(({ col, saved }) => [columnId(col), saved])) });
  }

  function settleEdit(): Promise<boolean> {
    if (rowSnapshot.current) return commitRow();
    const snapshot = editSnapshot.current;
    return snapshot ? commitEdit(snapshot.row, snapshot.col) : Promise.resolve(true);
  }

  function commitRow(): Promise<boolean> {
    if (savePromise.current) return savePromise.current;
    const promise = performRowCommit();
    savePromise.current = promise;
    void promise.finally(() => { if (savePromise.current === promise) savePromise.current = null; });
    return promise;
  }

  async function performRowCommit(): Promise<boolean> {
    const toastAttempt = beginAttempt('performRowCommit');
    const snapshot = rowSnapshot.current;
    if (!snapshot || !rowEditing || savingRef.current) return false;
    // Parse numeric and datetime drafts before writing. Reuse the existing field handlers;
    // successful fields are marked so retrying a later failure never resubmits them.
    const changes: { field: typeof snapshot.fields[number]; draft: string; value: string | number }[] = [];
    for (const field of snapshot.fields) {
      const next = rowEditing.drafts[columnId(field.col)];
      if (next === field.saved) continue;
      const value = field.edit.type === 'number' ? Number(next) : field.edit.type === 'datetime' ? fromDatetimeLocal(next) : next;
      if (value === null || (field.edit.type === 'number' && (!next.trim() || !Number.isFinite(value)))) {
        setSaveError(`Enter a valid ${field.col.header.toLowerCase()}.`);
        toast.error(`Enter a valid ${field.col.header.toLowerCase()}.`, { id: toastAttempt });
        return false;
      }
      changes.push({ field, draft: next, value });
    }
    savingRef.current = true; setSaving(true); setSaveError(null);
    try {
      for (const { field, draft: next, value } of changes) {
        const result = await field.edit.onSave(snapshot.row, value);
        if (result.error) throw new Error(`${field.col.header}: ${result.error}`);
        field.saved = next;
        if (result.row && typeof result.row === 'object' && 'id' in result.row && result.row.id === rowKey(snapshot.row)) {
          snapshot.row = { ...snapshot.row, ...result.row };
        }
      }
      if (changes.length) toast.success('Changes saved.', { id: toastAttempt });
      if (mounted.current) { savingRef.current = false; cancelEdit(); }
      return true;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'The update could not be completed.';
      if (mounted.current) { setSaveError(message); toast.error(`Update failed: ${message}`, { id: toastAttempt }); }
      return false;
    } finally {
      savingRef.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  function commitEdit(row: T, col: EditableDataTableColumn<T>, draftOverride?: string): Promise<boolean> {
    if (savePromise.current) return savePromise.current;
    const promise = performCommit(row, col, draftOverride);
    savePromise.current = promise;
    void promise.finally(() => { if (savePromise.current === promise) savePromise.current = null; });
    return promise;
  }

  async function performCommit(row: T, col: EditableDataTableColumn<T>, draftOverride?: string): Promise<boolean> {
    const toastAttempt = beginAttempt('performCommit');
    row = editSnapshot.current?.row ?? row;
    const edit = resolveEdit(col, row);
    if (!edit || savingRef.current) return false;

    let value: string | number = draftOverride ?? draft;
    if (edit.type === 'number') {
      value = Number(draft);
    } else if (edit.type === 'datetime') {
      const iso = fromDatetimeLocal(draft);
      if (!iso) {
        toast.error('Enter a valid date and time.', { id: toastAttempt });
        setSaveError('Enter a valid date and time.');
        return false;
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
      if (mounted.current) setSaving(false);
    }
    if (!mounted.current) return false;
    if (error) {
      toast.error(`Update failed: ${error}`, { id: toastAttempt });
      if (bounded) setSaveError(error); else cancelEdit();
      return false;
    }
    if (String(value) !== String(edit.getValue(row))) toast.success('Changes saved.', { id: toastAttempt });
    cancelEdit();
    return true;
  }

  useLayoutEffect(() => {
    if (!editHandleRef) return;
    editHandleRef.current = {
      settle: settleEdit,
      cancel: cancelEdit,
      editRow: startRowEdit,
    };
    return () => { editHandleRef.current = null; };
  });

  return (
    <TableScrollArea>
      <table
        ref={tableRef}
        // w-full only kicks in once the pinned columns are measured and the table is on
        // fixed layout — applying it during the brief unmeasured auto-layout pass would
        // stretch the very widths startColumnResize is trying to capture as "natural".
        className={`${styles.table} text-left text-sm ${!resizableColumns ? 'w-full min-w-max' : columnsMeasured ? 'w-full' : ''}`}
        style={{
          ...(columnsMeasured ? { tableLayout: 'fixed' as const } : {}),
          ...(tableMinWidth ? { minWidth: tableMinWidth } : {}),
        }}
      >
        {resizableColumns && (
          <colgroup>
            {columns.map((col) => (
              <col
                key={columnId(col)}
                style={{
                  ...(colWidths[columnId(col)] ? { width: colWidths[columnId(col)] } : {}),
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
                data-frozen={col.frozen || undefined}
                scope="col"
                aria-sort={sorting?.descriptor.columnId === columnId(col) ? (sorting.direction === 'asc' ? 'ascending' : 'descending') : undefined}
                key={columnId(col)}
                ref={(el) => {
                  thRefs.current[columnId(col)] = el;
                }}
                // The last (filler) column gets a floor so it can never be squeezed to
                // invisible by the other columns' pinned/initial widths adding up to more
                // than the table's available space.
                style={{
                  left: col.frozen ? `var(--frozen-left-${colIndex}, 0px)` : undefined,
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
                {sorting?.choices.some(sort => sort.columnId === columnId(col)) ? (
                  <button type="button" onClick={async () => {
                    const sort = sorting.choices.find(item => item.columnId === columnId(col))!;
                    const snapshot = editSnapshot.current;
                    if (snapshot && !await commitEdit(snapshot.row, snapshot.col)) return;
                    const next = sorting.descriptor.key === sort.key
                      ? sort.directions.find(dir => dir !== sorting.direction) ?? sorting.direction : sort.initialDirection;
                    sorting.onChange(sort.key, next);
                  }}>{col.header}</button>
                ) : <span className="block truncate" title={col.header}>{col.header}</span>}
                {resizableColumns && (
                  <div
                    role={bounded ? 'separator' : undefined}
                    tabIndex={bounded ? 0 : undefined}
                    aria-label={bounded ? `Resize ${col.header}` : undefined}
                    aria-orientation={bounded ? 'vertical' : undefined}
                    aria-valuenow={bounded ? Math.round(colWidths[columnId(col)] ?? col.initialWidth ?? 120) : undefined}
                    aria-valuemin={bounded ? col.minWidth ?? 60 : undefined}
                    onKeyDown={bounded ? (event) => {
                      if (!['ArrowLeft', 'ArrowRight', 'Home'].includes(event.key)) return;
                      event.preventDefault(); event.stopPropagation();
                      const min = col.minWidth ?? 60;
                      const delta = (event.key === 'ArrowLeft' ? -1 : 1) * (event.shiftKey ? 50 : 10);
                      setColWidths(prev => ({ ...prev, [columnId(col)]: event.key === 'Home' ? min : Math.max(min, (prev[columnId(col)] ?? 120) + delta) }));
                    } : undefined}
                    onMouseDown={(e) => startColumnResize(e, columnId(col))}
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
            <tr style={bounded ? { height: BROWSE_ROW_HEIGHT } : undefined}>
              <td colSpan={columns.length} className={`px-5 ${bounded ? 'py-0' : 'py-8'} text-center text-zinc-500`}>
                {emptyLabel}
              </td>
            </tr>
          ) : (
            rows.map((row, rowIndex) => (
              <tr
                key={rowKey(row)}
                data-clickable={onRowClick ? '' : undefined}
                data-context-menu-open={contextMenu.activeRowKey === rowKey(row) ? '' : undefined}
                onContextMenu={contextMenuColumnId ? event => contextMenu.open(event, rowKey(row)) : undefined}
                style={bounded ? { height: BROWSE_ROW_HEIGHT } : undefined}
                className={`${
                  thickBorders ? 'border-b-2 border-zinc-300 dark:border-zinc-600' : 'border-b border-black/5 dark:border-white/5'
                } last:border-0 ${rowIndex % 2 === 1 ? 'bg-zinc-50/60 dark:bg-zinc-900/20' : ''} ${
                  onRowClick ? 'hover:bg-zinc-100 dark:hover:bg-zinc-900/50' : ''
                }`}
              >
                {columns.map((col, colIndex) => {
                  const rowFields = rowEditing?.key === rowKey(row) ? rowEditing.fields.filter(field => field.owner === columnId(col)) : [];
                  const rowField = rowFields[0];
                  const isEditing = !!rowField || (editing?.row === rowKey(row) && editing?.col === columnId(col));
                  const edit = rowField?.edit ?? resolveEdit(col, row);
                  const editable = !!edit && (!edit.canEdit || edit.canEdit(row));

                  return (
                    <td
                      data-frozen={col.frozen || undefined}
                      data-editable={col.frozen && editable && !isEditing ? '' : undefined}
                      data-context-menu-actions={contextMenuColumnId === columnId(col) ? '' : undefined}
                      tabIndex={bounded && !isEditing && (editable || onRowClick) ? 0 : undefined}
                      aria-label={bounded && editable && !isEditing ? `${col.header}: press Enter to edit` : undefined}
                      onKeyDown={bounded ? event => {
                        if (event.target !== event.currentTarget || !['Enter', ' '].includes(event.key)) return;
                        event.preventDefault();
                        if (editable) { editTrigger.current = event.currentTarget; startEdit(row, col); }
                        else if (contextMenuColumnId !== columnId(col) && !rowEditing) onRowClick?.(row, event.currentTarget);
                      } : undefined}
                      key={columnId(col)}
                      style={{
                        left: col.frozen ? `var(--frozen-left-${colIndex}, 0px)` : undefined,
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
                        if (contextMenuColumnId === columnId(col) || rowEditing || (e.target instanceof Element && e.target.closest('button,a,input,select,textarea,[role=combobox]'))) return;
                        if (editable) {
                          e.stopPropagation();
                          editTrigger.current = e.currentTarget;
                          startEdit(row, col);
                        } else if (onRowClick) {
                          onRowClick(row, e.currentTarget);
                        }
                      }}
                    >
                      {rowEditing?.key === rowKey(row) && contextMenuColumnId === columnId(col) ? <div onClick={event => event.stopPropagation()}>
                        {saveError && <p role="alert" className="whitespace-normal text-sm text-red-600">{saveError}</p>}
                        <div className="flex gap-3">
                          <button type="button" disabled={saving} onClick={() => void commitRow()}>{saving ? 'Saving…' : saveError ? 'Retry save' : 'Save row'}</button>
                          <button type="button" disabled={saving} onClick={cancelEdit}>Cancel edit</button>
                        </div>
                      </div> : rowField && rowEditing ? <div data-inline-editor onClick={event => event.stopPropagation()} onKeyDown={event => {
                        if (event.key === 'Escape' && !event.defaultPrevented) { event.stopPropagation(); cancelEdit(); }
                      }}>
                        {rowFields.map(field => <div key={columnId(field.col)} className="mb-1 last:mb-0">
                          {rowFields.length > 1 && <span className="text-xs text-zinc-500">{field.col.header}</span>}
                          {field.edit.type === 'select' ? <AdminSelect compact kind={field.edit.selectKind} aria-label={`Edit ${field.col.header}`}
                            value={rowEditing.drafts[columnId(field.col)]} disabled={saving}
                            onValueChange={value => setRowEditing(current => current && ({ ...current, drafts: { ...current.drafts, [columnId(field.col)]: value } }))}
                            options={field.edit.options} /> : <input aria-label={`Edit ${field.col.header}`}
                            type={field.edit.type === 'datetime' ? 'datetime-local' : field.edit.type}
                            value={rowEditing.drafts[columnId(field.col)]} disabled={saving}
                            onChange={event => setRowEditing(current => current && ({ ...current, drafts: { ...current.drafts, [columnId(field.col)]: event.target.value } }))}
                            onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void commitRow(); } }}
                            className="w-full rounded border border-[var(--accent)] bg-white px-2 py-1 text-sm outline-none dark:bg-zinc-800" />}
                        </div>)}
                      </div> : isEditing && edit ? <div data-inline-editor onClick={event => event.stopPropagation()}>
                        {saveError && <div role="alert" className="text-sm text-red-600">{saveError}</div>}
                        {(
                        edit.type === 'select' ? (
                          <div className="space-y-1">
                            <AdminSelect compact kind={edit.selectKind}
                              aria-label={`Edit ${col.header}`}
                              autoFocus
                              value={draft}
                              disabled={saving}
                              aria-busy={saving}
                              onValueChange={(nextValue) => {
                                const nextDraft = nextValue;
                                setDraft(nextDraft);
                                if (edit.commitOnChange) void commitEdit(row, col, nextDraft);
                              }}
                              onBlur={(event) => {
                                if (event.relatedTarget instanceof Node && event.currentTarget.closest('[data-inline-editor]')?.contains(event.relatedTarget)) return;
                                if (!saveError && !edit.commitOnChange) void commitEdit(editSnapshot.current?.row ?? row, col);
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
                            </AdminSelect>
                            {saving && (
                              <span role="status" aria-live="polite" aria-atomic="true" className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
                                <Spinner size="compact" /> Saving…
                              </span>
                            )}
                          </div>
                        ) : (
                          <input
                            aria-label={`Edit ${col.header}`}
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
                            onBlur={(event) => {
                              if (event.relatedTarget instanceof Node && event.currentTarget.parentElement?.contains(event.relatedTarget)) return;
                              if (!saveError) void commitEdit(editSnapshot.current?.row ?? row, col);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitEdit(row, col);
                              if (e.key === 'Escape') cancelEdit();
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full rounded border border-[var(--accent)] bg-white px-2 py-1 text-sm outline-none dark:bg-zinc-800"
                          />
                        )
                        )}
                        {bounded && <div className="flex gap-2">
                          <button type="button" disabled={saving} onClick={() => void commitEdit(editSnapshot.current?.row ?? row, col)}>{saveError ? 'Retry save' : 'Save'}</button>
                          <button type="button" disabled={saving} onClick={cancelEdit}>Cancel edit</button>
                        </div>}
                      </div> : (
                        col.render(row, rowIndex)
                      )}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
          {bounded && Array.from({ length: Math.max(0, BROWSE_VISIBLE_ROWS - Math.max(rows.length, 1)) }, (_, index) =>
            <tr key={`filler-${index}`} aria-hidden="true" data-filler-row style={{ height: BROWSE_ROW_HEIGHT }}
              className="border-b border-black/5 last:border-0 dark:border-white/5">
              <td colSpan={columns.length} />
            </tr>)}
        </tbody>
      </table>
      {contextMenu.menu}
    </TableScrollArea>
  );
}
