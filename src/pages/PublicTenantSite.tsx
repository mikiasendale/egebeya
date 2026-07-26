import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { PublicBooking } from './PublicBooking';
import { Render } from '@measured/puck';
import { config } from '../lib/puck.config';
import '@measured/puck/dist/index.css';

export function PublicTenantSite({ hostname }: { hostname: string }) {
  const [tenant, setTenant] = useState<any>(null);
  const [pageData, setPageData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const subdomain = hostname.split('.')[0];

  useEffect(() => {
    // Fetch tenant basic info (could be added to the /api/public/page response to save requests)
    fetch(`/api/public/page`, {
      headers: { 'X-Tenant-Slug': subdomain }
    })
      .then(res => {
        if (!res.ok) throw new Error('Not found');
        return res.json();
      })
      .then(data => {
        setTenant(data.tenant);
        setPageData(data.page?.content || null);
        setLoading(false);
      })
      .catch(err => {
        setError('Business not found');
        setLoading(false);
      });
  }, [subdomain]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (error || !tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center flex-col bg-gray-50">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Business Not Found</h1>
        <p className="text-gray-600 mb-8">The business you are looking for does not exist or has been moved.</p>
        <a href="https://egebeya.et" className="text-[#1E3A8A] font-semibold hover:underline">
          Visit Egebeya Directory
        </a>
      </div>
    );
  }

  // If the Puck page starts with a Hero block (or contains one), assume it provides
  // its own header/banner and skip the default header to avoid double headers.
  const hasHeroBlock = Array.isArray(pageData?.content?.blocks) &&
    pageData.content.blocks.some((b: any) => b?.type === 'Hero');

  const showDefaultHeader = !pageData || !hasHeroBlock;

  return (
    <div className="min-h-screen font-sans bg-gray-50">
      <Helmet>
        <title>{tenant.name} | Book Online</title>
        {tenant.settings?.description && (
          <meta name="description" content={tenant.settings.description} />
        )}
      </Helmet>

      {/* Default header only when no Puck page or the page has no Hero block */}
      {showDefaultHeader && (
        <header className="bg-white border-b py-6 px-8 flex justify-between items-center shadow-sm">
          <h1 className="text-2xl font-bold text-[#1E3A8A] cursor-pointer" onClick={() => navigate('/')}>{tenant.name}</h1>
          <button onClick={() => navigate('/book')} className="bg-[#1E3A8A] text-white px-6 py-2 rounded-md font-medium hover:bg-blue-800">Book Now</button>
        </header>
      )}

      {/* Floating "Book Now" button so the action is always accessible, even when
          the Puck page overrides the header with its own Hero block. */}
      {pageData && hasHeroBlock && (
        <button
          onClick={() => navigate('/book')}
          className="fixed bottom-6 right-6 z-50 bg-[#1E3A8A] text-white px-5 py-3 rounded-full font-medium shadow-lg hover:bg-blue-800 transition"
        >
          Book Now
        </button>
      )}

      <Routes>
        <Route path="/" element={
          pageData ? (
            <Render config={config} data={pageData} />
          ) : (
            <main className="max-w-4xl mx-auto py-12 px-4 text-center">
              <h2 className="text-4xl font-extrabold text-gray-900 mb-4">Welcome to {tenant.name}</h2>
              <p className="text-xl text-gray-600">This business hasn't published their website yet.</p>
            </main>
          )
        } />
        <Route path="/book" element={<PublicBooking tenant={tenant} subdomain={subdomain} />} />
      </Routes>
    </div>
  );
}
