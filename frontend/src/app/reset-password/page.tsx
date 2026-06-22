"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";

function ResetForm() {
  const router = useRouter();
  const token = useSearchParams().get("token");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    setError("");

    if (!token) { setError("Invalid reset link"); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (password !== confirm) { setError("Passwords do not match"); return; }

    setLoading(true);
    try {
      await api.resetPassword(token, password);
      setSuccess(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return <p className="text-sm text-red-500 text-center">Invalid or missing reset token.</p>;
  }

  if (success) {
    return (
      <div className="text-center">
        <svg className="mx-auto mb-3 h-10 w-10 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M22 12a10 10 0 11-20 0 10 10 0 0120 0z" /><path d="M8 12l2 2 4-4" /></svg>
        <p className="text-sm font-medium text-gray-900">Password reset successful!</p>
        <p className="mt-1 text-sm text-gray-500">Redirecting to login...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">New Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
          placeholder="Min 8 chars" />
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
        {loading ? "Resetting..." : "Reset Password"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 via-white to-sky-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg ring-1 ring-gray-200">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Set new password</h1>
          <p className="mt-1 text-sm text-gray-500">Choose a new password for your account</p>
        </div>
        <Suspense fallback={<div className="text-center text-sm text-gray-400">Loading...</div>}>
          <ResetForm />
        </Suspense>
        <p className="mt-6 text-center text-sm text-gray-500">
          <Link href="/login" className="font-medium text-sky-600 hover:text-sky-700">Back to Sign In</Link>
        </p>
      </div>
    </div>
  );
}
