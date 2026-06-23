# Authentication & Authorization

## Overview

JWT-based authentication with two roles (`OWNER` / `CLIENT`). Tokens expire in 7 days. Every authenticated request re-checks the database for `isActive`. No OAuth providers — email/password only.

## Flow

```
Frontend                    Backend
   │                          │
   │  POST /api/auth/login    │
   │  { email, password }     │
   │─────────────────────────>│
   │                          │  bcrypt.compare(password, hash)
   │                          │  jwt.sign({ id, email, name, role, tenantId })
   │  { token, user }         │
   │<─────────────────────────│
   │                          │
   │  localStorage("sg_token")│  ← stores token
   │                          │
   │  GET /api/auth/me        │
   │  Authorization: Bearer   │
   │─────────────────────────>│
   │                          │  jwt.verify → prisma.user.findUnique → check isActive
   │  { id, email, name, ... }│
   │<─────────────────────────│
```

## Auth Middleware (`src/middleware/auth.ts`)

Three exports:

### `generateToken(user: AuthUser): string`
Signs JWT with `{ id, email, name, role, tenantId }`, expires 7 days.

### `authMiddleware`
- Reads `Authorization: Bearer <token>` header
- Verifies JWT with `env.JWT_SECRET`
- Looks up user from DB by `decoded.id` (re-checks every request)
- Returns 401 if not found or `isActive === false`
- Attaches `req.user` with `{ id, email, name, role, tenantId }`

### `requireRole(...roles: string[])`
Returns middleware that checks `req.user.role` is in the allowed list. Returns 403 if not.

## Auth Routes (`/api/auth/*`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/login` | None | Login with email + password |
| POST | `/api/auth/register` | None | Register (creates Tenant + OWNER user) |
| GET | `/api/auth/me` | JWT | Get current user profile |
| POST | `/api/auth/forgot-password` | None | Send password reset email |
| POST | `/api/auth/reset-password` | None | Reset password with JWT token |

## Login (`auth.controller.ts`)

```
login(req)
├── Validate email + password present
├── prisma.user.findUnique({ where: { email } })
├── !user → 401 "Invalid credentials"
├── !user.isActive → 403 "Account is disabled"
├── bcrypt.compare(password, user.password) → !match → 401
├── generateToken(user) → token
└── Return { token, user: { id, email, name, role, tenantId } }
```

## Register

```
register(req)
├── Validate email, password, name
├── prisma.user.findUnique → exists → 409 "Email already registered"
├── bcrypt.hash(password, 10)
├── prisma.tenant.create({ name: companyName || "My Company" })
├── prisma.user.create({ role: "OWNER", tenantId })
├── generateToken(user) → token
└── Return { token, user }
```

Registration is the only way to create a `Tenant`. After registration, the `OWNER` user can invite `CLIENT` users via the onboarding flow.

## Me (`/api/auth/me`)

```
me(req)
├── prisma.user.findUnique({ where: { id: req.user.id } })
├── Select: id, email, name, role, tenantId, contactId, createdAt
└── Return user (or null if not found — frontend handles as any)
```

**Note:** `contactId` is included in the response. The frontend casts the return type as `any` because the backend `User` model has fields not in `DashboardUser` type.

## Forgot Password

```
forgotPassword(req)
├── Validate email
├── prisma.user.findUnique → if not found, return same message (security)
├── jwt.sign({ id, purpose: 'password-reset' }, JWT_SECRET, 1h)
├── sendPasswordResetEmail(user.email, user.name, resetUrl)
└── Return { success: true, message: "If the email exists, reset instructions have been sent." }
```

Reset URL format: `{FRONTEND_URL}/reset-password?token={jwt}`

## Reset Password

```
resetPassword(req)
├── Validate token + password (min 8 chars)
├── jwt.verify(token, JWT_SECRET) → { id, purpose }
├── Validate purpose === 'password-reset'
├── bcrypt.hash(password, 10)
├── prisma.user.update({ where: { id }, data: { password } })
└── Return { success: true }
```

## Role-Based Route Guards

### Frontend Role Redirects

- **`/dashboard/*` layout**: If `u.role !== "OWNER"` → redirect to `/portal/login`
- **`/portal/*` layout**: If `u.role !== "CLIENT"` → redirect to `/dashboard`
- **`/login` page**: If CLIENT → redirect to `/portal`
- **Portal no-auth routes**: `["/portal/login", "/portal/register"]` skip auth checks

### Backend Role Guards

```
/api/crm/*       → authMiddleware + requireRole('OWNER')
/api/client/*    → authMiddleware + requireRole('CLIENT')
/api/documents/* → Mixed (OWNER: list/review, CLIENT: upload/mine)
```

## JWT Payload

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "User Name",
  "role": "OWNER",
  "tenantId": "uuid",
  "iat": 1234567890,
  "exp": 1234567890
}
```

## Token Storage

- Frontend stores JWT in `localStorage` key `"sg_token"`
- Retrieved in `api.ts` on every request:
  ```ts
  const token = typeof window !== "undefined" ? localStorage.getItem("sg_token") : null;
  if (token) headers.Authorization = `Bearer ${token}`;
  ```
- Token removal on 401 response clears auth state and redirects to login

## Error Responses

| Status | Error | When |
|--------|-------|------|
| 400 | Validation error | Missing/invalid fields |
| 401 | "Invalid credentials" / "Invalid or expired token" | Bad login / bad JWT |
| 403 | "Account is disabled" | User.isActive === false |
| 409 | "Email already registered" | Duplicate email on register |
