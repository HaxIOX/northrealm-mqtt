export const formatDuration = (s) =>
  `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

export const toHex = (str) => {
  let h = '';
  for (let i = 0; i < str.length; i++)
    h += str.charCodeAt(i).toString(16).padStart(2, '0') + ' ';
  return h.toUpperCase();
};

export const formatJsonPayload = (value) => {
  const raw = String(value ?? '');
  try {
    const parsed = JSON.parse(raw);
    return { isJson: true, formatted: JSON.stringify(parsed, null, 2) };
  } catch {
    return { isJson: false, formatted: raw };
  }
};
