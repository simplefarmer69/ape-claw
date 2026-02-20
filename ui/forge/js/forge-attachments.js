/**
 * forge-attachments.js — Scalable region builders (1000+ skills),
 * energy network, category-specific idle animations for ClawBot Forge.
 *
 * HV-MTL integrated style: attachments mount directly onto the robot
 * body at armor hardpoints, joints, and expansion slots rather than
 * floating disconnected in space.
 */
import * as THREE from "three";
import { MAT } from "./forge-scene.js";

/* ══════════════════════════════════════════════════════════
   Category → Color hex map
   ══════════════════════════════════════════════════════════ */
export const CATEGORY_COLORS = {
  Security:       "#FFB347",
  Analytics:      "#63d7ff",
  Automation:     "#00ff00",
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
  Development:    "#4169E1",
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
  if (typeof mat.emissiveIntensity === "number") {
    mat.emissiveIntensity *= 0.72;
  }
  return mat;
}

/* ══════════════════════════════════════════════════════════
   Golden-angle spiral for overflow orbital placement
   ══════════════════════════════════════════════════════════ */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function overflowPosition(overflowIdx, center, baseRadius, verticalSpread) {
  const shell = Math.floor(overflowIdx / 24);
  const idxInShell = overflowIdx % 24;
  const r = baseRadius + shell * 0.5;
  const angle = idxInShell * GOLDEN_ANGLE;
  const yOff = (idxInShell / 24 - 0.5) * verticalSpread;
  return new THREE.Vector3(
    center.x + Math.cos(angle) * r,
    center.y + yOff,
    center.z + Math.sin(angle) * r,
  );
}

/* ══════════════════════════════════════════════════════════
   Region configs — positions mapped to robot body hardpoints
   Adjusted for HV-MTL proportions (feet at ~-2.5, head at ~7)
   ══════════════════════════════════════════════════════════ */
const REGIONS = {
  Security:      { center: [0, 4.0, -0.8],  primaryCap: 14, overflowR: 1.4, vSpread: 3.0 },
  Analytics:     { center: [0, 7.2, 0],      primaryCap: 20, overflowR: 1.0, vSpread: 1.5 },
  Automation:    { center: [-2.1, 3.0, 0],   primaryCap: 12, overflowR: 1.2, vSpread: 2.5 },
  DevTools:      { center: [2.1, 3.0, 0],    primaryCap: 12, overflowR: 1.2, vSpread: 2.5 },
  NFT:           { center: [2.3, 5.5, -0.3], primaryCap: 10, overflowR: 1.1, vSpread: 2.0 },
  Social:        { center: [-2.1, 2.0, 0.2], primaryCap: 8,  overflowR: 1.0, vSpread: 1.8 },
  Storage:       { center: [0, 3.0, -0.9],   primaryCap: 8,  overflowR: 1.0, vSpread: 1.5 },
  Productivity:  { center: [0, 4.5, 0.78],   primaryCap: 9,  overflowR: 0.9, vSpread: 1.5 },
  Bridge:        { center: [-2.0, 5.5, -0.2],primaryCap: 6,  overflowR: 1.0, vSpread: 2.0 },
  Trading:       { center: [-0.55, -0.8, 0.4],primaryCap: 6, overflowR: 1.0, vSpread: 2.0 },
  Governance:    { center: [0, 6.7, 0.4],    primaryCap: 6,  overflowR: 0.8, vSpread: 1.2 },
  Wallet:        { center: [0, 2.35, 0.55],  primaryCap: 6,  overflowR: 0.8, vSpread: 1.5 },
  DeFi:          { center: [0.55, -0.8, 0.4],primaryCap: 6,  overflowR: 1.0, vSpread: 2.0 },
  Development:   { center: [2.1, 4.0, 0.2],  primaryCap: 8,  overflowR: 1.0, vSpread: 2.0 },
  Writing:       { center: [2.1, 2.0, 0.2],  primaryCap: 6,  overflowR: 0.9, vSpread: 1.5 },
  Communication: { center: [0, 7.5, 0],      primaryCap: 6,  overflowR: 0.8, vSpread: 1.2 },
};

/* ══════════════════════════════════════════════════════════
   Attachment shapes — super-detailed integrated components
   Layered geometry with edge trim, glow lines, mounting hardware
   ══════════════════════════════════════════════════════════ */
const FRAME_C = 0x283040;
const RIVET_C = 0xd0d8e0;

function armorPlate(mat, w, h, d) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  group.add(body);
  // Raised edge frame
  const frameMat = mat.clone();
  frameMat.color = new THREE.Color(FRAME_C);
  frameMat.emissiveIntensity = (frameMat.emissiveIntensity || 0) * 0.4;
  const bw = 0.015;
  group.add(new THREE.Mesh(new THREE.BoxGeometry(w + bw * 2, bw, d + bw), frameMat).translateY(h / 2));
  group.add(new THREE.Mesh(new THREE.BoxGeometry(w + bw * 2, bw, d + bw), frameMat).translateY(-h / 2));
  group.add(new THREE.Mesh(new THREE.BoxGeometry(bw, h, d + bw), frameMat).translateX(w / 2));
  group.add(new THREE.Mesh(new THREE.BoxGeometry(bw, h, d + bw), frameMat).translateX(-w / 2));
  // Center glow line
  const glowMat = mat.clone();
  glowMat.emissiveIntensity = (glowMat.emissiveIntensity || 0.5) * 2.5;
  glowMat.transparent = true; glowMat.opacity = 0.7;
  group.add(new THREE.Mesh(new THREE.BoxGeometry(w * 0.6, 0.015, d * 0.3), glowMat).translateZ(d / 2 + 0.005));
  // Mounting rivets
  const rMat = new THREE.MeshStandardMaterial({ color: RIVET_C, metalness: 0.9, roughness: 0.15 });
  const rGeo = new THREE.SphereGeometry(0.018, 5, 3);
  for (const [rx, ry] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const rv = new THREE.Mesh(rGeo, rMat);
    rv.position.set(rx * w * 0.4, ry * h * 0.35, d / 2 + 0.01);
    group.add(rv);
  }
  return group;
}

function hexPlate(mat, r, h) {
  const group = new THREE.Group();
  group.add(new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 6), mat));
  // Inner hex detail (recessed)
  const innerMat = mat.clone();
  innerMat.emissiveIntensity = (innerMat.emissiveIntensity || 0.5) * 1.8;
  innerMat.transparent = true; innerMat.opacity = 0.6;
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.55, h + 0.01, 6), innerMat);
  group.add(inner);
  // Center glow dot
  const dotMat = mat.clone();
  dotMat.emissiveIntensity = (dotMat.emissiveIntensity || 0.5) * 3;
  group.add(new THREE.Mesh(new THREE.SphereGeometry(r * 0.18, 8, 6), dotMat).translateY(h / 2 + 0.01));
  // Edge ring
  const edgeMat = mat.clone();
  edgeMat.emissiveIntensity = (edgeMat.emissiveIntensity || 0.5) * 2;
  edgeMat.transparent = true; edgeMat.opacity = 0.5;
  const edge = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.06, 6, 6), edgeMat);
  edge.rotation.x = Math.PI / 2; edge.position.y = h / 2 + 0.005;
  group.add(edge);
  return group;
}

function energyModule(mat, r) {
  const group = new THREE.Group();
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(r * 0.6), mat);
  group.add(core);
  // Inner glow sphere
  const gMat = mat.clone();
  gMat.emissiveIntensity = (gMat.emissiveIntensity || 1) * 3;
  gMat.transparent = true; gMat.opacity = 0.5;
  group.add(new THREE.Mesh(new THREE.SphereGeometry(r * 0.3, 10, 8), gMat));
  // Primary ring
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.1, 8, 24), mat.clone());
  ring.material.transparent = true; ring.material.opacity = 0.6;
  ring.rotation.x = Math.PI / 2;
  group.add(ring);
  // Secondary ring (orthogonal)
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(r * 0.8, r * 0.06, 6, 18), mat.clone());
  ring2.material.transparent = true; ring2.material.opacity = 0.4;
  ring2.rotation.z = Math.PI / 2;
  group.add(ring2);
  // Mounting bracket (small arm)
  const bMat = new THREE.MeshStandardMaterial({ color: FRAME_C, metalness: 0.5, roughness: 0.5 });
  group.add(new THREE.Mesh(new THREE.BoxGeometry(0.03, r * 1.2, 0.03), bMat).translateX(-r * 0.9));
  return group;
}

function bladeFin(mat, h, w) {
  const group = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(0, h / 2);
  shape.lineTo(-w / 2, -h / 2);
  shape.lineTo(w / 2, -h / 2);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: false });
  group.add(new THREE.Mesh(geo, mat));
  // Edge glow trim
  const eMat = mat.clone();
  eMat.emissiveIntensity = (eMat.emissiveIntensity || 0.5) * 3;
  eMat.transparent = true; eMat.opacity = 0.6;
  const pts = [
    new THREE.Vector3(0, h / 2, 0.02),
    new THREE.Vector3(-w / 2, -h / 2, 0.02),
    new THREE.Vector3(w / 2, -h / 2, 0.02),
    new THREE.Vector3(0, h / 2, 0.02),
  ];
  const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
  group.add(new THREE.Line(lineGeo, new THREE.LineBasicMaterial({
    color: mat.emissive?.getHex?.() || 0xffffff,
    transparent: true, opacity: 0.6,
    blending: THREE.AdditiveBlending,
  })));
  // Mount base
  const bMat = new THREE.MeshStandardMaterial({ color: FRAME_C, metalness: 0.5, roughness: 0.5 });
  group.add(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 0.06, 6), bMat).translateY(-h / 2 - 0.03));
  return group;
}

function turretModule(mat, r) {
  const group = new THREE.Group();
  // Barrel
  const bMat = new THREE.MeshStandardMaterial({ color: FRAME_C, metalness: 0.6, roughness: 0.4 });
  group.add(new THREE.Mesh(new THREE.CylinderGeometry(r * 0.18, r * 0.22, r * 2.5, 8), bMat).rotateX(Math.PI / 2).translateY(r * 0.6));
  // Mount base
  group.add(new THREE.Mesh(new THREE.CylinderGeometry(r * 0.6, r * 0.7, r * 0.4, 8), mat));
  // Glow ring around base
  const gMat = mat.clone();
  gMat.emissiveIntensity = (gMat.emissiveIntensity || 0.5) * 2.5;
  gMat.transparent = true; gMat.opacity = 0.5;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 0.65, r * 0.06, 6, 16), gMat);
  ring.rotation.x = Math.PI / 2;
  group.add(ring);
  return group;
}

function sensorDome(mat, r) {
  const group = new THREE.Group();
  group.add(new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat));
  // Base ring
  const bMat = new THREE.MeshStandardMaterial({ color: FRAME_C, metalness: 0.5, roughness: 0.5 });
  group.add(new THREE.Mesh(new THREE.CylinderGeometry(r * 1.1, r * 1.1, r * 0.15, 10), bMat));
  // Antenna spike
  group.add(new THREE.Mesh(new THREE.ConeGeometry(r * 0.08, r * 1.2, 5), mat.clone()).translateY(r * 0.9));
  // Glow band
  const gMat = mat.clone();
  gMat.emissiveIntensity = (gMat.emissiveIntensity || 0.5) * 2.5;
  gMat.transparent = true; gMat.opacity = 0.5;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 0.7, r * 0.04, 6, 16), gMat);
  ring.rotation.x = Math.PI / 2; ring.position.y = r * 0.3;
  group.add(ring);
  return group;
}

const PRIMARY = {
  Security(mat, idx, count) {
    const cols = Math.ceil(count / 7);
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const mesh = (idx % 3 === 0) ? turretModule(mat, 0.15) : armorPlate(mat, 0.7, 0.3, 0.1);
    mesh.position.set(-0.35 * (cols - 1) / 2 + col * 0.42, 3.0 + row * 0.38, -0.88);
    return mesh;
  },
  Analytics(mat, idx, count) {
    const ring = Math.floor(idx / 8);
    const idxInRing = idx % 8;
    const ringCount = Math.min(count - ring * 8, 8);
    const angle = (idxInRing / ringCount) * Math.PI * 2;
    const r = 0.45 + ring * 0.28;
    const mesh = (idx % 4 === 0) ? sensorDome(mat, 0.12) : bladeFin(mat, 0.4, 0.15);
    mesh.position.set(Math.cos(angle) * r, 7.2 + ring * 0.38, Math.sin(angle) * r);
    mesh.rotation.y = -angle;
    return mesh;
  },
  Automation(mat, idx) {
    const row = idx % 6;
    const col = Math.floor(idx / 6);
    const mesh = hexPlate(mat, 0.2, 0.12);
    mesh.position.set(-2.1 - 0.18 - col * 0.48, 2.0 + row * 0.32, 0);
    mesh.rotation.z = Math.PI / 2;
    return mesh;
  },
  DevTools(mat, idx) {
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    const mesh = armorPlate(mat, 0.12, 0.4, 0.45);
    mesh.position.set(2.1 + 0.18 + col * 0.2, 2.2 + row * 0.48, 0);
    return mesh;
  },
  NFT(mat, idx) {
    const mesh = energyModule(mat, 0.22);
    const angle = (idx / 10) * Math.PI * 1.5 - 0.3;
    const r = 0.5 + idx * 0.09;
    mesh.position.set(2.0 + Math.cos(angle) * r, 5.5 + Math.sin(angle) * 0.3, -0.3 - idx * 0.13);
    return mesh;
  },
  Social(mat, idx) {
    const angle = (idx / 8) * Math.PI * 2;
    const mesh = (idx % 3 === 0) ? sensorDome(mat, 0.1) : hexPlate(mat, 0.15, 0.08);
    mesh.position.set(-2.1 + Math.cos(angle) * 0.32, 2.0, Math.sin(angle) * 0.32);
    mesh.rotation.x = Math.PI / 2;
    return mesh;
  },
  Storage(mat, idx) {
    const col = idx % 4;
    const row = Math.floor(idx / 4);
    const group = new THREE.Group();
    group.add(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.4, 8), mat));
    const gMat = mat.clone(); gMat.emissiveIntensity = (gMat.emissiveIntensity || 0.5) * 2;
    gMat.transparent = true; gMat.opacity = 0.5;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.02, 6, 12), gMat);
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.18;
    group.add(ring);
    group.position.set(-0.6 + col * 0.42, 3.0 + row * 0.48, -0.92);
    return group;
  },
  Productivity(mat, idx) {
    const ring = Math.floor(idx / 3);
    const triIdx = idx % 3;
    const offsets = [[0, 0.18, 0], [-0.16, -0.09, 0], [0.16, -0.09, 0]];
    const [ox, oy] = offsets[triIdx];
    const mesh = bladeFin(mat, 0.24, 0.2);
    mesh.position.set(ox, 4.5 + oy + ring * 0.48, 0.8 + ring * 0.12);
    return mesh;
  },
  Bridge(mat, idx) {
    const mesh = energyModule(mat, 0.2);
    mesh.position.set(-2.0 - idx * 0.14, 5.5 + idx * 0.32, -0.2);
    return mesh;
  },
  Trading(mat, idx) {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const mesh = armorPlate(mat, 0.4, 0.25, 0.06);
    mesh.position.set(-0.55 + col * 0.48, -0.6 + row * 0.32, 0.42);
    mesh.rotation.x = -0.2;
    return mesh;
  },
  Governance(mat, idx) {
    const mesh = armorPlate(mat, 0.45, 0.06, 0.04);
    mesh.position.set(0, 6.7 - idx * 0.12, 0.5);
    return mesh;
  },
  Wallet(mat, idx) {
    const angle = (idx / 6) * Math.PI * 2;
    const r = idx === 0 ? 0 : 0.28;
    const mesh = hexPlate(mat, 0.14, 0.1);
    mesh.position.set(Math.cos(angle) * r, 2.35, 0.55 + Math.sin(angle) * r);
    return mesh;
  },
  DeFi(mat, idx) {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const mesh = armorPlate(mat, 0.4, 0.25, 0.06);
    mesh.position.set(0.55 + col * 0.48, -0.6 + row * 0.32, 0.42);
    mesh.rotation.x = -0.2;
    return mesh;
  },
  Development(mat, idx) {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const mesh = armorPlate(mat, 0.14, 0.45, 0.5);
    mesh.position.set(2.1 + 0.18 + col * 0.2, 3.8 + row * 0.52, 0.2);
    return mesh;
  },
  Writing(mat, idx) {
    const angle = (idx / 6) * Math.PI * 2;
    const r = 0.32;
    const mesh = hexPlate(mat, 0.12, 0.06);
    mesh.position.set(2.1 + Math.cos(angle) * r, 2.0, 0.2 + Math.sin(angle) * r);
    mesh.rotation.x = Math.PI / 2;
    return mesh;
  },
  Communication(mat, idx) {
    const mesh = (idx === 0) ? sensorDome(mat, 0.15) : bladeFin(mat, 0.5 + idx * 0.1, 0.1);
    mesh.position.set(0, 7.5 + idx * 0.42, 0);
    return mesh;
  },
};

/* ══════════════════════════════════════════════════════════
   Overflow builder — energy module at orbital position
   ══════════════════════════════════════════════════════════ */
function buildOverflow(mat, overflowIdx, region) {
  const shapes = [energyModule, hexPlate, sensorDome];
  const pick = overflowIdx % shapes.length;
  let mesh;
  if (pick === 0) mesh = energyModule(mat, 0.12);
  else if (pick === 1) { mesh = hexPlate(mat, 0.1, 0.06); mesh.rotation.x = Math.PI / 2; }
  else mesh = sensorDome(mat, 0.08);
  const center = new THREE.Vector3(...region.center);
  const pos = overflowPosition(overflowIdx, center, region.overflowR, region.vSpread);
  mesh.position.copy(pos);
  return mesh;
}

/* ══════════════════════════════════════════════════════════
   Unified builder: dispatches to PRIMARY or overflow
   ══════════════════════════════════════════════════════════ */
function buildOne(cat, mat, idx, count) {
  const region = REGIONS[cat];
  if (!region) {
    return buildOverflow(mat, idx, REGIONS.Security);
  }
  const cap = region.primaryCap;
  if (idx < cap && PRIMARY[cat]) {
    return PRIMARY[cat](mat, idx, Math.min(count, cap));
  }
  return buildOverflow(mat, idx - cap, region);
}

/* ══════════════════════════════════════════════════════════
   Build all attachments from skill list
   ══════════════════════════════════════════════════════════ */
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
      const mat = matFor(cat);
      const built = buildOne(cat, mat, idx, catSkills.length);
      const group = new THREE.Group();

      group.userData = {
        skillSlug: skill.slug,
        skillName: skill.name,
        category: cat,
        description: skill.description,
        onchain: skill.onchain || !!skill.onchainTokenId,
        vettedOk: skill.vetted_ok || skill.vettedOk,
        risk_tier: skill.risk_tier || skill.riskTier,
        documentation_md: skill.documentation_md,
        fileName: skill.fileName,
        source: skill.source,
        categoryIndex: idx,
        isOverflow: idx >= (REGIONS[cat]?.primaryCap || 0),
      };

      if (built.isGroup) {
        built.children.forEach(c => group.add(c.clone()));
        group.position.copy(built.position);
      } else {
        group.add(built);
        if (built.position) {
          group.position.copy(built.position);
          built.position.set(0, 0, 0);
        }
      }

      parentGroup.add(group);
      attachments.push(group);
    });
  }

  return attachments;
}

/* ══════════════════════════════════════════════════════════
   Clear and rebuild — used after install/uninstall
   ══════════════════════════════════════════════════════════ */
export function clearAttachments(attachmentGroup, energyNetworkGroup) {
  while (attachmentGroup.children.length) {
    const child = attachmentGroup.children[0];
    child.traverse(c => {
      if (c.geometry) c.geometry.dispose();
      if (c.material) {
        if (Array.isArray(c.material)) c.material.forEach(m => m.dispose());
        else c.material.dispose();
      }
    });
    attachmentGroup.remove(child);
  }
  while (energyNetworkGroup.children.length) {
    const child = energyNetworkGroup.children[0];
    child.traverse(c => {
      if (c.geometry) c.geometry.dispose();
      if (c.material) c.material.dispose();
    });
    energyNetworkGroup.remove(child);
  }
}

/* ══════════════════════════════════════════════════════════
   Energy network — lines connecting same-category attachments
   ══════════════════════════════════════════════════════════ */
export function buildEnergyNetwork(attachments, parentGroup) {
  const byCategory = {};
  attachments.forEach(a => {
    const cat = a.userData.category;
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(a);
  });

  const corePos = new THREE.Vector3(0, 4.5, 0.7);

  for (const [cat, atts] of Object.entries(byCategory)) {
    const color = CATEGORY_COLORS_HEX[cat] || 0xcccccc;
    const mat = new THREE.LineBasicMaterial({
      color, transparent: true, opacity: 0.15,
      blending: THREE.AdditiveBlending,
    });

    const maxLines = Math.min(atts.length - 1, 60);
    for (let i = 0; i < maxLines; i++) {
      const geo = new THREE.BufferGeometry().setFromPoints([atts[i].position, atts[i + 1].position]);
      const line = new THREE.Line(geo, mat.clone());
      line.userData.category = cat;
      parentGroup.add(line);
    }

    if (atts.length > 0) {
      const hubMat = mat.clone();
      hubMat.opacity = 0.1;
      const geo = new THREE.BufferGeometry().setFromPoints([atts[0].position, corePos]);
      const line = new THREE.Line(geo, hubMat);
      line.userData.category = cat;
      parentGroup.add(line);
    }
  }
}

/* ══════════════════════════════════════════════════════════
   Idle animation factories (per-category)
   ══════════════════════════════════════════════════════════ */
const IDLE = {
  Security(att, time, idx) {
    att.traverse(c => {
      if (c.isMesh) c.material.emissiveIntensity = 0.6 + 1.0 * Math.max(0, Math.sin(time * 2 + idx * 0.4));
    });
  },
  Analytics(att, time, idx) {
    att.rotation.y += 0.003;
    att.traverse(c => {
      if (c.isMesh) c.material.emissiveIntensity = 0.8 + 0.6 * Math.sin(time * 3 + idx);
    });
  },
  Automation(att, time, idx) {
    att.traverse(c => {
      if (c.isMesh) c.material.emissiveIntensity = 0.6 + 0.8 * Math.max(0, Math.sin(time * 3 - idx * 1.2));
    });
  },
  DevTools(att, time) {
    att.traverse(c => {
      if (c.isMesh) c.material.emissiveIntensity = 0.8 + 0.6 * Math.sin(time * 4);
    });
  },
  NFT(att, time) {
    att.rotation.y += 0.008;
    att.traverse(c => {
      if (c.isMesh) c.material.emissiveIntensity = 1.0 + 0.8 * Math.sin(time * 1.5);
    });
  },
  Social(att, time) {
    att.rotation.y += 0.01;
    att.traverse(c => {
      if (c.isMesh) c.material.emissiveIntensity = 0.8 + 0.4 * Math.sin(time * 2);
    });
  },
  Storage(att, time) {
    att.traverse(c => {
      if (c.isMesh) c.material.emissiveIntensity = 0.5 + 0.5 * Math.sin(time * 1.2);
    });
  },
  Productivity(att, time) {
    att.rotation.z += 0.005;
    att.traverse(c => {
      if (c.isMesh) c.material.emissiveIntensity = 0.6 + 0.4 * Math.sin(time * 2.5);
    });
  },
  Bridge(att, time) {
    att.rotation.y += 0.006;
    att.traverse(c => {
      if (c.isMesh) c.material.emissiveIntensity = 0.8 + 0.5 * Math.sin(time * 2.5);
    });
  },
  Trading(att, time) {
    att.traverse(c => {
      if (c.isMesh) c.material.emissiveIntensity = 0.6 + 1.0 * (Math.random() > 0.9 ? 1 : 0.2);
    });
  },
  Governance(att, time) {
    att.traverse(c => {
      if (c.isMesh) c.material.emissiveIntensity = 0.8 + 0.4 * Math.sin(time * 1.5);
    });
  },
  Wallet(att, time) {
    att.traverse(c => {
      if (c.isMesh) c.material.emissiveIntensity = 0.5 + 0.7 * (0.5 + 0.5 * Math.sin(time * 4.2));
    });
  },
  DeFi(att, time) {
    att.traverse(c => {
      if (c.isMesh) c.material.emissiveIntensity = 0.6 + 0.5 * Math.sin(time * 2);
    });
  },
  Development(att, time) {
    att.traverse(c => {
      if (c.isMesh) c.material.emissiveIntensity = 0.8 + 0.6 * Math.sin(time * 3);
    });
  },
  Writing(att, time) {
    att.traverse(c => {
      if (c.isMesh) c.material.emissiveIntensity = 0.5 + 0.3 * Math.sin(time * 1.8);
    });
  },
  Communication(att, time) {
    att.traverse(c => {
      if (c.isMesh) c.material.emissiveIntensity = 0.8 + 0.7 * Math.abs(Math.sin(time * 3));
    });
  },
};

function overflowIdle(att, time, idx) {
  att.rotation.y += 0.004;
  att.traverse(c => {
    if (c.isMesh) c.material.emissiveIntensity = 0.6 + 0.6 * Math.sin(time * 1.5 + idx * 0.3);
  });
}

export function makeIdleAnimator(attachments) {
  return function idleAnimator(time) {
    for (const att of attachments) {
      const cat = att.userData.category;
      if (att.userData.isOverflow) {
        overflowIdle(att, time, att.userData.categoryIndex);
      } else {
        const fn = IDLE[cat];
        if (fn) fn(att, time, att.userData.categoryIndex);
      }
    }
  };
}
