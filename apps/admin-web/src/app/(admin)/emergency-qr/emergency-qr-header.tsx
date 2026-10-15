import { ScanLine } from 'lucide-react';
import styles from './emergency-qr.module.css';

export function EmergencyQrHeader() {
  return (
    <header className={styles.header}>
      <p className={styles.eyebrow}><ScanLine size={15} aria-hidden="true" /> Emergency preparedness</p>
      <h1>Emergency QR<span>Clear guidance. Faster check-ins.</span></h1>
      <p className={styles.intro}>Manage the instructions residents see and the QR codes that welcome them to your evacuation centers.</p>
    </header>
  );
}
