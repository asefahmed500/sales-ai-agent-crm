"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";

function RegisterForm() {
  const router = useRouter();
  const token = useSearchParams().get("token");
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);
  const [contact, setContact] = useState<{ name: string; email: string } | null>(null);
  const [company, setCompany] = useState<{ name: string } | null>(null);
  const [contactId, setContactId] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");

  // Verify token on mount
  useState(() => {
    if (!token) return;
    api.verifyOnboardingToken(token)
      .then((d) => {
        setContact(d.contact);
        setCompany(d.company);
        setVerified(true);
      })
      .catch(() => setError("Invalid or expired invitation link. Please contact your admin."));
  });

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    setError("");
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (password !== confirm) { setError("Passwords do not match"); return; }

    setLoading(true);
    try {
      const res = await api.register(contact!.email, password, contact!.name);
      localStorage.setItem("sg_token", res.token);
      await api.completeOnboarding(token!);
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return <p className="text-sm text-red-500 text-center">No invitation token found. Please use the link from your invitation email.</p>;
  }

  if (error && !verified) {
    return <p className="text-sm text-red-500 text-center">{error}</p>;
  }

  return (
    <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg ring-1 ring-gray-200">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-sky-100">
          <svg className="h-6 w-6 text-sky-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857" /></svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">You&apos;re invited!</h1>
        {company && <p className="mt-1 text-sm text-gray-500">Join <span className="font-semibold">{company.name}</span> on SalesGenius</p>}
      </div>

      {contact && (
        <div className="mb-6 rounded-xl bg-gray-50 px-4 py-3">
          <div className="text-sm text-gray-500">Account for</div>
          <div className="font-medium text-gray-900">{contact.name}</div>
          <div className="text-sm text-gray-600">{contact.email}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Set Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
            placeholder="Min 8 characters" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Confirm Password</label>
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
            placeholder="Repeat password" />
        </div>
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
        <button type="submit" disabled={loading}
          className="w-full rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-600 disabled:opacity-60">
          {loading ? "Creating account..." : "Create Account & Get Started"}
        </button>
      </form>
    </div>
  );
}

export default function PortalRegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 via-white to-sky-50 px-4">
      <Suspense fallback={<div className="text-sm text-gray-400">Loading...</div>}>
        <RegisterForm />
      </Suspense>
    </div>
  );
}
