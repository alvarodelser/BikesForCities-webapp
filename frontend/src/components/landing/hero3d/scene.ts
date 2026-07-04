import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { BG, GROUND } from './palette';

export interface HeroStage {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  resize: (w: number, h: number) => void;
  render: () => void;
  dispose: () => void;
}

const FRUSTUM = 16; // half-height of the ortho frustum, world units

export function createStage(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
): HeroStage {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height, false);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  scene.fog = new THREE.Fog(BG, 38, 85);

  const aspect = width / height;
  const camera = new THREE.OrthographicCamera(
    -FRUSTUM * aspect, FRUSTUM * aspect, FRUSTUM, -FRUSTUM, 0.1, 300,
  );
  camera.position.set(40, 40, 40); // classic isometric: X reads as the diagonal
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.AmbientLight('#9fd8cf', 0.7));
  const dir = new THREE.DirectionalLight('#eafff5', 1.1);
  dir.position.set(30, 50, 20);
  scene.add(dir);

  // Ground plane, large enough to fill the frustum out to the fog.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(300, 300),
    new THREE.MeshStandardMaterial({ color: GROUND, roughness: 0.95 }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(width, height),
    0.85, // strength
    0.5,  // radius
    0.55, // threshold — cream bike and green pulses cross it, glass does not
  );
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const resize = (w: number, h: number) => {
    const a = w / h;
    camera.left = -FRUSTUM * a;
    camera.right = FRUSTUM * a;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
  };

  return {
    renderer,
    scene,
    camera,
    resize,
    render: () => composer.render(),
    dispose: () => {
      composer.dispose();
      renderer.dispose();
    },
  };
}
