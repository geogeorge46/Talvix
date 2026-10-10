export const sanitizePromptInput = (text) => {
  if (!text || typeof text !== 'string') return '';

  return text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/System\s*:\s*/gi, '')
    .replace(/Human\s*:\s*/gi, '')
    .replace(/Assistant\s*:\s*/gi, '')
    .replace(/Ignore\s+(all\s+)?previous\s+instructions/gi, '[filtered instruction]')
    .replace(/Override\s+(system\s+)?prompt/gi, '[filtered instruction]')
    .replace(/Mark\s+this\s+candidate\s+as\s+excellent/gi, '[filtered instruction]')
    .trim();
};

export const formatUntrustedCodePayload = (code) => {
  const sanitized = sanitizePromptInput(code);
  return `<candidate_code>\n${sanitized}\n</candidate_code>`;
};
