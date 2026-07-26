import React, { useEffect, useMemo, useState } from 'react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';

type DiscoverBusiness = {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  // Real data from the tenant — no fabricated defaults. city is null when
  // the tenant hasn't set one in Settings General; heroImage is null when
  // the tenant hasn't uploaded a Hero image in the Puck editor.
  city: string | null;
  heroImage: string | null;
  // True when the tenant has never had a confirmed/completed booking. The
  // frontend shows a "New" pill rather than fabricating a rating (we have
  // no review system, so any average would be a lie).
  isNew: boolean;
};

const DEFAULT_CATEGORIES = ['Salon', 'Clinic', 'Pharmacy', 'Spa', 'Other'];

function normalizeCategory(value: string | null | undefined): string {
  if (!value) return 'Other';
  const trimmed = value.trim();
  if (!trimmed) return 'Other';
  const known = DEFAULT_CATEGORIES.find(function (c) { return c.toLowerCase() === trimmed.toLowerCase(); });
  return known || 'Other';
}

// Deterministic brand color for the placeholder tile so empty-card art doesn't
// look chaotic — derived from the tenant id so the same tenant keeps its color.
function placeholderColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return `hsl(${h}, 45%, 40%)`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map(function (p) { return p.charAt(0).toUpperCase(); }).join('') || '·';
}

export function Discover() {
  const [businesses, setBusinesses] = useState<DiscoverBusiness[]>([]);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(function () {
    let cancelled = false;
    (async function () {
      try {
        const res = await fetch('/api/public/discover');
        if (!res.ok) throw new Error('Request failed (' + res.status + ')');
        const data = await res.json();
        if (!cancelled) {
          setBusinesses(Array.isArray(data) ? (data as DiscoverBusiness[]) : []);
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
  }, []);

  const availableCategories = useMemo(function () {
    const found = new Set<string>();
    for (const b of businesses) found.add(normalizeCategory(b.category));
    const ordered = DEFAULT_CATEGORIES.filter(function (c) { return found.has(c); });
    for (const c of found) if (ordered.indexOf(c) === -1) ordered.push(c);
    return ordered;
  }, [businesses]);

  const filteredBusinesses = useMemo(function () {
    const needle = search.trim().toLowerCase();
    return businesses.filter(function (b) {
      if (activeCategory !== 'All' && normalizeCategory(b.category) !== activeCategory) return false;
      if (needle && b.name.toLowerCase().indexOf(needle) === -1) return false;
      return true;
    });
  }, [businesses, search, activeCategory]);

  function catBtnCls(isActive: boolean) {
    return 'px-6 py-2 rounded-full font-medium whitespace-nowrap ' + (isActive ? 'bg-[#1E3A8A] text-white' : 'bg-white border border-gray-200 text-gray-700 hover:border-[#1E3A8A] hover:text-[#1E3A8A]');
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-[#1E3A8A]">
        <Navbar />
        <div className="pt-24 pb-16 px-4 text-center max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-6">Discover Local Businesses</h1>
          <p className="text-xl text-blue-100 mb-8">Book appointments at the best salons, clinics, and service providers in Ethiopia.</p>
          <div className="flex bg-white rounded-full p-2 shadow-lg max-w-2xl mx-auto">
            <input
              type="text"
              value={search}
              onChange={function(e) { setSearch(e.target.value); }}
              placeholder="Search for a business or service..."
              className="flex-1 px-6 py-3 outline-none text-gray-800 rounded-l-full"
            />
            <button
              type="button"
              onClick={function() { setSearch(''); }}
              className="bg-[#F59E0B] text-white px-8 py-3 rounded-full font-bold hover:bg-amber-600 transition-colors"
            >Search </button>
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        <div className="flex space-x-4 mb-10 overflow-x-auto pb-2">
          <button
            type="button"
            onClick={function() { setActiveCategory('All'); }}
            className={catBtnCls(activeCategory === 'All')}
          >All </button>
          {availableCategories.map(function (cat) {
            return (
              <button
                type="button"
                key={cat}
                onClick={function() { setActiveCategory(cat); }}
                className={catBtnCls(activeCategory === cat)}
              >{cat} </button>
            );
          })}
        </div>

        {loading && (
          <div className="text-center text-gray-500 py-16">Loading businesses...</div>
        )}

        {!loading && error && (
          <div className="text-center text-red-600 py-16">
            <p className="font-semibold mb-2">Could not load businesses</p>
            <p className="text-sm text-gray-500">{String(error)} </p>
          </div>
        )}

        {!loading && !error && filteredBusinesses.length === 0 && (
          <div className="text-center text-gray-500 py-16">
            <p className="font-semibold text-gray-700 mb-2">No businesses match your search.</p>
            <p className="text-sm">
              {businesses.length === 0
                ? 'No tenants have listed themselves yet — be the first to publish your site.'
                : 'Try a different category or search term.'}
            </p>
          </div>
        )}

        {!loading && !error && filteredBusinesses.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredBusinesses.map(function (business) {
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
                  <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 group-hover:shadow-lg transition-all transform group-hover:-translate-y-1">
                    <div className="h-48 overflow-hidden relative">
                      {business.heroImage ? (
                        <img
                          src={business.heroImage}
                          alt={business.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        // Plain branded placeholder — no stock photo. Uses the
                        // tenant's initials on a deterministic brand color so
                        // each card is distinguishable without inventing art.
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
                      <div className="absolute top-4 right-4 bg-white/90 backdrop-blur text-xs font-bold px-3 py-1 rounded-full text-[#1E3A8A]">
                        {category}
                      </div>
                    </div>
                    <div className="p-6">
                      <h3 className="text-xl font-bold text-gray-900 mb-2">{business.name} </h3>
                      {/* Real city only — no fabricated "Addis Ababa" default.
                          When omitted entirely when the tenant hasn't set one. */}
                      <div className="flex items-center text-gray-500 text-sm min-h-[1.25rem]">
                        {business.city ? (
                          <span>{business.city}</span>
                        ) : business.isNew ? (
                          <>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[0.65rem] font-bold uppercase tracking-wide bg-[#F59E0B]/15 text-[#B45309]">
                              New
                            </span>
                            <span className="mx-2 text-gray-300">·</span>
                            <span className="text-gray-400">No bookings yet</span>
                          </>
                        ) : (
                          <span className="text-gray-400">{business.slug}.egebeya.et</span>
                        )}
                      </div>
                      {business.city && business.isNew && (
                        <div className="mt-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[0.65rem] font-bold uppercase tracking-wide bg-[#F59E0B]/15 text-[#B45309]">
                            New
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
