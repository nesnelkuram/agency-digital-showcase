// ─── Pixel Sprite System ─────────────────────────────────────────────────────
// Each sprite is 8×12 pixels. Values: 0=transparent, 1=body, 2=dark, 3=light

// Variant 0: Basic character (no hat)
const SPRITE_0: number[][] = [
  [0, 0, 1, 1, 1, 1, 0, 0],
  [0, 1, 1, 2, 2, 1, 1, 0],
  [0, 1, 2, 1, 1, 2, 1, 0],
  [0, 1, 1, 1, 1, 1, 1, 0],
  [0, 0, 1, 3, 3, 1, 0, 0],
  [1, 1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1, 1],
  [0, 1, 1, 1, 1, 1, 1, 0],
  [0, 1, 1, 0, 0, 1, 1, 0],
  [0, 1, 0, 0, 0, 0, 1, 0],
  [0, 1, 1, 0, 0, 1, 1, 0],
  [0, 1, 1, 0, 0, 1, 1, 0],
];

// Variant 1: Hat character
const SPRITE_1: number[][] = [
  [0, 1, 1, 1, 1, 1, 1, 0],
  [0, 0, 2, 2, 2, 2, 0, 0],
  [0, 1, 1, 1, 1, 1, 1, 0],
  [0, 1, 2, 1, 1, 2, 1, 0],
  [0, 0, 1, 3, 3, 1, 0, 0],
  [1, 1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1, 1],
  [0, 1, 1, 1, 1, 1, 1, 0],
  [0, 1, 1, 0, 0, 1, 1, 0],
  [0, 1, 0, 0, 0, 0, 1, 0],
  [0, 1, 1, 0, 0, 1, 1, 0],
  [0, 1, 1, 0, 0, 1, 1, 0],
];

// Variant 2: Headset character
const SPRITE_2: number[][] = [
  [0, 3, 1, 1, 1, 1, 3, 0],
  [3, 1, 2, 2, 2, 2, 1, 3],
  [0, 1, 2, 1, 1, 2, 1, 0],
  [0, 1, 1, 1, 1, 1, 1, 0],
  [0, 0, 1, 3, 3, 1, 0, 0],
  [1, 1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1, 1],
  [0, 1, 1, 1, 1, 1, 1, 0],
  [0, 1, 1, 0, 0, 1, 1, 0],
  [0, 1, 0, 0, 0, 0, 1, 0],
  [0, 1, 1, 0, 0, 1, 1, 0],
  [0, 1, 1, 0, 0, 1, 1, 0],
];

export const SPRITES = [SPRITE_0, SPRITE_1, SPRITE_2];

/**
 * Draw a pixel-art sprite on the canvas.
 * @param ctx Canvas 2D context
 * @param variant Sprite variant (0, 1, 2)
 * @param cx Center X (logical pixels)
 * @param cy Bottom Y (logical pixels) — sprite is drawn upwards from here
 * @param bodyColor Agent's primary color (for value 1)
 * @param pixelSize Size of each pixel block (default 3)
 */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  variant: 0 | 1 | 2,
  cx: number,
  cy: number,
  bodyColor: string,
  pixelSize = 3,
): void {
  const bitmap = SPRITES[variant];
  const rows = bitmap.length;    // 12
  const cols = bitmap[0].length; // 8
  const spriteW = cols * pixelSize;
  const spriteH = rows * pixelSize;

  const startX = cx - spriteW / 2;
  const startY = cy - spriteH;

  // Derive dark and light colors from body color
  const dark = '#0a0a0a';
  const light = '#ffffff';

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const v = bitmap[row][col];
      if (v === 0) continue;
      ctx.fillStyle = v === 1 ? bodyColor : v === 2 ? dark : light;
      ctx.fillRect(
        Math.round(startX + col * pixelSize),
        Math.round(startY + row * pixelSize),
        pixelSize,
        pixelSize,
      );
    }
  }
}

/** Return sprite bounding box for hit detection */
export function getSpriteBounds(cx: number, cy: number, pixelSize = 3) {
  const w = 8 * pixelSize;
  const h = 12 * pixelSize;
  return { x: cx - w / 2, y: cy - h, w, h };
}
