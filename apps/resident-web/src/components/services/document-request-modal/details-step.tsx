'use client';
import { servicePriceLabel, serviceProcessingLabel } from '@barangayan/shared';
import { ArrowRight, Check, FileText } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { ServiceCharter } from '../resident-service-form';
import type { DocumentType } from './types';
import styles from './document-request-modal.module.css';

export function DetailsStep({
  doc,
  isAuthenticated,
  onRequest,
}: {
  doc: DocumentType;
  isAuthenticated: boolean;
  onRequest: () => void;
}) {
  return (
    <div className={styles.details}>
      <div className={styles.hero}>
        <p className={styles.eyebrow}>Before you begin</p>
        <h2>{doc.name}</h2>
        {doc.description ? <p className={styles.description}>{doc.description}</p> : null}
      </div>

      <dl className={styles.overview}>
        <div><dt>Document fee</dt><dd>{servicePriceLabel(doc)}</dd></div>
        <div><dt>Processing &amp; pickup</dt><dd>{serviceProcessingLabel(doc)}</dd></div>
      </dl>

      {doc.requirements.length > 0 ? (
        <section>
          <h3 className={styles.sectionHeading}><span aria-hidden>01</span> What you&apos;ll need</h3>
          <ul className={styles.requirements}>
            {doc.requirements.map((req) => (
              <li key={req}>
                <span className={styles.check}><Check size={13} aria-hidden /></span>
                <span>{req}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className={styles.note}>
        <FileText size={19} aria-hidden className="shrink-0 text-primary" />
        <div>
          <p className="mb-1 font-semibold text-foreground">Bring your original documents</p>
          <p>Please ensure all requirements are complete before proceeding. Bring the original documents for verification at the Barangay Hall.
          Processing times are estimates and may vary during peak periods.</p>
        </div>
      </div>

      <section className={styles.charter}>
        <h3 className={styles.sectionHeading}><span aria-hidden>{doc.requirements.length > 0 ? '02' : '01'}</span> Service guidelines</h3>
        <ServiceCharter doc={doc} />
      </section>
      <div className={styles.actions}>
        {isAuthenticated ? (
            <Button
              size="lg"
              className="w-full"
              onClick={onRequest}>
              Request This Document <ArrowRight size={18} aria-hidden />
            </Button>
        ) : (
          <Button asChild size="lg" className="w-full">
            <Link href="/login">Log In to Request</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
