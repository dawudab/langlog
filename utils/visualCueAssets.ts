export interface VisualCueMatch {
  imageUrl: string;
  caption: string;
}

const VISUAL_CUE_GALLERY: Record<string, VisualCueMatch> = {
  mosque: {
    imageUrl: new URL(
      '../src/assets/images/cue_mosque_dawn_1794023569357.jpg',
      import.meta.url
    ).href,
    caption: 'Mosque at Dawn',
  },
  coffee: {
    imageUrl: new URL(
      '../src/assets/images/cue_morning_coffee_notebook_1794023570212.jpg',
      import.meta.url
    ).href,
    caption: 'Morning Coffee & Notebook',
  },
  library: {
    imageUrl: new URL(
      '../src/assets/images/cue_library_books_calligraphy_1794023571607.jpg',
      import.meta.url
    ).href,
    caption: 'Books & Reading',
  },
  garden: {
    imageUrl: new URL(
      '../src/assets/images/cue_garden_olive_trees_1794023571429.jpg',
      import.meta.url
    ).href,
    caption: 'Courtyard & Olive Trees',
  },
};

/**
 * Resolves a concrete visual keyword to a curated notebook illustration.
 * Returns null if `visualKeyword` is null, empty, abstract, or does not match a concrete visual cue,
 * allowing the Flashcard UI to gracefully adapt to a clean text-and-audio-only layout.
 */
export function resolveVisualCueForKeyword(
  visualKeyword: string | null | undefined
): VisualCueMatch | null {
  if (!visualKeyword) return null;
  const kw = visualKeyword.toLowerCase().trim();
  if (!kw || kw === 'null' || kw === 'none') return null;

  if (
    kw.includes('mosque') ||
    kw.includes('masjid') ||
    kw.includes('minaret') ||
    kw.includes('arch') ||
    kw.includes('prayer')
  ) {
    return VISUAL_CUE_GALLERY.mosque;
  }

  if (
    kw.includes('coffee') ||
    kw.includes('tea') ||
    kw.includes('cup') ||
    kw.includes('drink') ||
    kw.includes('drank') ||
    kw.includes('notebook') ||
    kw.includes('pen') ||
    kw.includes('write') ||
    kw.includes('wrote') ||
    kw.includes('desk') ||
    kw.includes('table')
  ) {
    return VISUAL_CUE_GALLERY.coffee;
  }

  if (
    kw.includes('book') ||
    kw.includes('quran') ||
    kw.includes('library') ||
    kw.includes('read') ||
    kw.includes('reading') ||
    kw.includes('page') ||
    kw.includes('study') ||
    kw.includes('school') ||
    kw.includes('letter')
  ) {
    return VISUAL_CUE_GALLERY.library;
  }

  if (
    kw.includes('tree') ||
    kw.includes('garden') ||
    kw.includes('olive') ||
    kw.includes('water') ||
    kw.includes('fountain') ||
    kw.includes('courtyard') ||
    kw.includes('nature') ||
    kw.includes('leaf') ||
    kw.includes('flower') ||
    kw.includes('sun') ||
    kw.includes('morning')
  ) {
    return VISUAL_CUE_GALLERY.garden;
  }

  return null;
}
