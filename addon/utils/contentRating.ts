const MOVIE_RATING_AGES: Record<string, number> = {
  'G': 0,
  'PG': 7,
  'PG-13': 13,
  'R': 17,
  'NC-17': 18,
};

const TV_RATING_AGES: Record<string, number> = {
  'TV-Y': 0,
  'TV-Y7': 7,
  'TV-G': 0,
  'TV-PG': 7,
  'TV-14': 14,
  'TV-MA': 17,
};

const MOVIE_TO_TV_RATING: Record<string, string> = {
  'G': 'TV-G',
  'PG': 'TV-PG',
  'PG-13': 'TV-14',
  'R': 'TV-MA',
  'NC-17': 'TV-MA',
};

const CHILD_SAFE_LABELS = new Set([
  'ALL', 'AL', 'ATP', 'U', 'SU', '0', '0+', 'L', 'TE', 'TP', 'G', 'TV-G', 'TV-Y', 'TV-Y7',
]);

const PARENTAL_GUIDANCE_LABELS = new Set([
  'PG', 'TV-PG', 'M/PG', 'PG-12', 'P13', '13+', '+13', 'SAM13', '12A', 'K-12', '12', '12+', '+12', '-12',
]);

const MATURE_LABELS: Record<string, number> = {
  'TV-14': 14,
  'TV-MA': 17,
  'R': 17,
  'NC-17': 18,
  '16': 16,
  '16+': 16,
  '+16': 16,
  '-16': 16,
  '18': 18,
  '18+': 18,
  '+18': 18,
  '-18': 18,
  'R18': 18,
  'R18+': 18,
  'M': 15,
  'MA': 15,
  'MA15+': 15,
  '15': 15,
  '15+': 15,
  '+15': 15,
  'K-16': 16,
  'K-18': 18,
};

function normalizeRatingLabel(rating: unknown): string | null {
  if (typeof rating !== 'string') return null;
  const trimmed = rating.trim();
  if (!trimmed) return null;
  return trimmed.toUpperCase().replace(/\s+/g, ' ');
}

function ageFromNumericLabel(label: string): number | null {
  const match = label.match(/(?:^|[^0-9])(\d{1,2})(?:[^0-9]|$)/);
  if (!match) return null;
  const age = Number(match[1]);
  if (!Number.isFinite(age)) return null;
  return Math.max(0, Math.min(age, 18));
}

export function getAllowedAgeForUserRating(ageRating: unknown, type: string): number | null {
  const label = normalizeRatingLabel(ageRating);
  if (!label || label === 'NONE') return null;

  const isSeries = type === 'series';
  const effectiveLabel = isSeries ? (MOVIE_TO_TV_RATING[label] || label) : label;
  const hierarchy = isSeries ? TV_RATING_AGES : MOVIE_RATING_AGES;
  return hierarchy[effectiveLabel] ?? MOVIE_RATING_AGES[effectiveLabel] ?? TV_RATING_AGES[effectiveLabel] ?? null;
}

export function getAgeForContentRating(rating: unknown, type: string): number | null {
  const label = normalizeRatingLabel(rating);
  if (!label || label === 'NR' || label === 'N/R' || label === 'UNRATED') return null;

  const hierarchy = type === 'series' ? TV_RATING_AGES : MOVIE_RATING_AGES;
  if (hierarchy[label] !== undefined) return hierarchy[label];
  if (MOVIE_RATING_AGES[label] !== undefined) return MOVIE_RATING_AGES[label];
  if (TV_RATING_AGES[label] !== undefined) return TV_RATING_AGES[label];
  if (CHILD_SAFE_LABELS.has(label)) return 0;
  if (PARENTAL_GUIDANCE_LABELS.has(label)) return 13;
  if (MATURE_LABELS[label] !== undefined) return MATURE_LABELS[label];

  return ageFromNumericLabel(label);
}

export function getCandidateContentRatings(meta: any): string[] {
  const candidates = [
    meta?.app_extras?.certification,
    meta?.app_extras?.certificationLocal,
    meta?.certification,
    meta?.contentRating,
  ];

  return Array.from(new Set(candidates
    .map(normalizeRatingLabel)
    .filter((rating): rating is string => !!rating)));
}

export function passesAgeRatingFilter(meta: any, type: string, ageRating: unknown): boolean {
  const allowedAge = getAllowedAgeForUserRating(ageRating, type);
  if (allowedAge === null) return true;

  const candidateAges = getCandidateContentRatings(meta)
    .map(rating => getAgeForContentRating(rating, type))
    .filter((age): age is number => age !== null);

  if (candidateAges.length === 0) {
    return allowedAge >= 17;
  }

  return Math.min(...candidateAges) <= allowedAge;
}
