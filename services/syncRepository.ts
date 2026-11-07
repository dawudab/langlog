import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import {
  db,
  auth,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import {
  ExtractedVocab,
  JournalEntryRecord,
  SM2Flashcard,
} from '../types';

const LOCAL_ENTRIES_KEY = 'langlog_entries_v2';
const LOCAL_CARDS_KEY = 'langlog_flashcards_v2';

export function sanitizeId(rawId: string): string {
  return rawId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128) || 'id_default';
}

export const INITIAL_SEED_ENTRIES: JournalEntryRecord[] = [
  {
    id: 'entry_seed_1',
    userId: 'local_user',
    originalText:
      'This morning I walked to the old book market in the city center and bought an Arabic poetry notebook while drinking hot mint tea.',
    translatedText:
      'هذا الصباح مشيتُ إلى سوق الكتب القديم في وسط المدينة واشتريتُ دفتراً للشعر العربي بينما كنتُ أشربُ شاي النعناع الساخن.',
    sourceLanguage: 'en',
    targetLanguage: 'ar',
    syncStatus: 'synced',
    vocabulary: [
      {
        word_conjugated: 'اشتريتُ',
        root: 'ش ر ي',
        meaning: 'I bought / purchased',
        context: 'واشتريتُ دفتراً للشعر العربي',
        is_new: true,
      },
      {
        word_conjugated: 'مشيتُ',
        root: 'م ش ي',
        meaning: 'I walked',
        context: 'هذا الصباح مشيتُ إلى سوق الكتب',
        is_new: true,
      },
      {
        word_conjugated: 'الكتب',
        root: 'ك ت ب',
        meaning: 'the books',
        context: 'إلى سوق الكتب القديم في وسط المدينة',
        is_new: false,
      },
      {
        word_conjugated: 'أشربُ',
        root: 'ش ر ب',
        meaning: 'I drink',
        context: 'بينما كنتُ أشربُ شاي النعناع الساخن',
        is_new: false,
      },
    ],
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
  },
  {
    id: 'entry_seed_2',
    userId: 'local_user',
    originalText:
      'قرأتُ اليوم فصلاً ممتعاً عن تاريخ الخط العربي وتأملتُ كيف تعكس الحروف المشاعر الإنسانية بدقة.',
    translatedText:
      'Today I read a fascinating chapter on the history of Arabic calligraphy and reflected on how the letters accurately mirror human emotions.',
    sourceLanguage: 'ar',
    targetLanguage: 'en',
    syncStatus: 'synced',
    vocabulary: [
      {
        word_conjugated: 'calligraphy',
        root: 'calligraph / Greek kalligraphia',
        meaning: 'الخط الفني / فن الخط',
        context: 'the history of Arabic calligraphy',
        is_new: true,
      },
      {
        word_conjugated: 'reflected',
        root: 'reflect (base verb)',
        meaning: 'تأملتُ / فكرتُ بعمق',
        context: 'and reflected on how the letters accurately mirror',
        is_new: true,
      },
    ],
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 42).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 42).toISOString(),
  },
];

export const INITIAL_SEED_CARDS: SM2Flashcard[] = [
  {
    id: 'card_seed_1',
    userId: 'local_user',
    entryId: 'entry_seed_1',
    wordConjugated: 'اشتريتُ',
    root: 'ش ر ي',
    meaning: 'I bought / purchased',
    context: 'واشتريتُ دفتراً للشعر العربي',
    targetLanguage: 'ar',
    isNew: true,
    interval: 0,
    repetitions: 0,
    easeFactor: 2.5,
    nextReviewDate: new Date().toISOString(),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
  },
  {
    id: 'card_seed_2',
    userId: 'local_user',
    entryId: 'entry_seed_1',
    wordConjugated: 'مشيتُ',
    root: 'م ش ي',
    meaning: 'I walked',
    context: 'هذا الصباح مشيتُ إلى سوق الكتب',
    targetLanguage: 'ar',
    isNew: true,
    interval: 0,
    repetitions: 0,
    easeFactor: 2.5,
    nextReviewDate: new Date().toISOString(),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
  },
  {
    id: 'card_seed_3',
    userId: 'local_user',
    entryId: 'entry_seed_2',
    wordConjugated: 'calligraphy',
    root: 'calligraph / Greek kalligraphia',
    meaning: 'الخط الفني / فن الخط',
    context: 'the history of Arabic calligraphy',
    targetLanguage: 'en',
    isNew: true,
    interval: 0,
    repetitions: 0,
    easeFactor: 2.5,
    nextReviewDate: new Date().toISOString(),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 42).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 42).toISOString(),
  },
  {
    id: 'card_seed_4',
    userId: 'local_user',
    entryId: 'entry_seed_2',
    wordConjugated: 'reflected',
    root: 'reflect (base verb)',
    meaning: 'تأملتُ / فكرتُ بعمق',
    context: 'and reflected on how the letters accurately mirror',
    targetLanguage: 'en',
    isNew: true,
    interval: 0,
    repetitions: 0,
    easeFactor: 2.5,
    nextReviewDate: new Date().toISOString(),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 42).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 42).toISOString(),
  },
  {
    id: 'card_seed_5',
    userId: 'local_user',
    entryId: 'entry_seed_1',
    wordConjugated: 'الكتب',
    root: 'ك ت ب',
    meaning: 'the books',
    context: 'إلى سوق الكتب القديم في وسط المدينة',
    targetLanguage: 'ar',
    isNew: false,
    interval: 1,
    repetitions: 1,
    easeFactor: 2.5,
    nextReviewDate: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
  },
];

export function loadLocalEntries(): JournalEntryRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_ENTRIES_KEY);
    if (!raw) {
      localStorage.setItem(
        LOCAL_ENTRIES_KEY,
        JSON.stringify(INITIAL_SEED_ENTRIES)
      );
      return INITIAL_SEED_ENTRIES;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0
      ? parsed
      : INITIAL_SEED_ENTRIES;
  } catch {
    return INITIAL_SEED_ENTRIES;
  }
}

export function saveLocalEntries(entries: JournalEntryRecord[]): void {
  try {
    localStorage.setItem(LOCAL_ENTRIES_KEY, JSON.stringify(entries));
  } catch (e) {
    console.error('Failed to persist entries locally', e);
  }
}

export function loadLocalFlashcards(): SM2Flashcard[] {
  try {
    const raw = localStorage.getItem(LOCAL_CARDS_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_CARDS_KEY, JSON.stringify(INITIAL_SEED_CARDS));
      return INITIAL_SEED_CARDS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0
      ? parsed
      : INITIAL_SEED_CARDS;
  } catch {
    return INITIAL_SEED_CARDS;
  }
}

export function saveLocalFlashcards(cards: SM2Flashcard[]): void {
  try {
    localStorage.setItem(LOCAL_CARDS_KEY, JSON.stringify(cards));
  } catch (e) {
    console.error('Failed to persist flashcards locally', e);
  }
}

export async function pushEntryToFirestore(
  entry: JournalEntryRecord
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.emailVerified) return;

  const entryId = sanitizeId(entry.id);
  const path = `journalEntries/${entryId}`;
  const boundedVocab: ExtractedVocab[] = (entry.vocabulary || [])
    .slice(0, 50)
    .map((v) => ({
      word_conjugated: String(v.word_conjugated || '').slice(0, 200),
      root: String(v.root || '').slice(0, 100),
      meaning: String(v.meaning || '').slice(0, 500),
      context: String(v.context || '').slice(0, 1000),
      is_new: Boolean(v.is_new),
    }));

  try {
    await setDoc(doc(db, 'journalEntries', entryId), {
      userId: currentUser.uid,
      originalText: entry.originalText.slice(0, 10000),
      translatedText: (entry.translatedText || '').slice(0, 15000),
      sourceLanguage: entry.sourceLanguage === 'ar' ? 'ar' : 'en',
      targetLanguage: entry.targetLanguage === 'en' ? 'en' : 'ar',
      syncStatus: entry.syncStatus,
      vocabulary: boundedVocab,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function pushFlashcardToFirestore(
  card: SM2Flashcard
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.emailVerified) return;

  const cardId = sanitizeId(card.id);
  const entryId = sanitizeId(card.entryId);
  const path = `flashcards/${cardId}`;

  try {
    await setDoc(doc(db, 'flashcards', cardId), {
      userId: currentUser.uid,
      entryId,
      wordConjugated: (card.wordConjugated || 'word').slice(0, 200),
      root: (card.root || 'root').slice(0, 100),
      meaning: (card.meaning || 'meaning').slice(0, 500),
      context: (card.context || '').slice(0, 1000),
      targetLanguage: card.targetLanguage === 'en' ? 'en' : 'ar',
      isNew: Boolean(card.isNew),
      interval: Math.max(0, Math.min(36500, Math.round(card.interval))),
      repetitions: Math.max(0, Math.min(10000, Math.round(card.repetitions))),
      easeFactor: Math.max(1.3, Math.min(5.0, Number(card.easeFactor))),
      nextReviewDate: card.nextReviewDate.slice(0, 64),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateFlashcardSM2InFirestore(
  card: SM2Flashcard
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.emailVerified) return;

  const cardId = sanitizeId(card.id);
  const path = `flashcards/${cardId}`;

  try {
    await updateDoc(doc(db, 'flashcards', cardId), {
      isNew: Boolean(card.isNew),
      interval: Math.max(0, Math.min(36500, Math.round(card.interval))),
      repetitions: Math.max(0, Math.min(10000, Math.round(card.repetitions))),
      easeFactor: Math.max(1.3, Math.min(5.0, Number(card.easeFactor))),
      nextReviewDate: card.nextReviewDate.slice(0, 64),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteEntryFromFirestore(entryId: string): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.emailVerified) return;

  const cleanId = sanitizeId(entryId);
  const path = `journalEntries/${cleanId}`;
  try {
    await deleteDoc(doc(db, 'journalEntries', cleanId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeToUserFirestoreData(
  userId: string,
  onEntries: (entries: JournalEntryRecord[]) => void,
  onCards: (cards: SM2Flashcard[]) => void
): () => void {
  const entriesQuery = query(
    collection(db, 'journalEntries'),
    where('userId', '==', userId)
  );
  const cardsQuery = query(
    collection(db, 'flashcards'),
    where('userId', '==', userId)
  );

  const unsubEntries = onSnapshot(
    entriesQuery,
    (snapshot) => {
      const docs: JournalEntryRecord[] = snapshot.docs.map((d) => {
        const data = d.data();
        const createdAtTs = data.createdAt as Timestamp | undefined;
        const updatedAtTs = data.updatedAt as Timestamp | undefined;
        return {
          id: d.id,
          userId: String(data.userId || userId),
          originalText: String(data.originalText || ''),
          translatedText: String(data.translatedText || ''),
          sourceLanguage: data.sourceLanguage === 'ar' ? 'ar' : 'en',
          targetLanguage: data.targetLanguage === 'en' ? 'en' : 'ar',
          syncStatus:
            data.syncStatus === 'pending' || data.syncStatus === 'failed'
              ? data.syncStatus
              : 'synced',
          vocabulary: Array.isArray(data.vocabulary) ? data.vocabulary : [],
          createdAt: createdAtTs?.toDate
            ? createdAtTs.toDate().toISOString()
            : new Date().toISOString(),
          updatedAt: updatedAtTs?.toDate
            ? updatedAtTs.toDate().toISOString()
            : new Date().toISOString(),
        };
      });
      onEntries(docs);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'journalEntries');
    }
  );

  const unsubCards = onSnapshot(
    cardsQuery,
    (snapshot) => {
      const docs: SM2Flashcard[] = snapshot.docs.map((d) => {
        const data = d.data();
        const createdAtTs = data.createdAt as Timestamp | undefined;
        const updatedAtTs = data.updatedAt as Timestamp | undefined;
        return {
          id: d.id,
          userId: String(data.userId || userId),
          entryId: String(data.entryId || ''),
          wordConjugated: String(data.wordConjugated || ''),
          root: String(data.root || ''),
          meaning: String(data.meaning || ''),
          context: String(data.context || ''),
          targetLanguage: data.targetLanguage === 'en' ? 'en' : 'ar',
          isNew: Boolean(data.isNew),
          interval: Number(data.interval ?? 0),
          repetitions: Number(data.repetitions ?? 0),
          easeFactor: Number(data.easeFactor ?? 2.5),
          nextReviewDate: String(
            data.nextReviewDate || new Date().toISOString()
          ),
          createdAt: createdAtTs?.toDate
            ? createdAtTs.toDate().toISOString()
            : new Date().toISOString(),
          updatedAt: updatedAtTs?.toDate
            ? updatedAtTs.toDate().toISOString()
            : new Date().toISOString(),
        };
      });
      onCards(docs);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'flashcards');
    }
  );

  return () => {
    unsubEntries();
    unsubCards();
  };
}
