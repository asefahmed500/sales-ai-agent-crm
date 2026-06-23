"use client";

import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function PortalProfile() {
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    api.getMe()
      .then((u) => { setUser(u); setName(u.name); })
      .catch(() => {});
  }, []);

  async function handleSave(ev: FormEvent) {
    ev.preventDefault();
    try {
      await api.updateClientProfile({ name });
      setMsg("Profile updated");
      setTimeout(() => setMsg(""), 2500);
    } catch { setMsg("Update failed"); }
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">My Profile</h1>
      {msg && <div className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white shadow-lg">{msg}</div>}
      <div className="max-w-md rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Email</label>
            <input type="email" value={user.email} disabled
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500" />
          </div>
          <button type="submit"
            className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600">
            Save
          </button>
        </form>
      </div>
    </div>
  );
}
