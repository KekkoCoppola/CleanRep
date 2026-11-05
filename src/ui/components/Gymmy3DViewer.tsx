import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

interface Props {
  mode: 'rest' | 'workout';
  className?: string;
}

export default function Gymmy3DViewer({ mode, className = '' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Dimensions
    const width = container.clientWidth || 300;
    const height = container.clientHeight || 280;

    // Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    // Position camera facing Gymmy slightly from above
    camera.position.set(0, 0.35, 1.25);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xfff5e6, 2.2);
    keyLight.position.set(1.5, 2.0, 2.0);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xddeeff, 1.2);
    fillLight.position.set(-1.5, 0.5, 1.0);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x00e676, 1.0); // CleanRep neon accent
    rimLight.position.set(0, 1.5, -1.5);
    scene.add(rimLight);

    // Model & Animation variables
    let mixer: THREE.AnimationMixer | null = null;
    let modelGroup: THREE.Group | null = null;
    let reqId = 0;
    const clock = new THREE.Clock();

    // Interaction state (drag to rotate)
    let isDragging = false;
    let prevMouseX = 0;
    let targetRotationY = 0;

    const onPointerDown = (e: PointerEvent) => {
      isDragging = true;
      prevMouseX = e.clientX;
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - prevMouseX;
      prevMouseX = e.clientX;
      targetRotationY += deltaX * 0.012;
    };
    const onPointerUp = () => {
      isDragging = false;
    };

    container.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    // Load Model
    const loader = new GLTFLoader();
    const modelUrl = `${import.meta.env.BASE_URL}assets/gymmy/gymmy.glb?v=4`;

    loader.load(
      modelUrl,
      (gltf) => {
        modelGroup = gltf.scene;
        // Center model: bounds center is at Y ~ 0.31
        modelGroup.position.set(0, -0.28, 0);

        // In Workout mode, tilt forward dynamically; in Rest mode, tilt back
        if (mode === 'workout') {
          modelGroup.rotation.x = 0.05;
        } else {
          modelGroup.rotation.x = -0.05;
        }

        scene.add(modelGroup);

        if (gltf.animations && gltf.animations.length > 0) {
          mixer = new THREE.AnimationMixer(modelGroup);
          const action = mixer.clipAction(gltf.animations[0]);
          action.play();
        }

        setIsLoading(false);
      },
      undefined,
      (err) => {
        console.warn('Could not load Gymmy 3D model, falling back to 2D sprite:', err);
        setLoadError(true);
        setIsLoading(false);
      }
    );

    // Render loop
    const animate = () => {
      reqId = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      if (mixer) {
        mixer.update(delta);
      }

      if (modelGroup) {
        // Smooth rotation damping
        modelGroup.rotation.y += (targetRotationY - modelGroup.rotation.y) * 0.1;
        // Subtle auto-turn if not dragging
        if (!isDragging) {
          targetRotationY += 0.003;
        }
      }

      renderer.render(scene, camera);
    };
    animate();

    // Resize handler
    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || 300;
      const h = container.clientHeight || 280;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(reqId);
      window.removeEventListener('resize', onResize);
      container.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [mode]);

  if (loadError) {
    return null; // Parent will show 2D fallback
  }

  return (
    <div className={`gymmy-3d-container ${className}`} style={{ width: '100%', height: '280px', position: 'relative' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%', cursor: 'grab' }} />
      {isLoading && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            color: 'var(--text-muted, #8e8e93)',
          }}
        >
          Caricamento Gymmy 3D...
        </div>
      )}
    </div>
  );
}

