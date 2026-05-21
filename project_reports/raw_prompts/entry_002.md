# Raw Prompt — Entry 002

**Agent:** Claude (claude-sonnet-4-6)
**Timestamp:** 2026-04-21 12:28:10 +0530

---

[Security audit results applied — High severity items H-1 through H-5, Medium items M-1 and M-3]

H-1: JWT in localStorage → move to HttpOnly cookies (SameSite=Lax, Secure in prod)
H-2: IDOR on patient routes — any doctor can read/write any patient
H-3: No server-side schema validation — raw JSON accepted by all write endpoints
H-4: No ownership check on observation add/read endpoints
H-5: Admin role check uses wrong JWT claim ("is_admin" vs actual "role")
M-1: Silent refresh interceptor missing — no token auto-renewal
M-3: Flask running in debug mode in production
