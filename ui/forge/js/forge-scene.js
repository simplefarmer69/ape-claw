/**
 * forge-scene.js — Three.js scene for ClawBot Forge.
 * HV-MTL Activated inspired mecha chassis with unified armor,
 * glowing joints, energy vents, heavy bloom, holographic platform.
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutlinePass } from "three/addons/postprocessing/OutlinePass.js";

/* ══════════════════════════════════════════════════════════
   Material palette — HV-MTL inspired chrome + neon
   ══════════════════════════════════════════════════════════ */
const M = THREE.MeshStandardMaterial;

const GLOW = 0xcfff04;
const CYAN = 0x63d7ff;
const HOT  = 0xff3344;

export const MAT = {
  armor:     new M({ color: 0x556070, roughness: 0.45, metalness: 0.4, emissive: 0x1a2030, emissiveIntensity: 0.5 }),
  armorLt:   new M({ color: 0x6a7585, roughness: 0.5, metalness: 0.35, emissive: 0x1e2535, emissiveIntensity: 0.5 }),
  chrome:    new M({ color: 0x8090a0, roughness: 0.3, metalness: 0.5, emissive: 0x2a3545, emissiveIntensity: 0.6 }),
  joint:     new M({ color: 0x404550, roughness: 0.6, metalness: 0.3, emissive: GLOW, emissiveIntensity: 0.25 }),
  visor:     new M({ color: CYAN, transparent: true, opacity: 0.6, emissive: CYAN, emissiveIntensity: 2.5, roughness: 0.1, metalness: 0.2 }),
  core:      new M({ color: GLOW, emissive: GLOW, emissiveIntensity: 3.0, roughness: 0.0, metalness: 0.0 }),
  coreInner: new M({ color: 0xffffff, emissive: GLOW, emissiveIntensity: 4.0, transparent: true, opacity: 0.9 }),
  vent:      new M({ color: GLOW, emissive: GLOW, emissiveIntensity: 2.5, transparent: true, opacity: 0.8 }),
  ventHot:   new M({ color: HOT, emissive: HOT, emissiveIntensity: 3.0, transparent: true, opacity: 0.7 }),
  panelLine: new M({ color: GLOW, emissive: GLOW, emissiveIntensity: 2.0, transparent: true, opacity: 0.7 }),
  spineGlow: new M({ color: GLOW, emissive: GLOW, emissiveIntensity: 2.5 }),
  hardpoint: new M({ color: 0x505560, roughness: 0.4, metalness: 0.4, emissive: CYAN, emissiveIntensity: 0.5 }),
  security:      new M({ color: 0xFFB347, emissive: 0xFFB347, emissiveIntensity: 1.2, roughness: 0.3, metalness: 0.7 }),
  analytics:     new M({ color: 0x63d7ff, emissive: 0x63d7ff, emissiveIntensity: 1.2, roughness: 0.3, metalness: 0.6 }),
  automation:    new M({ color: 0x00ff00, emissive: 0x00ff00, emissiveIntensity: 1.2, roughness: 0.3, metalness: 0.6 }),
  devtools:      new M({ color: 0x4169E1, emissive: 0x4169E1, emissiveIntensity: 1.2, roughness: 0.3, metalness: 0.6 }),
  nft:           new M({ color: 0xb026ff, emissive: 0xb026ff, emissiveIntensity: 1.5, roughness: 0.3, metalness: 0.7 }),
  social:        new M({ color: 0xFF7F50, emissive: 0xFF7F50, emissiveIntensity: 1.2, roughness: 0.3, metalness: 0.5 }),
  storage:       new M({ color: 0x6A5ACD, emissive: 0x6A5ACD, emissiveIntensity: 1.0, roughness: 0.4, metalness: 0.5 }),
  productivity:  new M({ color: 0xE6F3FF, emissive: 0xE6F3FF, emissiveIntensity: 0.8, roughness: 0.3, metalness: 0.4 }),
  bridge:        new M({ color: 0xFF8C00, emissive: 0xFF8C00, emissiveIntensity: 1.2, roughness: 0.3, metalness: 0.6 }),
  trading:       new M({ color: 0xFFD700, emissive: 0xFFD700, emissiveIntensity: 1.0, roughness: 0.3, metalness: 0.7 }),
  governance:    new M({ color: 0x4B0082, emissive: 0x4B0082, emissiveIntensity: 1.2, roughness: 0.3, metalness: 0.6 }),
  wallet:        new M({ color: 0x50C878, emissive: 0x50C878, emissiveIntensity: 1.0, roughness: 0.4, metalness: 0.5 }),
  defi:          new M({ color: 0x32CD32, emissive: 0x32CD32, emissiveIntensity: 1.2, roughness: 0.3, metalness: 0.6 }),
  development:   new M({ color: 0x4169E1, emissive: 0x4169E1, emissiveIntensity: 1.2, roughness: 0.3, metalness: 0.6 }),
  writing:       new M({ color: 0xFFF8DC, emissive: 0xFFF8DC, emissiveIntensity: 0.7, roughness: 0.4, metalness: 0.4 }),
  communication: new M({ color: 0x00BFFF, emissive: 0x00BFFF, emissiveIntensity: 1.2, roughness: 0.3, metalness: 0.6 }),
  undersuit:  new M({ color: 0x1a1e28, roughness: 0.75, metalness: 0.2, emissive: 0x060810, emissiveIntensity: 0.1 }),
  pistonMat:  new M({ color: 0xb08040, roughness: 0.3, metalness: 0.85, emissive: 0x302010, emissiveIntensity: 0.15 }),
  cableMat:   new M({ color: 0x181822, roughness: 0.9, metalness: 0.1 }),
  rivetMat:   new M({ color: 0xd0d8e0, roughness: 0.15, metalness: 0.95, emissive: 0x506080, emissiveIntensity: 0.25 }),
  frameMat:   new M({ color: 0x283040, roughness: 0.6, metalness: 0.45, emissive: 0x0a1020, emissiveIntensity: 0.15 }),
  darkChrome: new M({ color: 0x3a4555, roughness: 0.25, metalness: 0.7, emissive: 0x151e2a, emissiveIntensity: 0.3 }),
};

/* ══════════════════════════════════════════════════════════
   Scene globals (exported for other modules)
   ══════════════════════════════════════════════════════════ */
export let scene, camera, renderer, composer, controls, outlinePass, css2dRenderer;
export let robotGroup, attachmentGroup, energyNetworkGroup, platformGroup;
export let coreMesh, visorMesh, spineSegments = [];
let ambientParticles, energyStreams, bloomPass;
let autoRotateTimer = null;
let bloomEnabled = true;
let selectedAttachment = null;
let glowRings = [];
let exhaustFlames = [];
let initialized = false;
let renderPaused = false;
let hoverHudEl = null;

const viewportEl = () => document.getElementById("forgeViewport");
const canvasEl = () => document.getElementById("forgeCanvas");

/* ══════════════════════════════════════════════════════════
   Easing helpers
   ══════════════════════════════════════════════════════════ */
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
function easeOutBack(t) { const c1 = 1.70158; const c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

export function tweenValue(from, to, durationMs, easeFn, onUpdate, onDone) {
  const start = performance.now();
  function tick() {
    const elapsed = performance.now() - start;
    const t = Math.min(elapsed / durationMs, 1);
    const v = from + (to - from) * easeFn(t);
    onUpdate(v);
    if (t < 1) requestAnimationFrame(tick);
    else if (onDone) onDone();
  }
  requestAnimationFrame(tick);
}

export function tweenVector3(obj, from, to, durationMs, easeFn, onDone) {
  const start = performance.now();
  function tick() {
    const elapsed = performance.now() - start;
    const t = Math.min(elapsed / durationMs, 1);
    const e = easeFn(t);
    obj.x = from.x + (to.x - from.x) * e;
    obj.y = from.y + (to.y - from.y) * e;
    obj.z = from.z + (to.z - from.z) * e;
    if (t < 1) requestAnimationFrame(tick);
    else if (onDone) onDone();
  }
  requestAnimationFrame(tick);
}

/* ══════════════════════════════════════════════════════════
   Geometry helpers
   ══════════════════════════════════════════════════════════ */
function box(g, w, h, d, mat, x, y, z, rx, ry, rz) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  if (rx) m.rotation.x = rx;
  if (ry) m.rotation.y = ry;
  if (rz) m.rotation.z = rz;
  g.add(m);
  return m;
}
function cyl(g, rT, rB, h, mat, x, y, z, segs) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rT, rB, h, segs || 16), mat);
  m.position.set(x, y, z);
  g.add(m);
  return m;
}
function sphere(g, r, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), mat);
  m.position.set(x, y, z);
  g.add(m);
  return m;
}
function torus(g, r, tube, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 16, 48), mat);
  m.position.set(x, y, z);
  m.rotation.x = Math.PI / 2;
  g.add(m);
  return m;
}
function pistonGeo(g, r, len, mat, x, y, z, rx, ry, rz) {
  const shaft = cyl(g, r, r, len, mat, x, y, z, 8);
  if (rx) shaft.rotation.x = rx; if (ry) shaft.rotation.y = ry; if (rz) shaft.rotation.z = rz;
  const capG = new THREE.CylinderGeometry(r * 1.7, r * 1.7, len * 0.09, 8);
  const c1 = new THREE.Mesh(capG, MAT.rivetMat); c1.position.y = len / 2; shaft.add(c1);
  const c2 = new THREE.Mesh(capG, MAT.rivetMat); c2.position.y = -len / 2; shaft.add(c2);
  return shaft;
}
function rivet(g, x, y, z) { return sphere(g, 0.028, MAT.rivetMat, x, y, z); }
function ventSlits(g, w, n, sp, mat, x, y, z) {
  for (let i = 0; i < n; i++) box(g, w, 0.02, 0.05, mat, x, y + i * sp, z);
}
function cableRun(g, r, len, x, y, z, rx, ry, rz) {
  const m = cyl(g, r, r, len, MAT.cableMat, x, y, z, 6);
  if (rx) m.rotation.x = rx; if (ry) m.rotation.y = ry; if (rz) m.rotation.z = rz;
  return m;
}

/* ══════════════════════════════════════════════════════════
   Build chassis — HV-MTL Activated inspired mecha
   Connected armor plates, mechanical joints, energy vents
   ══════════════════════════════════════════════════════════ */
function buildChassis() {
  const g = new THREE.Group();
  glowRings = [];
  exhaustFlames = [];

  // ── HEAD ──
  box(g, 0.85, 0.72, 0.72, MAT.undersuit, 0, 6.4, 0);
  // Helmet halves with center seam
  box(g, 0.54, 0.88, 0.92, MAT.armor, -0.29, 6.42, 0);
  box(g, 0.54, 0.88, 0.92, MAT.armor, 0.29, 6.42, 0);
  box(g, 0.03, 0.9, 0.06, MAT.panelLine, 0, 6.42, 0.44);
  // Crown ridge (layered)
  box(g, 0.35, 0.14, 0.8, MAT.chrome, 0, 6.9, -0.04);
  box(g, 0.22, 0.06, 0.6, MAT.darkChrome, 0, 6.98, -0.04);
  // Brow plate
  box(g, 1.12, 0.18, 0.35, MAT.armorLt, 0, 6.72, 0.28, -0.15, 0, 0);
  box(g, 0.8, 0.06, 0.25, MAT.darkChrome, 0, 6.66, 0.32, -0.12, 0, 0);
  // Chin guard + vent slits
  box(g, 0.7, 0.22, 0.45, MAT.chrome, 0, 5.98, 0.15);
  box(g, 0.5, 0.08, 0.35, MAT.darkChrome, 0, 5.9, 0.2);
  ventSlits(g, 0.35, 3, 0.055, MAT.vent, 0, 5.88, 0.38);
  // Cheek guards (inner + outer layer)
  for (let side = -1; side <= 1; side += 2) {
    box(g, 0.18, 0.45, 0.7, MAT.armorLt, side * 0.54, 6.3, 0.05, 0, 0, side * 0.06);
    box(g, 0.06, 0.25, 0.55, MAT.darkChrome, side * 0.58, 6.22, 0.02, 0, 0, side * 0.06);
    rivet(g, side * 0.46, 6.7, 0.36); rivet(g, side * 0.46, 6.15, 0.36);
  }
  // Ear vent arrays (3 glowing slits per side + housing)
  for (let side = -1; side <= 1; side += 2) {
    box(g, 0.08, 0.35, 0.18, MAT.frameMat, side * 0.63, 6.35, -0.12);
    for (let i = 0; i < 3; i++)
      box(g, 0.04, 0.055, 0.14, MAT.vent, side * 0.65, 6.32 + i * 0.1, -0.12);
  }
  // Visor — 3-segment with chrome frame dividers + inner glow layer
  box(g, 0.42, 0.2, 0.05, MAT.visor, -0.32, 6.42, 0.47);
  visorMesh = box(g, 0.38, 0.22, 0.06, MAT.visor, 0, 6.42, 0.48);
  box(g, 0.42, 0.2, 0.05, MAT.visor, 0.32, 6.42, 0.47);
  box(g, 0.03, 0.25, 0.08, MAT.chrome, -0.13, 6.42, 0.46);
  box(g, 0.03, 0.25, 0.08, MAT.chrome, 0.13, 6.42, 0.46);
  box(g, 1.0, 0.12, 0.02, MAT.coreInner, 0, 6.42, 0.42);
  // Forehead glow
  box(g, 0.6, 0.04, 0.05, MAT.panelLine, 0, 6.74, 0.38);
  // Antenna fins (mount base + fin + glow strip)
  for (let side = -1; side <= 1; side += 2) {
    box(g, 0.06, 0.08, 0.14, MAT.frameMat, side * 0.5, 6.78, -0.1);
    box(g, 0.05, 0.55, 0.2, MAT.chrome, side * 0.55, 6.88, -0.1, 0, 0, side * 0.2);
    box(g, 0.02, 0.35, 0.04, MAT.panelLine, side * 0.56, 6.95, -0.05, 0, 0, side * 0.2);
    rivet(g, side * 0.51, 6.78, -0.02);
  }
  // Back data ports (glowing connectors)
  box(g, 0.8, 0.5, 0.1, MAT.darkChrome, 0, 6.4, -0.42);
  for (let i = 0; i < 4; i++) {
    cyl(g, 0.055, 0.055, 0.08, MAT.frameMat, -0.2 + i * 0.13, 6.4, -0.46, 8);
    sphere(g, 0.022, MAT.vent, -0.2 + i * 0.13, 6.4, -0.5);
  }

  // ── NECK ──
  cyl(g, 0.22, 0.32, 0.5, MAT.joint, 0, 5.85, 0);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    cableRun(g, 0.025, 0.45, Math.cos(a) * 0.28, 5.85, Math.sin(a) * 0.28);
  }
  const neckRing = torus(g, 0.32, 0.04, MAT.vent, 0, 5.85, 0);
  glowRings.push(neckRing);
  const neckRing2 = torus(g, 0.28, 0.025, MAT.panelLine, 0, 5.72, 0);
  glowRings.push(neckRing2);
  box(g, 1.6, 0.15, 0.8, MAT.darkChrome, 0, 5.6, 0);

  // ── TORSO ──
  // Endoskeleton (visible ribs between armor gaps)
  box(g, 0.35, 5.0, 0.35, MAT.frameMat, 0, 3.6, -0.15);
  for (let i = 0; i < 5; i++)
    box(g, 1.4, 0.05, 0.22, MAT.frameMat, 0, 3.0 + i * 0.5, 0);
  // Chest plates (L/R split with visible seam)
  box(g, 1.08, 2.6, 1.3, MAT.armor, -0.55, 4.0, 0);
  box(g, 1.08, 2.6, 1.3, MAT.armor, 0.55, 4.0, 0);
  box(g, 0.04, 2.4, 0.06, MAT.panelLine, 0, 4.0, 0.65);
  // Collar / gorget
  box(g, 1.7, 0.2, 0.9, MAT.darkChrome, 0, 5.35, 0);
  box(g, 1.4, 0.06, 0.5, MAT.panelLine, 0, 5.45, 0.35);
  // Upper chest chevron accent
  box(g, 2.0, 0.6, 0.12, MAT.chrome, 0, 5.0, 0.66);
  box(g, 1.6, 0.35, 0.06, MAT.darkChrome, 0, 5.15, 0.7);
  // Lower chest plate
  box(g, 1.8, 0.4, 0.12, MAT.armorLt, 0, 4.4, 0.7);
  // Side flanks (angled outward)
  for (let side = -1; side <= 1; side += 2) {
    box(g, 0.28, 2.0, 1.1, MAT.armorLt, side * 1.15, 4.1, 0, 0, 0, side * -0.08);
    box(g, 0.08, 1.6, 0.85, MAT.darkChrome, side * 1.22, 4.1, 0, 0, 0, side * -0.08);
    rivet(g, side * 1.05, 5.0, 0.55); rivet(g, side * 1.05, 3.2, 0.55);
  }
  // Back plate (layered)
  box(g, 1.8, 2.2, 0.18, MAT.chrome, 0, 4.1, -0.7);
  box(g, 1.3, 1.6, 0.08, MAT.darkChrome, 0, 4.2, -0.76);
  // Ab plates (3 per side)
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 3; i++) {
      box(g, 0.42, 0.28, 0.12, MAT.armorLt, side * 0.35, 3.0 + i * 0.33, 0.68);
    }
  }
  // Panel line accents
  box(g, 0.04, 1.8, 0.06, MAT.panelLine, -0.7, 4.0, 0.68);
  box(g, 0.04, 1.8, 0.06, MAT.panelLine, 0.7, 4.0, 0.68);
  box(g, 1.4, 0.04, 0.06, MAT.panelLine, 0, 3.2, 0.68);
  box(g, 1.4, 0.04, 0.06, MAT.panelLine, 0, 4.8, 0.68);

  // ── CORE REACTOR (multi-ring housing) ──
  coreMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.3), MAT.coreInner);
  coreMesh.position.set(0, 4.5, 0.7);
  g.add(coreMesh);
  const coreRing = torus(g, 0.42, 0.05, MAT.core, 0, 4.5, 0.7);
  coreRing.rotation.x = 0;
  glowRings.push(coreRing);
  const coreOuter = torus(g, 0.52, 0.03, MAT.vent, 0, 4.5, 0.7);
  coreOuter.rotation.x = 0;
  glowRings.push(coreOuter);
  // Core housing plates (4 brackets)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const bx = Math.cos(a) * 0.38, bz = Math.sin(a) * 0.38;
    box(g, 0.08, 0.12, 0.04, MAT.chrome, bx, 4.5, 0.7 + bz);
  }
  const coreGlow = sphere(g, 0.18, MAT.core, 0, 4.5, 0.72);
  coreGlow.layers.enable(1);
  sphere(g, 0.08, MAT.coreInner, 0, 4.5, 0.7);

  // ── WAIST / PELVIS ──
  box(g, 1.6, 0.7, 1.0, MAT.armorLt, 0, 2.35, 0);
  box(g, 1.2, 0.5, 0.8, MAT.undersuit, 0, 2.35, 0);
  box(g, 1.8, 0.2, 0.15, MAT.chrome, 0, 2.7, 0.52);
  // Hip guard skirts
  for (let side = -1; side <= 1; side += 2) {
    box(g, 0.45, 0.5, 0.7, MAT.armor, side * 0.7, 2.15, 0, 0, 0, side * -0.12);
    box(g, 0.35, 0.12, 0.55, MAT.darkChrome, side * 0.72, 2.3, 0, 0, 0, side * -0.12);
    rivet(g, side * 0.6, 2.5, 0.38);
  }
  const waistRing = torus(g, 0.9, 0.04, MAT.vent, 0, 2.7, 0);
  glowRings.push(waistRing);
  box(g, 0.8, 0.04, 0.06, MAT.panelLine, 0, 2.0, 0.52);
  // Cable conduit across waist
  cableRun(g, 0.02, 1.2, 0, 2.55, -0.48, 0, 0, Math.PI / 2);

  // ── SHOULDERS ──
  function buildShoulder(side) {
    const sx = side * 1.65;
    sphere(g, 0.4, MAT.joint, sx, 5.25, 0);
    const shoulderRing = torus(g, 0.45, 0.04, MAT.vent, sx, 5.25, 0);
    glowRings.push(shoulderRing);
    // 2-layer pauldron (inner mount + outer plate)
    box(g, 0.65, 0.35, 0.65, MAT.frameMat, sx + side * 0.2, 5.35, 0, 0, 0, side * -0.12);
    box(g, 0.95, 0.5, 0.85, MAT.armor, sx + side * 0.3, 5.4, 0, 0, 0, side * -0.15);
    box(g, 0.8, 0.15, 0.7, MAT.chrome, sx + side * 0.35, 5.65, 0, 0, 0, side * -0.15);
    box(g, 0.6, 0.04, 0.6, MAT.darkChrome, sx + side * 0.3, 5.55, 0, 0, 0, side * -0.15);
    // Vent slit array
    ventSlits(g, 0.4, 2, 0.08, MAT.vent, sx + side * 0.35, 5.26, 0);
    // Shoulder piston (connects torso to pauldron)
    pistonGeo(g, 0.04, 0.55, MAT.pistonMat, sx * 0.65, 5.3, -0.35, 0, 0, side * 0.6);
    rivet(g, sx + side * 0.15, 5.6, 0.38); rivet(g, sx + side * 0.55, 5.6, -0.3);
  }
  buildShoulder(-1);
  buildShoulder(1);

  // ── ARMS ──
  function buildArm(side) {
    const sx = side * 2.1;
    // Upper arm (inner visible + outer plates)
    box(g, 0.35, 1.3, 0.35, MAT.undersuit, sx, 4.2, 0);
    box(g, 0.55, 1.4, 0.5, MAT.armorLt, sx, 4.2, 0);
    box(g, 0.42, 0.45, 0.35, MAT.darkChrome, sx, 4.65, 0.18);
    box(g, 0.4, 0.06, 0.35, MAT.panelLine, sx, 4.5, 0.26);
    // Bicep piston
    pistonGeo(g, 0.03, 0.6, MAT.pistonMat, sx + side * 0.22, 4.2, -0.2);
    cableRun(g, 0.018, 1.0, sx - side * 0.2, 4.2, 0.18);
    // Elbow joint + ring + piston
    sphere(g, 0.28, MAT.joint, sx, 3.4, 0);
    const elbowRing = torus(g, 0.32, 0.03, MAT.vent, sx, 3.4, 0);
    glowRings.push(elbowRing);
    pistonGeo(g, 0.025, 0.4, MAT.pistonMat, sx + side * 0.18, 3.4, -0.18, 0.3, 0, 0);
    // Forearm (armor + rail mount + wrist band)
    box(g, 0.3, 1.2, 0.3, MAT.undersuit, sx, 2.4, 0);
    box(g, 0.5, 1.3, 0.45, MAT.armor, sx, 2.4, 0);
    box(g, 0.55, 0.3, 0.5, MAT.chrome, sx, 2.8, 0);
    box(g, 0.12, 0.9, 0.12, MAT.darkChrome, sx + side * 0.28, 2.4, 0);
    box(g, 0.06, 0.8, 0.06, MAT.panelLine, sx + side * 0.26, 2.4, 0.22);
    // Wrist tech band
    torus(g, 0.22, 0.03, MAT.vent, sx, 1.85, 0);
    box(g, 0.35, 0.08, 0.35, MAT.darkChrome, sx, 1.82, 0);
    // Hand (palm + 3 finger stubs + thumb)
    box(g, 0.3, 0.35, 0.3, MAT.joint, sx, 1.55, 0);
    for (let f = -1; f <= 1; f++) {
      box(g, 0.06, 0.22, 0.08, MAT.frameMat, sx + f * 0.1, 1.32, 0.08);
    }
    box(g, 0.06, 0.16, 0.08, MAT.frameMat, sx + side * 0.16, 1.42, -0.08);
    rivet(g, sx - side * 0.2, 2.8, 0.25); rivet(g, sx + side * 0.2, 2.0, 0.22);
  }
  buildArm(-1);
  buildArm(1);

  // ── LEGS ──
  function buildLeg(side) {
    const sx = side * 0.55;
    // Hip joint + ring
    sphere(g, 0.32, MAT.joint, sx, 1.95, 0);
    const hipRing = torus(g, 0.36, 0.03, MAT.vent, sx, 1.95, 0);
    glowRings.push(hipRing);
    // Hip guard (angled skirt armor)
    box(g, 0.55, 0.35, 0.55, MAT.armor, sx + side * 0.12, 1.82, 0.12, 0, 0, side * -0.1);
    box(g, 0.4, 0.1, 0.4, MAT.darkChrome, sx + side * 0.12, 1.9, 0.15, 0, 0, side * -0.1);
    // Thigh (inner undersuit + outer plates front/back)
    box(g, 0.4, 1.5, 0.4, MAT.undersuit, sx, 0.8, 0);
    box(g, 0.65, 1.6, 0.65, MAT.armorLt, sx, 0.8, 0);
    box(g, 0.5, 0.12, 0.45, MAT.chrome, sx, 1.3, 0.33);
    box(g, 0.45, 0.12, 0.4, MAT.darkChrome, sx, 0.5, 0.33);
    box(g, 0.06, 1.0, 0.06, MAT.panelLine, sx + side * 0.3, 0.8, 0.33);
    // Thigh cable conduit
    cableRun(g, 0.018, 1.2, sx - side * 0.28, 0.8, -0.2);
    rivet(g, sx + side * 0.25, 1.5, 0.3); rivet(g, sx + side * 0.25, 0.1, 0.3);
    // Knee joint + ring + pistons (inner/outer)
    sphere(g, 0.26, MAT.joint, sx, -0.1, 0.1);
    const kneeRing = torus(g, 0.3, 0.03, MAT.vent, sx, -0.1, 0.1);
    glowRings.push(kneeRing);
    pistonGeo(g, 0.025, 0.35, MAT.pistonMat, sx + side * 0.22, -0.1, -0.15, 0.25, 0, 0);
    pistonGeo(g, 0.025, 0.3, MAT.pistonMat, sx - side * 0.22, -0.1, 0.2, -0.2, 0, 0);
    // Shin (layered guard + inner + calf vents)
    box(g, 0.35, 1.4, 0.35, MAT.undersuit, sx, -1.2, 0.08);
    box(g, 0.55, 1.5, 0.55, MAT.armor, sx, -1.2, 0.08);
    box(g, 0.6, 0.6, 0.15, MAT.chrome, sx, -0.6, 0.35);
    box(g, 0.5, 0.35, 0.08, MAT.darkChrome, sx, -0.85, 0.36);
    box(g, 0.06, 0.9, 0.06, MAT.panelLine, sx, -1.2, 0.36);
    // Calf vent slits
    ventSlits(g, 0.2, 3, 0.08, MAT.vent, sx - side * 0.28, -1.4, 0);
    cableRun(g, 0.015, 1.1, sx + side * 0.22, -1.2, -0.18);
    // Ankle (joint + twin pistons)
    cyl(g, 0.15, 0.2, 0.3, MAT.joint, sx, -2.1, 0.08);
    pistonGeo(g, 0.02, 0.25, MAT.pistonMat, sx + side * 0.12, -2.0, 0.22);
    pistonGeo(g, 0.02, 0.25, MAT.pistonMat, sx - side * 0.12, -2.0, -0.08);
    // Foot (toe segment + heel + mid plate + thruster)
    box(g, 0.65, 0.22, 0.6, MAT.armorLt, sx, -2.35, 0.38);
    box(g, 0.55, 0.18, 0.35, MAT.armorLt, sx, -2.35, -0.05);
    box(g, 0.6, 0.08, 0.55, MAT.chrome, sx, -2.22, 0.4);
    box(g, 0.45, 0.04, 0.35, MAT.darkChrome, sx, -2.18, 0.4);
    box(g, 0.3, 0.08, 0.3, MAT.ventHot, sx, -2.48, 0.15);
    rivet(g, sx + side * 0.25, -2.2, 0.6); rivet(g, sx - side * 0.25, -2.2, 0.6);
  }
  buildLeg(-1);
  buildLeg(1);

  // ── SPINE (vertebrae with cross-struts) ──
  spineSegments = [];
  for (let i = 0; i < 8; i++) {
    const mat = MAT.spineGlow.clone();
    const seg = box(g, 0.12, 0.2, 0.12, mat, 0, 2.7 + i * 0.4, -0.72);
    spineSegments.push(seg);
    if (i > 0) {
      box(g, 0.22, 0.04, 0.06, MAT.frameMat, 0, 2.7 + i * 0.4 - 0.2, -0.72);
    }
    // Cross-struts to torso
    if (i >= 2 && i <= 6) {
      box(g, 0.04, 0.04, 0.2, MAT.frameMat, 0, 2.7 + i * 0.4, -0.6);
    }
  }

  // ── BACK THRUSTERS / EXHAUST (detailed nozzles) ──
  for (let side = -1; side <= 1; side += 2) {
    // Pylon connecting to back
    box(g, 0.15, 0.6, 0.25, MAT.frameMat, side * 0.6, 3.9, -0.78);
    // Nozzle housing (outer shell)
    cyl(g, 0.28, 0.38, 0.85, MAT.chrome, side * 0.6, 3.8, -0.95, 12);
    // Nozzle inner cone
    cyl(g, 0.12, 0.22, 0.35, MAT.darkChrome, side * 0.6, 3.45, -0.95, 12);
    // Exhaust glow
    const exhaust = cyl(g, 0.2, 0.3, 0.15, MAT.ventHot, side * 0.6, 3.32, -0.95, 12);
    exhaustFlames.push(exhaust);
    // Multi-ring nozzle
    const thrustRing = torus(g, 0.32, 0.03, MAT.vent, side * 0.6, 3.32, -0.95);
    glowRings.push(thrustRing);
    const thrustRing2 = torus(g, 0.25, 0.02, MAT.panelLine, side * 0.6, 3.42, -0.95);
    glowRings.push(thrustRing2);
    // Fuel line
    cableRun(g, 0.02, 0.7, side * 0.42, 3.8, -0.82);
    rivet(g, side * 0.6 + side * 0.22, 4.15, -0.85);
  }

  // ── SHOULDER HARDPOINTS (detailed weapon mounts) ──
  for (let side = -1; side <= 1; side += 2) {
    const sx = side * 2.0;
    // Mount pylon
    box(g, 0.12, 0.2, 0.12, MAT.frameMat, sx + side * 0.4, 5.5, -0.2);
    cyl(g, 0.12, 0.12, 0.7, MAT.hardpoint, sx + side * 0.4, 5.6, -0.2);
    box(g, 0.22, 0.22, 0.65, MAT.hardpoint, sx + side * 0.4, 5.95, -0.2);
    box(g, 0.16, 0.08, 0.55, MAT.darkChrome, sx + side * 0.4, 6.05, -0.2);
    box(g, 0.08, 0.06, 0.5, MAT.vent, sx + side * 0.4, 5.85, -0.2);
    rivet(g, sx + side * 0.4, 5.95, 0.1);
  }

  // ── CHEST ENERGY VENTS (4 per side with housing) ──
  for (let side = -1; side <= 1; side += 2) {
    box(g, 0.45, 0.85, 0.06, MAT.frameMat, side * 0.55, 4.45, 0.67);
    for (let i = 0; i < 4; i++) {
      box(g, 0.35, 0.04, 0.08, MAT.vent, side * 0.55, 4.65 - i * 0.2, 0.7);
    }
  }

  // Add subtle edge highlights so the full mecha silhouette is always readable.
  const edgeMat = new THREE.LineBasicMaterial({
    color: 0x8fb6ff,
    transparent: true,
    opacity: 0.22,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  g.traverse((node) => {
    if (!node.isMesh || !node.geometry) return;
    const edges = new THREE.EdgesGeometry(node.geometry, 28);
    const lines = new THREE.LineSegments(edges, edgeMat.clone());
    lines.renderOrder = 2;
    node.add(lines);
  });

  // Global chassis aura to separate body from attachment glow.
  const aura = new THREE.Mesh(
    new THREE.CapsuleGeometry(1.6, 6.6, 6, 18),
    new THREE.MeshBasicMaterial({
      color: 0x7fa4ff,
      transparent: true,
      opacity: 0.045,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.BackSide,
    }),
  );
  aura.position.set(0, 2.0, 0);
  aura.scale.set(1.08, 1.02, 1.02);
  g.add(aura);

  return g;
}

/* ══════════════════════════════════════════════════════════
   Holographic platform
   ══════════════════════════════════════════════════════════ */
function buildPlatform() {
  const platform = new THREE.Group();

  // Main pad (dark hexagonal)
  const padGeo = new THREE.CylinderGeometry(5, 5, 0.12, 6);
  const padMat = new M({ color: 0x080808, roughness: 0.9, metalness: 0.2 });
  const pad = new THREE.Mesh(padGeo, padMat);
  pad.position.y = -2.7;
  platform.add(pad);

  // Glowing concentric hex rings
  for (let i = 1; i <= 5; i++) {
    const ringGeo = new THREE.RingGeometry(i * 0.9 - 0.02, i * 0.9 + 0.02, 6);
    const ringMat = new THREE.MeshBasicMaterial({
      color: GLOW, transparent: true, opacity: 0.06 + (i === 3 ? 0.06 : 0),
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -2.63;
    ring.userData.ringIndex = i;
    platform.add(ring);
  }

  // Hex edge glow lines
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const b = ((i + 1) / 6) * Math.PI * 2;
    const r = 5;
    const pts = [
      new THREE.Vector3(Math.cos(a) * r, -2.64, Math.sin(a) * r),
      new THREE.Vector3(Math.cos(b) * r, -2.64, Math.sin(b) * r),
    ];
    const edgeGeo = new THREE.BufferGeometry().setFromPoints(pts);
    const edgeMat = new THREE.LineBasicMaterial({
      color: GLOW, transparent: true, opacity: 0.3,
      blending: THREE.AdditiveBlending,
    });
    platform.add(new THREE.Line(edgeGeo, edgeMat));
  }

  // Radial spokes
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const pts = [
      new THREE.Vector3(0, -2.64, 0),
      new THREE.Vector3(Math.cos(a) * 4.5, -2.64, Math.sin(a) * 4.5),
    ];
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({
      color: GLOW, transparent: true, opacity: 0.04,
      blending: THREE.AdditiveBlending,
    });
    platform.add(new THREE.Line(geo, mat));
  }

  // Holographic scanline cylinder
  const scanGeo = new THREE.CylinderGeometry(4.8, 4.8, 0.02, 64, 1, true);
  const scanMat = new THREE.MeshBasicMaterial({
    color: GLOW, transparent: true, opacity: 0.03,
    side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  });
  const scan = new THREE.Mesh(scanGeo, scanMat);
  scan.position.y = -2.5;
  scan.userData.isScanline = true;
  platform.add(scan);

  return platform;
}

/* ══════════════════════════════════════════════════════════
   Ambient particles + energy streams
   ══════════════════════════════════════════════════════════ */
function createAmbientParticles() {
  const count = 300;
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i * 3]     = (Math.random() - 0.5) * 20;
    positions[i * 3 + 1] = Math.random() * 16 - 3;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 20;
    sizes[i] = 0.02 + Math.random() * 0.06;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({
    color: GLOW, size: 0.05, transparent: true, opacity: 0.25,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
}

function createEnergyStreams() {
  const group = new THREE.Group();
  for (let i = 0; i < 8; i++) {
    const pts = [];
    const angle = (i / 8) * Math.PI * 2;
    const r = 2.5 + Math.random() * 1.5;
    for (let j = 0; j <= 20; j++) {
      const t = j / 20;
      pts.push(new THREE.Vector3(
        Math.cos(angle + t * Math.PI * 0.5) * r * (1 - t * 0.3),
        -2.5 + t * 12,
        Math.sin(angle + t * Math.PI * 0.5) * r * (1 - t * 0.3),
      ));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({
      color: GLOW, transparent: true, opacity: 0.04,
      blending: THREE.AdditiveBlending,
    });
    const line = new THREE.Line(geo, mat);
    line.userData.streamAngle = angle;
    group.add(line);
  }
  return group;
}

function updateAmbientParticles(pts, time) {
  const pos = pts.geometry.attributes.position.array;
  for (let i = 0; i < pos.length; i += 3) {
    pos[i + 1] += 0.004;
    pos[i] += Math.sin(time * 0.7 + i) * 0.0015;
    pos[i + 2] += Math.cos(time * 0.5 + i) * 0.001;
    if (pos[i + 1] > 12) pos[i + 1] = -3;
  }
  pts.geometry.attributes.position.needsUpdate = true;
}

/* ══════════════════════════════════════════════════════════
   Platform ring pulse + scanline
   ══════════════════════════════════════════════════════════ */
function updatePlatformRings(time) {
  if (!platformGroup) return;
  platformGroup.children.forEach(child => {
    if (child.userData.ringIndex) {
      const i = child.userData.ringIndex;
      child.material.opacity = 0.03 + 0.1 * Math.max(0, Math.sin(time * 1.5 - i * 0.6));
    }
    if (child.userData.isScanline) {
      child.position.y = -2.5 + Math.sin(time * 0.8) * 6 + 6;
      child.material.opacity = 0.02 + 0.02 * Math.sin(time * 2);
    }
  });
}

/* ══════════════════════════════════════════════════════════
   Cinematic intro
   ══════════════════════════════════════════════════════════ */
let introPlaying = false;
let introSkipped = false;

function playCinematicIntro(onComplete) {
  if (sessionStorage.getItem("forge_intro_done")) {
    onComplete();
    return;
  }
  introPlaying = true;
  const skipBtn = document.getElementById("forgeSkipBtn");
  if (skipBtn) {
    skipBtn.style.display = "block";
    skipBtn.addEventListener("click", () => {
      introSkipped = true;
      skipBtn.style.display = "none";
    }, { once: true });
  }

  const startPos = new THREE.Vector3(0, 0, 28);
  const endPos = new THREE.Vector3(6, 3, 10);
  const startTarget = new THREE.Vector3(0, 1, 0);
  const endTarget = new THREE.Vector3(0, 2.5, 0);
  controls.enabled = false;
  scene.fog = new THREE.FogExp2(0x0a0a0a, 0.06);
  camera.position.copy(startPos);
  controls.target.copy(startTarget);

  const startTime = performance.now();
  const CAM_DURATION = 3500;

  function tick() {
    if (introSkipped) {
      scene.fog = null;
      camera.position.copy(endPos);
      controls.target.copy(endTarget);
      controls.enabled = true;
      controls.update();
      introPlaying = false;
      sessionStorage.setItem("forge_intro_done", "1");
      if (skipBtn) skipBtn.style.display = "none";
      onComplete();
      return;
    }
    const elapsed = performance.now() - startTime;
    const t = Math.min(elapsed / CAM_DURATION, 1);
    const eased = easeInOutCubic(t);
    camera.position.lerpVectors(startPos, endPos, eased);
    controls.target.lerpVectors(startTarget, endTarget, eased);
    const fogT = Math.min(elapsed / 2500, 1);
    scene.fog.density = 0.06 * (1 - fogT);
    if (t < 1) {
      requestAnimationFrame(tick);
    } else {
      scene.fog = null;
      controls.enabled = true;
      introPlaying = false;
      sessionStorage.setItem("forge_intro_done", "1");
      if (skipBtn) skipBtn.style.display = "none";
      onComplete();
    }
  }
  requestAnimationFrame(tick);
}

/* ══════════════════════════════════════════════════════════
   Selection
   ══════════════════════════════════════════════════════════ */
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

export function getSelectedAttachment() { return selectedAttachment; }

export function selectAttachment(att) {
  selectedAttachment = att;
  if (!att) {
    outlinePass.selectedObjects = [];
    window.dispatchEvent(new CustomEvent("forge:deselect"));
    restoreAllEmissive();
    return;
  }
  const targetPos = new THREE.Vector3();
  att.getWorldPosition(targetPos);
  tweenVector3(controls.target, controls.target.clone(), targetPos, 600, easeOutCubic);
  controls.autoRotate = false;
  outlinePass.selectedObjects = [att];
  if (attachmentGroup) {
    attachmentGroup.children.forEach(other => {
      const isSameCat = other.userData.category === att.userData.category;
      const isSel = other === att;
      setGroupEmissive(other, isSel ? 2.0 : isSameCat ? 1.0 : 0.3);
    });
  }
  if (energyNetworkGroup) {
    energyNetworkGroup.children.forEach(line => {
      line.material.opacity = (line.userData.category === att.userData.category) ? 0.6 : 0.03;
    });
  }
  window.dispatchEvent(new CustomEvent("forge:select", { detail: att.userData }));
}

function restoreAllEmissive() {
  if (attachmentGroup) {
    attachmentGroup.children.forEach(a => setGroupEmissive(a, null));
  }
  if (energyNetworkGroup) {
    energyNetworkGroup.children.forEach(line => { line.material.opacity = 0.1; });
  }
}

function setGroupEmissive(group, intensity) {
  group.traverse(child => {
    if (child.isMesh && child.material && child.material.emissiveIntensity !== undefined) {
      if (intensity === null) {
        child.material.emissiveIntensity = child.userData._baseEmissive ?? child.material.emissiveIntensity;
      } else {
        if (child.userData._baseEmissive === undefined) child.userData._baseEmissive = child.material.emissiveIntensity;
        child.material.emissiveIntensity = intensity;
      }
    }
  });
}

function screenToNDC(e) {
  const rect = renderer.domElement.getBoundingClientRect();
  return new THREE.Vector2(
    ((e.clientX - rect.left) / rect.width) * 2 - 1,
    -((e.clientY - rect.top) / rect.height) * 2 + 1,
  );
}

function findNearestAttachment(ndc) {
  if (!attachmentGroup || attachmentGroup.children.length === 0) return null;
  mouse.copy(ndc);
  raycaster.setFromCamera(mouse, camera);
  const meshes = [];
  attachmentGroup.children.forEach(g => {
    g.traverse(c => { if (c.isMesh) meshes.push(c); });
  });
  const hits = raycaster.intersectObjects(meshes, false);
  if (hits.length > 0) {
    let target = hits[0].object;
    while (target && target.parent && !target.userData.skillSlug) target = target.parent;
    if (target?.userData?.skillSlug) return target;
  }
  let closest = null;
  let closestDist = Infinity;
  const _v = new THREE.Vector3();
  for (const group of attachmentGroup.children) {
    if (!group.userData.skillSlug) continue;
    group.getWorldPosition(_v);
    _v.project(camera);
    const dx = _v.x - ndc.x;
    const dy = _v.y - ndc.y;
    const d = dx * dx + dy * dy;
    if (d < closestDist) { closestDist = d; closest = group; }
  }
  return (closest && closestDist < 0.015) ? closest : null;
}

function onCanvasClick(e) {
  const ndc = screenToNDC(e);
  const target = findNearestAttachment(ndc);
  selectAttachment(target);
}

function onCanvasHover(e) {
  const ndc = screenToNDC(e);
  const target = findNearestAttachment(ndc);
  if (target && target !== selectedAttachment) {
    outlinePass.selectedObjects = selectedAttachment ? [selectedAttachment, target] : [target];
    renderer.domElement.style.cursor = "pointer";
    showHoverHud(target, e);
    return;
  }
  if (!selectedAttachment) outlinePass.selectedObjects = [];
  renderer.domElement.style.cursor = "default";
  hideHoverHud();
}
function ensureHoverHud() {
  if (hoverHudEl) return hoverHudEl;
  const vp = viewportEl();
  if (!vp) return null;
  const el = document.createElement("div");
  el.id = "forgeHoverHud";
  el.className = "forge-hover-hud";
  el.style.display = "none";
  vp.appendChild(el);
  hoverHudEl = el;
  return el;
}
function showHoverHud(att, evt) {
  const el = ensureHoverHud();
  if (!el) return;
  const ud = att?.userData || {};
  const name = ud.skillName || ud.skillSlug || "Unknown";
  const cat = ud.category || "Uncategorized";
  const risk = ud.risk_tier ?? "";
  const title = document.createElement("div");
  title.className = "forge-hover-hud-title";
  title.textContent = String(name);
  const meta = document.createElement("div");
  meta.className = "forge-hover-hud-meta";
  meta.textContent = `${cat}${risk !== "" ? ` · R${risk}` : ""}`;
  el.replaceChildren(title, meta);
  const rect = viewportEl().getBoundingClientRect();
  let x = evt.clientX - rect.left + 16;
  let y = evt.clientY - rect.top + 16;
  const maxX = rect.width - 220;
  const maxY = rect.height - 70;
  if (x > maxX) x = evt.clientX - rect.left - 220;
  if (y > maxY) y = evt.clientY - rect.top - 70;
  el.style.transform = `translate(${Math.max(8, x)}px, ${Math.max(8, y)}px)`;
  el.style.display = "block";
}
function hideHoverHud() {
  if (!hoverHudEl) return;
  hoverHudEl.style.display = "none";
}

/* ══════════════════════════════════════════════════════════
   HUD controls
   ══════════════════════════════════════════════════════════ */
function initHUD() {
  document.getElementById("forgeResetCam")?.addEventListener("click", () => {
    tweenVector3(camera.position, camera.position.clone(), new THREE.Vector3(6, 3, 10), 800, easeOutCubic);
    tweenVector3(controls.target, controls.target.clone(), new THREE.Vector3(0, 2.5, 0), 800, easeOutCubic);
  });
  document.getElementById("forgeToggleRotate")?.addEventListener("click", (e) => {
    controls.autoRotate = !controls.autoRotate;
    e.currentTarget.classList.toggle("active", controls.autoRotate);
  });
  document.getElementById("forgeToggleBloom")?.addEventListener("click", (e) => {
    bloomEnabled = !bloomEnabled;
    bloomPass.strength = bloomEnabled ? 1.2 : 0;
    e.currentTarget.classList.toggle("active", bloomEnabled);
  });
}

function setupAutoRotatePause() {
  const resumeDelay = 10000;
  function pauseRotate() {
    if (introPlaying) return;
    controls.autoRotate = false;
    clearTimeout(autoRotateTimer);
    autoRotateTimer = setTimeout(() => { controls.autoRotate = true; }, resumeDelay);
  }
  renderer.domElement.addEventListener("pointerdown", pauseRotate);
  renderer.domElement.addEventListener("wheel", pauseRotate);
}

/* ══════════════════════════════════════════════════════════
   Screenshot for Share-to-X
   ══════════════════════════════════════════════════════════ */
export function captureScreenshot(agentName, skillCount, onchainCount, categoryCount) {
  const w = renderer.domElement.width;
  const h = renderer.domElement.height;
  renderer.setSize(w * 2, h * 2, false);
  renderer.setPixelRatio(1);
  composer.setSize(w * 2, h * 2);
  composer.render();
  const comp = document.createElement("canvas");
  comp.width = w * 2;
  comp.height = h * 2;
  const ctx = comp.getContext("2d");
  ctx.drawImage(renderer.domElement, 0, 0);
  ctx.strokeStyle = "#cfff04";
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, comp.width - 4, comp.height - 4);
  ctx.font = "800 36px Outfit, sans-serif";
  ctx.fillStyle = "#cfff04";
  ctx.shadowColor = "rgba(207,255,4,0.4)";
  ctx.shadowBlur = 16;
  ctx.fillText("APECLAW", 24, 48);
  ctx.shadowBlur = 0;
  ctx.font = "500 18px Outfit, sans-serif";
  ctx.fillStyle = "#e6e6e6";
  ctx.fillText(agentName || "The Clawllector", 24, 74);
  const skillText = `${skillCount} Skills Installed`;
  ctx.font = '600 20px "JetBrains Mono", monospace';
  ctx.fillStyle = "#00ff00";
  const stm = ctx.measureText(skillText);
  ctx.fillText(skillText, comp.width - stm.width - 24, 48);
  ctx.font = '600 14px "JetBrains Mono", monospace';
  ctx.fillStyle = "rgba(166,166,166,0.7)";
  const powText = "Powered by Clutch Labs";
  const ptm = ctx.measureText(powText);
  ctx.fillText(powText, comp.width - ptm.width - 24, comp.height - 20);
  ctx.font = '500 14px "JetBrains Mono", monospace';
  ctx.fillStyle = "rgba(207,255,4,0.6)";
  ctx.fillText("github.com/simplefarmer69/ape-claw", 24, comp.height - 20);
  renderer.setSize(w, h, false);
  renderer.setPixelRatio(window.devicePixelRatio);
  composer.setSize(w, h);
  return comp;
}

/* ══════════════════════════════════════════════════════════
   Render loop
   ══════════════════════════════════════════════════════════ */
let idleAnimatorFn = null;
export function setIdleAnimator(fn) { idleAnimatorFn = fn; }

function animate() {
  requestAnimationFrame(animate);
  if (renderPaused) return;
  const time = performance.now() * 0.001;

  controls.update();

  // Core reactor pulse
  if (coreMesh) {
    coreMesh.material.emissiveIntensity = 1.55 + 0.45 * Math.sin(time * 2.5);
    coreMesh.rotation.y += 0.02;
    coreMesh.rotation.x = Math.sin(time * 1.5) * 0.2;
  }

  // Spine glow cascade
  spineSegments.forEach((seg, i) => {
    seg.material.emissiveIntensity = 1.0 + 1.5 * Math.max(0, Math.sin(time * 3.5 - i * 0.5));
  });

  // Visor flicker
  if (visorMesh) {
    visorMesh.material.opacity = 0.42 + 0.06 * Math.sin(time * 4) + Math.random() * 0.02;
    visorMesh.material.emissiveIntensity = 1.8 + 0.4 * Math.sin(time * 3);
  }

  // Joint glow rings pulse
  glowRings.forEach((ring, i) => {
    if (ring.material) {
      ring.material.opacity = 0.3 + 0.2 * Math.sin(time * 2 + i * 0.7);
      ring.material.emissiveIntensity = 1.1 + 0.6 * Math.sin(time * 2.5 + i * 0.5);
    }
  });

  // Exhaust flames flicker
  exhaustFlames.forEach((flame, i) => {
    if (flame.material) {
      flame.material.emissiveIntensity = 1.4 + 0.8 * Math.random();
      flame.material.opacity = 0.32 + 0.2 * Math.random();
    }
    flame.scale.y = 0.8 + 0.4 * Math.random();
  });

  // Energy streams rotation
  if (energyStreams) {
    energyStreams.rotation.y += 0.001;
    energyStreams.children.forEach((line, i) => {
      line.material.opacity = 0.02 + 0.04 * Math.sin(time * 0.8 + i * 0.5);
    });
  }

  updatePlatformRings(time);
  if (ambientParticles) updateAmbientParticles(ambientParticles, time);

  if (!selectedAttachment && energyNetworkGroup) {
    energyNetworkGroup.children.forEach(line => {
      line.material.opacity = 0.08 + 0.08 * Math.sin(time * 0.5);
    });
  }

  if (idleAnimatorFn) idleAnimatorFn(time);

  composer.render();
  css2dRenderer.render(scene, camera);
}

/* ══════════════════════════════════════════════════════════
   Resize handler
   ══════════════════════════════════════════════════════════ */
function onResize() {
  const vp = viewportEl();
  if (!vp) return;
  const w = vp.clientWidth;
  const h = vp.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
  css2dRenderer.setSize(w, h);
}

/* ══════════════════════════════════════════════════════════
   Init
   ══════════════════════════════════════════════════════════ */
export function initForgeScene() {
  if (initialized) return true;
  const vp = viewportEl();
  const canvas = canvasEl();
  if (!vp || !canvas) return false;

  const w = vp.clientWidth;
  const h = vp.clientHeight;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x080810);

  camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
  camera.position.set(6, 3, 10);

  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: false });
  } catch {
    return false;
  }
  if (!renderer.capabilities.isWebGL2 && !renderer.capabilities.isWebGL2) {
    return false;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(w, h);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  css2dRenderer = new CSS2DRenderer({ element: document.getElementById("forgeLabelLayer") });
  css2dRenderer.setSize(w, h);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 2.5, 0);
  controls.minDistance = 4;
  controls.maxDistance = 25;
  controls.maxPolarAngle = Math.PI * 0.85;
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.5;

  // ── Environment map for metallic surface reflections ──
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x1a2030);
  const envGlow = new THREE.Mesh(
    new THREE.SphereGeometry(10, 16, 8),
    new THREE.MeshBasicMaterial({ color: 0x3a5060, side: THREE.BackSide })
  );
  envScene.add(envGlow);
  const envTop = new THREE.PointLight(0x7090b0, 2, 20);
  envTop.position.set(0, 8, 0);
  envScene.add(envTop);
  const envSide = new THREE.PointLight(GLOW, 0.5, 20);
  envSide.position.set(5, 0, 5);
  envScene.add(envSide);
  const envMap = pmremGenerator.fromScene(envScene).texture;
  scene.environment = envMap;
  pmremGenerator.dispose();

  // ── Dramatic lighting (bright enough to read chrome armor) ──
  scene.add(new THREE.AmbientLight(0x404060, 0.9));
  const hemi = new THREE.HemisphereLight(0xb8ccff, 0x12161f, 0.65);
  scene.add(hemi);

  const keyLight = new THREE.DirectionalLight(0xffffff, 2.1);
  keyLight.position.set(5, 10, 5);
  scene.add(keyLight);

  const fillLight = new THREE.PointLight(CYAN, 1.0, 25);
  fillLight.position.set(-5, 5, 3);
  scene.add(fillLight);

  const rimLight = new THREE.PointLight(GLOW, 0.8, 20);
  rimLight.position.set(0, 8, -8);
  scene.add(rimLight);

  const underGlow = new THREE.PointLight(GLOW, 0.5, 12);
  underGlow.position.set(0, -2, 0);
  scene.add(underGlow);

  const frontFill = new THREE.PointLight(0xccccff, 0.6, 18);
  frontFill.position.set(0, 4, 8);
  scene.add(frontFill);

  const bodySpot = new THREE.SpotLight(0xaec6ff, 1.1, 26, Math.PI * 0.36, 0.45, 1.1);
  bodySpot.position.set(0, 9.5, 5.5);
  bodySpot.target.position.set(0, 2.6, 0);
  scene.add(bodySpot);
  scene.add(bodySpot.target);

  const sideAccent = new THREE.PointLight(0xb026ff, 0.4, 15);
  sideAccent.position.set(6, 3, -3);
  scene.add(sideAccent);

  const sideAccent2 = new THREE.PointLight(CYAN, 0.3, 15);
  sideAccent2.position.set(-6, 3, -3);
  scene.add(sideAccent2);

  // Ground
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new M({ color: 0x050505, roughness: 0.95, metalness: 0.0 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -2.8;
  scene.add(ground);

  platformGroup = buildPlatform();
  scene.add(platformGroup);

  robotGroup = new THREE.Group();
  robotGroup.add(buildChassis());
  scene.add(robotGroup);

  attachmentGroup = new THREE.Group();
  scene.add(attachmentGroup);

  energyNetworkGroup = new THREE.Group();
  scene.add(energyNetworkGroup);

  ambientParticles = createAmbientParticles();
  scene.add(ambientParticles);

  energyStreams = createEnergyStreams();
  scene.add(energyStreams);

  // ── Post-processing (heavy bloom) ──
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.7, 0.32, 0.88);
  composer.addPass(bloomPass);

  outlinePass = new OutlinePass(new THREE.Vector2(w, h), scene, camera);
  outlinePass.edgeStrength = 4;
  outlinePass.edgeGlow = 1.5;
  outlinePass.edgeThickness = 1.2;
  outlinePass.visibleEdgeColor.set(GLOW);
  outlinePass.hiddenEdgeColor.set(GLOW);
  composer.addPass(outlinePass);

  viewportEl().addEventListener("click", onCanvasClick);
  viewportEl().addEventListener("pointermove", onCanvasHover);
  viewportEl().addEventListener("pointerleave", () => {
    renderer.domElement.style.cursor = "default";
    hideHoverHud();
    if (!selectedAttachment) outlinePass.selectedObjects = [];
  });
  window.addEventListener("resize", onResize);
  document.addEventListener("visibilitychange", () => {
    renderPaused = document.hidden;
  });
  renderer.domElement.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    renderPaused = true;
    window.dispatchEvent(new CustomEvent("forge:webgl-lost"));
  });
  renderer.domElement.addEventListener("webglcontextrestored", () => {
    renderPaused = false;
    window.dispatchEvent(new CustomEvent("forge:webgl-restored"));
  });

  initHUD();
  setupAutoRotatePause();
  animate();

  playCinematicIntro(() => {
    window.dispatchEvent(new CustomEvent("forge:ready"));
  });

  initialized = true;
  return true;
}

/* ── Bootstrap on DOM ready ─────────────────────────── */
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}

function boot() {
  const ok = initForgeScene();
  if (!ok) {
    const vp = viewportEl();
    if (vp) {
      vp.innerHTML = `<div class="forge-fallback">
        <div class="forge-fallback-robot">&#x1F916;</div>
        <div class="forge-fallback-stats"><span>WebGL not available</span></div>
      </div>`;
    }
  }
}
