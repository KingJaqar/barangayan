import { Users, FileText, TriangleAlert, CreditCard, Heart, UserRound, Megaphone, BookOpen, MapPin, HelpCircle, Trash2, Calendar, ArrowUpRight } from 'lucide-react';
import type { SearchCategory, SearchHit } from '@/lib/search/model';
import styles from './search.module.css';

const ICONS = { residents: Users, requests: FileText, incidents: TriangleAlert, transactions: CreditCard,
  health: Heart, applicants: UserRound, households: Users, staff: UserRound, announcements: Megaphone,
  services: FileText, emergency: BookOpen, centers: MapPin, faq: HelpCircle, zones: Trash2, schedules: Calendar };
export function CategoryIcon({ category }: { category: SearchCategory }) {
  const Icon = ICONS[category];
  return <span className={styles.icon}><Icon size={20} aria-hidden="true" /></span>;
}
export function Highlight({ text, query }: { text: string; query: string }) {
  const tokens = query.toLowerCase().split(' ').filter(Boolean);
  if (!tokens.length) return text;
  const escaped = tokens.map(token => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return text.split(new RegExp(`(${escaped.join('|')})`, 'gi')).map((part, index) =>
    tokens.includes(part.toLowerCase()) ? <mark key={index}>{part}</mark> : part);
}
export function HitPreview({ hit, query, compact = false }: { hit: SearchHit; query: string; compact?: boolean }) {
  return <><CategoryIcon category={hit.category} /><span className={styles.hitText}>
    <strong><Highlight text={hit.title} query={query} /></strong>
    {hit.preview ? <span className={compact ? styles.compactPreview : styles.preview}><Highlight text={hit.preview} query={query} /></span> : null}
    {hit.meta && !compact ? <small>{hit.meta}</small> : null}
  </span><ArrowUpRight size={16} className={styles.arrow} aria-hidden="true" /></>;
}
