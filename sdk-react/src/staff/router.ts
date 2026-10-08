import { useCallback, useEffect, useMemo, useState } from 'react';

export interface StaffRoute {
  /** Path without the prefix, e.g. "/gaps/12". */
  path: string;
  segments: string[];
  query: Record<string, string>;
  /** True when the current hash is outside this dashboard's prefix. */
  outside: boolean;
}

function normPrefix(prefix: string): string {
  const p = (prefix || '').trim().replace(/\/+$/, '');
  if (!p) return '';
  return p.startsWith('/') ? p : `/${p}`;
}

export function parseHash(hash: string, prefix: string): StaffRoute {
  const raw = hash.replace(/^#/, '') || '/';
  const [pathPart, queryPart = ''] = raw.split('?');
  const p = normPrefix(prefix);
  let path = pathPart || '/';
  let outside = false;
  if (p) {
    if (path === p || path.startsWith(`${p}/`)) path = path.slice(p.length) || '/';
    else outside = true;
  }
  if (!path.startsWith('/')) path = `/${path}`;
  const query: Record<string, string> = {};
  if (queryPart) {
    new URLSearchParams(queryPart).forEach((v, k) => {
      query[k] = v;
    });
  }
  return { path, segments: path.split('/').filter(Boolean).map(decodeURIComponent), query, outside };
}

export function buildHref(prefix: string, to: string, query?: Record<string, string | number | undefined | null>): string {
  const p = normPrefix(prefix);
  const path = to.startsWith('/') ? to : `/${to}`;
  let qs = '';
  if (query) {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
    });
    const s = params.toString();
    if (s) qs = `?${s}`;
  }
  return `#${p}${path}${qs}`;
}

/** Convert a backend link like "#/gaps/12" into a prefixed href. */
export function resolveLink(prefix: string, link: string | null | undefined): string | null {
  if (!link) return null;
  if (/^https?:/i.test(link)) return link;
  const raw = link.replace(/^#/, '');
  const [path, q] = raw.split('?');
  return `#${normPrefix(prefix)}${path.startsWith('/') ? path : `/${path}`}${q ? `?${q}` : ''}`;
}

export function useHashRouter(prefix: string) {
  const read = useCallback(() => parseHash(typeof window === 'undefined' ? '' : window.location.hash, prefix), [prefix]);
  const [route, setRoute] = useState<StaffRoute>(read);

  useEffect(() => {
    const onChange = () => setRoute(read());
    onChange();
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, [read]);

  const href = useCallback((to: string, query?: Record<string, string | number | undefined | null>) => buildHref(prefix, to, query), [prefix]);

  const navigate = useCallback(
    (to: string, query?: Record<string, string | number | undefined | null>, opts?: { replace?: boolean }) => {
      const h = buildHref(prefix, to, query);
      if (opts?.replace) {
        const url = `${window.location.pathname}${window.location.search}${h}`;
        window.history.replaceState(window.history.state, '', url);
        setRoute(parseHash(h, prefix));
      } else if (window.location.hash !== h) {
        window.location.hash = h;
      }
    },
    [prefix]
  );

  return useMemo(() => ({ route, href, navigate }), [route, href, navigate]);
}
