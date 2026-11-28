/**
 * The generation report (data-model.md §7): the per-run summary that lets the
 * author judge a draft without reading the flow in full, and records the
 * evidence the success criteria are measured against.
 */

export interface ResolvedRef {
  step: string;
  target: string;
}

export interface UnresolvedRef {
  step: string;
  reason: string;
  candidates: string[];
}

export interface ReportInput {
  flowId: string;
  /** Goal submission → flow file written, in ms (SC-001). */
  elapsedMs: number;
  /** Time in the deterministic element lookup (research D7). */
  lookupMs: number;
  /** How many steps were written to the flow. */
  stepsProduced: number;
  resolved: ResolvedRef[];
  unresolved: UnresolvedRef[];
  /** Extra annotation gaps worth closing. */
  gaps?: string[];
}

export interface GenerationReport {
  flowId: string;
  elapsedMs: number;
  lookupMs: number;
  stepsProduced: number;
  resolved: ResolvedRef[];
  unresolved: UnresolvedRef[];
  gaps: string[];
}

/**
 * Build the report. Every unresolved step is guaranteed to appear in `gaps`
 * (spec Edge Case "Control is not annotated"), so an author can act on it.
 */
export function buildReport(input: ReportInput): GenerationReport {
  const gaps = [...(input.gaps ?? [])];
  for (const u of input.unresolved) {
    const candidates = u.candidates.length ? `; candidates: ${u.candidates.join(', ')}` : '';
    const line = `No annotated control resolved for "${u.step}" (${u.reason})${candidates}.`;
    if (!gaps.some((g) => g.includes(u.step))) gaps.push(line);
  }

  return {
    flowId: input.flowId,
    elapsedMs: input.elapsedMs,
    lookupMs: input.lookupMs,
    stepsProduced: input.stepsProduced,
    resolved: input.resolved,
    unresolved: input.unresolved,
    gaps,
  };
}

/** Human-readable one-screen summary for the author. */
export function formatReport(report: GenerationReport): string {
  const lines = [
    `Flow: ${report.flowId} (${report.stepsProduced} steps)`,
    `Time: ${report.elapsedMs} ms (lookup ${report.lookupMs} ms)`,
    `Resolved: ${report.resolved.length}`,
    `Unresolved: ${report.unresolved.length}`,
  ];
  for (const u of report.unresolved) {
    lines.push(`  ✗ ${u.step} — ${u.reason}${u.candidates.length ? ` (try: ${u.candidates.join(', ')})` : ''}`);
  }
  if (report.gaps.length) {
    lines.push('Gaps to close:');
    for (const g of report.gaps) lines.push(`  · ${g}`);
  }
  return lines.join('\n');
}
