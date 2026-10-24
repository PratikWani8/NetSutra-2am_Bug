/**
 * Formatters and Data Display Utilities for NetSutra
 */

export const formatNumber = (num) => {
  if (num === null || num === undefined) return 'Unavailable';
  return Number(num).toLocaleString();
};

export const formatBytes = (bytes) => {
  if (bytes === null || bytes === undefined) return 'Unavailable';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const formatUtcTime = (isoString) => {
  if (!isoString) return 'Unavailable';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return 'Unavailable';
    const h = String(d.getUTCHours()).padStart(2, '0');
    const m = String(d.getUTCMinutes()).padStart(2, '0');
    const s = String(d.getUTCSeconds()).padStart(2, '0');
    const ms = String(d.getUTCMilliseconds()).padStart(3, '0').slice(0, 2);
    return `${h}:${m}:${s}.${ms}`;
  } catch {
    return 'Unavailable';
  }
};

export const formatFullUtc = (isoString) => {
  if (!isoString) return 'Unavailable';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return 'Unavailable';
    return d.toUTCString();
  } catch {
    return 'Unavailable';
  }
};

export const formatIpPort = (ip, port) => {
  if (!ip || ip === 'N/A' || ip === 'Unavailable') return 'Unavailable';
  if (port === null || port === undefined) return ip;
  return `${ip}:${port}`;
};

export const formatDuration = (ms) => {
  if (ms === null || ms === undefined) return 'Unavailable';
  if (ms === 0) return '< 1ms';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};
