"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

const slides = [
  {
    title: "Smart Lead Generation",
    subtitle: "Scout finds and enriches leads from any niche automatically",
    illustration: (
      <svg viewBox="0 0 320 240" className="w-full max-w-xs" fill="none">
        <circle cx="160" cy="120" r="80" stroke="#0EA5E9" strokeWidth="1.5" opacity="0.2" />
        <circle cx="160" cy="120" r="50" stroke="#0EA5E9" strokeWidth="1.5" opacity="0.35" />
        <circle cx="160" cy="120" r="20" fill="#0EA5E9" opacity="0.6" />
        <path d="M160 40v-8M160 208v8M60 120H52M268 120h8M81.4 81.4l-5.7-5.7M244.3 84.3l5.7-5.7M81.4 158.6l-5.7 5.7M244.3 155.7l5.7 5.7" stroke="#0EA5E9" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
        <path d="M120 120a40 40 0 0180 0" stroke="#0EA5E9" strokeWidth="2" strokeDasharray="4 3" />
        <circle cx="200" cy="90" r="6" fill="#22C55E" opacity="0.8" />
        <circle cx="220" cy="70" r="4" fill="#22C55E" opacity="0.5" />
        <circle cx="235" cy="55" r="3" fill="#22C55E" opacity="0.3" />
      </svg>
    ),
  },
  {
    title: "Intelligent Sales Pipeline",
    subtitle: "Aria engages, Nova closes, Ember retains \u2014 AI-powered sales team",
    illustration: (
      <svg viewBox="0 0 320 240" className="w-full max-w-xs" fill="none">
        <rect x="40" y="70" width="60" height="80" rx="10" stroke="#0EA5E9" strokeWidth="1.5" opacity="0.3" />
        <rect x="50" y="80" width="40" height="8" rx="4" fill="#0EA5E9" opacity="0.5" />
        <rect x="50" y="94" width="35" height="6" rx="3" fill="#0EA5E9" opacity="0.35" />
        <rect x="50" y="106" width="38" height="6" rx="3" fill="#0EA5E9" opacity="0.35" />
        <rect x="130" y="70" width="60" height="80" rx="10" stroke="#22C55E" strokeWidth="1.5" opacity="0.3" />
        <rect x="140" y="80" width="40" height="8" rx="4" fill="#22C55E" opacity="0.5" />
        <rect x="140" y="94" width="28" height="6" rx="3" fill="#22C55E" opacity="0.35" />
        <rect x="140" y="106" width="32" height="6" rx="3" fill="#22C55E" opacity="0.35" />
        <rect x="220" y="70" width="60" height="80" rx="10" stroke="#F59E0B" strokeWidth="1.5" opacity="0.3" />
        <rect x="230" y="80" width="40" height="8" rx="4" fill="#F59E0B" opacity="0.5" />
        <rect x="230" y="94" width="30" height="6" rx="3" fill="#F59E0B" opacity="0.35" />
        <rect x="230" y="106" width="26" height="6" rx="3" fill="#F59E0B" opacity="0.35" />
        <path d="M100 100h30M190 100h30" stroke="#6B7280" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.4" />
        <text x="70" y="170" textAnchor="middle" fill="#0EA5E9" fontSize="10" opacity="0.6">Scout</text>
        <text x="160" y="170" textAnchor="middle" fill="#22C55E" fontSize="10" opacity="0.6">Nova</text>
        <text x="250" y="170" textAnchor="middle" fill="#F59E0B" fontSize="10" opacity="0.6">Ember</text>
        <path d="M160 185v15" stroke="#6B7280" strokeWidth="1.5" opacity="0.3" />
        <rect x="145" y="200" width="30" height="20" rx="4" fill="#0EA5E9" opacity="0.15" />
        <rect x="155" y="206" width="10" height="8" rx="2" fill="#0EA5E9" opacity="0.5" />
      </svg>
    ),
  },
  {
    title: "Multi-Tenant CRM",
    subtitle: "Your own sales platform with client portal and onboarding",
    illustration: (
      <svg viewBox="0 0 320 240" className="w-full max-w-xs" fill="none">
        <rect x="40" y="60" width="80" height="100" rx="12" stroke="#0EA5E9" strokeWidth="1.5" opacity="0.25" />
        <rect x="48" y="68" width="64" height="6" rx="3" fill="#0EA5E9" opacity="0.4" />
        <rect x="48" y="80" width="56" height="4" rx="2" fill="#0EA5E9" opacity="0.25" />
        <rect x="48" y="90" width="50" height="4" rx="2" fill="#0EA5E9" opacity="0.25" />
        <rect x="48" y="100" width="52" height="4" rx="2" fill="#0EA5E9" opacity="0.25" />
        <rect x="120" y="60" width="80" height="100" rx="12" stroke="#22C55E" strokeWidth="1.5" opacity="0.25" />
        <rect x="128" y="68" width="64" height="6" rx="3" fill="#22C55E" opacity="0.4" />
        <rect x="128" y="80" width="56" height="4" rx="2" fill="#22C55E" opacity="0.25" />
        <rect x="128" y="90" width="50" height="4" rx="2" fill="#22C55E" opacity="0.25" />
        <rect x="128" y="100" width="52" height="4" rx="2" fill="#22C55E" opacity="0.25" />
        <rect x="200" y="60" width="80" height="100" rx="12" stroke="#F59E0B" strokeWidth="1.5" opacity="0.25" />
        <rect x="208" y="68" width="64" height="6" rx="3" fill="#F59E0B" opacity="0.4" />
        <rect x="208" y="80" width="56" height="4" rx="2" fill="#F59E0B" opacity="0.25" />
        <rect x="208" y="90" width="50" height="4" rx="2" fill="#F59E0B" opacity="0.25" />
        <rect x="208" y="100" width="52" height="4" rx="2" fill="#F59E0B" opacity="0.25" />
        <path d="M160 175v15c0 5 5 10 10 10h8c5 0 10-5 10-10v-5" stroke="#8B5CF6" strokeWidth="1.5" opacity="0.4" />
        <circle cx="178" cy="195" r="4" fill="#8B5CF6" opacity="0.5" />
        <path d="M160 185l8-5 8 5" stroke="#8B5CF6" strokeWidth="1.5" opacity="0.4" />
        <rect x="50" y="160" width="4" height="14" rx="2" fill="#0EA5E9" opacity="0.3" />
        <rect x="130" y="155" width="4" height="19" rx="2" fill="#22C55E" opacity="0.3" />
        <rect x="210" y="150" width="4" height="24" rx="2" fill="#F59E0B" opacity="0.3" />
      </svg>
    ),
  },
];

export default function HeroCarousel() {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef(0);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setCurrent((c) => (c + 1) % slides.length), 5000);
    return () => clearInterval(t);
  }, [paused]);

  const go = useCallback((i: number) => setCurrent(i), []);

  const handleTouchStart = (e: React.TouchEvent) => { touchX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = touchX.current - e.changedTouches[0].clientX;
    if (Math.abs(dx) > 50) setCurrent((c) => (c + (dx > 0 ? 1 : -1) + slides.length) % slides.length);
  };

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12 sm:py-16">
      <div className="relative w-full max-w-3xl">
        <div
          className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className="flex transition-transform duration-500 ease-in-out" style={{ transform: `translateX(-${current * 100}%)` }}>
            {slides.map((slide, i) => (
              <div key={i} className="flex w-full shrink-0 flex-col items-center gap-6 px-6 py-10 text-center sm:gap-8 sm:px-16 sm:py-14">
                <div className="flex items-center justify-center">{slide.illustration}</div>
                <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-4xl">{slide.title}</h1>
                <p className="max-w-md text-sm text-gray-600 sm:text-lg">{slide.subtitle}</p>
                {i === slides.length - 1 && (
                  <Link href="/signup" className="inline-flex items-center gap-2 rounded bg-[#2d2424] px-7 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#4a4040]">
                    Get Started
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>

        <button onClick={() => go((current - 1 + slides.length) % slides.length)} aria-label="Previous" className="absolute left-1 top-1/2 -translate-y-1/2 rounded border border-gray-200 bg-white/80 p-2 text-gray-500 shadow-sm backdrop-blur transition hover:bg-white hover:text-gray-800 sm:left-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <button onClick={() => go((current + 1) % slides.length)} aria-label="Next" className="absolute right-1 top-1/2 -translate-y-1/2 rounded border border-gray-200 bg-white/80 p-2 text-gray-500 shadow-sm backdrop-blur transition hover:bg-white hover:text-gray-800 sm:right-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
        </button>

        <div className="mt-5 flex items-center justify-center gap-2">
          {slides.map((_, i) => (
            <button key={i} onClick={() => go(i)} className={`h-2 rounded-full transition-all duration-300 ${i === current ? "w-8 bg-[#2d2424]" : "w-2 bg-gray-300 hover:bg-gray-400"}`} aria-label={`Slide ${i + 1}`} />
          ))}
        </div>
      </div>
    </main>
  );
}
