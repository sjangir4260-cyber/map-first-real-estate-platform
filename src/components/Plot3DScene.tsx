import { ChevronDown, ChevronUp, RotateCw, Sun, Sunset } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  buildCompositePlotGroup,
  buildInstancedTrees,
  computeLocalProjection,
  type PlotMeshEntry,
} from '../three/parcelGeometry';
import {
  createContactShadowTexture,
  createParcelRoughnessTexture,
  createTerrainTexture,
} from '../three/parcelTextures';
import {
  Listing,
  Plot,
  STATUS_MAP_STYLE,
  computeEstimatedTotalInr,
  derivePlotStatus,
  formatInr,
} from '../types/realestate';

interface Plot3DSceneProps {
  plots: Plot[];
  listings: Listing[];
  selectedPlotId: string | null;
  hoveredPlotId: string | null;
  activeLocality: string;
  onSelectPlot: (plotId: string) => void;
  onHoverPlot: (plotId: string | null) => void;
}

type CameraPreset = 'isometric' | 'street' | 'top';
type LightingMood = 'daylight' | 'golden';

// Pre-allocated scratch helpers outside animation loop (zero GC)
const _raycaster = new THREE.Raycaster();
const _pointer = new THREE.Vector2();
const _desiredCamPos = new THREE.Vector3();
const _desiredTarget = new THREE.Vector3();

const CAMERA_PRESETS: Record<CameraPreset, { pos: [number, number, number]; target: [number, number, number] }> = {
  isometric: { pos: [26, 22, 28], target: [0, 0.4, 0] },
  street: { pos: [14, 5.2, 21], target: [0, 1.2, 0] },
  top: { pos: [0.01, 44, 0.01], target: [0, 0, 0] },
};

export function Plot3DScene({
  plots,
  listings,
  selectedPlotId,
  hoveredPlotId,
  activeLocality,
  onSelectPlot,
  onHoverPlot,
}: Plot3DSceneProps) {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('isometric');
  const [lightingMood, setLightingMood] = useState<LightingMood>('daylight');
  const [liftPercent, setLiftPercent] = useState(35);
  const [autoOrbit, setAutoOrbit] = useState(true);
  const [webglError, setWebglError] = useState(false);

  // Refs synced to Three.js render loop without tearing down canvas
  const selectedIdRef = useRef(selectedPlotId);
  const hoveredIdRef = useRef(hoveredPlotId);
  const liftRef = useRef(liftPercent / 100);
  const autoOrbitRef = useRef(autoOrbit);
  const lightingMoodRef = useRef(lightingMood);
  const onSelectPlotRef = useRef(onSelectPlot);
  const onHoverPlotRef = useRef(onHoverPlot);
  const cameraFlightRef = useRef<{
    active: boolean;
    pos: THREE.Vector3;
    target: THREE.Vector3;
  }>({
    active: false,
    pos: new THREE.Vector3(...CAMERA_PRESETS.isometric.pos),
    target: new THREE.Vector3(...CAMERA_PRESETS.isometric.target),
  });

  selectedIdRef.current = selectedPlotId;
  hoveredIdRef.current = hoveredPlotId;
  liftRef.current = liftPercent / 100;
  autoOrbitRef.current = autoOrbit;
  lightingMoodRef.current = lightingMood;
  onSelectPlotRef.current = onSelectPlot;
  onHoverPlotRef.current = onHoverPlot;

  // Scene object refs for dynamic updates
  const sceneObjectsRef = useRef<{
    scene: THREE.Scene;
    renderer: THREE.WebGLRenderer;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    plotsGroup: THREE.Group;
    entries: PlotMeshEntry[];
    cleanupTrees: (() => void) | null;
    roughnessTex: THREE.CanvasTexture;
    contactShadowTex: THREE.CanvasTexture;
    sunLight: THREE.DirectionalLight;
    hemiLight: THREE.HemisphereLight;
    isSoftwareGl: boolean;
  } | null>(null);

  // Keyboard shortcut 'H' to collapse/expand bottom control dock
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.key.toLowerCase() === 'h' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        setDockCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Initialize Three.js WebGL scene once
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const isSoftwareGl = (() => {
      try {
        const probe = document.createElement('canvas').getContext('webgl2');
        if (!probe) return true;
        const ext = probe.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
        const gpu = String(probe.getParameter(param));
        probe.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglError(true);
      return;
    }

    const width = mount.clientWidth || 800;
    const height = mount.clientHeight || 520;
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const canvas = renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    mount.appendChild(canvas);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setWebglError(true);
    };
    const onContextRestored = () => {
      setWebglError(false);
    };
    canvas.addEventListener('webglcontextlost', onContextLost);
    canvas.addEventListener('webglcontextrestored', onContextRestored);

    const scene = new THREE.Scene();
    const horizonHex = 0xe2e8f0;
    scene.background = new THREE.Color(horizonHex);
    scene.fog = new THREE.FogExp2(horizonHex, 0.0085);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(44, width / height, 0.2, 260);
    camera.position.set(...CAMERA_PRESETS.isometric.pos);

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI * 0.46;
    controls.minPolarAngle = 0.12;
    controls.minDistance = 8;
    controls.maxDistance = 85;
    controls.target.set(...CAMERA_PRESETS.isometric.target);

    // Cancel scripted camera fly-to when user grabs controls
    const onControlsStart = () => {
      cameraFlightRef.current.active = false;
    };
    controls.addEventListener('start', onControlsStart);

    // Studio & Daylight Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x94a3b8, 0.85);
    hemiLight.position.set(0, 40, 0);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfff4e0, 1.85);
    sunLight.position.set(24, 34, 18);
    sunLight.castShadow = !isSoftwareGl;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 2;
    sunLight.shadow.camera.far = 95;
    const d = 38;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = 0.02;
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0xbae6fd, 0.45);
    rimLight.position.set(-22, 16, -24);
    scene.add(rimLight);

    // Procedural Textures & Extended Ground Horizon
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const terrainTex = createTerrainTexture(maxAniso);
    const roughnessTex = createParcelRoughnessTexture(maxAniso);
    const contactShadowTex = createContactShadowTexture();

    const groundGeo = new THREE.PlaneGeometry(260, 260);
    groundGeo.rotateX(-Math.PI / 2);
    const groundMat = new THREE.MeshStandardMaterial({
      map: terrainTex,
      roughness: 0.92,
      metalness: 0.02,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.receiveShadow = true;
    scene.add(ground);

    // Architectural sector road ribbons (offset >= 0.02 on Y to prevent Z-fighting)
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      roughness: 0.85,
      metalness: 0.04,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const roadH = new THREE.Mesh(new THREE.PlaneGeometry(140, 2.4), roadMat);
    roadH.rotation.x = -Math.PI / 2;
    roadH.position.y = 0.022;
    roadH.receiveShadow = true;
    scene.add(roadH);

    const roadV = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 140), roadMat);
    roadV.rotation.x = -Math.PI / 2;
    roadV.position.y = 0.024;
    roadV.receiveShadow = true;
    scene.add(roadV);

    const plotsGroup = new THREE.Group();
    scene.add(plotsGroup);

    sceneObjectsRef.current = {
      scene,
      renderer,
      camera,
      controls,
      plotsGroup,
      entries: [],
      cleanupTrees: null,
      roughnessTex,
      contactShadowTex,
      sunLight,
      hemiLight,
      isSoftwareGl,
    };

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Raycast interaction on canvas
    _raycaster.layers.set(1);
    let lastHoverCheck = 0;
    let pointerDownPos = { x: 0, y: 0 };

    const updatePointer = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      _pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      _pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const pickPlotId = (): string | null => {
      const ctx = sceneObjectsRef.current;
      if (!ctx || ctx.entries.length === 0) return null;
      _raycaster.setFromCamera(_pointer, camera);
      const hitTargets = ctx.entries.map((item) => item.hitMesh);
      const hits = _raycaster.intersectObjects(hitTargets, false);
      if (hits.length > 0) {
        return (hits[0].object.userData.plotId as string) || null;
      }
      return null;
    };

    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e: PointerEvent) => {
      const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (dist > 6) return; // Ignore orbit drags
      updatePointer(e);
      const hitId = pickPlotId();
      if (hitId) {
        onSelectPlotRef.current(hitId);
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastHoverCheck < 45) return;
      lastHoverCheck = now;
      updatePointer(e);
      const hitId = pickPlotId();
      canvas.style.cursor = hitId ? 'pointer' : 'grab';
      if (hitId !== hoveredIdRef.current) {
        onHoverPlotRef.current(hitId);
      }
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointermove', onPointerMove);

    // Responsive ResizeObserver
    const resizeObserver = new ResizeObserver(() => {
      if (!mount) return;
      const w = mount.clientWidth || 800;
      const h = mount.clientHeight || 520;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(mount);

    // Animation loop with exponential damping & software-WebGL pacing
    let frameId = 0;
    let disposed = false;
    const clock = new THREE.Clock();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (gl && typeof gl.fenceSync === 'function') {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (disposed) return;
          const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
          if (state === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      } else {
        frameId = window.setTimeout(cb, 80);
      }
    }

    function tick() {
      if (disposed) return;
      const dt = Math.min(clock.getDelta(), 0.08);
      const elapsed = clock.getElapsedTime();
      const ctx = sceneObjectsRef.current;

      if (ctx) {
        // Lighting mood damping
        const isGolden = lightingMoodRef.current === 'golden';
        const targetSunColor = isGolden ? 0xfdba74 : 0xfff4e0;
        const targetBg = isGolden ? 0xf1e7da : 0xe2e8f0;
        sunLight.color.lerp(new THREE.Color(targetSunColor), 1 - Math.exp(-4 * dt));
        sunLight.intensity = THREE.MathUtils.damp(
          sunLight.intensity,
          isGolden ? 2.1 : 1.85,
          4,
          dt
        );
        if (scene.background instanceof THREE.Color) {
          scene.background.lerp(new THREE.Color(targetBg), 1 - Math.exp(-4 * dt));
        }
        if (scene.fog instanceof THREE.FogExp2) {
          scene.fog.color.lerp(new THREE.Color(targetBg), 1 - Math.exp(-4 * dt));
        }

        // Gentle auto-orbit motion when enabled and not flying to a preset
        controls.autoRotate =
          !isSoftwareGl && autoOrbitRef.current && !cameraFlightRef.current.active;
        controls.autoRotateSpeed = 0.65;

        // Damped camera preset/selection transition
        if (cameraFlightRef.current.active) {
          const factor = 1 - Math.exp(-5.5 * dt);
          camera.position.lerp(cameraFlightRef.current.pos, factor);
          controls.target.lerp(cameraFlightRef.current.target, factor);
          if (
            camera.position.distanceTo(cameraFlightRef.current.pos) < 0.08 &&
            controls.target.distanceTo(cameraFlightRef.current.target) < 0.08
          ) {
            cameraFlightRef.current.active = false;
          }
        }

        controls.update();

        // Smooth 3D Motion of every plot parcel (selection lift, hover lift, explode layer)
        const liftScale = liftRef.current;
        for (let i = 0; i < ctx.entries.length; i += 1) {
          const entry = ctx.entries[i];
          const isSelected = entry.plot.plot_id === selectedIdRef.current;
          const isHovered = entry.plot.plot_id === hoveredIdRef.current;

          const baseForSaleBoost =
            entry.status === 'For Sale'
              ? liftScale * 0.9 + Math.sin(elapsed * 1.8 + i * 0.7) * 0.06 * liftScale
              : entry.status === 'Reserved'
                ? liftScale * 0.35
                : 0;

          const targetLift =
            (isSelected ? 1.15 : isHovered ? 0.42 : 0) + baseForSaleBoost;
          const targetCapLift = liftScale * 1.15 + (isSelected ? 0.45 : 0);
          const targetScale = isSelected ? 1.04 : isHovered ? 1.02 : 1.0;

          entry.currentLift = THREE.MathUtils.damp(entry.currentLift, targetLift, 7.5, dt);
          entry.currentCapLift = THREE.MathUtils.damp(
            entry.currentCapLift,
            targetCapLift,
            7.5,
            dt
          );
          entry.currentScale = THREE.MathUtils.damp(entry.currentScale, targetScale, 8, dt);

          entry.group.position.y = entry.currentLift;
          entry.group.scale.setScalar(entry.currentScale);
          entry.capGroup.position.y = entry.currentCapLift;

          // Subtle emissive highlight on selected / hovered slab
          const targetEmissive = isSelected ? 0.24 : isHovered ? 0.14 : 0.0;
          entry.slabMaterial.emissive.setHex(entry.baseColorHex);
          entry.slabMaterial.emissiveIntensity = THREE.MathUtils.damp(
            entry.slabMaterial.emissiveIntensity,
            targetEmissive,
            8,
            dt
          );
        }
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      controls.removeEventListener('start', onControlsStart);
      controls.dispose();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);

      groundGeo.dispose();
      groundMat.dispose();
      roadMat.dispose();
      terrainTex.dispose();
      roughnessTex.dispose();
      contactShadowTex.dispose();
      envTex.dispose();
      renderer.dispose();
      if (canvas.parentNode === mount) {
        mount.removeChild(canvas);
      }
      sceneObjectsRef.current = null;
    };
  }, []);

  // Rebuild 3D plot assemblies whenever filtered plots or listings change
  useEffect(() => {
    const ctx = sceneObjectsRef.current;
    if (!ctx) return;

    // Dispose previous plot geometries/materials
    ctx.entries.forEach((entry) => {
      entry.group.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
      ctx.plotsGroup.remove(entry.group);
    });
    ctx.entries = [];

    if (ctx.cleanupTrees) {
      ctx.cleanupTrees();
      ctx.cleanupTrees = null;
    }

    const proj = computeLocalProjection(plots);
    const maxAniso = ctx.renderer.capabilities.getMaxAnisotropy();

    const newEntries: PlotMeshEntry[] = plots.map((plot) => {
      const status = derivePlotStatus(plot.plot_id, listings);
      const plotListings = listings.filter(
        (l) => l.plot_id === plot.plot_id && l.approval_status === 'Approved'
      );
      const minTotal =
        plotListings.length > 0
          ? Math.min(...plotListings.map((l) => computeEstimatedTotalInr(l, plot.area_sqyd)))
          : null;
      const priceLabel = minTotal !== null ? formatInr(minTotal) : `${plot.area_sqyd} sq.yd`;

      const entry = buildCompositePlotGroup({
        plot,
        status,
        priceLabel,
        proj,
        roughnessTex: ctx.roughnessTex,
        contactShadowTex: ctx.contactShadowTex,
        maxAnisotropy: maxAniso,
        castShadows: !ctx.isSoftwareGl,
      });

      ctx.plotsGroup.add(entry.group);
      return entry;
    });

    ctx.entries = newEntries;
    ctx.cleanupTrees = buildInstancedTrees(
      ctx.scene,
      newEntries.map((e) => e.baseCenter),
      !ctx.isSoftwareGl
    );
  }, [plots, listings]);

  // Smoothly focus camera when a plot is selected or camera preset changes
  useEffect(() => {
    const ctx = sceneObjectsRef.current;
    if (!ctx) return;

    if (selectedPlotId) {
      const entry = ctx.entries.find((e) => e.plot.plot_id === selectedPlotId);
      if (entry) {
        _desiredTarget.copy(entry.baseCenter).setY(0.8);
        const offset = CAMERA_PRESETS[cameraPreset].pos;
        _desiredCamPos.set(
          entry.baseCenter.x + offset[0] * 0.55,
          Math.max(offset[1] * 0.6, 8),
          entry.baseCenter.z + offset[2] * 0.55
        );
        cameraFlightRef.current.target.copy(_desiredTarget);
        cameraFlightRef.current.pos.copy(_desiredCamPos);
        cameraFlightRef.current.active = true;
        return;
      }
    }

    const preset = CAMERA_PRESETS[cameraPreset];
    cameraFlightRef.current.pos.set(...preset.pos);
    cameraFlightRef.current.target.set(...preset.target);
    cameraFlightRef.current.active = true;
  }, [selectedPlotId, cameraPreset, activeLocality]);

  const selectedPlot = plots.find((p) => p.plot_id === selectedPlotId) ?? null;
  const selectedStatus = selectedPlot ? derivePlotStatus(selectedPlot.plot_id, listings) : null;

  if (webglError) {
    return (
      <div className="flex h-full min-h-[460px] flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-100 p-8 text-center">
        <p className="text-sm font-semibold text-slate-900">
          3D WebGL viewport unavailable in this browser session
        </p>
        <p className="mt-1 text-xs text-slate-600">
          Switch back to the 2D Map toggle above to inspect all plot polygons interactively.
        </p>
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-[480px] w-full overflow-hidden rounded-xl border border-slate-200 bg-[#E2E8F0]">
      {/* Dedicated WebGL Canvas Container outside React HUD overlays */}
      <div ref={canvasMountRef} className="h-full w-full" />

      {/* Top-left Minimal Spec Header (solid/rgba surface, no backdrop-filter over WebGL) */}
      <div
        className="pointer-events-none absolute top-3.5 left-3.5 z-10 rounded-lg border border-slate-700/60 px-3.5 py-2 text-xs text-slate-100"
        style={{ backgroundColor: 'rgba(15, 23, 42, 0.9)' }}
      >
        <div className="font-semibold tracking-tight text-white">
          3D Parcel Terrain · {activeLocality === 'All' ? 'All Localities' : activeLocality}
        </div>
        <div className="mt-0.5 font-mono text-[11px] text-slate-300 tabular-nums">
          {plots.length} parcels · Drag to orbit · Scroll to zoom · Click plot to inspect
        </div>
      </div>

      {/* Selected Plot Quick Floating Spec (only when user picks a plot in 3D) */}
      <AnimatePresence>
        {selectedPlot && selectedStatus && (
          <motion.div
            key={selectedPlot.plot_id}
            initial={{ opacity: 0, y: -10, rotateX: 12 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: 'spring', stiffness: 320, damping: 24 }}
            style={{
              backgroundColor: 'rgba(15, 23, 42, 0.94)',
              transformPerspective: 900,
            }}
            className="absolute top-3.5 right-3.5 z-10 max-w-[260px] rounded-lg border border-slate-700/80 px-3.5 py-2.5 text-xs text-white shadow-lg"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono font-semibold text-slate-200">
                {selectedPlot.plot_id}
              </span>
              <span className={`font-semibold ${STATUS_MAP_STYLE[selectedStatus].textClass === 'text-red-700' ? 'text-red-400' : 'text-amber-300'}`}>
                {selectedStatus}
              </span>
            </div>
            <div className="mt-1 font-semibold text-white">{selectedPlot.plot_number}</div>
            <div className="mt-0.5 font-mono text-[11px] text-slate-300 tabular-nums">
              {selectedPlot.area_sqyd} sq.yd · {selectedPlot.dimensions}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collapsible Bottom Control Dock (100% unobstructed center viewport, no backdrop-filter) */}
      <div className="pointer-events-none absolute right-0 bottom-4 left-0 z-20 flex flex-col items-center px-3">
        <button
          type="button"
          onClick={() => setDockCollapsed((v) => !v)}
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.92)' }}
          className="pointer-events-auto mb-1.5 inline-flex items-center gap-1.5 rounded-md border border-slate-700/80 px-3 py-1 text-[11px] font-medium text-slate-200 transition-colors hover:text-white"
        >
          {dockCollapsed ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              <span>Show 3D Controls (H)</span>
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" />
              <span>Hide Controls (H)</span>
            </>
          )}
        </button>

        <AnimatePresence initial={false}>
          {!dockCollapsed && (
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 18 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              style={{ backgroundColor: 'rgba(15, 23, 42, 0.94)' }}
              className="pointer-events-auto flex w-full max-w-[780px] flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-700/80 px-4 py-2.5 text-xs text-slate-200 shadow-xl"
            >
              {/* Camera Presets */}
              <div className="flex items-center gap-1 rounded-lg bg-slate-800/90 p-1">
                {(
                  [
                    { id: 'isometric', label: 'Aerial' },
                    { id: 'street', label: 'Street' },
                    { id: 'top', label: 'Plan' },
                  ] as const
                ).map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setCameraPreset(preset.id)}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors whitespace-nowrap ${
                      cameraPreset === preset.id
                        ? 'bg-red-600 text-white'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* 3D Motion Lift / Explode Slider */}
              <label className="flex items-center gap-2.5">
                <span className="text-[11px] font-medium text-slate-300 whitespace-nowrap">
                  3D Parcel Lift
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={liftPercent}
                  onChange={(e) => setLiftPercent(Number(e.target.value))}
                  className="h-1.5 w-24 cursor-pointer accent-red-500"
                />
                <span className="w-8 font-mono text-[11px] text-slate-300 tabular-nums">
                  {liftPercent}%
                </span>
              </label>

              {/* Auto-Orbit Motion + Lighting Mood */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAutoOrbit((v) => !v)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors whitespace-nowrap ${
                    autoOrbit
                      ? 'border-red-500/60 bg-red-600/20 text-red-200'
                      : 'border-slate-700 bg-slate-800 text-slate-300 hover:text-white'
                  }`}
                >
                  <RotateCw className="h-3 w-3" />
                  <span>{autoOrbit ? 'Orbit On' : 'Orbit Off'}</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setLightingMood((m) => (m === 'daylight' ? 'golden' : 'daylight'))
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-200 transition-colors hover:text-white whitespace-nowrap"
                >
                  {lightingMood === 'daylight' ? (
                    <>
                      <Sun className="h-3 w-3 text-amber-300" />
                      <span>Daylight</span>
                    </>
                  ) : (
                    <>
                      <Sunset className="h-3 w-3 text-orange-300" />
                      <span>Golden Hour</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
