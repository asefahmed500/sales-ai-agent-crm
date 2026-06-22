"use client";

import { useCallback, useEffect, useState } from "react";
import Navbar from "@/components/landing/navbar";
import CommandPalette from "@/components/landing/command-palette";
import HeroCarousel from "@/components/landing/hero-carousel";
import LandingFooter from "@/components/landing/footer";

export default function LandingPage() {
  const [cmdOpen, setCmdOpen] = useState(false);

  const handleKey = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      setCmdOpen(true);
    }
    if (e.key === "Escape") setCmdOpen(false);
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-[#f9fbe7]">
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
      <Navbar onOpenCmd={() => setCmdOpen(true)} />
      <HeroCarousel />
      <LandingFooter />
    </div>
  );
}
