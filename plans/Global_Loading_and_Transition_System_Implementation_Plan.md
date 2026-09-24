# Global Loading and Transition System — Implementation Plan

## Current-state findings

The admin app already has a persistent shell and a few useful foundations:

- The sidebar and page content are separated in [admin-shell.tsx](C:/Users/User/barangayan/apps/admin-web/src/components/admin/admin-shell.tsx).
- Navigation uses Next.js `<Link>` in [sidebar-nav.tsx](C:/Users/User/barangayan/apps/admin-web/src/components/admin/sidebar-nav.tsx).
- Global success/error feedback exists in [toast.tsx](C:/Users/User/barangayan/apps/admin-web/src/components/ui/toast.tsx).
- A reusable CSS mount/unmount transition exists in [use-mount-transition.ts](C:/Users/User/barangayan/apps/admin-web/src/hooks/use-mount-transition.ts).
- A shimmer animation already exists in [globals.css](C:/Users/User/barangayan/apps/admin-web/src/app/globals.css).

The main problems are:

- No shared `loading.tsx` or admin error boundary.
- Repeated `busy`, `saving`, `submitting`, and `loading` booleans across screens.
- Direct Supabase operations followed by broad `router.refresh()` calls.
- No uniform optimistic-update or rollback behavior.
- Some handlers lack `try/finally`, so an unexpected thrown error could leave a button busy.
- Client fetch hooks do not consistently cancel stale requests.
- Toasts use assertive `role="alert"` for success as well as failure.
- No shared handling for double submissions, delayed responses, conflicts, or mutations initiated from multiple components.

---

# 1. Recommended architecture

Use four independent layers, each with one clear owner.

| Layer | State owner | Visual feedback |
|---|---|---|
| Route/navigation | Next.js router | Pending state inside clicked sidebar item, followed by route skeleton |
| Initial page/server data | Next.js `loading.tsx` and Suspense | Page-shaped skeleton |
| Client queries and refreshes | TanStack Query | Initial skeleton or local refresh indicator |
| Mutations and actions | TanStack Query mutation | Loading button, optimistic state, inline error, toast |

Do not maintain one application-wide loading count for all activity. A notification refresh should not trigger a page loader, and saving one table row should not block the entire screen.

### Data ownership

- Continue using React Server Components for authentication, layout data, and server-rendered initial data.
- Use TanStack Query for data that can be refreshed, mutated, optimistically updated, paginated, or shared between multiple client components.
- Pass server-fetched data into client queries as `initialData` during gradual migration.
- For each dataset, choose either the React Query cache or the current Server Component payload as its live client-side source. Do not perform both `invalidateQueries()` and `router.refresh()` for the same operation unless two genuinely different data sources must be refreshed.

### Recommended dependency

Add `@tanstack/react-query` to `apps/admin-web`.

TanStack Query provides the exact primitives needed here: mutation states, targeted invalidation, optimistic cache snapshots, rollbacks, shared mutation visibility, and query cancellation. Its recommended optimistic flow is cancel → snapshot → update → rollback on failure → invalidate on settlement. [Official TanStack mutation documentation](https://tanstack.com/query/latest/docs/framework/react/reference/functions/useMutation)

---

# 2. Proposed folder structure

```text
apps/admin-web/src/
├── app/
│   ├── layout.tsx
│   └── (admin)/
│       ├── layout.tsx
│       ├── loading.tsx
│       ├── error.tsx
│       ├── dashboard/loading.tsx          # optional specialized variants
│       ├── requests/loading.tsx
│       └── residents/loading.tsx
│
├── components/
│   ├── async/
│   │   ├── async-system-provider.tsx
│   │   ├── loading-button.tsx
│   │   ├── spinner.tsx
│   │   ├── skeleton.tsx
│   │   ├── page-skeleton.tsx
│   │   ├── section-state.tsx
│   │   ├── inline-error.tsx
│   │   ├── loading-overlay.tsx
│   │   └── async-status.tsx
│   ├── navigation/
│   │   └── sidebar-link.tsx
│   └── ui/
│       └── toast.tsx                      # extend the existing provider
│
├── lib/
│   ├── async/
│   │   ├── query-client.ts
│   │   ├── query-keys.ts
│   │   ├── errors.ts
│   │   └── status.ts
│   └── supabase/
│       ├── client.ts
│       └── queries/
│
├── hooks/
│   ├── use-single-flight.ts
│   └── use-delayed-pending.ts
│
└── features/
    ├── requests/
    │   ├── queries.ts
    │   ├── mutations.ts
    │   └── types.ts
    ├── announcements/
    │   ├── queries.ts
    │   └── mutations.ts
    └── settings/
        ├── queries.ts
        └── mutations.ts
```

Feature-specific query and mutation logic should remain close to its domain. Only visual feedback, state vocabulary, error normalization, and safety mechanisms belong in the shared layer.

---

# 3. Reusable components, hooks, and providers

## Providers

### `AsyncSystemProvider`

Responsibilities:

- Create one stable `QueryClient`.
- Mount `QueryClientProvider`.
- Mount the existing `ToastProvider`.
- Define safe defaults for retries, stale times, and mutation behavior.
- Never publish every query or mutation state through React Context.

### Extended `ToastProvider`

Add:

- `success`, `error`, `info`, and optionally `loading` variants.
- Stable toast IDs so a loading toast can be replaced by success or error.
- Optional action button, such as “Retry” or “Undo”.
- Duplicate-message suppression.
- `role="status"` and `aria-live="polite"` for success/info.
- `role="alert"` only for failures requiring immediate attention.

## Visual primitives

### `Spinner`

For compact, indeterminate work such as a button action or background refresh.

### `Skeleton`

A shape primitive only. It should be `aria-hidden` and should never announce every skeleton element.

### `PageSkeleton`

Supported variants:

```ts
type PageSkeletonVariant =
  | 'dashboard'
  | 'table'
  | 'form'
  | 'detail'
  | 'settings'
  | 'map';
```

Each variant should approximate the final content’s dimensions to avoid layout shifts.

### `LoadingButton`

Responsibilities:

- Reserve space for both normal and pending content.
- Set `disabled` and `aria-busy`.
- Prevent duplicate clicks.
- Show an inline spinner and action-specific pending label.
- Optionally show a brief success check without changing button width.

### `SectionState`

Suggested API:

```tsx
<SectionState
  status={query.status}
  refreshing={query.isFetching && query.status === 'success'}
  error={query.error}
  loading={<RequestsTableSkeleton />}
  empty={requests.length === 0}
  emptyContent={<EmptyRequests />}
  onRetry={() => query.refetch()}
>
  <RequestsTable rows={requests} />
</SectionState>
```

It handles first-load skeletons, errors, empty state, and background refresh without hiding existing data.

### `LoadingOverlay`

Use only inside a bounded container when interaction with that exact container would be unsafe. It must not become the default loading treatment.

### `AsyncStatus`

A visually hidden or compact status message for “Saving”, “Saved”, “Retrying”, and similar announcements.

## Hooks

### `useDelayedPending(pending, delay = 120)`

Prevents loaders from flashing for very fast work. Disabling must happen immediately; only the animation is delayed.

### `useSingleFlight(key)`

A synchronous ref-backed guard for operations that must not be invoked twice before React has rerendered the button as disabled.

Client-side guarding improves UX, but important creates and payments must also use server-side idempotency.

### Feature query hooks

Examples:

- `useRequestsQuery`
- `useHouseholdsQuery`
- `useBarangaySettingsQuery`
- `useAuditLogQuery`

### Feature mutation hooks

Examples:

- `useUpdateRequestStatus`
- `useCreateAnnouncement`
- `useDeleteResident`
- `useSaveSettings`
- `useUploadSiteContent`

Each mutation hook owns its optimistic update, rollback, cache invalidation, and normalized errors.

---

# 4. Loading-state taxonomy

Use the same four primary states everywhere:

```ts
export type AsyncStatus = 'idle' | 'pending' | 'success' | 'error';

export type AsyncIntent =
  | 'initial-load'
  | 'refresh'
  | 'submit'
  | 'optimistic-update'
  | 'retry'
  | 'upload'
  | 'processing';
```

The status answers “where is the operation in its lifecycle?” The intent answers “what kind of operation is it?”

| Status | Meaning | UI behavior |
|---|---|---|
| `idle` | Not started or reset | Normal controls |
| `pending` | Request is in progress | Contextual pending feedback; prevent duplicate work |
| `success` | Server confirmed | Commit canonical data; optional brief confirmation |
| `error` | Operation failed | Preserve input/data; show recovery action |

For queries, distinguish:

- `status === 'pending'`: no usable data yet; show a skeleton.
- `status === 'success' && isFetching`: usable data is visible while refreshing; keep it visible.
- `status === 'error'` with no data: show a local error state.
- Refetch error with existing data: keep the data, show a non-blocking warning.

Do not add a permanent `cancelled` visual state. Cancellation normally returns the UI to its previous valid state without an error toast.

---

# 5. Animation approach

## Recommendation: CSS and Tailwind first

Use:

- Tailwind transitions for opacity, color, and transform.
- Shared CSS keyframes for shimmer, spinner, and delayed navigation hints.
- The existing `useMountTransition` for drawers and modal exit presence.
- No Framer Motion dependency in the first implementation.

### Why

| Option | Strength | Cost |
|---|---|---|
| CSS/Tailwind | Small, fast, server-compatible, ideal for spinners/skeletons/fades | Manual presence handling for complex exit animation |
| Framer Motion | Excellent orchestration, layout animation, and exit presence | Additional client JavaScript and abstraction for effects this system does not need |
| View Transitions | Potentially polished route transitions | Progressive support and tighter router/browser coupling |
| Combination | Flexible | Easy to create inconsistent motion |

This admin interface needs feedback, not cinematic screen transitions. CSS covers nearly every required effect and matches the existing codebase.

Use Framer Motion later only if a concrete feature needs coordinated layout animation that is difficult to implement safely with CSS.

### Motion rules

- Feedback delay: 100–150 ms.
- Hover/press transition: 120–160 ms.
- Modal or drawer transition: 180–240 ms.
- Animate only opacity and transform where possible.
- Never delay showing actual content to satisfy an animation.
- Never enforce a minimum loader duration.
- Avoid animating page height, table dimensions, or skeleton geometry.
- Skeleton shimmer should be subtle and stop under reduced motion.

---

# 6. Sidebar route-transition flow

Next.js route `loading.tsx` fallbacks preserve shared layouts, keep navigation interruptible, and allow the shell to remain interactive. [Next.js loading and streaming guidance](https://nextjs.org/docs/app/getting-started/linking-and-navigating)

## Flow

1. Sidebar links remain ordinary Next.js `<Link>` elements, preserving prefetching, keyboard access, modifier-click, and browser behavior.
2. The clicked item immediately receives a pending state through a descendant using `useLinkStatus`.
3. Keep the currently committed route highlighted until the destination commits.
4. Give the pending destination a secondary treatment:
   - Fixed-size spinner/dot on the right.
   - Subtle tinted background or outline.
   - Screen-reader message: “Opening Requests”.
5. Delay the visible spinner by approximately 120 ms so fast prefetched routes do not flicker.
6. If server work is required, `(admin)/loading.tsx` replaces only the `<main>` content with a page skeleton.
7. The sidebar and header remain interactive.
8. When the new route commits, `usePathname()` updates the active state and the pending indicator disappears.
9. If another route is clicked first, Next.js interrupts the earlier navigation. `useLinkStatus` reports only the last clicked link as pending, which is desirable here. [Next.js `useLinkStatus`](https://nextjs.org/docs/15/app/api-reference/functions/use-link-status)
10. If rendering fails, `(admin)/error.tsx` shows a retry state inside the content area instead of breaking the shell.

Do not disable the entire sidebar during navigation. The user must be able to change their destination.

Browser back/forward navigation may not originate from a `<Link>`, so `loading.tsx` remains the authoritative route fallback.

## Route skeleton strategy

Start with a generic `(admin)/loading.tsx`. Add route-level loading files only where the generic geometry is visibly inaccurate:

```tsx
// src/app/(admin)/loading.tsx
import { PageSkeleton } from '@/components/async/page-skeleton';

export default function AdminLoading() {
  return <PageSkeleton variant="table" />;
}
```

```tsx
// src/app/(admin)/dashboard/loading.tsx
import { PageSkeleton } from '@/components/async/page-skeleton';

export default function DashboardLoading() {
  return <PageSkeleton variant="dashboard" />;
}
```

---

# 7. Supabase mutation flow

## Standard mutation lifecycle

### 1. Validate

- Run shared schema validation before starting the request.
- Keep validation errors inline beside the relevant field.
- Do not start a spinner for invalid input.

### 2. Establish identity and locking

- Assign a mutation key such as `['service-request', requestId, 'status']`.
- Disable all conflicting actions for that entity.
- Use a synchronous single-flight guard for critical actions.
- For creates, payment operations, and job starts, send an idempotency key.

### 3. Cancel competing reads

Cancel an in-flight query for the affected record/list before writing an optimistic value. TanStack Query supplies an `AbortSignal` to query functions, and Supabase queries accept it through `.abortSignal(signal)`. [TanStack query cancellation](https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation), [Supabase `abortSignal`](https://supabase.com/docs/reference/javascript/using-modifiers-abortsignal)

### 4. Snapshot

Save the previous cache value before applying the optimistic change.

### 5. Optimistically update where appropriate

Good candidates:

- Status changes.
- Toggles.
- Reordering.
- Soft archive/removal.
- Editing a small field.

Poor candidates:

- Payments or refunds.
- Irreversible deletion.
- Large uploads.
- Multi-step operations with uncertain side effects.
- Operations where server validation commonly rejects input.

For those operations, keep the existing content visible and show localized pending feedback until confirmation.

### 6. Send an atomic server request

For important state transitions, prefer a Supabase RPC that:

- Checks the expected current state or row version.
- Applies the mutation transactionally.
- Writes required audit information.
- Returns the canonical updated row.

For regular updates, include `updated_at` or a version column in the filter. If no row is returned, treat it as a conflict rather than silently overwriting a newer update.

### 7. Confirm success

- Replace the optimistic row with the returned server row.
- Invalidate only affected query keys.
- Show a concise success toast for meaningful user actions.
- Use an inline “Saved” state instead of repetitive toasts for frequent settings changes.

### 8. Recover from error

- Restore the snapshot.
- Preserve form values and modal state.
- Show an inline error beside the affected action.
- Use an error toast when the failure could otherwise be missed.
- Offer Retry when retrying is safe.
- On conflict, refetch and explain that the record changed elsewhere.

### 9. Settle

- Clear the pending state in `finally` or through the mutation lifecycle.
- Restore focus to the initiating control when appropriate.
- Never leave an invisible overlay mounted after cancellation or failure.

## Delayed or out-of-order responses

Use three levels of protection:

1. **UI:** Disable the conflicting controls and single-flight the action.
2. **Client cache:** Cancel stale queries, serialize operations per entity, and invalidate narrowly.
3. **Database:** Use expected versions and idempotency keys.

A cancelled mutation request does not guarantee the database did not commit. If the outcome is uncertain, refetch the affected record before allowing another conflicting action. Reuse the same idempotency key when retrying an unknown-outcome create.

## Navigation away

- Read requests should consume an AbortSignal and can be cancelled.
- A mutation can continue after its component unmounts, but it must not update unmounted local component state.
- Shared mutation callbacks should own cache consistency.
- Call-site callbacks should handle screen-specific behavior such as closing a modal.
- Long processing tasks should create a server-side job record and expose progress through polling or Supabase Realtime rather than depending on a mounted component.

---

# 8. Feedback selection guide

| Situation | Recommended feedback |
|---|---|
| Sidebar navigation | Pending marker in clicked link; page skeleton if destination suspends |
| First page open | Page-shaped skeleton |
| First load of one card | Skeleton inside that card |
| Background refresh | Keep content; small “Refreshing” indicator |
| Button action | Loading button with action label |
| Table-row mutation | Disable that row’s actions; optimistic row state when safe |
| Modal content load | Skeleton inside modal body |
| Modal submit | Loading submit button; disable fields whose values must remain frozen |
| Form validation failure | Inline field error; no toast unless failure is global |
| Upload | Determinate progress only when real byte progress exists; otherwise show stage text |
| Long server processing | Stage/status indicator and persisted job state |
| Success | Toast for meaningful completed action; inline confirmation for frequent saves |
| Recoverable error | Inline error plus Retry |
| Global/session error | Toast or session-expired screen |
| Whole-screen overlay | Only for rare operations where all interaction is genuinely unsafe |

### Avoid

- Skeletons during background refresh.
- Spinners in every table cell.
- A page overlay for one row update.
- A global progress bar plus page skeleton plus spinner for the same operation.
- Replacing the entire modal during form submission.
- Fake upload percentages.
- Success toasts for every autosave keystroke.

---

# 9. Example core implementation

## Query provider

```tsx
// components/async/async-system-provider.tsx
'use client';

import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

import { ToastProvider } from '@/components/ui/toast';

export function AsyncSystemProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
          mutations: {
            // Writes are not automatically retried because they may have
            // committed even when the response was lost.
            retry: 0,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}
```

Replace the direct `ToastProvider` in the root layout with `AsyncSystemProvider`.

## Loading button

```tsx
// components/async/loading-button.tsx
'use client';

import { LoaderCircle } from 'lucide-react';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';

type LoadingButtonProps = ComponentPropsWithoutRef<'button'> & {
  pending?: boolean;
  pendingLabel?: ReactNode;
};

export function LoadingButton({
  pending = false,
  pendingLabel = 'Working…',
  disabled,
  children,
  className = '',
  ...props
}: LoadingButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || pending}
      aria-busy={pending}
      data-state={pending ? 'pending' : 'idle'}
      className={`inline-flex items-center justify-center disabled:cursor-wait disabled:opacity-60 ${className}`}
    >
      <span className="grid [grid-template-areas:'content']">
        <span
          className={`[grid-area:content] transition-opacity ${
            pending ? 'opacity-0' : 'opacity-100'
          }`}
        >
          {children}
        </span>

        <span
          aria-hidden={!pending}
          className={`flex items-center justify-center gap-2 [grid-area:content] transition-opacity ${
            pending ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <LoaderCircle
            aria-hidden
            className="size-4 animate-spin motion-reduce:animate-none"
          />
          {pendingLabel}
        </span>
      </span>
    </button>
  );
}
```

Usage:

```tsx
<LoadingButton
  type="submit"
  pending={mutation.isPending}
  pendingLabel="Saving…"
  className="rounded-full bg-[var(--accent)] px-5 py-2 text-white"
>
  Save settings
</LoadingButton>
```

## Sidebar pending indicator

```tsx
// components/navigation/sidebar-link.tsx
'use client';

import { LoaderCircle, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { useLinkStatus } from 'next/link';

function LinkPendingStatus({ label }: { label: string }) {
  const { pending } = useLinkStatus();

  return (
    <>
      <span
        aria-hidden
        data-pending={pending}
        className="nav-pending-hint ml-auto inline-flex size-4 shrink-0 items-center justify-center"
      >
        <LoaderCircle className="size-3.5 animate-spin motion-reduce:animate-none" />
      </span>

      {pending ? (
        <span className="sr-only" role="status">
          Opening {label}
        </span>
      ) : null}
    </>
  );
}

export function SidebarLink({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  collapsed: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      title={collapsed ? label : undefined}
      className={`flex h-[49px] items-center gap-[13px] rounded-2xl px-[13px] text-[13px] font-bold transition-colors ${
        active
          ? 'bg-[var(--accent)] text-white'
          : 'text-[#151b2b] hover:bg-[#f3f5f7] dark:text-zinc-100 dark:hover:bg-zinc-900'
      }`}
    >
      <Icon aria-hidden className="size-5 shrink-0" />
      {!collapsed ? <span className="truncate">{label}</span> : null}
      <LinkPendingStatus label={label} />
    </Link>
  );
}
```

Supporting CSS:

```css
.nav-pending-hint {
  opacity: 0;
  visibility: hidden;
}

.nav-pending-hint[data-pending='true'] {
  visibility: visible;
  animation: pending-fade-in 160ms ease 120ms forwards;
}

@keyframes pending-fade-in {
  to {
    opacity: 0.7;
  }
}

@media (prefers-reduced-motion: reduce) {
  .nav-pending-hint[data-pending='true'] {
    animation: none;
    opacity: 0.7;
  }

  .shimmer {
    animation: none;
    background-image: none;
  }
}
```

## Cancellable Supabase query

```tsx
const requestsQuery = useQuery({
  queryKey: ['service-requests', barangayId],
  queryFn: async ({ signal }) => {
    const supabase = createSupabaseBrowserClient();

    const { data, error } = await supabase
      .from('service_requests')
      .select('*')
      .eq('barangay_id', barangayId)
      .order('created_at', { ascending: false })
      .abortSignal(signal);

    if (error) throw error;
    return data;
  },
  initialData,
});
```

Rendering:

```tsx
if (requestsQuery.isPending) {
  return <RequestsTableSkeleton />;
}

if (requestsQuery.isError) {
  return (
    <InlineError
      message="Requests could not be loaded."
      onRetry={() => requestsQuery.refetch()}
    />
  );
}

return (
  <section aria-busy={requestsQuery.isFetching}>
    <RequestsToolbar
      refreshing={requestsQuery.isFetching}
      onRefresh={() => requestsQuery.refetch()}
    />
    <RequestsTable rows={requestsQuery.data} />
  </section>
);
```

## Optimistic status mutation with conflict detection

```tsx
import {
  useIsMutating,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { useMemo } from 'react';

import type { Database } from '@barangayan/shared';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type RequestRow =
  Database['public']['Tables']['service_requests']['Row'];

type UpdateStatusVariables = {
  nextStatus: RequestRow['status'];
  expectedUpdatedAt: string;
};

export function useUpdateRequestStatus(
  barangayId: string,
  requestId: string,
) {
  const queryClient = useQueryClient();
  const supabase = useMemo(createSupabaseBrowserClient, []);
  const listKey = ['service-requests', barangayId] as const;
  const mutationKey = ['service-request', requestId, 'status'] as const;

  const mutation = useMutation({
    mutationKey,

    mutationFn: async ({
      nextStatus,
      expectedUpdatedAt,
    }: UpdateStatusVariables) => {
      const { data, error } = await supabase
        .from('service_requests')
        .update({ status: nextStatus })
        .eq('id', requestId)
        .eq('updated_at', expectedUpdatedAt)
        .select('*')
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        throw new Error(
          'This request changed elsewhere. Refresh and try again.',
        );
      }

      return data;
    },

    onMutate: async ({ nextStatus }) => {
      await queryClient.cancelQueries({ queryKey: listKey });

      const previous =
        queryClient.getQueryData<RequestRow[]>(listKey);

      queryClient.setQueryData<RequestRow[]>(listKey, (current) =>
        current?.map((row) =>
          row.id === requestId
            ? { ...row, status: nextStatus }
            : row,
        ),
      );

      return { previous };
    },

    onError: (_error, _variables, context) => {
      queryClient.setQueryData(listKey, context?.previous);
    },

    onSuccess: (confirmedRow) => {
      queryClient.setQueryData<RequestRow[]>(listKey, (current) =>
        current?.map((row) =>
          row.id === requestId ? confirmedRow : row,
        ),
      );
    },

    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: listKey }),
  });

  const relatedPending =
    useIsMutating({ mutationKey }) > 0;

  return {
    ...mutation,
    relatedPending,
  };
}
```

Usage:

```tsx
const statusMutation = useUpdateRequestStatus(
  barangayId,
  request.id,
);

<LoadingButton
  pending={statusMutation.relatedPending}
  pendingLabel="Updating…"
  onClick={() =>
    statusMutation.mutate({
      nextStatus: 'in_progress',
      expectedUpdatedAt: request.updated_at,
    })
  }
>
  Start processing
</LoadingButton>
```

For the real status state machine, move the transition into an RPC so the current state check, update, and audit entry occur in one transaction.

---

# 10. Forms, modals, and uploads

## Forms

The project already has React Hook Form installed. Standardize new or migrated forms on:

- React Hook Form for field state and validation.
- Shared schemas from `@barangayan/shared`.
- TanStack mutation for submission state.
- `LoadingButton` for submit.
- Inline form error for validation or submission failure.
- Toast only after server-confirmed success or a failure that might be missed.

Keep all fields and error messages mounted while submission runs. Disable fields only when changing their values would make the submitted payload ambiguous.

## Modals

When a modal submits:

- Keep the modal open.
- Set `aria-busy` on the form or modal body.
- Disable submit and destructive controls.
- Do not close optimistically unless reopening and restoring the form is reliable.
- Close after success.
- Focus the triggering element after close.
- On error, keep values and focus the error summary or first invalid field.

For a modal that fetches detail data, cache by entity ID and show a skeleton only in the modal content region.

## Uploads and processing

Model uploads as stages:

```ts
type UploadStage =
  | 'idle'
  | 'uploading'
  | 'saving-record'
  | 'processing'
  | 'success'
  | 'error';
```

- Show real percentage only if the transport provides byte progress.
- Otherwise show an indeterminate indicator and honest stage label.
- Allow cancellation only when cancellation is real.
- If processing continues server-side, create a job record before navigating away.
- Remove newly uploaded files if a later database step fails and the file is no longer referenced.
- Do not delete the old file until the new database reference is committed.

---

# 11. Accessibility requirements

- Put `aria-busy="true"` on the smallest meaningful affected region.
- Use native `disabled` for buttons that cannot be activated.
- Errors use `role="alert"` only when immediate announcement is necessary.
- Success, saving, and refreshing messages use `role="status"` or `aria-live="polite"`.
- Skeleton elements use `aria-hidden="true"`; announce one parent message such as “Loading requests”.
- Do not communicate status by color alone.
- Preserve focus during background changes.
- Do not automatically move focus for ordinary success toasts.
- Focus an error summary for failed form submission when the error is not adjacent to the active field.
- Respect `prefers-reduced-motion`.
- A reduced-motion user should receive the same state information through text, icons, and ARIA even when spinning and shimmer are disabled.

---

# 12. Performance guidance

- Create the QueryClient once with a lazy `useState` initializer.
- Keep query keys narrow and structured.
- Avoid calling `router.refresh()` after every mutation.
- Preserve previous data during background refresh.
- Use TanStack Query’s structural sharing rather than copying entire application state into Context.
- Subscribe components only to the query or mutation state they render.
- Use `useIsMutating` with a specific mutation key, not globally.
- Use fixed-size spinner containers to avoid layout shifts.
- Delay loader visibility, not the operation or content.
- Keep skeleton DOM small; do not duplicate every table row.
- Prefer three to six representative skeleton rows.
- Keep transitions to opacity and transform.
- Avoid Framer Motion until there is an evidenced need.
- Clear query caches on logout so cached admin data cannot appear briefly for another account.

---

# 13. Edge cases and required behavior

## Multiple rapid clicks

- Native disabled state.
- Synchronous ref lock for critical actions.
- Entity-specific mutation key.
- Server idempotency for creates and payments.

## Navigation during a read

- Consume the query’s AbortSignal.
- Ignore cancellation as an error.
- Do not show an error toast.

## Navigation during a mutation

- Let cache-level callbacks settle the mutation.
- Avoid local `setState` after unmount.
- Refetch the canonical record if the outcome is uncertain.

## Retry after network failure

- Read queries can retry once automatically.
- Mutations should not retry automatically by default.
- Reuse an idempotency key when the previous create’s outcome is unknown.
- Provide explicit Retry for safe operations.

## Supabase Realtime arrives during an optimistic update

- Compare `updated_at` or a revision number.
- Do not replace a newer optimistic value with an older event.
- Prefer invalidating the record query when ordering cannot be proven.

## Session expiry

- Normalize unauthorized errors.
- Clear client caches.
- Redirect to login.
- Preserve a safe return URL if appropriate.
- Do not keep showing repeated error toasts from every failing query.

## Unsaved form navigation

Treat this separately from loading. Use a navigation blocker only for dirty forms, not for pending reads. A submitting form should either complete, explicitly cancel, or ask before being abandoned when the consequence is meaningful.

## Long request

After approximately 8–10 seconds, add text such as “This is taking longer than usual.” Offer cancellation only for cancellable reads or uploads. Avoid claiming a mutation failed solely because the client stopped waiting; its outcome may be unknown.

---

# 14. Phased implementation checklist

## Phase 1 — Foundation

- [ ] Add `@tanstack/react-query`.
- [ ] Create `AsyncSystemProvider`.
- [ ] Define the shared state taxonomy.
- [ ] Create `Spinner`, `Skeleton`, `PageSkeleton`, `LoadingButton`, `InlineError`, and `SectionState`.
- [ ] Extend ToastProvider with accessible roles, IDs, actions, and deduplication.
- [ ] Add reduced-motion rules.
- [ ] Retrofit `ConfirmButton` and existing action handlers with reliable `try/finally`.

## Phase 2 — Navigation

- [ ] Extract `SidebarLink`.
- [ ] Add `useLinkStatus` feedback with a delayed, fixed-size indicator.
- [ ] Add `(admin)/loading.tsx`.
- [ ] Add `(admin)/error.tsx`.
- [ ] Verify the sidebar remains responsive under slow network simulation.
- [ ] Verify rapid navigation leaves only the latest link pending.

## Phase 3 — High-impact mutation pilot

Start with service-request status changes because they exercise:

- Row-level loading.
- State transitions.
- Optimistic updates.
- Conflict detection.
- Audit logging.
- Error rollback.

Checklist:

- [ ] Create stable query keys.
- [ ] Migrate the request list to a query cache with server-provided initial data.
- [ ] Implement optimistic status mutation.
- [ ] Add expected-version conflict checks.
- [ ] Replace broad `router.refresh()` with targeted cache updates.
- [ ] Test double-click, failure, delayed response, and navigation away.

## Phase 4 — Forms and CRUD

- [ ] Migrate announcement create/edit/archive.
- [ ] Migrate staff and resident CRUD.
- [ ] Migrate settings save behavior.
- [ ] Standardize modal submission behavior.
- [ ] Add idempotency for creates.
- [ ] Add soft-delete Undo only where a real restore path exists.

## Phase 5 — Client fetching

- [ ] Replace manual loading hooks such as household/settings fetches with cancellable queries.
- [ ] Preserve existing data during refresh.
- [ ] Add retry controls and local error states.
- [ ] Ensure an absent prerequisite such as `barangayId` does not leave loading permanently true.

## Phase 6 — Uploads and long processing

- [ ] Introduce upload stages.
- [ ] Add cleanup for partially completed uploads.
- [ ] Persist long-running processing jobs.
- [ ] Add truthful progress or stage feedback.
- [ ] Test page close and navigation during upload.

## Phase 7 — QA and rollout

Test every migrated flow with:

- [ ] 4× network throttling.
- [ ] Offline mode.
- [ ] Supabase error response.
- [ ] Request timeout.
- [ ] Double click.
- [ ] Two actions on the same row.
- [ ] Navigation away mid-request.
- [ ] Browser back/forward.
- [ ] Two tabs editing the same record.
- [ ] Reduced-motion preference.
- [ ] Keyboard-only navigation.
- [ ] Screen-reader announcements.
- [ ] React Profiler comparison for unnecessary rerenders.
- [ ] Production build and typecheck.

## Definition of done

The system is complete when:

- Every route provides feedback without blocking the persistent shell.
- Every first-load data area has either meaningful content or a shape-correct skeleton.
- Every async action has a disabled/pending state.
- Duplicate submissions are prevented at both UI and server levels where necessary.
- Optimistic mutations reliably roll back.
- Background refresh never replaces usable content with a skeleton.
- Errors preserve user work and provide an actionable recovery path.
- Reduced-motion and assistive-technology behavior are tested.
- No page implements its own spinner, shimmer, or ad hoc `busy` pattern unless it has a documented exception.