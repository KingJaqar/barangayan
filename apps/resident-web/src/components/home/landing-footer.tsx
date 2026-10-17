import { Phone } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { BackToTop, FooterGroup } from './footer-interactions';
import styles from './landing.module.css';

const LINK_GROUPS = [
  {
    title: 'Services',
    links: [
      { href: '/services/documents', label: 'Request a document' },
      { href: '/services/requests', label: 'My requests' },
      { href: '/health', label: 'Medical drives' },
      { href: '/reports/new', label: 'Report an incident' },
    ],
  },
  {
    title: 'Emergency',
    links: [
      { href: '/emergency', label: 'Emergency hub' },
      { href: '/emergency/centers', label: 'Evacuation centers' },
      { href: '/emergency/alerts', label: 'Alerts' },
      { href: '/emergency/family', label: 'Family check-in' },
    ],
  },
  {
    title: 'Community',
    links: [
      { href: '/announcements', label: 'Announcements' },
      { href: '/maps', label: 'Community map' },
      { href: '/maps/directory', label: 'Directory' },
      { href: '/settings/help', label: 'Help center' },
    ],
  },
] as const;

/**
 * Landing-page footer: emergency call-out, brand, link columns and legal row. Static
 * server markup; only the mobile column disclosure and back-to-top button are client
 * code. Colors come exclusively from theme tokens. 911 is the national emergency
 * number; barangay-specific hotlines live in the Emergency Hub (loaded from the database).
 */
export function LandingFooter({ barangayName }: { barangayName: string | null }) {
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={styles.footerEmergency}>
        <div>
          <p className={styles.footerEmergencyTitle}>In an emergency, call 911.</p>
          <p className={styles.footerEmergencyBody}>
            Your barangay&apos;s own hotlines and safety guidance are in the Emergency Hub.
          </p>
        </div>
        <div className={styles.footerEmergencyActions}>
          <a href="tel:911" className={styles.footerCall}>
            <Phone aria-hidden size={16} /> Call 911
          </a>
          <Link href="/emergency" className={styles.footerHubLink}>Barangay hotlines</Link>
        </div>
      </div>

      <div className={styles.footerMain}>
        <div className={styles.footerBrand}>
          <Link href="/home" className={styles.footerLogo}>
            <Image src="/assets/logo/barangayan-logo-1024.png" alt="" width={32} height={32} className="h-8 w-8 object-contain" />
            <span>Barangayan</span>
          </Link>
          {barangayName ? <p className={styles.footerLocality}>{barangayName}</p> : null}
          <p className={styles.footerTagline}>
            Request documents, report incidents, and stay connected with your barangay.
          </p>
        </div>

        <div className={styles.footerGroups}>
          {LINK_GROUPS.map(({ title, links }) => (
            <FooterGroup key={title} title={title}>
              <ul>
                {links.map(({ href, label }) => (
                  <li key={href}>
                    <Link href={href} className={styles.footerLink}>{label}</Link>
                  </li>
                ))}
              </ul>
            </FooterGroup>
          ))}
        </div>
      </div>

      <div className={styles.footerBottom}>
        <p>&copy; {year} Barangayan. All rights reserved.</p>
        <nav aria-label="Legal and help" className={styles.footerLegal}>
          <Link href="/settings/terms-privacy" className={styles.footerLink}>Terms &amp; Privacy</Link>
          <Link href="/settings/about" className={styles.footerLink}>About</Link>
        </nav>
        <BackToTop />
      </div>
    </footer>
  );
}
