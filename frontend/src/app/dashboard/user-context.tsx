"use client";

import { createContext, useContext } from "react";

export interface DashboardUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

const UserCtx = createContext<DashboardUser | null>(null);

export const useDashboardUser = () => useContext(UserCtx);

export default UserCtx;
