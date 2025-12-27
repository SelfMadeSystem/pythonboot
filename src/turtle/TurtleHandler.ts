export class TurtleHandler {
  private gridCtx: CanvasRenderingContext2D;
  private drawCtx: CanvasRenderingContext2D;
  private turtleCtx: CanvasRenderingContext2D;

  // Turtle state
  private x: number;
  private y: number;
  private heading: number; // degrees
  private penDown: boolean;
  private penColor: string;
  private penSize: number;

  constructor(
    private gridCanvas: HTMLCanvasElement,
    private drawCanvas: HTMLCanvasElement,
    private turtleCanvas: HTMLCanvasElement,
  ) {
    const gridCtx = gridCanvas.getContext('2d');
    const drawCtx = drawCanvas.getContext('2d');
    const turtleCtx = turtleCanvas.getContext('2d');
    if (!gridCtx || !drawCtx || !turtleCtx) {
      throw new Error('Could not get canvas contexts');
    }
    this.gridCtx = gridCtx;
    this.drawCtx = drawCtx;
    this.turtleCtx = turtleCtx;

    // Start in center
    this.x = drawCanvas.width / 2;
    this.y = drawCanvas.height / 2;
    this.heading = 0;
    this.penDown = true;
    this.penColor = '#000';
    this.penSize = 2;

    this.drawGrid();
    this.drawTurtle();
  }

  drawGrid(spacing: number = 20, bigStep: number = 5) {
    const width = this.gridCanvas.width;
    const height = this.gridCanvas.height;
    this.gridCtx.clearRect(0, 0, width, height);
    this.gridCtx.strokeStyle = '#e0e0e0';
    this.gridCtx.lineWidth = 1;

    this.gridCtx.beginPath();
    for (let x = 1; x <= width / (spacing * 2); x++) {
      this.gridCtx.moveTo(width / 2 + x * spacing, 0);
      this.gridCtx.lineTo(width / 2 + x * spacing, height);
      this.gridCtx.moveTo(width / 2 - x * spacing, 0);
      this.gridCtx.lineTo(width / 2 - x * spacing, height);
    }
    for (let y = 1; y <= height / (spacing * 2); y++) {
      this.gridCtx.moveTo(0, height / 2 + y * spacing);
      this.gridCtx.lineTo(width, height / 2 + y * spacing);
      this.gridCtx.moveTo(0, height / 2 - y * spacing);
      this.gridCtx.lineTo(width, height / 2 - y * spacing);
    }
    this.gridCtx.stroke();

    // Draw axes
    this.gridCtx.strokeStyle = '#a0a0a0';
    this.gridCtx.lineWidth = 2;
    this.gridCtx.beginPath();
    this.gridCtx.moveTo(width / 2, 0);
    this.gridCtx.lineTo(width / 2, height);
    this.gridCtx.moveTo(0, height / 2);
    this.gridCtx.lineTo(width, height / 2);
    this.gridCtx.stroke();

    // Draw big lines
    this.gridCtx.strokeStyle = '#c0c0c0';
    this.gridCtx.lineWidth = 1.5;
    this.gridCtx.beginPath();
    for (let x = 1; x <= width / (spacing * bigStep * 2); x++) {
      this.gridCtx.moveTo(width / 2 + x * spacing * bigStep, 0);
      this.gridCtx.lineTo(width / 2 + x * spacing * bigStep, height);
      this.gridCtx.moveTo(width / 2 - x * spacing * bigStep, 0);
      this.gridCtx.lineTo(width / 2 - x * spacing * bigStep, height);
    }
    for (let y = 1; y <= height / (spacing * bigStep * 2); y++) {
      this.gridCtx.moveTo(0, height / 2 + y * spacing * bigStep);
      this.gridCtx.lineTo(width, height / 2 + y * spacing * bigStep);
      this.gridCtx.moveTo(0, height / 2 - y * spacing * bigStep);
      this.gridCtx.lineTo(width, height / 2 - y * spacing * bigStep);
    }
    this.gridCtx.stroke();
  }

  // Since canvas pixels are integers only, we need to track fractional resizing
  private resizeFracX = 0;
  private resizeFracY = 0;

  onResize(newWidth: number, newHeight: number) {
    // Only resize draw canvas if new size is larger
    if (
      newWidth > this.drawCanvas.width ||
      newHeight > this.drawCanvas.height
    ) {
      const newDrawWidth = Math.max(newWidth, this.drawCanvas.width);
      const newDrawHeight = Math.max(newHeight, this.drawCanvas.height);

      // Get current draw canvas content
      const oldDrawImage = this.drawCtx.getImageData(
        0,
        0,
        this.drawCanvas.width,
        this.drawCanvas.height,
      );

      const offsetX = (newDrawWidth - this.drawCanvas.width) / 2;
      const offsetY = (newDrawHeight - this.drawCanvas.height) / 2;
      this.resizeFracX += offsetX % 1;
      this.resizeFracY += offsetY % 1;

      this.x += offsetX;
      this.y += offsetY;

      const extraX = Math.floor(this.resizeFracX);
      const extraY = Math.floor(this.resizeFracY);
      this.resizeFracX -= extraX;
      this.resizeFracY -= extraY;

      // Resize draw canvas
      this.drawCanvas.width = newDrawWidth;
      this.drawCanvas.height = newDrawHeight;

      // Restore old content
      this.drawCtx.putImageData(
        oldDrawImage,
        Math.floor(offsetX + extraX),
        Math.floor(offsetY + extraY),
      );
    }

    // Resize turtle canvas
    this.turtleCanvas.width = newWidth;
    this.turtleCanvas.height = newHeight;

    // Resize grid canvas
    this.gridCanvas.width = newWidth;
    this.gridCanvas.height = newHeight;
    this.drawGrid();

    // Redraw turtle
    this.drawTurtle();
  }

  forward(dist: number) {
    const rad = (this.heading * Math.PI) / 180;
    const nx = this.x + Math.cos(rad) * dist;
    const ny = this.y + Math.sin(rad) * dist;
    if (this.penDown) {
      this.drawCtx.strokeStyle = this.penColor;
      this.drawCtx.lineWidth = this.penSize;
      this.drawCtx.beginPath();
      this.drawCtx.moveTo(this.x, this.y);
      this.drawCtx.lineTo(nx, ny);
      this.drawCtx.stroke();
    }
    this.x = nx;
    this.y = ny;
    this.drawTurtle();
  }

  backward(dist: number) {
    this.forward(-dist);
  }

  left(deg: number) {
    this.heading = (this.heading - deg) % 360;
    this.drawTurtle();
  }

  right(deg: number) {
    this.heading = (this.heading + deg) % 360;
    this.drawTurtle();
  }

  penup() {
    this.penDown = false;
  }

  pendown() {
    this.penDown = true;
  }

  pencolor(color: string) {
    this.penColor = color;
  }

  pensize(size: number) {
    this.penSize = size;
  }

  goto(x: number, y: number) {
    x += this.drawCanvas.width / 2;
    y += this.drawCanvas.height / 2;
    if (this.penDown) {
      this.drawCtx.strokeStyle = this.penColor;
      this.drawCtx.lineWidth = this.penSize;
      this.drawCtx.beginPath();
      this.drawCtx.moveTo(this.x, this.y);
      this.drawCtx.lineTo(x, y);
      this.drawCtx.stroke();
    }
    this.x = x;
    this.y = y;
    this.drawTurtle();
  }

  setheading(deg: number) {
    this.heading = deg % 360;
    this.drawTurtle();
  }

  position() {
    return { x: this.x, y: this.y };
  }

  headingDeg() {
    return this.heading;
  }

  clear() {
    this.drawCtx.clearRect(0, 0, this.drawCanvas.width, this.drawCanvas.height);
    this.drawTurtle();
  }

  // Draw turtle icon at current position
  private drawTurtle() {
    this.turtleCtx.clearRect(
      0,
      0,
      this.turtleCanvas.width,
      this.turtleCanvas.height,
    );
    const turtleX =
      this.x - (this.drawCanvas.width - this.turtleCanvas.width) / 2;
    const turtleY =
      this.y - (this.drawCanvas.height - this.turtleCanvas.height) / 2;
    this.turtleCtx.save();
    this.turtleCtx.translate(turtleX, turtleY);
    this.turtleCtx.rotate(((this.heading + 90) * Math.PI) / 180);
    this.turtleCtx.beginPath();
    this.turtleCtx.moveTo(0, -10);
    this.turtleCtx.lineTo(5, 10);
    this.turtleCtx.lineTo(-5, 10);
    this.turtleCtx.closePath();
    this.turtleCtx.fillStyle = 'green';
    this.turtleCtx.fill();
    this.turtleCtx.restore();
  }
}
