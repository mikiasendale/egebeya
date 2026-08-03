import React, { useEffect, useRef } from 'react';

const PALETTE = [
  { r: 58, g: 40, b: 32 },     // espresso / counter deep
  { r: 15, g: 111, b: 88 },    // telebirr
  { r: 6, g: 63, b: 45 },      // telebirr deep
  { r: 26, g: 20, b: 17 },     // ink
  { r: 244, g: 232, b: 193 },  // gold / paper
  { r: 245, g: 158, b: 11 },   // amber / spice
  { r: 211, g: 52, b: 38 },    // signal red
];

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function AtmosphereCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });
  const scrollRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = window.innerWidth;
    let h = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      w = window.innerWidth;
      h = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.scale(dpr, dpr);
    }
    resize();

    const handleMouse = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX / w, y: e.clientY / h };
    };
    const handleScroll = () => {
      scrollRef.current = window.scrollY / Math.max(window.innerHeight, 1);
    };
    window.addEventListener('mousemove', handleMouse, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', resize);

    let frame = 0;
    let running = true;

    function draw() {
      if (!running) return;
      frame++;
      const t = frame * 0.003;
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      const scroll = scrollRef.current;

      // Clear with a very subtle fade for motion trails
      ctx.fillStyle = 'rgba(15, 20, 15, 0.35)';
      ctx.fillRect(0, 0, w, h);

      // Base deep espresso gradient
      const baseGrad = ctx.createLinearGradient(0, 0, w, h);
      baseGrad.addColorStop(0, '#2A1A12');
      baseGrad.addColorStop(1, '#1A0F08');
      ctx.fillStyle = baseGrad;
      ctx.fillRect(0, 0, w, h);

      // Flowing organic blobs — simulated with radial gradient layers
      // Color cycle tied to scroll and time
      const colors = [
        [15, 111, 88],   // telebirr
        [58, 40, 32],    // espresso
        [6, 63, 45],     // deep telebirr
        [245, 158, 11],  // amber
        [211, 52, 38],   // signal (rare, small touches)
      ];

      for (let i = 0; i < 6; i++) {
        const cx = w * (0.2 + 0.6 * ((Math.sin(t * (0.4 + i * 0.15) + i) + 1) / 2));
        const cy = h * (0.2 + 0.6 * ((Math.cos(t * (0.3 + i * 0.12) + i * 2) + 1) / 2));
        // Mouse influence: pull blobs slightly toward cursor
        const pullX = (mx - 0.5) * 80;
        const pullY = (my - 0.5) * 80;
        const cx2 = cx + pullX;
        const cy2 = cy + pullY;

        const rBase = Math.min(w, h) * (0.35 + 0.15 * Math.sin(t * 0.8 + i));
        const r = Math.max(rBase, 120);

        const [rc, gc, bc] = colors[i % colors.length];
        // Alpha tied to scroll depth: deeper scroll = more opacity
        const alpha = 0.12 + 0.18 * Math.abs(Math.sin(scroll * 3 + i));
        const grad = ctx.createRadialGradient(cx2, cy2, r * 0.05, cx2, cy2, r);
        grad.addColorStop(0, `rgba(${rc}, ${gc}, ${bc}, ${alpha * 0.9})`);
        grad.addColorStop(0.5, `rgba(${rc}, ${gc}, ${bc}, ${alpha * 0.3})`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h); // Fill whole with radial effect
      }

      // Small bright speckles (spice dust / ink particles)
      for (let i = 0; i < 12; i++) {
        const sx = w * ((Math.sin(t * 2 + i * 5.3) + 1) / 2);
        const sy = h * ((Math.cos(t * 1.7 + i * 3.7) + 1) / 2);
        const sr = 6 + 14 * Math.sin(t * 3 + i);
        const [srgb, sgb, sbb] = colors[(i + Math.floor(t)) % colors.length];
        const sAlpha = 0.15 + 0.25 * Math.sin(t * 4 + i);
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${srgb}, ${sgb}, ${sbb}, ${sAlpha})`;
        ctx.fill();
      }

      // Request next frame with throttle
      setTimeout(() => {
        frame = requestAnimationFrame(draw);
      }, 32); // ~30fps for performance
    }

    frame = requestAnimationFrame(draw);

    return () => {
      running = false;
      cancelAnimationFrame(frame);
      window.removeEventListener('mousemove', handleMouse);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 0,
        pointerEvents: 'none',
        opacity: 0.95,
      }}
    />
  );
}
