/**
 * Firestore Security Rules Verification Specification
 * Verifies that all 12 "Dirty Dozen" attack payloads return PERMISSION_DENIED.
 */

export interface DirtyDozenTestCase {
  id: number;
  name: string;
  collection: 'journalEntries' | 'wordBank' | 'userStats';
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
    name: 'Identity Spoofing on JournalEntry',
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
    name: 'Oversized String DoS on JournalEntry',
    collection: 'journalEntries',
    operation: 'create',
    auth: { uid: 'user_1', email_verified: true },
    docId: 'entry_1',
    payload: { userId: 'user_1', originalText: 'a'.repeat(10005) },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Unbounded Token Array DoS',
    collection: 'journalEntries',
    operation: 'create',
    auth: { uid: 'user_1', email_verified: true },
    docId: 'entry_1',
    payload: { userId: 'user_1', tokens: new Array(85).fill({}) },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Client Timestamp Forgery',
    collection: 'journalEntries',
    operation: 'create',
    auth: { uid: 'user_1', email_verified: true },
    docId: 'entry_1',
    payload: { userId: 'user_1', createdAt: '2099-01-01T00:00:00Z' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: '20/20 Mastery Forgery on WordBankItem',
    collection: 'wordBank',
    operation: 'create',
    auth: { uid: 'user_1', email_verified: true },
    docId: 'word_1',
    payload: {
      userId: 'user_1',
      usageCount: 3,
      reviewCount: 5,
      isMastered: true,
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Value Poisoning on WordBankItem Update',
    collection: 'wordBank',
    operation: 'update',
    auth: { uid: 'user_1', email_verified: true },
    docId: 'word_1',
    payload: { usageCount: -5 },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Cross-Tenant List Scraping',
    collection: 'wordBank',
    operation: 'list',
    auth: { uid: 'user_2', email_verified: true },
    docId: 'word_owned_by_user_1',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Path ID Poisoning',
    collection: 'wordBank',
    operation: 'create',
    auth: { uid: 'user_1', email_verified: true },
    docId: 'invalid id with spaces!',
    payload: { userId: 'user_1' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'UserStats Mismatched Path ID',
    collection: 'userStats',
    operation: 'create',
    auth: { uid: 'user_1', email_verified: true },
    docId: 'user_2',
    payload: { userId: 'user_1' },
    expectedResult: 'PERMISSION_DENIED',
  },
];
