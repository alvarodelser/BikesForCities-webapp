import * as THREE from 'three';
import {
  BIKE_ELEMENTS, VIEWBOX, STROKE_MS, DRAW_TOTAL_MS, type BikeElement,
} from './bikePaths';
import { createDescent, stepDescent, type DescentState } from './physics';
import { BIKE_CREAM } from './palette';

const TEX_W = 512;
const TEX_H = Math.round((TEX_W * VIEWBOX.h) / VIEWBOX.w); // 724
const PLANE_H = 9; // world units
const PLANE_W = PLANE_H * (VIEWBOX.w / VIEWBOX.h);
export const BIKE_REST_Y = PLANE_H * 0.42; // wheels kiss the ground plane
const START_Y = BIKE_REST_Y + 14;
const SQUASH_MS = 240;

// Measure an SVG path via a detached DOM path element (once, at init).
function pathLength(d: string): number {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  el.setAttribute('d', d);
  return el.getTotalLength();
}

interface Drawable {
  el: BikeElement;
  path2d: Path2D;
  length: number; // 0 for fills
}

export interface BikeRig {
  mesh: THREE.Mesh;
  update: (elapsedMs: number, dtSec: number) => void;
  landed: () => boolean;
  settleNow: () => void;
}

export function createBike(camera: THREE.Camera): BikeRig {
  const canvas = document.createElement('canvas');
  canvas.width = TEX_W;
  canvas.height = TEX_H;
  const ctx = canvas.getContext('2d')!;

  const drawables: Drawable[] = BIKE_ELEMENTS.map((el) => {
    if (el.kind === 'circle') {
      const p = new Path2D();
      p.arc(el.cx, el.cy, el.r, 0, Math.PI * 2);
      return { el, path2d: p, length: 2 * Math.PI * el.r };
    }
    return {
      el,
      path2d: new Path2D(el.d),
      length: el.kind === 'path' ? pathLength(el.d) : 0,
    };
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide,
  });
  material.toneMapped = false; // keep cream at full brightness so bloom catches it

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(PLANE_W, PLANE_H),
    material,
  );
  // Billboard: parallel to the screen, upright — flat-logo look of the reference.
  mesh.quaternion.copy(camera.quaternion);
  mesh.position.set(0, START_Y, 0);

  const scale = TEX_W / VIEWBOX.w;
  let drawnUpTo = -1; // last elapsedMs rendered into the texture

  function drawFrame(tMs: number) {
    ctx.clearRect(0, 0, TEX_W, TEX_H);
    ctx.save();
    ctx.scale(scale, scale);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = BIKE_CREAM;
    ctx.fillStyle = BIKE_CREAM;
    for (const { el, path2d, length } of drawables) {
      const local = tMs - el.delay;
      if (local <= 0) continue;
      if (el.kind === 'fill') {
        ctx.globalAlpha = Math.min(local / 300, 1);
        ctx.fill(path2d);
        ctx.globalAlpha = 1;
        continue;
      }
      const p = Math.min(local / STROKE_MS, 1);
      ctx.lineWidth = el.width;
      ctx.setLineDash([length * p, length]);
      ctx.stroke(path2d);
    }
    ctx.restore();
    texture.needsUpdate = true;
  }

  let descent: DescentState | null = null;
  let hasLanded = false;
  let squashT = -1; // ms since last impact, -1 = idle
  let prevBounces = 0;

  function applySquash(dtMs: number) {
    if (squashT < 0) return;
    squashT += dtMs;
    if (squashT >= SQUASH_MS) {
      squashT = -1;
      mesh.scale.set(1, 1, 1);
      return;
    }
    const k = Math.sin((Math.PI * squashT) / SQUASH_MS);
    mesh.scale.set(1 + 0.08 * k, 1 - 0.12 * k, 1);
  }

  return {
    mesh,

    update(elapsedMs, dtSec) {
      // Phase 1: stroke draw, floating high with a slow bob.
      if (elapsedMs < DRAW_TOTAL_MS) {
        drawFrame(elapsedMs);
        drawnUpTo = elapsedMs;
        mesh.position.y = START_Y + Math.sin(elapsedMs / 500) * 0.4;
        return;
      }
      if (drawnUpTo < DRAW_TOTAL_MS) {
        drawFrame(DRAW_TOTAL_MS); // final complete frame
        drawnUpTo = DRAW_TOTAL_MS;
      }
      // Phase 2: physics descent.
      if (!descent) descent = createDescent(mesh.position.y);
      if (!descent.done) {
        descent = stepDescent(descent, dtSec, BIKE_REST_Y);
        mesh.position.y = descent.y;
        if (!hasLanded && (descent.bounces > 0 || descent.done)) {
          hasLanded = true;
          squashT = 0;
        } else if (descent.bounces > prevBounces) {
          squashT = 0;
        }
        prevBounces = descent.bounces;
      }
      applySquash(dtSec * 1000);
    },

    landed: () => hasLanded,

    settleNow() {
      drawFrame(DRAW_TOTAL_MS);
      drawnUpTo = DRAW_TOTAL_MS;
      descent = { y: BIKE_REST_Y, vy: 0, bounces: 1, done: true };
      hasLanded = true;
      mesh.position.y = BIKE_REST_Y;
      mesh.scale.set(1, 1, 1);
    },
  };
}
