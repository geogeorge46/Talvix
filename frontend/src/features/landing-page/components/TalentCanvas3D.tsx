import { useEffect, useRef, useState } from 'react';

/**
 * Interactive 3D Talent Network Canvas (Light Theme Optimized)
 * Renders an interactive 3D particle sphere / neural network in Three.js
 * Gracefully falls back to SVG/CSS animation in jsdom/test environments or when WebGL is unavailable.
 */
export function TalentCanvas3D() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [webglSupported, setWebglSupported] = useState(true);

  useEffect(() => {
    let renderer: any = null;
    let scene: any = null;
    let camera: any = null;
    let sphere: any = null;
    let points: any = null;
    let animationFrameId: number;

    const container = containerRef.current;
    if (!container) return;

    // Check WebGL availability before attempting Three.js initialization
    const testCanvas = document.createElement('canvas');
    const gl =
      testCanvas.getContext('webgl') ||
      testCanvas.getContext('experimental-webgl');
    if (!gl) {
      setWebglSupported(false);
      return;
    }

    let isMounted = true;

    // Dynamically import Three to keep initial bundle lean
    import('three')
      .then((THREE) => {
        if (!isMounted || !container) return;

        const width = container.clientWidth || 320;
        const height = container.clientHeight || 320;

        // Scene & Camera
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
        camera.position.z = 220;

        // Renderer with transparent background for seamless light theme integration
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        container.appendChild(renderer.domElement);

        // Outer polyhedral wireframe sphere (Hiring nodes)
        const geometry = new THREE.IcosahedronGeometry(75, 2);
        const material = new THREE.MeshBasicMaterial({
          color: 0x059669, // Deep vibrant emerald for crisp light theme contrast
          wireframe: true,
          transparent: true,
          opacity: 0.35,
        });
        sphere = new THREE.Mesh(geometry, material);
        scene.add(sphere);

        // Glowing connection nodes (Particles)
        const particleCount = 130;
        const particleGeo = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);

        const emerald = new THREE.Color(0x059669);
        const cyan = new THREE.Color(0x0284c7);
        const indigo = new THREE.Color(0x2563eb);

        for (let i = 0; i < particleCount; i++) {
          const u = Math.random();
          const v = Math.random();
          const theta = u * 2.0 * Math.PI;
          const phi = Math.acos(2.0 * v - 1.0);
          const r = 74 + (Math.random() * 8 - 4);

          positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
          positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
          positions[i * 3 + 2] = r * Math.cos(phi);

          const choice = Math.random();
          const c = choice < 0.45 ? emerald : choice < 0.75 ? cyan : indigo;
          colors[i * 3] = c.r;
          colors[i * 3 + 1] = c.g;
          colors[i * 3 + 2] = c.b;
        }

        particleGeo.setAttribute(
          'position',
          new THREE.BufferAttribute(positions, 3),
        );
        particleGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const particleMat = new THREE.PointsMaterial({
          size: 4.5,
          vertexColors: true,
          transparent: true,
          opacity: 0.95,
        });

        points = new THREE.Points(particleGeo, particleMat);
        scene.add(points);

        // Core inner light node
        const coreGeo = new THREE.SphereGeometry(18, 16, 16);
        const coreMat = new THREE.MeshBasicMaterial({
          color: 0x10b981,
          transparent: true,
          opacity: 0.18,
        });
        const coreMesh = new THREE.Mesh(coreGeo, coreMat);
        scene.add(coreMesh);

        // Mouse Parallax Interaction
        let mouseX = 0;
        let mouseY = 0;
        let targetX = 0;
        let targetY = 0;

        const handleMouseMove = (event: MouseEvent) => {
          const rect = container.getBoundingClientRect();
          mouseX = (event.clientX - rect.left - width / 2) * 0.0015;
          mouseY = (event.clientY - rect.top - height / 2) * 0.0015;
        };

        window.addEventListener('mousemove', handleMouseMove);

        const handleResize = () => {
          if (!container || !renderer || !camera) return;
          const newW = container.clientWidth;
          const newH = container.clientHeight;
          camera.aspect = newW / newH;
          camera.updateProjectionMatrix();
          renderer.setSize(newW, newH);
        };

        window.addEventListener('resize', handleResize);

        // Animation Loop
        const animate = () => {
          animationFrameId = requestAnimationFrame(animate);

          targetX += (mouseX - targetX) * 0.05;
          targetY += (mouseY - targetY) * 0.05;

          if (sphere && points) {
            sphere.rotation.y += 0.003;
            sphere.rotation.x += 0.0015;
            sphere.rotation.y += targetX;
            sphere.rotation.x += targetY;

            points.rotation.y += 0.0025;
            points.rotation.x += 0.0012;
            points.rotation.y += targetX * 1.2;
            points.rotation.x += targetY * 1.2;
          }

          if (renderer && scene && camera) {
            renderer.render(scene, camera);
          }
        };

        animate();

        return () => {
          window.removeEventListener('mousemove', handleMouseMove);
          window.removeEventListener('resize', handleResize);
        };
      })
      .catch(() => {
        setWebglSupported(false);
      });

    return () => {
      isMounted = false;
      cancelAnimationFrame(animationFrameId);
      if (
        renderer &&
        renderer.domElement &&
        container.contains(renderer.domElement)
      ) {
        container.removeChild(renderer.domElement);
        renderer.dispose();
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label="Interactive 3D Talent Network Visualization"
      className="relative flex h-[280px] w-full items-center justify-center overflow-hidden sm:h-[340px]"
    >
      {!webglSupported && (
        <div className="relative flex h-48 w-48 animate-pulse items-center justify-center sm:h-56 sm:w-56">
          <div className="duration-1000 absolute inset-0 animate-spin rounded-full bg-gradient-to-tr from-emerald-400/20 via-cyan-400/20 to-blue-500/20 blur-xl" />
          <svg
            viewBox="0 0 100 100"
            className="h-full w-full animate-spin text-emerald-600/70"
            style={{ animationDuration: '20s' }}
          >
            <circle
              cx="50"
              cy="50"
              r="42"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeDasharray="6 4"
              fill="none"
            />
            <circle
              cx="50"
              cy="50"
              r="30"
              stroke="#0284c7"
              strokeWidth="1.5"
              strokeDasharray="4 4"
              fill="none"
            />
            <circle
              cx="50"
              cy="50"
              r="14"
              fill="#10b981"
              fillOpacity="0.2"
              stroke="#059669"
              strokeWidth="2"
            />
            <circle cx="20" cy="30" r="3" fill="#10b981" />
            <circle cx="80" cy="40" r="3" fill="#06b6d4" />
            <circle cx="35" cy="85" r="3" fill="#3b82f6" />
            <circle cx="70" cy="75" r="3" fill="#10b981" />
          </svg>
        </div>
      )}
    </div>
  );
}
