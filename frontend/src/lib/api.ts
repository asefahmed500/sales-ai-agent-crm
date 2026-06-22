const BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
export const backendUrl = BASE;

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("sg_token") : null;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...opts, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// --- Auth ---
export function login(email: string, password: string) {
  return request<{ token: string; user: { id: string; email: string; name: string; role: string } }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function register(email: string, password: string, name: string, companyName?: string) {
  return request<{ token: string; user: { id: string; email: string; name: string; role: string } }>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, name, companyName }),
  });
}

export function forgotPassword(email: string) {
  return request<{ success: boolean; message: string }>("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function resetPassword(token: string, password: string) {
  return request<{ success: boolean; message: string }>("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, password }),
  });
}

export function getCrmDashboard() {
  return request<import("./types").AdminDashboard>("/api/crm/dashboard");
}

export function getMe() {
  return request<{ id: string; email: string; name: string; role: string; contactId?: string }>("/api/auth/me");
}

// --- CRM ---
export function getCrmContacts(params?: { page?: number; search?: string; stage?: string }) {
  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.search) q.set("search", params.search);
  if (params?.stage) q.set("stage", params.stage);
  return request<import("./types").PaginatedResponse<import("./types").Contact>>(`/api/crm/contacts?${q}`);
}

export function createContact(data: Partial<import("./types").Contact> & { companyId?: string }) {
  return request<import("./types").Contact>("/api/crm/contacts", { method: "POST", body: JSON.stringify(data) });
}

export function updateContact(id: string, data: Partial<import("./types").Contact>) {
  return request<import("./types").Contact>(`/api/crm/contacts/${id}`, { method: "PUT", body: JSON.stringify(data) });
}

export function deleteContact(id: string) {
  return request<{ success: boolean }>(`/api/crm/contacts/${id}`, { method: "DELETE" });
}

export function getCrmCompanies(params?: { page?: number; search?: string }) {
  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.search) q.set("search", params.search);
  return request<import("./types").PaginatedResponse<import("./types").Company>>(`/api/crm/companies?${q}`);
}

export function createCompany(data: Partial<import("./types").Company>) {
  return request<import("./types").Company>("/api/crm/companies", { method: "POST", body: JSON.stringify(data) });
}

export function getCrmDeals(params?: { page?: number; stage?: string; status?: string }) {
  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.stage) q.set("stage", params.stage);
  if (params?.status) q.set("status", params.status);
  return request<import("./types").PaginatedResponse<import("./types").Deal>>(`/api/crm/deals?${q}`);
}

export function createDeal(data: Partial<import("./types").Deal>) {
  return request<import("./types").Deal>("/api/crm/deals", { method: "POST", body: JSON.stringify(data) });
}

export function updateDeal(id: string, data: Partial<import("./types").Deal>) {
  return request<import("./types").Deal>(`/api/crm/deals/${id}`, { method: "PUT", body: JSON.stringify(data) });
}

export function getPipeline() {
  return request<Record<string, import("./types").Deal[]>>("/api/crm/pipeline");
}

export function getDealComments(dealId: string) {
  return request<import("./types").Interaction[]>(`/api/crm/deals/${dealId}/comments`);
}

export function addDealComment(dealId: string, content: string) {
  return request<import("./types").Interaction>(`/api/crm/deals/${dealId}/comments`, { method: "POST", body: JSON.stringify({ content }) });
}

export function getCrmTickets(params?: { page?: number; status?: string }) {
  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.status) q.set("status", params.status);
  return request<import("./types").PaginatedResponse<import("./types").Ticket>>(`/api/crm/tickets?${q}`);
}

export function updateTicket(id: string, data: Partial<import("./types").Ticket>) {
  return request<import("./types").Ticket>(`/api/crm/tickets/${id}`, { method: "PUT", body: JSON.stringify(data) });
}

export function getCrmUsers() {
  return request<{ id: string; email: string; name: string; role: string; isActive: boolean; createdAt: string }[]>("/api/crm/users");
}

export function updateUser(id: string, data: { name?: string; email?: string; role?: string; isActive?: boolean }) {
  return request<{ id: string; email: string; name: string; role: string; isActive: boolean }>(`/api/crm/users/${id}`, {
    method: "PUT", body: JSON.stringify(data),
  });
}

export function deleteUser(id: string) {
  return request<{ success: boolean }>(`/api/crm/users/${id}`, { method: "DELETE" });
}

export function sendNotification(userId: string, title: string, message: string, link?: string) {
  return request<{ success: boolean }>("/api/crm/notifications/send", {
    method: "POST", body: JSON.stringify({ userId, title, message, link }),
  });
}

export function getAgentTasks() {
  return request<import("./types").AgentTask[]>("/api/crm/agent-tasks");
}

export function createAgentTask(data: Partial<import("./types").AgentTask>) {
  return request<import("./types").AgentTask>("/api/crm/agent-tasks", { method: "POST", body: JSON.stringify(data) });
}

export function getOnboardingLinks() {
  return request<import("./types").OnboardingLink[]>("/api/crm/onboarding-links");
}

// --- Onboarding ---
export function generateOnboardingLink(contactId: string, companyId: string) {
  return request<import("./types").OnboardingLink & { credentials?: { email: string; password: string } }>("/api/onboarding/generate", {
    method: "POST",
    body: JSON.stringify({ contactId, companyId }),
  });
}

export function verifyOnboardingToken(token: string) {
  return request<{ valid: boolean; contact: { name: string; email: string }; company: { name: string } }>(`/api/onboarding/verify/${token}`);
}

export function completeOnboarding(token: string) {
  return request<{ success: boolean }>(`/api/onboarding/complete/${token}`, { method: "POST" });
}

// --- Client Portal ---
export function getClientDeals() {
  return request<import("./types").Deal[]>("/api/client/deals");
}

export function createClientDeal(data: { name: string; amount: number; notes?: string }) {
  return request<import("./types").Deal>("/api/client/deals", { method: "POST", body: JSON.stringify(data) });
}

export function getClientDealComments(dealId: string) {
  return request<import("./types").Interaction[]>(`/api/client/deals/${dealId}/comments`);
}

export function addClientDealComment(dealId: string, content: string) {
  return request<import("./types").Interaction>(`/api/client/deals/${dealId}/comments`, { method: "POST", body: JSON.stringify({ content }) });
}

export function getClientTickets() {
  return request<import("./types").Ticket[]>("/api/client/tickets");
}

export function createClientTicket(data: { subject: string; description: string; priority?: string; category?: string }) {
  return request<import("./types").Ticket>("/api/client/tickets", { method: "POST", body: JSON.stringify(data) });
}

export function getClientInteractions() {
  return request<{ id: string; channel: string; content: string; createdAt: string }[]>("/api/client/interactions");
}

export function updateClientProfile(data: Record<string, unknown>) {
  return request<{ success: boolean }>("/api/client/profile", { method: "PUT", body: JSON.stringify(data) });
}

// --- Agent Chat ---
export function getAgents() {
  return request<import("./types").AgentDef[]>("/api/agents");
}

export function getPipelineSummary() {
  return request<import("./types").Pipeline>("/api/pipeline");
}

export function sendChatMessage(sessionId: string, message: string, agent?: string, contactId?: string) {
  return request<{ status: string; sessionId: string }>("/api/agent/chat", {
    method: "POST",
    body: JSON.stringify({ sessionId, message, agent, contactId }),
  });
}

export function agentSessionId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function getContacts() {
  return request<import("./types").Contact[]>("/api/contacts");
}

export function getPipelineData() {
  return request<import("./types").Pipeline>("/api/pipeline");
}

export const api = {
  backendUrl: BASE,
  login,
  register,
  forgotPassword,
  resetPassword,
  getMe,
  getCrmDashboard,
  getCrmContacts,
  createContact,
  updateContact,
  deleteContact,
  getCrmCompanies,
  createCompany,
  getCrmDeals,
  createDeal,
  updateDeal,
  getPipeline,
  getDealComments,
  addDealComment,
  getCrmTickets,
  updateTicket,
  getCrmUsers,
  updateUser,
  deleteUser,
  sendNotification,
  getAgentTasks,
  createAgentTask,
  getOnboardingLinks,
  generateOnboardingLink,
  verifyOnboardingToken,
  completeOnboarding,
  getClientDeals,
  createClientDeal,
  getClientDealComments,
  addClientDealComment,
  getClientTickets,
  createClientTicket,
  getClientInteractions,
  updateClientProfile,
  agents: getAgents,
  contacts: getContacts,
  pipeline: getPipelineData,
  sendChatMessage,
  agentSessionId,
  getPipelineSummary,
  uploadDocument: (data: FormData) =>
    request<any>("/api/documents/upload", { method: "POST", body: data, headers: {} }),
  getMyDocuments: () =>
    request<any[]>("/api/documents/mine"),
  getDocumentReviews: () =>
    request<any[]>("/api/documents"),
  reviewDocument: (id: string, data: { status: string; comment?: string }) =>
    request<any>(`/api/documents/${id}/review`, { method: "PUT", body: JSON.stringify(data) }),
  getDocumentComments: (id: string) =>
    request<any[]>(`/api/documents/${id}/comments`),
};
