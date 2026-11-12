/**
 * HeroCanvas.jsx — Full 3D Three.js cinematic scene
 *
 * Scene:
 *  - A curved 3D film strip (rotating cylinder of poster planes) that wraps around
 *  - 3D floating movie poster cards arranged in depth (z-axis parallax)
 *  - Dynamic bokeh/light particles
 *  - Mouse-driven camera tilt
 *  - Warm amber/gold lighting from below (like a projector beam)
 */

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { tmdbGet, tmdbImageUrl } from '../api/tmdb';

async function fetchPosterPaths() {
  try {
    const data = await tmdbGet('/movie/popular', { page: 1 });
    return (data.results || [])
      .filter(m => m.poster_path)
      .slice(0, 20)
      .map(m => tmdbImageUrl(m.poster_path, 'w342'));
  } catch {
    return [];
  }
}

function loadTexture(loader, url) {
  return new Promise(resolve => {
    loader.load(
      url,
      t => resolve(t),
      undefined,
      () => resolve(null)
    );
  });
}

export default function HeroCanvas() {
  const mountRef = useRef(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let animId;
    let disposed = false;

    // ── Renderer ────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ReinhardToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // ── Scene & Camera ───────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x060912, 0.06);

    const camera = new THREE.PerspectiveCamera(
      55,
      container.clientWidth / container.clientHeight,
      0.1,
      200
    );
    camera.position.set(0, 0, 14);

    // ── Lights ──────────────────────────────────────────────────
    // Ambient — very dim
    scene.add(new THREE.AmbientLight(0x1a1a2e, 0.4));

    // Projector beam — warm gold from below-left
    const projector = new THREE.SpotLight(0xffd700, 4, 50, Math.PI / 5, 0.6, 2);
    projector.position.set(-10, -8, 12);
    projector.target.position.set(0, 2, 0);
    scene.add(projector);
    scene.add(projector.target);

    // Fill light — cool blue tint from right
    const fill = new THREE.PointLight(0x4488ff, 1.2, 40);
    fill.position.set(12, 6, 8);
    scene.add(fill);

    // Rim light — red/orange from behind
    const rim = new THREE.PointLight(0xff4400, 0.8, 30);
    rim.position.set(-8, 4, -10);
    scene.add(rim);
    
    // Top light — soft white from above
    const topLight = new THREE.DirectionalLight(0xffffff, 0.5);
    topLight.position.set(0, 15, 5);
    scene.add(topLight);

    // ── Poster Planes Group ──────────────────────────────────────
    const postersGroup = new THREE.Group();
    scene.add(postersGroup);

    // Placeholder geometry (shown immediately, replaced with poster textures)
    const CARD_W = 1.5;
    const CARD_H = 2.25;
    const placeholderMat = new THREE.MeshStandardMaterial({
      color: 0x1a2236,
      roughness: 0.8,
      metalness: 0.1,
      transparent: true,
      opacity: 0.9,
    });

    // Arrange cards on an arc
    const NUM_CARDS = 18;
    const ARC_RADIUS = 11;
    const cardMeshes = [];

    for (let i = 0; i < NUM_CARDS; i++) {
      const angle = (i / NUM_CARDS) * Math.PI * 2;
      const x = Math.sin(angle) * ARC_RADIUS;
      const z = Math.cos(angle) * ARC_RADIUS * 0.6 - 6; // ellipse depth
      const y = (Math.sin(i * 0.7) * 2) + 0.8;

      const geo  = new THREE.PlaneGeometry(CARD_W, CARD_H, 2, 2);
      const mesh = new THREE.Mesh(geo, placeholderMat.clone());

      mesh.position.set(x, y, z);
      mesh.rotation.y = -angle + Math.PI * 0.5;
      mesh.rotation.z = (Math.random() - 0.5) * 0.2;
      mesh.rotation.x = (Math.random() - 0.5) * 0.1;
      mesh.userData = { baseY: y, speed: 0.4 + Math.random() * 0.5, phase: Math.random() * Math.PI * 2 };
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      postersGroup.add(mesh);
      cardMeshes.push(mesh);
    }

    // ── Film Strip ───────────────────────────────────────────────
    // A flat strip of darker frames in the background
    const stripGroup = new THREE.Group();
    scene.add(stripGroup);

    const stripMat = new THREE.MeshStandardMaterial({
      color: 0x0d1117,
      roughness: 0.9,
      metalness: 0.2,
      transparent: true,
      opacity: 0.7,
    });

    for (let i = -10; i <= 10; i++) {
      // Film frame
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(1.8, 2.6, 0.02),
        stripMat
      );
      frame.position.set(i * 2.1, -3, -8 + Math.sin(i * 0.4) * 1.5);
      frame.rotation.y = Math.sin(i * 0.3) * 0.2;
      frame.rotation.z = Math.sin(i * 0.5) * 0.05;
      stripGroup.add(frame);

      // Sprocket holes (top and bottom)
      [-1.2, 1.2].forEach(dy => {
        [-0.6, 0, 0.6].forEach(dx => {
          const hole = new THREE.Mesh(
            new THREE.BoxGeometry(0.12, 0.18, 0.04),
            new THREE.MeshStandardMaterial({ color: 0x060912 })
          );
          hole.position.set(frame.position.x + dx, frame.position.y + dy, frame.position.z + 0.01);
          hole.rotation.y = frame.rotation.y;
          stripGroup.add(hole);
        });
      });
    }

    // ── Particle Field (floating dust/bokeh) ─────────────────────
    const PARTICLE_COUNT = 1500;
    const pGeo  = new THREE.BufferGeometry();
    const pPos  = new Float32Array(PARTICLE_COUNT * 3);
    const pSizes = new Float32Array(PARTICLE_COUNT);
    const pColors = new Float32Array(PARTICLE_COUNT * 3);

    const colors = [0xd4af37, 0x4488ff, 0xff4400, 0xffffff];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      pPos[i * 3]     = (Math.random() - 0.5) * 40;
      pPos[i * 3 + 1] = (Math.random() - 0.5) * 25;
      pPos[i * 3 + 2] = (Math.random() - 0.5) * 25 - 8;
      pSizes[i] = Math.random() * 4 + 0.5;
      
      const color = new THREE.Color(colors[Math.floor(Math.random() * colors.length)]);
      pColors[i * 3] = color.r;
      pColors[i * 3 + 1] = color.g;
      pColors[i * 3 + 2] = color.b;
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    pGeo.setAttribute('size', new THREE.BufferAttribute(pSizes, 1));
    pGeo.setAttribute('color', new THREE.BufferAttribute(pColors, 3));

    const pMat = new THREE.PointsMaterial({
      size: 0.06,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
    });
    const particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);

    // ── Load real poster textures ─────────────────────────────────
    const loader = new THREE.TextureLoader();
    loader.crossOrigin = 'anonymous';

    fetchPosterPaths().then(async (urls) => {
      if (disposed || urls.length === 0) return;
      for (let i = 0; i < Math.min(urls.length, cardMeshes.length); i++) {
        if (disposed) break;
        const tex = await loadTexture(loader, urls[i]);
        if (!disposed && tex && cardMeshes[i]) {
          tex.colorSpace = THREE.SRGBColorSpace;
          const mat = new THREE.MeshStandardMaterial({
            map: tex,
            roughness: 0.4,
            metalness: 0.15,
            transparent: true,
            opacity: 0.95,
          });
          cardMeshes[i].material = mat;
          cardMeshes[i].material.needsUpdate = true;
        }
      }
    });

    // ── Mouse parallax ───────────────────────────────────────────
    let targetRotX = 0, targetRotY = 0;
    let currRotX   = 0, currRotY   = 0;

    const handleMouse = (e) => {
      targetRotY = ((e.clientX / window.innerWidth) - 0.5) * 0.6;
      targetRotX = ((e.clientY / window.innerHeight) - 0.5) * -0.35;
    };
    window.addEventListener('mousemove', handleMouse, { passive: true });

    // ── Resize ───────────────────────────────────────────────────
    const handleResize = () => {
      if (!container || disposed) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // ── Animation ────────────────────────────────────────────────
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      // Smooth camera rotation
      currRotX += (targetRotX - currRotX) * 0.05;
      currRotY += (targetRotY - currRotY) * 0.05;

      // Rotate poster arc slowly
      postersGroup.rotation.y = t * 0.05 + currRotY * 0.6;
      postersGroup.rotation.x = currRotX * 0.3;
      postersGroup.rotation.z = Math.sin(t * 0.1) * 0.05;

      // Float each card with more complex motion
      cardMeshes.forEach((m, i) => {
        m.position.y = m.userData.baseY + Math.sin(t * m.userData.speed + m.userData.phase) * 0.35;
        m.position.x += Math.sin(t * 0.3 + i) * 0.002;
        m.rotation.y += 0.001;
      });

      // Film strip drift
      stripGroup.position.x = Math.sin(t * 0.08) * 0.8;
      stripGroup.rotation.z = Math.sin(t * 0.06) * 0.03;
      stripGroup.rotation.y = Math.sin(t * 0.04) * 0.02;

      // Particle drift with more movement
      particles.rotation.y = t * 0.02;
      particles.rotation.x = t * 0.01;
      particles.position.y = Math.sin(t * 0.15) * 0.5;
      
      // Animate particle sizes
      const sizes = particles.geometry.attributes.size.array;
      for (let i = 0; i < sizes.length; i++) {
        sizes[i] = (Math.random() * 4 + 0.5) * (1 + Math.sin(t * 2 + i) * 0.3);
      }
      particles.geometry.attributes.size.needsUpdate = true;

      // Projector light pulsate with more variation
      projector.intensity = 3 + Math.sin(t * 1.5) * 0.8 + Math.sin(t * 0.7) * 0.4;
      projector.angle = Math.PI / 5 + Math.sin(t * 0.3) * 0.05;
      
      // Fill light variation
      fill.intensity = 1.2 + Math.sin(t * 0.8) * 0.3;
      
      // Rim light variation
      rim.intensity = 0.8 + Math.sin(t * 1.2) * 0.3;

      // Camera gentle float with more movement
      camera.position.y = Math.sin(t * 0.2) * 0.4 + Math.sin(t * 0.4) * 0.2;
      camera.position.x = Math.sin(t * 0.15) * 0.3;
      camera.rotation.x = currRotX * 0.12;
      camera.rotation.y = currRotY * 0.08;

      renderer.render(scene, camera);
    };

    animate();

    // ── Cleanup ──────────────────────────────────────────────────
    return () => {
      disposed = true;
      cancelAnimationFrame(animId);
      window.removeEventListener('mousemove', handleMouse);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (container && renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={mountRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
}
