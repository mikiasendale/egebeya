import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

/**
 * InstantEmpire — the 3-second cinematic reveal that fires when the owner
 * publishes their site from the SetupWizard. Canvas particles assemble into
 * the ኢ-ገበያ mark, then dissolve to reveal the live site preview.
 *
 * Phases:
 *   0–1200ms  — particles scatter → converge into glyph shape
 *   1200–2000ms — glyph pulses / breathes, "Your empire is live" fades in
 *   2000–2800ms — glyph dissolves outward, site preview slides up
 *   2800–3000ms — settle, onComplete fires
 */

const PHASE_DURATION = [1200, 800, 800, 200] as const;
const TOTAL_DURATION = PHASE_DURATION.reduce((a, b) => a + b, 0);

interface Particle {
  x: number; y: number;
  targetX: number; targetY: number;
  size: number;
  alpha: number;
  hue: number;        // green spectrum variation
  speed: number;
  angle: number;
  orbit: number;
}

// Glyph target points — sampled from the ኢ character rendered at center.
// These are normalised 0–1 coordinates mapped to canvas space.
function sampleGlyphPoints(count: number): { x: number; y: number }[] {
  // Approximate glyph shape with a stylised ኢ silhouette —
  // vertical stroke + horizontal crossbar + curved tail
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / count;
    let px: number, py: number;
    if (t < 0.45) {
      // Vertical stroke (top to bottom)
      const s = t / 0.45;
      px = 0.48 + Math.sin(s * Math.PI * 0.15) * 0.06;
      py = 0.12 + s * 0.65;
    } else if (t < 0.6) {
      // Crossbar
      const s = (t - 0.45) / 0.15;
      px = 0.28 + s * 0.44;
      py = 0.42 + Math.sin(s * Math.PI) * 0.04;
    } else if (t < 0.8) {
      // Curved tail
      const s = (t - 0.6) / 0.2;
      px = 0.38 + Math.cos(s * Math.PI * 0.7) * 0.18;
      py = 0.72 + s * 0.15;
    } else {
      // Diagonal accent
      const s = (t - 0.8) / 0.2;
      px = 0.55 + s * 0.2;
      py = 0.2 + s * 0.35;
    }
    points.push({ x: px + (Math.random() - 0.5) * 0.02, y: py + (Math.random() - 0.5) * 0.02 });
  }
  return points;
}

interface InstantEmpireAnimationProps {
  businessName: string;
  onComplete: () => void;
}

export function InstantEmpireAnimation({ businessName, onComplete }: InstantEmpireAnimationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const startRef = useRef<number>(0);
  const rafRef = useRef<number>(0);
  const [phase, setPhase] = useState<'assembling' | 'pulse' | 'dissolve' | 'done'>('assembling');
  const [showText, setShowText] = useState(false);
  const [showSite, setShowSite] = useState(false);

  const initParticles = useCallback((width: number, height: number) => {
    const count = Math.min(180, Math.floor((width * height) / 4000));
    const targets = sampleGlyphPoints(count);
    const cx = width / 2;
    const cy = height / 2;

    particlesRef.current = targets.map((t, i) => {
      // Start scattered in a wide circle
      const scatterRadius = Math.max(width, height) * 0.7;
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const dist = scatterRadius * (0.3 + Math.random() * 0.7);
      return {
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
        targetX: cx + (t.x - 0.5) * width * 0.42,
        targetY: cy + (t.y - 0.5) * height * 0.55,
        size: 2 + Math.random() * 3,
        alpha: 0,
        hue: 130 + Math.random() * 40, // green spectrum
        speed: 0.02 + Math.random() * 0.03,
        angle: angle,
        orbit: dist,
      };
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    initParticles(rect.width, rect.height);
    startRef.current = performance.now();

    const draw = (now: number) => {
      const elapsed = now - startRef.current;
      const w = rect.width;
      const h = rect.height;
      const cx = w / 2;
      const cy = h / 2;

      ctx.clearRect(0, 0, w, h);

      // Background gradient — deep espresso to ink
      const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.7);
      bg.addColorStop(0, '#2A1D15');
      bg.addColorStop(1, '#1A1411');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      const particles = particlesRef.current;

      // Phase control
      if (elapsed < PHASE_DURATION[0]) {
        // Phase 1: converge
        const t = elapsed / PHASE_DURATION[0];
        const ease = 1 - Math.pow(1 - t, 3); // ease-out cubic
        setPhase('assembling');

        for (const p of particles) {
          p.x += (p.targetX - p.x) * (p.speed + ease * 0.08);
          p.y += (p.targetY - p.y) * (p.speed + ease * 0.08);
          p.alpha = Math.min(1, ease * 1.5);
        }
      } else if (elapsed < PHASE_DURATION[0] + PHASE_DURATION[1]) {
        // Phase 2: pulse / breathe
        const t = (elapsed - PHASE_DURATION[0]) / PHASE_DURATION[1];
        setPhase('pulse');
        if (t > 0.2) setShowText(true);

        const pulse = Math.sin(t * Math.PI * 3) * 0.15 + 1;
        for (const p of particles) {
          // Subtle breathing
          const dx = p.targetX - cx;
          const dy = p.targetY - cy;
          p.x = cx + dx * pulse + (Math.random() - 0.5) * 0.5;
          p.y = cy + dy * pulse + (Math.random() - 0.5) * 0.5;
          p.alpha = 1;
        }
      } else if (elapsed < TOTAL_DURATION) {
        // Phase 3: dissolve outward
        const t = (elapsed - PHASE_DURATION[0] - PHASE_DURATION[1]) / PHASE_DURATION[2];
        setPhase('dissolve');
        setShowSite(true);

        const ease = t * t; // ease-in
        for (const p of particles) {
          const dx = p.x - cx;
          const dy = p.y - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx);
          const push = ease * 300;
          p.x += Math.cos(angle + p.speed * 5) * (push * 0.05 + 1);
          p.y += Math.sin(angle + p.speed * 5) * (push * 0.05 + 1);
          p.alpha = Math.max(0, 1 - ease * 1.3);
          p.size *= 0.995;
        }
      } else {
        // Done
        setPhase('done');
        onComplete();
        return;
      }

      // Draw particles
      for (const p of particles) {
        if (p.alpha <= 0) continue;
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = `hsl(${p.hue}, 65%, 50%)`;
        ctx.shadowColor = `hsl(${p.hue}, 80%, 40%)`;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Central glow during pulse
      if (phase === 'pulse' || (elapsed > PHASE_DURATION[0] * 0.8 && elapsed < PHASE_DURATION[0] + PHASE_DURATION[1])) {
        const glowAlpha = phase === 'pulse' ? 0.12 : 0.05;
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 120);
        glow.addColorStop(0, `rgba(15, 169, 88, ${glowAlpha})`);
        glow.addColorStop(1, 'rgba(15, 169, 88, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, w, h);
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [initParticles, phase, onComplete]);

  // Respect reduced motion
  const prefersReducedMotion = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (prefersReducedMotion) {
    // Skip animation, just fire onComplete after a brief pause
    useEffect(() => {
      const id = setTimeout(onComplete, 400);
      return () => clearTimeout(id);
    }, [onComplete]);
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ touchAction: 'none' }}
      />

      {/* Glyph overlay — the ኢ-ገበያ mark rendered in CSS on top of particles */}
      <AnimatePresence>
        {(phase === 'pulse' || phase === 'dissolve') && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: phase === 'dissolve' ? 0 : 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 flex flex-col items-center gap-4"
          >
            <div className="text-center">
              <div
                className="text-6xl md:text-8xl font-bold leading-none"
                style={{
                  fontFamily: "'Noto Serif Ethiopic', serif",
                  color: '#0FA958',
                  textShadow: '0 0 40px rgba(15, 169, 88, 0.4), 0 0 80px rgba(15, 169, 88, 0.2)',
                }}
              >
                ኢ-ገበያ
              </div>
              <div
                className="text-xl md:text-2xl font-bold mt-2 tracking-tight"
                style={{
                  fontFamily: "'Bricolage Grotesque', system-ui, sans-serif",
                  color: '#F4E8C1',
                }}
              >
                Egebeya
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* "Your empire is live" text */}
      <AnimatePresence>
        {showText && phase !== 'dissolve' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="absolute bottom-[22%] left-0 right-0 text-center z-20"
          >
            <p
              className="text-sm md:text-base font-medium tracking-wide uppercase"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                color: 'rgba(244, 232, 193, 0.7)',
                letterSpacing: '0.12em',
              }}
            >
              Your empire is live
            </p>
            <p
              className="text-lg md:text-xl font-bold mt-2"
              style={{
                fontFamily: "'Bricolage Grotesque', system-ui, sans-serif",
                color: '#F4E8C1',
              }}
            >
              {businessName || 'Your Business'}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Site preview slides up during dissolve */}
      <AnimatePresence>
        {showSite && (
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0 z-30 bg-surface rounded-t-3xl overflow-hidden shadow-2xl"
            style={{ top: '8%' }}
          >
            {/* Placeholder shimmer while the real site loads */}
            <div className="h-full w-full flex flex-col items-center justify-center gap-4 bg-surface">
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
                <svg className="w-8 h-8 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <p
                className="text-sm font-medium text-ink-soft"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                Building your site…
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
