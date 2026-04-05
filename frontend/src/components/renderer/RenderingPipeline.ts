/**
 * RenderingPipeline
 * Feature 058 - Extracted from LayoutRenderer.tsx
 *
 * Responsible for SVG element creation from the layout hierarchy:
 * System → StaffGroup → Staff → GlyphRun → Glyph traversal.
 */

import type { GlobalLayout, System, StaffGroup, Staff, GlyphRun, BarLine, Glyph } from '../../wasm/layout';
import type { RenderConfig } from '../../types/RenderConfig';
import type { Viewport } from '../../types/Viewport';
import { createSVGElement, createSVGGroup, svgNS } from '../../utils/svgHelpers';
import { getVisibleSystems } from '../../utils/viewportUtils';
import { createSourceKey } from '../../services/highlight/sourceMapping';

/** Staff line stroke width in SVG units. */
export const STAFF_LINE_STROKE_WIDTH = 1.5;

/** Ledger line stroke width — slightly heavier than staff lines for visibility. */
export const LEDGER_LINE_STROKE_WIDTH = 2.0;

export interface RenderOptions {
  hideMeasureNumbers?: boolean;
  selectedNoteId?: string;
  sourceToNoteIdMap?: Map<string, string>;
  /** Units per space from layout — used for fingering font size */
  unitsPerSpace?: number;
}

export class RenderingPipeline {
  private svgElement: SVGSVGElement | null = null;

  init(svg: SVGSVGElement): void {
    this.svgElement = svg;
  }

  /**
   * Render all visible systems from layout into SVG.
   * Clears SVG before rendering (fresh render each call).
   */
  renderAll(
    layout: GlobalLayout,
    config: RenderConfig,
    viewport: Viewport,
    options?: RenderOptions,
  ): void {
    const svg = this.svgElement;
    if (!svg) {
      console.warn('RenderingPipeline: SVG element not available');
      return;
    }

    // Clear existing content
    while (svg.firstChild) {
      svg.removeChild(svg.firstChild);
    }

    // Set background color
    svg.style.backgroundColor = config.backgroundColor;

    // Set viewBox to match layout coordinate system
    svg.setAttribute(
      'viewBox',
      `${viewport.x} ${viewport.y} ${viewport.width} ${viewport.height}`
    );

    // Query visible systems using virtualization
    const visibleSystems = getVisibleSystems(layout.systems, viewport);

    // Create document fragment for efficient DOM insertion
    const fragment = document.createDocumentFragment();

    for (const system of visibleSystems) {
      const systemGroup = this.renderSystem(system, 0, 0, config, options);
      fragment.appendChild(systemGroup);
    }

    svg.appendChild(fragment);
  }

  /**
   * Render error message when layout is missing.
   */
  renderError(message: string): void {
    const svg = this.svgElement;
    if (!svg) return;

    while (svg.firstChild) {
      svg.removeChild(svg.firstChild);
    }

    const text = createSVGElement('text');
    text.setAttribute('x', '50%');
    text.setAttribute('y', '50%');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('font-family', 'system-ui, sans-serif');
    text.setAttribute('font-size', '16');
    text.setAttribute('fill', '#999999');
    text.textContent = message;
    svg.appendChild(text);
  }

  dispose(): void {
    this.svgElement = null;
  }

  // ─── Private rendering methods ─────────────────────────────────

  private renderSystem(
    system: System,
    offsetX: number,
    offsetY: number,
    config: RenderConfig,
    options?: RenderOptions,
  ): SVGGElement {
    const systemGroup = createSVGGroup();

    const x = system.bounding_box.x + offsetX;
    const y = offsetY;
    systemGroup.setAttribute('transform', `translate(${x}, ${y})`);
    systemGroup.setAttribute('data-system-index', system.index.toString());

    // Measure number above the system
    if (system.measure_number && !options?.hideMeasureNumbers) {
      const text = createSVGElement('text');
      text.setAttribute('x', system.measure_number.position.x.toString());
      text.setAttribute('y', system.measure_number.position.y.toString());
      text.setAttribute('font-family', config.fontFamily);
      text.setAttribute('font-size', '40');
      text.setAttribute('fill', config.staffLineColor);
      text.setAttribute('data-measure-number', system.measure_number.number.toString());
      text.textContent = system.measure_number.number.toString();
      systemGroup.appendChild(text);
    }

    // Volta brackets (Feature 047)
    if (system.volta_bracket_layouts) {
      for (const vbl of system.volta_bracket_layouts) {
        const bracketGroup = createSVGGroup();
        bracketGroup.setAttribute('data-volta-number', vbl.number.toString());
        const strokeColor = config.staffLineColor;
        const strokeWidth = '2';
        const verticalStrokeHeight = 15;

        const hLine = createSVGElement('line');
        hLine.setAttribute('x1', vbl.x_start.toString());
        hLine.setAttribute('y1', vbl.y.toString());
        hLine.setAttribute('x2', vbl.x_end.toString());
        hLine.setAttribute('y2', vbl.y.toString());
        hLine.setAttribute('stroke', strokeColor);
        hLine.setAttribute('stroke-width', strokeWidth);
        bracketGroup.appendChild(hLine);

        const leftStroke = createSVGElement('line');
        leftStroke.setAttribute('x1', vbl.x_start.toString());
        leftStroke.setAttribute('y1', vbl.y.toString());
        leftStroke.setAttribute('x2', vbl.x_start.toString());
        leftStroke.setAttribute('y2', (vbl.y + verticalStrokeHeight).toString());
        leftStroke.setAttribute('stroke', strokeColor);
        leftStroke.setAttribute('stroke-width', strokeWidth);
        bracketGroup.appendChild(leftStroke);

        if (vbl.closed_right) {
          const rightStroke = createSVGElement('line');
          rightStroke.setAttribute('x1', vbl.x_end.toString());
          rightStroke.setAttribute('y1', vbl.y.toString());
          rightStroke.setAttribute('x2', vbl.x_end.toString());
          rightStroke.setAttribute('y2', (vbl.y + verticalStrokeHeight).toString());
          rightStroke.setAttribute('stroke', strokeColor);
          rightStroke.setAttribute('stroke-width', strokeWidth);
          bracketGroup.appendChild(rightStroke);
        }

        const label = createSVGElement('text');
        label.setAttribute('x', (vbl.x_start + 5).toString());
        label.setAttribute('y', (vbl.y - 3).toString());
        label.setAttribute('font-family', config.fontFamily);
        label.setAttribute('font-size', '32');
        label.setAttribute('fill', strokeColor);
        label.textContent = vbl.label;
        bracketGroup.appendChild(label);

        systemGroup.appendChild(bracketGroup);
      }
    }

    // Ottava brackets (8va/8vb)
    if (system.ottava_bracket_layouts) {
      for (const obl of system.ottava_bracket_layouts) {
        const bracketGroup = createSVGGroup();
        bracketGroup.setAttribute('data-ottava', obl.label);
        const strokeColor = config.staffLineColor;
        const strokeWidth = '1.5';
        const hookLength = 12;
        const dashArray = obl.closed_right ? '' : '4 3';

        const hLine = createSVGElement('line');
        hLine.setAttribute('x1', obl.x_start.toString());
        hLine.setAttribute('y1', obl.y.toString());
        hLine.setAttribute('x2', obl.x_end.toString());
        hLine.setAttribute('y2', obl.y.toString());
        hLine.setAttribute('stroke', strokeColor);
        hLine.setAttribute('stroke-width', strokeWidth);
        if (dashArray) hLine.setAttribute('stroke-dasharray', dashArray);
        bracketGroup.appendChild(hLine);

        const hookDir = obl.above ? 1 : -1;
        const leftHook = createSVGElement('line');
        leftHook.setAttribute('x1', obl.x_start.toString());
        leftHook.setAttribute('y1', obl.y.toString());
        leftHook.setAttribute('x2', obl.x_start.toString());
        leftHook.setAttribute('y2', (obl.y + hookDir * hookLength).toString());
        leftHook.setAttribute('stroke', strokeColor);
        leftHook.setAttribute('stroke-width', strokeWidth);
        bracketGroup.appendChild(leftHook);

        if (obl.closed_right) {
          const rightHook = createSVGElement('line');
          rightHook.setAttribute('x1', obl.x_end.toString());
          rightHook.setAttribute('y1', obl.y.toString());
          rightHook.setAttribute('x2', obl.x_end.toString());
          rightHook.setAttribute('y2', (obl.y + hookDir * hookLength).toString());
          rightHook.setAttribute('stroke', strokeColor);
          rightHook.setAttribute('stroke-width', strokeWidth);
          bracketGroup.appendChild(rightHook);
        }

        const label = createSVGElement('text');
        label.setAttribute('x', (obl.x_start + 4).toString());
        const labelY = obl.above ? obl.y - 4 : obl.y + 20;
        label.setAttribute('y', labelY.toString());
        label.setAttribute('font-family', config.fontFamily);
        label.setAttribute('font-size', '28');
        label.setAttribute('font-style', 'italic');
        label.setAttribute('fill', strokeColor);
        label.textContent = obl.label;
        bracketGroup.appendChild(label);

        systemGroup.appendChild(bracketGroup);
      }
    }

    // Staff groups
    for (const staffGroup of system.staff_groups) {
      const staffGroupElement = this.renderStaffGroup(staffGroup, system.index, config, system.staff_groups.length, options);
      systemGroup.appendChild(staffGroupElement);
    }

    // System bracket for multiple instruments
    if (system.staff_groups.length > 1) {
      const firstGroup = system.staff_groups[0];
      const lastGroup = system.staff_groups[system.staff_groups.length - 1];
      const topY = firstGroup.staves[0].staff_lines[0].y_position;
      const bottomY = lastGroup.staves[lastGroup.staves.length - 1].staff_lines[4].y_position;

      const bracketLine = createSVGElement('line');
      bracketLine.setAttribute('x1', '0');
      bracketLine.setAttribute('y1', topY.toString());
      bracketLine.setAttribute('x2', '0');
      bracketLine.setAttribute('y2', bottomY.toString());
      bracketLine.setAttribute('stroke', config.staffLineColor);
      bracketLine.setAttribute('stroke-width', '3');
      bracketLine.setAttribute('data-system-bracket', 'true');
      systemGroup.appendChild(bracketLine);
    }

    return systemGroup;
  }

  private renderStaffGroup(
    staffGroup: StaffGroup,
    systemIndex: number,
    config: RenderConfig,
    systemGroupCount: number = 1,
    options?: RenderOptions,
  ): SVGGElement {
    const staffGroupElement = createSVGGroup();
    staffGroupElement.setAttribute('data-staff-group', 'true');
    staffGroupElement.setAttribute('data-instrument-id', staffGroup.instrument_id);

    for (const staff of staffGroup.staves) {
      const staffElement = this.renderStaff(staff, systemIndex, config, options);
      staffGroupElement.appendChild(staffElement);
    }

    if (staffGroup.staves.length > 1 && staffGroup.bracket_type !== 'None') {
      const bracketElement = this.renderBracket(staffGroup, config);
      if (bracketElement) {
        staffGroupElement.appendChild(bracketElement);
      }
    }

    if (staffGroup.name_label && systemGroupCount > 1) {
      const { name_label } = staffGroup;
      const textElement = document.createElementNS(svgNS, 'text');
      textElement.setAttribute('x', String(name_label.position.x));
      textElement.setAttribute('y', String(name_label.position.y));
      textElement.setAttribute('font-size', String(name_label.font_size));
      textElement.setAttribute('font-family', name_label.font_family);
      textElement.setAttribute('fill', `rgba(${name_label.color.r},${name_label.color.g},${name_label.color.b},${name_label.color.a / 255})`);
      textElement.setAttribute('text-anchor', 'end');
      textElement.setAttribute('dominant-baseline', 'central');
      textElement.setAttribute('data-instrument-name', 'true');
      textElement.textContent = name_label.text;
      staffGroupElement.appendChild(textElement);
    }

    return staffGroupElement;
  }

  renderBracket(staffGroup: StaffGroup, config: RenderConfig): SVGGElement | null {
    const { bracket_glyph, bracket_type } = staffGroup;
    if (!bracket_glyph) return null;

    const bracketGroup = createSVGGroup();
    bracketGroup.setAttribute('class', 'bracket');
    bracketGroup.setAttribute('data-bracket-type', bracket_type.toLowerCase());

    if (bracket_type === 'Bracket') {
      const x = bracket_glyph.x;
      const topY = bracket_glyph.bounding_box.y;
      const bottomY = topY + bracket_glyph.bounding_box.height;
      const color = config.staffLineColor;
      const barWidth = 5;
      const serifWidth = 12;

      const bar = createSVGElement('line');
      bar.setAttribute('x1', x.toString());
      bar.setAttribute('y1', topY.toString());
      bar.setAttribute('x2', x.toString());
      bar.setAttribute('y2', bottomY.toString());
      bar.setAttribute('stroke', color);
      bar.setAttribute('stroke-width', barWidth.toString());
      bar.setAttribute('stroke-linecap', 'butt');
      bracketGroup.appendChild(bar);

      const topSerif = createSVGElement('line');
      topSerif.setAttribute('x1', (x - barWidth / 2).toString());
      topSerif.setAttribute('y1', topY.toString());
      topSerif.setAttribute('x2', (x + serifWidth).toString());
      topSerif.setAttribute('y2', topY.toString());
      topSerif.setAttribute('stroke', color);
      topSerif.setAttribute('stroke-width', '2.5');
      topSerif.setAttribute('stroke-linecap', 'butt');
      bracketGroup.appendChild(topSerif);

      const bottomSerif = createSVGElement('line');
      bottomSerif.setAttribute('x1', (x - barWidth / 2).toString());
      bottomSerif.setAttribute('y1', bottomY.toString());
      bottomSerif.setAttribute('x2', (x + serifWidth).toString());
      bottomSerif.setAttribute('y2', bottomY.toString());
      bottomSerif.setAttribute('stroke', color);
      bottomSerif.setAttribute('stroke-width', '2.5');
      bottomSerif.setAttribute('stroke-linecap', 'butt');
      bracketGroup.appendChild(bottomSerif);

      return bracketGroup;
    }

    // Brace: Bézier path
    {
      const bb = bracket_glyph.bounding_box;
      const topY  = bb.y;
      const H     = bb.height;
      const bottomY = topY + H;
      const centerY = topY + H / 2;
      const color = config.staffLineColor;

      const xRight = bb.x + bb.width;
      const xBulge = bb.x;
      const xSpike = bb.x - bb.width * 0.25;

      const d = [
        `M ${xRight},${topY}`,
        `C ${xRight},${topY + H * 0.08}  ${xBulge},${topY + H * 0.04}  ${xBulge},${topY + H * 0.25}`,
        `C ${xBulge},${topY + H * 0.44}  ${xRight},${topY + H * 0.44}  ${xSpike},${centerY}`,
        `C ${xRight},${centerY + H * 0.06}  ${xBulge},${bottomY - H * 0.44}  ${xBulge},${bottomY - H * 0.25}`,
        `C ${xBulge},${bottomY - H * 0.04}  ${xRight},${bottomY - H * 0.08}  ${xRight},${bottomY}`,
      ].join(' ');

      const path = createSVGElement('path');
      path.setAttribute('d', d);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', color);
      path.setAttribute('stroke-width', '2');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
      bracketGroup.appendChild(path);

      return bracketGroup;
    }
  }

  private renderStaff(
    staff: Staff,
    systemIndex: number,
    config: RenderConfig,
    options?: RenderOptions,
  ): SVGGElement {
    const staffElement = createSVGGroup();
    staffElement.setAttribute('class', 'staff');

    // 5 staff lines
    for (const staffLine of staff.staff_lines) {
      if (isNaN(staffLine.y_position) || isNaN(staffLine.start_x) || isNaN(staffLine.end_x)) {
        console.error('Invalid staff line position:', staffLine);
        continue;
      }

      const line = createSVGElement('line');
      line.setAttribute('x1', staffLine.start_x.toString());
      line.setAttribute('y1', staffLine.y_position.toString());
      line.setAttribute('x2', staffLine.end_x.toString());
      line.setAttribute('y2', staffLine.y_position.toString());
      line.setAttribute('stroke', config.staffLineColor);
      line.setAttribute('stroke-width', STAFF_LINE_STROKE_WIDTH.toString());
      staffElement.appendChild(line);
    }

    // Bar lines
    if (staff.bar_lines) {
      for (const barLine of staff.bar_lines) {
        const barLineElement = this.renderBarLine(barLine, config);
        staffElement.appendChild(barLineElement);
      }
    }

    // Ledger lines
    if (staff.ledger_lines) {
      for (const ledgerLine of staff.ledger_lines) {
        const line = createSVGElement('line');
        line.setAttribute('x1', ledgerLine.start_x.toString());
        line.setAttribute('y1', ledgerLine.y_position.toString());
        line.setAttribute('x2', ledgerLine.end_x.toString());
        line.setAttribute('y2', ledgerLine.y_position.toString());
        line.setAttribute('stroke', config.staffLineColor);
        line.setAttribute('stroke-width', LEDGER_LINE_STROKE_WIDTH.toString());
        staffElement.appendChild(line);
      }
    }

    // Glyph runs
    for (const glyphRun of staff.glyph_runs) {
      const glyphRunElement = this.renderGlyphRun(glyphRun, systemIndex, config, options);
      staffElement.appendChild(glyphRunElement);
    }

    // Structural glyphs (clefs, key signatures, time signatures)
    for (const glyph of staff.structural_glyphs) {
      const fontSize = glyph.font_size ?? 80;
      const glyphElement = this.renderGlyph(glyph, config.fontFamily, fontSize, config.glyphColor);
      staffElement.appendChild(glyphElement);
    }

    // Notation dots (augmentation and staccato)
    for (const dot of staff.notation_dots ?? []) {
      const circle = createSVGElement('circle');
      circle.setAttribute('cx', dot.x.toString());
      circle.setAttribute('cy', dot.y.toString());
      circle.setAttribute('r', dot.radius.toString());
      circle.setAttribute('fill', config.glyphColor);
      staffElement.appendChild(circle);
    }

    // Tie arcs
    for (const arc of staff.tie_arcs ?? []) {
      const path = createSVGElement('path');
      const d = `M ${arc.start.x},${arc.start.y} C ${arc.cp1.x},${arc.cp1.y} ${arc.cp2.x},${arc.cp2.y} ${arc.end.x},${arc.end.y}`;
      path.setAttribute('d', d);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', config.glyphColor);
      path.setAttribute('stroke-width', '1.5');
      path.classList.add('tie-arc');
      staffElement.appendChild(path);
    }

    // Slur arcs (filled tapered crescents)
    for (const arc of staff.slur_arcs ?? []) {
      const path = createSVGElement('path');
      const thickness = 2.5;
      const dir = arc.above ? 1 : -1;
      const outer = `M ${arc.start.x},${arc.start.y} C ${arc.cp1.x},${arc.cp1.y} ${arc.cp2.x},${arc.cp2.y} ${arc.end.x},${arc.end.y}`;
      const inner = `C ${arc.cp2.x},${arc.cp2.y + thickness * dir} ${arc.cp1.x},${arc.cp1.y + thickness * dir} ${arc.start.x},${arc.start.y}`;
      const d = `${outer} ${inner} Z`;
      path.setAttribute('d', d);
      path.setAttribute('fill', config.glyphColor);
      path.setAttribute('stroke', 'none');
      path.classList.add('slur-arc');
      staffElement.appendChild(path);
    }

    // Fingering annotations
    const fingeringGlyphs = staff.fingering_glyphs ?? [];
    for (const fg of fingeringGlyphs) {
      const text = createSVGElement('text');
      text.setAttribute('x', fg.x.toString());
      text.setAttribute('y', fg.y.toString());
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'middle');
      text.setAttribute('font-family', 'serif');
      text.setAttribute('font-size', ((options?.unitsPerSpace ?? 20) * 1.4).toString());
      text.setAttribute('fill', config.glyphColor);
      text.classList.add('fingering-glyph');
      text.textContent = fg.digit.toString();
      staffElement.appendChild(text);
    }

    // Dynamic markings and hairpins
    this.renderDynamics(staff, staffElement, config);

    return staffElement;
  }

  private renderDynamics(staff: Staff, staffElement: SVGGElement, config: RenderConfig): void {
    // Static dynamic glyphs (ppp through fff, or fallback text)
    for (const glyph of staff.dynamic_glyphs ?? []) {
      const text = createSVGElement('text');
      text.setAttribute('x', glyph.x.toString());
      text.setAttribute('y', glyph.y.toString());

      if (glyph.codepoint !== '') {
        // SMuFL glyph via Bravura font
        text.setAttribute('font-family', 'Bravura');
        text.setAttribute('font-size', glyph.font_size.toString());
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'middle');
        text.setAttribute('fill', config.glyphColor);
        text.textContent = glyph.codepoint;
      } else {
        // Fallback italic text (e.g. "dyn" for unrecognised dynamics)
        text.setAttribute('font-style', 'italic');
        text.setAttribute('font-family', 'serif');
        text.setAttribute('font-size', (glyph.font_size * 0.5).toString());
        text.setAttribute('fill', config.glyphColor);
        text.textContent = glyph.label;
      }

      text.classList.add('dynamic-glyph');
      staffElement.appendChild(text);
    }

    // Hairpin crescendo/diminuendo wedge lines
    for (const hp of staff.hairpin_layouts ?? []) {
      const halfOpening = hp.opening / 2;

      let x1Top: number, y1Top: number, x2Top: number, y2Top: number;
      let x1Bot: number, y1Bot: number, x2Bot: number, y2Bot: number;

      if (hp.direction === 'Crescendo') {
        // Point at start, open at end
        x1Top = hp.x_start; y1Top = hp.y_center;
        x2Top = hp.x_end;   y2Top = hp.y_center - halfOpening;
        x1Bot = hp.x_start; y1Bot = hp.y_center;
        x2Bot = hp.x_end;   y2Bot = hp.y_center + halfOpening;
      } else {
        // Open at start, point at end
        x1Top = hp.x_start; y1Top = hp.y_center - halfOpening;
        x2Top = hp.x_end;   y2Top = hp.y_center;
        x1Bot = hp.x_start; y1Bot = hp.y_center + halfOpening;
        x2Bot = hp.x_end;   y2Bot = hp.y_center;
      }

      const topArm = createSVGElement('line');
      topArm.setAttribute('x1', x1Top.toString());
      topArm.setAttribute('y1', y1Top.toString());
      topArm.setAttribute('x2', x2Top.toString());
      topArm.setAttribute('y2', y2Top.toString());
      topArm.setAttribute('stroke', config.staffLineColor);
      topArm.setAttribute('stroke-width', '1.5');
      topArm.setAttribute('fill', 'none');
      topArm.classList.add('hairpin');
      staffElement.appendChild(topArm);

      const bottomArm = createSVGElement('line');
      bottomArm.setAttribute('x1', x1Bot.toString());
      bottomArm.setAttribute('y1', y1Bot.toString());
      bottomArm.setAttribute('x2', x2Bot.toString());
      bottomArm.setAttribute('y2', y2Bot.toString());
      bottomArm.setAttribute('stroke', config.staffLineColor);
      bottomArm.setAttribute('stroke-width', '1.5');
      bottomArm.setAttribute('fill', 'none');
      bottomArm.classList.add('hairpin');
      staffElement.appendChild(bottomArm);
    }
  }

  private renderBarLine(barLine: BarLine, config: RenderConfig): SVGGElement {
    const barLineGroup = createSVGGroup();
    barLineGroup.setAttribute('class', 'bar-line');
    barLineGroup.setAttribute('data-bar-type', barLine.bar_type);

    const strokeColor = config.staffLineColor;

    for (const segment of barLine.segments) {
      const line = createSVGElement('line');
      line.setAttribute('x1', segment.x_position.toString());
      line.setAttribute('y1', segment.y_start.toString());
      line.setAttribute('x2', segment.x_position.toString());
      line.setAttribute('y2', segment.y_end.toString());
      line.setAttribute('stroke', strokeColor);
      line.setAttribute('stroke-width', segment.stroke_width.toString());
      barLineGroup.appendChild(line);
    }

    for (const dot of barLine.dots ?? []) {
      const circle = createSVGElement('circle');
      circle.setAttribute('cx', dot.x.toString());
      circle.setAttribute('cy', dot.y.toString());
      circle.setAttribute('r', dot.radius.toString());
      circle.setAttribute('fill', strokeColor);
      barLineGroup.appendChild(circle);
    }

    return barLineGroup;
  }

  renderGlyphRun(
    run: GlyphRun,
    systemIndex: number,
    _config: RenderConfig,
    options?: RenderOptions,
  ): SVGGElement {
    const glyphRunGroup = createSVGGroup();
    glyphRunGroup.setAttribute('class', 'glyph-run');

    const fontFamily = run.font_family || 'Bravura';
    const fontSize = run.font_size || 40;
    const color = run.color ? `rgb(${run.color.r}, ${run.color.g}, ${run.color.b})` : '#000000';
    const runOpacity = run.opacity != null && run.opacity < 1.0 ? run.opacity : undefined;
    if (runOpacity !== undefined) {
      glyphRunGroup.setAttribute('opacity', runOpacity.toString());
    }

    const { sourceToNoteIdMap, selectedNoteId } = options ?? {};

    for (const glyph of run.glyphs) {
      let noteId: string | undefined;
      let isSelected = false;
      if (sourceToNoteIdMap && glyph.source_reference) {
        const sourceKey = createSourceKey({
          system_index: systemIndex,
          ...glyph.source_reference
        });
        noteId = sourceToNoteIdMap.get(sourceKey);

        if (noteId) {
          if (selectedNoteId === noteId) {
            isSelected = true;
          }
        }
      }

      const glyphElement = this.renderGlyph(glyph, fontFamily, fontSize, color, isSelected);
      if (noteId) {
        (glyphElement as SVGElement).dataset.noteId = noteId;
        const isBeam = glyph.codepoint === '\u0001' || glyph.codepoint === '\x01';
        if (!isBeam) {
          glyphElement.classList.add('layout-glyph');
        }
        glyphElement.style.cursor = 'pointer';
      }
      glyphRunGroup.appendChild(glyphElement);

      // Transparent hit-rect overlay per notehead (44px minimum touch target)
      if (noteId) {
        const MIN_TOUCH_PX = 44;
        const renderScale = 1;
        const bb = glyph.bounding_box;
        const hitW = Math.max(bb.width, MIN_TOUCH_PX / renderScale);
        const hitH = Math.max(bb.height, MIN_TOUCH_PX / renderScale);
        const hitX = bb.x - (hitW - bb.width) / 2;
        const hitY = bb.y - (hitH - bb.height) / 2;

        const hitRect = createSVGElement('rect') as SVGRectElement;
        hitRect.setAttribute('x', hitX.toString());
        hitRect.setAttribute('y', hitY.toString());
        hitRect.setAttribute('width', hitW.toString());
        hitRect.setAttribute('height', hitH.toString());
        hitRect.setAttribute('fill', 'transparent');
        hitRect.setAttribute('pointer-events', 'all');
        hitRect.setAttribute('cursor', 'pointer');
        (hitRect as SVGElement).dataset.noteId = noteId;
        glyphRunGroup.appendChild(hitRect);
      }
    }

    return glyphRunGroup;
  }

  renderGlyph(
    glyph: Glyph,
    fontFamily: string,
    fontSize: number,
    color: string,
    isSelected = false,
  ): SVGElement {
    const codepoint = glyph.codepoint;

    const fillColor = isSelected ? '#FF6B00' : color;
    const strokeColor = isSelected ? '#CC5500' : color;

    // U+0000: Stem (vertical line)
    if (codepoint === '\u{0000}' || codepoint === '\0') {
      const line = createSVGElement('line');
      line.setAttribute('x1', glyph.position.x.toString());
      line.setAttribute('y1', glyph.position.y.toString());
      line.setAttribute('x2', glyph.position.x.toString());
      line.setAttribute('y2', (glyph.position.y + glyph.bounding_box.height).toString());
      line.setAttribute('stroke', strokeColor);
      line.setAttribute('stroke-width', glyph.bounding_box.width.toString());
      line.setAttribute('stroke-linecap', 'butt');
      if (isSelected) {
        line.setAttribute('class', 'selected');
      }
      return line;
    }

    // U+0001: Beam (filled polygon)
    if (codepoint === '\u{0001}' || codepoint === '\x01') {
      const x1 = glyph.position.x;
      const y1Top = glyph.position.y;
      const x2 = x1 + glyph.bounding_box.width;
      const y2Top = glyph.bounding_box.y;
      const thickness = glyph.bounding_box.height;

      const polygon = createSVGElement('polygon');
      const points = `${x1},${y1Top} ${x2},${y2Top} ${x2},${y2Top + thickness} ${x1},${y1Top + thickness}`;
      polygon.setAttribute('points', points);
      polygon.setAttribute('fill', fillColor);
      if (isSelected) {
        polygon.setAttribute('class', 'selected');
      }
      return polygon;
    }

    // Regular SMuFL glyph (text element)
    const text = createSVGElement('text');

    if (isNaN(glyph.position.x) || isNaN(glyph.position.y)) {
      console.error('Invalid glyph position:', glyph);
      text.setAttribute('x', '0');
      text.setAttribute('y', '0');
    } else {
      text.setAttribute('x', glyph.position.x.toString());
      text.setAttribute('y', glyph.position.y.toString());
    }

    text.setAttribute('font-family', fontFamily);
    text.setAttribute('font-size', fontSize.toString());
    text.setAttribute('fill', fillColor);
    if (isSelected) {
      text.setAttribute('class', 'selected');
    }

    text.setAttribute('text-anchor', 'middle');

    const cp = codepoint.codePointAt(0) ?? 0;
    const isRest = cp >= 0xE4E3 && cp <= 0xE4EB;
    const isFlag = cp >= 0xE240 && cp <= 0xE24F;
    text.setAttribute('dominant-baseline', (isRest || isFlag) ? 'auto' : 'middle');

    try {
      text.textContent = glyph.codepoint;
    } catch (error) {
      console.warn(`Invalid SMuFL codepoint: ${glyph.codepoint}`, error);
      text.textContent = '\u25A1';
      text.setAttribute('fill', '#FF0000');
    }

    return text;
  }
}
