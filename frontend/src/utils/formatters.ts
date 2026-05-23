/**
 * Formatting utilities for city metrics
 */

/**
 * Formats a number with spaces as thousands separators.
 * Example: 1200000 -> "1 200 000"
 */
const formatWithSpaces = (num: number): string => {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

/**
 * Formats population as full numbers with spaces as separators.
 * Example: 1200000 -> "1 200 000"
 */
export const formatPopulation = (num: number): string => {
  return formatWithSpaces(Math.round(num));
};

/**
 * Formats distance with one decimal place, but hides it if it's .0.
 * Example: 45.234 -> "45.2", 45.0 -> "45"
 */
export const formatDistance = (num: number): string => {
  const formatted = num.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
  return formatted;
};

/**
 * Formats a fraction as a percentage with one decimal place, but hides it if it's .0.
 * Example: 0.85 -> "85", 0.852 -> "85.2"
 */
export const formatPercentage = (num: number): string => {
  const val = num <= 1 ? num * 100 : num;
  return val.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
};

/**
 * Formats currency (budget) consistently with population using spaces.
 */
export const formatCurrency = (num: number | null | undefined, suffix: string = '€'): string => {
  if (num == null) return '-';
  return formatPopulation(num) + suffix;
};

const normalizeWord = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Formats a citybikes network ID for display:
 * - Replaces dashes with spaces
 * - Title-cases each word
 * - Removes the city name words if they appear as a contiguous sequence (in order)
 *   inside the service name words. E.g. "alsa-nextbike-leon" + "León" → "Alsa Nextbike".
 *   Words embedded inside another word are not touched ("bicielx" + "Elx" → "Bicielx").
 */
export const formatServiceName = (serviceName: string, cityName: string): string => {
  const serviceWords = serviceName.replace(/-/g, ' ').split(' ').filter(Boolean);
  const cityWords = cityName.split(' ').filter(Boolean).map(normalizeWord);

  // Find first contiguous occurrence of city words (in order) within service words
  let removeStart = -1;
  outer: for (let i = 0; i <= serviceWords.length - cityWords.length; i++) {
    for (let j = 0; j < cityWords.length; j++) {
      if (normalizeWord(serviceWords[i + j]) !== cityWords[j]) continue outer;
    }
    removeStart = i;
    break;
  }

  const filtered =
    removeStart >= 0
      ? [...serviceWords.slice(0, removeStart), ...serviceWords.slice(removeStart + cityWords.length)]
      : serviceWords;

  if (filtered.length === 0) return serviceName;
  return filtered.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
};
