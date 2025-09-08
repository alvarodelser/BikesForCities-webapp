import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface WaveBackgroundProps {
  color?: number;
  shininess?: number;
  waveHeight?: number;
  waveSpeed?: number;
  zoom?: number;
  specularColor?: number;
  // Camera parameters
  cameraFov?: number;
  cameraX?: number;
  cameraY?: number;
  cameraZ?: number;
  targetX?: number;
  targetY?: number;
  targetZ?: number;
  className?: string;
}

const WaveBackground: React.FC<WaveBackgroundProps> = ({
  color = 0x3A6C7F,
  shininess = 25,
  waveHeight = 15,
  waveSpeed = 1,
  zoom = 1,
  specularColor = 0x7BA492,
  // Camera defaults
  cameraFov = 75,
  cameraX = 0,
  cameraY = 600,
  cameraZ = 200,
  targetX = 0,
  targetY = -50,
  targetZ = 0,
  className = ''
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const planeRef = useRef<THREE.Mesh | null>(null);
  const animationIdRef = useRef<number | null>(null);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });
  const prevMouseRef = useRef({ x: 0.5, y: 0.5 });
  const mouseVelocityRef = useRef({ x: 0, y: 0 });
  const timeRef = useRef(0);
  const originalVerticesRef = useRef<Float32Array | null>(null);
  const cameraPositionRef = useRef<THREE.Vector3 | null>(null);
  const cameraTargetRef = useRef<THREE.Vector3 | null>(null);
  
  // Grid dimensions - reduced for better performance and visibility
  const ww = 70;
  const hh = 50;
  const waveNoise = 7;
  const CELL_SIZE = 25;

  // Remove unused dimensions state
  // const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Helper functions
  const randomNormal = (min: number, max: number) => Math.random() * (max - min) + min;

  // Initialize Three.js scene
  const initScene = () => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.background = null; // Transparent background
    sceneRef.current = scene;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true,
      powerPreference: "high-performance"
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0); // Transparent
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Camera - using configurable parameters
    const camera = new THREE.PerspectiveCamera(cameraFov, width / height, 1, 5000);
    const cameraPosition = new THREE.Vector3(cameraX, cameraY, cameraZ);
    const cameraTarget = new THREE.Vector3(targetX, targetY, targetZ);
    
    camera.position.copy(cameraPosition);
    camera.lookAt(cameraTarget);
    cameraPositionRef.current = cameraPosition.clone();
    cameraTargetRef.current = cameraTarget.clone();
    cameraRef.current = camera;

    // Create wave geometry
    const geometry = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const indices: number[] = [];
    const gg: number[][] = [];

    // Create vertices grid
    for (let i = 0; i <= ww; i++) {
      gg[i] = [];
      for (let j = 0; j <= hh; j++) {
        const vertexIndex = vertices.length / 3;
        
        // Position vertices in a grid
        const x = (i - (ww * 0.5)) * CELL_SIZE;
        const y = randomNormal(-waveNoise, waveNoise) - 10;
        const z = ((hh * 0.5) - j) * CELL_SIZE;
        
        vertices.push(x, y, z);
        gg[i][j] = vertexIndex;
      }
    }

    // Create triangular faces for the grid
    for (let i = 0; i < ww; i++) {
      for (let j = 0; j < hh; j++) {
        const a = gg[i][j];
        const b = gg[i + 1][j];
        const c = gg[i][j + 1];
        const d = gg[i + 1][j + 1];

        // Create two triangles per quad
        indices.push(a, b, c);
        indices.push(b, d, c);
      }
    }

    const verticesArray = new Float32Array(vertices);
    geometry.setAttribute('position', new THREE.BufferAttribute(verticesArray, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    // Store original vertices for wave animation
    originalVerticesRef.current = new Float32Array(verticesArray);

    // Material - enhanced for reflective/glass-like appearance
    const material = new THREE.MeshPhongMaterial({
      color: color, // Use prop color
      shininess: Math.max(shininess * 3, 1), // Enhanced shininess with minimum value
      transparent: true,
      opacity: 0.9, // Slightly transparent for glass effect
      reflectivity: 0.9, // High reflectivity for mirror-like surfaces
      flatShading: true, // Keep geometric look
      side: THREE.DoubleSide,
      specular: specularColor, // Use prop specular color
    });

    // Create mesh
    const plane = new THREE.Mesh(geometry, material);
    scene.add(plane);
    planeRef.current = plane;

    // Lighting - enhanced for better wave visibility
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xffffff, 1.2);
    pointLight.position.set(0, 300, 200);
    scene.add(pointLight);

    // Additional directional light for better surface definition
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(-200, 200, 100);
    scene.add(directionalLight);
  };

  // Animation loop
  const animate = () => {
    if (!sceneRef.current || !rendererRef.current || !cameraRef.current || !planeRef.current) return;

    timeRef.current += 1; // Increment time for wave animation

    // Calculate mouse velocity for stronger interaction effects
    const deltaX = mouseRef.current.x - prevMouseRef.current.x;
    const deltaY = mouseRef.current.y - prevMouseRef.current.y;
    mouseVelocityRef.current.x = deltaX * 0.8 + mouseVelocityRef.current.x * 0.2; // Smooth velocity
    mouseVelocityRef.current.y = deltaY * 0.8 + mouseVelocityRef.current.y * 0.2;
    prevMouseRef.current = { ...mouseRef.current };

    const camera = cameraRef.current;
    const plane = planeRef.current;

    // Update material properties with consistent values
    (plane.material as THREE.MeshPhongMaterial).color.setHex(color);
    (plane.material as THREE.MeshPhongMaterial).shininess = Math.max(shininess * 3, 1);
    (plane.material as THREE.MeshPhongMaterial).specular.setHex(specularColor);

    // Camera movement
    const cameraPos = cameraPositionRef.current!;
    const targetX = cameraPos.x + ((mouseRef.current.x - 0.5) * 100) / zoom;
    const targetY = cameraPos.y + ((mouseRef.current.y - 0.5) * -100) / zoom;
    const targetZ = cameraPos.z + ((mouseRef.current.x - 0.5) * -50) / zoom;

    // Smooth camera interpolation
    const lerpFactor = 0.02;
    camera.position.x += (targetX - camera.position.x) * lerpFactor;
    camera.position.y += (targetY - camera.position.y) * lerpFactor;
    camera.position.z += (targetZ - camera.position.z) * lerpFactor;

    camera.lookAt(cameraTargetRef.current!);

    // Wave animation
    const positions = plane.geometry.attributes.position.array as Float32Array;
    const originalPositions = originalVerticesRef.current!;

    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i];
      const z = positions[i + 2];
      const originalY = originalPositions[i + 1];

      const s = waveSpeed;
      const time = timeRef.current * 0.01;
      
      // Ocean waves with directional flow (moving diagonally)
      const flowX = time * s * 0.5; // Constant flow in X direction
      const flowZ = time * s * 0.3; // Slower flow in Z direction
      
      // Large primary waves
      const wave1 = Math.sin((x * 0.015 - flowX) + (z * 0.01 - flowZ)) * waveHeight * 0.7;
      
      // Medium waves at different angle
      const wave2 = Math.sin((x * 0.02 - flowX * 0.8) + (z * 0.015 - flowZ * 1.2)) * waveHeight * 0.5;
      
      // Small choppy waves
      const wave3 = Math.sin((x * 0.035 - flowX * 1.5) + (z * 0.03 - flowZ * 0.7)) * waveHeight * 0.3;
      
      // Surface ripples
      const ripples = Math.sin((x * 0.08 - flowX * 2) + (z * 0.06 - flowZ * 1.8)) * waveHeight * 0.15;
      
      // Mouse interaction effects
      const mouseX = (mouseRef.current.x - 0.5) * 1000; // Convert to world coordinates
      const mouseZ = (mouseRef.current.y - 0.5) * 800;
      
      // Distance from vertex to mouse position
      const distanceToMouse = Math.sqrt((x - mouseX) ** 2 + (z - mouseZ) ** 2);
      
      // Subtle interactive ripples around mouse
      const mouseRippleRadius = 150; // Smaller radius for more localized effect
      if (distanceToMouse < mouseRippleRadius) {
        const rippleStrength = (mouseRippleRadius - distanceToMouse) / mouseRippleRadius;
        const smoothFalloff = rippleStrength * rippleStrength; // Smoother falloff curve
        
        // Mouse velocity influence (more subtle)
        const velocity = Math.sqrt(mouseVelocityRef.current.x ** 2 + mouseVelocityRef.current.y ** 2);
        const velocityMultiplier = 1 + Math.min(velocity * 8, 1.5); // Much more subtle velocity effect
        
        // Gentle concentric ripples from mouse position
        const mouseRipple = Math.sin((distanceToMouse * 0.08) - (time * s * 3)) * waveHeight * 0.15 * smoothFalloff * velocityMultiplier;
        
        // Very subtle wake effect
        const wakeEffect = Math.sin((distanceToMouse * 0.04) + (time * s * 1.5)) * waveHeight * 0.08 * smoothFalloff;
        
        // Gentle directional push effect (only for faster movements)
        const pushEffect = velocity > 0.005 ? 
          Math.sin((distanceToMouse * 0.06) + (time * s * 2.5)) * waveHeight * 0.1 * velocity * 10 * smoothFalloff : 0;
        
        positions[i + 1] = originalY + wave1 + wave2 + wave3 + ripples + mouseRipple + wakeEffect + pushEffect;
      } else {
        positions[i + 1] = originalY + wave1 + wave2 + wave3 + ripples;
      }
    }

    plane.geometry.attributes.position.needsUpdate = true;
    plane.geometry.computeVertexNormals();

    rendererRef.current.render(sceneRef.current, camera);
    animationIdRef.current = requestAnimationFrame(animate);
  };

  // Mouse move handler
  const handleMouseMove = (event: MouseEvent) => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    mouseRef.current = {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height
    };
  };

  // Resize handler
  const handleResize = () => {
    if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    cameraRef.current.aspect = width / height;
    cameraRef.current.updateProjectionMatrix();
    rendererRef.current.setSize(width, height);
  };

  // Setup and cleanup
  useEffect(() => {
    console.log('WaveBackground: Initializing...');
    
    // Small delay to ensure container is ready
    const timer = setTimeout(() => {
      try {
        initScene();
        animate();
        console.log('WaveBackground: Initialized successfully');
      } catch (error) {
        console.error('WaveBackground: Initialization failed', error);
      }
    }, 100);

    const container = containerRef.current;
    if (container) {
      container.addEventListener('mousemove', handleMouseMove);
    }

    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(timer);
      
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      
      if (container) {
        container.removeEventListener('mousemove', handleMouseMove);
      }
      
      window.removeEventListener('resize', handleResize);
      
      if (rendererRef.current && containerRef.current) {
        try {
          containerRef.current.removeChild(rendererRef.current.domElement);
          rendererRef.current.dispose();
        } catch (error) {
          console.warn('WaveBackground: Cleanup warning', error);
        }
      }
    };
  }, []);

  // Update material properties when props change
  useEffect(() => {
    if (!planeRef.current) return;
    
    const material = planeRef.current.material as THREE.MeshPhongMaterial;
    material.color.setHex(color);
    material.shininess = Math.max(shininess * 3, 1);
    material.specular.setHex(specularColor);
    material.needsUpdate = true;
  }, [color, shininess, specularColor]);

  // Update camera properties when props change
  useEffect(() => {
    if (!cameraRef.current || !cameraPositionRef.current || !cameraTargetRef.current) return;
    
    const camera = cameraRef.current;
    camera.fov = cameraFov;
    camera.updateProjectionMatrix();
    
    const newPosition = new THREE.Vector3(cameraX, cameraY, cameraZ);
    const newTarget = new THREE.Vector3(targetX, targetY, targetZ);
    
    camera.position.copy(newPosition);
    camera.lookAt(newTarget);
    cameraPositionRef.current = newPosition.clone();
    cameraTargetRef.current = newTarget.clone();
  }, [cameraFov, cameraX, cameraY, cameraZ, targetX, targetY, targetZ]);

  // Other props (waveHeight, waveSpeed, zoom) are used directly in animation loop

  return (
    <div 
      ref={containerRef} 
      className={`absolute inset-0 ${className}`}
      style={{ 
        width: '100%', 
        height: '100%',
        pointerEvents: 'auto' // Enable mouse interaction with waves
      }}
    />
  );
};

export default WaveBackground;
