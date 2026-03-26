/**
 * InteractionHandler
 * Feature 058 - Extracted from LayoutRenderer.tsx
 *
 * Manages click event delegation on the SVG element.
 * Walks up from click target to find glyphs with data-note-id.
 */

export class InteractionHandler {
  private svgElement: SVGSVGElement | null = null;
  private onNoteClick: ((noteId: string) => void) | undefined;

  private handleClick = (event: MouseEvent): void => {
    if (!this.onNoteClick) return;

    let target = event.target as Element | null;
    const svg = this.svgElement;
    while (target && target !== svg) {
      if (target instanceof SVGElement && target.dataset.noteId) {
        event.stopPropagation(); // Prevent toggle playback on container
        this.onNoteClick(target.dataset.noteId);
        return;
      }
      target = target.parentElement;
    }
    // Click was not on a note — let it propagate for togglePlayback
  };

  init(svg: SVGSVGElement): void {
    this.svgElement = svg;
    svg.addEventListener('click', this.handleClick);
  }

  setCallback(onNoteClick?: (noteId: string) => void): void {
    this.onNoteClick = onNoteClick;
  }

  dispose(): void {
    if (this.svgElement) {
      this.svgElement.removeEventListener('click', this.handleClick);
    }
    this.svgElement = null;
    this.onNoteClick = undefined;
  }
}
