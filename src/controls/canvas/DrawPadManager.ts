import { GetDefaultProp, isNotEmptyArray, isNullOrEmptyString, throttle } from "@kwiz/common";
import { CustomEventTargetBase } from './CustomEventTargetBase';
import { Bezier } from './bezier';
import { BasicPoint, Point } from './point';

declare global {
    interface CSSStyleDeclaration {
        msTouchAction: string | null;
    }
}

export type DrawPadEvent = MouseEvent | Touch | PointerEvent;

export interface FromDataOptions {
    clear?: boolean;
}

export interface PointGroupOptions {
    dotSize: number;
    minWidth: number;
    maxWidth: number;
    penColor: string;
}

export interface Options extends Partial<PointGroupOptions> {
    minDistance?: number;
    velocityFilterWeight?: number;
    backgroundColor?: string;
    throttle?: number;
}

export interface PointGroup extends PointGroupOptions {
    points: BasicPoint[];
}

//inspired by https://www.npmjs.com/package/signature_pad

export default class DrawPadManager extends CustomEventTargetBase {
    // Public stuff
    public dotSize = GetDefaultProp<number>(0);
    public minWidth = GetDefaultProp<number>(0.5);
    public maxWidth = GetDefaultProp<number>(2.5);
    public penColor = GetDefaultProp<string>("black");

    public minDistance = GetDefaultProp<number>(5);
    public velocityFilterWeight = GetDefaultProp<number>(0.7);
    public backgroundColor = GetDefaultProp<string>(null);
    public throttle = GetDefaultProp<number>(16);

    // Private stuff    
    private _ctx: CanvasRenderingContext2D;
    private _drawningStroke: boolean;
    private _isEmpty: boolean;
    private _lastPoints: Point[]; // Stores up to 4 most recent points; used to generate a new curve
    private _data: PointGroup[]; // Stores all points in groups (one group per line or dot)
    private _lastVelocity: number;
    private _lastWidth: number;
    private _strokeMoveUpdate: (event: DrawPadEvent) => void;

    public constructor(private canvas: HTMLCanvasElement, options: Options = {}) {
        super();
        this.velocityFilterWeight.value = options.velocityFilterWeight;
        this.minWidth.value = options.minWidth;
        this.maxWidth.value = options.maxWidth;
        this.throttle.value = options.throttle; // in milisecondss
        this.minDistance.value = options.minDistance; // in pixels
        this.dotSize.value = options.dotSize;
        this.penColor.value = options.penColor;
        this.backgroundColor.value = options.backgroundColor;

        this._strokeMoveUpdate = this.throttle.value
            ? throttle(this._strokeUpdate, this.throttle.value, this)
            : this._strokeUpdate;
        this._ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

        this.clear();
        // Enable mouse and touch event handlers
        this.on();
    }

    public clear(): void {
        const { _ctx: ctx, canvas } = this;

        // Clear canvas using background color
        ctx.fillStyle = this.backgroundColor.value;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (!isNullOrEmptyString(this.backgroundColor.value))//otherwise, leave it transparent
            ctx.fillRect(0, 0, canvas.width, canvas.height);

        this._data = [];
        this._reset();
        this._isEmpty = true;

        this.resizeCanvas();
    }

    public fromDataURL(
        dataUrl: string,
        /** default: clear, shrink and stretch all true */
        options: {
            clear?: boolean;
            shrinkToFit?: boolean;
            stretchToFit?: boolean;
        } = {
                clear: true,
                shrinkToFit: true,
                stretchToFit: true
            },
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            this._reset();
            img.onload = (): void => {
                if (options.clear) {
                    this.clear();
                }
                /**
                 * smallest factor
                 * 1 - image is smaller than canvas. keep as is.
                 * less than 1 - width, height or both are too big - this is the smaller factor that contains both
                 */
                //use clientHeight/clientWidth to supprot phones properly and compensate for window.devicePixelRatio
                let factor = Math.min(this.canvas.clientWidth / img.width, this.canvas.clientHeight / img.height);
                if (options.shrinkToFit !== true && factor < 1)
                    factor = 1;
                if (options.stretchToFit !== true && factor > 1)
                    factor = 1;
                //make sure its contained
                let width = img.width * factor;
                let height = img.height * factor;
                //center it
                var centerShift_x = this.canvas.clientWidth > width ? (this.canvas.clientWidth / 2) - (width / 2) : 0;
                var centerShift_y = this.canvas.clientHeight > height ? (this.canvas.clientHeight / 2) - (height / 2) : 0;

                this._ctx.drawImage(img, centerShift_x, centerShift_y, width, height);
                resolve();
            };
            img.onerror = (error): void => {
                reject(error);
            };
            img.crossOrigin = 'anonymous';
            img.src = dataUrl;

            this._isEmpty = false;
        });
    }

    public toPng() {
        let value = "";
        if (!this.isEmpty()) {
            value = this.toDataURL("image/png");
        }
        return value;
    }
    public toDataURL(type: 'image/png' | 'image/jpeg' | 'image/svg+xml' = 'image/png', encoderOptions?: number): string {
        switch (type) {
            case 'image/svg+xml':
                return this._toSVG();
            default:
                return this.canvas.toDataURL(type, encoderOptions);
        }
    }

    public on(): void {
        // Disable panning/zooming when touching canvas element
        this.canvas.style.touchAction = 'none';
        this.canvas.style.msTouchAction = 'none';
        this.canvas.style.userSelect = 'none';

        const isIOS =
            /Macintosh/.test(navigator.userAgent) && 'ontouchstart' in document;

        // The "Scribble" feature of iOS intercepts point events. So that we can lose some of them when tapping rapidly.
        // Use touch events for iOS platforms to prevent it. See https://developer.apple.com/forums/thread/664108 for more information.
        if (window.PointerEvent && !isIOS) {
            this._handlePointerEvents();
        } else {
            this._handleMouseEvents();

            if ('ontouchstart' in window) {
                this._handleTouchEvents();
            }
        }
    }

    public off(): void {
        // Enable panning/zooming when touching canvas element
        this.canvas.style.touchAction = 'auto';
        this.canvas.style.msTouchAction = 'auto';
        this.canvas.style.userSelect = 'auto';

        this.canvas.removeEventListener('pointerdown', this._handlePointerStart);
        this.canvas.removeEventListener('pointermove', this._handlePointerMove);
        document.removeEventListener('pointerup', this._handlePointerEnd);

        this.canvas.removeEventListener('mousedown', this._handleMouseDown);
        this.canvas.removeEventListener('mousemove', this._handleMouseMove);
        document.removeEventListener('mouseup', this._handleMouseUp);

        this.canvas.removeEventListener('touchstart', this._handleTouchStart);
        this.canvas.removeEventListener('touchmove', this._handleTouchMove);
        this.canvas.removeEventListener('touchend', this._handleTouchEnd);
    }

    public isEmpty(): boolean {
        return this._isEmpty;
    }

    public canUndo() {
        var data = this.toData();
        return isNotEmptyArray(data);
    }
    public undoLast() {
        if (this.canUndo()) {
            var data = this.toData();
            data.pop(); // remove the last dot or line
            this.fromData(data);
        }
    }
    public resizeCanvas() {
        var ratio = Math.max(window.devicePixelRatio || 1, 1);
        this.canvas.width = this.canvas.offsetWidth * ratio;
        this.canvas.height = this.canvas.offsetHeight * ratio;
        this.canvas.getContext("2d").scale(ratio, ratio);
    }

    public fromData(
        pointGroups: PointGroup[],
        { clear = true }: FromDataOptions = {},
    ): void {
        if (clear) {
            this.clear();
        }

        this._fromData(
            pointGroups,
            this._drawCurve.bind(this),
            this._drawDot.bind(this),
        );

        this._data = clear ? pointGroups : this._data.concat(pointGroups);
    }

    public toData(): PointGroup[] {
        return this._data;
    }

    // Event handlers
    private _handleMouseDown = (event: MouseEvent): void => {
        if (event.buttons === 1) {
            this._drawningStroke = true;
            this._strokeBegin(event);
        }
    };

    private _handleMouseMove = (event: MouseEvent): void => {
        if (this._drawningStroke) {
            this._strokeMoveUpdate(event);
        }
    };

    private _handleMouseUp = (event: MouseEvent): void => {
        if (event.buttons === 1 && this._drawningStroke) {
            this._drawningStroke = false;
            this._strokeEnd(event);
        }
    };

    private _handleTouchStart = (event: TouchEvent): void => {
        // Prevent scrolling.
        event.preventDefault();

        if (event.targetTouches.length === 1) {
            const touch = event.changedTouches[0];
            this._strokeBegin(touch);
        }
    };

    private _handleTouchMove = (event: TouchEvent): void => {
        // Prevent scrolling.
        event.preventDefault();

        const touch = event.targetTouches[0];
        this._strokeMoveUpdate(touch);
    };

    private _handleTouchEnd = (event: TouchEvent): void => {
        const wasCanvasTouched = event.target === this.canvas;
        if (wasCanvasTouched) {
            event.preventDefault();

            const touch = event.changedTouches[0];
            this._strokeEnd(touch);
        }
    };

    private _handlePointerStart = (event: PointerEvent): void => {
        this._drawningStroke = true;
        event.preventDefault();
        this._strokeBegin(event);
    };

    private _handlePointerMove = (event: PointerEvent): void => {
        if (this._drawningStroke) {
            event.preventDefault();
            this._strokeMoveUpdate(event);
        }
    };

    private _handlePointerEnd = (event: PointerEvent): void => {
        this._drawningStroke = false;
        const wasCanvasTouched = event.target === this.canvas;
        if (wasCanvasTouched) {
            event.preventDefault();
            this._strokeEnd(event);
        }
    };

    // Private methods
    private _strokeBegin(event: DrawPadEvent): void {
        this.dispatchEvent(new CustomEvent('beginStroke', { detail: event }));

        const newPointGroup: PointGroup = {
            dotSize: this.dotSize.value,
            minWidth: this.minWidth.value,
            maxWidth: this.maxWidth.value,
            penColor: this.penColor.value,
            points: [],
        };

        this._data.push(newPointGroup);
        this._reset();
        this._strokeUpdate(event);
    }

    private _strokeUpdate(event: DrawPadEvent): void {
        if (this._data.length === 0) {
            // This can happen if clear() was called while a drawing is still in progress,
            // or if there is a race condition between start/update events.
            this._strokeBegin(event);
            return;
        }

        this.dispatchEvent(
            new CustomEvent('beforeUpdateStroke', { detail: event }),
        );

        const x = event.clientX;
        const y = event.clientY;
        const pressure =
            (event as PointerEvent).pressure !== undefined
                ? (event as PointerEvent).pressure
                : (event as Touch).force !== undefined
                    ? (event as Touch).force
                    : 0;

        const point = this._createPoint(x, y, pressure);
        const lastPointGroup = this._data[this._data.length - 1];
        const lastPoints = lastPointGroup.points;
        const lastPoint =
            lastPoints.length > 0 && lastPoints[lastPoints.length - 1];
        const isLastPointTooClose = lastPoint
            ? point.distanceTo(lastPoint) <= this.minDistance.value
            : false;
        const { penColor, dotSize, minWidth, maxWidth } = lastPointGroup;

        // Skip this point if it's too close to the previous one
        if (!lastPoint || !(lastPoint && isLastPointTooClose)) {
            const curve = this._addPoint(point);

            if (!lastPoint) {
                this._drawDot(point, {
                    penColor,
                    dotSize,
                    minWidth,
                    maxWidth,
                });
            } else if (curve) {
                this._drawCurve(curve, {
                    penColor,
                    dotSize,
                    minWidth,
                    maxWidth,
                });
            }

            lastPoints.push({
                time: point.time,
                x: point.x,
                y: point.y,
                pressure: point.pressure,
            });
        }

        this.dispatchEvent(new CustomEvent('afterUpdateStroke', { detail: event }));
    }

    private _strokeEnd(event: DrawPadEvent): void {
        this._strokeUpdate(event);

        this.dispatchEvent(new CustomEvent('endStroke', { detail: event }));
    }

    private _handlePointerEvents(): void {
        this._drawningStroke = false;

        this.canvas.addEventListener('pointerdown', this._handlePointerStart);
        this.canvas.addEventListener('pointermove', this._handlePointerMove);
        document.addEventListener('pointerup', this._handlePointerEnd);
    }

    private _handleMouseEvents(): void {
        this._drawningStroke = false;

        this.canvas.addEventListener('mousedown', this._handleMouseDown);
        this.canvas.addEventListener('mousemove', this._handleMouseMove);
        document.addEventListener('mouseup', this._handleMouseUp);
    }

    private _handleTouchEvents(): void {
        this.canvas.addEventListener('touchstart', this._handleTouchStart);
        this.canvas.addEventListener('touchmove', this._handleTouchMove);
        this.canvas.addEventListener('touchend', this._handleTouchEnd);
    }

    // Called when a new line is started
    private _reset(): void {
        this._lastPoints = [];
        this._lastVelocity = 0;
        this._lastWidth = (this.minWidth.value + this.maxWidth.value) / 2;
        this._ctx.fillStyle = this.penColor.value;
    }

    private _createPoint(x: number, y: number, pressure: number): Point {
        const rect = this.canvas.getBoundingClientRect();

        return new Point(
            x - rect.left,
            y - rect.top,
            pressure,
            new Date().getTime(),
        );
    }

    // Add point to _lastPoints array and generate a new curve if there are enough points (i.e. 3)
    private _addPoint(point: Point): Bezier | null {
        const { _lastPoints } = this;

        _lastPoints.push(point);

        if (_lastPoints.length > 2) {
            // To reduce the initial lag make it work with 3 points
            // by copying the first point to the beginning.
            if (_lastPoints.length === 3) {
                _lastPoints.unshift(_lastPoints[0]);
            }

            // _points array will always have 4 points here.
            const widths = this._calculateCurveWidths(_lastPoints[1], _lastPoints[2]);
            const curve = Bezier.fromPoints(_lastPoints, widths);

            // Remove the first element from the list, so that there are no more than 4 points at any time.
            _lastPoints.shift();

            return curve;
        }

        return null;
    }

    private _calculateCurveWidths(
        startPoint: Point,
        endPoint: Point,
    ): { start: number; end: number; } {
        const velocity =
            this.velocityFilterWeight.value * endPoint.velocityFrom(startPoint) +
            (1 - this.velocityFilterWeight.value) * this._lastVelocity;

        const newWidth = this._strokeWidth(velocity);

        const widths = {
            end: newWidth,
            start: this._lastWidth,
        };

        this._lastVelocity = velocity;
        this._lastWidth = newWidth;

        return widths;
    }

    private _strokeWidth(velocity: number): number {
        return Math.max(this.maxWidth.value / (velocity + 1), this.minWidth.value);
    }

    private _drawCurveSegment(x: number, y: number, width: number): void {
        const ctx = this._ctx;

        ctx.moveTo(x, y);
        ctx.arc(x, y, width, 0, 2 * Math.PI, false);
        this._isEmpty = false;
    }

    private _drawCurve(curve: Bezier, options: PointGroupOptions): void {
        const ctx = this._ctx;
        const widthDelta = curve.endWidth - curve.startWidth;
        // '2' is just an arbitrary number here. If only lenght is used, then
        // there are gaps between curve segments :/
        const drawSteps = Math.ceil(curve.length()) * 2;

        ctx.beginPath();
        ctx.fillStyle = options.penColor;

        for (let i = 0; i < drawSteps; i += 1) {
            // Calculate the Bezier (x, y) coordinate for this step.
            const t = i / drawSteps;
            const tt = t * t;
            const ttt = tt * t;
            const u = 1 - t;
            const uu = u * u;
            const uuu = uu * u;

            let x = uuu * curve.startPoint.x;
            x += 3 * uu * t * curve.control1.x;
            x += 3 * u * tt * curve.control2.x;
            x += ttt * curve.endPoint.x;

            let y = uuu * curve.startPoint.y;
            y += 3 * uu * t * curve.control1.y;
            y += 3 * u * tt * curve.control2.y;
            y += ttt * curve.endPoint.y;

            const width = Math.min(
                curve.startWidth + ttt * widthDelta,
                options.maxWidth,
            );
            this._drawCurveSegment(x, y, width);
        }

        ctx.closePath();
        ctx.fill();
    }

    private _drawDot(point: BasicPoint, options: PointGroupOptions): void {
        const ctx = this._ctx;
        const width =
            options.dotSize > 0
                ? options.dotSize
                : (options.minWidth + options.maxWidth) / 2;

        ctx.beginPath();
        this._drawCurveSegment(point.x, point.y, width);
        ctx.closePath();
        ctx.fillStyle = options.penColor;
        ctx.fill();
    }

    private _fromData(
        pointGroups: PointGroup[],
        drawCurve: DrawPadManager['_drawCurve'],
        drawDot: DrawPadManager['_drawDot'],
    ): void {
        for (const group of pointGroups) {
            const { penColor, dotSize, minWidth, maxWidth, points } = group;

            if (points.length > 1) {
                for (let j = 0; j < points.length; j += 1) {
                    const basicPoint = points[j];
                    const point = new Point(
                        basicPoint.x,
                        basicPoint.y,
                        basicPoint.pressure,
                        basicPoint.time,
                    );

                    // All points in the group have the same color, so it's enough to set
                    // penColor just at the beginning.
                    this.penColor.value = penColor;

                    if (j === 0) {
                        this._reset();
                    }

                    const curve = this._addPoint(point);

                    if (curve) {
                        drawCurve(curve, {
                            penColor,
                            dotSize,
                            minWidth,
                            maxWidth,
                        });
                    }
                }
            } else {
                this._reset();

                drawDot(points[0], {
                    penColor,
                    dotSize,
                    minWidth,
                    maxWidth,
                });
            }
        }
    }

    private _toSVG(): string {
        const pointGroups = this._data;
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        const minX = 0;
        const minY = 0;
        const maxX = this.canvas.width / ratio;
        const maxY = this.canvas.height / ratio;
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

        svg.setAttribute('width', this.canvas.width.toString());
        svg.setAttribute('height', this.canvas.height.toString());

        this._fromData(
            pointGroups,

            (curve, { penColor }) => {
                const path = document.createElement('path');

                // Need to check curve for NaN values, these pop up when drawing
                // lines on the canvas that are not continuous. E.g. Sharp corners
                // or stopping mid-stroke and than continuing without lifting mouse.
                /* eslint-disable no-restricted-globals */
                if (
                    !isNaN(curve.control1.x) &&
                    !isNaN(curve.control1.y) &&
                    !isNaN(curve.control2.x) &&
                    !isNaN(curve.control2.y)
                ) {
                    const attr =
                        `M ${curve.startPoint.x.toFixed(3)},${curve.startPoint.y.toFixed(
                            3,
                        )} ` +
                        `C ${curve.control1.x.toFixed(3)},${curve.control1.y.toFixed(3)} ` +
                        `${curve.control2.x.toFixed(3)},${curve.control2.y.toFixed(3)} ` +
                        `${curve.endPoint.x.toFixed(3)},${curve.endPoint.y.toFixed(3)}`;
                    path.setAttribute('d', attr);
                    path.setAttribute('stroke-width', (curve.endWidth * 2.25).toFixed(3));
                    path.setAttribute('stroke', penColor);
                    path.setAttribute('fill', 'none');
                    path.setAttribute('stroke-linecap', 'round');

                    svg.appendChild(path);
                }
                /* eslint-enable no-restricted-globals */
            },

            (point, { penColor, dotSize, minWidth, maxWidth }) => {
                const circle = document.createElement('circle');
                const size = dotSize > 0 ? dotSize : (minWidth + maxWidth) / 2;
                circle.setAttribute('r', size.toString());
                circle.setAttribute('cx', point.x.toString());
                circle.setAttribute('cy', point.y.toString());
                circle.setAttribute('fill', penColor);

                svg.appendChild(circle);
            },
        );

        const prefix = 'data:image/svg+xml;base64,';
        const header =
            '<svg' +
            ' xmlns="http://www.w3.org/2000/svg"' +
            ' xmlns:xlink="http://www.w3.org/1999/xlink"' +
            ` viewBox="${minX} ${minY} ${this.canvas.width} ${this.canvas.height}"` +
            ` width="${maxX}"` +
            ` height="${maxY}"` +
            '>';
        let body = svg.innerHTML;

        // IE hack for missing innerHTML property on SVGElement
        if (body === undefined) {
            const dummy = document.createElement('dummy');
            const nodes = svg.childNodes;
            dummy.innerHTML = '';

            for (let i = 0; i < nodes.length; i += 1) {
                dummy.appendChild(nodes[i].cloneNode(true));
            }

            body = dummy.innerHTML;
        }

        const footer = '</svg>';
        const data = header + body + footer;

        return prefix + btoa(data);
    }
}