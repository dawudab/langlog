# Security Specification (`security_spec.md`)

## 1. Data Invariants

1. **Authentication & Email Verification Invariant**: Every read and write to `/journalEntries/{entryId}` and `/flashcards/{cardId}` requires an authenticated user (`request.auth != null`) with a verified email (`request.auth.token.email_verified == true`).
2. **Ownership Invariant**: Users can only read, create, update, or delete their own documents (`userId == request.auth.uid`). `userId` and `createdAt` are immutable once created.
3. **Relational Integrity Invariant**: A `Flashcard` document in `/flashcards/{cardId}` can only be created if its `entryId` references an existing `JournalEntry` in `/journalEntries/$(incoming().entryId)` owned by the same `request.auth.uid` (or created in the same atomic batch via `existsAfter`).
4. **Schema & Volumetric Bounds Invariant**:
   - All document IDs (`entryId`, `cardId`) must match `^[a-zA-Z0-9_\-]+$` and be `<= 128` chars.
   - `JournalEntry.vocabulary` list must be bounded (`size() <= 50`).
   - `Flashcard.easeFactor` must be `>= 1.3` and `<= 5.0`, `interval >= 0`, `repetitions >= 0`.
   - Temporal fields `createdAt` and `updatedAt` must equal `request.time`.

## 2. The "Dirty Dozen" Payloads

1. **Unauthenticated Write**: Creating a `journalEntries` document with `request.auth == null`.
2. **Unverified Email Spoof**: Creating a `journalEntries` document where `request.auth.token.email_verified == false`.
3. **Identity Spoofing on Create**: Creating a `journalEntries` document where `userId != request.auth.uid`.
4. **Shadow Field Injection**: Updating a `journalEntries` document with an undeclared field `isAdmin: true`.
5. **Owner Mutation on Update**: Updating `userId` on an existing `journalEntries` document to another user's UID.
6. **Immutable Timestamp Tampering**: Updating `createdAt` on an existing `journalEntries` or `flashcards` document.
7. **Forged Client Timestamp**: Creating a `journalEntries` document where `createdAt != request.time`.
8. **ID Poisoning**: Creating a document with an invalid ID containing spaces or exceeding 128 characters.
9. **Denial-of-Wallet Oversized String**: Creating a `journalEntries` document where `originalText.size() > 10000`.
10. **Unbounded Vocabulary Array**: Creating a `journalEntries` document with `vocabulary.size() > 50`.
11. **Orphaned Flashcard Creation**: Creating a `flashcards` document whose `entryId` does not exist in `/journalEntries/{entryId}` or belongs to a different user.
12. **Blanket List Query Scraping**: Listing `/journalEntries` or `/flashcards` without filtering `resource.data.userId == request.auth.uid`.
