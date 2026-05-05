import { useEffect, useRef, useState, useCallback } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

/* ═══════════════════════════════════════════════════════════════════════
   CONFIGURATION
   ═══════════════════════════════════════════════════════════════════════ */
const TOTAL_FRAMES = 300;
const ZOOM_FACTOR = 1.15;        // slight crop to hide letterboxing
const PARALLAX_SCALE = 1.05;     // canvas overscan for mouse parallax
const PARALLAX_STRENGTH = 20;    // px offset max

/** Build the URL for a given 0-based frame index → frame-000.jpg … frame-299.jpg */
function frameUrl(index: number): string {
  const num = String(index).padStart(3, "0");
  return `/frames/frame-${num}.jpg`;
}

/* ═══════════════════════════════════════════════════════════════════════
   LOADING SCREEN
   ═══════════════════════════════════════════════════════════════════════ */
function LoadingScreen({ progress }: { progress: number }) {
  const pct = Math.round(progress * 100);
  const circumference = 2 * Math.PI * 52;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black">
      {/* Animated ring */}
      <div className="loading-ring mb-8">
        <svg viewBox="0 0 120 120" className="w-24 h-24 md:w-28 md:h-28">
          <circle
            cx="60" cy="60" r="52"
            fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="2"
          />
          <circle
            cx="60" cy="60" r="52"
            fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
            className="transition-[stroke-dashoffset] duration-150 ease-out"
            style={{ transform: "rotate(-90deg)", transformOrigin: "center" }}
          />
        </svg>
      </div>

      {/* Percentage */}
      <p className="text-5xl md:text-6xl tracking-tight font-extralight text-white/80 tabular-nums font-[family-name:var(--font-display)]">
        {pct}<span className="text-xl text-white/30 ml-1">%</span>
      </p>

      <p className="mt-4 text-[10px] uppercase tracking-[0.4em] text-white/20 font-light">
        Preparing your experience
      </p>

      {/* Thin progress bar */}
      <div className="mt-8 w-56 h-px bg-white/[0.06] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-[width] duration-150 ease-out bg-white/30"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   SCROLL-TO-TOP BUTTON
   ═══════════════════════════════════════════════════════════════════════ */
function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > window.innerHeight * 0.8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      id="scroll-to-top"
      onClick={() => gsap.to(window, { scrollTo: 0, duration: 2, ease: "power3.inOut" })}
      aria-label="Scroll to top"
      className={`fixed bottom-8 right-8 z-[200] w-11 h-11 rounded-full 
        flex items-center justify-center cursor-pointer
        bg-white/[0.04] backdrop-blur-xl border border-white/[0.06]
        text-white/40 hover:text-white/80 hover:bg-white/[0.08]
        transition-all duration-500
        ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"}`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="18 15 12 9 6 15" />
      </svg>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   CONTENT SECTION (glassmorphism overlay)
   ═══════════════════════════════════════════════════════════════════════ */
interface SectionProps {
  id: string;
  children: React.ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
}

function ContentSection({ id, children, align = "left", className = "" }: SectionProps) {
  const alignClass = {
    left: "items-start text-left pl-8 md:pl-20 lg:pl-28",
    right: "items-end text-right pr-8 md:pr-20 lg:pr-28",
    center: "items-center text-center px-6",
  }[align];

  return (
    <section
      id={id}
      className={`relative z-30 h-screen w-full flex flex-col justify-center ${alignClass} ${className}`}
    >
      <div className="content-block glass-card px-8 py-10 md:px-12 md:py-14 max-w-xl">
        {children}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   MAIN APP
   ═══════════════════════════════════════════════════════════════════════ */
export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const currentFrameRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const [loadProgress, setLoadProgress] = useState(0);
  const [loaded, setLoaded] = useState(false);

  /* ── Preload all frames ──────────────────────────────────────────── */
  useEffect(() => {
    let count = 0;
    const images: HTMLImageElement[] = new Array(TOTAL_FRAMES);

    const tick = () => {
      count++;
      setLoadProgress(count / TOTAL_FRAMES);
      if (count === TOTAL_FRAMES) {
        imagesRef.current = images;
        setTimeout(() => setLoaded(true), 350);
      }
    };

    for (let i = 0; i < TOTAL_FRAMES; i++) {
      const img = new Image();
      img.src = frameUrl(i);
      img.onload = tick;
      img.onerror = tick;
      images[i] = img;
    }
  }, []);

  /* ── Draw a frame (object-fit: cover + zoom) ─────────────────────── */
  const drawFrame = useCallback((index: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = imagesRef.current[index];
    if (!img?.complete || !img.naturalWidth) return;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    const cw = canvas.width;
    const ch = canvas.height;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;

    const scale = Math.max(cw / iw, ch / ih) * ZOOM_FACTOR;
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = (cw - dw) / 2;
    const dy = (ch - dh) / 2;

    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(img, dx, dy, dw, dh);
  }, []);

  /* ── Resize canvas (high-DPI) ───────────────────────────────────── */
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    drawFrame(currentFrameRef.current);
  }, [drawFrame]);

  /* ── ScrollTrigger → frame scrubbing ─────────────────────────────── */
  useEffect(() => {
    if (!loaded || !containerRef.current) return;

    resizeCanvas();
    drawFrame(0);

    // GSAP ScrollTrigger: map scroll to frame index
    const obj = { frame: 0 };

    const st = ScrollTrigger.create({
      trigger: containerRef.current,
      start: "top top",
      end: "bottom bottom",
      scrub: 0.5,          // smooth scrubbing (0.5s lag)
      onUpdate: (self) => {
        const idx = Math.min(
          Math.floor(self.progress * TOTAL_FRAMES),
          TOTAL_FRAMES - 1
        );
        if (idx !== currentFrameRef.current) {
          currentFrameRef.current = idx;
          requestAnimationFrame(() => drawFrame(idx));
        }
      },
    });

    // Resize listener
    const onResize = () => {
      resizeCanvas();
      ScrollTrigger.refresh();
    };
    window.addEventListener("resize", onResize);

    return () => {
      st.kill();
      window.removeEventListener("resize", onResize);
    };
  }, [loaded, drawFrame, resizeCanvas]);

  /* ── GSAP: fade-in content sections ──────────────────────────────── */
  useEffect(() => {
    if (!loaded) return;

    // Small delay to let the DOM settle
    const timer = setTimeout(() => {
      const blocks = gsap.utils.toArray<HTMLElement>(".content-block");

      blocks.forEach((block) => {
        gsap.fromTo(
          block,
          { opacity: 0, y: 60 },
          {
            opacity: 1,
            y: 0,
            duration: 1,
            ease: "power3.out",
            scrollTrigger: {
              trigger: block,
              start: "top 85%",
              end: "top 30%",
              toggleActions: "play none none reverse",
            },
          }
        );
      });
    }, 100);

    return () => clearTimeout(timer);
  }, [loaded]);

  /* ── Mouse parallax ─────────────────────────────────────────────── */
  useEffect(() => {
    if (!loaded) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onMouseMove = (e: MouseEvent) => {
      const mx = (e.clientX / window.innerWidth - 0.5) * 2;
      const my = (e.clientY / window.innerHeight - 0.5) * 2;
      gsap.to(canvas, {
        x: -mx * PARALLAX_STRENGTH,
        y: -my * PARALLAX_STRENGTH,
        duration: 1,
        ease: "power2.out",
        overwrite: "auto",
      });
    };

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMouseMove);
  }, [loaded]);

  /* ═══════════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════════ */
  return (
    <>
      {/* ── Loading Overlay ── */}
      {!loaded && <LoadingScreen progress={loadProgress} />}

      {/* ── Fixed Canvas Background ── */}
      <canvas
        ref={canvasRef}
        id="frame-canvas"
        className="fixed inset-0 z-0"
        style={{ scale: PARALLAX_SCALE, willChange: "transform" }}
      />

      {/* ── Cinematic Overlays ── */}
      <div className="fixed inset-0 z-[1] pointer-events-none cinematic-vignette" />
      <div className="fixed inset-0 z-[2] pointer-events-none film-grain" />

      {/* ── Scrollable Content ── */}
      <div ref={containerRef} id="scroll-container">

        {/* ── NAV ── */}
        {loaded && (
          <nav
            className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-between px-6 md:px-12 py-5 md:py-7"
            style={{ animation: "fadeSlideDown 0.9s ease-out 0.3s both" }}
          >
            <div className="text-xl md:text-2xl tracking-tight font-[family-name:var(--font-display)]">
              Velorah<span className="text-[10px] align-top ml-0.5 text-white/30">®</span>
            </div>

            <div className="hidden md:flex items-center gap-9">
              {["Home", "Studio", "About", "Journal", "Reach Us"].map((link) => (
                <a
                  key={link}
                  href="#"
                  className={`text-[11px] uppercase tracking-[0.18em] transition-colors duration-300 hover:text-white ${
                    link === "Home" ? "text-white/90" : "text-white/30"
                  }`}
                >
                  {link}
                </a>
              ))}
            </div>

            <button className="cta-button px-5 py-2 rounded-full text-[11px] uppercase tracking-[0.14em] text-white/60 bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] cursor-pointer">
              Begin Journey
            </button>
          </nav>
        )}

        {/* ═══════════════════════════════════════════════════════════════
           SECTION 1 — HERO
           ═══════════════════════════════════════════════════════════════ */}
        <section
          id="hero"
          className="relative z-30 h-screen w-full flex flex-col items-center justify-center text-center px-6"
        >
          {loaded && (
            <div style={{ animation: "fadeSlideUp 1.2s ease-out 0.5s both" }}>
              <h1
                className="text-5xl sm:text-7xl md:text-[5.5rem] lg:text-[7rem] leading-[0.9] tracking-[-0.03em] font-normal max-w-5xl font-[family-name:var(--font-display)]"
              >
                <span className="text-white/40">Where</span>{" "}
                <span className="text-white">light</span>{" "}
                <span className="text-white/40">bends</span>
                <br />
                <span className="text-white/40">to your</span>{" "}
                <span className="text-white italic">will.</span>
              </h1>

              <p className="text-sm md:text-base text-white/30 max-w-lg mx-auto mt-8 leading-relaxed font-light">
                An immersive spatial experience crafted for those who demand
                more from the digital world. Scroll to begin.
              </p>

              <button
                onClick={() => gsap.to(window, { scrollTo: "#feature-1", duration: 1.5, ease: "power3.inOut" })}
                className="cta-button mt-10 px-10 py-3.5 rounded-full text-[12px] uppercase tracking-[0.16em] text-white/80 bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] cursor-pointer"
              >
                Explore
              </button>

              {/* Scroll hint */}
              <div className="mt-16 flex flex-col items-center gap-2">
                <span className="text-[9px] uppercase tracking-[0.35em] text-white/15 font-light">
                  Scroll
                </span>
                <div className="w-px h-10 bg-gradient-to-b from-white/20 to-transparent scroll-line" />
              </div>
            </div>
          )}
        </section>

        {/* ═══════════════════════════════════════════════════════════════
           SPACER — let the scroll animation breathe
           ═══════════════════════════════════════════════════════════════ */}
        <div className="h-screen" />

        {/* ═══════════════════════════════════════════════════════════════
           SECTION 2 — FEATURE 1 (LEFT)
           ═══════════════════════════════════════════════════════════════ */}
        <ContentSection id="feature-1" align="left">
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/25 mb-4 font-light">
            The Problem
          </p>
          <h2 className="text-3xl md:text-4xl leading-[1.1] tracking-[-0.02em] font-[family-name:var(--font-display)] text-white/90">
            Digital experiences were never designed to feel{" "}
            <span className="italic text-white">real.</span>
          </h2>
          <p className="text-sm text-white/30 mt-5 leading-relaxed font-light max-w-md">
            Most interfaces are flat, static, and forgettable. We believe
            the screen should be a window into another dimension — one that
            responds to your presence and rewards your curiosity.
          </p>
        </ContentSection>

        {/* spacer */}
        <div className="h-[60vh]" />

        {/* ═══════════════════════════════════════════════════════════════
           SECTION 3 — FEATURE 2 (RIGHT)
           ═══════════════════════════════════════════════════════════════ */}
        <ContentSection id="feature-2" align="right">
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/25 mb-4 font-light">
            The Technology
          </p>
          <h2 className="text-3xl md:text-4xl leading-[1.1] tracking-[-0.02em] font-[family-name:var(--font-display)] text-white/90">
            Canvas-driven rendering at{" "}
            <span className="italic text-white">60fps.</span>
          </h2>
          <p className="text-sm text-white/30 mt-5 leading-relaxed font-light max-w-md">
            Every frame is preloaded into memory. GSAP's ScrollTrigger
            maps your scroll position to a cinematic image sequence,
            creating a parallax-rich, 3D-depth illusion that feels alive.
          </p>
        </ContentSection>

        {/* spacer */}
        <div className="h-[60vh]" />

        {/* ═══════════════════════════════════════════════════════════════
           SECTION 4 — FEATURE 3 (LEFT)
           ═══════════════════════════════════════════════════════════════ */}
        <ContentSection id="feature-3" align="left">
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/25 mb-4 font-light">
            The Craft
          </p>
          <h2 className="text-3xl md:text-4xl leading-[1.1] tracking-[-0.02em] font-[family-name:var(--font-display)] text-white/90">
            Every pixel, every shadow —{" "}
            <span className="italic text-white">intentional.</span>
          </h2>
          <p className="text-sm text-white/30 mt-5 leading-relaxed font-light max-w-md">
            We obsess over typography, negative space, and motion. The
            glassmorphism overlays, cinematic vignettes, and film-grain
            textures exist to make the digital feel tactile.
          </p>
        </ContentSection>

        {/* spacer */}
        <div className="h-[60vh]" />

        {/* ═══════════════════════════════════════════════════════════════
           SECTION 5 — FINAL CTA (CENTER)
           ═══════════════════════════════════════════════════════════════ */}
        <ContentSection id="final-cta" align="center">
          <h2 className="text-4xl md:text-5xl leading-[1.05] tracking-[-0.02em] font-[family-name:var(--font-display)] text-white/90">
            Ready to see{" "}
            <span className="italic text-white">beyond?</span>
          </h2>
          <p className="text-sm text-white/30 mt-5 leading-relaxed font-light max-w-md mx-auto">
            Join the movement of creators who refuse to settle for
            mediocre digital experiences.
          </p>
          <button
            className="cta-button mt-8 px-12 py-4 rounded-full text-[13px] uppercase tracking-[0.16em] text-white/90 bg-white/[0.06] backdrop-blur-xl border border-white/[0.1] cursor-pointer"
          >
            Get Early Access
          </button>
        </ContentSection>

        {/* ═══════════════════════════════════════════════════════════════
           FOOTER
           ═══════════════════════════════════════════════════════════════ */}
        <footer className="relative z-30 py-12 flex items-center justify-between px-8 md:px-12">
          <div className="flex gap-3">
            <div className="w-1 h-1 rounded-full bg-white/10" />
            <div className="w-1 h-1 rounded-full bg-white/30" />
            <div className="w-1 h-1 rounded-full bg-white/10" />
          </div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/15 font-[family-name:var(--font-display)]">
            Velorah — Est. MMXXIV
          </p>
        </footer>
      </div>

      {/* ── Scroll-to-Top ── */}
      {loaded && <ScrollToTopButton />}
    </>
  );
}
