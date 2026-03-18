// ─── Pixel Art Sprite System ─────────────────────────────────────────────────
// 8×16 bitmaps, pixelSize=3 → 24×48px per character on screen
//
// Color palette:
//   0 = transparent
//   1 = shirt / jacket  (agent's primary color)
//   2 = hair            (#1a0a1a near-black)
//   3 = skin            (#fdbcb4 warm peach)
//   4 = eyes / pupils   (#1a0808 dark)
//   5 = pants           (#1e2030 dark navy)
//   6 = shoes           (#0d0d0d near-black)
//   7 = lapel / undershirt (off-white #e8e8f0)
//   8 = headset / badge (#9ca3af gray)
//   9 = hair highlight  (#3d2a3d softer dark)

// Variant 0 — short bob-hair, casual shirt
const SPRITE_0: number[][] = [
  [0, 0, 2, 2, 2, 2, 0, 0], // hair top
  [0, 2, 2, 2, 2, 2, 2, 0], // hair sides
  [0, 2, 3, 3, 3, 3, 2, 0], // upper face
  [0, 2, 3, 3, 3, 3, 2, 0], // mid face
  [0, 0, 3, 4, 3, 4, 3, 0], // eyes
  [0, 0, 3, 3, 4, 3, 3, 0], // nose + lower face
  [0, 0, 3, 3, 3, 3, 0, 0], // chin
  [0, 0, 0, 3, 3, 0, 0, 0], // neck
  [0, 1, 1, 1, 1, 1, 1, 0], // collar / shoulders
  [1, 1, 1, 1, 1, 1, 1, 1], // arms outstretched
  [0, 1, 1, 1, 1, 1, 1, 0], // torso
  [0, 1, 1, 1, 1, 1, 1, 0], // torso lower
  [0, 0, 5, 5, 5, 5, 0, 0], // hips / pants
  [0, 0, 5, 0, 0, 5, 0, 0], // legs
  [0, 0, 5, 0, 0, 5, 0, 0], // legs lower
  [0, 6, 6, 0, 0, 6, 6, 0], // shoes
];

// Variant 1 — peaked cap, formal jacket (guard / formal)
const SPRITE_1: number[][] = [
  [0, 1, 1, 1, 1, 1, 1, 0], // cap brim (agent color)
  [0, 0, 1, 1, 1, 1, 0, 0], // cap crown
  [0, 0, 2, 2, 2, 2, 0, 0], // hair under cap
  [0, 0, 3, 3, 3, 3, 0, 0], // upper face
  [0, 0, 3, 4, 3, 4, 3, 0], // eyes
  [0, 0, 3, 3, 4, 3, 3, 0], // nose
  [0, 0, 3, 3, 3, 3, 0, 0], // lower face / chin
  [0, 0, 0, 3, 3, 0, 0, 0], // neck
  [0, 1, 7, 1, 1, 7, 1, 0], // jacket with lapels
  [1, 1, 7, 1, 1, 7, 1, 1], // arms + lapels
  [0, 1, 7, 1, 1, 7, 1, 0], // jacket mid
  [0, 0, 1, 1, 1, 1, 0, 0], // jacket lower
  [0, 0, 5, 5, 5, 5, 0, 0], // pants
  [0, 0, 5, 0, 0, 5, 0, 0], // legs
  [0, 0, 5, 0, 0, 5, 0, 0], // legs lower
  [0, 6, 6, 0, 0, 6, 6, 0], // shoes
];

// Variant 2 — headset / headphones (tech analyst)
const SPRITE_2: number[][] = [
  [0, 8, 8, 8, 8, 8, 8, 0], // headset band
  [8, 0, 2, 2, 2, 2, 0, 8], // headset ear cups
  [0, 0, 2, 2, 2, 2, 0, 0], // hair
  [0, 2, 3, 3, 3, 3, 2, 0], // upper face
  [0, 0, 3, 4, 3, 4, 3, 0], // eyes
  [0, 0, 3, 3, 4, 3, 3, 0], // nose
  [0, 0, 3, 3, 3, 3, 0, 0], // lower face
  [0, 0, 0, 3, 3, 0, 0, 0], // neck
  [0, 1, 1, 1, 1, 1, 1, 0], // shoulders
  [1, 1, 1, 1, 1, 1, 1, 1], // arms
  [0, 1, 1, 8, 1, 1, 1, 0], // torso (badge on chest)
  [0, 1, 1, 1, 1, 1, 1, 0], // torso lower
  [0, 0, 5, 5, 5, 5, 0, 0], // hips
  [0, 0, 5, 0, 0, 5, 0, 0], // legs
  [0, 0, 5, 0, 0, 5, 0, 0], // legs lower
  [0, 6, 6, 0, 0, 6, 6, 0], // shoes
];

// Customer sprite — visitor in light clothes (no agent color override)
export const SPRITE_CUSTOMER: number[][] = [
  [0, 0, 9, 9, 9, 9, 0, 0], // hair (softer dark)
  [0, 9, 9, 9, 9, 9, 9, 0], // hair sides
  [0, 9, 3, 3, 3, 3, 9, 0], // upper face
  [0, 9, 3, 3, 3, 3, 9, 0], // mid face
  [0, 0, 3, 4, 3, 4, 3, 0], // eyes
  [0, 0, 3, 3, 4, 3, 3, 0], // nose
  [0, 0, 3, 3, 3, 3, 0, 0], // chin
  [0, 0, 0, 3, 3, 0, 0, 0], // neck
  [0, 7, 7, 7, 7, 7, 7, 0], // light shirt
  [7, 7, 7, 7, 7, 7, 7, 7], // arms
  [0, 7, 7, 7, 7, 7, 7, 0], // torso
  [0, 7, 7, 7, 7, 7, 7, 0], // torso lower
  [0, 0, 5, 5, 5, 5, 0, 0], // pants
  [0, 0, 5, 0, 0, 5, 0, 0], // legs
  [0, 0, 5, 0, 0, 5, 0, 0], // legs lower
  [0, 6, 6, 0, 0, 6, 6, 0], // shoes
];

export const SPRITES = [SPRITE_0, SPRITE_1, SPRITE_2];

// ─── Color palette resolver ───────────────────────────────────────────────────

function resolveColor(v: number, bodyColor: string): string {
  switch (v) {
    case 1: return bodyColor;          // shirt / jacket (agent color)
    case 2: return '#1a0a1a';          // hair
    case 3: return '#fdbcb4';          // skin
    case 4: return '#1a0808';          // eyes / features
    case 5: return '#1e2030';          // pants
    case 6: return '#0d0d0d';          // shoes
    case 7: return '#e8e8f0';          // lapel / undershirt (off-white)
    case 8: return '#9ca3af';          // headset / badge (gray)
    case 9: return '#3d2a3d';          // hair highlight (softer)
    default: return bodyColor;
  }
}

// ─── drawSprite ───────────────────────────────────────────────────────────────

/**
 * Draw a pixel-art character sprite.
 * @param ctx   Canvas 2D context
 * @param variant  0 | 1 | 2  (or pass SPRITE_CUSTOMER bitmap directly via customBitmap)
 * @param cx    Center X (logical pixels)
 * @param cy    Bottom Y (logical pixels) — sprite drawn upward from here
 * @param bodyColor  Agent primary color (palette index 1)
 * @param pixelSize  Pixels per bitmap cell (default 3 → 24×48px character)
 * @param customBitmap  Override with a custom bitmap (e.g. SPRITE_CUSTOMER)
 */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  variant: 0 | 1 | 2,
  cx: number,
  cy: number,
  bodyColor: string,
  pixelSize = 3,
  customBitmap?: number[][],
): void {
  const bitmap = customBitmap ?? SPRITES[variant];
  const rows = bitmap.length;
  const cols = bitmap[0].length;
  const startX = Math.round(cx - (cols * pixelSize) / 2);
  const startY = Math.round(cy - rows * pixelSize);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const v = bitmap[row][col];
      if (v === 0) continue;
      ctx.fillStyle = resolveColor(v, bodyColor);
      ctx.fillRect(
        startX + col * pixelSize,
        startY + row * pixelSize,
        pixelSize,
        pixelSize,
      );
    }
  }
}

/** Bounding box for click hit-detection */
export function getSpriteBounds(cx: number, cy: number, pixelSize = 3) {
  const w = 8 * pixelSize;
  const h = 16 * pixelSize; // 16-row sprite
  return { x: cx - w / 2, y: cy - h, w, h };
}
