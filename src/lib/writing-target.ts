import type { Point } from 'hanzi-writer';

const SVG_NS = 'http://www.w3.org/2000/svg';
type BoundEvent = { getPoint(): Point; preventDefault(): void };

// SVG target theo hợp đồng renderer Hanzi Writer, nhưng dùng Pointer Events có thể hủy.
// Một bộ listener xử lý chuột, ngón tay và bút, không để lại listener trên document khi đổi chữ.
export class WritingTarget {
  readonly node: SVGSVGElement | SVGGElement;
  private pointerId: number | null = null;
  constructor(readonly svg: SVGSVGElement | SVGGElement, readonly defs: SVGDefsElement,
    private root: SVGSVGElement, private signal: AbortSignal) { this.node = svg; }
  createSubRenderTarget(): WritingTarget {
    const group = document.createElementNS(SVG_NS, 'g');
    this.svg.appendChild(group);
    return new WritingTarget(group, this.defs, this.root, this.signal);
  }
  getBoundingClientRect() { return this.node.getBoundingClientRect(); }
  updateDimensions(width: number | string, height: number | string) {
    this.node.setAttribute('width', String(width)); this.node.setAttribute('height', String(height));
  }
  _getMousePoint(event: MouseEvent): Point {
    const matrix = this.root.getScreenCTM();
    if (matrix) {
      const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
      return { x: point.x, y: point.y };
    }
    const bounds = this.root.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  }
  _getTouchPoint(event: TouchEvent): Point {
    const touch = event.touches[0];
    return this._getMousePoint({ clientX: touch.clientX, clientY: touch.clientY } as MouseEvent);
  }
  _eventify<TEvent extends Event>(event: TEvent, point: (event: TEvent) => Point): BoundEvent {
    return { getPoint: () => point.call(this, event), preventDefault: () => event.preventDefault() };
  }
  addPointerStartListener(callback: (event: BoundEvent) => void) {
    this.root.addEventListener('pointerdown', event => {
      if (!event.isPrimary || event.button !== 0 || this.pointerId !== null) return;
      this.pointerId = event.pointerId;
      this.root.setPointerCapture(event.pointerId);
      callback(this._eventify(event, this._getMousePoint));
    }, { signal: this.signal });
  }
  addPointerMoveListener(callback: (event: BoundEvent) => void) {
    this.root.addEventListener('pointermove', event => {
      if (event.pointerId === this.pointerId) callback(this._eventify(event, this._getMousePoint));
    }, { signal: this.signal });
  }
  addPointerEndListener(callback: () => void) {
    const end = (event: PointerEvent) => {
      if (event.pointerId !== this.pointerId) return;
      this.pointerId = null;
      callback();
      if (this.root.hasPointerCapture(event.pointerId)) this.root.releasePointerCapture(event.pointerId);
    };
    // Capture tiếp tục nhận pointerup dù bút ra ngoài ô; lost capture cũng kết thúc đúng một lần.
    this.root.addEventListener('pointerup', end, { signal: this.signal });
    this.root.addEventListener('pointercancel', end, { signal: this.signal });
    this.root.addEventListener('lostpointercapture', end, { signal: this.signal });
  }
}
export function createWritingTarget(host: HTMLElement, width: string | number | null | undefined,
  height: string | number | null | undefined, signal: AbortSignal): WritingTarget {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', String(width ?? 320)); svg.setAttribute('height', String(height ?? 320));
  svg.setAttribute('aria-hidden', 'true');
  const defs = document.createElementNS(SVG_NS, 'defs');
  svg.appendChild(defs); host.appendChild(svg);
  return new WritingTarget(svg, defs, svg, signal);
}