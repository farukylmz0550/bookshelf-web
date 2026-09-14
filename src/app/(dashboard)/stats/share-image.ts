// SPDX-License-Identifier: GPL-3.0-only
"use client";

import type { ShareCardData } from "@/lib/share-card";

// Deterministic share-card renderer (v2.7.0): fixed layout, brand palette,
// no network, no timestamps in content. All text is drawn with canvas
// fillText — user-controlled strings are never interpreted as markup, and
// long titles/names are clipped with an ellipsis so they cannot break the
// layout.

const W = 1080;
const H = 1350;

const PALETTE = {
  light: { bg: "#FAF0E1", surface: "#FFFFFF", accent: "#BB4F35", ink: "#2B2727", muted: "#8A8584", line: "#DED8D2" },
  dark: { bg: "#1D2020", surface: "#272A29", accent: "#C17A5E", ink: "#F2EEE8", muted: "#9B948C", line: "#444845" },
};

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let clipped = text;
  while (clipped.length > 1 && ctx.measureText(`${clipped}…`).width > maxWidth) clipped = clipped.slice(0, -1);
  return `${clipped}…`;
}

function drawCentered(ctx: CanvasRenderingContext2D, text: string, y: number, maxWidth: number) {
  ctx.fillText(fitText(ctx, text, maxWidth), W / 2, y);
}

export function drawShareCard(canvas: HTMLCanvasElement, card: ShareCardData, dark: boolean): void {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const c = dark ? PALETTE.dark : PALETTE.light;

  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, W, H);

  // Inner frame
  ctx.strokeStyle = c.accent;
  ctx.lineWidth = 3;
  ctx.strokeRect(48, 48, W - 96, H - 96);

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  // Brand wordmark
  ctx.fillStyle = c.muted;
  ctx.font = "600 30px 'Noto Sans', sans-serif";
  drawCentered(ctx, card.brand.toUpperCase(), 140, W - 200);

  // Year — the hero number
  ctx.fillStyle = c.accent;
  ctx.font = "700 210px Georgia, 'Times New Roman', serif";
  drawCentered(ctx, String(card.year), 360, W - 240);

  // Card title
  ctx.fillStyle = c.ink;
  ctx.font = "400 44px Georgia, 'Times New Roman', serif";
  drawCentered(ctx, card.title, 430, W - 240);

  // Divider
  ctx.strokeStyle = c.line;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(140, 500);
  ctx.lineTo(W - 140, 500);
  ctx.stroke();

  // Highlight stat (first = books read) — big number
  const [highlight, ...rest] = card.stats;
  if (highlight) {
    ctx.fillStyle = c.accent;
    ctx.font = "700 260px Georgia, 'Times New Roman', serif";
    drawCentered(ctx, highlight.value, 780, W - 240);
    ctx.fillStyle = c.ink;
    ctx.font = "500 40px 'Noto Sans', sans-serif";
    drawCentered(ctx, highlight.label.toUpperCase(), 850, W - 260);
  }

  // Remaining stat rows
  ctx.textAlign = "left";
  const rowStartY = 1000;
  const rowGap = 76;
  rest.slice(0, 4).forEach((stat, i) => {
    const y = rowStartY + i * rowGap;
    if (i > 0) {
      ctx.strokeStyle = c.line;
      ctx.beginPath();
      ctx.moveTo(140, y - 34);
      ctx.lineTo(W - 140, y - 34);
      ctx.stroke();
    }
    ctx.font = "400 34px 'Noto Sans', sans-serif";
    ctx.fillStyle = c.muted;
    ctx.fillText(fitText(ctx, stat.label, 460), 140, y);
    ctx.textAlign = "right";
    ctx.font = "700 34px 'Noto Sans', sans-serif";
    ctx.fillStyle = c.ink;
    ctx.fillText(fitText(ctx, stat.value, 420), W - 140, y);
    ctx.textAlign = "left";
  });

  // Footer brand line
  ctx.textAlign = "center";
  ctx.fillStyle = c.muted;
  ctx.font = "400 26px 'Noto Sans', sans-serif";
  drawCentered(ctx, card.brand, H - 100, W - 240);
}

export async function exportShareCard(canvas: HTMLCanvasElement, filename: string): Promise<void> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
