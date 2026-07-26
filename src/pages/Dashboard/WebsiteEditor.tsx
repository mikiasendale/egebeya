import React, { useState, useEffect } from 'react';
import { Puck } from '@measured/puck';
import '@measured/puck/dist/index.css';
import { config } from '../../lib/puck.config';
import { authFetch } from '../../lib/api';
import { showToast } from '../../components/ui/toast-helper';
import { StaffRedirect } from './StaffRedirect';

export function WebsiteEditor() {
  const [initialData, setInitialData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authFetch('/api/tenant/page')
      .then(res => res.json())
      .then(data => {
        if (data && data.content) {
          setInitialData(data.content);
        } else {
          setInitialData({
            content: [],
            root: {},
          });
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch page data', err);
        setLoading(false);
      });
  }, []);

  const handlePublish = async (data: any) => {
    try {
      const res = await authFetch('/api/tenant/page', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: data }),
      });
      if (res.ok) {
        showToast('Page published successfully!', 'Your website is now live.');
      } else {
        showToast('Failed to publish page', 'Please try again.', 'destructive');
      }
    } catch (err) {
      console.error(err);
      showToast('Error publishing page', 'An unexpected error occurred.', 'destructive');
    }
  };

  if (loading) {
    return (
      <StaffRedirect>
        <div className="p-8 text-center text-gray-500">Loading editor</div>
      </StaffRedirect>
    );
  }

  return (
    <StaffRedirect>
      <div className="h-[calc(100vh-80px)] overflow-hidden rounded-xl border border-gray-200">
        <Puck
          config={config}
          data={initialData}
          onPublish={handlePublish}
        />
      </div>
   </StaffRedirect>
  );
}
