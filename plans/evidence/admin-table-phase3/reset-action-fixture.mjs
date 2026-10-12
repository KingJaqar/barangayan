import {sql} from './runtime-stack.mjs';
sql("set session_replication_role=replica;update public.service_requests set status='submitted' where id='40000000-0000-4000-8000-000000001505';");

sql("update public.payments set status='pending',method='pickup',amount_centavos=100,paid_at=null,deleted_at=null,refund_status='none',refund_transfer_link=null where id='50000000-0000-4000-8000-000000001505';");

