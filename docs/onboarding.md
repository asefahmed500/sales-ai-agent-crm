# Client Onboarding & Email Invitations

## Overview

Enables `OWNER` users to invite external contacts as `CLIENT` users via email. The system generates a secure onboarding link, creates a CLIENT user account with an auto-generated password, and sends invitations via Gmail SMTP.

## Onboarding Route (`/api/onboarding/*`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/onboarding/generate` | JWT + OWNER | Generate invitation link + create CLIENT user |
| GET | `/api/onboarding/verify/:token` | None | Check token validity |
| POST | `/api/onboarding/complete/:token` | None | Complete onboarding (activate user + notify) |

## Invitation Flow

```
OWNER
  │
  ├── POST /api/onboarding/generate
  │   { contactId, companyId }
  │
  ├── Creates CLIENT user (or resets password if exists)
  ├── Generates crypto-random 32-byte hex token
  ├── Creates OnboardingLink record (expires 7 days)
  ├── Sends email via Nodemailer:
  │     "You're invited to join SalesGenius!"
  │     Includes: email, temp password, login URL
  ├── Creates in-app notification
  │
CLIENT
  │
  ├── Opens email → clicks portal URL with token
  ├── Gets /api/onboarding/verify/:token
  │     → { valid: true, contact: { name, email }, company: { name } }
  │
  ├── User logs in with temp password
  ├── (OR) Completes registration via token
  │
  ├── POST /api/onboarding/complete/:token
  │     → Marks link USED
  │     → Updates contact stage to WON
  │     → Activates user account
  │     → Notifies all OWNER users in tenant
  │     → Sends "onboarding complete" email to OWNER
```

## Generate Link (`generateLink`)

```
generateLink(req)
├── req.user.tenantId
├── Find contact + company within tenant
├── Check if user exists by contact.email
│   ├── Exists → update password + reactivate
│   └── Doesn't exist → create new CLIENT user
│       { email, password: hashed, name, role: 'CLIENT', contactId, tenantId }
├── generatePassword()
│   → 1 upper + 1 lower + 1 digit + 5 mixed = 8 chars, shuffled
├── crypto.randomBytes(32).toString('hex') → token
├── prisma.onboardingLink.create({ token, expiresAt: 7d, tenantId, contactId, companyId })
├── sendInvitationEmail(contact.email, contact.name, portalUrl, companyName, tempPassword)
├── notify(ownerId, 'invitation_sent', 'Invitation Sent', ...)
└── Return { ...link, portalUrl, credentials: { email, password: tempPassword } }
```

### Email Template (with temp password)

```
Hello {name},

You have been invited to join {companyName} on SalesGenius.

Your login credentials:
Email: {email}
Password: {tempPassword}

Login at: {FRONTEND_URL}/portal/login

You can also use this link to set your own password:
{portalUrl}
```

### Email Template (without temp password, fallback)

```
Hello {name},

You have been invited to join {companyName} on SalesGenius.

Click the link below to complete your onboarding:
{portalUrl}

This link expires in 7 days.
```

## Verify Token

```
verifyToken(req)
├── Find OnboardingLink by token (include contact + company)
├── Not found → 404
├── status !== 'PENDING' → 400 "Link already {status}"
├── expiresAt < now → 400 "Link expired"
└── Return { valid: true, contact: { name, email }, company: { name } }
```

Used by the portal registration page to display a welcome screen with the contact/company name before the user sets their credentials.

## Complete Onboarding

```
completeOnboarding(req)
├── Find OnboardingLink by token
├── Not found → 404 | Expired → 400 | Already used → 400
├── Mark link: status = 'USED', usedAt = now
├── Update contact: stage = 'WON'
├── Activate user: user.updateMany({ where: { email: contact.email }, data: { isActive: true } })
├── Notify all OWNER users in tenant
├── sendOnboardedNotificationEmail(owner.email, owner.name, contact.name, company.name)
└── Return { success: true, contactId, companyId }
```

## Frontend Onboarding Pages

| Page | Path | Purpose |
|------|------|---------|
| `/portal/register?token=...` | `portal/register/page.tsx` | Shows welcome screen, verifies token, allows user to complete onboarding |
| `/portal/login` | `portal/login/page.tsx` | Login form with email/password for CLIENT users |

## Email Service (`src/services/email.service.ts`)

### Gmail SMTP Configuration

```
host: smtp.gmail.com
port: 465
auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD }
```

Requires a Gmail App Password (not regular password). If credentials are missing, all send operations log a warning and return `false`.

### Email Functions

| Function | Purpose | Trigger |
|----------|---------|---------|
| `sendInvitationEmail` | Sends onboarding invitation | `POST /api/onboarding/generate` |
| `sendPasswordResetEmail` | Sends password reset link | `POST /api/auth/forgot-password` |
| `sendOnboardedNotificationEmail` | Notifies admin of completed onboarding | `POST /api/onboarding/complete/:token` |

## Related Admin Routes

The `OWNER` can view onboarding links via CRM:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/crm/onboarding-links` | List all onboarding links for tenant (paginated, includes contact + company) |
