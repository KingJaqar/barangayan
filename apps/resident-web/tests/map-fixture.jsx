import { createRoot } from 'react-dom/client';
import { MapCanvas } from '../src/components/maps/map-canvas';
import { MapSidebar } from '../src/components/maps/map-sidebar';
import styles from '../src/components/maps/maps.module.css';
const names = ['Damaged Street Light', 'Drainage Issue', 'Flooding', 'Illegal Dumping', 'Road Damage'];
const colors = ['#f59e0b', '#3b82f6', '#6366f1', '#22c55e', '#ef4444'];
const categories = names.map((name, index) => ({ id: String(index), name, color: colors[index] }));
const incidentMarkers = categories.flatMap((category, index) => [0, 1].map(n => ({
  id: `${index}-${n}`, label: `${n ? 'Second' : 'Reported'} ${category.name}`, kind: category.id,
  position: { lat: 14.680291 + index * .0006, lng: 121.1187445 + n * .0003 },
  categoryName: category.name, categoryColor: category.color, address: `${n + 1} Mabini Street`, status: 'open'
})));
const evacuationMarkers = [{ id: 'center', kind: 'evacuation', label: 'Ampid Evacuation Center', position: { lat: 14.682, lng: 121.119 }, capacity: 100, currentOccupancy: 12 }];
createRoot(document.getElementById('root')).render(<main className={styles.page} style={{ padding: 20 }}>
  <div className={styles.summary}><span className={styles.summaryLabel}>Community overview</span><p>10 incidents · 1 evacuation center</p></div>
  <div className={styles.workspace}><MapCanvas incidentMarkers={incidentMarkers} evacuationMarkers={evacuationMarkers} categories={categories} boundary={null} /><MapSidebar /></div>
</main>);
