import React, { useEffect, useRef, useState } from 'react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';

type DiscoverBusiness = {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  city: string | null;
  heroImage: string | null;
  isNew: boolean;
};

const DEFAULT_CATEGORIES = ['Salon', 'Clinic', 'Pharmacy', 'Spa', 'Other'];
const PAGE_SIZE = 20;

function normalizeCategory(value: string | null | undefined): string {
  if (!value) return 'Other';
  const trimmed = value.trim();
  if (!trimmed) return 'Other';
  const known = DEFAULT_CATEGORIES.find(function (c) { return c.toLowerCase() === trimmed.toLowerCase(); });
  return known || 'Other';
}

function placeholderColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return `hsl(${h}, 45%, 40%)`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map(function (p) { return p.charAt(0).toUpperCase(); }).join('') || '·';
}

/**
 * Directory page backed entirely by the server: `?limit&offset&q&category&city`
 * on GET /api/public/discover, with `X-Total-Count` driving the paginator.
 * Page/offset resets whenever a filter changes so you never land on an empty
 * trailing page.
 */
export function Discover() {
  const [businesses, setBusinesses] = useState<DiscoverBusiness[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [offset, setOffset] = useState(0);

  // Debounce the free-text search so we don't fire a request per keystroke.
  const [debouncedQ, setDebouncedQ] = useState('');
  const qTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(function () {
    if (qTimer.current) clearTimeout(qTimer.current);
    qTimer.current = setTimeout(function () { setDebouncedQ(search.trim()); }, 300);
    return function () { if (qTimer.current) clearTimeout(qTimer.current); };
  }, [search]);

  // Reset to page 0 whenever a filter changes.
  useEffect(function () { setOffset(0); }, [debouncedQ, cityFilter, activeCategory]);

  useEffect(function () {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
    if (debouncedQ) params.set('q', debouncedQ);
    if (cityFilter.trim()) params.set('city', cityFilter.trim());
    if (activeCategory !== 'All') params.set('category', activeCategory.toLowerCase());

    (async function () {
      try {
        const res = await fetch(`/api/public/discover?${params.toString()}`);
        if (!res.ok) throw new Error('Request failed (' + res.status + ')');
        const total = parseInt(res.headers.get('x-total-count') || '0', 10) || 0;
        const data = await res.json();
        if (!cancelled) {
          setBusinesses(Array.isArray(data) ? (data as DiscoverBusiness[]) : []);
          setTotalCount(total);
          setError(null);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError((err && err.message) || 'Could not load businesses');
          setBusinesses([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return function () { cancelled = true; };
  }, [debouncedQ, cityFilter, activeCategory, offset]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  function catBtnCls(isActive: boolean) {
    return 'px-6 py-2 rounded-full font-medium whitespace-nowrap ' + (isActive ? 'bg-ink text-paper' : 'bg-paper-bleached border border-ink-rule text-ink-soft hover:border-ink hover:text-ink');
  }

  function goToPage(page: number) {
    setOffset((page - 1) * PAGE_SIZE);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className="min-h-screen bg-paper flex flex-col" style={{ fontFamily: 'var(--font-body)' }}>
      <div className="bg-ink">
        <Navbar />
        <div className="pt-24 pb-16 px-4 text-center max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-extrabold text-paper mb-6">Discover Local Businesses</h1>
          <p className="text-xl text-paper/70 mb-8">Book appointments at the best salons, clinics, and service providers in Ethiopia.</p>
          <div className="flex bg-paper-bleached rounded-full p-2 max-w-2xl mx-auto border border-ink-rule">
            <input
              type="text"
              value={search}
              onChange={function (e) { setSearch(e.target.value); }}
              placeholder="Search for a business or service..."
              className="flex-1 px-6 py-3 outline-none text-ink rounded-l-full"
              style={{ fontFamily: 'var(--font-body)' }}
            />
            <button
              type="button"
              onClick={function () { setSearch(''); }}
              className="bg-telebirr text-paper px-8 py-3 rounded-full font-bold hover:opacity-90 transition-colors"
            >Search</button>
          </div>
          <div className="mt-4 flex items-center justify-center gap-2">
            <input
              type="text"
              value={cityFilter}
              onChange={function (e) { setCityFilter(e.target.value); }}
              placeholder="Filter city…"
              className="px-4 py-2 rounded-full text-sm text-ink outline-none bg-paper-bleached border border-ink-rule"
              style={{ fontFamily: 'var(--font-body)' }}
            />
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        <div className="flex space-x-4 mb-10 overflow-x-auto pb-2">
          <button
            type="button"
            onClick={function () { setActiveCategory('All'); }}
            className={catBtnCls(activeCategory === 'All')}
          >All</button>
          {DEFAULT_CATEGORIES.map(function (cat) {
            return (
              <button
                type="button"
                key={cat}
                onClick={function () { setActiveCategory(cat); }}
                className={catBtnCls(activeCategory === cat)}
              >{cat}</button>
            );
          })}
        </div>

        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={`skeleton-${i}`}
                className="bg-paper-bleached rounded-2xl overflow-hidden border border-ink-rule"
                style={{ animation: `fade-in 200ms cubic-bezier(0.16, 1, 0.3, 1) ${i * 50}ms both` }}
              >
                <div className="skeleton-wave" style={{ height: '12rem' }} />
                <div className="p-6 space-y-3">
                  <div className="skeleton-wave" style={{ height: '1.5rem', width: '70%', borderRadius: '2px' }} />
                  <div className="skeleton-wave" style={{ height: '1rem', width: '40%', borderRadius: '2px' }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="text-center text-signal py-16">
            <p className="font-semibold mb-2">Could not load businesses</p>
            <p className="text-sm text-ink-soft">{String(error)}</p>
          </div>
        )}

        {!loading && !error && businesses.length === 0 && (
          <div className="text-center text-ink-soft py-16">
            <p className="font-semibold text-ink mb-2">No businesses match your search.</p>
            <p className="text-sm">
              {totalCount === 0
                ? 'No tenants have listed themselves yet — be the first to publish your site.'
                : 'Try a different category, city, or search term.'}
            </p>
          </div>
        )}

        {!loading && !error && businesses.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {businesses.map(function (business) {
              const category = normalizeCategory(business.category);
              const isLocal =
                typeof window !== 'undefined' &&
                (window.location.hostname === 'localhost' ||
                  window.location.hostname === '127.0.0.1' ||
                  window.location.hostname.includes('127.0.0.1'));
              const href = isLocal
                ? `${window.location.origin}/${business.slug}/book`
                : `http://${business.slug}.egebeya.et`;
              return (
                <a key={business.id} href={href} className="block group">
                  <div className="bg-paper-bleached rounded-2xl overflow-hidden border border-ink-rule group-hover:opacity-90 transition-all transform group-hover:-translate-y-1">
                    <div className="h-48 overflow-hidden relative">
                      {business.heroImage ? (
                        <img
                          src={business.heroImage}
                          alt={business.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div
                          className="w-full h-full flex items-center justify-center"
                          style={{ backgroundColor: placeholderColor(business.id) }}
                          aria-hidden
                        >
                          <span className="text-5xl font-extrabold tracking-tight text-white/90 select-none">
                            {initials(business.name)}
                          </span>
                        </div>
                      )}
                      <div className="absolute top-4 right-4 bg-paper-bleached/90 backdrop-blur text-xs font-bold px-3 py-1 rounded-full text-ink-soft">
                        {category}
                      </div>
                    </div>
                    <div className="p-6">
                      <h3 className="text-xl font-bold text-ink mb-2">{business.name}</h3>
                      <div className="flex items-center text-ink-soft text-sm min-h-[1.25rem]">
                        {business.city ? (
                          <span>{business.city}</span>
                        ) : business.isNew ? (
                          <>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[0.65rem] font-bold uppercase tracking-wide bg-telebirr/15 text-telebirr-deep">
                              New
                            </span>
                            <span className="mx-2 text-ink-rule-dashed">·</span>
                            <span className="text-ink-stamp">No bookings yet</span>
                          </>
                        ) : (
                          <span className="text-ink-stamp">{business.slug}.egebeya.et</span>
                        )}
                      </div>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        )}

        {!loading && !error && totalPages > 1 && (
          <nav className="flex items-center justify-center gap-2 mt-12" aria-label="Directory pages">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={function () { goToPage(currentPage - 1); }}
              className="px-4 py-2 rounded-md text-sm font-medium bg-paper-bleached border border-ink-rule text-ink hover:border-ink disabled:opacity-40 disabled:hover:border-ink-rule"
            >← Prev</button>
            {Array.from({ length: totalPages }, function (_, i) { return i + 1; }).map(function (p) {
              return (
                <button
                  key={p}
                  type="button"
                  onClick={function () { goToPage(p); }}
                  aria-current={p === currentPage ? 'page' : undefined}
                  className={`min-w-10 px-3 py-2 rounded-md text-sm font-medium ${
                    p === currentPage ? 'bg-ink text-paper' : 'bg-paper-bleached border border-ink-rule text-ink hover:border-ink'
                  }`}
                >{p}</button>
              );
            })}
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={function () { goToPage(currentPage + 1); }}
              className="px-4 py-2 rounded-md text-sm font-medium bg-paper-bleached border border-ink-rule text-ink hover:border-ink disabled:opacity-40 disabled:hover:border-ink-rule"
            >Next →</button>
          </nav>
        )}
      </main>

      <Footer />
    </div>
  );
}