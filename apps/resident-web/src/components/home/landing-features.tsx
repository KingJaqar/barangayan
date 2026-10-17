import {
  ArrowRight,
  Bell,
  CalendarDays,
  Camera,
  ClipboardCheck,
  CreditCard,
  FileText,
  HeartPulse,
  Map,
  MapPin,
  QrCode,
  Receipt,
  ShieldAlert,
  Siren,
  TriangleAlert,
  Users,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';

import { ScrollReveal } from './scroll-reveal';
import styles from './landing.module.css';

type Access = 'open' | 'account';

interface Capability {
  icon: LucideIcon;
  title: string;
  body: string;
  access: Access;
}

interface Feature {
  id: string;
  number: string;
  label: string;
  title: string;
  body: string;
  icon: LucideIcon;
  href: string;
  cta: string;
  capabilities: readonly Capability[];
}

const FEATURES: readonly Feature[] = [
  {
    id: 'feature-emergency',
    number: '01',
    label: 'Emergency',
    title: 'Help, ready before you need it.',
    body: 'Hotlines, preparedness guidance and alerts from your barangay — in one place, and open to everyone.',
    icon: ShieldAlert,
    href: '/emergency',
    cta: 'Open the Emergency Hub',
    capabilities: [
      { icon: Siren, title: 'Hotlines and guidelines', body: 'Tap-to-call numbers and what to do before, during, and after a disaster.', access: 'open' },
      { icon: MapPin, title: 'Evacuation centers', body: 'Find centers near you on the map and see their status.', access: 'open' },
      { icon: Bell, title: 'Emergency alerts', body: 'Stay on top of advisories issued by your barangay.', access: 'open' },
      { icon: QrCode, title: 'Family check-in', body: 'Register your household and check in with a QR code.', access: 'account' },
    ],
  },
  {
    id: 'feature-documents',
    number: '02',
    label: 'Document requests',
    title: 'Documents, without the queue.',
    body: 'Request barangay clearances and certificates online, pay your way, and follow every step until it is ready.',
    icon: FileText,
    href: '/services/documents',
    cta: 'Browse documents',
    capabilities: [
      { icon: FileText, title: 'Request online', body: 'Pick a document, fill in the form, and submit from anywhere.', access: 'account' },
      { icon: CreditCard, title: 'Flexible payment', body: 'Pay with a QR code or settle at pickup, whichever suits you.', access: 'account' },
      { icon: ClipboardCheck, title: 'Live tracking', body: 'See the status of each request as your barangay processes it.', access: 'account' },
      { icon: Receipt, title: 'Receipts on hand', body: 'Download a receipt for any payment you have made.', access: 'account' },
    ],
  },
  {
    id: 'feature-health',
    number: '03',
    label: 'Medical drives',
    title: 'Health drives, on your calendar.',
    body: 'See upcoming vaccination and medical drives in your barangay, and reserve your slot ahead of time.',
    icon: HeartPulse,
    href: '/health',
    cta: 'See active drives',
    capabilities: [
      { icon: CalendarDays, title: 'Drive calendar', body: 'Browse scheduled drives by date and by type.', access: 'open' },
      { icon: HeartPulse, title: 'Availability at a glance', body: 'Check how many slots are left before you register.', access: 'open' },
      { icon: ClipboardCheck, title: 'Simple registration', body: 'Register yourself or a household member in a few taps.', access: 'account' },
      { icon: Users, title: 'My registrations', body: 'Keep every drive you signed up for in one list.', access: 'account' },
    ],
  },
  {
    id: 'feature-reports',
    number: '04',
    label: 'Incident reporting',
    title: 'Report it. Follow it through.',
    body: 'Flag a hazard, dispute or concern to your barangay with photos and a precise location, then watch it get resolved.',
    icon: TriangleAlert,
    href: '/reports/new',
    cta: 'Report an incident',
    capabilities: [
      { icon: TriangleAlert, title: 'Clear, quick reports', body: 'Describe what happened and choose the right category.', access: 'account' },
      { icon: Camera, title: 'Photo evidence', body: 'Attach photos so responders know what to expect.', access: 'account' },
      { icon: MapPin, title: 'Pinned location', body: 'Your address is detected automatically and can be corrected.', access: 'account' },
      { icon: Map, title: 'Community map', body: 'See what has been reported around your barangay.', access: 'open' },
    ],
  },
];

/**
 * The landing page's feature showcase — one editorial row per core service, alternating
 * sides. Uses only theme tokens (see landing.module.css), so it follows the resident's
 * light/dark mode, accent and font settings. Rows state honestly what needs an account.
 */
export function LandingFeatures() {
  return (
    <section aria-labelledby="landing-features-title" className={styles.features}>
      <ScrollReveal className={styles.featuresIntro}>
        <p className={styles.eyebrow}>What you can do</p>
        <h2 id="landing-features-title" className={styles.sectionTitle}>Everything your barangay offers. One place.</h2>
        <p className={styles.sectionLead}>
          Four services built for residents — from staying safe to getting paperwork done.
        </p>
        <nav aria-label="Feature shortcuts" className={styles.featureNav}>
          {FEATURES.map(({ id, label, icon: Icon }) => (
            <a key={id} href={`#${id}`} className={styles.featureNavLink}>
              <Icon aria-hidden size={15} strokeWidth={1.75} />
              {label}
            </a>
          ))}
        </nav>
      </ScrollReveal>

      {FEATURES.map((feature, index) => (
        <FeatureRow key={feature.id} feature={feature} reversed={index % 2 === 1} />
      ))}
    </section>
  );
}

function FeatureRow({ feature, reversed }: { feature: Feature; reversed: boolean }) {
  const { id, number, label, title, body, icon: Icon, href, cta, capabilities } = feature;
  return (
    <article id={id} aria-labelledby={`${id}-title`} className={`${styles.feature} ${reversed ? styles.featureReversed : ''}`}>
      <ScrollReveal className={styles.featureCopy}>
        <p className={styles.featureNumber}>
          <span>{number}</span> / {label}
        </p>
        <span className={styles.featureIcon}>
          <Icon aria-hidden size={22} strokeWidth={1.75} />
        </span>
        <h3 id={`${id}-title`} className={styles.featureTitle}>{title}</h3>
        <p className={styles.featureBody}>{body}</p>
        <Link href={href} className={styles.featureLink}>
          {cta} <ArrowRight aria-hidden size={15} />
        </Link>
      </ScrollReveal>

      <ScrollReveal className={styles.capabilities}>
        <ul>
          {capabilities.map(({ icon: CapIcon, title: capTitle, body: capBody, access }) => (
            <li key={capTitle} className={styles.capability}>
              <span className={styles.capabilityIcon}>
                <CapIcon aria-hidden size={18} strokeWidth={1.75} />
              </span>
              <div className={styles.capabilityCopy}>
                <p className={styles.capabilityTitle}>{capTitle}</p>
                <p className={styles.capabilityBody}>{capBody}</p>
              </div>
              <span className={`${styles.access} ${access === 'open' ? styles.accessOpen : ''}`}>
                {access === 'open' ? 'Open to all' : 'Account'}
              </span>
            </li>
          ))}
        </ul>
      </ScrollReveal>
    </article>
  );
}

/** Closing call to action shown to guests under the features and latest announcement. */
export function LandingCta() {
  return (
    <ScrollReveal className={styles.cta}>
      <div>
        <p className={styles.eyebrow}>Ready when you are</p>
        <h2 className={styles.ctaTitle}>Begin with a free resident account.</h2>
        <p className={styles.ctaBody}>Request documents, report concerns, and register for drives — all from one account.</p>
      </div>
      <div className={styles.ctaActions}>
        <Link href="/register" className={styles.ctaPrimary}>Create an account <ArrowRight aria-hidden size={16} /></Link>
        <Link href="/login" className={styles.ctaSecondary}>Log In</Link>
      </div>
    </ScrollReveal>
  );
}
