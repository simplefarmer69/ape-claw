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
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { SSAOPass } from "three/addons/postprocessing/SSAOPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

/* ══════════════════════════════════════════════════════════
   Material palette — HV-MTL inspired chrome + neon
   ══════════════════════════════════════════════════════════ */
const M = THREE.MeshStandardMaterial;
const P = THREE.MeshPhysicalMaterial;

const GLOW = 0x4488ff;
const CYAN = 0x5599ff;
const HOT  = 0xff3344;
const RED  = 0xcc2233;
const BLUE = 0x1a3a88;

export const MAT = {
  // Primary armor — deep Optimus-blue with mirror clearcoat
  armor:     new P({ color: 0x1a2e6a, roughness: 0.15, metalness: 0.85, emissive: 0x080e28, emissiveIntensity: 0.3, clearcoat: 1.0, clearcoatRoughness: 0.05 }),
  armorLt:   new P({ color: 0x283d7a, roughness: 0.18, metalness: 0.8, emissive: 0x0a1230, emissiveIntensity: 0.3, clearcoat: 0.9, clearcoatRoughness: 0.08 }),
  // Heroic red accent plates (chest, shoulders)
  armorRed:  new P({ color: 0xaa1825, roughness: 0.12, metalness: 0.85, emissive: 0x330808, emissiveIntensity: 0.4, clearcoat: 1.0, clearcoatRoughness: 0.04 }),
  // Chrome — high-shine polished silver
  chrome:    new P({ color: 0xc0ccdd, roughness: 0.04, metalness: 0.98, emissive: 0x3a4555, emissiveIntensity: 0.5, clearcoat: 1.0, clearcoatRoughness: 0.02 }),
  joint:     new P({ color: 0x2a2e38, roughness: 0.25, metalness: 0.7, emissive: GLOW, emissiveIntensity: 0.2, clearcoat: 0.8, clearcoatRoughness: 0.15, sheen: 0.3, sheenColor: new THREE.Color(GLOW), sheenRoughness: 0.5 }),
  visor:     new P({ color: 0xaaddff, emissive: CYAN, emissiveIntensity: 2.2, roughness: 0.05, metalness: 0.0, transmission: 0.85, thickness: 0.4, clearcoat: 1.0, clearcoatRoughness: 0.0, transparent: true, opacity: 0.85, iridescence: 0.6, iridescenceIOR: 1.3, iridescenceThicknessRange: [100, 400] }),
  core:      new P({ color: 0xaaddff, emissive: GLOW, emissiveIntensity: 3.5, roughness: 0.05, metalness: 0.0, transmission: 0.7, thickness: 0.6, clearcoat: 1.0, clearcoatRoughness: 0.0 }),
  coreInner: new P({ color: 0xffffff, emissive: GLOW, emissiveIntensity: 5.0, transparent: true, opacity: 0.95, clearcoat: 1.0, clearcoatRoughness: 0.0 }),
  vent:      new P({ color: GLOW, emissive: GLOW, emissiveIntensity: 2.5, transparent: true, opacity: 0.8, clearcoat: 0.5, clearcoatRoughness: 0.2 }),
  ventHot:   new P({ color: HOT, emissive: HOT, emissiveIntensity: 3.0, transparent: true, opacity: 0.7, clearcoat: 0.3, clearcoatRoughness: 0.3 }),
  panelLine: new P({ color: GLOW, emissive: GLOW, emissiveIntensity: 1.8, transparent: true, opacity: 0.7 }),
  spineGlow: new P({ color: GLOW, emissive: GLOW, emissiveIntensity: 2.5, clearcoat: 0.4, clearcoatRoughness: 0.3 }),
  hardpoint: new P({ color: 0x404858, roughness: 0.15, metalness: 0.8, emissive: CYAN, emissiveIntensity: 0.4, clearcoat: 0.8, clearcoatRoughness: 0.1 }),
  security:      new P({ color: 0xFFB347, emissive: 0xFFB347, emissiveIntensity: 1.2, roughness: 0.15, metalness: 0.8, clearcoat: 0.6, clearcoatRoughness: 0.1 }),
  analytics:     new P({ color: 0x63d7ff, emissive: 0x63d7ff, emissiveIntensity: 1.2, roughness: 0.15, metalness: 0.7, clearcoat: 0.6, clearcoatRoughness: 0.1 }),
  automation:    new P({ color: 0x00ff00, emissive: 0x00ff00, emissiveIntensity: 1.2, roughness: 0.15, metalness: 0.7, clearcoat: 0.5, clearcoatRoughness: 0.15 }),
  devtools:      new P({ color: 0x4169E1, emissive: 0x4169E1, emissiveIntensity: 1.2, roughness: 0.15, metalness: 0.7, clearcoat: 0.5, clearcoatRoughness: 0.15 }),
  nft:           new P({ color: 0xb026ff, emissive: 0xb026ff, emissiveIntensity: 1.5, roughness: 0.12, metalness: 0.8, clearcoat: 0.7, clearcoatRoughness: 0.08, iridescence: 0.4, iridescenceIOR: 1.5 }),
  social:        new P({ color: 0xFF7F50, emissive: 0xFF7F50, emissiveIntensity: 1.2, roughness: 0.15, metalness: 0.6, clearcoat: 0.5, clearcoatRoughness: 0.15 }),
  storage:       new P({ color: 0x6A5ACD, emissive: 0x6A5ACD, emissiveIntensity: 1.0, roughness: 0.2, metalness: 0.6, clearcoat: 0.4, clearcoatRoughness: 0.2 }),
  productivity:  new P({ color: 0xE6F3FF, emissive: 0xE6F3FF, emissiveIntensity: 0.8, roughness: 0.15, metalness: 0.5, clearcoat: 0.5, clearcoatRoughness: 0.15 }),
  bridge:        new P({ color: 0xFF8C00, emissive: 0xFF8C00, emissiveIntensity: 1.2, roughness: 0.15, metalness: 0.7, clearcoat: 0.5, clearcoatRoughness: 0.15 }),
  trading:       new P({ color: 0xFFD700, emissive: 0xFFD700, emissiveIntensity: 1.0, roughness: 0.1, metalness: 0.9, clearcoat: 0.8, clearcoatRoughness: 0.05 }),
  governance:    new P({ color: 0x4B0082, emissive: 0x4B0082, emissiveIntensity: 1.2, roughness: 0.15, metalness: 0.7, clearcoat: 0.5, clearcoatRoughness: 0.15 }),
  wallet:        new P({ color: 0x50C878, emissive: 0x50C878, emissiveIntensity: 1.0, roughness: 0.15, metalness: 0.6, clearcoat: 0.5, clearcoatRoughness: 0.15 }),
  defi:          new P({ color: 0x32CD32, emissive: 0x32CD32, emissiveIntensity: 1.2, roughness: 0.15, metalness: 0.7, clearcoat: 0.5, clearcoatRoughness: 0.15 }),
  development:   new P({ color: 0x4169E1, emissive: 0x4169E1, emissiveIntensity: 1.2, roughness: 0.15, metalness: 0.7, clearcoat: 0.5, clearcoatRoughness: 0.15 }),
  writing:       new P({ color: 0xFFF8DC, emissive: 0xFFF8DC, emissiveIntensity: 0.7, roughness: 0.2, metalness: 0.5, clearcoat: 0.4, clearcoatRoughness: 0.2 }),
  communication: new P({ color: 0x00BFFF, emissive: 0x00BFFF, emissiveIntensity: 1.2, roughness: 0.15, metalness: 0.7, clearcoat: 0.6, clearcoatRoughness: 0.1 }),
  undersuit:  new P({ color: 0x0a0e18, roughness: 0.6, metalness: 0.3, emissive: 0x020408, emissiveIntensity: 0.05, clearcoat: 0.2 }),
  pistonMat:  new P({ color: 0xc8c8d0, roughness: 0.06, metalness: 0.95, emissive: 0x404050, emissiveIntensity: 0.2, clearcoat: 1.0, clearcoatRoughness: 0.02 }),
  cableMat:   new M({ color: 0x101018, roughness: 0.85, metalness: 0.15 }),
  rivetMat:   new P({ color: 0xe0e8f0, roughness: 0.04, metalness: 0.98, emissive: 0x607088, emissiveIntensity: 0.3, clearcoat: 1.0, clearcoatRoughness: 0.0 }),
  frameMat:   new P({ color: 0x1a2030, roughness: 0.35, metalness: 0.6, emissive: 0x050810, emissiveIntensity: 0.1, clearcoat: 0.4, clearcoatRoughness: 0.2 }),
  darkChrome: new P({ color: 0x2a3040, roughness: 0.08, metalness: 0.92, emissive: 0x101520, emissiveIntensity: 0.25, clearcoat: 1.0, clearcoatRoughness: 0.04 }),
  // Mechanical internals
  servo:     new P({ color: 0x2a2a32, roughness: 0.35, metalness: 0.7, emissive: 0x080810, emissiveIntensity: 0.1, clearcoat: 0.3, clearcoatRoughness: 0.3 }),
  hydraulic: new P({ color: 0x886622, roughness: 0.2, metalness: 0.85, emissive: 0x221100, emissiveIntensity: 0.15, clearcoat: 0.7, clearcoatRoughness: 0.1 }),
  rubber:    new P({ color: 0x0c0c10, roughness: 0.9, metalness: 0.05, emissive: 0x000000, emissiveIntensity: 0.0 }),
  coolingFin:new P({ color: 0x1e2838, roughness: 0.25, metalness: 0.75, emissive: 0x040810, emissiveIntensity: 0.08, clearcoat: 0.5, clearcoatRoughness: 0.15 }),
  weldSeam:  new P({ color: 0x505868, roughness: 0.5, metalness: 0.6, emissive: 0x101418, emissiveIntensity: 0.05, clearcoat: 0.2 }),
  oilStain:  new P({ color: 0x181410, roughness: 0.7, metalness: 0.2, emissive: 0x000000, emissiveIntensity: 0.0, clearcoat: 0.6, clearcoatRoughness: 0.4 }),
  lens:      new P({ color: 0x112244, emissive: CYAN, emissiveIntensity: 1.5, roughness: 0.02, metalness: 0.0, transmission: 0.6, thickness: 0.2, clearcoat: 1.0, clearcoatRoughness: 0.0, transparent: true, opacity: 0.9 }),
};

/* ══════════════════════════════════════════════════════════
   Procedural surface detail — bump + roughness maps
   Adds panel grooves, bolt heads, micro-scratches, and
   worn-metal roughness variation to chassis materials.
   ══════════════════════════════════════════════════════════ */
function _detailCanvas(size, fn) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  fn(c.getContext("2d"), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

const _armorBump = _detailCanvas(256, (ctx, s) => {
  ctx.fillStyle = "#808080"; ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = "#5e5e5e"; ctx.lineWidth = 1.5;
  for (let y = 0; y < s; y += 28) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(s, y); ctx.stroke(); }
  for (let x = 0; x < s; x += 42) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, s); ctx.stroke(); }
  ctx.fillStyle = "#949494";
  for (let x = 21; x < s; x += 42) for (let y = 14; y < s; y += 28) {
    ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = "#727272"; ctx.lineWidth = 0.4; ctx.globalAlpha = 0.7;
  for (let i = 0; i < 50; i++) {
    const sx = Math.random() * s, sy = Math.random() * s;
    ctx.beginPath(); ctx.moveTo(sx, sy);
    ctx.lineTo(sx + (Math.random() - 0.5) * 35, sy + (Math.random() - 0.5) * 4);
    ctx.stroke();
  }
});
_armorBump.repeat.set(3, 3);

const _chromeBump = _detailCanvas(256, (ctx, s) => {
  ctx.fillStyle = "#808080"; ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = "#747474"; ctx.lineWidth = 0.3; ctx.globalAlpha = 0.6;
  for (let i = 0; i < 400; i++) {
    const y = Math.random() * s, x = Math.random() * s * 0.15;
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.lineTo(x + 25 + Math.random() * 70, y + (Math.random() - 0.5) * 1);
    ctx.stroke();
  }
});
_chromeBump.repeat.set(4, 4);

const _roughVar = _detailCanvas(256, (ctx, s) => {
  // Base matte
  ctx.fillStyle = "#909090"; ctx.fillRect(0, 0, s, s);

  // Large grunge patches (darker = shinier/oily)
  ctx.globalCompositeOperation = "multiply";
  for (let i = 0; i < 8; i++) {
    const cx = Math.random() * s, cy = Math.random() * s, r = 30 + Math.random() * 50;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, "rgba(100,100,100,0.6)");
    g.addColorStop(1, "rgba(140,140,140,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  }
  ctx.globalCompositeOperation = "source-over";

  // Scratches (lighter = rougher exposed metal/primer)
  ctx.strokeStyle = "#d0d0d0"; ctx.lineWidth = 0.6; ctx.globalAlpha = 0.5;
  for (let i = 0; i < 120; i++) {
    const sx = Math.random() * s, sy = Math.random() * s;
    ctx.beginPath(); ctx.moveTo(sx, sy);
    ctx.lineTo(sx + (Math.random() - 0.5) * 30, sy + (Math.random() - 0.5) * 8);
    ctx.stroke();
  }

  // Worn panel edges (darker = polished wear)
  ctx.strokeStyle = "#606060"; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.4;
  for (let y = 0; y < s; y += 28) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(s, y); ctx.stroke(); }
  for (let x = 0; x < s; x += 42) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, s); ctx.stroke(); }
});
_roughVar.repeat.set(3, 3);

// Procedural normal map for directional lighting on panel seams
const _armorNormal = _detailCanvas(256, (ctx, s) => {
  ctx.fillStyle = "#8080ff"; ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = "#6060ff"; ctx.lineWidth = 2;
  for (let y = 0; y < s; y += 28) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(s, y); ctx.stroke(); }
  for (let x = 0; x < s; x += 42) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, s); ctx.stroke(); }
  ctx.fillStyle = "#a0a0ff";
  for (let x = 21; x < s; x += 42) for (let y = 14; y < s; y += 28) {
    ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
  }
});
_armorNormal.repeat.set(3, 3);

// Anisotropic brushed-metal direction for chrome
const _chromeAniso = _detailCanvas(256, (ctx, s) => {
  ctx.fillStyle = "#8080ff"; ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = "#9060ff"; ctx.lineWidth = 0.5; ctx.globalAlpha = 0.7;
  for (let i = 0; i < 600; i++) {
    const y = Math.random() * s, x = Math.random() * s * 0.1;
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.lineTo(x + 20 + Math.random() * 80, y + (Math.random() - 0.5) * 0.5);
    ctx.stroke();
  }
});
_chromeAniso.repeat.set(4, 4);

for (const k of ["armor", "armorLt", "armorRed"]) {
  MAT[k].bumpMap = _armorBump; MAT[k].bumpScale = 0.018;
  MAT[k].normalMap = _armorNormal; MAT[k].normalScale = new THREE.Vector2(0.15, 0.15);
  MAT[k].roughnessMap = _roughVar;
}
for (const k of ["chrome", "darkChrome"]) {
  MAT[k].bumpMap = _chromeBump; MAT[k].bumpScale = 0.01;
  MAT[k].normalMap = _chromeAniso; MAT[k].normalScale = new THREE.Vector2(0.12, 0.12);
  MAT[k].roughnessMap = _roughVar;
}
MAT.hardpoint.bumpMap = _armorBump; MAT.hardpoint.bumpScale = 0.012;
MAT.hardpoint.normalMap = _armorNormal; MAT.hardpoint.normalScale = new THREE.Vector2(0.1, 0.1);
MAT.pistonMat.bumpMap = _chromeBump; MAT.pistonMat.bumpScale = 0.008;
MAT.pistonMat.normalMap = _chromeAniso; MAT.pistonMat.normalScale = new THREE.Vector2(0.1, 0.1);
MAT.joint.bumpMap = _chromeBump; MAT.joint.bumpScale = 0.006;
MAT.undersuit.bumpMap = _armorBump; MAT.undersuit.bumpScale = 0.005;
MAT.frameMat.bumpMap = _armorBump; MAT.frameMat.bumpScale = 0.008;
MAT.servo.bumpMap = _armorBump; MAT.servo.bumpScale = 0.01;
MAT.servo.roughnessMap = _roughVar;
MAT.hydraulic.bumpMap = _chromeBump; MAT.hydraulic.bumpScale = 0.006;
MAT.hydraulic.normalMap = _chromeAniso; MAT.hydraulic.normalScale = new THREE.Vector2(0.08, 0.08);
MAT.coolingFin.bumpMap = _armorBump; MAT.coolingFin.bumpScale = 0.008;
MAT.weldSeam.bumpMap = _roughVar; MAT.weldSeam.bumpScale = 0.02;

/* ══════════════════════════════════════════════════════════
   Film grain + vignette shader
   ══════════════════════════════════════════════════════════ */
const FilmGrainShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    intensity: { value: 0.03 },
  },
  vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform float intensity;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float grain = (hash(vUv * 1000.0 + time) - 0.5) * intensity;
      vec2 uv = vUv * 2.0 - 1.0;
      float vig = 1.0 - dot(uv * 0.55, uv * 0.55);
      c.rgb = c.rgb * vig + grain;
      gl_FragColor = c;
    }
  `,
};

/* ══════════════════════════════════════════════════════════
   Scene globals (exported for other modules)
   ══════════════════════════════════════════════════════════ */
export let scene, camera, renderer, composer, controls, outlinePass, css2dRenderer;
export let robotGroup, attachmentGroup, energyNetworkGroup, platformGroup;
export let coreMesh, visorMesh, spineSegments = [];
let ambientParticles, energyStreams, bloomPass, ssaoPass, filmGrainPass;
let autoRotateTimer = null;
let bloomEnabled = true;
let selectedAttachment = null;
let glowRings = [];
let exhaustFlames = [];
let initialized = false;
let renderPaused = false;
let hoverHudEl = null;
let headPivotRef = null, leftArmPivotRef = null, rightArmPivotRef = null;
let agentSpeaking = false;
let heatShimmerMeshes = [];

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
  const minDim = Math.min(w, h, d);
  const geo = minDim > 0.08
    ? new RoundedBoxGeometry(w, h, d, 2, minDim * 0.12)
    : new THREE.BoxGeometry(w, h, d);
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (rx) m.rotation.x = rx;
  if (ry) m.rotation.y = ry;
  if (rz) m.rotation.z = rz;
  g.add(m);
  return m;
}
function cyl(g, rT, rB, h, mat, x, y, z, segs) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rT, rB, h, segs || 24), mat);
  m.position.set(x, y, z);
  g.add(m);
  return m;
}
function sphere(g, r, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 24), mat);
  m.position.set(x, y, z);
  g.add(m);
  return m;
}
function torus(g, r, tube, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 24, 64), mat);
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
function servoDrum(g, r, w, x, y, z, rz) {
  const drum = cyl(g, r, r, w, MAT.servo, x, y, z, 16);
  if (rz) drum.rotation.z = rz; else drum.rotation.z = Math.PI / 2;
  const cap1 = cyl(g, r * 0.5, r * 0.5, w * 0.15, MAT.chrome, x, y, z, 8);
  cap1.rotation.z = drum.rotation.z;
  torus(g, r * 0.85, r * 0.08, MAT.darkChrome, x, y, z);
  return drum;
}
function hydraulicRam(g, r, len, x, y, z, rx, ry, rz) {
  const outer = cyl(g, r, r, len * 0.55, MAT.hydraulic, x, y, z, 10);
  if (rx) outer.rotation.x = rx; if (ry) outer.rotation.y = ry; if (rz) outer.rotation.z = rz;
  const inner = cyl(g, r * 0.6, r * 0.6, len * 0.65, MAT.pistonMat, x, y, z, 8);
  inner.rotation.x = outer.rotation.x; inner.rotation.y = outer.rotation.y; inner.rotation.z = outer.rotation.z;
  const seal = cyl(g, r * 1.2, r * 1.2, len * 0.06, MAT.rubber, x, y, z, 12);
  seal.rotation.x = outer.rotation.x; seal.rotation.y = outer.rotation.y; seal.rotation.z = outer.rotation.z;
  return outer;
}
function coolingFins(g, count, w, h, spacing, x, y, z, vertical) {
  for (let i = 0; i < count; i++) {
    const offset = (i - (count - 1) / 2) * spacing;
    if (vertical) {
      box(g, 0.015, h, w, MAT.coolingFin, x + offset, y, z);
    } else {
      box(g, w, 0.015, h, MAT.coolingFin, x, y + offset, z);
    }
  }
}
function boltCluster(g, count, radius, x, y, z) {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    rivet(g, x + Math.cos(a) * radius, y, z + Math.sin(a) * radius);
  }
}
function rubberSeal(g, r, tube, x, y, z) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 12, 32), MAT.rubber);
  m.position.set(x, y, z); m.rotation.x = Math.PI / 2; g.add(m); return m;
}
function cableBundle(g, count, r, len, x, y, z, rx, ry, rz) {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const ox = Math.cos(a) * r * 2.5;
    const oz = Math.sin(a) * r * 2.5;
    cableRun(g, r, len, x + ox, y, z + oz, rx, ry, rz);
  }
}

/* ══════════════════════════════════════════════════════════
   Build chassis — HV-MTL Activated inspired mecha
   Connected armor plates, mechanical joints, energy vents
   ══════════════════════════════════════════════════════════ */
function buildChassis() {
  const g = new THREE.Group();
  glowRings = [];
  exhaustFlames = [];
  heatShimmerMeshes = [];

  // ── Animatable pivot groups (head + arms) ──
  const _hp = new THREE.Group(); _hp.position.set(0, 5.85, 0);
  const hd = new THREE.Group(); hd.position.set(0, -5.85, 0); _hp.add(hd);
  const _lp = new THREE.Group(); _lp.position.set(-1.75, 5.25, 0);
  const la = new THREE.Group(); la.position.set(1.75, -5.25, 0); _lp.add(la);
  const _rp = new THREE.Group(); _rp.position.set(1.75, 5.25, 0);
  const ra = new THREE.Group(); ra.position.set(-1.75, -5.25, 0); _rp.add(ra);

  // ══════════════════════════════════════════════════════════
  // HEAD — Refined helmet with advanced multi-element optical array
  // ══════════════════════════════════════════════════════════

  // ── Inner cranium (processor housing visible through panel gaps) ──
  box(hd, 0.82, 0.72, 0.72, MAT.servo, 0, 6.4, 0);
  box(hd, 0.74, 0.66, 0.66, MAT.frameMat, 0, 6.4, 0);
  // Processor board detail (visible through top gap)
  box(hd, 0.4, 0.02, 0.35, MAT.vent, 0, 6.72, 0);
  for (let i = 0; i < 3; i++)
    box(hd, 0.06, 0.04, 0.06, MAT.coreInner, -0.12 + i * 0.12, 6.73, 0.08);

  // ── Outer helmet (split halves with layered sub-panels) ──
  box(hd, 0.58, 0.98, 0.98, MAT.armor, -0.3, 6.44, 0);
  box(hd, 0.58, 0.98, 0.98, MAT.armor, 0.3, 6.44, 0);
  // Central seam
  box(hd, 0.03, 0.98, 0.06, MAT.panelLine, 0, 6.44, 0.47);
  box(hd, 0.02, 0.75, 0.04, MAT.weldSeam, -0.16, 6.52, 0.47);
  box(hd, 0.02, 0.75, 0.04, MAT.weldSeam, 0.16, 6.52, 0.47);
  // Sub-panel chrome inlays
  for (let side = -1; side <= 1; side += 2) {
    box(hd, 0.05, 0.55, 0.48, MAT.darkChrome, side * 0.32, 6.64, 0.22);
    box(hd, 0.03, 0.35, 0.28, MAT.servo, side * 0.3, 6.74, 0.32);
    // Temple status indicator lights (3 per side)
    for (let i = 0; i < 3; i++)
      sphere(hd, 0.015, MAT.vent, side * 0.58, 6.62 + i * 0.1, 0.3);
  }

  // ── Crest (taller, multi-layered Prime fin) ──
  box(hd, 0.2, 0.55, 0.75, MAT.chrome, 0, 7.16, -0.04);
  box(hd, 0.12, 0.32, 0.55, MAT.armorRed, 0, 7.34, -0.04);
  box(hd, 0.07, 0.18, 0.4, MAT.chrome, 0, 7.44, -0.04);
  box(hd, 0.04, 0.1, 0.25, MAT.coreInner, 0, 7.5, -0.04);
  for (let i = 0; i < 5; i++)
    box(hd, 0.14, 0.025, 0.52, MAT.frameMat, 0, 6.98 + i * 0.11, -0.04);

  // ── Brow plate (heavy chrome visor shield, bolted) ──
  box(hd, 1.28, 0.18, 0.42, MAT.chrome, 0, 6.72, 0.3, -0.1, 0, 0);
  box(hd, 1.0, 0.08, 0.32, MAT.darkChrome, 0, 6.66, 0.34, -0.08, 0, 0);
  // Underside of brow (recessed shadow area above visor)
  box(hd, 1.2, 0.06, 0.12, MAT.servo, 0, 6.62, 0.42);
  boltCluster(hd, 5, 0.1, -0.42, 6.72, 0.46);
  boltCluster(hd, 5, 0.1, 0.42, 6.72, 0.46);

  // ══════════════════════════════════════════════════════════
  // VISION SYSTEM — Recessed optical housing with multi-element array
  // ══════════════════════════════════════════════════════════

  // Visor housing recess (dark channel cut into helmet face)
  box(hd, 1.24, 0.3, 0.12, MAT.servo, 0, 6.44, 0.44);
  box(hd, 1.18, 0.26, 0.06, MAT.frameMat, 0, 6.44, 0.46);

  // Main visor glass (curved band sitting in the recess)
  visorMesh = box(hd, 1.2, 0.24, 0.05, MAT.visor, 0, 6.44, 0.5);

  // Chrome visor frame (top rail, bottom rail, side brackets)
  box(hd, 1.26, 0.03, 0.1, MAT.chrome, 0, 6.57, 0.48);
  box(hd, 1.26, 0.03, 0.1, MAT.chrome, 0, 6.31, 0.48);
  box(hd, 0.05, 0.3, 0.1, MAT.chrome, -0.62, 6.44, 0.48);
  box(hd, 0.05, 0.3, 0.1, MAT.chrome, 0.62, 6.44, 0.48);
  // Corner brackets
  for (let sx = -1; sx <= 1; sx += 2)
    for (let sy = -1; sy <= 1; sy += 2)
      rivet(hd, sx * 0.58, 6.44 + sy * 0.12, 0.52);

  // Inner visor glow plate (HUD backlight)
  box(hd, 1.14, 0.2, 0.015, MAT.coreInner, 0, 6.44, 0.43);

  // ── Primary optics (2 main camera barrels — left and right of center) ──
  for (let side = -1; side <= 1; side += 2) {
    const ox = side * 0.22;
    // Outer barrel housing (chrome)
    cyl(hd, 0.075, 0.075, 0.1, MAT.darkChrome, ox, 6.44, 0.42, 16);
    // Lens element 1 (outer glass)
    cyl(hd, 0.06, 0.055, 0.03, MAT.lens, ox, 6.44, 0.46, 16);
    // Lens element 2 (inner, brighter)
    cyl(hd, 0.04, 0.035, 0.02, MAT.core, ox, 6.44, 0.47, 16);
    // Pupil (bright emissive center)
    sphere(hd, 0.022, MAT.coreInner, ox, 6.44, 0.48);
    // Iris ring
    torus(hd, 0.05, 0.008, MAT.vent, ox, 6.44, 0.46);
    // Focus ring (chrome)
    torus(hd, 0.065, 0.006, MAT.chrome, ox, 6.44, 0.44);
    // Barrel mount bolts
    boltCluster(hd, 6, 0.07, ox, 6.44, 0.42);
  }

  // ── Central targeting sensor (between main optics) ──
  cyl(hd, 0.03, 0.03, 0.08, MAT.darkChrome, 0, 6.44, 0.44, 12);
  sphere(hd, 0.018, MAT.ventHot, 0, 6.44, 0.48);
  torus(hd, 0.025, 0.004, MAT.chrome, 0, 6.44, 0.46);

  // ── Peripheral sensors (small wide-angle lenses at visor edges) ──
  for (let side = -1; side <= 1; side += 2) {
    const px = side * 0.48;
    cyl(hd, 0.025, 0.025, 0.05, MAT.frameMat, px, 6.44, 0.44, 10);
    cyl(hd, 0.018, 0.015, 0.02, MAT.lens, px, 6.44, 0.47, 10);
    sphere(hd, 0.01, MAT.coreInner, px, 6.44, 0.48);
  }

  // ── Scanning emitter bar (thin line below visor that sweeps) ──
  box(hd, 1.1, 0.02, 0.04, MAT.vent, 0, 6.3, 0.49);
  box(hd, 0.8, 0.012, 0.02, MAT.coreInner, 0, 6.3, 0.5);

  // ── Infrared/thermal sensors (above visor, recessed) ──
  for (let side = -1; side <= 1; side += 2) {
    cyl(hd, 0.02, 0.02, 0.04, MAT.darkChrome, side * 0.35, 6.6, 0.44, 8);
    sphere(hd, 0.012, MAT.ventHot, side * 0.35, 6.6, 0.46);
  }

  // ── Under-visor data strip (status readout line) ──
  box(hd, 0.9, 0.025, 0.03, MAT.panelLine, 0, 6.28, 0.48);

  // ══════════════════════════════════════════════════════════
  // FACEPLATE / JAW (segmented with jaw actuators)
  // ══════════════════════════════════════════════════════════

  // Upper faceplate
  box(hd, 0.82, 0.2, 0.54, MAT.chrome, 0, 6.12, 0.15);
  box(hd, 0.64, 0.08, 0.44, MAT.darkChrome, 0, 6.04, 0.2);
  // Faceplate vent grille (articulated slats)
  for (let i = 0; i < 6; i++) {
    box(hd, 0.5, 0.015, 0.06, MAT.vent, 0, 6.16 - i * 0.032, 0.42);
    box(hd, 0.48, 0.008, 0.04, MAT.frameMat, 0, 6.16 - i * 0.032, 0.44);
  }
  // Lower jaw / chin guard
  box(hd, 0.72, 0.18, 0.48, MAT.chrome, 0, 5.88, 0.16);
  box(hd, 0.52, 0.06, 0.36, MAT.servo, 0, 5.82, 0.2);
  // Jaw actuator pistons (visible, one per side)
  for (let side = -1; side <= 1; side += 2) {
    hydraulicRam(hd, 0.015, 0.2, side * 0.32, 5.95, 0.08);
    rivet(hd, side * 0.34, 6.04, 0.38);
    rivet(hd, side * 0.3, 5.86, 0.38);
  }

  // ══════════════════════════════════════════════════════════
  // CHEEK GUARDS (angular, with exposed internals)
  // ══════════════════════════════════════════════════════════
  for (let side = -1; side <= 1; side += 2) {
    box(hd, 0.24, 0.56, 0.82, MAT.armor, side * 0.58, 6.34, 0.04, 0, 0, side * 0.08);
    box(hd, 0.12, 0.38, 0.66, MAT.darkChrome, side * 0.62, 6.26, 0.01, 0, 0, side * 0.08);
    // Cheek inset panel (servo exposed)
    box(hd, 0.06, 0.24, 0.38, MAT.servo, side * 0.6, 6.18, -0.08, 0, 0, side * 0.08);
    cyl(hd, 0.04, 0.04, 0.06, MAT.hydraulic, side * 0.6, 6.08, 0.02, 8);
    // Cheek surface detail
    box(hd, 0.02, 0.35, 0.04, MAT.panelLine, side * 0.52, 6.32, 0.38);
    rivet(hd, side * 0.5, 6.72, 0.4); rivet(hd, side * 0.5, 6.18, 0.4);
    rivet(hd, side * 0.52, 6.46, 0.44); rivet(hd, side * 0.54, 6.02, 0.36);
  }

  // ══════════════════════════════════════════════════════════
  // EAR MODULES (sensor arrays + cooling + comms antenna)
  // ══════════════════════════════════════════════════════════
  for (let side = -1; side <= 1; side += 2) {
    // Main housing
    box(hd, 0.14, 0.46, 0.24, MAT.frameMat, side * 0.7, 6.38, -0.12);
    box(hd, 0.08, 0.34, 0.2, MAT.servo, side * 0.72, 6.38, -0.14);
    // Vent grille (5 slats)
    for (let i = 0; i < 5; i++)
      box(hd, 0.07, 0.05, 0.2, MAT.vent, side * 0.72, 6.26 + i * 0.065, -0.12);
    // Cooling radiator
    coolingFins(hd, 6, 0.18, 0.12, 0.032, side * 0.74, 6.38, -0.24, true);
    // Side-mounted sensor lens
    sphere(hd, 0.025, MAT.lens, side * 0.7, 6.54, -0.02);
    // Comms antenna nub
    cyl(hd, 0.012, 0.008, 0.12, MAT.chrome, side * 0.72, 6.64, -0.14, 6);
    sphere(hd, 0.015, MAT.vent, side * 0.72, 6.7, -0.14);
  }

  box(hd, 0.74, 0.04, 0.05, MAT.panelLine, 0, 6.8, 0.42);

  // ══════════════════════════════════════════════════════════
  // ANTENNA FINS (taller, with wiring and tip lights)
  // ══════════════════════════════════════════════════════════
  for (let side = -1; side <= 1; side += 2) {
    box(hd, 0.09, 0.14, 0.2, MAT.frameMat, side * 0.55, 6.84, -0.1);
    box(hd, 0.08, 0.8, 0.26, MAT.chrome, side * 0.6, 7.06, -0.1, 0, 0, side * 0.16);
    box(hd, 0.04, 0.6, 0.07, MAT.panelLine, side * 0.61, 7.12, -0.04, 0, 0, side * 0.16);
    cableRun(hd, 0.01, 0.5, side * 0.57, 6.98, -0.2, 0, 0, side * 0.16);
    rivet(hd, side * 0.56, 6.84, -0.02);
    // Tip light
    sphere(hd, 0.022, MAT.coreInner, side * 0.62, 7.42, -0.1);
    // Secondary micro-antenna
    cyl(hd, 0.006, 0.006, 0.15, MAT.chrome, side * 0.56, 7.4, -0.18, 6);
    sphere(hd, 0.01, MAT.ventHot, side * 0.56, 7.48, -0.18);
  }

  // ══════════════════════════════════════════════════════════
  // BACK OF HEAD (data ports, cooling radiator, cable harness)
  // ══════════════════════════════════════════════════════════
  box(hd, 0.92, 0.62, 0.16, MAT.darkChrome, 0, 6.42, -0.44);
  // Data port connectors (6 total)
  for (let i = 0; i < 6; i++) {
    const px = -0.3 + i * 0.12;
    cyl(hd, 0.05, 0.05, 0.1, MAT.frameMat, px, 6.42, -0.5, 8);
    sphere(hd, 0.02, MAT.vent, px, 6.42, -0.54);
    cyl(hd, 0.06, 0.06, 0.02, MAT.darkChrome, px, 6.42, -0.48, 8);
  }
  // Cooling radiator array
  coolingFins(hd, 10, 0.6, 0.07, 0.042, 0, 6.18, -0.52, false);
  // Cable harness exiting skull
  cableBundle(hd, 4, 0.014, 0.4, 0, 6.08, -0.5);
  cableBundle(hd, 2, 0.01, 0.3, 0.2, 6.08, -0.48);
  cableBundle(hd, 2, 0.01, 0.3, -0.2, 6.08, -0.48);

  // ── NECK (exposed servos, hydraulic actuators, cable harness) ──
  // Central neck column
  cyl(g, 0.2, 0.32, 0.55, MAT.servo, 0, 5.85, 0);
  // Rubber gaskets top and bottom
  rubberSeal(g, 0.25, 0.02, 0, 6.08, 0);
  rubberSeal(g, 0.34, 0.025, 0, 5.62, 0);
  // Two neck servos (yaw + pitch)
  servoDrum(g, 0.12, 0.18, 0.22, 5.95, 0);
  servoDrum(g, 0.1, 0.14, -0.2, 5.78, 0);
  // Hydraulic actuators (4 around neck for head tilt)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const cx = Math.cos(a) * 0.26, cz = Math.sin(a) * 0.26;
    hydraulicRam(g, 0.022, 0.45, cx, 5.85, cz);
  }
  // Cable harness running through neck
  cableBundle(g, 5, 0.014, 0.5, 0, 5.85, 0.22);
  cableBundle(g, 3, 0.012, 0.5, 0, 5.85, -0.22);
  const neckRing = torus(g, 0.35, 0.05, MAT.vent, 0, 5.85, 0);
  glowRings.push(neckRing);
  const neckRing2 = torus(g, 0.3, 0.03, MAT.panelLine, 0, 5.72, 0);
  glowRings.push(neckRing2);
  const neckRing3 = torus(g, 0.28, 0.02, MAT.darkChrome, 0, 5.98, 0);
  // Collar plate
  box(g, 1.75, 0.2, 0.88, MAT.darkChrome, 0, 5.6, 0);
  boltCluster(g, 6, 0.12, 0, 5.6, 0.42);

  // ── TORSO (visible internal frame, hydraulic rams, servo mounts, radiator) ──
  // Central spine column (visible endoskeleton)
  box(g, 0.4, 5.0, 0.4, MAT.frameMat, 0, 3.6, -0.15);
  // Internal cross-ribs (exposed structural skeleton)
  for (let i = 0; i < 6; i++) {
    box(g, 1.6, 0.05, 0.22, MAT.frameMat, 0, 2.85 + i * 0.45, 0);
    // Weld seam on each rib
    box(g, 1.2, 0.02, 0.02, MAT.weldSeam, 0, 2.87 + i * 0.45, 0.11);
  }
  // Internal servo mounts (visible in torso gap)
  for (let side = -1; side <= 1; side += 2) {
    servoDrum(g, 0.08, 0.12, side * 0.4, 4.6, -0.1);
    servoDrum(g, 0.07, 0.1, side * 0.35, 3.4, -0.08);
  }
  // Hydraulic rams connecting chest to waist (visible in side gaps)
  for (let side = -1; side <= 1; side += 2) {
    hydraulicRam(g, 0.035, 1.4, side * 0.95, 3.5, -0.35);
    hydraulicRam(g, 0.028, 1.0, side * 0.85, 3.8, 0.35);
  }
  // Main chest plates — RED L/R split
  box(g, 1.15, 2.8, 1.35, MAT.armorRed, -0.58, 4.0, 0);
  box(g, 1.15, 2.8, 1.35, MAT.armorRed, 0.58, 4.0, 0);
  // Central seam with weld detail
  box(g, 0.04, 2.6, 0.06, MAT.panelLine, 0, 4.0, 0.68);
  box(g, 0.02, 2.4, 0.03, MAT.weldSeam, 0, 4.0, 0.71);
  // Windshield-style chest windows
  for (let side = -1; side <= 1; side += 2) {
    box(g, 0.55, 0.7, 0.06, MAT.visor, side * 0.42, 4.6, 0.7);
    box(g, 0.04, 0.76, 0.08, MAT.chrome, side * 0.14, 4.6, 0.7);
    // Window frame bolts
    rivet(g, side * 0.62, 4.88, 0.72); rivet(g, side * 0.62, 4.32, 0.72);
    rivet(g, side * 0.22, 4.88, 0.72); rivet(g, side * 0.22, 4.32, 0.72);
  }
  // Collar / gorget — heavy chrome, bolted
  box(g, 1.88, 0.26, 1.02, MAT.chrome, 0, 5.38, 0);
  box(g, 1.52, 0.08, 0.56, MAT.panelLine, 0, 5.48, 0.38);
  boltCluster(g, 6, 0.16, 0, 5.38, 0.5);
  // Upper chest chevron — chrome accent
  box(g, 2.22, 0.66, 0.14, MAT.chrome, 0, 5.02, 0.68);
  box(g, 1.72, 0.4, 0.07, MAT.darkChrome, 0, 5.18, 0.72);
  // Lower chest
  box(g, 1.92, 0.44, 0.14, MAT.armor, 0, 4.4, 0.72);
  // Side flanks — blue armor with exposed mechanical sub-layer
  for (let side = -1; side <= 1; side += 2) {
    box(g, 0.34, 2.2, 1.18, MAT.armor, side * 1.22, 4.1, 0, 0, 0, side * -0.08);
    box(g, 0.12, 1.8, 0.92, MAT.darkChrome, side * 1.3, 4.1, 0, 0, 0, side * -0.08);
    // Visible servo + cable through flank gap
    box(g, 0.06, 0.8, 0.3, MAT.servo, side * 1.08, 4.5, -0.2, 0, 0, side * -0.08);
    cableBundle(g, 2, 0.01, 1.4, side * 1.05, 4.1, 0.3);
    rivet(g, side * 1.12, 5.0, 0.58); rivet(g, side * 1.12, 3.2, 0.58);
    rivet(g, side * 1.12, 4.3, 0.58); rivet(g, side * 1.12, 3.8, 0.58);
  }
  // Back plate with radiator cooling fins
  box(g, 1.92, 2.4, 0.22, MAT.chrome, 0, 4.1, -0.72);
  box(g, 1.42, 1.8, 0.1, MAT.darkChrome, 0, 4.2, -0.78);
  coolingFins(g, 12, 1.2, 0.08, 0.06, 0, 4.2, -0.84, false);
  // Ab plates — chrome segments with bolts
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 3; i++) {
      box(g, 0.44, 0.3, 0.13, MAT.chrome, side * 0.36, 3.0 + i * 0.35, 0.7);
      rivet(g, side * 0.36, 3.1 + i * 0.35, 0.78);
    }
  }
  // Panel line accents
  box(g, 0.04, 1.8, 0.06, MAT.panelLine, -0.7, 4.0, 0.68);
  box(g, 0.04, 1.8, 0.06, MAT.panelLine, 0.7, 4.0, 0.68);
  box(g, 1.4, 0.04, 0.06, MAT.panelLine, 0, 3.2, 0.68);
  box(g, 1.4, 0.04, 0.06, MAT.panelLine, 0, 4.8, 0.68);

  // ── DECALS (unit markings, hazard stripes, caution labels) ──
  function decalTex(w, h, fn) {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    fn(c.getContext("2d"), w, h);
    const t = new THREE.CanvasTexture(c);
    t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
    return new P({ map: t, transparent: true, depthWrite: false, roughness: 0.5, metalness: 0.3 });
  }
  // Left chest: unit designation
  const unitMat = decalTex(256, 64, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.font = "bold 36px monospace"; ctx.fillStyle = "#e0e8ff";
    ctx.globalAlpha = 0.65; ctx.fillText("AC-01", 12, 40);
    ctx.font = "11px monospace"; ctx.fillStyle = "#6688cc";
    ctx.globalAlpha = 0.5; ctx.fillText("APECLAW PRIME", 12, 56);
  });
  const unitDecal = new THREE.Mesh(new THREE.PlaneGeometry(0.65, 0.17), unitMat);
  unitDecal.position.set(-0.58, 4.68, 0.74); unitDecal.renderOrder = 3;
  g.add(unitDecal);
  // Right chest: faction badge (blue/chrome stripe)
  const hazMat = decalTex(256, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 === 0 ? "#3355aa" : "#c0ccdd";
      ctx.beginPath();
      ctx.moveTo(i * 32, 0); ctx.lineTo(i * 32 + 32, 0);
      ctx.lineTo(i * 32 + 16, h); ctx.lineTo(i * 32 - 16, h);
      ctx.closePath(); ctx.fill();
    }
  });
  const hazDecal = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.25), hazMat);
  hazDecal.position.set(0.58, 4.22, 0.74); hazDecal.renderOrder = 3;
  g.add(hazDecal);
  // Waist caution strip
  const cautionMat = decalTex(192, 32, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.globalAlpha = 0.3;
    for (let x = 0; x < w; x += 16) {
      ctx.fillStyle = (x / 16) % 2 === 0 ? "#cc2233" : "#1a2030";
      ctx.fillRect(x, 0, 16, h);
    }
  });
  const cautionDecal = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.06), cautionMat);
  cautionDecal.position.set(0, 2.74, 0.56); cautionDecal.renderOrder = 3;
  g.add(cautionDecal);

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

  // ── WAIST / PELVIS (servo mounts, hydraulic cross-links, bolted hip skirts) ──
  box(g, 1.72, 0.76, 1.06, MAT.armor, 0, 2.35, 0);
  box(g, 1.32, 0.56, 0.86, MAT.undersuit, 0, 2.35, 0);
  // Internal waist servos (visible in gaps)
  servoDrum(g, 0.1, 0.16, 0, 2.35, 0);
  for (let side = -1; side <= 1; side += 2)
    hydraulicRam(g, 0.025, 0.5, side * 0.55, 2.35, -0.3, 0, 0, side * 0.3);
  // Chrome belt buckle
  box(g, 1.92, 0.23, 0.17, MAT.chrome, 0, 2.72, 0.54);
  box(g, 0.62, 0.17, 0.11, MAT.armorRed, 0, 2.72, 0.58);
  boltCluster(g, 6, 0.14, 0, 2.72, 0.62);
  // Hip guard skirts with bolt detail
  for (let side = -1; side <= 1; side += 2) {
    box(g, 0.52, 0.56, 0.76, MAT.armor, side * 0.73, 2.15, 0, 0, 0, side * -0.12);
    box(g, 0.4, 0.15, 0.62, MAT.darkChrome, side * 0.75, 2.32, 0, 0, 0, side * -0.12);
    rivet(g, side * 0.63, 2.52, 0.42); rivet(g, side * 0.63, 2.12, 0.42);
    // Visible mechanical substructure in hip gap
    box(g, 0.08, 0.3, 0.2, MAT.servo, side * 0.55, 2.1, -0.15, 0, 0, side * -0.12);
  }
  const waistRing = torus(g, 0.96, 0.055, MAT.vent, 0, 2.72, 0);
  glowRings.push(waistRing);
  box(g, 0.86, 0.05, 0.07, MAT.panelLine, 0, 2.0, 0.55);
  cableBundle(g, 4, 0.012, 1.3, 0, 2.58, -0.5);

  // ── SHOULDERS (massive pauldrons, exposed servo + actuators) ──
  function buildShoulder(tgt, side) {
    const sx = side * 1.75;
    // Ball joint with rubber gasket
    sphere(tgt, 0.45, MAT.joint, sx, 5.25, 0);
    rubberSeal(tgt, 0.42, 0.025, sx, 5.25, 0);
    const shoulderRing = torus(tgt, 0.5, 0.05, MAT.vent, sx, 5.25, 0);
    glowRings.push(shoulderRing);
    // Rotational servo drum (visible)
    servoDrum(tgt, 0.15, 0.2, sx + side * 0.08, 5.25, -0.15);
    // Inner structural mount
    box(tgt, 0.72, 0.42, 0.72, MAT.frameMat, sx + side * 0.2, 5.38, 0, 0, 0, side * -0.1);
    box(tgt, 0.5, 0.3, 0.5, MAT.servo, sx + side * 0.2, 5.38, 0, 0, 0, side * -0.1);
    // Pauldron — red with chrome layers
    box(tgt, 1.18, 0.62, 1.02, MAT.armorRed, sx + side * 0.35, 5.46, 0, 0, 0, side * -0.12);
    box(tgt, 1.02, 0.2, 0.88, MAT.chrome, sx + side * 0.4, 5.74, 0, 0, 0, side * -0.12);
    box(tgt, 0.72, 0.07, 0.72, MAT.darkChrome, sx + side * 0.35, 5.63, 0, 0, 0, side * -0.12);
    // Top cap with bolts
    box(tgt, 0.88, 0.12, 0.78, MAT.chrome, sx + side * 0.38, 5.8, 0, 0, 0, side * -0.12);
    boltCluster(tgt, 4, 0.18, sx + side * 0.38, 5.82, 0);
    // Hydraulic actuator under pauldron
    hydraulicRam(tgt, 0.03, 0.5, sx * 0.65, 5.32, -0.35, 0, 0, side * 0.55);
    // Vent grilles
    ventSlits(tgt, 0.48, 3, 0.07, MAT.vent, sx + side * 0.42, 5.26, 0);
    // Cable harness from shoulder to arm
    cableBundle(tgt, 3, 0.012, 0.5, sx + side * 0.1, 5.0, 0.25);
    rivet(tgt, sx + side * 0.15, 5.67, 0.44); rivet(tgt, sx + side * 0.62, 5.67, -0.38);
    rivet(tgt, sx + side * 0.35, 5.44, 0.5); rivet(tgt, sx + side * 0.35, 5.44, -0.5);
  }
  buildShoulder(la, -1);
  buildShoulder(ra, 1);

  // ══════════════════════════════════════════════════════════
  // ARMS — layered armor, exposed actuators, articulated hands
  // ══════════════════════════════════════════════════════════
  function buildArm(tgt, side) {
    const sx = side * 2.2;

    // ── UPPER ARM ──
    // Inner skeleton
    box(tgt, 0.3, 1.35, 0.3, MAT.undersuit, sx, 4.2, 0);
    cyl(tgt, 0.1, 0.1, 1.3, MAT.frameMat, sx, 4.2, 0, 8);
    // Outer armor shell (front + back plates)
    box(tgt, 0.64, 1.48, 0.58, MAT.armor, sx, 4.2, 0);
    // Chrome accent band at top
    box(tgt, 0.52, 0.54, 0.44, MAT.darkChrome, sx, 4.72, 0.2);
    box(tgt, 0.48, 0.08, 0.42, MAT.panelLine, sx, 4.56, 0.28);
    // Inner armor plate (visible in gap)
    box(tgt, 0.3, 0.8, 0.2, MAT.servo, sx - side * 0.15, 4.2, -0.2);
    // Bicep piston + hydraulic ram
    pistonGeo(tgt, 0.036, 0.72, MAT.pistonMat, sx + side * 0.26, 4.2, -0.24);
    hydraulicRam(tgt, 0.03, 0.65, sx - side * 0.22, 4.32, -0.2);
    // Cable harness (inner channel)
    cableBundle(tgt, 5, 0.009, 1.3, sx - side * 0.18, 4.2, 0.24);
    // Bicep servo
    servoDrum(tgt, 0.07, 0.12, sx + side * 0.2, 4.62, -0.08);
    // Panel lines + rivets
    box(tgt, 0.04, 1.2, 0.04, MAT.panelLine, sx + side * 0.3, 4.2, 0.26);
    rivet(tgt, sx + side * 0.28, 4.8, 0.28); rivet(tgt, sx + side * 0.28, 3.65, 0.28);
    rivet(tgt, sx - side * 0.28, 4.5, 0.28); rivet(tgt, sx - side * 0.28, 3.9, 0.28);

    // ── ELBOW (multi-component joint) ──
    // Ball joint core
    sphere(tgt, 0.36, MAT.joint, sx, 3.4, 0);
    rubberSeal(tgt, 0.34, 0.022, sx, 3.4, 0);
    // Two servos (flexion + rotation)
    servoDrum(tgt, 0.11, 0.16, sx, 3.4, 0.2);
    servoDrum(tgt, 0.08, 0.1, sx + side * 0.18, 3.4, -0.1);
    const elbowRing = torus(tgt, 0.4, 0.045, MAT.vent, sx, 3.4, 0);
    glowRings.push(elbowRing);
    // Triple actuator assembly
    pistonGeo(tgt, 0.03, 0.44, MAT.pistonMat, sx + side * 0.24, 3.4, -0.22, 0.3, 0, 0);
    pistonGeo(tgt, 0.028, 0.38, MAT.pistonMat, sx - side * 0.2, 3.4, -0.2, -0.25, 0, 0);
    hydraulicRam(tgt, 0.022, 0.35, sx, 3.4, -0.28, 0, 0, side * 0.2);
    // Elbow guard plate
    box(tgt, 0.45, 0.22, 0.15, MAT.darkChrome, sx - side * 0.05, 3.4, -0.22);

    // ── FOREARM (chrome gauntlet with layered plating) ──
    // Inner skeleton
    box(tgt, 0.32, 1.34, 0.32, MAT.undersuit, sx, 2.4, 0);
    cyl(tgt, 0.08, 0.08, 1.2, MAT.frameMat, sx, 2.4, 0, 8);
    // Main chrome shell
    box(tgt, 0.68, 1.44, 0.64, MAT.chrome, sx, 2.4, 0);
    // Red accent band (upper forearm)
    box(tgt, 0.74, 0.38, 0.68, MAT.armorRed, sx, 2.88, 0);
    box(tgt, 0.56, 0.12, 0.5, MAT.darkChrome, sx, 3.02, 0.1);
    // Outer ridge (running down arm)
    box(tgt, 0.18, 1.06, 0.18, MAT.darkChrome, sx + side * 0.35, 2.4, 0);
    box(tgt, 0.08, 0.96, 0.08, MAT.panelLine, sx + side * 0.33, 2.4, 0.32);
    // Inner conduit channel (exposed cables)
    box(tgt, 0.12, 0.9, 0.08, MAT.servo, sx - side * 0.28, 2.4, -0.24);
    cableBundle(tgt, 4, 0.008, 1.0, sx - side * 0.26, 2.4, -0.24);
    // Cooling vents (lateral)
    ventSlits(tgt, 0.28, 4, 0.065, MAT.vent, sx + side * 0.36, 2.15, 0.18);
    // Forearm hydraulic ram
    hydraulicRam(tgt, 0.022, 0.8, sx - side * 0.1, 2.4, -0.28);
    // Panel rivets
    rivet(tgt, sx - side * 0.26, 2.88, 0.34); rivet(tgt, sx + side * 0.26, 2.06, 0.32);
    rivet(tgt, sx, 2.68, 0.35); rivet(tgt, sx, 2.18, 0.35);
    rivet(tgt, sx + side * 0.34, 2.68, 0); rivet(tgt, sx + side * 0.34, 2.12, 0);

    // ── WRIST (rotation assembly) ──
    torus(tgt, 0.32, 0.05, MAT.vent, sx, 1.78, 0);
    rubberSeal(tgt, 0.3, 0.02, sx, 1.74, 0);
    rubberSeal(tgt, 0.3, 0.02, sx, 1.82, 0);
    servoDrum(tgt, 0.09, 0.14, sx, 1.78, 0.14);
    box(tgt, 0.46, 0.14, 0.46, MAT.darkChrome, sx, 1.78, 0);
    boltCluster(tgt, 6, 0.18, sx, 1.78, 0);

    // ══════════════════════════════════════════════════════════
    // HAND — full mechanical assembly with armored fingers
    // ══════════════════════════════════════════════════════════
    // Palm chassis (layered)
    box(tgt, 0.42, 0.18, 0.42, MAT.chrome, sx, 1.6, 0);
    box(tgt, 0.36, 0.14, 0.36, MAT.joint, sx, 1.58, 0);
    box(tgt, 0.3, 0.04, 0.3, MAT.servo, sx, 1.67, 0);
    box(tgt, 0.3, 0.04, 0.3, MAT.frameMat, sx, 1.49, 0);
    // Palm armor plate (top)
    box(tgt, 0.38, 0.03, 0.34, MAT.darkChrome, sx, 1.685, 0);
    // Grip pads on underside (3 rubber strips)
    for (let p = -1; p <= 1; p++) {
      box(tgt, 0.08, 0.02, 0.28, MAT.rubber, sx + p * 0.11, 1.49, 0);
    }
    // Tendon servo bank (5 micro servos across knuckle line)
    for (let f = 0; f < 5; f++) {
      const fz = -0.14 + f * 0.07;
      servoDrum(tgt, 0.018, 0.05, sx, 1.66, fz);
    }
    // Hydraulic manifold (distributes pressure to fingers)
    box(tgt, 0.06, 0.08, 0.3, MAT.hydraulic, sx - side * 0.14, 1.58, 0);
    cableBundle(tgt, 3, 0.005, 0.2, sx - side * 0.12, 1.58, 0.14);
    // Knuckle guard plate (chrome bar across all 4 fingers)
    box(tgt, 0.06, 0.08, 0.32, MAT.chrome, sx, 1.46, 0.02);
    boltCluster(tgt, 4, 0.12, sx, 1.46, 0.04);

    // 4 fingers: knuckle + 3 armored phalanges + sensor tip
    const fingerSpread = [-0.13, -0.05, 0.03, 0.11];
    const fingerLen = [1.0, 1.1, 1.05, 0.9];
    for (let f = 0; f < 4; f++) {
      const fz = fingerSpread[f];
      const scale = fingerLen[f];
      const fy = 1.44;

      // Knuckle ball joint + rubber gasket
      sphere(tgt, 0.032, MAT.joint, sx, fy, fz);
      torus(tgt, 0.028, 0.006, MAT.rubber, sx, fy, fz);

      // Proximal phalanx (armored)
      const p1y = fy - 0.08 * scale;
      box(tgt, 0.052, 0.14 * scale, 0.055, MAT.chrome, sx, p1y, fz);
      box(tgt, 0.04, 0.12 * scale, 0.042, MAT.servo, sx, p1y, fz);
      // Piston actuator along proximal
      pistonGeo(tgt, 0.006, 0.1 * scale, MAT.pistonMat, sx - side * 0.022, p1y, fz);

      // PIP joint (mid knuckle)
      const pipy = fy - 0.17 * scale;
      sphere(tgt, 0.022, MAT.joint, sx, pipy, fz);

      // Middle phalanx (armored)
      const p2y = pipy - 0.06 * scale;
      box(tgt, 0.046, 0.1 * scale, 0.05, MAT.frameMat, sx, p2y, fz);
      box(tgt, 0.038, 0.08 * scale, 0.04, MAT.darkChrome, sx, p2y, fz);

      // DIP joint
      const dipy = pipy - 0.12 * scale;
      sphere(tgt, 0.018, MAT.joint, sx, dipy, fz);

      // Distal phalanx (fingertip armor)
      const p3y = dipy - 0.045 * scale;
      box(tgt, 0.042, 0.075 * scale, 0.046, MAT.chrome, sx, p3y, fz);

      // Fingertip: rubber grip pad + pressure sensor
      const tipy = dipy - 0.08 * scale;
      sphere(tgt, 0.02, MAT.rubber, sx, tipy, fz);
      sphere(tgt, 0.008, MAT.lens, sx, tipy - 0.01, fz);

      // Tendon cable (runs full finger length)
      cableRun(tgt, 0.004, 0.35 * scale, sx - side * 0.018, p1y, fz);
    }

    // Thumb — 3-segment, opposable (angled outward and rotated)
    const tx = sx + side * 0.2, tz = -0.18;
    // Carpometacarpal joint (base — swivel)
    sphere(tgt, 0.035, MAT.joint, tx, 1.5, tz);
    torus(tgt, 0.03, 0.007, MAT.rubber, tx, 1.5, tz);
    servoDrum(tgt, 0.015, 0.04, tx, 1.5, tz - 0.03);
    // Metacarpal (thick base segment)
    box(tgt, 0.058, 0.1, 0.062, MAT.chrome, tx + side * 0.02, 1.42, tz);
    box(tgt, 0.046, 0.08, 0.05, MAT.servo, tx + side * 0.02, 1.42, tz);
    pistonGeo(tgt, 0.006, 0.08, MAT.pistonMat, tx + side * 0.03, 1.42, tz + 0.025);
    // MCP joint
    sphere(tgt, 0.025, MAT.joint, tx + side * 0.03, 1.36, tz);
    // Proximal phalanx
    box(tgt, 0.052, 0.09, 0.056, MAT.frameMat, tx + side * 0.04, 1.3, tz);
    box(tgt, 0.042, 0.07, 0.044, MAT.darkChrome, tx + side * 0.04, 1.3, tz);
    // IP joint
    sphere(tgt, 0.02, MAT.joint, tx + side * 0.04, 1.25, tz);
    // Distal phalanx
    box(tgt, 0.048, 0.07, 0.052, MAT.chrome, tx + side * 0.05, 1.2, tz);
    // Thumb tip
    sphere(tgt, 0.022, MAT.rubber, tx + side * 0.05, 1.165, tz);
    sphere(tgt, 0.009, MAT.lens, tx + side * 0.05, 1.155, tz);
    cableRun(tgt, 0.005, 0.28, tx, 1.38, tz);

    // Wrist-to-palm data connector
    cyl(tgt, 0.03, 0.03, 0.04, MAT.frameMat, sx - side * 0.16, 1.7, -0.12, 8);
    sphere(tgt, 0.012, MAT.vent, sx - side * 0.16, 1.72, -0.12);
  }
  buildArm(la, -1);
  buildArm(ra, 1);

  // ══════════════════════════════════════════════════════════
  // LEGS — layered armor, shock absorber knee, articulated feet
  // ══════════════════════════════════════════════════════════
  function buildLeg(side) {
    const sx = side * 0.6;

    // ── HIP JOINT (multi-axis) ──
    sphere(g, 0.38, MAT.joint, sx, 1.95, 0);
    rubberSeal(g, 0.36, 0.022, sx, 1.95, 0);
    servoDrum(g, 0.12, 0.16, sx + side * 0.1, 1.95, -0.14);
    servoDrum(g, 0.08, 0.1, sx - side * 0.06, 1.95, 0.14);
    const hipRing = torus(g, 0.44, 0.05, MAT.vent, sx, 1.95, 0);
    glowRings.push(hipRing);

    // ── HIP SKIRT ARMOR ──
    box(g, 0.64, 0.44, 0.64, MAT.armor, sx + side * 0.12, 1.82, 0.12, 0, 0, side * -0.1);
    box(g, 0.48, 0.14, 0.48, MAT.darkChrome, sx + side * 0.12, 1.94, 0.15, 0, 0, side * -0.1);
    box(g, 0.38, 0.08, 0.38, MAT.servo, sx + side * 0.12, 1.72, 0.12, 0, 0, side * -0.1);
    boltCluster(g, 5, 0.16, sx + side * 0.12, 1.82, 0.4);
    // Hip panel line
    box(g, 0.03, 0.4, 0.04, MAT.panelLine, sx + side * 0.35, 1.82, 0.35);

    // ── THIGH (blue plates, layered armor, exposed hydraulics) ──
    // Inner skeleton + undersuit
    box(g, 0.4, 1.55, 0.4, MAT.undersuit, sx, 0.8, 0);
    cyl(g, 0.1, 0.1, 1.45, MAT.frameMat, sx, 0.8, 0, 8);
    // Outer armor (front + back + sides)
    box(g, 0.74, 1.68, 0.74, MAT.armor, sx, 0.8, 0);
    // Chrome accent plates (top & bottom of thigh)
    box(g, 0.58, 0.16, 0.54, MAT.chrome, sx, 1.38, 0.38);
    box(g, 0.54, 0.16, 0.5, MAT.darkChrome, sx, 0.48, 0.38);
    // Lateral panel lines
    box(g, 0.07, 1.14, 0.07, MAT.panelLine, sx + side * 0.36, 0.8, 0.38);
    box(g, 0.07, 1.14, 0.07, MAT.panelLine, sx - side * 0.36, 0.8, 0.38);
    // Thigh hydraulic ram (front, through armor gap)
    hydraulicRam(g, 0.032, 1.25, sx, 0.8, 0.4);
    // Secondary inner piston
    pistonGeo(g, 0.025, 0.8, MAT.pistonMat, sx + side * 0.15, 0.8, -0.28);
    // Rear cable conduit
    cableBundle(g, 4, 0.01, 1.4, sx - side * 0.3, 0.8, -0.28);
    // Inner mech visible in side gap
    box(g, 0.06, 0.6, 0.2, MAT.servo, sx + side * 0.32, 0.9, -0.12);
    // Rivets (8 total per thigh)
    rivet(g, sx + side * 0.32, 1.54, 0.37); rivet(g, sx + side * 0.32, 0.06, 0.37);
    rivet(g, sx - side * 0.32, 1.22, 0.37); rivet(g, sx - side * 0.32, 0.38, 0.37);
    rivet(g, sx + side * 0.32, 1.0, -0.37); rivet(g, sx + side * 0.32, 0.6, -0.37);
    rivet(g, sx, 1.48, 0.37); rivet(g, sx, 0.12, 0.37);

    // ── KNEE (shock absorber + multi-actuator + guard) ──
    // Ball joint
    sphere(g, 0.34, MAT.joint, sx, -0.1, 0.1);
    rubberSeal(g, 0.32, 0.022, sx, -0.1, 0.1);
    const kneeRing = torus(g, 0.38, 0.05, MAT.vent, sx, -0.1, 0.1);
    glowRings.push(kneeRing);
    // Triple actuator assembly
    pistonGeo(g, 0.034, 0.44, MAT.pistonMat, sx + side * 0.28, -0.1, -0.22, 0.25, 0, 0);
    pistonGeo(g, 0.034, 0.38, MAT.pistonMat, sx - side * 0.28, -0.1, 0.26, -0.2, 0, 0);
    hydraulicRam(g, 0.025, 0.35, sx, -0.1, -0.3, 0.15, 0, 0);
    // Shock absorber (dual-tube behind knee)
    cyl(g, 0.055, 0.055, 0.55, MAT.pistonMat, sx + side * 0.08, -0.1, -0.28, 12);
    cyl(g, 0.04, 0.04, 0.55, MAT.chrome, sx - side * 0.08, -0.1, -0.28, 12);
    cyl(g, 0.07, 0.07, 0.22, MAT.hydraulic, sx + side * 0.08, -0.22, -0.28, 12);
    cyl(g, 0.055, 0.055, 0.18, MAT.hydraulic, sx - side * 0.08, -0.22, -0.28, 12);
    rubberSeal(g, 0.065, 0.014, sx + side * 0.08, 0.06, -0.28);
    rubberSeal(g, 0.05, 0.012, sx - side * 0.08, 0.06, -0.28);
    // Caliper brake disc (front of knee)
    cyl(g, 0.18, 0.18, 0.03, MAT.darkChrome, sx, -0.1, 0.26, 24);
    torus(g, 0.14, 0.012, MAT.chrome, sx, -0.1, 0.26);
    // Knee guard (layered: chrome + red + dark)
    box(g, 0.76, 0.58, 0.26, MAT.chrome, sx, -0.1, 0.42);
    box(g, 0.62, 0.4, 0.14, MAT.armorRed, sx, -0.08, 0.52);
    box(g, 0.52, 0.1, 0.08, MAT.darkChrome, sx, -0.3, 0.48);
    box(g, 0.52, 0.1, 0.08, MAT.darkChrome, sx, 0.1, 0.48);
    boltCluster(g, 6, 0.12, sx, -0.1, 0.54);
    // Knee panel line
    box(g, 0.04, 0.5, 0.04, MAT.panelLine, sx + side * 0.36, -0.1, 0.38);

    // ── SHIN (blue armor, exposed cable runs, cooling vents) ──
    // Inner skeleton
    box(g, 0.38, 1.48, 0.38, MAT.undersuit, sx, -1.2, 0.08);
    cyl(g, 0.09, 0.09, 1.4, MAT.frameMat, sx, -1.2, 0.08, 8);
    // Outer armor
    box(g, 0.64, 1.58, 0.64, MAT.armor, sx, -1.2, 0.08);
    // Chrome shin guard (front plate)
    box(g, 0.69, 0.68, 0.2, MAT.chrome, sx, -0.58, 0.42);
    box(g, 0.59, 0.42, 0.14, MAT.darkChrome, sx, -0.84, 0.44);
    // Panel line down shin
    box(g, 0.07, 1.04, 0.07, MAT.panelLine, sx, -1.2, 0.44);
    box(g, 0.07, 1.04, 0.07, MAT.panelLine, sx + side * 0.3, -1.2, 0.28);
    // Shin coolant lines (rear)
    cableBundle(g, 3, 0.009, 1.1, sx + side * 0.28, -1.2, -0.24);
    cableBundle(g, 2, 0.007, 0.8, sx - side * 0.2, -1.2, -0.22);
    // Cooling vents (lateral)
    ventSlits(g, 0.26, 5, 0.065, MAT.vent, sx - side * 0.34, -1.35, 0);
    // Inner mech visible
    box(g, 0.04, 0.5, 0.12, MAT.servo, sx + side * 0.28, -1.0, -0.08);
    // Shin rivets
    rivet(g, sx + side * 0.28, -0.55, 0.38); rivet(g, sx + side * 0.28, -1.85, 0.38);
    rivet(g, sx - side * 0.28, -0.75, 0.38); rivet(g, sx - side * 0.28, -1.65, 0.38);
    rivet(g, sx, -0.55, -0.32); rivet(g, sx, -1.85, -0.32);

    // ── ANKLE (servo + dual axis) ──
    cyl(g, 0.22, 0.26, 0.36, MAT.joint, sx, -2.1, 0.08);
    rubberSeal(g, 0.24, 0.016, sx, -1.96, 0.08);
    rubberSeal(g, 0.24, 0.016, sx, -2.24, 0.08);
    servoDrum(g, 0.075, 0.12, sx + side * 0.12, -2.1, 0.22);
    servoDrum(g, 0.06, 0.08, sx - side * 0.1, -2.1, -0.06);
    // Ankle actuators
    pistonGeo(g, 0.028, 0.32, MAT.pistonMat, sx + side * 0.16, -2.0, 0.28);
    pistonGeo(g, 0.028, 0.32, MAT.pistonMat, sx - side * 0.16, -2.0, -0.14);
    hydraulicRam(g, 0.02, 0.25, sx, -2.04, -0.16);
    // Ankle guard
    box(g, 0.35, 0.18, 0.3, MAT.darkChrome, sx, -2.02, 0.26);

    // ══════════════════════════════════════════════════════════
    // FOOT — armored multi-segment with arch, tread, and sensors
    // ══════════════════════════════════════════════════════════

    // ── TOE SECTION (4 armored toe segments) ──
    // Toe plate (main armored shell)
    box(g, 0.76, 0.18, 0.28, MAT.chrome, sx, -2.38, 0.62);
    box(g, 0.62, 0.05, 0.22, MAT.darkChrome, sx, -2.3, 0.64);
    // Individual toe caps (4 articulated digits)
    for (let t = 0; t < 4; t++) {
      const tz = 0.66 + (t === 0 || t === 3 ? 0 : 0.04);
      const tx = sx + (-0.24 + t * 0.16);
      // MTP joint
      sphere(g, 0.024, MAT.joint, tx, -2.38, tz - 0.04);
      // Proximal toe segment (armored)
      box(g, 0.1, 0.1, 0.1, MAT.chrome, tx, -2.42, tz);
      box(g, 0.07, 0.06, 0.07, MAT.servo, tx, -2.42, tz);
      // IP joint
      sphere(g, 0.016, MAT.joint, tx, -2.42, tz + 0.06);
      // Distal toe (claw-like tip)
      box(g, 0.08, 0.08, 0.08, MAT.darkChrome, tx, -2.44, tz + 0.1);
      // Toe grip pad (rubber)
      box(g, 0.06, 0.02, 0.06, MAT.rubber, tx, -2.48, tz + 0.1);
      // Toe pressure sensor
      sphere(g, 0.008, MAT.lens, tx, -2.48, tz + 0.12);
    }
    // Toe guard plate (protective front chrome bar)
    box(g, 0.72, 0.1, 0.04, MAT.chrome, sx, -2.36, 0.8);
    box(g, 0.56, 0.06, 0.03, MAT.armorRed, sx, -2.36, 0.82);
    boltCluster(g, 4, 0.14, sx, -2.36, 0.82);

    // ── METATARSAL BRIDGE (visible arch structure) ──
    // Metatarsal hinge axle (connects toe plate to midfoot)
    cyl(g, 0.05, 0.05, 0.65, MAT.joint, sx, -2.38, 0.5, 12);
    rubberSeal(g, 0.045, 0.012, sx, -2.38, 0.5);
    // Arch springs (visible coil springs under arch)
    for (let s = -1; s <= 1; s += 2) {
      cyl(g, 0.025, 0.025, 0.15, MAT.pistonMat, sx + s * 0.14, -2.42, 0.38, 8);
      torus(g, 0.022, 0.005, MAT.chrome, sx + s * 0.14, -2.38, 0.38);
      torus(g, 0.022, 0.005, MAT.chrome, sx + s * 0.14, -2.46, 0.38);
    }

    // ── MIDFOOT PLATE (armored bridge with internal servo) ──
    box(g, 0.72, 0.16, 0.28, MAT.armor, sx, -2.38, 0.3);
    box(g, 0.6, 0.04, 0.22, MAT.servo, sx, -2.32, 0.3);
    box(g, 0.6, 0.04, 0.22, MAT.frameMat, sx, -2.44, 0.3);
    // Midfoot lateral stabilizer wings
    for (let s = -1; s <= 1; s += 2) {
      box(g, 0.06, 0.12, 0.2, MAT.darkChrome, sx + s * 0.38, -2.36, 0.32);
      rivet(g, sx + s * 0.38, -2.3, 0.38);
    }
    // Arch servo (flexion control)
    servoDrum(g, 0.03, 0.16, sx, -2.36, 0.42);
    // Panel lines
    box(g, 0.04, 0.14, 0.24, MAT.panelLine, sx + side * 0.28, -2.38, 0.3);

    // ── HEEL SECTION (shock-absorbing, armored) ──
    box(g, 0.68, 0.18, 0.36, MAT.armor, sx, -2.38, 0.02);
    box(g, 0.56, 0.05, 0.28, MAT.chrome, sx, -2.3, 0.02);
    box(g, 0.56, 0.05, 0.28, MAT.darkChrome, sx, -2.46, 0.02);
    // Heel shock absorber (visible damper cylinder)
    cyl(g, 0.04, 0.04, 0.16, MAT.pistonMat, sx, -2.36, -0.1, 10);
    cyl(g, 0.055, 0.055, 0.08, MAT.hydraulic, sx, -2.42, -0.1, 10);
    rubberSeal(g, 0.05, 0.01, sx, -2.3, -0.1);
    // Lateral dampers
    for (let s = -1; s <= 1; s += 2) {
      cyl(g, 0.025, 0.025, 0.12, MAT.pistonMat, sx + s * 0.2, -2.38, -0.06, 8);
      rubberSeal(g, 0.022, 0.006, sx + s * 0.2, -2.32, -0.06);
    }
    // Heel stabilizer fins (twin vertical fins)
    for (let s = -1; s <= 1; s += 2) {
      box(g, 0.04, 0.22, 0.12, MAT.darkChrome, sx + s * 0.18, -2.32, -0.2);
      box(g, 0.02, 0.16, 0.08, MAT.panelLine, sx + s * 0.18, -2.34, -0.24);
    }
    // Central heel ridge
    box(g, 0.14, 0.04, 0.18, MAT.chrome, sx, -2.28, -0.12);
    rivet(g, sx, -2.28, -0.2);

    // ── SOLE (tread pattern + thrusters + ground sensors) ──
    // Sole plate
    box(g, 0.7, 0.04, 0.8, MAT.darkChrome, sx, -2.5, 0.2);
    // Tread pads (rubber grip strips)
    for (let i = 0; i < 6; i++) {
      const pz = -0.08 + i * 0.14;
      box(g, 0.56, 0.02, 0.06, MAT.rubber, sx, -2.52, pz);
    }
    // Cross-hatched tread (lateral ribs)
    for (let s = -1; s <= 1; s += 2) {
      for (let i = 0; i < 3; i++) {
        box(g, 0.04, 0.02, 0.5, MAT.rubber, sx + s * (0.2 + i * 0.06), -2.52, 0.2);
      }
    }
    // Primary thruster (central)
    box(g, 0.3, 0.08, 0.3, MAT.ventHot, sx, -2.54, 0.22);
    torus(g, 0.1, 0.015, MAT.vent, sx, -2.54, 0.22);
    // Secondary micro-thrusters (heel + toe)
    cyl(g, 0.06, 0.06, 0.04, MAT.ventHot, sx, -2.54, -0.05, 8);
    cyl(g, 0.06, 0.06, 0.04, MAT.ventHot, sx, -2.54, 0.55, 8);
    // Ground proximity sensors (5-sensor array)
    sphere(g, 0.02, MAT.lens, sx, -2.52, 0.7);
    sphere(g, 0.02, MAT.lens, sx + side * 0.24, -2.52, 0.5);
    sphere(g, 0.018, MAT.lens, sx, -2.52, 0.3);
    sphere(g, 0.018, MAT.lens, sx - side * 0.24, -2.52, 0.1);
    sphere(g, 0.02, MAT.lens, sx, -2.52, -0.1);
    // Foot rivets
    rivet(g, sx + side * 0.34, -2.28, 0.64); rivet(g, sx - side * 0.34, -2.28, 0.64);
    rivet(g, sx + side * 0.3, -2.28, 0.02); rivet(g, sx - side * 0.3, -2.28, 0.02);
    rivet(g, sx + side * 0.3, -2.28, -0.14); rivet(g, sx - side * 0.3, -2.28, -0.14);
    rivet(g, sx, -2.28, 0.46);
  }
  buildLeg(-1);
  buildLeg(1);

  // ── SPINE (vertebrae, coolant lines, structural cross-bracing) ──
  spineSegments = [];
  for (let i = 0; i < 8; i++) {
    const yOff = 2.7 + i * 0.4;
    const mat = MAT.spineGlow.clone();
    // Vertebra body
    const seg = box(g, 0.14, 0.22, 0.14, mat, 0, yOff, -0.72);
    spineSegments.push(seg);
    // Inter-vertebral disc (rubber gasket)
    if (i > 0) {
      box(g, 0.1, 0.04, 0.1, MAT.rubber, 0, yOff - 0.2, -0.72);
      box(g, 0.24, 0.04, 0.07, MAT.frameMat, 0, yOff - 0.2, -0.72);
    }
    // Lateral transverse process (structural wing)
    for (let side = -1; side <= 1; side += 2) {
      box(g, 0.12, 0.05, 0.04, MAT.frameMat, side * 0.12, yOff, -0.72);
    }
    // Cross-struts to torso
    if (i >= 2 && i <= 6) {
      box(g, 0.04, 0.04, 0.22, MAT.frameMat, 0, yOff, -0.6);
      // Diagonal braces
      for (let side = -1; side <= 1; side += 2)
        box(g, 0.02, 0.04, 0.18, MAT.frameMat, side * 0.06, yOff, -0.58, 0, side * 0.15, 0);
    }
  }
  // Coolant lines running along spine
  for (let side = -1; side <= 1; side += 2)
    cableRun(g, 0.015, 3.0, side * 0.12, 4.0, -0.78);
  // Central data conduit
  cableRun(g, 0.02, 3.2, 0, 4.0, -0.82);

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
    // Heat shimmer plume
    const shimGeo = new THREE.ConeGeometry(0.25, 1.2, 8, 1, true);
    const shimMat = new P({
      color: 0xff6600, emissive: 0xff4400, emissiveIntensity: 0.3,
      transparent: true, opacity: 0.04, side: THREE.DoubleSide,
      depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const shim = new THREE.Mesh(shimGeo, shimMat);
    shim.position.set(side * 0.6, 2.65, -0.95);
    g.add(shim);
    heatShimmerMeshes.push(shim);
  }

  // ── SHOULDER HARDPOINTS (built into arm pivots) ──
  for (let side = -1; side <= 1; side += 2) {
    const tgt = side === -1 ? la : ra;
    const sx = side * 2.1;
    box(tgt, 0.14, 0.22, 0.14, MAT.frameMat, sx + side * 0.45, 5.52, -0.22);
    cyl(tgt, 0.14, 0.14, 0.75, MAT.hardpoint, sx + side * 0.45, 5.65, -0.22);
    box(tgt, 0.24, 0.24, 0.7, MAT.hardpoint, sx + side * 0.45, 6.0, -0.22);
    box(tgt, 0.18, 0.1, 0.6, MAT.darkChrome, sx + side * 0.45, 6.1, -0.22);
    box(tgt, 0.1, 0.08, 0.55, MAT.vent, sx + side * 0.45, 5.9, -0.22);
    rivet(tgt, sx + side * 0.45, 6.0, 0.12);
  }

  // ── CHEST ENERGY VENTS (4 per side with housing) ──
  for (let side = -1; side <= 1; side += 2) {
    box(g, 0.45, 0.85, 0.06, MAT.frameMat, side * 0.55, 4.45, 0.67);
    for (let i = 0; i < 4; i++) {
      box(g, 0.35, 0.04, 0.08, MAT.vent, side * 0.55, 4.65 - i * 0.2, 0.7);
    }
  }

  // ── Attach pivot groups and store refs ──
  g.add(_hp); g.add(_lp); g.add(_rp);
  headPivotRef = _hp; leftArmPivotRef = _lp; rightArmPivotRef = _rp;

  // Add subtle edge highlights so the full mecha silhouette is always readable.
  const edgeMat = new THREE.LineBasicMaterial({
    color: 0x3355aa,
    transparent: true,
    opacity: 0.15,
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
  const count = 500;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const palette = [
    new THREE.Color(GLOW),
    new THREE.Color(CYAN),
    new THREE.Color(0x8fbfff),
    new THREE.Color(0xb026ff),
  ];
  for (let i = 0; i < count; i++) {
    positions[i * 3]     = (Math.random() - 0.5) * 22;
    positions[i * 3 + 1] = Math.random() * 18 - 3;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 22;
    sizes[i] = 0.015 + Math.random() * 0.06;
    const c = palette[Math.floor(Math.random() * palette.length)];
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({
    size: 0.045, transparent: true, opacity: 0.3, vertexColors: true,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  }));
}

function createEnergyStreams() {
  const group = new THREE.Group();
  const streamColors = [GLOW, CYAN, 0x8fbfff, GLOW, GLOW, CYAN, 0xb026ff, GLOW, CYAN, GLOW, GLOW, 0x8fbfff];
  for (let i = 0; i < 12; i++) {
    const pts = [];
    const angle = (i / 12) * Math.PI * 2;
    const r = 2.2 + Math.random() * 2.0;
    const twist = 0.3 + Math.random() * 0.4;
    for (let j = 0; j <= 28; j++) {
      const t = j / 28;
      pts.push(new THREE.Vector3(
        Math.cos(angle + t * Math.PI * twist) * r * (1 - t * 0.35),
        -2.5 + t * 14,
        Math.sin(angle + t * Math.PI * twist) * r * (1 - t * 0.35),
      ));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({
      color: streamColors[i % streamColors.length], transparent: true, opacity: 0.03,
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
    bloomPass.strength = bloomEnabled ? 0.55 : 0;
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
export function setAgentSpeaking(v) { agentSpeaking = !!v; }

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

  // Visor flicker — layered optical system effect
  if (visorMesh) {
    const sp = agentSpeaking ? 1.6 : 1.0;
    // Base transmission oscillation (breathing)
    const vBreath = Math.sin(time * 1.8) * 0.02;
    // Micro-flicker (digital noise)
    const vNoise = (Math.random() - 0.5) * 0.015;
    // Scanning pulse (periodic bright sweep)
    const scanPhase = (time * 0.7) % 1.0;
    const scanPulse = Math.exp(-30 * (scanPhase - 0.5) * (scanPhase - 0.5)) * 0.12;
    // Speaking boost
    const speakBurst = agentSpeaking ? Math.sin(time * 8) * 0.04 + Math.random() * 0.03 : 0;

    visorMesh.material.transmission = 0.82 + vBreath + vNoise + scanPulse * 0.3;
    visorMesh.material.emissiveIntensity = (2.0 + 0.4 * Math.sin(time * 2.5) + scanPulse * 2.0 + speakBurst) * sp;
    visorMesh.material.opacity = 0.84 + vBreath * 0.5 + scanPulse * 0.1;
    visorMesh.material.iridescence = 0.5 + 0.15 * Math.sin(time * 1.2);
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

  // Heat shimmer above exhausts
  heatShimmerMeshes.forEach((shim, i) => {
    const phase = time * 3 + i * 1.5;
    shim.material.opacity = 0.025 + 0.02 * Math.sin(phase);
    shim.scale.x = 1.0 + 0.15 * Math.sin(phase * 1.3);
    shim.scale.z = 1.0 + 0.15 * Math.sin(phase * 1.3 + 0.5);
    shim.scale.y = 0.9 + 0.2 * Math.sin(phase * 0.7);
    shim.rotation.y += 0.02;
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

  // ── Procedural idle motion ──
  const sp = agentSpeaking ? 1.8 : 1.0;
  if (robotGroup) {
    robotGroup.position.y = Math.sin(time * 1.2) * 0.025 * sp;
    robotGroup.rotation.x = Math.sin(time * 0.7) * 0.006 * sp;
    robotGroup.position.x = Math.sin(time * 0.35) * 0.012 * sp;
  }
  if (headPivotRef) {
    headPivotRef.rotation.y = Math.sin(time * 0.3) * 0.12 * sp;
    headPivotRef.rotation.x = Math.sin(time * 0.5 + 0.3) * 0.04 * sp;
    headPivotRef.rotation.z = Math.sin(time * 0.22) * 0.018 * sp;
  }
  if (leftArmPivotRef) {
    leftArmPivotRef.rotation.x = Math.sin(time * 0.8) * 0.04 * sp;
    leftArmPivotRef.rotation.z = Math.sin(time * 0.55) * 0.025 * sp;
  }
  if (rightArmPivotRef) {
    rightArmPivotRef.rotation.x = Math.sin(time * 0.8 + 1.5) * 0.04 * sp;
    rightArmPivotRef.rotation.z = -Math.sin(time * 0.55 + 0.4) * 0.025 * sp;
  }

  // Handheld camera sway (applied to scene root to avoid fighting OrbitControls)
  // Subtle "breathing" of the camera operator
  const camSwayY = Math.sin(time * 0.4) * 0.03 + Math.sin(time * 0.15) * 0.04;
  const camSwayX = Math.sin(time * 0.25) * 0.02;
  scene.position.y = camSwayY * 0.5;
  scene.position.x = camSwayX * 0.5;

  if (filmGrainPass) filmGrainPass.uniforms.time.value = time;

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
  if (ssaoPass) { ssaoPass.width = w; ssaoPass.height = h; }
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
  scene.background = new THREE.Color(0x030308);

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
  renderer.toneMappingExposure = 0.95;

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

  // ── Rich procedural environment map for PBR reflections ──
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x020408);

  // Gradient sky dome — very dark for chrome contrast
  const skyGeo = new THREE.SphereGeometry(10, 32, 16);
  const skyPos = skyGeo.attributes.position;
  const skyCol = new Float32Array(skyPos.count * 3);
  const _cTop = new THREE.Color(0x0c1828);
  const _cMid = new THREE.Color(0x040a14);
  const _cBot = new THREE.Color(0x010208);
  const _cTmp = new THREE.Color();
  for (let i = 0; i < skyPos.count; i++) {
    const ny = skyPos.getY(i) / 10;
    const t = ny * 0.5 + 0.5;
    _cTmp.copy(t > 0.5 ? _cTop : _cMid).lerp(t > 0.5 ? _cMid : _cBot, t > 0.5 ? (1 - t) * 2 : (0.5 - t) * 2);
    skyCol[i * 3] = _cTmp.r; skyCol[i * 3 + 1] = _cTmp.g; skyCol[i * 3 + 2] = _cTmp.b;
  }
  skyGeo.setAttribute("color", new THREE.BufferAttribute(skyCol, 3));
  envScene.add(new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true })));

  // Studio-style reflection panels — high contrast for chrome
  const panelGeo = new THREE.PlaneGeometry(6, 10);
  const brightPanel = new THREE.Mesh(panelGeo, new THREE.MeshBasicMaterial({ color: 0xd0d8e8 }));
  brightPanel.position.set(7, 4, 0); brightPanel.rotation.y = -Math.PI / 2;
  envScene.add(brightPanel);
  const fillPanel = new THREE.Mesh(panelGeo.clone(), new THREE.MeshBasicMaterial({ color: 0x506878 }));
  fillPanel.position.set(-7, 2, 2); fillPanel.rotation.y = Math.PI / 2;
  envScene.add(fillPanel);
  const topPanel = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.MeshBasicMaterial({ color: 0x8090a8 }));
  topPanel.position.set(0, 9, 0); topPanel.rotation.x = Math.PI / 2;
  envScene.add(topPanel);
  // Floor bounce (subtle warm)
  const floorPanel = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshBasicMaterial({ color: 0x181820 }));
  floorPanel.position.set(0, -5, 0); floorPanel.rotation.x = -Math.PI / 2;
  envScene.add(floorPanel);

  // Env lights — strong highlights for chrome reflections
  const envLights = [
    [0xffffff, 12, [5, 8, 3]],
    [0x4488ff, 8, [-4, 3, 5]],
    [0xffffff, 6, [0, 10, 0]],
    [CYAN, 4, [-5, 5, -3]],
    [0x6688bb, 3, [3, -3, 6]],
  ];
  for (const [c, i, pos] of envLights) {
    const l = new THREE.PointLight(c, i, 22);
    l.position.set(...pos);
    envScene.add(l);
  }

  const envMap = pmremGenerator.fromScene(envScene, 0.04).texture;
  scene.environment = envMap;
  pmremGenerator.dispose();

  // ── Cinematic Lighting (dark studio with chrome highlights) ──
  scene.add(new THREE.AmbientLight(0x060610, 0.15));
  const hemi = new THREE.HemisphereLight(0x8899bb, 0x020208, 0.3);
  scene.add(hemi);

  // Key light — hard white for chrome specular
  const keyLight = new THREE.DirectionalLight(0xffffff, 3.0);
  keyLight.position.set(4, 10, 6);
  scene.add(keyLight);

  // Fill light — cool blue, very dim
  const fillLight = new THREE.DirectionalLight(0x2244aa, 0.8);
  fillLight.position.set(-6, 3, 4);
  scene.add(fillLight);

  // Rim light — strong cold backlight for silhouette pop
  const rimLight = new THREE.SpotLight(0x4488ff, 8.0, 25, 0.5, 0.4, 1);
  rimLight.position.set(0, 7, -10);
  rimLight.target.position.set(0, 3, 0);
  scene.add(rimLight);
  scene.add(rimLight.target);

  // Accent kicker from below-right for chrome underside reflections
  const kickLight = new THREE.PointLight(0x4466aa, 1.5, 15);
  kickLight.position.set(4, -1, 3);
  scene.add(kickLight);

  // Subtle glow from below for dramatic underlight
  const underGlow = new THREE.PointLight(GLOW, 0.3, 10);
  underGlow.position.set(0, -2, 0);
  scene.add(underGlow);

  // Body spot — focused on torso
  const bodySpot = new THREE.SpotLight(0xdde8ff, 1.5, 28, Math.PI * 0.35, 0.4, 1.0);
  bodySpot.position.set(0, 10, 5);
  bodySpot.target.position.set(0, 3, 0);
  scene.add(bodySpot);
  scene.add(bodySpot.target);

  const sideAccent2 = new THREE.PointLight(CYAN, 0.3, 15);
  sideAccent2.position.set(-6, 3, -3);
  scene.add(sideAccent2);

  // Ground — dark reflective floor
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(50, 50),
    new P({ color: 0x020204, roughness: 0.3, metalness: 0.4, clearcoat: 0.5, clearcoatRoughness: 0.3 })
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

  // ── Post-processing: SSAO → bloom → outline → film grain → output ──
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  try {
    ssaoPass = new SSAOPass(scene, camera, w, h);
    ssaoPass.kernelRadius = 12;
    ssaoPass.minDistance = 0.003;
    ssaoPass.maxDistance = 0.12;
    ssaoPass.output = SSAOPass.OUTPUT.Default;
    composer.addPass(ssaoPass);
  } catch { /* SSAO unavailable — continue without it */ }

  bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.7, 0.35, 0.85);
  composer.addPass(bloomPass);

  outlinePass = new OutlinePass(new THREE.Vector2(w, h), scene, camera);
  outlinePass.edgeStrength = 4;
  outlinePass.edgeGlow = 1.5;
  outlinePass.edgeThickness = 1.2;
  outlinePass.visibleEdgeColor.set(GLOW);
  outlinePass.hiddenEdgeColor.set(GLOW);
  composer.addPass(outlinePass);

  filmGrainPass = new ShaderPass(FilmGrainShader);
  composer.addPass(filmGrainPass);

  composer.addPass(new OutputPass());

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

  window.__forgeSetSpeaking = setAgentSpeaking;

  playCinematicIntro(() => {
    window.__forgeSceneReady = true;
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
