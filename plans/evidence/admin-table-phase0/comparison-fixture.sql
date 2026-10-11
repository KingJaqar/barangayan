-- Independent contract experiment over ephemeral CTE values only.
-- No application query, DDL, insert, temporary object, or production row access.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '8000ms';
WITH names(id, value) AS (
  VALUES (1,' Ana '::text),(2,'ana'),(3,'Ána'),(4,'Zoë'),(5,'李明'),(6,''),(7,NULL),(8,'   ')
), refs(id,value) AS (
  VALUES (1,'REQ-2'::text),(2,'REQ-10'),(3,'REQ-0002'),(4,'custom'),(5,NULL)
), instants(id,value) AS (
  VALUES (1,'2026-10-10T16:00:00Z'::timestamptz),(2,'2026-10-11T00:00:00+08:00'::timestamptz)
), sizes(n) AS (VALUES(0),(1),(7),(10),(11),(23),(100),(101),(1505)),
page_sizes(n) AS (VALUES(10),(20),(30),(50),(100)),
coverage AS (
  SELECT s.n AS total,p.n AS page_size,
    count(g.id) AS recovered_rows,count(DISTINCT g.id) AS unique_rows
  FROM sizes s CROSS JOIN page_sizes p
  LEFT JOIN LATERAL generate_series(1,s.n) g(id) ON true
  GROUP BY s.n,p.n
)
SELECT jsonb_build_object(
 'fixture_only',true,
 'name_ascending',(SELECT jsonb_agg(id ORDER BY nullif(btrim(lower(value)),'') COLLATE "und-x-icu" ASC NULLS LAST,id) FROM names),
 'name_descending',(SELECT jsonb_agg(id ORDER BY nullif(btrim(lower(value)),'') COLLATE "und-x-icu" DESC NULLS LAST,id) FROM names),
 'case_tie',lower(btrim(' Ana '))=lower(btrim('ana')),
 'accents_retained',lower('Ana')<>lower('Ána'),
 'reference_lexical',(SELECT jsonb_agg(value ORDER BY value COLLATE "C" NULLS LAST,id) FROM refs),
 'numeric_suffix_values',(SELECT jsonb_agg(jsonb_build_object('id',id,'numeric',substring(value FROM '[0-9]+$')::numeric) ORDER BY id) FROM refs),
 'timestamp_instants_equal',(SELECT count(DISTINCT value)=1 FROM instants),
 'manila_midnight_date',('2026-10-10T16:00:00Z'::timestamptz AT TIME ZONE 'Asia/Manila')::date,
 'size_combinations',(SELECT count(*) FROM coverage),
 'row_count_identity',(SELECT bool_and(recovered_rows=total AND unique_rows=total) FROM coverage)
) AS evidence;
COMMIT;
