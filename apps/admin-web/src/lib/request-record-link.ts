/** Open a request in the Requests workspace's existing record side sheet. */
export function requestRecordHref(id: string) {
  return `/requests?record=${encodeURIComponent(id)}`;
}
