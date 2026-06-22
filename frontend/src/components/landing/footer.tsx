import Link from "next/link";

export default function LandingFooter() {
  return (
    <footer className="border-t border-gray-200 bg-white px-4 py-12 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-5xl text-center">
        <div className="mb-6 text-5xl font-black tracking-tighter text-gray-900 sm:text-7xl md:text-8xl">
          Sales<span className="text-gray-300">Genius</span>
        </div>
        <div className="mx-auto mb-8 flex max-w-md flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-gray-500">
          <Link href="/login" className="transition hover:text-gray-800">Sign In</Link>
          <Link href="/signup" className="transition hover:text-gray-800">Get Started</Link>
          <Link href="/dashboard" className="transition hover:text-gray-800">Dashboard</Link>
          <span className="text-gray-300">·</span>
          <Link href="/login" className="transition hover:text-gray-800">Privacy</Link>
          <Link href="/login" className="transition hover:text-gray-800">Terms</Link>
          <Link href="/login" className="transition hover:text-gray-800">Contact</Link>
        </div>
        <p className="text-xs text-gray-400">&copy; {new Date().getFullYear()} SalesGenius. All rights reserved.</p>
      </div>
    </footer>
  );
}
