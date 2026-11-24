import { useSearchParams } from 'react-router-dom';
const KEY = 'crowd-table';
const clean = (value: string | null) =>
  value && /^[A-Za-z0-9-]{1,10}$/.test(value) ? value : null;
function stored() {
  try {
    return clean(sessionStorage.getItem(KEY));
  } catch {
    return null;
  }
}
/** Table number from the QR link (?table=5). Remembered for the visit so it survives navigation. */
export function useTable() {
  const [params] = useSearchParams();
  const fromUrl = clean(params.get('table'));
  if (fromUrl) {
    try {
      sessionStorage.setItem(KEY, fromUrl);
    } catch {
      /* storage can be unavailable (private mode); the URL value still works for this page */
    }
    return fromUrl;
  }
  return stored();
}
