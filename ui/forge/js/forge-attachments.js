/**
 * forge-attachments.js — 200-slot body-mounted hardpoint system
 * with hyperrealistic components. Every slot is welded to a specific
 * anatomical zone of the robot — no floating parts.
 *
 * Robot anatomy (Y axis):
 *   Crown:      Y  7.5        Feet:    Y -2.6
 *   Head:       Y  6.2–7.2   Shins:   Y -0.8 – -1.8
 *   Neck:       Y  5.8–6.2   Knees:   Y -0.6
 *   Shoulders:  Y  5.0–5.6   Thighs:  Y  0.0 – 0.8
 *   Chest:      Y  3.2–5.2   Waist:   Y  1.2 – 1.8
 *   Back:       Y  2.0–5.2   Hips:    Y  0.2 – 1.0
 *   Arms:       X ±2.0–2.4   Calves:  Y -1.0 – -2.2
 *
 * Region → primaryCap mapping (sums to 200):
 *   Security 20 · Analytics 24 · Automation 16 · DevTools 16
 *   NFT 14 · Social 12 · Storage 12 · Productivity 12
 *   Bridge 10 · Trading 10 · Governance 10 · Wallet 10
 *   DeFi 10 · Development 12 · Writing 10 · Communication 12
 */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { MAT } from "./forge-scene.js";

/* ─────────────────────────────────────────────────────────────
   Category colour palette
   ───────────────────────────────────────────────────────────── */
export const CATEGORY_COLORS = {
  Security:       "#FFB347",
  Analytics:      "#63d7ff",
  Automation:     "#00ff88",
  DevTools:       "#4169E1",
  NFT:            "#b026ff",
  Social:         "#FF7F50",
  Storage:        "#6A5ACD",
  Productivity:   "#E6F3FF",
  Bridge:         "#FF8C00",
  Trading:        "#FFD700",
  Governance:     "#4B0082",
  Wallet:         "#50C878",
  DeFi:           "#32CD32",
  Development:    "#4488FF",
  Writing:        "#FFF8DC",
  Communication:  "#00BFFF",
};

const CATEGORY_COLORS_HEX = {};
for (const [k, v] of Object.entries(CATEGORY_COLORS)) {
  CATEGORY_COLORS_HEX[k] = parseInt(v.replace("#", ""), 16);
}

function matFor(cat) {
  const key = cat.toLowerCase();
  const mat = MAT[key] ? MAT[key].clone() : MAT.armor.clone();
  if (typeof mat.emissiveIntensity === "number") mat.emissiveIntensity *= 0.72;
  return mat;
}

/* ─────────────────────────────────────────────────────────────
   Shared geometry constants
   ───────────────────────────────────────────────────────────── */
const FRAME_C  = 0x1a2230;
const RIVET_C  = 0xd4dce8;
const HEAT_C   = 0xff4400;
const PIPE_C   = 0x2a3545;

function rMat(extra = {}) {
  return new THREE.MeshPhysicalMaterial({
    color: RIVET_C, metalness: 0.96, roughness: 0.05,
    clearcoat: 1.0, clearcoatRoughness: 0.0, ...extra,
  });
}

function frameMat(base) {
  const m = base.clone();
  m.color = new THREE.Color(FRAME_C);
  m.emissiveIntensity = (m.emissiveIntensity || 0) * 0.3;
  return m;
}

function glowMat(base, mult = 2.5) {
  const m = base.clone();
  m.emissiveIntensity = (m.emissiveIntensity || 0.5) * mult;
  m.transparent = true;
  m.opacity = 0.65;
  return m;
}

/* ─────────────────────────────────────────────────────────────
   ■ SHAPE LIBRARY  (11 hyperrealistic components)
   ───────────────────────────────────────────────────────────── */

/** Bevelled armour slab with frame rails, glow stripe, and rivets */
function armorPlate(mat, w, h, d) {
  const g = new THREE.Group();
  const minD = Math.min(w, h, d);
  const bodyGeo = minD > 0.08
    ? new RoundedBoxGeometry(w, h, d, 2, minD * 0.13)
    : new THREE.BoxGeometry(w, h, d);
  g.add(new THREE.Mesh(bodyGeo, mat));

  const fm = frameMat(mat);
  const bw = 0.014;
  g.add(new THREE.Mesh(new THREE.BoxGeometry(w + bw * 2, bw, d + bw), fm).translateY( h / 2));
  g.add(new THREE.Mesh(new THREE.BoxGeometry(w + bw * 2, bw, d + bw), fm).translateY(-h / 2));
  g.add(new THREE.Mesh(new THREE.BoxGeometry(bw, h, d + bw), fm).translateX( w / 2));
  g.add(new THREE.Mesh(new THREE.BoxGeometry(bw, h, d + bw), fm).translateX(-w / 2));

  const gm = glowMat(mat, 2.8);
  g.add(new THREE.Mesh(new THREE.BoxGeometry(w * 0.55, 0.013, d * 0.28), gm).translateZ(d / 2 + 0.005));

  const rv = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), rMat());
  for (const [rx, ry] of [[-1,-1],[1,-1],[-1,1],[1,1]]) {
    const r2 = rv.clone();
    r2.position.set(rx * w * 0.38, ry * h * 0.33, d / 2 + 0.009);
    g.add(r2);
  }
  return g;
}

/** Hexagonal tech plate with inner glow disc and apex sensor node */
function hexPlate(mat, r, h) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 6), mat));
  const inner = new THREE.Mesh(
    new THREE.CylinderGeometry(r * 0.52, r * 0.52, h + 0.01, 6),
    glowMat(mat, 1.9),
  );
  g.add(inner);
  const dot = new THREE.Mesh(new THREE.SphereGeometry(r * 0.19, 14, 9), glowMat(mat, 3.2));
  dot.translateY(h / 2 + 0.01);
  g.add(dot);
  const edge = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.055, 10, 6), glowMat(mat, 2.1));
  edge.rotation.x = Math.PI / 2; edge.position.y = h / 2 + 0.004;
  g.add(edge);
  return g;
}

/** Spinning energy core — octahedron + dual orbiting rings + bracket */
function energyModule(mat, r) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.OctahedronGeometry(r * 0.62, 1), mat));
  g.add(new THREE.Mesh(new THREE.SphereGeometry(r * 0.28, 16, 12), glowMat(mat, 3.5)));
  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.1, 12, 32), glowMat(mat, 1.6));
  ring1.rotation.x = Math.PI / 2; g.add(ring1);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(r * 0.78, r * 0.06, 10, 24), glowMat(mat, 1.3));
  ring2.rotation.z = Math.PI / 2; g.add(ring2);
  const bm = new THREE.MeshPhysicalMaterial({ color: FRAME_C, metalness: 0.65, roughness: 0.35, clearcoat: 0.4 });
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.028, r * 1.25, 0.028), bm).translateX(-r * 0.88));
  return g;
}

/** Swept blade fin with edge-glow wires and mounting pin */
function bladeFin(mat, h, w) {
  const g = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(0, h / 2);
  shape.bezierCurveTo(w * 0.6, h * 0.1, w * 0.7, -h * 0.3, w / 2, -h / 2);
  shape.lineTo(-w / 2, -h / 2);
  shape.bezierCurveTo(-w * 0.1, -h * 0.1, 0, h * 0.2, 0, h / 2);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.038, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 2 });
  g.add(new THREE.Mesh(geo, mat));
  const pts = [
    new THREE.Vector3(0, h / 2, 0.022),
    new THREE.Vector3(w * 0.45, -h / 4, 0.022),
    new THREE.Vector3(w / 2, -h / 2, 0.022),
  ];
  const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
  g.add(new THREE.Line(lineGeo, new THREE.LineBasicMaterial({
    color: mat.emissive?.getHex?.() || 0xffffff,
    transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending,
  })));
  const bm = new THREE.MeshPhysicalMaterial({ color: FRAME_C, metalness: 0.65, roughness: 0.38 });
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.038, 0.055, 8), bm).translateY(-h / 2 - 0.028));
  return g;
}

/** Shoulder/turret gun barrel with housing ring and muzzle glow */
function turretModule(mat, r) {
  const g = new THREE.Group();
  const bm = new THREE.MeshPhysicalMaterial({ color: FRAME_C, metalness: 0.72, roughness: 0.28, clearcoat: 0.5 });
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.17, r * 0.21, r * 2.6, 12), bm);
  barrel.rotation.x = Math.PI / 2; barrel.position.y = r * 0.55;
  g.add(barrel);
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(r * 0.62, r * 0.72, r * 0.38, 12), mat));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 0.66, r * 0.055, 10, 24), glowMat(mat, 2.4));
  ring.rotation.x = Math.PI / 2; g.add(ring);
  const muzzle = new THREE.Mesh(new THREE.TorusGeometry(r * 0.15, r * 0.04, 8, 16), glowMat(mat, 4.0));
  muzzle.rotation.x = Math.PI / 2; muzzle.position.set(0, r * 0.55, r * 1.35); g.add(muzzle);
  return g;
}

/** Hemisphere sensor dome with rotating inner ring and antenna spike */
function sensorDome(mat, r) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), mat));
  const bm = new THREE.MeshPhysicalMaterial({ color: FRAME_C, metalness: 0.62, roughness: 0.42, clearcoat: 0.35 });
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(r * 1.08, r * 1.08, r * 0.14, 16), bm));
  const spike = new THREE.Mesh(new THREE.ConeGeometry(r * 0.07, r * 1.3, 8), mat.clone());
  spike.translateY(r * 0.9); g.add(spike);
  const scanRing = new THREE.Mesh(new THREE.TorusGeometry(r * 0.68, r * 0.035, 10, 24), glowMat(mat, 2.8));
  scanRing.rotation.x = Math.PI / 2; scanRing.position.y = r * 0.3; g.add(scanRing);
  return g;
}

/** Cluster of three missile/rocket tubes with blast-guard plate */
function missilePod(mat, r) {
  const g = new THREE.Group();
  const bm = new THREE.MeshPhysicalMaterial({ color: PIPE_C, metalness: 0.75, roughness: 0.25, clearcoat: 0.6 });
  const capMat = rMat({ color: HEAT_C, emissive: new THREE.Color(HEAT_C), emissiveIntensity: 1.2 });
  const offsets = [[0, r * 0.55], [-r * 0.5, -r * 0.28], [r * 0.5, -r * 0.28]];
  for (const [ox, oy] of offsets) {
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.22, r * 0.22, r * 1.8, 8), bm);
    tube.position.set(ox, oy, 0); g.add(tube);
    const cap = new THREE.Mesh(new THREE.CircleGeometry(r * 0.18, 8), capMat);
    cap.position.set(ox, oy - r * 0.9, r * 0.24); cap.rotation.x = Math.PI / 2; g.add(cap);
  }
  const plate = new THREE.Mesh(new THREE.BoxGeometry(r * 1.6, r * 1.6, r * 0.22), mat);
  plate.position.z = -r * 0.12; g.add(plate);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 0.65, r * 0.04, 8, 18), glowMat(mat, 2.0));
  ring.rotation.x = Math.PI / 2; g.add(ring);
  return g;
}

/** Exhaust thruster nozzle with heat shield ribs and afterburner glow */
function thrusterNozzle(mat, r) {
  const g = new THREE.Group();
  const bm = new THREE.MeshPhysicalMaterial({ color: FRAME_C, metalness: 0.8, roughness: 0.2, clearcoat: 0.7 });
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.9, r * 1.1, 16), bm));
  const heatMat = new THREE.MeshPhysicalMaterial({
    color: HEAT_C, emissive: new THREE.Color(0xff6600),
    emissiveIntensity: 2.0, transparent: true, opacity: 0.55, metalness: 0.4, roughness: 0.6,
  });
  const nozzleInner = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.42, r * 0.82, r * 1.15, 16), heatMat);
  g.add(nozzleInner);
  for (let i = 0; i < 6; i++) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(r * 0.06, r * 1.15, r * 0.12), bm);
    rib.rotation.y = (i / 6) * Math.PI * 2;
    rib.position.set(Math.cos((i / 6) * Math.PI * 2) * r * 0.72, 0, Math.sin((i / 6) * Math.PI * 2) * r * 0.72);
    g.add(rib);
  }
  const glow = new THREE.Mesh(new THREE.CircleGeometry(r * 0.45, 16), glowMat(mat, 5.0));
  glow.position.y = -r * 0.56; glow.rotation.x = Math.PI / 2; g.add(glow);
  return g;
}

/** Data uplink spike — tapered rod with three orbiting signal rings */
function dataSpike(mat, h) {
  const g = new THREE.Group();
  const bm = new THREE.MeshPhysicalMaterial({ color: FRAME_C, metalness: 0.78, roughness: 0.22, clearcoat: 0.8 });
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.06, h, 8), bm));
  g.add(new THREE.Mesh(new THREE.ConeGeometry(0.04, h * 0.28, 8), mat).translateY(h * 0.64));
  const ringOffsets = [0.28, 0.52, 0.72];
  for (const t of ringOffsets) {
    const nr = 0.11 + t * 0.06;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(nr, 0.013, 7, 20), glowMat(mat, 3.0 - t));
    ring.rotation.x = Math.PI / 2; ring.position.y = h * (t - 0.5); g.add(ring);
  }
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.045, 10), mat);
  base.translateY(-h * 0.5 - 0.022); g.add(base);
  return g;
}

/** Glowing reactor core — icosahedron with equatorial ring array */
function reactorCore(mat, r) {
  const g = new THREE.Group();
  const coreMat = glowMat(mat, 3.8);
  coreMat.opacity = 0.9;
  g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(r * 0.58, 1), coreMat));
  const shell = mat.clone(); shell.transparent = true; shell.opacity = 0.18; shell.side = THREE.BackSide;
  g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(r * 0.82, 1), shell));
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI;
    const orb = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.07, 9, 28), glowMat(mat, 2.0 + i * 0.4));
    orb.rotation.set(angle, angle * 0.7, 0); orb.transparent = true; orb.opacity = 0.5; g.add(orb);
  }
  const bm = new THREE.MeshPhysicalMaterial({ color: FRAME_C, metalness: 0.7, roughness: 0.3 });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, r * 0.75, 6), bm);
    strut.position.set(Math.cos(a) * r * 0.88, 0, Math.sin(a) * r * 0.88);
    strut.rotation.z = -Math.PI / 2; strut.rotation.y = a; g.add(strut);
  }
  return g;
}

/** Articulated shoulder cannon with scope housing and charging rune */
function shoulderCannon(mat, scale = 1.0) {
  const s = scale;
  const g = new THREE.Group();
  const bm = new THREE.MeshPhysicalMaterial({ color: FRAME_C, metalness: 0.78, roughness: 0.22, clearcoat: 0.6 });
  const housing = new THREE.Mesh(new RoundedBoxGeometry(0.55 * s, 0.3 * s, 0.4 * s, 2, 0.04 * s), mat);
  g.add(housing);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.065 * s, 0.08 * s, 0.9 * s, 12), bm);
  barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.05 * s, 0.65 * s); g.add(barrel);
  const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.04 * s, 0.04 * s, 0.35 * s, 8), bm);
  scope.rotation.x = Math.PI / 2; scope.position.set(0, 0.2 * s, 0.4 * s); g.add(scope);
  const muzzle = new THREE.Mesh(new THREE.TorusGeometry(0.055 * s, 0.016 * s, 8, 16), glowMat(mat, 4.5));
  muzzle.rotation.x = Math.PI / 2; muzzle.position.set(0, 0.05 * s, 1.12 * s); g.add(muzzle);
  const rune = new THREE.Mesh(new THREE.TorusGeometry(0.18 * s, 0.012 * s, 7, 18), glowMat(mat, 3.0));
  rune.rotation.x = Math.PI / 2; rune.position.set(0, 0.05 * s, 0.22 * s); g.add(rune);
  return g;
}

/** Knee/joint guard — curved convex plate with sensor cluster grid */
function kneeGuard(mat, w, h) {
  const g = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, -h / 2);
  shape.bezierCurveTo(-w / 2, h * 0.1, 0, h * 0.6, 0, h / 2);
  shape.bezierCurveTo(0, h * 0.6, w / 2, h * 0.1, w / 2, -h / 2);
  shape.lineTo(-w / 2, -h / 2);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.14, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 3 });
  g.add(new THREE.Mesh(geo, mat));
  const fm = frameMat(mat);
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(w * 0.85, 0.018, 0.16), fm);
  ridge.position.set(0, 0, 0.16); g.add(ridge);
  const dotGeo = new THREE.CircleGeometry(0.022, 8);
  const dotMat = glowMat(mat, 3.5);
  for (let i = -1; i <= 1; i++) {
    const d = new THREE.Mesh(dotGeo, dotMat.clone());
    d.position.set(i * w * 0.22, h * 0.05, 0.165); d.rotation.x = -Math.PI / 12; g.add(d);
  }
  return g;
}

/** Boot/foot anchor — thick platform plate with magnetic claw pads */
function footAnchor(mat, w, h) {
  const g = new THREE.Group();
  const bm = new THREE.MeshPhysicalMaterial({ color: FRAME_C, metalness: 0.82, roughness: 0.18, clearcoat: 0.7 });
  g.add(new THREE.Mesh(new RoundedBoxGeometry(w, h * 0.22, w * 0.65, 2, 0.035), mat));
  const toe = new THREE.Mesh(new RoundedBoxGeometry(w * 0.72, h * 0.15, w * 0.35, 2, 0.025), bm);
  toe.position.set(0, -h * 0.035, w * 0.42); g.add(toe);
  const clawMat = rMat({ color: 0x1a2230 });
  const cGeo = new THREE.SphereGeometry(0.045, 8, 6);
  for (const cx of [-w * 0.3, 0, w * 0.3]) {
    const claw = new THREE.Mesh(cGeo, clawMat);
    claw.position.set(cx, -h * 0.12, w * 0.36); g.add(claw);
  }
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.55, w * 0.32), glowMat(mat, 2.2));
  glow.position.set(0, -h * 0.1, w * 0.38); glow.rotation.x = -Math.PI / 2; g.add(glow);
  return g;
}

/* ─────────────────────────────────────────────────────────────
   Region config — centre anchors + primaryCap = 200 total
   ───────────────────────────────────────────────────────────── */
const REGIONS = {
  Security:      { center: [0,    3.5, -0.92], primaryCap: 20, overflowR: 1.2, vSpread: 2.5 },
  Analytics:     { center: [0,    7.1,  0.0 ], primaryCap: 24, overflowR: 0.9, vSpread: 1.2 },
  Automation:    { center: [-2.1, 3.0,  0.0 ], primaryCap: 16, overflowR: 1.0, vSpread: 2.8 },
  DevTools:      { center: [ 2.1, 3.0,  0.0 ], primaryCap: 16, overflowR: 1.0, vSpread: 2.8 },
  NFT:           { center: [ 2.3, 5.2, -0.2 ], primaryCap: 14, overflowR: 1.0, vSpread: 1.8 },
  Social:        { center: [-2.3, 5.2, -0.2 ], primaryCap: 12, overflowR: 1.0, vSpread: 1.8 },
  Storage:       { center: [0,    1.5, -0.78], primaryCap: 12, overflowR: 1.0, vSpread: 1.5 },
  Productivity:  { center: [0,    4.2,  0.88], primaryCap: 12, overflowR: 0.9, vSpread: 2.0 },
  Bridge:        { center: [-1.2, 5.6,  0.55], primaryCap: 10, overflowR: 0.9, vSpread: 1.4 },
  Trading:       { center: [ 1.2, 5.6,  0.55], primaryCap: 10, overflowR: 0.9, vSpread: 1.4 },
  Governance:    { center: [0,    6.7,  0.35], primaryCap: 10, overflowR: 0.8, vSpread: 1.0 },
  Wallet:        { center: [0,    1.2,  0.62], primaryCap: 10, overflowR: 0.8, vSpread: 1.2 },
  DeFi:          { center: [0,   -0.6,  0.45], primaryCap: 10, overflowR: 0.9, vSpread: 2.0 },
  Development:   { center: [ 2.1, 4.5,  0.22], primaryCap: 12, overflowR: 1.0, vSpread: 2.0 },
  Writing:       { center: [-2.1, 2.2,  0.0 ], primaryCap: 10, overflowR: 0.9, vSpread: 1.8 },
  Communication: { center: [0,    7.6,  0.0 ], primaryCap: 12, overflowR: 0.8, vSpread: 1.0 },
};

/* ─────────────────────────────────────────────────────────────
   PRIMARY placement builders — body-welded hardpoints
   ───────────────────────────────────────────────────────────── */
const PRIMARY = {

  /* ── SECURITY (20) ── back torso armour grid 5×4 */
  Security(mat, idx) {
    const col = idx % 4;
    const row = Math.floor(idx / 4);
    let mesh;
    if (idx % 5 === 0)      mesh = turretModule(mat, 0.13);
    else if (idx % 7 === 0) mesh = sensorDome(mat, 0.1);
    else                    mesh = armorPlate(mat, 0.52, 0.22, 0.07);
    mesh.position.set(-0.42 + col * 0.28, 2.0 + row * 0.82, -0.92);
    return mesh;
  },

  /* ── ANALYTICS (24) ── crown halo — three concentric rings */
  Analytics(mat, idx) {
    const ringIdx = Math.floor(idx / 8);
    const posInRing = idx % 8;
    const ringCount = 8;
    const angle = (posInRing / ringCount) * Math.PI * 2;
    const radii  = [0.38, 0.62, 0.9];
    const yOffs  = [0.0,  0.22, 0.48];
    const r = radii[ringIdx] || 0.9;
    const y = 7.1 + (yOffs[ringIdx] || 0);
    let mesh;
    if (idx % 4 === 0) mesh = sensorDome(mat, 0.1);
    else if (idx % 6 === 0) mesh = dataSpike(mat, 0.32);
    else mesh = bladeFin(mat, 0.3, 0.12);
    mesh.position.set(Math.cos(angle) * r, y, Math.sin(angle) * r);
    mesh.rotation.y = -angle;
    return mesh;
  },

  /* ── AUTOMATION (16) ── left arm full column — shoulder → wrist */
  Automation(mat, idx) {
    const col = Math.floor(idx / 8);
    const row = idx % 8;
    let mesh;
    if (idx % 4 === 0) mesh = hexPlate(mat, 0.16, 0.09);
    else if (idx % 7 === 0) mesh = missilePod(mat, 0.1);
    else mesh = armorPlate(mat, 0.1, 0.34, 0.4);
    mesh.position.set(-2.08 - col * 0.22, 1.1 + row * 0.5, 0.05);
    mesh.rotation.z = Math.PI / 2;
    return mesh;
  },

  /* ── DEVTOOLS (16) ── right arm full column — shoulder → wrist */
  DevTools(mat, idx) {
    const col = Math.floor(idx / 8);
    const row = idx % 8;
    let mesh;
    if (idx % 4 === 0) mesh = hexPlate(mat, 0.16, 0.09);
    else if (idx % 7 === 0) mesh = dataSpike(mat, 0.36);
    else mesh = armorPlate(mat, 0.1, 0.34, 0.4);
    mesh.position.set(2.08 + col * 0.22, 1.1 + row * 0.5, 0.05);
    mesh.rotation.z = Math.PI / 2;
    return mesh;
  },

  /* ── NFT (14) ── right shoulder cluster — arc + stack */
  NFT(mat, idx) {
    let mesh;
    if (idx % 3 === 0) mesh = reactorCore(mat, 0.18);
    else if (idx % 5 === 0) mesh = shoulderCannon(mat, 0.55);
    else mesh = energyModule(mat, 0.19);
    const arc = Math.floor(idx / 5);
    const posInArc = idx % 5;
    const angle = (posInArc / 5) * Math.PI * 1.1 - 0.3;
    const r = 0.32 + arc * 0.25;
    mesh.position.set(1.95 + Math.cos(angle) * r, 5.1 + arc * 0.38, -0.22 + Math.sin(angle) * 0.28);
    return mesh;
  },

  /* ── SOCIAL (12) ── left shoulder cluster — mirrored arc */
  Social(mat, idx) {
    let mesh;
    if (idx % 3 === 0) mesh = sensorDome(mat, 0.11);
    else if (idx % 4 === 0) mesh = hexPlate(mat, 0.14, 0.08);
    else mesh = bladeFin(mat, 0.28, 0.12);
    const arc = Math.floor(idx / 4);
    const posInArc = idx % 4;
    const angle = (posInArc / 4) * Math.PI * 1.1 - 0.2;
    const r = 0.3 + arc * 0.22;
    mesh.position.set(-1.95 - Math.cos(angle) * r, 5.1 + arc * 0.38, -0.2 + Math.sin(angle) * 0.28);
    return mesh;
  },

  /* ── STORAGE (12) ── waist band — full 360° drum pods */
  Storage(mat, idx) {
    const angle = (idx / 12) * Math.PI * 2;
    const r = 0.72;
    const g = new THREE.Group();
    const bm = mat.clone();
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.38, 8), bm));
    const gm = glowMat(mat, 2.0);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.018, 7, 14), gm);
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.17; g.add(ring);
    g.position.set(Math.cos(angle) * r, 1.5, Math.sin(angle) * r);
    g.rotation.y = -angle;
    return g;
  },

  /* ── PRODUCTIVITY (12) ── chest front — 4×3 panel grid */
  Productivity(mat, idx) {
    const col = idx % 4;
    const row = Math.floor(idx / 4);
    let mesh;
    if (idx % 5 === 0) mesh = sensorDome(mat, 0.09);
    else if (idx % 3 === 0) mesh = hexPlate(mat, 0.13, 0.07);
    else mesh = armorPlate(mat, 0.34, 0.18, 0.06);
    mesh.position.set(-0.5 + col * 0.34, 3.05 + row * 0.58, 0.88);
    return mesh;
  },

  /* ── BRIDGE (10) ── left collar/upper chest — curved ramp */
  Bridge(mat, idx) {
    let mesh;
    if (idx % 3 === 0) mesh = energyModule(mat, 0.17);
    else if (idx % 4 === 0) mesh = thrusterNozzle(mat, 0.13);
    else mesh = armorPlate(mat, 0.38, 0.16, 0.08);
    const t = idx / 9;
    mesh.position.set(-0.6 - t * 0.55, 5.6 - t * 0.55, 0.55 - t * 0.18);
    mesh.rotation.y = t * 0.3;
    return mesh;
  },

  /* ── TRADING (10) ── right collar/upper chest — mirrored ramp */
  Trading(mat, idx) {
    let mesh;
    if (idx % 3 === 0) mesh = energyModule(mat, 0.17);
    else if (idx % 4 === 0) mesh = missilePod(mat, 0.12);
    else mesh = armorPlate(mat, 0.38, 0.16, 0.08);
    const t = idx / 9;
    mesh.position.set(0.6 + t * 0.55, 5.6 - t * 0.55, 0.55 - t * 0.18);
    mesh.rotation.y = -t * 0.3;
    return mesh;
  },

  /* ── GOVERNANCE (10) ── head sides + crown band */
  Governance(mat, idx) {
    let mesh;
    if (idx === 0) mesh = shoulderCannon(mat, 0.42);
    else if (idx % 3 === 0) mesh = sensorDome(mat, 0.08);
    else mesh = armorPlate(mat, 0.28, 0.09, 0.06);
    const side = idx % 2 === 0 ? 1 : -1;
    const row = Math.floor(idx / 2);
    mesh.position.set(side * 0.52, 6.7 - row * 0.19, 0.3 + row * 0.04);
    return mesh;
  },

  /* ── WALLET (10) ── hip-belt band — evenly spaced on front 180° */
  Wallet(mat, idx) {
    const angle = ((idx / 9) - 0.5) * Math.PI;
    const r = 0.58;
    let mesh;
    if (idx === 0) mesh = reactorCore(mat, 0.14);
    else if (idx % 3 === 0) mesh = hexPlate(mat, 0.12, 0.07);
    else mesh = armorPlate(mat, 0.3, 0.14, 0.07);
    mesh.position.set(Math.cos(angle) * r, 1.2, 0.62 + Math.sin(angle) * r * 0.5);
    mesh.rotation.y = -angle;
    return mesh;
  },

  /* ── DEFI (10) ── thigh + shin armour — bilateral leg panels */
  DeFi(mat, idx) {
    const side = idx % 2 === 0 ? -1 : 1;
    const stack = Math.floor(idx / 2);
    let mesh;
    if (stack === 0) mesh = kneeGuard(mat, 0.38, 0.28);
    else if (idx % 3 === 0) mesh = armorPlate(mat, 0.34, 0.2, 0.07);
    else mesh = hexPlate(mat, 0.14, 0.08);
    mesh.position.set(side * 0.56, 0.22 - stack * 0.55, 0.44);
    return mesh;
  },

  /* ── DEVELOPMENT (12) ── right torso side — vertical stack */
  Development(mat, idx) {
    const row = idx % 6;
    const col = Math.floor(idx / 6);
    let mesh;
    if (idx % 4 === 0) mesh = dataSpike(mat, 0.4);
    else if (idx % 3 === 0) mesh = hexPlate(mat, 0.14, 0.08);
    else mesh = armorPlate(mat, 0.12, 0.42, 0.48);
    mesh.position.set(2.08 + col * 0.2, 2.5 + row * 0.52, 0.22);
    return mesh;
  },

  /* ── WRITING (10) ── left forearm bracers — 2 cols × 5 rows */
  Writing(mat, idx) {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    let mesh;
    if (idx % 4 === 0) mesh = bladeFin(mat, 0.26, 0.1);
    else mesh = armorPlate(mat, 0.1, 0.3, 0.38);
    mesh.position.set(-2.08 - col * 0.18, 1.2 + row * 0.52, 0.0);
    mesh.rotation.z = Math.PI / 2;
    return mesh;
  },

  /* ── COMMUNICATION (12) ── antenna array above head */
  Communication(mat, idx) {
    if (idx === 0) {
      const d = sensorDome(mat, 0.16);
      d.position.set(0, 7.55, 0);
      return d;
    }
    if (idx % 3 === 0) {
      const rc = reactorCore(mat, 0.12);
      rc.position.set(0, 7.55 + idx * 0.38, 0);
      return rc;
    }
    const angle = ((idx - 1) / 11) * Math.PI * 2;
    const r = 0.22 + (idx % 3) * 0.12;
    const spike = dataSpike(mat, 0.38 + idx * 0.06);
    spike.position.set(Math.cos(angle) * r, 7.6 + idx * 0.3, Math.sin(angle) * r);
    return spike;
  },
};

/* ─────────────────────────────────────────────────────────────
   Overflow: snap to nearest body-surface slab for this region
   Uses a deterministic grid around the region anchor, NOT open
   orbital space — parts stay tightly against the robot body.
   ───────────────────────────────────────────────────────────── */

/* Surface-normal hint for snapping overflow to body faces */
const REGION_SURFACE_NORMAL = {
  Security:      new THREE.Vector3( 0,  0, -1),
  Analytics:     new THREE.Vector3( 0,  1,  0),
  Automation:    new THREE.Vector3(-1,  0,  0),
  DevTools:      new THREE.Vector3( 1,  0,  0),
  NFT:           new THREE.Vector3( 1,  0.3, 0),
  Social:        new THREE.Vector3(-1,  0.3, 0),
  Storage:       new THREE.Vector3( 0, -0.2,-1),
  Productivity:  new THREE.Vector3( 0,  0,  1),
  Bridge:        new THREE.Vector3(-0.7,0.3, 0.5),
  Trading:       new THREE.Vector3( 0.7,0.3, 0.5),
  Governance:    new THREE.Vector3( 0,  0.6, 0.5),
  Wallet:        new THREE.Vector3( 0,  0,  1),
  DeFi:          new THREE.Vector3( 0,  0,  1),
  Development:   new THREE.Vector3( 1,  0,  0),
  Writing:       new THREE.Vector3(-1,  0,  0),
  Communication: new THREE.Vector3( 0,  1,  0),
};

function buildOverflow(mat, overflowIdx, cat) {
  const region = REGIONS[cat] || REGIONS.Security;
  const norm   = (REGION_SURFACE_NORMAL[cat] || REGION_SURFACE_NORMAL.Security).clone().normalize();
  const center = new THREE.Vector3(...region.center);

  /* Tile overflow parts in a tight grid on the body surface */
  const gridW = 4;
  const gCol  = overflowIdx % gridW;
  const gRow  = Math.floor(overflowIdx / gridW);
  const step  = 0.28;

  /* Two tangent axes perpendicular to surface normal */
  const up  = Math.abs(norm.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const tan1 = new THREE.Vector3().crossVectors(norm, up).normalize();
  const tan2 = new THREE.Vector3().crossVectors(norm, tan1).normalize();

  const offset = new THREE.Vector3()
    .addScaledVector(tan1, (gCol - (gridW - 1) / 2) * step)
    .addScaledVector(tan2, gRow * step);

  /* Small compact parts for overflow */
  const shapes = [
    () => hexPlate(mat, 0.09, 0.05),
    () => { const m = energyModule(mat, 0.09); m.rotation.x = Math.PI / 2; return m; },
    () => armorPlate(mat, 0.2, 0.12, 0.04),
    () => dataSpike(mat, 0.22),
    () => sensorDome(mat, 0.07),
  ];
  const mesh = shapes[overflowIdx % shapes.length]();
  mesh.position.copy(center).add(offset);
  return mesh;
}

/* ─────────────────────────────────────────────────────────────
   Central dispatcher
   ───────────────────────────────────────────────────────────── */
function buildOne(cat, mat, idx, count) {
  const region = REGIONS[cat];
  if (!region) return buildOverflow(mat, idx, "Security");
  const cap = region.primaryCap;
  if (idx < cap && PRIMARY[cat]) {
    return PRIMARY[cat](mat, idx, Math.min(count, cap));
  }
  return buildOverflow(mat, idx - cap, cat);
}

/* ─────────────────────────────────────────────────────────────
   Public API — build attachments from live skill list
   ───────────────────────────────────────────────────────────── */
export function buildAttachmentsFromSkills(skills, parentGroup) {
  const byCategory = {};
  skills.forEach(s => {
    const cat = s.category || "Uncategorized";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(s);
  });

  const attachments = [];

  for (const [cat, catSkills] of Object.entries(byCategory)) {
    catSkills.forEach((skill, idx) => {
      const mat   = matFor(cat);
      const built = buildOne(cat, mat, idx, catSkills.length);
      const group = new THREE.Group();

      group.userData = {
        skillSlug:      skill.slug,
        skillName:      skill.name,
        category:       cat,
        description:    skill.description,
        onchain:        skill.onchain || !!skill.onchainTokenId,
        vettedOk:       skill.vetted_ok || skill.vettedOk,
        risk_tier:      skill.risk_tier || skill.riskTier,
        documentation_md: skill.documentation_md,
        fileName:       skill.fileName,
        source:         skill.source,
        categoryIndex:  idx,
        isOverflow:     idx >= (REGIONS[cat]?.primaryCap || 0),
      };

      /* Copy sub-meshes + world position from the builder group */
      if (built.isGroup) {
        built.children.forEach(c => group.add(c.clone()));
        group.position.copy(built.position);
        group.rotation.copy(built.rotation);
      } else {
        group.add(built);
        if (built.position) { group.position.copy(built.position); built.position.set(0, 0, 0); }
        if (built.rotation) { group.rotation.copy(built.rotation); built.rotation.set(0, 0, 0); }
      }

      parentGroup.add(group);
      attachments.push(group);
    });
  }

  return attachments;
}

/* ─────────────────────────────────────────────────────────────
   Clear helpers
   ───────────────────────────────────────────────────────────── */
export function clearAttachments(attachmentGroup, energyNetworkGroup) {
  for (const grp of [attachmentGroup, energyNetworkGroup]) {
    while (grp.children.length) {
      const child = grp.children[0];
      child.traverse(c => {
        if (c.geometry) c.geometry.dispose();
        if (c.material) {
          if (Array.isArray(c.material)) c.material.forEach(m => m.dispose());
          else c.material.dispose();
        }
      });
      grp.remove(child);
    }
  }
}

/* ─────────────────────────────────────────────────────────────
   Energy network — low-opacity lines linking category clusters
   ───────────────────────────────────────────────────────────── */
export function buildEnergyNetwork(attachments, parentGroup) {
  const byCategory = {};
  attachments.forEach(a => {
    const cat = a.userData.category;
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(a);
  });

  const corePos = new THREE.Vector3(0, 4.2, 0.65);

  for (const [cat, atts] of Object.entries(byCategory)) {
    const color = CATEGORY_COLORS_HEX[cat] || 0xaaaaaa;
    const lineMat = new THREE.LineBasicMaterial({
      color, transparent: true, opacity: 0.11,
      blending: THREE.AdditiveBlending,
    });

    const maxChain = Math.min(atts.length - 1, 80);
    for (let i = 0; i < maxChain; i++) {
      const geo = new THREE.BufferGeometry().setFromPoints([atts[i].position, atts[i + 1].position]);
      const line = new THREE.Line(geo, lineMat.clone());
      line.userData.category = cat;
      parentGroup.add(line);
    }

    if (atts.length > 0) {
      const hubMat = lineMat.clone(); hubMat.opacity = 0.07;
      const geo = new THREE.BufferGeometry().setFromPoints([atts[0].position, corePos]);
      parentGroup.add(new THREE.Line(geo, hubMat));
    }
  }
}

/* ─────────────────────────────────────────────────────────────
   Per-category idle animations
   ───────────────────────────────────────────────────────────── */
const IDLE = {
  Security(att, time, idx) {
    att.traverse(c => { if (c.isMesh) c.material.emissiveIntensity = 0.5 + 0.9 * Math.max(0, Math.sin(time * 2.1 + idx * 0.38)); });
  },
  Analytics(att, time, idx) {
    att.rotation.y += 0.003;
    att.traverse(c => { if (c.isMesh) c.material.emissiveIntensity = 0.7 + 0.6 * Math.sin(time * 3.2 + idx); });
  },
  Automation(att, time, idx) {
    att.traverse(c => { if (c.isMesh) c.material.emissiveIntensity = 0.5 + 0.85 * Math.max(0, Math.sin(time * 2.8 - idx * 1.1)); });
  },
  DevTools(att, time, idx) {
    att.traverse(c => { if (c.isMesh) c.material.emissiveIntensity = 0.7 + 0.7 * Math.sin(time * 4.0 + idx * 0.2); });
  },
  NFT(att, time) {
    att.rotation.y += 0.009;
    att.traverse(c => { if (c.isMesh) c.material.emissiveIntensity = 0.9 + 0.85 * Math.abs(Math.sin(time * 1.4)); });
  },
  Social(att, time, idx) {
    att.rotation.y += 0.011;
    att.traverse(c => { if (c.isMesh) c.material.emissiveIntensity = 0.7 + 0.45 * Math.sin(time * 2.2 + idx * 0.5); });
  },
  Storage(att, time, idx) {
    att.traverse(c => { if (c.isMesh) c.material.emissiveIntensity = 0.4 + 0.55 * Math.sin(time * 1.1 + idx * 0.6); });
  },
  Productivity(att, time, idx) {
    att.rotation.z += 0.004;
    att.traverse(c => { if (c.isMesh) c.material.emissiveIntensity = 0.55 + 0.45 * Math.sin(time * 2.6 + idx * 0.4); });
  },
  Bridge(att, time, idx) {
    att.rotation.y += 0.007;
    att.traverse(c => { if (c.isMesh) c.material.emissiveIntensity = 0.7 + 0.55 * Math.sin(time * 2.4 + idx * 0.55); });
  },
  Trading(att, time) {
    att.traverse(c => {
      if (c.isMesh) c.material.emissiveIntensity = 0.6 + 1.1 * (Math.random() > 0.92 ? 1 : 0.15);
    });
  },
  Governance(att, time, idx) {
    att.traverse(c => { if (c.isMesh) c.material.emissiveIntensity = 0.7 + 0.5 * Math.sin(time * 1.6 + idx * 0.7); });
  },
  Wallet(att, time, idx) {
    att.traverse(c => { if (c.isMesh) c.material.emissiveIntensity = 0.45 + 0.75 * (0.5 + 0.5 * Math.sin(time * 4.4 + idx * 0.5)); });
  },
  DeFi(att, time, idx) {
    att.traverse(c => { if (c.isMesh) c.material.emissiveIntensity = 0.55 + 0.55 * Math.sin(time * 2.1 + idx * 0.6); });
  },
  Development(att, time, idx) {
    att.traverse(c => { if (c.isMesh) c.material.emissiveIntensity = 0.7 + 0.65 * Math.sin(time * 3.1 + idx * 0.35); });
  },
  Writing(att, time, idx) {
    att.traverse(c => { if (c.isMesh) c.material.emissiveIntensity = 0.45 + 0.35 * Math.sin(time * 1.9 + idx * 0.45); });
  },
  Communication(att, time, idx) {
    att.rotation.y += 0.005;
    att.traverse(c => { if (c.isMesh) c.material.emissiveIntensity = 0.7 + 0.75 * Math.abs(Math.sin(time * 3.0 + idx * 0.3)); });
  },
};

function overflowIdle(att, time, idx) {
  att.rotation.y += 0.003;
  att.traverse(c => {
    if (c.isMesh) c.material.emissiveIntensity = 0.5 + 0.55 * Math.sin(time * 1.6 + idx * 0.32);
  });
}

export function makeIdleAnimator(attachments) {
  return function idleAnimator(time) {
    for (const att of attachments) {
      if (att.userData.isOverflow) {
        overflowIdle(att, time, att.userData.categoryIndex);
      } else {
        const fn = IDLE[att.userData.category];
        if (fn) fn(att, time, att.userData.categoryIndex);
      }
    }
  };
}
