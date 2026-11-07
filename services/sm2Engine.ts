import { ReviewGrade, SM2Flashcard } from '../types';

const QUALITY_MAP: Record<ReviewGrade, number> = {
  hard: 2,
  good: 4,
  easy: 5,
};

/**
 * Modified SM-2 Spaced Repetition Algorithm
 * Tracks interval, repetitions, easeFactor, and nextReviewDate.
 * Prioritizes isNew: true cards in the daily study queue.
 */
export function calculateSM2Review(
  card: SM2Flashcard,
  grade: ReviewGrade,
  now: Date = new Date()
): SM2Flashcard {
  const q = QUALITY_MAP[grade];
  let repetitions = card.repetitions;
  let interval = card.interval;
  let easeFactor = card.easeFactor;

  if (q < 3) {
    // Hard: reset consecutive repetitions, schedule for 1 day, reduce ease slightly
    repetitions = 0;
    interval = 1;
    easeFactor = Math.max(1.3, Number((easeFactor - 0.2).toFixed(2)));
  } else {
    if (repetitions === 0) {
      interval = grade === 'easy' ? 4 : 1;
    } else if (repetitions === 1) {
      interval = grade === 'easy' ? 8 : 6;
    } else {
      const easyBonus = grade === 'easy' ? 1.3 : 1.0;
      interval = Math.max(1, Math.round(interval * easeFactor * easyBonus));
    }
    repetitions += 1;
    const rawEase = easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
    easeFactor = Math.max(1.3, Math.min(5.0, Number(rawEase.toFixed(2))));
  }

  const nextDate = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000);

  return {
    ...card,
    isNew: false,
    interval,
    repetitions,
    easeFactor,
    nextReviewDate: nextDate.toISOString(),
    updatedAt: now.toISOString(),
    pendingSync: true,
  };
}

/**
 * Preview the next interval in days for each button (Hard / Good / Easy)
 */
export function previewNextIntervalDays(
  card: SM2Flashcard,
  grade: ReviewGrade
): number {
  return calculateSM2Review(card, grade).interval;
}

/**
 * Build daily study queue:
 * 1. Prioritize due or new cards
 * 2. Strictly order `isNew: true` cards first so new vocabulary from recent journals is learned immediately
 */
export function getPrioritizedStudyQueue(
  cards: SM2Flashcard[],
  includeAllIfNoneDue = false
): SM2Flashcard[] {
  const nowIso = new Date().toISOString();
  const dueCards = cards.filter(
    (c) => c.isNew || c.nextReviewDate <= nowIso
  );

  const pool =
    dueCards.length > 0 ? dueCards : includeAllIfNoneDue ? [...cards] : [];

  return pool.sort((a, b) => {
    if (a.isNew !== b.isNew) {
      return a.isNew ? -1 : 1; // is_new: true strictly prioritized
    }
    return a.nextReviewDate.localeCompare(b.nextReviewDate);
  });
}
