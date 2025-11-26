import { addDays, addWeeks, addMonths, addYears, format, parseISO, isBefore, isAfter } from 'date-fns';

export type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

export interface RecurrenceOptions {
  startDate: string; // YYYY-MM-DD format
  pattern: RecurrencePattern;
  interval?: number; // For custom pattern: every N days; for others: every N weeks/months/etc
  endDate?: string; // YYYY-MM-DD format
  count?: number; // Number of occurrences
}

/**
 * Generate an array of deadline dates based on recurrence options.
 * Either endDate or count must be provided.
 */
export function generateRecurrenceDeadlines(options: RecurrenceOptions): string[] {
  const { startDate, pattern, interval = 1, endDate, count } = options;

  if (!endDate && !count) {
    throw new Error('Either endDate or count must be provided');
  }

  const deadlines: string[] = [];
  let currentDate = parseISO(startDate);
  let occurrences = 0;
  const maxOccurrences = count || 365; // Safety limit
  const endDateParsed = endDate ? parseISO(endDate) : null;

  while (occurrences < maxOccurrences) {
    // Check if we've passed the end date
    if (endDateParsed && isAfter(currentDate, endDateParsed)) {
      break;
    }

    // Check if we've reached the count
    if (count && occurrences >= count) {
      break;
    }

    deadlines.push(format(currentDate, 'yyyy-MM-dd'));
    occurrences++;

    // Calculate next date based on pattern
    switch (pattern) {
      case 'daily':
        currentDate = addDays(currentDate, interval);
        break;
      case 'weekly':
        currentDate = addWeeks(currentDate, interval);
        break;
      case 'monthly':
        currentDate = addMonths(currentDate, interval);
        break;
      case 'yearly':
        currentDate = addYears(currentDate, interval);
        break;
      case 'custom':
        currentDate = addDays(currentDate, interval);
        break;
      default:
        throw new Error(`Unknown recurrence pattern: ${pattern}`);
    }
  }

  return deadlines;
}

/**
 * Calculate work date based on deadline and offset.
 * @param deadline - The deadline date in YYYY-MM-DD format
 * @param offsetDays - Number of days before the deadline
 * @returns Work date in YYYY-MM-DD format
 */
export function calculateWorkDate(deadline: string, offsetDays: number): string {
  const deadlineDate = parseISO(deadline);
  const workDate = addDays(deadlineDate, -offsetDays);
  return format(workDate, 'yyyy-MM-dd');
}

/**
 * Generate a unique group ID for recurring tasks
 */
export function generateRecurrenceGroupId(): string {
  return crypto.randomUUID();
}
