# Shared Contracts — Nolyvra Nexus ↔ Nolyvra ATS

This document is the single source of truth for every contract crossing the boundary
between Nexus and the Nolyvra ATS. **Nexus and the ATS never share a database** — every
interaction goes through one of the two channels below. Update this file in the same step
that changes a contract; don't let it drift from the code.

Status: **v0.8 — search results now include `avatarUrl`, `linkedinUrl`, and `email`**
(2026-07-26, Sayan-directed reversal of the original "no email/phone" non-negotiable,
scoped to email/avatarUrl/linkedinUrl only — phone remains fully gated). See "Post-sprint
change (v0.8)" below for full detail. Carries forward v0.6 — three fixes from real
ATS-side integration usage (recruiter read access to messages, a working
`nexusProfileUrl`, and a phone-reveal 403 root-caused and hardened against; see
"Post-sprint ATS integration fixes" below) — and v0.5, Steps 2-5 implemented and
Step 7-reviewed; the Nolyvra↔Nexus Integration sprint (NEXUS side) is otherwise complete
through Step 6.
Extends v0.4 (Search API / Step 8, Messaging & Consent / Step 9, both already implemented)
with: an `identityToken` cross-system dedup key, richer search results (`matchScore`,
`credibilityScore`, `tier`, `employerPreferences[]`, `pipelineActivity`, `nexusProfileUrl`),
inbound pipeline-activity events, and an actual outbound delivery mechanism for the
events Nexus already writes to its outbox. Deliberately **not** adopted from the sprint
prompt's draft: a parallel `/api/integration/**` namespace (existing, tested `/api/v1/**`
endpoints are extended in place instead) and a `consent.revoked` event (the v0.4 decision
to omit it stands — see Channel 2).

**Steps 2-6 (v0.5, unchanged in v0.6):** service-token auth renamed to
`nolyvra.integration.service-token` / `X-Nolyvra-Service-Token`, `SecurityConfig`'s
`SERVICE_ONLY_PATHS` restricting `/api/v1/search/**`, `/api/v1/messaging/**`,
`/api/v1/consent/**`, `/api/v1/integration/**` to `ROLE_SERVICE`; `WebhookSignatureFilter`
(HMAC, scoped to `/api/v1/integration/**`); `POST /api/v1/integration/events` durably
recording every event exactly once (dedupe by `eventId`); search response carries real
`identityToken`, `matchScore` (renamed from `skillScore`), `credibilityScore`/`tier`,
`employerPreferences[]`; pipeline-activity events resolve `identityToken` back to a
candidate and apply to a current-state `pipeline_membership` row, surfaced in
`pipelineActivity`, a `SearchService.rank()` bonus, and
`GET /api/v1/candidates/me/pipeline-activity`; `WebhookDispatcher` (`@Scheduled` every
15s) delivers `message.received`/`consent.granted`/`endorsement.completed` from
`outbox_event`, HMAC-signed, with exponential-then-steady retry/backoff. Step 7's full
review (all non-negotiables re-verified live, not just re-asserted) passed clean — see
the table near the bottom of this document.

---

## Post-sprint change: avatarUrl/linkedinUrl/email added to search results (v0.8)

This was Sayan's own request, not a bug report — he asked for `avatarUrl`, `linkedinUrl`,
and raw `email` to be added to `POST /api/v1/search/candidates`'s response, live during
ATS-side testing (2026-07-26).

Investigation found: `avatarUrl` was already effectively public via the v0.6 public
profile link (`GET /api/v1/public/candidates/{candidateId}/profile`), so adding it to the
search response too is not a new exposure. `linkedinUrl` and `email` were **not** already
exposed anywhere — email in particular directly contradicts the sprint's original,
twice-reviewed non-negotiable ("no email, no phone, in this response or any other
search/profile response," reaffirmed clean in the Step 7 review below). This was surfaced
to Sayan rather than implemented silently; his explicit choice was to add all three,
including raw email, deliberately overriding that non-negotiable.

**Scope of the reversal — read carefully:**
- `avatarUrl`, `linkedinUrl`, `email` are now included on every result from
  `POST /api/v1/search/candidates`. No migration needed — all three are pre-existing
  candidate columns, just newly surfaced in this response.
- **Phone is explicitly excluded from this change.** It remains fully gated behind the
  consent + phone-reveal flow (`POST /api/v1/consent/requests` /
  `POST /api/v1/consent/phone-reveal`), never cached, never appears in any search or
  profile response. This reversal touches email only.
- The public profile endpoint (`GET /api/v1/public/candidates/{candidateId}/profile`)
  is unaffected — it still returns no email, no phone, no per-skill evidence detail (see
  its response shape below). The email exposure is scoped specifically to the
  authenticated, service-token-gated search endpoint, not the public link.

See the field notes under `POST /api/v1/search/candidates` below for the updated response
shape. The Step 7 review table further down is left as a historical record (accurate at
the time it was written) rather than rewritten — see the note directly above that table.

---

## Post-sprint ATS integration fixes (v0.6)

Three issues raised from real ATS-side integration usage, all addressed in the same change:

**1. Recruiter read access to messages.** The ATS had write access
(`POST /api/v1/messaging/threads`) but no way to list a recruiter's threads or read
message content for its own Messages tab — `message.received` carries no body, and the
candidate-JWT read endpoints aren't reachable with a service token. Added
`GET /api/v1/messaging/threads?recruiterRef=` and
`GET /api/v1/messaging/threads/{threadId}/messages?recruiterRef=` (see Channel 1 below).
**Decision on the privacy-posture question asked**: message content is freely readable
once a thread exists — **not** gated the way phone-reveal is, and not live-check-only.
Reasoning: the recruiter is a direct party to the conversation (they sent the first
message; a Messages tab is just their own copy of a conversation they're already in),
unlike a phone number, which is the candidate's separate, explicitly-gated information
the recruiter has no independent claim to. There's also no revocation concept for
messages the way there is for consent, so the "never cache, always re-check" pattern
doesn't map onto this case the way it does for phone numbers.

**2. `nexusProfileUrl` didn't work — fixed with a signed, time-limited token.**
Recruiters have no Nexus account, so the URL always dead-ended at a login redirect (found
live, not caught during the original Step 3 verification, which only checked the URL
string was constructed correctly, never that the target page existed). Considered and
rejected building a fully public, permanent, unauthenticated profile page — that would
have reversed a deliberate decision from the original build (visible in
`PublicProfile.jsx`'s own committed code: *"There's no public, unauthenticated version of
this page yet... contact happens through the consent-gated flow, never a direct button
on a public page"*). Instead, `nexusProfileUrl` now carries a short-lived (48h default,
`JWT_PROFILE_VIEW_TTL_HOURS` env var) signed JWT scoped to exactly one candidateId,
resolved by a new, genuinely public endpoint. A stale/expired link simply stops working
(`410`) rather than silently degrading — the ATS should treat this the same way as the
existing single-use endorsement links: generate a fresh search call to get a current
link rather than persisting `nexusProfileUrl` long-term.

**3. Phone-reveal 403 despite an active grant — root-caused and hardened.** Re-read every
line of the matching code (`ConsentService`, `ConsentGrant`, `ConsentRequest`) and
live-reproduced the exact reported flow — `recruiterRef`/`tenantRef` both set to the same
value, `POST /consent/requests` → candidate accepts → `POST /consent/phone-reveal` with
the identical triple — and it succeeded (`200`) every time on Nexus's current code. **No
bug found in the matching logic itself.** The most plausible real-world cause: the match
was (and remains) an exact string comparison on `recruiterRef`/`tenantRef`, so a stray
leading/trailing space, or an empty string `""` sent on one call where another call
omitted the field entirely (binds to `null`), would silently fail the lookup with a `403`
that gives no hint why. **Hardened against this class of bug regardless of root cause**:
`recruiterRef`/`tenantRef` are now trimmed, and a blank/empty `tenantRef` is normalized to
`null`, consistently at every write (`POST /consent/requests`) and read
(`POST /consent/phone-reveal`) boundary. If this wasn't the actual cause, the ATS-side
request/response logs for the specific candidate are the next thing to compare
field-for-field.

---

## Shared config / secrets

All via env vars, never committed. Nexus-side property names follow the codebase's
existing `nolyvra.<subsystem>.<key>` → `NOLYVRA_<SUBSYSTEM>_<KEY>` convention; the
Nolyvra ATS repo is free to name its own properties however fits its own conventions —
only the **values** need to match where noted.

| Purpose | Nexus property | Nexus env var | Notes |
|---|---|---|---|
| ATS→Nexus shared-secret auth (search, messaging, consent, integration events) | `nolyvra.integration.service-token` | `NOLYVRA_INTEGRATION_SERVICE_TOKEN` | `X-Nolyvra-Service-Token` header, `ServiceTokenAuthenticationFilter`. |
| Where Nexus POSTs its outbound events | `nolyvra.webhook.url` | `NOLYVRA_WEBHOOK_URL` | The ATS's inbound webhook receiver URL. |
| HMAC signing secret, both directions | `nolyvra.webhook.signing-secret` | `NOLYVRA_WEBHOOK_SIGNING_SECRET` | Must be the identical **value** on both sides. |
| Identity-token derivation secret | `nolyvra.identity.token-secret` | `NOLYVRA_IDENTITY_TOKEN_SECRET` | Must be the identical **value** on both sides — dedup silently stops working with no error if these ever diverge. |
| Nexus candidate-profile base URL (for `nexusProfileUrl`) | `nolyvra.frontend.public-url` | `NEXUS_FRONTEND_URL` | e.g. `https://nexus.nolyvra.com`. |
| Nexus API base URL | — (not read by Nexus itself) | `NEXUS_BASE_URL` | Consumed by the ATS to know where to call Nexus. |
| Public profile link TTL (v0.6) | — | `JWT_PROFILE_VIEW_TTL_HOURS` | Default 48h. Not a shared-value secret — purely a Nexus-side config, the ATS never reads or needs this. |

**Not adopted from the sprint prompt's draft names:** `INTEGRATION_CLIENT_ID` /
`INTEGRATION_CLIENT_SECRET` / `WEBHOOK_SIGNING_SECRET` (bare, unprefixed) — the existing
shared-secret scheme already covers Nolyvra↔Nexus auth; no real OAuth2 authorization
server exists yet to justify a client-credentials shape (open item, unchanged).

---

## Identity token

`identityToken = HMAC-SHA256(lowercase(trim(email)), NOLYVRA_IDENTITY_TOKEN_SECRET)`,
hex-encoded. Lets the ATS dedupe/interleave its own ATS-side candidates against Nexus
search results **without raw email ever crossing the wire**. Nexus computes it from a
candidate's **verified** email only — an unverified email never produces a token that
appears in any response. Additive, not a replacement for `candidateId` (the Nexus-internal
UUID), which remains the key for every follow-up call (messaging, consent).

---

## Channel 1 — Synchronous search API (ATS → Nexus)

**Auth:** `X-Nolyvra-Service-Token` header checked against `nolyvra.integration.service-token`.

### `POST /api/v1/search/candidates` (Nexus, called by ATS)

Request — unchanged from v0.4: `jdText`, `skills`, `minVerificationTier`, `location`,
`remunerationBudget`, `employerType`, `tenantRef`, `page`, `pageSize`.

Response:

```json
{
  "results": [
    {
      "candidateId": "uuid",
      "identityToken": "hex string — see Identity token above",
      "displayName": "string",
      "title": "string",
      "location": "string",
      "matchScore": 0,
      "credibilityScore": 0,
      "tier": "SELF_DECLARED|AI_INFERRED|PLATFORM_VERIFIED|HUMAN_ENDORSED",
      "topSkills": [{ "skill": "string", "score": 0, "tier": "SELF_DECLARED|AI_INFERRED|PLATFORM_VERIFIED|HUMAN_ENDORSED" }],
      "employerPreferences": ["BIG_4|STARTUP|SCALE_UP|LARGE_FINANCIAL|GOVERNMENT|AGENCY|BIG_TECH|NON_PROFIT", "..."],
      "employerPreferenceMatch": "boolean",
      "remunerationFlag": "WITHIN_BUDGET | OVER_BUDGET | NOT_DISCLOSED",
      "pipelineActivity": { "pipelines": 0, "interviewing": 0, "shortlisted": 0 },
      "nexusProfileUrl": "string — short-lived signed link, see 'Public profile link' below",
      "avatarUrl": "string, nullable (v0.8)",
      "linkedinUrl": "string, nullable (v0.8)",
      "email": "string, nullable (v0.8) — see 'Post-sprint change (v0.8)' above"
    }
  ],
  "scoreBreakdownRef": "uuid"
}
```

Field notes:

- **`matchScore`** — fully blended 0–100 ranking total (skill match + employer-preference
  + availability + pipeline-activity + text relevance), not skill-only.
- **`credibilityScore`** — average of `topSkills[].score` for this query's matched skills.
  **`tier`** — highest verification tier among those same matched skills.
- **`employerPreferences[]`** — the candidate's full declared preference list.
- **`pipelineActivity`** — derived at read time from `pipeline_membership`. `{0,0,0}` for
  no recorded activity. Counts only, never a tenant/company identity.
- **`nexusProfileUrl`** — built from `nolyvra.frontend.public-url` + `candidateId` + a
  short-lived signed token (v0.6). **Treat as ephemeral, not a stable permalink** — a
  fresh search call gets a fresh, working link.
- **`avatarUrl`, `linkedinUrl`, `email` (v0.8)** — see "Post-sprint change (v0.8)" above
  for the full reasoning and scope. Nullable if the candidate has none on file / an
  unverified email.
- **No phone**, in this response or any other search/profile response — unaffected by
  the v0.8 change above, still fully gated behind consent + phone-reveal.

### Public profile link (`nexusProfileUrl`, v0.6)

`nexusProfileUrl` resolves to `GET /api/v1/public/candidates/{candidateId}/profile?token=`
— genuinely public, no auth of any kind (recruiters have no Nexus account). The `token`
query param is a signed JWT scoped to exactly that `candidateId`, default TTL 48h
(`JWT_PROFILE_VIEW_TTL_HOURS`). A mismatched, malformed, or expired token, or a candidate
who has since opted out of search (`searchable=false`), both fail the same way (`410`/`404`)
— don't infer which from the status code, same as the endorsement link pattern this mirrors.

```json
// GET /api/v1/public/candidates/{candidateId}/profile?token=...  (no auth)
{
  "displayName": "string", "title": "string", "location": "string",
  "avatarUrl": "string", "bio": "string", "yearsExperience": 0,
  "skills": [{ "skillName": "string", "category": "string", "score": 0, "tier": "SELF_DECLARED|AI_INFERRED|PLATFORM_VERIFIED|HUMAN_ENDORSED" }],
  "badgeCount": 0,
  "workExperience": [{ "company": "string", "position": "string", "startDate": "date", "endDate": "date", "currentlyWorking": false, "responsibilities": "string" }],
  "education": [{ "institution": "string", "degree": "string", "fieldOfStudy": "string", "startDate": "date", "endDate": "date", "currentlyStudying": false }]
}
```

No email, no phone, no per-skill evidence detail. Don't persist this link long-term — open
it shortly after the search call that produced it, not as a stable bookmark.

### Messaging & Consent endpoints (`RecruiterBridgeController`)

Base three (send message, request consent, phone-reveal) unchanged from v0.4 except for
the normalization note below. Two new read endpoints added in v0.6.

Auth — `X-Nolyvra-Service-Token`, not candidate JWT.

**`POST /api/v1/messaging/threads`** — send the first or a follow-up message.
Finds-or-creates the thread keyed on `(candidateId, recruiterRef)`.

```json
// Request
{ "candidateId": "uuid", "recruiterRef": "string", "tenantRef": "string, optional", "body": "string" }
// Response — 201
{ "id": "uuid", "sender": "RECRUITER", "body": "string", "sentAt": "instant" }
```

**`POST /api/v1/consent/requests`** — request phone-reveal consent. Idempotent: an
existing `PENDING` request for the same `(candidateId, recruiterRef, scope)` is reused.
Returns 201, no body.

```json
{ "candidateId": "uuid", "recruiterRef": "string", "tenantRef": "string, optional" }
```

**`POST /api/v1/consent/phone-reveal`** — the read-time reveal check. Call every time;
never cache the result.

```json
// Request
{ "candidateId": "uuid", "recruiterRef": "string", "tenantRef": "string, optional" }
// Response — 200
{ "phone": "string" }
// 403 if there is no active (non-revoked) grant for this exact candidate/recruiter/tenant/scope
```

**Matching normalization (v0.6):** `recruiterRef`/`tenantRef` are trimmed, and a
blank/empty `tenantRef` is treated the same as an omitted one (`null`), consistently on
every write (`POST /consent/requests`) and read (`POST /consent/phone-reveal`). Two
different values are still never treated as equal — this only closes the failure mode
where the same logical value arrived with incidental whitespace or inconsistent
blank-vs-omitted handling across two separate calls.

**`GET /api/v1/messaging/threads?recruiterRef=`** (v0.6, `displayName` added
2026-07-26) — every thread for one recruiter, across all candidates. The Messages
tab's list view.

```json
// Response — 200
[{ "id": "uuid", "candidateId": "uuid", "createdAt": "instant", "displayName": "string, nullable" }]
```

`displayName` — sourced from `Candidate.getFullName()`, same source as the search
response's `displayName`; batch-fetched so listing threads stays one query regardless
of thread count (no N+1). **Not** added to the thread-messages endpoint below — one
name per thread, not repeated per message.

**`GET /api/v1/messaging/threads/{threadId}/messages?recruiterRef=`** (v0.6) — full
message history for one thread. 404 if the thread belongs to a different `recruiterRef`
than the one supplied, same as an unknown `threadId` — no distinguishable error for "this
thread exists but isn't yours." Message content is freely readable this way once a
thread exists — see "Post-sprint ATS integration fixes" above for why this isn't gated
the way phone-reveal is.

```json
// Response — 200
[{ "id": "uuid", "sender": "RECRUITER" | "CANDIDATE", "body": "string", "sentAt": "instant" }]
```

### Public endorsement endpoints (`PublicEndorsementController`)

Unchanged from v0.4. Not part of the ATS integration.

- `GET /api/v1/endorsements/{token}` → `{ "skillsRequested": ["string"] }`, or 410 GONE.
- `POST /api/v1/endorsements/{token}/submit` → `{ "qualified": boolean }`.

---

## Channel 1.5 — Pipeline activity events (ATS → Nexus)

**`POST /api/v1/integration/events`** — two auth layers: `X-Nolyvra-Service-Token` header,
plus `X-Nolyvra-Signature` (hex `HMAC-SHA256(rawRequestBody, NOLYVRA_WEBHOOK_SIGNING_SECRET)`,
verified over exact raw bytes before parsing). Idempotent by `eventId` (ATS-generated UUID).

Payload carries `identityToken`, **never raw email** — the ATS computes it itself.

```json
{
  "eventId": "uuid",
  "eventType": "candidate.added_to_pipeline | candidate.stage_changed | candidate.removed_from_pipeline | candidate.placed",
  "identityToken": "hex string",
  "tenantRef": "string — opaque, anonymised",
  "stage": "string, present only for stage_changed",
  "occurredAt": "instant"
}
```

If `identityToken` matches no Nexus candidate, Nexus acks 200 and drops — expected, not an error.

Aggregate counters reflect current state (a `pipeline_membership(candidateId, tenantRef,
status, stage, updatedAt)` row per pair, derived-at-read-time counts), never a monotonic
increment. Never a tenant/company name in any surfaced aggregate.

---

## Channel 2 — Domain events (Nexus → ATS)

`WebhookDispatcher` (`@Scheduled` every 15s) drains `outbox_event` rows filtered to an
explicit allowlist, HMAC-signed (`X-Nolyvra-Signature`, no service-token header this
direction), POSTed to `NOLYVRA_WEBHOOK_URL`. `eventId` = `outbox_event.id`. Retry/backoff:
exponential 30s/1m/2m/4m/8m, then steady 15-minute cadence indefinitely.

**Deliverable-event allowlist**: `WebhookDispatcher.DELIVERABLE_EVENT_TYPES =
{message.received, consent.granted, endorsement.completed}` — every other event type
(`candidate.registered`, `course.completed`, `evidence.*`/`credential.*`, etc.) is left
untouched. **Never widen that set without updating this document in the same change.**

| Event | Payload | Purpose |
|---|---|---|
| `message.received` | `{ eventId, candidateId, threadId, recruiterRef, occurredAt }` | Candidate replied; body not included — the ATS has an authenticated read path now (v0.6) if it wants content. |
| `consent.granted` | `{ eventId, candidateId, recruiterRef, scope: "phone", occurredAt }` | Excludes the phone number. Can fire immediately after `POST /consent/requests` if `autoSharePhone` is on. |
| `endorsement.completed` | `{ eventId, candidateId, qualified, occurredAt }` | Outcome only. |

**No `consent.revoked` event, and none is planned.** The ATS never caches a revealed
phone number — it calls `POST /api/v1/consent/phone-reveal` every time, which re-checks
the grant live. Revocation just means the next reveal call gets a 403.

---

## HMAC signing scheme (both directions, shared)

- **Algorithm:** HMAC-SHA256. **Header:** `X-Nolyvra-Signature`, hex-encoded (lowercase).
- **Signed content:** exact raw request body bytes — verify before parsing.
- **Secret:** `NOLYVRA_WEBHOOK_SIGNING_SECRET`, identical value both sides.
- **Scope:** required on Channel 1.5 and every outbound Channel 2 delivery. Not required
  on synchronous Channel 1 endpoints (search/messaging/consent) — service-token auth only there.

---

## Step 7 review (v0.5) — all non-negotiables re-verified live

Left as a historical record, accurate as of v0.5 — **the "no email" row below was
deliberately reversed in v0.8** (see "Post-sprint change: avatarUrl/linkedinUrl/email
added to search results (v0.8)" above). Phone is unaffected and this row remains
accurate for phone today.

| Check | Result |
|---|---|
| No email/phone in any search or profile response | **Pass (as of v0.5 — email reversed in v0.8, phone still holds)** |
| Phone retrievable only against an active grant, every reveal logged | **Pass** |
| Append-only ledgers stay append-only | **Pass** |
| Idempotent event consumers | **Pass** (verified live: same `eventId` POSTed 3x, `pipelines: 1` not `3`) |
| Tenant identity never exposed in aggregates | **Pass** |
| All `/api/v1/search\|messaging\|consent\|integration/**` calls authenticated and signature-checked | **Pass** |

---

## Open items (tracked, not yet resolved)

- Real OAuth2 client-credentials for the ATS↔Nexus service call, replacing the
  shared-secret header — no issuer/authorization server exists yet.
- Pipeline-activity stage taxonomy — which ATS stage strings map to "interviewing" vs.
  "shortlisted" vs. neither; still a case-insensitive substring heuristic, not a fixed
  enum. **Note (ATS side):** the ATS's ` NexusPipelineEventPublisher` sends its real
  stage vocabulary (`Screening/Interview/Assessment/Offer/Selected/Rejected`) as-is —
  whether Nexus's heuristic buckets these as intended is still unverified.
- Rate/quota shape for the search API per tenant — edge/gateway infra, out of scope.
- **Resolved (v0.6):** `message.received`'s payload omitting the message body is no
  longer a gap — `GET /api/v1/messaging/threads/{threadId}/messages` gives the ATS an
  authenticated read path whenever it wants content.
- A candidate who verified their email before the `identity_token` column existed and
  has never since appeared in a search result has no `identityToken` yet — the lazy
  backfill only fires on search-result read. Zero real users affected today.
- No dead-letter/alerting after the outbound webhook dispatcher's backoff settles into
  its steady 15-minute cadence.
- The phone-reveal 403 support case (v0.6) was hardened against (trim + blank-`tenantRef`
  normalization) but not conclusively root-caused — if a 403 recurs, compare the ATS's
  own request logs for the specific candidate field-for-field against what Nexus received.
