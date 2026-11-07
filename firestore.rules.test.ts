/**
 * Firestore Security Rules Verification Specification
 * Verifies that all 12 "Dirty Dozen" attack payloads return PERMISSION_DENIED.
 */

export interface DirtyDozenTestCase {
  id: number;
  name: string;
  collection: 'journalEntries' | 'flashcards';
  operation: 'create' | 'update' | 'get' | 'list' | 'delete';
  auth: { uid: string; email_verified: boolean } | null;
  docId: string;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TESTS: DirtyDozenTestCase[] = [
  {
    id: 1,
    name: 'Unauthenticated Write',
    collection: 'journalEntries',
    operation: 'create',
    auth: null,
    docId: 'entry_1',
    payload: { userId: 'user_1', originalText: 'Hello' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Unverified Email Spoof',
    collection: 'journalEntries',
    operation: 'create',
    auth: { uid: 'user_1', email_verified: false },
    docId: 'entry_1',
    payload: { userId: 'user_1', originalText: 'Hello' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Identity Spoofing on Create',
    collection: 'journalEntries',
    operation: 'create',
    auth: { uid: 'user_1', email_verified: true },
    docId: 'entry_1',
    payload: { userId: 'user_2', originalText: 'Hello' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Shadow Field Injection',
    collection: 'journalEntries',
    operation: 'update',
    auth: { uid: 'user_1', email_verified: true },
    docId: 'entry_1',
    payload: { isAdmin: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Owner Mutation on Update',
    collection: 'journalEntries',
    operation: 'update',
    auth: { uid: 'user_1', email_verified: true },
    docId: 'entry_1',
    payload: { userId: 'user_2' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Immutable Timestamp Tampering',
    collection: 'journalEntries',
    operation: 'update',
    auth: { uid: 'user_1', email_verified: true },
    docId: 'entry_1',
    payload: { createdAt: '2020-01-01T00:00:00Z' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Forged Client Timestamp',
    collection: 'journalEntries',
    operation: 'create',
    auth: { uid: 'user_1', email_verified: true },
    docId: 'entry_1',
    payload: { userId: 'user_1', createdAt: '2099-01-01T00:00:00Z' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'ID Poisoning',
    collection: 'journalEntries',
    operation: 'create',
    auth: { uid: 'user_1', email_verified: true },
    docId: 'invalid id with spaces!',
    payload: { userId: 'user_1' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Denial-of-Wallet Oversized String',
    collection: 'journalEntries',
    operation: 'create',
    auth: { uid: 'user_1', email_verified: true },
    docId: 'entry_1',
    payload: { userId: 'user_1', originalText: 'a'.repeat(10005) },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Unbounded Vocabulary Array',
    collection: 'journalEntries',
    operation: 'create',
    auth: { uid: 'user_1', email_verified: true },
    docId: 'entry_1',
    payload: { userId: 'user_1', vocabulary: new Array(55).fill({}) },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Orphaned Flashcard Creation',
    collection: 'flashcards',
    operation: 'create',
    auth: { uid: 'user_1', email_verified: true },
    docId: 'card_1',
    payload: { userId: 'user_1', entryId: 'non_existent_entry' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Blanket List Query Scraping',
    collection: 'journalEntries',
    operation: 'list',
    auth: { uid: 'user_2', email_verified: true },
    docId: 'entry_owned_by_user_1',
    expectedResult: 'PERMISSION_DENIED',
  },
];
