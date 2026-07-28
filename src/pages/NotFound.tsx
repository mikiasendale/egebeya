import React from 'react';
import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-4 py-12" style={{ fontFamily: 'var(--font-body)' }}>
      <div className="max-w-md w-full text-center">
        <Link to="/" aria-label="Egebeya home" className="inline-block mb-8">
          <svg
            className="h-16 w-auto mx-auto text-ink"
            viewBox="0 0 100 50"
            fill="currentColor"
          >
            <text x="50" y="20" fontSize="20" fontWeight="bold" textAnchor="middle" fill="currentColor" fontFamily="'Noto Serif Ethiopic', serif">ኢ-ገበያ</text>
            <text x="50" y="40" fontSize="16" fontWeight="bold" textAnchor="middle" fill="currentColor" fontFamily="'Bricolage Grotesque', system-ui, sans-serif">Egebeya</text>
          </svg>
        </Link>

        <div className="inline-flex items-center justify-center px-3 py-1 mb-6 rounded-full bg-paper-raised text-ink-soft text-xs font-semibold uppercase tracking-wider">
          404 &middot; Page not found
        </div>

        <h1 className="text-4xl sm:text-5xl font-extrabold text-ink mb-4 tracking-tight">
          Page not found
        </h1>
        <p className="text-base sm:text-lg text-ink-soft mb-8 leading-relaxed">
          The page you&rsquo;re looking for doesn&rsquo;t exist or has been moved. Double-check the URL, or head back home.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/"
            className="inline-flex items-center justify-center px-6 py-3 rounded-md font-semibold text-paper bg-ink hover:opacity-90 transition-colors"
          >
            Back to Home
          </Link>
          <Link
            to="/discover"
            className="inline-flex items-center justify-center px-6 py-3 rounded-md font-semibold text-ink bg-paper-bleached border border-ink-rule hover:opacity-80 transition-colors"
          >
            Browse businesses
          </Link>
        </div>
      </div>
    </div>
  );
}

export default NotFound;
