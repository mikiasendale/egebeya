import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { PricingSection } from '../components/PricingSection';

const SERVICES_DEMO: { geo: string; name: string; amName: string; duration: string; price: string }[] = [
  { geo: '፩',  name: 'Manicure',  amName: 'ጥፍር',   duration: '00:45', price: '400.00' },
  { geo: '፪',  name: 'Pedicure',  amName: 'እግር',   duration: '01:00', price: '500.00' },
  { geo: '፫',  name: 'Haircut',   amName: 'ፀጉር',   duration: '00:30', price: '200.00' },
  { geo: '፬',  name: 'Massage',   amName: 'ቁርጥጥ',  duration: '01:15', price: '1,200.00' },
];

/* The booking record's live slot pool — one afternoon at the salon. The
   record reprints with each settling deposit; times roll forward and wrap. */
const TX_POOL: { service: string; serviceAm: string; duration: string; time: string; price: string; staff: string }[] = [
  { service: 'Manicure',  serviceAm: 'ጥፍር',   duration: '00:45', time: '15:00', price: '400.00',  staff: 'Sara M.' },
  { service: 'Haircut',   serviceAm: 'ፀጉር',   duration: '00:30', time: '15:30', price: '200.00',  staff: 'Dawit G.' },
  { service: 'Pedicure',  serviceAm: 'እግር',   duration: '01:00', time: '16:00', price: '500.00',  staff: 'Sara M.' },
  { service: 'Massage',   serviceAm: 'ቁርጥጥ',  duration: '01:15', time: '16:30', price: '1,200.00', staff: 'Dawit G.' },
  { service: 'Manicure',  serviceAm: 'ጥፍር',   duration: '00:45', time: '17:00', price: '400.00',  staff: 'Hanna T.' },
  { service: 'Haircut',   serviceAm: 'ፀጉር',   duration: '00:30', time: '17:30', price: '200.00',  staff: 'Sara M.' },
];

type QueueStatus = 'DONE' | 'SERVING' | 'NEXT' | 'WAIT';

interface QueueRow {
  no: string;
  time: string;
  service: string;
  staff: string;
  status: QueueStatus;
  statusAm: string;
}

const QUEUE_DEMO: QueueRow[] = [
  { no: '፭',    time: '09:00', service: 'Manicure', staff: 'Sara M.',   status: 'DONE',    statusAm: 'ተፈጸመ' },
  { no: '፮',    time: '10:30', service: 'Haircut',  staff: 'Dawit G.',  status: 'SERVING', statusAm: 'በአገልግሎት' },
  { no: '፯',    time: '13:00', service: 'Pedicure', staff: 'Sara M.',   status: 'NEXT',    statusAm: 'ቀጣይ'  },
  { no: '፰',    time: '14:00', service: 'Massage',  staff: 'Sara M.',   status: 'WAIT',    statusAm: 'በመጠበቅ' },
];

/* The board's waiting sheet keeps serving numbers rolling in Ethiopic digits */
const ETH_UNITS = ['', '፩', '፪', '፫', '፬', '፭', '፮', '፯', '፰', '፱'];
const ETH_TENS = ['፲', '፳', '፴', '፵', '፶', '፷', '፸', '፹', '፺'];
function toEth(n: number): string {
  if (n < 10) return ETH_UNITS[n];
  return ETH_TENS[Math.floor(n / 10) - 1] + ETH_UNITS[n % 10];
}

/* New-waiter slot values rotate through the same day's services */
const QUEUE_NEW_POOL: { time: string; service: string; staff: string }[] = [
  { time: '15:00', service: 'Manicure', staff: 'Sara M.' },
  { time: '15:30', service: 'Haircut', staff: 'Dawit G.' },
  { time: '16:00', service: 'Pedicure', staff: 'Sara M.' },
  { time: '16:30', service: 'Massage', staff: 'Dawit G.' },
];

/* ── Printer sound (opt-in) — a tiny synthesized tick burst. Silent until
    the visitor presses the SND control on the paper rail; the AudioContext
    is created lazily on the first user gesture that enables it. ── */
const soundState = { on: false };
function setSoundOn(on: boolean) {
  soundState.on = on;
}
function playPrintTick(kind: 'tick' | 'stamp') {
  if (!soundState.on || typeof window === 'undefined') return;
  try {
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const now = ctx.currentTime;
    const burst = (t0: number, dur: number, freq: number, type: OscillatorType, gain: number) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(gain, t0 + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    };
    if (kind === 'stamp') {
      burst(now, 0.09, 130, 'sine', 0.12);
      burst(now + 0.03, 0.05, 88, 'sine', 0.08);
    } else {
      for (let i = 0; i < 4; i++) {
        burst(now + i * 0.055, 0.025, 2300 + Math.random() * 400, 'square', 0.018);
      }
    }
  } catch {
    /* audio unavailable — stay silent */
  }
}

/* ── overdrive · Addis clock ─────────────────────────────────────────────
   One live timekeeper for the whole landing, shared by the masthead ledger
   header and the NOW SERVING elapsed counter. Africa/Addis_Ababa via
   Intl.DateTimeFormat, ticked once per ~250ms through requestAnimationFrame.
   Frozen on first render where the visitor prefers reduced motion, and
   paused in the background tab. Two string outputs: the wall time and the
   Ethiopic-numeral mirror that hides itself when English is selected.

   The same Addis clock that labels the receipt (and that the booking row
   writes into the tx_ref) is the page's only ticking source — one authored
   moment, threaded through three surfaces, exactly as the kebele receipt
   already stamps Addis time onto every deposited block. */

export interface AddisClock {
  /** Addis hh:mm:ss in 24-hour Latin (mono tabular) */
  hms: string;
  /** The seconds separator blinks while the clock runs; static when frozen */
  running: boolean;
  /** Ethiopic-numeral mirror of HH:MM:SS, or '' when reduced motion is on */
  hmsEth: string;
}

function formatEthiopicTime(parts: { hour: number; minute: number; second: number }): string {
  const hh = toEth2(parts.hour);
  const mm = parts.minute < 10 ? ETH_UNITS[parts.minute] : toEth2(parts.minute);
  const ss = parts.second < 10 ? ETH_UNITS[parts.second] : toEth2(parts.second);
  return `${hh}:${mm}:${ss}`;
}
function toEth2(n: number): string {
  if (n < 10) return ETH_UNITS[n];
  return ETH_TENS[Math.floor(n / 10) - 1] + ETH_UNITS[n % 10];
}
function useAddisClock(): AddisClock {
  const initial = useMemo(() => readAddis(new Date()), []);
  const [clock, setClock] = useState<AddisClock>(initial);
  useEffect(() => {
    const el = typeof document !== 'undefined' ? document : null;
    if (typeof window === 'undefined' || !el) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    let raf = 0;
    let lastUpdate = 0;
    const loop = (now: number) => {
      raf = window.requestAnimationFrame(loop);
      if (el.hidden) return;
      if (now - lastUpdate < 220) return;
      lastUpdate = now;
      setClock(readAddis(new Date()));
    };
    raf = window.requestAnimationFrame(loop);
    const onVis = () => {
      if (!el.hidden) {
        lastUpdate = 0;
        setClock(readAddis(new Date()));
      }
    };
    el.addEventListener('visibilitychange', onVis);
    return () => {
      window.cancelAnimationFrame(raf);
      el.removeEventListener('visibilitychange', onVis);
    };
  }, []);
  return clock;
}
function readAddis(d: Date): AddisClock {
  if (typeof Intl === 'undefined' || !Intl.DateTimeFormat) {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return { hms: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`, running: false, hmsEth: '' };
  }
  let fmt: Intl.DateTimeFormat;
  try {
    fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Addis_Ababa',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return { hms: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`, running: false, hmsEth: '' };
  }
  const parts = fmt.formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  const hour = Number(get('hour'));
  const minute = Number(get('minute'));
  const second = Number(get('second'));
  const hms = `${get('hour')}:${get('minute')}:${get('second')}`;
  const hmsEth = formatEthiopicTime({ hour, minute, second });
  return { hms, running: true, hmsEth };
}


export function Landing() {
  const [soundOn, setSoundOnState] = useState(false);
  const { t } = useTranslation();
  const toggleSound = () => {
    setSoundOnState((prev) => {
      setSoundOn(!prev);
      return !prev;
    });
  };
  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: 'var(--color-paper)',
        color: 'var(--color-ink)',
        fontFamily: 'var(--font-body)',
      }}
    >
      <Navbar />
      <PaperRail soundOn={soundOn} onToggleSound={toggleSound} />
      <Lead />
      <TrustBar />
      <PerfTear />
      <SearchSection />
      <TariffSection />
      <PricingSection />
      <PerfTear />
      <QueueSection />
      <CounterClose />
      <Footer />
    </div>
  );
}

/* ── Paper rail — the receipt edge fixed left; it "prints" as you scroll ──
   Now a real printer: sprocket feed-holes down the outer edge, an ink-black
   print head gliding in lockstep with scroll, and a mirrored right rail.
   The SND control opts into the synthesized printer audio (silent default). */
function PaperRail({ soundOn, onToggleSound }: { soundOn: boolean; onToggleSound: () => void }) {
  return (
    <>
      <div className="paper-rail">
        <div className="paper-rail__holes" aria-hidden />
        <div className="paper-rail__meter" aria-hidden />
        <div className="paper-rail__head" aria-hidden>
          <span className="paper-rail__led" />
          <span className="paper-rail__head-label">PRT</span>
        </div>
        <span className="paper-rail__readout" aria-hidden>
          PAPER
        </span>
        <button
          type="button"
          onClick={onToggleSound}
          className="paper-rail__sound"
          aria-label={soundOn ? 'Printer sound on — press to mute' : 'Printer sound off — press to enable'}
          aria-pressed={soundOn}
        >
          <span className={`paper-rail__sound-dot${soundOn ? ' is-on' : ''}`} aria-hidden />
          SND
        </button>
      </div>
      <div className="paper-rail paper-rail--right" aria-hidden>
        <div className="paper-rail__holes" />
      </div>
    </>
  );
}

/* ── TypedLine — the hero prints itself, syllable by syllable ──
   Chars are split per Unicode code point (safe for Ethiopic precomposed
   syllables) and revealed on a timer with a telebirr print-cursor. Reduced
   motion and no-JS show the full text immediately. Segments carry their own
   color so the Amharic/Latin mix keeps its incumbent styling. */
function TypedLine({
  segments,
  speed = 46,
  startDelay = 0,
  cursor = false,
}: {
  segments: { text: string; color?: string; font?: string; style?: React.CSSProperties }[];
  speed?: number;
  startDelay?: number;
  cursor?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [done, setDone] = useState(false);
  const text = segments.map((s) => s.text).join('');
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const chars = Array.from<HTMLElement>(el.querySelectorAll<HTMLElement>('.tp-char'));
    if (chars.length === 0) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      chars.forEach((c) => { c.style.opacity = '1'; });
      setDone(true);
      return;
    }
    chars.forEach((c) => { c.style.opacity = '0'; });
    let i = 0;
    let cancelled = false;
    let interval: number | undefined;
    const start = window.setTimeout(() => {
      interval = window.setInterval(() => {
        if (cancelled) return;
        chars[i]!.style.opacity = '1';
        if (i % 2 === 0) playPrintTick('tick');
        i += 1;
        if (i >= chars.length) {
          window.clearInterval(interval);
          setDone(true);
          playPrintTick('stamp');
        }
      }, speed);
    }, startDelay);
    return () => {
      cancelled = true;
      window.clearTimeout(start);
      if (interval) window.clearInterval(interval);
    };
  }, [text, speed, startDelay]);
  return (
    <span ref={ref}>
      {segments.map((seg, si) => (
        <span key={si} style={{ color: seg.color, fontFamily: seg.font, ...seg.style }}>
          {Array.from(seg.text).map((ch, ci) => (
            <span key={ci} className="tp-char">
              {ch === ' ' ? '\u00A0' : ch}
            </span>
          ))}
        </span>
      ))}
      {cursor && <span aria-hidden className={`print-cursor${done ? ' is-done' : ''}`} />}
    </span>
  );
}

/* ── Perforation — the receipt roll tears between ledger pages ── */
function PerfTear() {
  const ref = useRef<HTMLDivElement>(null);
  const [tearing, setTearing] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setTearing(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setTearing(true);
            io.disconnect();
          }
        });
      },
      { threshold: 0.3 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div className="px-5 sm:px-8 lg:px-12" aria-hidden>
      <div className="mx-auto max-w-6xl">
        <div ref={ref} className={`perf-tear${tearing ? ' is-tearing' : ''}`} />
      </div>
    </div>
  );
}

/* ── Live Ledger trust strip — what the ledger promises, in one line ──
   Below the promise runs the settling ledger: the most recent deposits to
   clear, fed live by the booking record above. */
const LEDGER_SEED: { ref: string; price: string; when: string }[] = [
  { ref: 'EGB-2026-4829', price: 'Br 400.00',   when: '10:31 · ሐምሌ 27' },
  { ref: 'EGB-2026-4828', price: 'Br 1,200.00', when: '10:31 · ሐምሌ 27' },
  { ref: 'EGB-2026-4827', price: 'Br 200.00',   when: '10:30 · ሐምሌ 27' },
];

function TrustBar() {
  const { t } = useTranslation();
  const [feed, setFeed] = useState(LEDGER_SEED);
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ ref: string; price: string; when: string }>).detail;
      if (!detail) return;
      setFeed((prev) => [detail, ...prev].slice(0, 3));
    };
    window.addEventListener('egebeya:settle', handler);
    return () => window.removeEventListener('egebeya:settle', handler);
  }, []);
  return (
    <section
      aria-label="The ledger promise"
      className="px-5 sm:px-8 lg:px-12 scroll-reveal"
    >
      <div className="mx-auto max-w-6xl">
        <div
          className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 py-4"
          style={{ borderTop: '1px solid var(--color-ink-rule)' }}
        >
          <span className="stamp positive self-start sm:self-auto">
            {t('trustBar.ledger')} · {t('trustBar.ledgerAm')}
          </span>
          <div
            className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs"
            style={{
              fontFamily: 'var(--font-mono)',
              color: 'var(--color-ink-soft)',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}
          >
            <span>{t('trustBar.city')} · {t('trustBar.cityAm')}</span>
            <span aria-hidden style={{ color: 'var(--color-ink-rule-dashed)' }}>·</span>
            <span>{t('trustBar.verified')} · {t('trustBar.verifiedAm')}</span>
            <span aria-hidden style={{ color: 'var(--color-ink-rule-dashed)' }}>·</span>
            <span>{t('trustBar.noCard')} · {t('trustBar.noCardAm')}</span>
          </div>
          <div
            className="sm:ml-auto flex-1 sm:flex-none sm:max-w-xs min-w-0"
            aria-label={t('liveFeed.settled')}
          >
            <div className="ledger-feed">
              {feed.map((row, i) => (
                <div
                  key={row.ref}
                  className={`ledger-feed__row${i > 0 ? ' is-old' : ''}`}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: i === 0 ? '0.7rem' : '0.62rem',
                    letterSpacing: '0.05em',
                  }}
                >
                  {i === 0 && (
                    <span className="ledger-feed__live">
                      <span className="ledger-feed__dot" aria-hidden />
                      {t('liveFeed.live')}
                    </span>
                  )}
                  <span className="truncate">
                    <span className="ledger-feed__ref">{row.ref}</span>
                    <span style={{ color: 'var(--color-ink-stamp)' }}> · {row.price} · {row.when}</span>
                  </span>
                  <span style={{ color: 'var(--color-telebirr-deep)' }}>
                    {t('liveFeed.settled')} · {t('liveFeed.settledAm')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── overdrive · scroll-reveal narrative ────────────────────────────────
   Hides the masthead ledger header on initial mount (so the hero opens
   full-screen with the booking-record front-and-center). Reveals it once
   the visitor has scrolled *once* (the lock-open moment) AND then returned
   back to the top — closing the loop, like the ledger surfaces back when
   you come home to the booking wall. Bound once on mount; passive listener;
   silent under reduced motion. */
function useLedgerMastVisible(): boolean {
  const [visible, setVisible] = useState(false);
  const lockRef = useRef(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let rafPending = false;
    const compute = () => {
      rafPending = false;
      const y = window.scrollY ?? 0;
      const top = y < 80;
      if (!lockRef.current && y > 240) {
        lockRef.current = true;
      }
      if (top && lockRef.current) setVisible(true);
      else if (!top) setVisible(false);
    };
    const onScroll = () => {
      if (rafPending) return;
      rafPending = true;
      window.requestAnimationFrame(compute);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    compute();
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);
  return visible;
}

/* ── Addis clock view — receipt-mono lockup that boots once for the page ── */
function AddisClockView({
  clock,
  caption,
}: {
  clock: AddisClock;
  caption?: React.ReactNode;
}) {
  const { t } = useTranslation();
  /* Static form when reduced motion freezes the clock: render the same lockup
     but without the blinking separator, so the surface's muted tone stays. */
  if (!clock.running) {
    return (
      <div className="addis-clock" aria-label={t('clock.captionAria')}>
        <span className="addis-clock__time addis-clock__time-static">{clock.hms}</span>
        {clock.hmsEth && <span className="addis-clock__eth">{clock.hmsEth}</span>}
        <span className="addis-clock__zone">{t('clock.zone')}</span>
      </div>
    );
  }
  const [hh, mm, ss] = clock.hms.split(':');
  return (
    <div className="addis-clock" aria-label={t('clock.captionAria')}>
      <span className="addis-clock__time">{hh}</span>
      <span className="addis-clock__sep" aria-hidden>:</span>
      <span className="addis-clock__time">{mm}</span>
      <span className="addis-clock__sep" aria-hidden>:</span>
      <span className="addis-clock__time">{ss}</span>
      {clock.hmsEth && <span className="addis-clock__eth">{clock.hmsEth}</span>}
      <span className="addis-clock__zone">{t('clock.zone')}</span>
    </div>
  );
}

/* ── Lead: offer reads as the top of a form being filled ── */
function Lead() {
  const { t } = useTranslation();
  const clock = useAddisClock();
  const mastVisible = useLedgerMastVisible();
  return (
    <section
      className="px-5 sm:px-8 lg:px-12 pt-24 sm:pt-28 pb-16 lg:pb-24 scroll-reveal is-hero"
      aria-label="Egebeya · the deposit confirms the booking"
    >
      <div className="mx-auto max-w-6xl lead-hero">
        {/* Receipt-style ledger header — hidden on first load; revealed once
            the visitor scrolls once and then returns to the top (the
            "ledger surfaces back" moment). The dashed rule re-grows in. */}
        <div
          className={`ledger-mast flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4${mastVisible ? ' is-open' : ''}`}
        >
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.68rem',
              color: 'var(--color-ink-soft)',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              lineHeight: 1.7,
            }}
          >
            <div>Egebeya · Booking Ledger</div>
            <div>Issue #EGB-2026 · Addis Ababa</div>
            <div>Deposit confirms before the chair is held</div>
          </div>
          <div
            className="flex flex-col items-start sm:items-end gap-2"
            style={{ paddingTop: 2 }}
          >
            <AddisClockView clock={clock} />
          </div>
        </div>

        {/* The offer — Amharic voice headline + Latin body, as a form header */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-x-10 gap-y-10 pt-10 sm:pt-14">
          <div className="lg:col-span-7">
            <h1
              className="m-0"
              style={{
                fontFamily: 'var(--font-serif-ethiopic)',
                fontWeight: 700,
                fontSize: 'clamp(2.5rem, 6vw, 5rem)',
                lineHeight: 1.02,
                letterSpacing: '-0.01em',
              }}
            >
              <span style={{ display: 'block', whiteSpace: 'nowrap' }}>
                <TypedLine
                  cursor
                  speed={64}
                  segments={[
                    { text: t('lead.headingAm'), color: 'var(--color-ink)' },
                    { text: ' በውሉ', color: 'var(--color-telebirr)' },
                  ]}
                />
              </span>
              <span style={{ display: 'block' }}>
                <TypedLine
                  cursor
                  speed={38}
                  startDelay={640}
                  segments={[
                    {
                      text: t('lead.subheading'),
                      color: 'var(--color-ink)',
                      font: 'var(--font-display)',
                      style: { fontWeight: 600, letterSpacing: '-0.025em' },
                    },
                  ]}
                />
              </span>
            </h1>
            <p
              className="mt-7 max-w-[36rem] text-base sm:text-lg"
              style={{ color: 'var(--color-ink-soft)', lineHeight: 1.6 }}
            >
              {t('lead.description')}
            </p>

            {/* Primary CTAs — submit the form, or browse the tariff */}
            <div className="mt-9 flex flex-col sm:flex-row sm:items-stretch gap-3 max-w-2xl">
              <a
                href="/register"
                className="btn-ink inline-flex items-center justify-center px-6 py-4 text-center font-semibold no-underline"
                style={{
                  fontFamily: 'var(--font-display)',
                  borderRadius: 'var(--rd-card)',
                  letterSpacing: '0.01em',
                }}
              >
                {t('lead.cta')} · {t('lead.ctaFree')}
                <span aria-hidden className="btn-arrow ml-2">→</span>
              </a>
              <a
                href="#tariff"
                className="btn-outline inline-flex items-center justify-center px-6 py-4 text-center no-underline"
                style={{
                  fontFamily: 'var(--font-mono)',
                  borderRadius: 'var(--rd-card)',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  fontSize: '0.85rem',
                }}
              >
                {t('lead.ctaTariff')} <span aria-hidden className="btn-arrow ml-2">→</span>
              </a>
            </div>
            <p
              className="mt-4 text-xs"
              style={{ color: 'var(--color-ink-stamp)', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}
            >
              {t('lead.noCard')}
            </p>
          </div>

          {/* Deposit proof — the live booking record */}
          <div className="lg:col-span-5">
            <ProofForm clock={clock} />
          </div>
        </div>
      </div>
    </section>
  );
}

function ProofForm({ clock }: { clock: AddisClock }) {
  const { t } = useTranslation();
  const cardRef = useRef<HTMLDivElement>(null);
  /* Live loop state — the record is a slot on the day's ledger sheet */
  const [slot, setSlot] = useState<{ id: number } & (typeof TX_POOL)[number]>(() => ({ ...TX_POOL[0], id: 0 }));
  const [phase, setPhase] = useState<'idle' | 'incoming' | 'verifying' | 'settled'>('idle');
  const [refNo, setRefNo] = useState(() => 4831 + Math.floor(Math.random() * 40));
  const refNoRef = useRef(refNo);
  const slotRef = useRef(slot);
  const busyRef = useRef(false);
  const timeoutsRef = useRef<number[]>([]);
  slotRef.current = slot;

  /* Snapshot the live Addis clock at settle time; the dispatched event's
     `when` reads against the Addis wall clock at the second the stamp
     slammed, so the ledger feed's top row carries a real EAT timestamp
     rather than a fixed "10:31". The ledger feed consumes the string
     unchanged. */
  const clockRef = useRef(clock);
  clockRef.current = clock;
  const [stampTime, setStampTime] = useState('--:--:--');

  /* Settle the pending charge: slip in → VERIFIED → slip out, rows reprint,
     stamp slams, the ledger feed hears about it. Pure clockwork, no side
     effects outside the component. */
  const completeSettle = useCallback(() => {
    const next = TX_POOL[(slotRef.current.id + 1) % TX_POOL.length];
    const nextId = slotRef.current.id + 1;
    const nextRef = refNoRef.current + 1;
    refNoRef.current = nextRef;
    busyRef.current = false;
    const t0 = clockRef.current.hms;
    setRefNo(nextRef);
    setSlot({ ...next, id: nextId });
    setPhase('settled');
    setStampTime(t0);
    playPrintTick('stamp');
    window.dispatchEvent(
      new CustomEvent('egebeya:settle', {
        detail: {
          ref: `EGB-2026-${nextRef}`,
          price: `Br ${next.price}`,
          when: `${t0} · ሐምሌ 27`,
        },
      })
    );
  }, []);

  const settle = useCallback(() => {
    if (busyRef.current) return;
    busyRef.current = true;
    setPhase('incoming');
    playPrintTick('tick');
    const t1 = window.setTimeout(() => setPhase('verifying'), 1600);
    const t2 = window.setTimeout(completeSettle, 2150);
    timeoutsRef.current.push(t1, t2);
  }, [completeSettle]);

  const settleRef = useRef(settle);
  settleRef.current = settle;

  /* The machine keeps feeding: one charge per cycle, paused offscreen or
     when the visitor prefers reduced motion. */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let visible = true;
    let io: IntersectionObserver | null = null;
    if ('IntersectionObserver' in window && cardRef.current) {
      io = new IntersectionObserver(
        (entries) => entries.forEach((e) => { visible = e.isIntersecting; }),
        { threshold: 0.2 }
      );
      io.observe(cardRef.current);
    }
    const id = window.setInterval(() => {
      if (!visible || document.hidden || busyRef.current) return;
      settleRef.current();
    }, 8000);
    return () => {
      io?.disconnect();
      window.clearInterval(id);
      timeoutsRef.current.forEach((tid) => window.clearTimeout(tid));
      timeoutsRef.current = [];
    };
  }, []);

  /* Press the stamp: fast-forward a charge in flight, or start one now */
  const pressStamp = useCallback(() => {
    if (busyRef.current) {
      timeoutsRef.current.forEach((id) => window.clearTimeout(id));
      timeoutsRef.current = [];
      completeSettle();
    } else {
      settle();
    }
  }, [settle, completeSettle]);

  const pending = TX_POOL[(slot.id + 1) % TX_POOL.length];
  const refLabel = `EGB-2026-${refNo}`;
  const charging = phase === 'incoming' || phase === 'verifying';
  const settled = phase === 'settled';

  return (
    <div
      ref={cardRef}
      className="ticket-card relative p-6 sm:p-7"
      style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid var(--color-ink)',
        borderRadius: 'var(--rd-card)',
      }}
    >
      {/* SPECIMEN — the shared faint diagonal label; the one paper cue on this surface */}
      <Specimen />
      {/* Pay slip — the deposit being charged, printed and handed over */}
      <div
        className={`pay-slip${charging ? ' is-in' : ''}${phase === 'verifying' ? ' is-verified' : ''}`}
        aria-hidden
      >
        <div className="pay-slip__row">
          {phase === 'verifying' ? (
            <span className="stamp fill">{t('liveFeed.verify')} · {t('liveFeed.verifyAm')}</span>
          ) : (
            <span>{t('liveFeed.incoming')} · {t('liveFeed.incomingAm')}</span>
          )}
          <span className="pay-slip__merchant truncate">
            {pending.service} · Br {pending.price}
          </span>
        </div>
        <div className="pay-slip__bar" />
      </div>
      <div
        className="flex items-baseline justify-between gap-3 pb-3"
        style={{ borderBottom: '1px solid var(--color-ink-rule)' }}
      >
        <div>
          <div className="stamp" style={{ borderColor: 'var(--color-ink)' }}>FORM EGB-01</div>
          <div
            className="mt-2"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1.35rem', letterSpacing: '-0.01em' }}
          >
            {t('proofForm.title')}
          </div>
        </div>
        <div
          className="text-right"
          style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--color-ink-stamp)', letterSpacing: '0.06em' }}
        >
          <div>{t('proofForm.ref')} {refLabel}</div>
        </div>
      </div>

      {/* The form body — rows of the booking record; the record reprints
          with each settling deposit */}
      <ol className="m-0 mt-4 p-0 list-none" role="list">
        <StaticRow geo="፩" label={t('proofForm.business')} value="Lux Nails & Spa" hint="ነፍስ ስፓ" />
        <React.Fragment key={slot.id}>
          <StaticRow geo="፪" label={t('proofForm.service')} value={`${slot.service} · ${slot.duration}`} hint={slot.serviceAm} />
          <StaticRow geo="፫" label={t('proofForm.staff')} value={slot.staff} hint="ሰራተኛ" />
          <StaticRow geo="፬" label={t('proofForm.when')} value={`Mon 27 ሐምሌ · ${slot.time}`} hint="ሰዓት" />
          <StaticRow geo="፭" label={t('proofForm.tariff')} value={`Br ${slot.price}`} hint="ዋጋ" mono />
          <StaticRow geo="፮" label={t('proofForm.deposit')} value={`Br ${slot.price}`} hint="ቀዳሚ" mono positive />
          <li
            className="form-row is-active"
            style={{ marginTop: 6, paddingLeft: '1.25rem' }}
          >
            <div className="form-row__index">፯</div>
            <div>
              <div className="form-row__label">{t('proofForm.balance')}</div>
              <div className="text-xs" style={{ color: 'var(--color-ink-soft)', fontFamily: 'var(--font-mono)' }}>{t('proofForm.paidAtChair')}</div>
            </div>
            <div className="form-row__value" style={{ color: 'var(--color-ink)', fontWeight: 600 }}>
              <span key={String(settled)} className={settled ? 'balance-flash' : undefined}>Br 0.00</span>
            </div>
          </li>
        </React.Fragment>
      </ol>

      <div
        className="mt-5 pt-5 flex items-center gap-5"
        style={{ borderTop: '1px solid var(--color-ink)' }}
      >
        <button
          type="button"
          onClick={pressStamp}
          aria-label="Press the stamp"
          aria-pressed={settled}
          className="deposit-stamp-btn cursor-pointer no-underline"
          style={{ all: 'unset', cursor: 'pointer' }}
        >
          {settled ? (
            <span className="deposit-stamp stamp-press-in" aria-hidden>
              <span className="deposit-stamp__ref">{refLabel}</span>
              <span className="deposit-stamp__glyph">ተከከለ</span>
              <span className="deposit-stamp__date">{stampTime} · ሐምሌ 27</span>
            </span>
          ) : (
            <span
              className="deposit-stamp"
              style={{ opacity: 0.35, borderColor: 'var(--color-ink-rule-dashed)' }}
              aria-hidden
            >
              <span className="deposit-stamp__ref" style={{ color: 'var(--color-ink-stamp)' }}>— · —</span>
              <span className="deposit-stamp__glyph" style={{ color: 'var(--color-ink-stamp)' }}>{t('proofForm.pressStampShort')}</span>
              <span className="deposit-stamp__date" style={{ color: 'var(--color-ink-stamp)' }}>press the stamp</span>
            </span>
          )}
        </button>
        <div className="flex-1 min-w-0">
          <div
            key={String(settled)}
            className={`stamp ${settled ? 'fill stamp-bleed-in' : ''}`}
            style={settled ? undefined : { borderColor: 'var(--color-ink)' }}
          >
            {settled ? `${t('proofForm.cleared')} · ተከከለ` : `${t('proofForm.awaitingDeposit')} · በመጠበቅ`}
          </div>
          <p
            className="mt-2 m-0 text-xs"
            style={{ color: 'var(--color-ink-soft)', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}
          >
            {charging
              ? t('liveFeed.charge')
              : settled
                ? t('proofForm.verified')
                : t('proofForm.pressStamp')}
          </p>
          <p
            className="mt-1.5 m-0 text-xs"
            style={{ color: 'var(--color-ink-stamp)', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}
          >
            {t('proofForm.refund')}
          </p>
        </div>
      </div>

      {/* Tear-off stub — the perforated bottom of the ticket with the live reference */}
      <div className="ticket-stub mt-5 pt-4 flex flex-col sm:flex-row sm:items-end gap-4">
        <div
          className="text-sm min-w-0 break-all"
          style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-ink)', letterSpacing: '0.1em' }}
        >
          {t('proofForm.ref')} {refLabel}
        </div>
        <div className="sm:ml-auto sm:text-right min-w-0">
          <span className="stamp" aria-hidden>STUB · KEEP THIS</span>
          <div
            className="mt-2 text-xs"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-ink-stamp)', letterSpacing: '0.05em' }}
          >
            {t('proofForm.ref')} {refLabel}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Specimen — the shared faint diagonal label on demo surfaces ── */
function Specimen() {
  const { t } = useTranslation();
  return (
    <span className="specimen" aria-hidden>
      {t('specimen.label')} · {t('specimen.labelAm')}
    </span>
  );
}

/* ── StatusStamp — one pill, three states: confirmed / pending / waiting ── */
function StatusStamp({
  tone,
  children,
}: {
  tone: 'confirmed' | 'pending' | 'waiting';
  children: React.ReactNode;
}) {
  const cls =
    tone === 'confirmed' ? 'stamp fill'
    : tone === 'pending' ? 'stamp positive pulse'
    : 'stamp warm';
  return <span className={cls}>{children}</span>;
}

function StaticRow({
  geo,
  label,
  value,
  hint,
  mono,
  positive,
}: {
  geo: string;
  label: string;
  value: string;
  hint?: string;
  mono?: boolean;
  positive?: boolean;
}) {
  return (
    <li className="form-row">
      <div className="form-row__index" aria-hidden>{geo}</div>
      <div className="min-w-0">
        <div className="form-row__label">{label}</div>
        {hint && (
          <div className="text-xs" style={{ fontFamily: 'var(--font-ethiopic-label)', color: 'var(--color-ink-soft)' }}>
            {hint}
          </div>
        )}
      </div>
      <div
        className="form-row__value text-right"
        style={{
          fontWeight: mono ? 600 : 400,
          color: positive ? 'var(--color-telebirr-deep)' : 'var(--color-ink)',
        }}
      >
        {value}
      </div>
    </li>
  );
}

/* ── Tariff section — services as rows of the form ── */
function TariffSection() {
  const { t } = useTranslation();
  const listRef = useRef<HTMLUListElement>(null);

  /* overdrive · cursor writes the tariff ink. One pointer listener bound on
     the list (capture phase, rAF-throttled) sets each row's --ink-progress to
     the cursor's fractional X position across that row. Never binds on touch
     pointers or where motion is reduced — the hover-static fallback stays. */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    const fine = window.matchMedia('(pointer: fine)').matches;
    if (!fine) return;
    const list = listRef.current;
    if (!list) return;

    let rafPending = false;
    let lastX = -1;
    let lastY = -1;

    const onMove = (e: PointerEvent) => {
      if (rafPending) return;
      lastX = e.clientX;
      lastY = e.clientY;
      rafPending = true;
      window.requestAnimationFrame(() => {
        rafPending = false;
        const rows = list.querySelectorAll<HTMLElement>('li[data-ink-pen="1"]');
        rows.forEach((row) => {
          const rect = row.getBoundingClientRect();
          if (lastY < rect.top || lastY > rect.bottom) {
            if (row.dataset.inkActive === '1') {
              row.style.setProperty('--ink-progress', '0');
              row.dataset.inkActive = '0';
            }
            return;
          }
          row.dataset.inkActive = '1';
          const frac = Math.max(0, Math.min(1, (lastX - rect.left) / rect.width));
          row.style.setProperty('--ink-progress', String(frac));
        });
      });
    };

    const onLeave = () => {
      if (rafPending) return;
      rafPending = true;
      window.requestAnimationFrame(() => {
        rafPending = false;
        const rows = list.querySelectorAll<HTMLElement>('li[data-ink-pen="1"]');
        rows.forEach((row) => {
          row.style.setProperty('--ink-progress', '0');
          row.dataset.inkActive = '0';
        });
      });
    };

    list.addEventListener('pointermove', onMove);
    list.addEventListener('pointerleave', onLeave);
    list.addEventListener('pointercancel', onLeave);
    return () => {
      list.removeEventListener('pointermove', onMove);
      list.removeEventListener('pointerleave', onLeave);
      list.removeEventListener('pointercancel', onLeave);
    };
  }, []);

  return (
    <section
      id="tariff"
      className="px-5 sm:px-8 lg:px-12 py-16 lg:py-24 scroll-reveal"
      aria-label="Today's tariff"
    >
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-3 mb-8">
          <div>
            <h2
              className="m-0"
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: 'clamp(1.75rem, 4vw, 2.75rem)',
                letterSpacing: '-0.02em',
              }}
            >
              {t('tariffSection.heading')}
              <span
                style={{ fontFamily: 'var(--font-serif-ethiopic)', fontWeight: 700, marginLeft: '0.5rem', color: 'var(--color-telebirr)' }}
              >
                {t('tariffSection.headingAm')}
              </span>
            </h2>
            <p
              className="mt-2 m-0 text-sm"
              style={{ color: 'var(--color-ink-soft)', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}
            >
              {t('tariffSection.everyTenant')}
            </p>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-2">
            <span className="stamp" aria-hidden>{t('tariffSection.location')} · {t('tariffSection.locationAm')}</span>
          </div>
        </header>

        <div
          className="relative p-3 sm:p-5"
          style={{ border: '1px solid var(--color-ink)', borderRadius: 'var(--rd-card)', backgroundColor: 'var(--color-paper)' }}
        >
          <Specimen />
          <ul ref={listRef} className="m-0 p-0 list-none" role="list">
            {SERVICES_DEMO.map((s) => (
              <li
                key={s.name}
                data-ink-pen="1"
                className="form-row tariff-hover-row group"
                style={{ gap: '1.25rem', cursor: 'default', transition: 'background-color 120ms ease-out', position: 'relative' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-paper-raised)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <div className="form-row__index" aria-hidden>{s.geo}</div>
                <div>
                  <div
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontWeight: 600,
                      fontSize: 'clamp(1.25rem, 2.4vw, 1.75rem)',
                      letterSpacing: '-0.015em',
                      color: 'var(--color-ink)',
                    }}
                  >
                    {s.name}
                  </div>
                  <div
                    className="mt-0.5 text-sm"
                    style={{ fontFamily: 'var(--font-ethiopic-label)', color: 'var(--color-ink-soft)', letterSpacing: '0.02em' }}
                  >
                    {s.amName} · {s.duration} {t('tariffSection.min')} · {t('tariffSection.staffOfChoice')}
                  </div>
                </div>
                <div className="tariff-price-wrap">
                  <span
                    className="tariff-price text-right"
                    style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '1.05rem', color: 'var(--color-ink)' }}
                  >
                    <span className="tariff-price__br" aria-hidden>Br </span>
                    {s.price}
                  </span>
                  <span className="stamp positive rubber tariff-book" aria-hidden>
                    {t('tariffSection.book')} · {t('tariffSection.bookAm')}
                  </span>
                </div>
                {/* Ink mirror — telebirr-deep duplicate of each row cell, opened
                    left→right by --ink-progress as the cursor passes across. */}
                <span className="tariff-ink-body" aria-hidden>
                  <span>{s.geo}</span>
                  <span>
                    <span
                      style={{
                        display: 'block',
                        fontFamily: 'var(--font-display)',
                        fontWeight: 600,
                        fontSize: 'clamp(1.25rem, 2.4vw, 1.75rem)',
                        letterSpacing: '-0.015em',
                      }}
                    >
                      {s.name}
                    </span>
                    <span
                      style={{
                        display: 'block',
                        marginTop: '0.125rem',
                        fontFamily: 'var(--font-ethiopic-label)',
                        fontSize: '0.875rem',
                        letterSpacing: '0.02em',
                      }}
                    >
                      {s.amName} · {s.duration} {t('tariffSection.min')} · {t('tariffSection.staffOfChoice')}
                    </span>
                  </span>
                  <span>
                    Br {s.price}
                  </span>
                </span>
                <span className="tariff-ink-rule" aria-hidden />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* Pure board advance: statuses cascade one step and a fresh waiter joins.
   No side effects — safe under React StrictMode's double-invoked updaters. */
function advanceQueue(prev: QueueRow[], nextNo: number): QueueRow[] {
  const advanced = prev.map((r) => {
    if (r.status === 'SERVING') return { ...r, status: 'DONE' as const, statusAm: 'ተፈጸመ' };
    if (r.status === 'NEXT') return { ...r, status: 'SERVING' as const, statusAm: 'በአገልግሎት' };
    if (r.status === 'WAIT') return { ...r, status: 'NEXT' as const, statusAm: 'ቀጣይ' };
    return r;
  });
  const slot = QUEUE_NEW_POOL[(nextNo - 9) % QUEUE_NEW_POOL.length];
  const fresh: QueueRow = {
    no: toEth(nextNo),
    time: slot.time,
    service: slot.service,
    staff: slot.staff,
    status: 'WAIT',
    statusAm: 'በመጠበቅ',
  };
  let out = [...advanced, fresh];
  const doneCount = out.filter((r) => r.status === 'DONE').length;
  if (doneCount > 2) {
    const idx = out.findIndex((r) => r.status === 'DONE');
    out = out.slice(0, idx).concat(out.slice(idx + 1));
  }
  return out;
}

/* ── Queue section — the salon's live queue as a ledger page ──
   The board is alive: every ~4s the serving slot advances, the serving chip
   rolls up a number, and a fresh waiter joins the bottom. Paused when the
   section leaves the viewport, the tab hides, or motion is reduced. */
/* ── overdrive · NOW SERVING elapsed counter ──────────────────────────
   Reads as "the chair has been open for +2:37" running against the same
   Addis-time bank as the masthead clock. Resets whenever the serving slot
   itself changes (every ~4.2s the serving row's key flips, the counter
   restarts). Frozen on the static "+0:00" while reduced motion is on, so
   the live board still scans but doesn't tick. */
function useServingElapsed(servingKey: string | number | undefined): number {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number>(Date.now());
  useEffect(() => {
    startRef.current = Date.now();
    setElapsed(0);
  }, [servingKey]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    let last = 0;
    const loop = (now: number) => {
      raf = window.requestAnimationFrame(loop);
      if (document.hidden) return;
      if (now - last < 480) return;
      last = now;
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    };
    raf = window.requestAnimationFrame(loop);
    const onVis = () => {
      if (!document.hidden) {
        last = 0;
        setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);
  return elapsed;
}
function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `+${m}:${s < 10 ? '0' : ''}${s}`;
}

function QueueSection() {
  const { t } = useTranslation();
  const [sheet, setSheet] = useState(0);
  const [queue, setQueue] = useState<QueueRow[]>(QUEUE_DEMO);
  const noRef = useRef(9);
  const boardRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let visible = true;
    let io: IntersectionObserver | null = null;
    if ('IntersectionObserver' in window && boardRef.current) {
      io = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            visible = e.isIntersecting;
          });
        },
        { threshold: 0.15 }
      );
      io.observe(boardRef.current);
    }
    const id = window.setInterval(() => {
      if (!visible || document.hidden) return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const nextNo = noRef.current;
      noRef.current = nextNo + 1;
      if (nextNo + 1 > 12) {
        noRef.current = 9;
        setSheet((s) => s + 1);
        setQueue(QUEUE_DEMO);
        return;
      }
      setQueue((prev) => advanceQueue(prev, nextNo));
    }, 4200);
    return () => {
      io?.disconnect();
      window.clearInterval(id);
    };
  }, []);

  const serving = queue.find((r) => r.status === 'SERVING') ?? queue[0];
  const servingElapsed = useServingElapsed(serving ? `${sheet}-${serving.no}` : undefined);

  return (
    <section
      ref={boardRef}
      className="px-5 sm:px-8 lg:px-12 py-16 lg:py-24 scroll-reveal"
      aria-label="Today's queue"
    >
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
          <div className="lg:col-span-5">
            <h2
              className="m-0"
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
                letterSpacing: '-0.02em',
              }}
            >
              {t('queueSection.heading')} <span style={{ fontFamily: 'var(--font-serif-ethiopic)', fontWeight: 700 }}>{t('queueSection.headingAm')}</span>.
            </h2>
            <p className="mt-4 text-base sm:text-lg" style={{ color: 'var(--color-ink-soft)', lineHeight: 1.6 }}>
              {t('queueSection.description')}
            </p>
            <p
              className="mt-6 text-sm"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-ink-soft)', letterSpacing: '0.04em' }}
            >
              {t('queueSection.live')} → <span style={{ color: 'var(--color-ink)' }}>luxnails.egebeya.et</span> & <span style={{ color: 'var(--color-ink)' }}>testpayment.egebeya.et</span>
            </p>
          </div>

          <div className="lg:col-span-7">
            <div
              className="queue-board relative p-4 sm:p-5"
              style={{ border: '1px solid var(--color-ink)', borderRadius: 'var(--rd-card)', backgroundColor: 'var(--color-paper)' }}
            >
              <Specimen />
              <div
                className="flex items-baseline justify-between gap-3 pb-3"
                style={{ borderBottom: '1px solid var(--color-ink-rule)' }}
              >
                <div>
                  <div className="stamp" aria-hidden>{t('queueSection.todayQueue')} · {t('queueSection.day')}</div>
                  <div
                    className="mt-2"
                    style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1.2rem', letterSpacing: '-0.01em', color: 'var(--color-ink)' }}
                  >
                    Mon 27 ሐምሌ · 4 {t('queueSection.booked')}
                  </div>
                </div>
              </div>

              {/* NOW SERVING ticker — the active slot on the display board */}
              <div
                className="flex items-center gap-3 py-2.5 px-1"
                style={{ borderBottom: '1px solid var(--color-ink)' }}
              >
                <span className="queue-chip-clip" aria-hidden>
                  <span
                    key={serving?.no}
                    className="take-a-number queue-chip"
                    style={{ width: 22, height: 22, fontSize: '0.7rem' }}
                  >
                    {serving?.no}
                  </span>
                </span>
                <span className="stamp positive" aria-hidden>
                  {t('queueSection.nowServing')} · {t('queueSection.nowServingAm')}
                </span>
                <span
                  className="truncate"
                  style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.95rem', color: 'var(--color-ink)' }}
                >
                  {serving?.time}
                  <span style={{ color: 'var(--color-ink-soft)', fontWeight: 400 }}> · </span>
                  {serving?.service}
                  <span style={{ color: 'var(--color-ink-soft)', fontWeight: 400 }}> · </span>
                  {serving?.staff}
                </span>
                <span
                  className="ml-auto hidden sm:inline text-[0.65rem]"
                  style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-ink-stamp)', letterSpacing: '0.08em' }}
                  aria-hidden
                >
                  {t('queueSection.addis')}
                </span>
              </div>
              <div
                className="now-serving-elapsed -mt-1 mb-1 px-1"
                aria-label={t('queueSection.chairOpenAria')}
              >
                <span className="now-serving-elapsed__num">{formatElapsed(servingElapsed)}</span>
                <span> {t('queueSection.chairOpen')}</span>
              </div>

              <ol className="m-0 mt-2 p-0 list-none" role="list">
                {queue.map((q) => {
                  const done = q.status === 'DONE';
                  const servingRow = q.status === 'SERVING';
                  const next = q.status === 'NEXT';
                  return (
                    <li
                      key={`${sheet}-${q.no}`}
                      className="form-row"
                      style={{
                        borderBottom: '1px solid var(--color-ink-rule)',
                        opacity: done ? 0.55 : 1,
                      }}
                    >
                      <div className="form-row__index" aria-hidden>{q.no}</div>
                      <div className="min-w-0">
                        <div
                          className="truncate"
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 600,
                            fontSize: '1rem',
                            color: 'var(--color-ink)',
                          }}
                        >
                          {q.time}
                          <span style={{ color: 'var(--color-ink-soft)', fontWeight: 400 }}> · </span>
                          {q.service}
                        </div>
                        <div
                          className="mt-0.5 text-xs"
                          style={{ fontFamily: 'var(--font-ethiopic-label)', color: 'var(--color-ink-soft)' }}
                        >
                          {t('queueSection.with')} {q.staff} · {t('queueSection.staffLabel')}
                        </div>
                      </div>
                      {done ? (
                        <span
                          className="stamp"
                          style={{ borderColor: 'var(--color-ink-rule-dashed)', color: 'var(--color-ink-stamp)' }}
                        >
                          {q.statusAm} · {q.status}
                        </span>
                      ) : (
                        <StatusStamp tone={servingRow ? 'confirmed' : next ? 'pending' : 'waiting'}>
                          {q.statusAm} · {q.status}
                        </StatusStamp>
                      )}
                    </li>
                  );
                })}
              </ol>
              <p
                className="mt-2 m-0 text-xs"
                style={{ color: 'var(--color-ink-soft)', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}
              >
                {t('queueSection.privacy')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Counter-close: the operator's graphite page ── */
function CounterClose() {
  const { t } = useTranslation();
  return (
    <section
      className="surface-graphite px-5 sm:px-8 lg:px-12 py-20 lg:py-28 scroll-reveal"
      aria-label="If you own the business / If you're the customer"
    >
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20">
          <OperatorColumn />
          <CustomerColumn />
        </div>
      </div>
    </section>
  );
}

function OperatorColumn() {
  const { t } = useTranslation();
  return (
    <div>
      <div className="stamp on-canvas" aria-hidden>{t('counterClose.owner')} · {t('counterClose.ownerAm')}</div>
      <h2
        className="mt-3 m-0"
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          fontSize: 'clamp(1.75rem, 4vw, 2.75rem)',
          letterSpacing: '-0.02em',
          color: 'var(--color-paper)',
          lineHeight: 1.1,
        }}
      >
        {t('counterClose.ownerHeading')}
      </h2>
      <ol className="mt-6 m-0 p-0 list-none space-y-3" style={{ color: 'var(--color-canvas-soft)' }}>
        <OperatorRow geo="፩" text={`${t('counterClose.ownerStep1')} · ${t('counterClose.ownerStep1Am')}`} />
        <OperatorRow geo="፪" text={`${t('counterClose.ownerStep2')} · ${t('counterClose.ownerStep2Am')}`} />
        <OperatorRow geo="፫" text={`${t('counterClose.ownerStep3')} · ${t('counterClose.ownerStep3Am')}`} />
        <OperatorRow geo="፬" text={`${t('counterClose.ownerStep4')} · ${t('counterClose.ownerStep4Am')}`} />
      </ol>
      <div className="mt-8 flex flex-col sm:flex-row gap-3">
        <a
          href="/register"
          className="btn-telebirr inline-flex items-center justify-center px-6 py-4 text-center font-semibold no-underline"
          style={{
            fontFamily: 'var(--font-display)',
            borderRadius: 'var(--rd-card)',
          }}
        >
          {t('counterClose.ownerCta')} · 14 days free
          <span aria-hidden className="btn-arrow ml-2">→</span>
        </a>
        <a
          href="/login"
          className="btn-ghost-light inline-flex items-center justify-center px-6 py-4 text-center no-underline"
          style={{
            fontFamily: 'var(--font-mono)',
            borderRadius: 'var(--rd-card)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            fontSize: '0.85rem',
          }}
        >
          {t('counterClose.ownerLogin')} · ግባ
        </a>
      </div>
    </div>
  );
}

function OperatorRow({ geo, text }: { geo: string; text: React.ReactNode }) {
  return (
    <li className="flex items-baseline gap-3">
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontWeight: 600,
          color: 'rgba(244,242,236,0.6)',
          minWidth: '1.5rem',
        }}
        aria-hidden
      >
        {geo}
      </span>
      <span style={{ fontSize: '0.95rem' }}>{text}</span>
    </li>
  );
}

function CustomerColumn() {
  const { t } = useTranslation();
  return (
    <div>
      <div className="stamp on-canvas" aria-hidden>{t('counterClose.customer')} · {t('counterClose.customerAm')}</div>
      <h2
        className="mt-3 m-0"
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          fontSize: 'clamp(1.75rem, 4vw, 2.75rem)',
          letterSpacing: '-0.02em',
          color: 'var(--color-paper)',
          lineHeight: 1.1,
        }}
      >
        {t('counterClose.customerHeading')}
      </h2>
      <ol className="mt-6 m-0 p-0 list-none space-y-3" style={{ color: 'var(--color-canvas-soft)' }}>
        <OperatorRow geo="፩" text={`${t('counterClose.customerStep1')} · ${t('counterClose.customerStep1Am')}`} />
        <OperatorRow geo="፪" text={`${t('counterClose.customerStep2')} · ${t('counterClose.customerStep2Am')}`} />
        <OperatorRow geo="፫" text={`${t('counterClose.customerStep3')} · ${t('counterClose.customerStep3Am')}`} />
        <OperatorRow geo="፬" text={`${t('counterClose.customerStep4')} · ${t('counterClose.customerStep4Am')}`} />
      </ol>
      <div className="mt-8">
        <a
          href="/discover"
          className="btn-ghost-light inline-flex items-center justify-center px-6 py-4 text-center no-underline"
          style={{
            fontFamily: 'var(--font-mono)',
            borderRadius: 'var(--rd-card)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            fontSize: '0.85rem',
          }}
        >
          {t('counterClose.customerCta')} · ፈልግ
          <span aria-hidden className="btn-arrow ml-2">→</span>
        </a>
      </div>
    </div>
  );
}

/* ── Wordmark (FileSync) — the latent print-style lockup ── */
export function Wordmark({
  size = 'md',
  tone = 'ink',
}: {
  size?: 'md' | 'lg';
  tone?: 'ink' | 'paper';
}) {
  const indigo = tone === 'ink' ? 'var(--color-ink)' : 'var(--color-paper)';
  const sub = tone === 'ink' ? 'var(--color-ink-stamp)' : 'rgba(244,242,236,0.55)';
  const sizeMain = size === 'lg' ? 'clamp(1.75rem, 3vw, 2.25rem)' : '1.45rem';
  const sizeSub = size === 'lg' ? '0.85rem' : '0.7rem';
  return (
    <span aria-label="Egebeya · ኢ-ገበያ" className="inline-flex items-baseline gap-2 no-underline">
      <span
        style={{
          fontFamily: 'var(--font-serif-ethiopic)',
          fontWeight: 700,
          color: indigo,
          fontSize: sizeMain,
          lineHeight: 1,
        }}
      >
        ኢ-ገበያ
      </span>
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          color: sub,
          fontSize: sizeSub,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}
      >
        Egebeya
      </span>
    </span>
  );
}

/* ── Search section — find businesses on the platform ── */
function SearchSection() {
  return (
    <section
      className="px-5 sm:px-8 lg:px-12 py-8 lg:pb-16 scroll-reveal"
      aria-label="Find a business"
    >
      <div className="mx-auto max-w-6xl">
        <h2
          className="m-0"
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize: 'clamp(1.25rem, 2.5vw, 1.65rem)',
            marginBottom: 6,
          }}
        >
          Find a business 
          <span style={{ fontFamily: 'var(--font-serif-ethiopic)', fontWeight: 700, color: 'var(--color-ink-soft)' }}>
            ንግድ ይፈልጉ
          </span>
        </h2>
        <p
          className="m-0"
          style={{ color: 'var(--color-ink-soft)', fontSize: '0.9rem', marginBottom: 20 }}
        >
          Every business on Egebeya takes Telebirr deposits. Search by name, area, or service.
        </p>
        <form
          action="/discover"
          method="get"
          style={{
            display: 'flex',
            gap: 0,
            border: '1px solid var(--color-ink)',
            borderRadius: 'var(--rd-card)',
            overflow: 'hidden',
          }}
        >
          <input
            type="text"
            name="q"
            placeholder="Salons, clinics, barbers, plumbers in Addis…"
            aria-label="Search Egebeya businesses"
            style={{
              flex: 1,
              border: 'none',
              padding: '16px 20px',
              fontFamily: 'var(--font-body)',
              fontSize: '1rem',
              color: 'var(--color-ink)',
              outline: 'none',
              background: 'transparent',
              minWidth: 0,
            }}
          />
          <button
            type="submit"
            className="btn-ink"
            style={{
              border: 'none',
              padding: '16px 28px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              fontSize: '0.8rem',
              letterSpacing: '0.05em',
              textTransform: 'uppercase' as const,
              cursor: 'pointer',
            }}
          >
            Find · ፈልግ<span aria-hidden className="btn-arrow ml-2">→</span>
          </button>
        </form>
        <div
          style={{
            marginTop: 16,
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap' as const,
          }}
        >
          {['Salons · ሳሎን', 'Clinics · ክሊኒክ', 'Barbers · ፀጉር', 'Plumbers · ውሃ', 'Tutors · አስተማሪ'].map((cat) => (
            <a
              key={cat}
              href="/discover"
              style={{
                color: 'var(--color-ink)',
                textDecoration: 'none',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.72rem',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                padding: '7px 13px',
                border: '1px solid var(--color-ink)',
                borderRadius: 'var(--rd-card)',
                transition: 'background-color 120ms, color 120ms',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-ink)';
                e.currentTarget.style.color = 'var(--color-paper)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--color-ink)';
              }}
            >
              {cat}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
