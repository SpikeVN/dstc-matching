import { format } from 'date-fns';

/**
 * Format a UTC timestamp in the browser's local timezone.
 *
 * Backend always returns ISO strings with +00:00 offset
 * (normalized in server/database.py via _record_to_dict).
 *
 * `new Date(str)` correctly parses the UTC string.
 * `format()` from date-fns then displays in the browser's local
 * timezone — so a user in UTC+7 sees UTC+7 time, a user in
 * US/Eastern sees US/Eastern time, and so on.
 *
 * No manual timezone math needed.
 *
 * @param {string|Date} dateStr — UTC ISO string or Date object
 * @param {string} [pattern='HH:mm dd/MM'] — date-fns format pattern
 * @returns {string}
 */
export function formatDateTime(dateStr, pattern = 'HH:mm dd/MM') {
  if (!dateStr) return '';
  return format(new Date(dateStr), pattern);
}

/**
 * Format a timestamp for notification display.
 * Shows relative time for recent, absolute date for older.
 *
 * @param {string} dateStr
 * @returns {string}
 */
export function formatNotificationTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const diff = Math.floor((Date.now() - d.getTime()) / 60000);

  if (diff < 1) return 'Vừa xong';
  if (diff < 60) return `${diff}p`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h`;

  return formatDateTime(dateStr, 'dd/MM');
}

/**
 * Format "last active" relative time.
 *
 * @param {string|null} lastActiveAt
 * @returns {string}
 */
export function formatLastActive(lastActiveAt) {
  if (!lastActiveAt) return 'Không hoạt động';
  const diffMinutes = Math.floor(
    (Date.now() - new Date(lastActiveAt).getTime()) / 60000,
  );

  if (diffMinutes < 1) return 'Vừa xong';
  if (diffMinutes < 60) return `Hoạt động ${diffMinutes} phút trước`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `Hoạt động ${diffHours} giờ trước`;
  const diffDays = Math.floor(diffHours / 24);
  return `Hoạt động ${diffDays} ngày trước`;
}
