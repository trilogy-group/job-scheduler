## ADDED Requirements

### Requirement: API key issuance

The system SHALL allow an operator to issue API keys bound to a user, returning the plaintext key exactly once.

#### Scenario: Issue a new key

- **WHEN** an operator runs the issuance utility with a target user id or email and an optional label
- **THEN** the utility SHALL generate a cryptographically random 32-byte token, prefix it with `sftq_`, insert a row into `api_keys` containing only `sha256(plaintext_token)` as `key_hash` plus the label and `created_at`, and print the plaintext token once on stdout.

#### Scenario: Plaintext is not stored

- **WHEN** a key has been issued
- **THEN** the database SHALL contain only the hash; there SHALL be no column storing the plaintext token.

### Requirement: API key verification on each request

Every HTTP request to the `jobs-api` SHALL be authenticated by an API key supplied in the `Authorization: Bearer <token>` header.

#### Scenario: Valid key

- **WHEN** a request arrives with `Authorization: Bearer sftq_<token>` whose sha256 matches a row in `api_keys` with `revoked_at IS NULL`
- **THEN** the middleware SHALL resolve `user_id` from that row, update `last_used_at = now()`, and pass the request to the handler.

#### Scenario: Unknown key

- **WHEN** the header is present but the hash does not match any row
- **THEN** the middleware SHALL respond `401 Unauthorized`.

#### Scenario: Revoked key

- **WHEN** the header matches a row where `revoked_at IS NOT NULL`
- **THEN** the middleware SHALL respond `401 Unauthorized` and MUST NOT update `last_used_at`.

#### Scenario: Missing header

- **WHEN** the request has no `Authorization` header, or it is malformed (no `Bearer` prefix, empty token)
- **THEN** the middleware SHALL respond `401 Unauthorized`.

### Requirement: API key revocation

The system SHALL allow an operator to revoke an API key.

#### Scenario: Revoke by id

- **WHEN** an operator runs the revocation utility with a key id
- **THEN** the utility SHALL set `revoked_at = now()` on that row, after which the key SHALL no longer authenticate any request.

### Requirement: Prefix convention for secret scanning

All issued API keys SHALL carry the fixed prefix `sftq_`.

#### Scenario: Consistent prefix

- **WHEN** a key is issued
- **THEN** the plaintext token SHALL begin with the literal string `sftq_`, enabling secret scanners (GitHub, pre-commit) to detect accidental commits.
