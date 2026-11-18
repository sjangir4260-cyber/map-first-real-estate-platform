import * as THREE from 'three';
import type { AvailabilityStatus, Plot } from '../types/realestate';
import { createSignPlateTexture } from './parcelTextures';

export interface PlotMeshEntry {
  plot: Plot;
  status: AvailabilityStatus;
  group: THREE.Group;
  capGroup: THREE.Group;
  hitMesh: THREE.Mesh;
  slabMaterial: THREE.MeshStandardMaterial;
  curbMaterial: THREE.MeshStandardMaterial;
  baseCenter: THREE.Vector3;
  baseColorHex: number;
  currentLift: number;
  currentCapLift: number;
  currentScale: number;
}

const STATUS_HEX: Record<AvailabilityStatus, number> = {
  'For Sale': 0xdc2626,
  Reserved: 0xd97706,
  Sold: 0x64748b,
  Unverified: 0xa8a29e,
};

const METERS_PER_DEG_LAT = 111320;

export function computeLocalProjection(plots: Plot[]): {
  originLat: number;
  originLng: number;
  metersPerDegLng: number;
  scaleToScene: number;
} {
  if (plots.length === 0) {
    return {
      originLat: 26.9124,
      originLng: 75.7445,
      metersPerDegLng: 99300,
      scaleToScene: 0.25,
    };
  }

  const allPts = plots.flatMap((p) => p.coordinates);
  const originLat = allPts.reduce((acc, p) => acc + p[0], 0) / allPts.length;
  const originLng = allPts.reduce((acc, p) => acc + p[1], 0) / allPts.length;
  const metersPerDegLng = METERS_PER_DEG_LAT * Math.cos((originLat * Math.PI) / 180);

  // Measure span in meters to keep scene comfortably ~45–65 units wide
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  allPts.forEach(([lat, lng]) => {
    const x = (lng - originLng) * metersPerDegLng;
    const z = -(lat - originLat) * METERS_PER_DEG_LAT;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  });

  const maxSpan = Math.max(maxX - minX, maxZ - minZ, 60);
  const scaleToScene = maxSpan > 400 ? 48 / maxSpan : 0.22;

  return { originLat, originLng, metersPerDegLng, scaleToScene };
}

export function projectCoord(
  lat: number,
  lng: number,
  proj: ReturnType<typeof computeLocalProjection>
): [number, number] {
  const x = (lng - proj.originLng) * proj.metersPerDegLng * proj.scaleToScene;
  const z = -(lat - proj.originLat) * METERS_PER_DEG_LAT * proj.scaleToScene;
  return [x, z];
}

export function buildCompositePlotGroup(params: {
  plot: Plot;
  status: AvailabilityStatus;
  priceLabel: string;
  proj: ReturnType<typeof computeLocalProjection>;
  roughnessTex: THREE.CanvasTexture;
  contactShadowTex: THREE.CanvasTexture;
  maxAnisotropy: number;
  castShadows: boolean;
}): PlotMeshEntry {
  const {
    plot,
    status,
    priceLabel,
    proj,
    roughnessTex,
    contactShadowTex,
    maxAnisotropy,
    castShadows,
  } = params;

  const localPts = plot.coordinates.map(([lat, lng]) => projectCoord(lat, lng, proj));
  const cx = localPts.reduce((s, p) => s + p[0], 0) / localPts.length;
  const cz = localPts.reduce((s, p) => s + p[1], 0) / localPts.length;

  // Center shape around (0, 0) so bottom-center pivot sits cleanly on ground y = 0
  const centeredPts = localPts.map(([x, z]) => [x - cx, z - cz] as [number, number]);

  // Shape is drawn in XY, then rotated -Math.PI/2 around X so extrusion rises along +Y
  const shape = new THREE.Shape();
  centeredPts.forEach(([x, z], idx) => {
    const sy = -z;
    if (idx === 0) shape.moveTo(x, sy);
    else shape.lineTo(x, sy);
  });
  shape.closePath();

  const group = new THREE.Group();
  group.position.set(cx, 0, cz);

  const capGroup = new THREE.Group();
  group.add(capGroup);

  const slabHeight = status === 'For Sale' ? 0.65 : status === 'Reserved' ? 0.52 : 0.42;
  const baseColorHex = STATUS_HEX[status];

  // 1. Primary Silhouette: Beveled extruded parcel slab
  const slabGeo = new THREE.ExtrudeGeometry(shape, {
    depth: slabHeight,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.08,
    bevelSegments: 2,
  });
  slabGeo.rotateX(-Math.PI / 2);

  const slabMaterial = new THREE.MeshStandardMaterial({
    color: baseColorHex,
    roughness: 0.58,
    roughnessMap: roughnessTex,
    metalness: 0.08,
  });

  const slabMesh = new THREE.Mesh(slabGeo, slabMaterial);
  slabMesh.position.y = 0.08;
  slabMesh.castShadow = castShadows;
  slabMesh.receiveShadow = true;
  slabMesh.userData.plotId = plot.plot_id;
  group.add(slabMesh);

  // 2. Secondary Architectural Curb Base (distinct stone roughness)
  const curbGeo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.14,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.16,
    bevelSegments: 1,
  });
  curbGeo.rotateX(-Math.PI / 2);

  const curbMaterial = new THREE.MeshStandardMaterial({
    color: 0xdbe2ea,
    roughness: 0.88,
    metalness: 0.04,
  });

  const curbMesh = new THREE.Mesh(curbGeo, curbMaterial);
  curbMesh.position.y = 0.02;
  curbMesh.receiveShadow = true;
  group.add(curbMesh);

  // 3-6. Corner Survey Bollards (post + metallic survey cap) inside capGroup
  const postGeo = new THREE.CylinderGeometry(0.11, 0.14, 0.55, 10);
  const postMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.72,
    metalness: 0.15,
  });
  const capGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.1, 12);
  const capMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.2,
    metalness: 0.85,
  });

  centeredPts.forEach(([x, z]) => {
    const post = new THREE.Mesh(postGeo, postMat);
    post.position.set(x * 0.9, slabHeight + 0.3, z * 0.9);
    post.castShadow = castShadows;
    capGroup.add(post);

    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.set(x * 0.9, slabHeight + 0.62, z * 0.9);
    capGroup.add(cap);
  });

  // 7-9. Architectural Status Detail (Signpost beacon or Sold massing)
  if (status === 'For Sale' || status === 'Reserved') {
    const plinth = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.42, 0.18, 12),
      curbMaterial
    );
    plinth.position.set(0, slabHeight + 0.16, 0);
    capGroup.add(plinth);

    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.07, 1.85, 10),
      new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        roughness: 0.18,
        metalness: 0.92,
      })
    );
    mast.position.set(0, slabHeight + 1.08, 0);
    mast.castShadow = castShadows;
    capGroup.add(mast);

    const signTex = createSignPlateTexture(plot.plot_id, status, priceLabel, maxAnisotropy);
    const signFrame = new THREE.Mesh(
      new THREE.BoxGeometry(2.3, 1.15, 0.14),
      new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        roughness: 0.35,
        metalness: 0.6,
      })
    );
    signFrame.position.set(0, slabHeight + 2.15, 0);
    signFrame.castShadow = castShadows;
    capGroup.add(signFrame);

    const signFaceMat = new THREE.MeshStandardMaterial({
      map: signTex,
      roughness: 0.38,
      metalness: 0.05,
    });
    const signFace = new THREE.Mesh(new THREE.PlaneGeometry(2.16, 1.02), signFaceMat);
    signFace.position.set(0, slabHeight + 2.15, 0.08);
    capGroup.add(signFace);

    const signFaceBack = new THREE.Mesh(new THREE.PlaneGeometry(2.16, 1.02), signFaceMat);
    signFaceBack.rotation.y = Math.PI;
    signFaceBack.position.set(0, slabHeight + 2.15, -0.08);
    capGroup.add(signFaceBack);
  } else if (status === 'Sold') {
    // Low architectural residence massing (foundation + volume + cantilevered roof)
    const houseMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.7,
      metalness: 0.05,
    });
    const roofMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.42,
      metalness: 0.35,
    });

    const foundation = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.24, 2.2), curbMaterial);
    foundation.position.set(0, slabHeight + 0.18, 0);
    capGroup.add(foundation);

    const body = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.95, 1.85), houseMat);
    body.position.set(0, slabHeight + 0.72, 0);
    body.castShadow = castShadows;
    capGroup.add(body);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(2.65, 0.16, 2.15), roofMat);
    roof.position.set(0, slabHeight + 1.25, 0);
    roof.castShadow = castShadows;
    capGroup.add(roof);
  }

  // 10. Soft Radial Contact Shadow Plane
  let maxRadius = 2;
  centeredPts.forEach(([x, z]) => {
    const r = Math.hypot(x, z);
    if (r > maxRadius) maxRadius = r;
  });
  const shadowGeo = new THREE.PlaneGeometry(maxRadius * 2.5, maxRadius * 2.5);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: contactShadowTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.5,
  });
  const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
  contactShadow.position.y = 0.012;
  group.add(contactShadow);

  // Invisible simplified raycast hit mesh on layer 1
  const hitMesh = slabMesh;
  hitMesh.layers.enable(1);

  return {
    plot,
    status,
    group,
    capGroup,
    hitMesh,
    slabMaterial,
    curbMaterial,
    baseCenter: new THREE.Vector3(cx, 0, cz),
    baseColorHex,
    currentLift: 0,
    currentCapLift: 0,
    currentScale: 1,
  };
}

export function buildInstancedTrees(
  scene: THREE.Scene,
  occupiedCenters: THREE.Vector3[],
  castShadows: boolean
): () => void {
  const treeCount = 44;
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.24, 1.2, 7);
  trunkGeo.translate(0, 0.6, 0);
  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x6b4f3a,
    roughness: 0.9,
    metalness: 0.02,
  });

  const canopyGeo = new THREE.DodecahedronGeometry(0.95, 1);
  canopyGeo.translate(0, 1.75, 0);
  const canopyMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.82,
    metalness: 0.02,
  });

  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
  const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, treeCount);
  trunks.castShadow = castShadows;
  canopies.castShadow = castShadows;
  canopies.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();
  let placed = 0;
  let attempts = 0;

  while (placed < treeCount && attempts < 500) {
    attempts += 1;
    const angle = (attempts * 2.39996) % (Math.PI * 2);
    const radius = 14 + (attempts % 18) * 1.9;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;

    const tooClose = occupiedCenters.some(
      (c) => Math.hypot(c.x - x, c.z - z) < 5.2
    );
    if (tooClose) continue;

    const scale = 0.85 + ((placed * 7) % 10) * 0.03; // ±15%
    dummy.position.set(x, 0, z);
    dummy.rotation.y = angle;
    dummy.scale.set(scale, scale, scale);
    dummy.updateMatrix();

    trunks.setMatrixAt(placed, dummy.matrix);
    canopies.setMatrixAt(placed, dummy.matrix);

    const greenHue = 0.29 + ((placed % 5) - 2) * 0.015;
    tint.setHSL(greenHue, 0.42, 0.36 + (placed % 4) * 0.03);
    canopies.setColorAt(placed, tint);

    placed += 1;
  }

  trunks.count = placed;
  canopies.count = placed;
  trunks.instanceMatrix.needsUpdate = true;
  canopies.instanceMatrix.needsUpdate = true;
  if (canopies.instanceColor) canopies.instanceColor.needsUpdate = true;

  trunks.computeBoundingSphere();
  canopies.computeBoundingSphere();

  scene.add(trunks);
  scene.add(canopies);

  return () => {
    scene.remove(trunks);
    scene.remove(canopies);
    trunkGeo.dispose();
    trunkMat.dispose();
    canopyGeo.dispose();
    canopyMat.dispose();
  };
}
