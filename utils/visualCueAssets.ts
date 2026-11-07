export interface VisualCueMatch {
  imageUrl: string;
  caption: string;
  themeColor: string;
}

const VISUAL_CUE_GALLERY = {
  mosque: {
    imageUrl: '/src/assets/images/cue_mosque_dawn_1794023569357.jpg',
    caption: 'Courtyard Mosque at Dawn (الْمَسْجِدُ فَجْرًا)',
    themeColor: '#C87D28',
  },
  coffee: {
    imageUrl:
      '/src/assets/images/cue_morning_coffee_notebook_1794023570212.jpg',
    caption: 'Morning Notebook & Arabic Coffee (الْقَهْوَةُ وَالدَّفْتَرُ)',
    themeColor: '#8C5A2B',
  },
  library: {
    imageUrl:
      '/src/assets/images/cue_library_books_calligraphy_1794023571607.jpg',
    caption: 'Classical Study & Manuscripts (الْقِرَاءَةُ وَالْعِلْمُ)',
    themeColor: '#2D5A3C',
  },
  garden: {
    imageUrl: '/src/assets/images/cue_garden_olive_trees_1794023571429.jpg',
    caption: 'Tranquil Olive Courtyard (السَّكِينَةُ وَالْهُدُوءُ)',
    themeColor: '#3B6E4C',
  },
};

export function resolveVisualCueForKeyword(
  visualKeyword: string,
  englishMeaning: string
): VisualCueMatch {
  const combined = `${visualKeyword} ${englishMeaning}`.toLowerCase();

  if (
    combined.includes('mosque') ||
    combined.includes('dawn') ||
    combined.includes('fajr') ||
    combined.includes('went') ||
    combined.includes('pray') ||
    combined.includes('arch')
  ) {
    return VISUAL_CUE_GALLERY.mosque;
  }

  if (
    combined.includes('coffee') ||
    combined.includes('morning') ||
    combined.includes('drank') ||
    combined.includes('drink') ||
    combined.includes('notebook') ||
    combined.includes('journal') ||
    combined.includes('early')
  ) {
    return VISUAL_CUE_GALLERY.coffee;
  }

  if (
    combined.includes('garden') ||
    combined.includes('peace') ||
    combined.includes('tranquil') ||
    combined.includes('quiet') ||
    combined.includes('olive') ||
    combined.includes('tree') ||
    combined.includes('courtyard') ||
    combined.includes('in')
  ) {
    return VISUAL_CUE_GALLERY.garden;
  }

  return VISUAL_CUE_GALLERY.library;
}
