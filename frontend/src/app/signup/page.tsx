"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api as apiFuncs } from "@/lib/api";

interface FieldErrors {
  name?: string;
  email?: string;
  password?: string;
  confirm?: string;
  companyName?: string;
}

function validateName(v: string): string | null {
  if (!v) return "Full name is required";
  if (v.length < 2) return "Name must be at least 2 characters";
  return null;
}

function validateEmail(v: string): string | null {
  if (!v) return "Email is required";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "Invalid email format";
  return null;
}

function validatePassword(v: string): string | null {
  if (!v) return "Password is required";
  if (v.length < 8) return "Must be at least 8 characters";
  if (!/[A-Z]/.test(v)) return "Must contain an uppercase letter";
  if (!/[a-z]/.test(v)) return "Must contain a lowercase letter";
  if (!/[0-9]/.test(v)) return "Must contain a number";
  return null;
}

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");

  function validate(): FieldErrors {
    const e: FieldErrors = {};
    const ne = validateName(name);
    if (ne) e.name = ne;
    const ee = validateEmail(email);
    if (ee) e.email = ee;
    const pe = validatePassword(password);
    if (pe) e.password = pe;
    if (!confirm) e.confirm = "Please confirm your password";
    else if (confirm !== password) e.confirm = "Passwords do not match";
    const ce = validateName(companyName);
    if (ce) e.companyName = ce || "Company name is required";
    if (!companyName || companyName.length < 2) e.companyName = "Company name must be at least 2 characters";
    return e;
  }

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    setApiError("");
    const v = validate();
    setErrors(v);
    if (Object.keys(v).length > 0) return;

    setLoading(true);
    try {
      const res = await apiFuncs.register(email, password, name, companyName);
      localStorage.setItem("sg_token", res.token);
      router.push("/dashboard");
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 via-white to-sky-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg ring-1 ring-gray-200">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Create your account</h1>
          <p className="mt-1 text-sm text-gray-500">
            Start your SalesGenius journey
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <Field label="Full Name" error={errors.name}>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              placeholder="John Doe"
            />
          </Field>

          <Field label="Email" error={errors.email}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              placeholder="john@company.com"
            />
          </Field>

          <Field label="Password" error={errors.password}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              placeholder="Min 8 chars, upper, lower, number"
            />
          </Field>

          <Field label="Confirm Password" error={errors.confirm}>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              placeholder="Repeat your password"
            />
          </Field>

          <Field label="Company Name" error={errors.companyName}>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              placeholder="Acme Inc."
            />
          </Field>

          {apiError && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {apiError}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25" />
                  <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                </svg>
                Creating account...
              </span>
            ) : (
              "Create Account"
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-sky-600 hover:text-sky-700">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
