# Neuro Integration Notes

Findings from sandbox tests (sandbox1.neuro-tech.io).

## Authentication
- `POST /Agent/Account/Login` with `userName`, `nonce`, `signature`, `seconds`
- Signature: `Base64(HMAC-SHA256(key = accountPassword, data = userName:host:nonce))`
- Response returns `jwt` and `expires`; send JWT as `Authorization: Bearer <jwt>`
- Send a `Referer` header on every request

## Legal identities
- `POST /Agent/Legal/GetIdentities` returns `Identities`
- Approval check: `status.state === "Approved"` and current date within `status.from` / `status.to`
- Organisation identities include `ORG*` properties (for example `ORGNR`)
- Store only the identity id, state and validity dates; do not copy personal properties

## Contracts
- Templates must use `visibility="Public"`; private templates return 403 on `CreateContract`
- `ProposeTemplate` takes `templateBase64`; sandbox approval is asynchronous (around 15 seconds)
- `CreateContract` accepts only `templateId`, `visibility`, `Parts`, `Parameters`; no signature fields
- `SignContract` signature:
  - `s1 = userName:host:localName:namespace:keyId`
  - `keySignature = Base64(HMAC-SHA256(key = keyPassword, data = s1))`
  - `s2 = s1:keySignature:nonce:legalId:contractId:role`
  - `requestSignature = Base64(HMAC-SHA256(key = accountPassword, data = s2))`
  - nonce: 32 random bytes, base64
- Signing is asynchronous; poll `GetContract` until `status.state === "Signed"`
- A role cannot be signed more times than its `maxCount` (returns 403)

## Contract states
- Template: `Proposed` -> `Approved`
- Instance: `Approved` -> `BeingSigned` (some roles signed) -> `Signed` (all roles signed)
- Poll for the target state instead of waiting for a state to change; intermediate states are skipped or observed depending on timing
