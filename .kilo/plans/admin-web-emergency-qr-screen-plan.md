# **Implementation Plan: Emergency QR & Content Management System**

## **Phase 1: Database Schema & Realtime Replication**

### **Task 1.1: Database Migration File**

Create a new migration file: supabase/migrations/\<TIMESTAMP\>\_create\_emergency\_qr\_tables.sql.

SQL  
\-- 1\. Create table for instructional content (Why Scan / How it Works)  
CREATE TABLE IF NOT EXISTS public.emergency\_qr\_content (  
  id           UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
  barangay\_id  UUID NOT NULL REFERENCES public.barangays(id) ON DELETE CASCADE,  
  section      TEXT NOT NULL CHECK (section IN ('why\_scan', 'how\_it\_works')),  
  title        TEXT NOT NULL,  
  body         TEXT NOT NULL DEFAULT '',  
  content      JSONB NOT NULL DEFAULT '\[\]'::jsonb, \-- Array of step objects: \[{ "step": 1, "title": "...", "desc": "..." }\]  
  icon         TEXT DEFAULT 'qr-code-outline',  
  icon\_color   TEXT DEFAULT '\#2563EB',  
  icon\_bg      TEXT DEFAULT '\#DBEAFE',  
  is\_active    BOOLEAN NOT NULL DEFAULT true,  
  sort\_order   INTEGER NOT NULL DEFAULT 0,  
  created\_at   TIMESTAMPTZ NOT NULL DEFAULT now(),  
  updated\_at   TIMESTAMPTZ NOT NULL DEFAULT now(),  
  deleted\_at   TIMESTAMPTZ,  
  CONSTRAINT unique\_barangay\_section UNIQUE (barangay\_id, section)  
);

\-- 2\. Create table for tracking evacuation center QR payloads  
CREATE TABLE IF NOT EXISTS public.evacuation\_center\_qr\_codes (  
  id                   UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
  evacuation\_center\_id UUID NOT NULL REFERENCES public.evacuation\_centers(id) ON DELETE CASCADE,  
  qr\_payload           JSONB NOT NULL, \-- { "center\_id": "...", "center\_name": "...", "barangay\_id": "..." }  
  qr\_image\_url         TEXT,  
  is\_active            BOOLEAN NOT NULL DEFAULT true,  
  created\_at           TIMESTAMPTZ NOT NULL DEFAULT now(),  
  updated\_at           TIMESTAMPTZ NOT NULL DEFAULT now(),  
  CONSTRAINT unique\_center\_qr UNIQUE (evacuation\_center\_id)  
);

\-- 3\. Indexes for query optimization  
CREATE INDEX IF NOT EXISTS idx\_emergency\_qr\_content\_barangay ON public.emergency\_qr\_content(barangay\_id);  
CREATE INDEX IF NOT EXISTS idx\_evacuation\_center\_qr\_center ON public.evacuation\_center\_qr\_codes(evacuation\_center\_id);

\-- 4\. Automatically update updated\_at timestamps  
CREATE OR REPLACE FUNCTION set\_updated\_at\_column()  
RETURNS TRIGGER AS $$  
BEGIN  
  NEW.updated\_at \= NOW();  
  RETURN NEW;  
END;  
$$ LANGUAGE plpgsql;

CREATE TRIGGER update\_emergency\_qr\_content\_modtime  
  BEFORE UPDATE ON public.emergency\_qr\_content  
  FOR EACH ROW EXECUTE FUNCTION set\_updated\_at\_column();

CREATE TRIGGER update\_evacuation\_center\_qr\_modtime  
  BEFORE UPDATE ON public.evacuation\_center\_qr\_codes  
  FOR EACH ROW EXECUTE FUNCTION set\_updated\_at\_column();

### **Task 1.2: Row Level Security (RLS) & Realtime Publication**

SQL  
\-- Enable RLS  
ALTER TABLE public.emergency\_qr\_content ENABLE ROW LEVEL SECURITY;  
ALTER TABLE public.evacuation\_center\_qr\_codes ENABLE ROW LEVEL SECURITY;

\-- Read policies (Public / Authenticated users)  
CREATE POLICY "Allow read access to emergency\_qr\_content for authenticated users"  
  ON public.emergency\_qr\_content FOR SELECT  
  TO authenticated USING (deleted\_at IS NULL AND is\_active \= true);

CREATE POLICY "Allow read access to evacuation\_center\_qr\_codes for authenticated users"  
  ON public.evacuation\_center\_qr\_codes FOR SELECT  
  TO authenticated USING (is\_active \= true);

\-- Write policies (Admins / Staff only)  
CREATE POLICY "Allow full access to emergency\_qr\_content for barangay admins"  
  ON public.emergency\_qr\_content FOR ALL  
  TO authenticated  
  USING (  
    EXISTS (  
      SELECT 1 FROM public.profiles  
      WHERE profiles.id \= auth.uid()  
        AND profiles.barangay\_id \= emergency\_qr\_content.barangay\_id  
        AND profiles.role IN ('admin', 'staff')  
    )  
  );

CREATE POLICY "Allow full access to evacuation\_center\_qr\_codes for barangay admins"  
  ON public.evacuation\_center\_qr\_codes FOR ALL  
  TO authenticated  
  USING (  
    EXISTS (  
      SELECT 1 FROM public.evacuation\_centers ec  
      JOIN public.profiles p ON p.barangay\_id \= ec.barangay\_id  
      WHERE ec.id \= evacuation\_center\_qr\_codes.evacuation\_center\_id  
        AND p.id \= auth.uid()  
        AND p.role IN ('admin', 'staff')  
    )  
  );

\-- Enable Supabase Realtime Replication  
ALTER TABLE public.emergency\_qr\_content REPLICA IDENTITY FULL;  
ALTER TABLE public.evacuation\_center\_qr\_codes REPLICA IDENTITY FULL;

DO $$  
BEGIN  
  IF EXISTS (SELECT 1 FROM pg\_publication WHERE pubname \= 'supabase\_realtime') THEN  
    ALTER PUBLICATION supabase\_realtime ADD TABLE   
      public.emergency\_qr\_content,  
      public.evacuation\_center\_qr\_codes;  
  END IF;  
END $$;

### **Task 1.3: Update Seed Data (supabase/seed.sql)**

Append initial instructional content seed to supabase/seed.sql:

SQL  
INSERT INTO public.emergency\_qr\_content (  
  id, barangay\_id, section, title, body, content, icon, icon\_color, icon\_bg, sort\_order, is\_active  
) VALUES  
  (  
    '00000000-0000-0000-0000-00000000q101',  
    '00000000-0000-0000-0000-000000000001',  
    'why\_scan',  
    'Why Scan the Evacuation Center QR?',  
    'Scanning registers your household instantly during an emergency evacuation.',  
    '\[  
      {"step": 1, "title": "Instant Attendance", "desc": "Automatically registers your profile and family members in the municipal registry."},  
      {"step": 2, "title": "Relief Distribution", "desc": "Ensures accurate headcount for food packs, medical kits, and relief assistance."},  
      {"step": 3, "title": "Family Tracking", "desc": "Helps DRRM officers confirm your safety and reconnect separated family members."}  
    \]'::jsonb,  
    'qr-code-outline', '\#2563EB', '\#DBEAFE', 1, true  
  ),  
  (  
    '00000000-0000-0000-0000-00000000q102',  
    '00000000-0000-0000-0000-000000000001',  
    'how\_it\_works',  
    'How to Check In via QR',  
    'Follow these 3 steps upon arriving at any accredited evacuation center.',  
    '\[  
      {"step": 1, "title": "Locate Poster", "desc": "Find the official Barangay DRRM QR code displayed at the entrance or registration desk."},  
      {"step": 2, "title": "Scan Code", "desc": "Open the Scan tab in this app and align the QR code within the camera frame."},  
      {"step": 3, "title": "Confirm Members", "desc": "Select which household members are present with you and submit check-in."}  
    \]'::jsonb,  
    'help-circle-outline', '\#16A34A', '\#DCFCE7', 2, true  
  )  
ON CONFLICT (id) DO NOTHING;

## **Phase 2: Shared Zod Schemas & Types (packages/shared)**

### **Task 2.1: Create Schema File**

Create packages/shared/src/schemas/emergency-qr.ts:

TypeScript  
import { z } from 'zod';

export const qrStepItemSchema \= z.object({  
  step: z.number().int().min(1),  
  title: z.string().min(1, 'Step title is required'),  
  desc: z.string().min(1, 'Step description is required'),  
});

export const emergencyQrContentSchema \= z.object({  
  id: z.string().uuid().optional(),  
  barangay\_id: z.string().uuid(),  
  section: z.enum(\['why\_scan', 'how\_it\_works'\]),  
  title: z.string().min(3, 'Title must be at least 3 characters'),  
  body: z.string().default(''),  
  content: z.array(qrStepItemSchema).default(\[\]),  
  icon: z.string().default('qr-code-outline'),  
  icon\_color: z.string().default('\#2563EB'),  
  icon\_bg: z.string().default('\#DBEAFE'),  
  is\_active: z.boolean().default(true),  
  sort\_order: z.number().int().default(0),  
});

export const evacuationCenterQrPayloadSchema \= z.object({  
  center\_id: z.string().uuid(),  
  center\_name: z.string(),  
  barangay\_id: z.string().uuid(),  
  generated\_at: z.string().datetime().optional(),  
});

export type QrStepItem \= z.infer\<typeof qrStepItemSchema\>;  
export type EmergencyQrContent \= z.infer\<typeof emergencyQrContentSchema\>;  
export type EvacuationCenterQrPayload \= z.infer\<typeof evacuationCenterQrPayloadSchema\>;

### **Task 2.2: Export in Package Index**

Update packages/shared/src/index.ts to export all schemas and inferred TypeScript types.

## **Phase 3: Web Admin Interface (apps/web)**

### **Task 3.1: Directory & Page Component Architecture**

Create the route files under apps/web/src/app/(admin)/emergency-qr/:

Plaintext  
apps/web/src/app/(admin)/emergency-qr/  
├── page.tsx                  \# Server component (Fetches initial data)  
├── client-wrapper.tsx        \# Client tab manager & Realtime subscription  
├── qr-instructions-tab.tsx   \# "Why Scan" & "How It Works" CRUD  
├── qr-instructions-modal.tsx \# Edit form dialog for instructional steps  
├── mobile-preview-card.tsx   \# Live visual mobile simulator  
├── qr-codes-tab.tsx          \# Center selector & generator  
└── qr-code-display.tsx       \# Canvas render, PNG export, & payload copy

### **Task 3.2: Implementation Specs for Components**

#### **1\. page.tsx (Server Component)**

* Fetch emergency\_qr\_content records matching the current admin's barangay\_id.  
* Fetch list of active evacuation centers for the current barangay (evacuation\_centers table).  
* Pass initial data to \<ClientWrapper/\>.

#### **2\. client-wrapper.tsx (Realtime Tab Controller)**

* State: Active tab (instructions | qr\_codes).  
* Realtime: Subscribe to postgres\_changes on table emergency\_qr\_content.  
* Realtime Badge: Render live connection status indicator (Green pulse dot when subscribed).

#### **3\. qr-instructions-tab.tsx**

* Layout: Grid split into two main sections:  
  * Left: Section list ("Why Scan" and "How It Works" cards with edit buttons).  
  * Right: \<MobilePreviewCard/\> showing live UI updates as edits are saved.  
* Features: Toggle section active/inactive state via switch component.

#### **4\. qr-instructions-modal.tsx**

* Form fields using react-hook-form \+ @hookform/resolvers/zod:  
  * Section Title (Text Input)  
  * Subtitle / Body (Textarea)  
  * Dynamic Step List (Field Array for adding, reordering, deleting step items)  
  * Icon and Color Picker (Preset primary/accent colors)  
* Submit Handler: Execute Supabase upsert on emergency\_qr\_content.

#### **5\. qr-codes-tab.tsx & qr-code-display.tsx**

* Evacuation Center Selector Dropdown.  
* QR Code Canvas Renderer: Utilize qrcode.react (QRCodeSVG or QRCodeCanvas).  
* Encoded JSON Payload structure:  
  JSON  
  {  
    "type": "EVACUATION\_CENTER\_CHECKIN",  
    "version": "1.0",  
    "center\_id": "00000000-0000-0000-0000-00000000c001",  
    "center\_name": "San Mateo Civic Center",  
    "barangay\_id": "00000000-0000-0000-0000-000000000001"  
  }

* Export Actions:  
  * Download PNG: Convert canvas output to high-res image download (300 DPI printable format).  
  * Copy Payload: Copy raw JSON string to clipboard.  
  * Bulk Print Sheet: Generate printable PDF view containing all center QR posters.

## **Phase 4: Mobile App Realtime Consumption (apps/mobile)**

### **Task 4.1: Fetch & Realtime Hook for Emergency Content**

Create custom hook useEmergencyQrContent.ts:

TypeScript  
import { useEffect, useState } from 'react';  
import { supabase } from '@/lib/supabase';  
import { EmergencyQrContent } from '@barangayan/shared';

export function useEmergencyQrContent(barangayId: string) {  
  const \[content, setContent\] \= useState\<EmergencyQrContent\[\]\>(\[\]);  
  const \[loading, setLoading\] \= useState(true);

  useEffect(() \=\> {  
    // 1\. Initial Fetch  
    async function fetchContent() {  
      const { data } \= await supabase  
        .from('emergency\_qr\_content')  
        .select('\*')  
        .eq('barangay\_id', barangayId)  
        .eq('is\_active', true)  
        .is('deleted\_at', null)  
        .order('sort\_order', { ascending: true });

      if (data) setContent(data as EmergencyQrContent\[\]);  
      setLoading(false);  
    }

    fetchContent();

    // 2\. Realtime Listener  
    const channel \= supabase  
      .channel('mobile\_emergency\_qr\_content')  
      .on(  
        'postgres\_changes',  
        {  
          event: '\*',  
          schema: 'public',  
          table: 'emergency\_qr\_content',  
          filter: \`barangay\_id=eq.${barangayId}\`,  
        },  
        (payload) \=\> {  
          if (payload.eventType \=== 'INSERT') {  
            setContent((prev) \=\> \[...prev, payload.new as EmergencyQrContent\]);  
          } else if (payload.eventType \=== 'UPDATE') {  
            setContent((prev) \=\>  
              prev.map((item) \=\>  
                item.id \=== payload.new.id ? (payload.new as EmergencyQrContent) : item  
              )  
            );  
          } else if (payload.eventType \=== 'DELETE') {  
            setContent((prev) \=\> prev.filter((item) \=\> item.id \=== payload.old.id));  
          }  
        }  
      )  
      .subscribe();

    return () \=\> {  
      supabase.removeChannel(channel);  
    };  
  }, \[barangayId\]);

  return { content, loading };  
}

### **Task 4.2: Scan Handler & Check-In Execution Logic**

In the Mobile QR Scan tab screen (apps/mobile/app/(tabs)/emergency/scan.tsx):

> 1. Camera Scanner Validation: Parse scanned payload using evacuationCenterQrPayloadSchema.safeParse(JSON.parse(scannedString)).  
> 2. Execute Check-In RPC:  
>    When valid center payload is scanned:  
   * Call database function process\_evacuation\_checkin:  
     SQL  
     \-- Inserts into evacuation\_center\_checkins  
     \-- Updates household\_members.is\_checked\_in \= true for selected members

> 3. Display Success Modal: Show confirmation sheet listing checked-in family members.

## **Phase 5: Verification & Execution Checklist**

| Step | Action | Execution Command | Success Criteria |
| :---- | :---- | :---- | :---- |
| 1 | Run Migration | npx supabase db push | Tables emergency\_qr\_content and evacuation\_center\_qr\_codes created in remote DB. |
| 2 | Seed Data | npx supabase db seed \--remote | Initial 2 instructional records present in emergency\_qr\_content. |
| 3 | Type Check | pnpm \--filter @barangayan/shared build | Shared Zod schemas compile without TypeScript errors. |
| 4 | Web Admin Test | Access http://localhost:3000/emergency-qr | Instructions CRUD functions correctly; QR code canvas renders and exports PNG properly. |
| 5 | Realtime Sync Test | Update content on Web Admin while viewing Mobile App | Mobile screen updates text instantly without manual page refresh. |
| 6 | QR Scan Test | Scan generated center QR code on Mobile App | Resident check-in record inserts into evacuation\_center\_checkins and household\_members.is\_checked\_in updates to true. |



EXECUTION:

```markdown
# TASK: Complete Implementation of Emergency QR & Content Management System

**Role:** Lead Full-Stack Engineer & Database Architect  
**Objective:** Fully implement the Emergency QR & Content Management System across the entire monorepo, covering Supabase migrations, shared Zod schemas, Web Admin management views, and Mobile App real-time consumption with zero placeholder code or missing logic.

---

### 1. Database Migration & Seed (`supabase/`)

#### A. Migration File: `supabase/migrations/<TIMESTAMP>_create_emergency_qr_tables.sql`
Implement the SQL migration script to:
1. Create `public.emergency_qr_content` with columns: `id`, `barangay_id`, `section` (`why_scan` | `how_it_works`), `title`, `body`, `content` (`jsonb`), `icon`, `icon_color`, `icon_bg`, `is_active`, `sort_order`, `created_at`, `updated_at`, `deleted_at`. Add a unique constraint on `(barangay_id, section)`.
2. Create `public.evacuation_center_qr_codes` with columns: `id`, `evacuation_center_id`, `qr_payload` (`jsonb`), `qr_image_url`, `is_active`, `created_at`, `updated_at`. Add a unique constraint on `(evacuation_center_id)`.
3. Add `updated_at` triggers and indexes on foreign keys (`barangay_id`, `evacuation_center_id`).
4. Enable Row Level Security (RLS) on both tables:
   - Allow `SELECT` for authenticated users where `is_active = true` and `deleted_at IS NULL`.
   - Allow `ALL` (INSERT, UPDATE, DELETE) for users whose `profiles.role` is `'admin'` or `'staff'` matching the target `barangay_id`.
5. Set `REPLICA IDENTITY FULL` and add both tables to the `supabase_realtime` publication.

#### B. Seed Script: `supabase/seed.sql`
Add default seed rows for `emergency_qr_content` under `barangay_id = '00000000-0000-0000-0000-000000000001'` for both `'why_scan'` and `'how_it_works'` sections using `ON CONFLICT (id) DO NOTHING`. Include structured JSON array steps in the `content` column.

---

### 2. Shared Schemas & Types (`packages/shared/`)

Create `packages/shared/src/schemas/emergency-qr.ts` and export the following:
- `qrStepItemSchema`: Zod schema for individual step objects `{ step: number, title: string, desc: string }`.
- `emergencyQrContentSchema`: Zod schema validating instructional content records (`why_scan` / `how_it_works`).
- `evacuationCenterQrPayloadSchema`: Zod schema validating QR payload format:
  ```typescript
  {
    type: "EVACUATION_CENTER_CHECKIN",
    version: "1.0",
    center_id: string (uuid),
    center_name: string,
    barangay_id: string (uuid)
  }

```

Export all schemas and inferred TypeScript types in `packages/shared/src/index.ts`.

---

### 3. Web Admin Management Module (`apps/web/src/app/(admin)/emergency-qr/`)

Create a production-ready, fully styled admin interface under `apps/web/src/app/(admin)/emergency-qr/`:

#### Files to Create:

* `page.tsx`: Server Component fetching initial `emergency_qr_content` and active `evacuation_centers` for the authenticated admin's barangay.
* `client-wrapper.tsx`: Tab state manager (`instructions` | `qr_codes`) with a live Supabase Realtime pulse indicator badge.
* `qr-instructions-tab.tsx`: Grid displaying "Why Scan" and "How it Works" cards alongside a live `<MobilePreviewCard />`.
* `qr-instructions-modal.tsx`: Modal form using `react-hook-form` + `@hookform/resolvers/zod` supporting dynamic field arrays for adding, editing, and deleting step items, with icon/color picker inputs. Executing an upsert mutation on submit.
* `mobile-preview-card.tsx`: Visual preview component simulating how the instructional content renders on a mobile device screen.
* `qr-codes-tab.tsx` & `qr-code-display.tsx`: Center selection dropdown rendering an SVG/Canvas QR code (`qrcode.react`). Includes:
* **Download PNG** button (renders 300 DPI downloadable image).
* **Copy Payload** button (copies valid raw JSON string to clipboard).
* Payload preview code block.



---

### 4. Mobile App Realtime Hook & Scanner Integration (`apps/mobile/`)

#### A. Realtime Hook: `apps/mobile/hooks/useEmergencyQrContent.ts`

Implement a custom React hook that:

1. Performs initial fetch of active `emergency_qr_content` records for the user's `barangay_id`.
2. Subscribes to Supabase Realtime changes (`postgres_changes`) on `emergency_qr_content`.
3. Dynamically updates local state on `INSERT`, `UPDATE`, and `DELETE` events without requiring full screen reloads.
4. Handles channel subscription cleanup on unmount.

#### B. Mobile Scan Handler: `apps/mobile/app/(tabs)/emergency/scan.tsx`

1. Consume `useEmergencyQrContent` to render dynamic "Why Scan" and "How It Works" instruction cards on the screen.
2. When scanning a QR code:
* Validate payload format using `evacuationCenterQrPayloadSchema.safeParse(...)`.
* If valid, execute the check-in database query updating `household_members.is_checked_in = true` and inserting a row into `evacuation_center_checkins`.
* Show an immediate feedback modal/toast on successful check-in.



---

### 5. Execution Guidelines & Quality Standards

* **Complete Code Only:** No `// TODO` placeholders, truncated functions, or omitted imports.
* **Strict Typing:** All database interactions and form handlers must strictly adhere to the shared Zod types.
* **Error Handling:** Include explicit try/catch blocks and UI error toasts for database write failures.
* **Zero Regression:** Ensure existing foreign key relationships (`barangays`, `evacuation_centers`, `profiles`) remain completely intact.

```

```