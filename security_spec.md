# Security Specification (`security_spec.md`)

## 1. Data Invariants & Master Source of Truth
- **Identity & Verification Invariant**: Every write or read operation requires an authenticated user with a verified email (`request.auth != null && request.auth.token.email_verified == true`).
- **Ownership Invariant**: Every document in `/journalEntries/{entryId}`, `/wordBank/{wordId}`, and `/userStats/{userId}` belongs strictly to a single owner (`userId == request.auth.uid`). For `/userStats/{userId}`, the document ID `{userId}` must also strictly equal `request.auth.uid`.
- **20/20 Mastery Invariant**: In `/wordBank/{wordId}`, `isMastered` is a boolean that must equal `(usageCount >= 20 && reviewCount >= 20)`.
- **Temporal Integrity**: `createdAt` and `updatedAt` must equal `request.time` on creation, `createdAt` and `userId` are immutable on updates, and `updatedAt` must equal `request.time` on updates.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unverified Email Spoof**: Authenticated user with `email_verified: false` attempting to create a journal entry.
2. **Identity Spoofing on JournalEntry**: Setting `userId` to another user's UID during `create` on `/journalEntries/{entryId}`.
3. **Shadow Field Injection on JournalEntry**: Adding `isAdmin: true` to `/journalEntries/{entryId}`.
4. **Oversized String DoS on JournalEntry**: Sending `originalText` with 25,000 characters (`> 10000`).
5. **Unbounded Token Array DoS**: Sending `tokens` array with 120 items (`> 80`).
6. **Client Timestamp Forgery**: Providing a past timestamp for `createdAt` instead of `request.time`.
7. **Immutable Field Mutation**: Attempting to change `createdAt` or `userId` on `/journalEntries/{entryId}` update.
8. **20/20 Mastery Forgery on WordBankItem**: Attempting to set `isMastered: true` when `usageCount: 3` and `reviewCount: 5`.
9. **Value Poisoning on WordBankItem Update**: Attempting to set `usageCount: -5` or `reviewCount: "twenty"`.
10. **Cross-Tenant List Scraping**: Querying `/wordBank` without filtering by `userId == request.auth.uid`.
11. **Path ID Poisoning**: Creating `/wordBank/{wordId}` with a 200-character or special-character document ID.
12. **UserStats Mismatched Path ID**: Creating `/userStats/{otherUserId}` where `otherUserId != request.auth.uid`.
