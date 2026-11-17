// SPDX-License-Identifier: GPL-3.0-only

export interface CameraChoice {
  id: string;
  label: string;
}

const MACRO_CAMERA = /\b(?:macro|makro)\b/i;
const ULTRA_WIDE_CAMERA = /\b(?:ultra[\s_-]*wide|0[.,]5\s*x)\b/i;
const REAR_CAMERA = /\b(?:back|rear|environment|facing back|arka|hinten|trasera|traseira|arrière|posteriore)\b/i;
const FRONT_CAMERA = /\b(?:front|user|facing front|ön|vorne|frontal|avant|anteriore)\b/i;

function cameraScore(label: string) {
  if (MACRO_CAMERA.test(label)) return 300;
  if (ULTRA_WIDE_CAMERA.test(label)) return 200;
  if (REAR_CAMERA.test(label)) return 100;
  if (FRONT_CAMERA.test(label)) return -100;
  return 0;
}

/**
 * Prefer a dedicated macro lens, then the ultra-wide lens commonly used for
 * close focus. Browsers that expose neither still fall back to a rear camera.
 */
export function selectCloseFocusCamera(cameras: readonly CameraChoice[]) {
  let preferred: CameraChoice | undefined;
  let preferredScore = Number.NEGATIVE_INFINITY;

  for (const camera of cameras) {
    const score = cameraScore(camera.label);
    if (score > preferredScore) {
      preferred = camera;
      preferredScore = score;
    }
  }

  return preferred;
}
