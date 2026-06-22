"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");

  function validate(): boolean {
    setEmailError("");
    if (!email) { setEmailError("Email is required"); return false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setEmailError("Invalid email format"); return false; }
    return true;
  }

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setApiError("");
    try {
      await api.forgotPassword(email);
      setSubmitted(true);
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 via-white to-sky-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg ring-1 ring-gray-200">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Reset password</h1>
          <p className="mt-1 text-sm text-gray-500">Enter your email and we&apos;ll send you reset instructions</p>
        </div>

        {submitted ? (
          <div className="rounded-xl bg-sky-50 px-4 py-6 text-center">
            <svg className="mx-auto mb-3 h-10 w-10 text-sky-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12a10 10 0 11-20 0 10 10 0 0120 0z" /><path d="M8 12l2 2 4-4" />
            </svg>
            <p className="text-sm font-medium text-gray-900">Check your email</p>
            <p className="mt-1 text-sm text-gray-500">If an account exists, you&apos;ll receive reset instructions.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                placeholder="john@company.com" />
              {emailError && <p className="mt-1 text-xs text-red-500">{emailError}</p>}
            </div>
            {apiError && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{apiError}</div>}
            <button type="submit" disabled={loading}
              className="w-full rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-600 disabled:opacity-60">
              {loading ? "Sending..." : "Send Reset Instructions"}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-gray-500">
          <Link href="/login" className="font-medium text-sky-600 hover:text-sky-700">Back to Sign In</Link>
        </p>
      </div>
    </div>
  );
}
