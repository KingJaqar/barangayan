import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AnnouncementForm } from '../../src/app/(admin)/announcements/announcement-form';
import { AnnouncementRow } from '../../src/app/(admin)/announcements/announcement-row';
import { ContentCreatePanel } from '../../src/components/admin/content-create-panel';
import { ThemeControllerProvider } from '../../src/components/ui/theme-controller';
import { Toaster } from '../../src/components/ui/sonner';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import styles from '../../src/components/admin/content-workspace.module.css';

function Publisher() {
  const [rows,setRows]=useState([]);
  const [error,setError]=useState('');
  useEffect(()=>{
    const controller=new AbortController();
    const refresh=()=>{
      void createSupabaseBrowserClient().from('announcements').select('*').order('created_at').abortSignal(controller.signal)
        .then(({data,error:failure})=>{if(!controller.signal.aborted){if(failure)setError(failure.message);else setRows(data??[]);}});
    };
    window.addEventListener('publisher-refresh',refresh);refresh();
    return ()=>{controller.abort();window.removeEventListener('publisher-refresh',refresh);};
  },[]);
  return <ThemeControllerProvider><Toaster /><main className={styles.page} style={{padding:16}}>
    <ContentCreatePanel title="Announcements" description="Isolated lifetime integration" forms={[{label:'Create announcement',title:'New announcement',description:'Synthetic Docker test only',content:<AnnouncementForm barangayId="a1490000-0000-4000-8000-000000000001" />}]} />
    {error?<p role="alert">{error}</p>:null}
    {rows.map(row=><AnnouncementRow key={row.id} announcement={row} />)}
  </main></ThemeControllerProvider>;
}
const root=document.getElementById('root');
if(!root)throw new Error('Missing publisher fixture root');
createRoot(root).render(<Publisher />);
