/**
 * Date & time utility helpers for e-Partogram clinical display.
 */
import { format, formatDistanceToNow, parseISO, differenceInMinutes } from 'date-fns';

/** Format a timestamp to "Apr 20, 2026 · 14:32" */
export const formatClinicalDateTime = (isoString) => {
  try {
    return format(parseISO(isoString), "MMM dd, yyyy · HH:mm");
  } catch {
    return '—';
  }
};

/** "3 hours ago" style relative time */
export const timeAgo = (isoString) => {
  try {
    return formatDistanceToNow(parseISO(isoString), { addSuffix: true });
  } catch {
    return '—';
  }
};

/** Get labor duration in hours from admission time */
export const laborDurationHours = (admissionIso) => {
  try {
    const mins = differenceInMinutes(new Date(), parseISO(admissionIso));
    return (mins / 60).toFixed(1);
  } catch {
    return null;
  }
};

/** Truncate long strings for card display */
export const truncate = (str, maxLen = 28) =>
  str && str.length > maxLen ? str.slice(0, maxLen - 1) + '…' : str;
