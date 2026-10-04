'use client';

/**
 * Client half of the Documents catalog — owns which document is selected and renders
 * the responsive grid + DocumentRequestModal. Split out of documents/page.tsx (a Server
 * Component, keeps the data fetch) the same way requests-list.tsx is split out of
 * requests/page.tsx; each card is a button (not a Link) so clicking it opens the panel
 * instead of navigating away — /services/[documentId] stays intact as a real route for
 * deep links and guest SEO.
 */

import { servicePriceLabel, serviceProcessingLabel, type Tables } from '@barangayan/shared';
import { FileText } from 'lucide-react';
import { useCallback, useState } from 'react';

import { DocumentRequestModal } from './document-request-modal/document-request-modal';

type DocumentTypeRow = Tables<'document_types'>;

export function DocumentsList({ documentTypes, isAuthenticated }: { documentTypes: DocumentTypeRow[]; isAuthenticated: boolean }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Only flips once the panel has finished sliding in (see DocumentRequestModal's
  // onOpenAnimationComplete) — stays true across switching between documents while the
  // panel is already open, so the grid doesn't flicker back to two columns mid-browse.
  const [panelSettled, setPanelSettled] = useState(false);
  const open = selectedId !== null;
  const singleColumn = open && panelSettled;

  function handleSelect(id: string) {
    if (selectedId === null) setPanelSettled(false);
    setSelectedId(id);
  }

  const handlePanelOpened = useCallback(() => setPanelSettled(true), []);
  function handleClose() {
    setSelectedId(null);
    setPanelSettled(false);
  }

  if (documentTypes.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-10 text-center">
        <p className="text-sm text-muted-foreground">No document types are available right now.</p>
      </div>
    );
  }

  return (
    <>
      <div className={`grid grid-cols-1 gap-3 ${singleColumn ? '' : 'sm:grid-cols-2'}`}>
        {documentTypes.map((doc) => {
          const active = doc.id === selectedId;
          return (
            <button
              key={doc.id}
              type="button"
              onClick={() => handleSelect(doc.id)}
              aria-current={active ? 'true' : undefined}
              // Stronger than a border tint alone — this card's content is what's showing
              // in the panel right now, so it needs to read as clearly "open", not just
              // "selected", against the rest of the catalog.
              className={`relative flex flex-col gap-2 rounded-2xl border-2 bg-card p-5 text-left transition-colors ${
                active ? 'border-primary bg-primary/5 ring-2 ring-primary/15' : 'border-border hover:border-primary/40'
              }`}>
              {active ? (
                <span className="absolute -top-2 left-4 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground shadow-sm">
                  Viewing
                </span>
              ) : null}
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <FileText size={18} strokeWidth={1.75} />
                </div>
                <p className="font-semibold">{doc.name}</p>
              </div>
              {doc.description ? <p className="line-clamp-2 text-sm text-muted-foreground">{doc.description}</p> : null}
              <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                <span>{servicePriceLabel(doc)}</span>
                <span>·</span>
                <span>{serviceProcessingLabel(doc)}</span>
              </div>
            </button>
          );
        })}
      </div>

      <DocumentRequestModal
        documentId={selectedId}
        open={open}
        isAuthenticated={isAuthenticated}
        onClose={handleClose}
        onOpenAnimationComplete={handlePanelOpened}
      />
    </>
  );
}
