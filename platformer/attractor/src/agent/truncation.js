// Character-first truncation (primary safeguard), then line-based.
// Full output is always emitted via TOOL_CALL_END event before truncation.

const CHAR_LIMITS = {
  read_file:  50_000,
  shell:      30_000,
  grep:       20_000,
  glob:       10_000,
  list_dir:   10_000,
  write_file:  5_000,
  default:    20_000,
};

const LINE_LIMITS = {
  read_file: 2000,
  shell:     1000,
  grep:       500,
  default:    500,
};

export function truncate(output, toolName = 'default') {
  if (typeof output !== 'string') output = JSON.stringify(output, null, 2);

  // Phase 1: character-based (handles pathological cases like 10MB single-line CSVs)
  const charLimit = CHAR_LIMITS[toolName] ?? CHAR_LIMITS.default;
  if (output.length > charLimit) {
    const head = Math.floor(charLimit * 0.6);
    const tail  = charLimit - head;
    const omitted = output.length - head - tail;
    output = output.slice(0, head)
      + `\n\n[... ${omitted.toLocaleString()} characters truncated ...]\n\n`
      + output.slice(-tail);
  }

  // Phase 2: line-based
  const lineLimit = LINE_LIMITS[toolName] ?? LINE_LIMITS.default;
  const lines = output.split('\n');
  if (lines.length > lineLimit) {
    const headLines = Math.floor(lineLimit * 0.6);
    const tailLines = lineLimit - headLines;
    const omitted = lines.length - headLines - tailLines;
    output = [
      ...lines.slice(0, headLines),
      `\n[... ${omitted.toLocaleString()} lines truncated ...]\n`,
      ...lines.slice(-tailLines),
    ].join('\n');
  }

  return output;
}
