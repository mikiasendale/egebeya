import React, { useEffect, useState } from 'react';
import type { Config } from '@measured/puck';
import { PublicBooking } from '../pages/PublicBooking';
import { showToast } from '../components/ui/toast-helper';

type Props = {
  Hero: { title: string; subtitle: string; backgroundImage: string };
  Services: {};
  Gallery: { images: { url: string; caption: string }[] };
  About: { content: string };
  Contact: { phone: string; address: string; mapUrl: string };
  LocationMap: { mapUrl: string };
  Testimonials: { items: { quote: string; name: string; avatar: string }[] };
  BusinessHours: {};
  SocialLinks: {};
  BookingForm: {};
};

function getSubdomain() {
  if (typeof window === 'undefined') return '';
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname.includes('run.app') || hostname.includes('egebeya.et')) {
    // Try to get from subdomain, or fallback (for preview might need special handling, 
    // but in dashboard preview we might have to pass it via context or just use local storage)
    const sub = hostname.split('.')[0];
    if (sub !== 'localhost' && !sub.includes('run') && sub !== 'egebeya' && sub !== 'www' && sub !== 'app') {
      return sub;
    }
  }
  return localStorage.getItem('tenantSlug') || '';
}

const ImageUploaderField = ({ value, onChange }: any) => {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    const token = localStorage.getItem('token');
    if (!token) {
      showToast('No auth token found', 'Please sign in and try again.', 'destructive');
      return;
    }
    
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const res = await fetch('/api/tenant/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (data.url) {
        onChange(data.url);
      } else {
        showToast('Upload failed', 'The server did not return a URL.', 'destructive');
      }
    } catch (err) {
      console.error(err);
      showToast('Upload failed', 'Network error.', 'destructive');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <input 
        type="text" 
        value={value || ''} 
        onChange={e => onChange(e.target.value)} 
        placeholder="Image URL"
        className="border border-gray-300 rounded p-1.5 text-sm"
      />
      <div className="flex items-center gap-2">
        <label className="bg-gray-100 border border-gray-300 rounded px-3 py-1 cursor-pointer hover:bg-gray-200 text-sm">
          {uploading ? 'Uploading...' : 'Upload Image'}
          <input type="file" accept="image/*" onChange={handleUpload} className="hidden" disabled={uploading} />
        </label>
      </div>
    </div>
  );
};

export const config: Config<Props> = {
  components: {
    Hero: {
      fields: {
        title: { type: 'text' },
        subtitle: { type: 'textarea' },
        backgroundImage: { type: 'custom', render: ImageUploaderField },
      },
      defaultProps: {
        title: 'Welcome to our business',
        subtitle: 'We provide the best services.',
        backgroundImage: 'https://images.unsplash.com/photo-1522337660859-02fbefca4702?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80',
      },
      render: ({ title, subtitle, backgroundImage }) => (
        <div 
          className="relative bg-cover bg-center h-[500px] flex items-center justify-center text-center text-white"
          style={{ backgroundImage: `url(${backgroundImage})` }}
        >
          <div className="absolute inset-0 bg-black bg-opacity-50" />
          <div className="relative z-10 px-4 max-w-4xl mx-auto">
            <h1 className="text-5xl font-extrabold mb-4">{title}</h1>
            <p className="text-xl">{subtitle}</p>
          </div>
        </div>
      ),
    },
    Services: {
      fields: {},
      render: () => {
        const [services, setServices] = useState<any[]>([]);
        const subdomain = getSubdomain();

        useEffect(() => {
          if (subdomain) {
            fetch(`/api/public/services`, { headers: { 'X-Tenant-Slug': subdomain } })
              .then(res => res.json())
              .then(data => setServices(Array.isArray(data) ? data : []))
              .catch(console.error);
          }
        }, [subdomain]);

        return (
          <div className="py-16 bg-gray-50">
            <div className="max-w-5xl mx-auto px-4">
              <h2 className="text-3xl font-bold text-center mb-10 text-gray-900">Our Services</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {services.map(s => (
                  <div key={s.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-xl font-bold mb-2">{s.name}</h3>
                    <p className="text-gray-500 mb-4">{s.durationMinutes} mins</p>
                    <p className="text-[#F59E0B] font-bold text-lg">{(s.price / 100).toLocaleString()} ETB</p>
                  </div>
                ))}
                {services.length === 0 && <p className="text-center col-span-full text-gray-500">No services available or loading...</p>}
              </div>
            </div>
          </div>
        );
      }
    },
    Gallery: {
      fields: {
        images: {
          type: 'array',
          getItemSummary: (item) => item.caption || 'Image',
          arrayFields: {
            url: { type: 'custom', render: ImageUploaderField },
            caption: { type: 'text' },
          }
        }
      },
      defaultProps: {
        images: [
          { url: 'https://images.unsplash.com/photo-1512496015851-a1c8491c33a2?w=800&q=80', caption: 'Interior' }
        ]
      },
      render: ({ images }) => (
        <div className="py-16 bg-white">
          <div className="max-w-5xl mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-10 text-gray-900">Gallery</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {images.map((img, i) => (
                <div key={i} className="relative group overflow-hidden rounded-lg aspect-square bg-gray-100">
                  <img src={img.url} alt={img.caption} className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-110" />
                  {img.caption && (
                    <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white p-2 text-sm translate-y-full group-hover:translate-y-0 transition-transform">
                      {img.caption}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )
    },
    About: {
      fields: {
        content: { type: 'textarea' }
      },
      defaultProps: {
        content: 'We are a premier service provider committed to excellence.'
      },
      render: ({ content }) => (
        <div className="py-16 bg-gray-50 text-center">
          <div className="max-w-3xl mx-auto px-4">
            <h2 className="text-3xl font-bold mb-6 text-gray-900">About Us</h2>
            <p className="text-lg text-gray-700 leading-relaxed">{content}</p>
          </div>
        </div>
      )
    },
    Contact: {
      fields: {
        phone: { type: 'text' },
        address: { type: 'text' },
        mapUrl: { type: 'text' }
      },
      defaultProps: {
        phone: '+251911234567',
        address: 'Bole, Addis Ababa, Ethiopia',
        mapUrl: ''
      },
      render: ({ phone, address, mapUrl }) => (
        <div className="py-16 bg-white">
          <div className="max-w-5xl mx-auto px-4 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-6 text-gray-900">Contact Us</h2>
              <div className="space-y-4 text-lg text-gray-700">
                <p><strong>Phone:</strong> {phone}</p>
                <p><strong>Address:</strong> {address}</p>
              </div>
            </div>
            {mapUrl && (
              <div className="h-64 bg-gray-200 rounded-xl overflow-hidden">
                <iframe src={mapUrl} width="100%" height="100%" style={{ border: 0 }} allowFullScreen loading="lazy"></iframe>
              </div>
            )}
          </div>
        </div>
      )
    },
    BusinessHours: {
      fields: {},
      render: () => {
        const [hours, setHours] = useState<any[]>([]);
        const subdomain = getSubdomain();

        useEffect(() => {
          if (subdomain) {
            fetch(`/api/public/business-hours`, { headers: { 'X-Tenant-Slug': subdomain } })
              .then(res => res.json())
              .then(data => setHours(data || []))
              .catch(console.error);
          }
        }, [subdomain]);

        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        return (
          <div className="py-16 bg-gray-50">
            <div className="max-w-xl mx-auto px-4 bg-white p-8 rounded-xl shadow-sm border border-gray-100">
              <h2 className="text-2xl font-bold text-center mb-6 text-gray-900">Business Hours</h2>
              <div className="space-y-3">
                {hours.sort((a, b) => a.dayOfWeek - b.dayOfWeek).map((h, i) => (
                  <div key={i} className="flex justify-between items-center border-b border-gray-50 pb-2">
                    <span className="font-medium text-gray-700">{days[h.dayOfWeek]}</span>
                    <span className="text-gray-500">
                      {h.isClosed ? 'Closed' : `${h.openTime} - ${h.closeTime}`}
                    </span>
                  </div>
                ))}
                {hours.length === 0 && <p className="text-center text-gray-500">Loading hours...</p>}
              </div>
            </div>
          </div>
        );
      }
    },
    LocationMap: {
      fields: {
        mapUrl: { type: 'text' },
      },
      defaultProps: {
        mapUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d126115.11523419086!2d38.70247954932313!3d8.963176766481026!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x164b85cef5ab402d%3A0x8467b6b037a24d49!2sAddis%20Ababa!5e0!3m2!1sen!2set!4v1700000000000!5m2!1sen!2set',
      },
      render: ({ mapUrl }) => (
        <div className="py-16 bg-white">
          <div className="max-w-5xl mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-10 text-gray-900">Our Location</h2>
            {mapUrl ? (
              <div className="h-96 bg-gray-200 rounded-xl overflow-hidden shadow-sm border border-gray-100">
                <iframe src={mapUrl} width="100%" height="100%" style={{ border: 0 }} allowFullScreen loading="lazy"></iframe>
              </div>
            ) : (
              <p className="text-center text-gray-500">Map not configured</p>
            )}
          </div>
        </div>
      )
    },
    Testimonials: {
      fields: {
        items: {
          type: 'array',
          getItemSummary: (item) => item.name || 'Testimonial',
          arrayFields: {
            quote: { type: 'textarea' },
            name: { type: 'text' },
            avatar: { type: 'custom', render: ImageUploaderField },
          }
        }
      },
      defaultProps: {
        items: [
          {
            quote: 'This is the best service I have ever used. Highly recommended!',
            name: 'Abebe B.',
            avatar: 'https://ui-avatars.com/api/?name=Abebe+B&background=random'
          },
          {
            quote: 'Amazing experience from start to finish. Will definitely come back.',
            name: 'Sara M.',
            avatar: 'https://ui-avatars.com/api/?name=Sara+M&background=random'
          }
        ]
      },
      render: ({ items }) => (
        <div className="py-16 bg-blue-50">
          <div className="max-w-6xl mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-12 text-gray-900">What Our Clients Say</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {items.map((item, i) => (
                <div key={i} className="bg-white p-8 rounded-2xl shadow-sm border border-blue-100 relative">
                  <div className="text-[#1E3A8A] text-4xl font-serif absolute top-6 left-6 opacity-20">"</div>
                  <p className="text-gray-700 italic mb-6 relative z-10">{item.quote}</p>
                  <div className="flex items-center">
                    {item.avatar && <img src={item.avatar} alt={item.name} className="w-12 h-12 rounded-full mr-4 object-cover" />}
                    <h4 className="font-bold text-gray-900">{item.name}</h4>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )
    },
    SocialLinks: {
      fields: {},
      render: () => {
        const [settings, setSettings] = useState<any>({});
        const subdomain = getSubdomain();

        useEffect(() => {
          if (subdomain) {
            fetch(`/api/public/page`, { headers: { 'X-Tenant-Slug': subdomain } })
              .then(res => res.json())
              .then(data => setSettings(data.tenant?.settings || {}))
              .catch(console.error);
          }
        }, [subdomain]);

        const telegram = settings.social_telegram;
        const facebook = settings.social_facebook;
        const instagram = settings.social_instagram;
        const tiktok = settings.social_tiktok;

        if (!telegram && !facebook && !instagram && !tiktok) {
          return null; // hide if none configured
        }

        return (
          <div className="py-12 bg-white text-center border-t border-gray-100">
            <div className="flex justify-center space-x-8">
              {telegram && <a href={telegram} target="_blank" rel="noreferrer" className="text-gray-600 hover:text-[#1E3A8A] transition-colors font-medium">Telegram</a>}
              {facebook && <a href={facebook} target="_blank" rel="noreferrer" className="text-gray-600 hover:text-[#1E3A8A] transition-colors font-medium">Facebook</a>}
              {instagram && <a href={instagram} target="_blank" rel="noreferrer" className="text-gray-600 hover:text-[#1E3A8A] transition-colors font-medium">Instagram</a>}
              {tiktok && <a href={tiktok} target="_blank" rel="noreferrer" className="text-gray-600 hover:text-[#1E3A8A] transition-colors font-medium">TikTok</a>}
            </div>
          </div>
        );
      }
    },
    BookingForm: {
      fields: {},
      render: () => {
        const subdomain = getSubdomain();
        return (
          <div className="py-16 bg-gray-50" id="booking">
            <PublicBooking tenant={null} subdomain={subdomain} />
          </div>
        );
      }
    }
  }
};
