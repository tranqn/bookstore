import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Book, Genre } from '../../core/models/book';
import { CatalogStore } from '../../stores/catalog.store';

const GENRE_TINT: Record<Genre, number> = {
  Fantasy: 0x6a5acd,
  Romantik: 0xff8970,
  'Science-Fiction': 0x3fb6c2,
  Thriller: 0x8a2b4a,
  Sachbuch: 0xc9a24b,
};

const COLS = 6;
const SPACING_X = 1.6;
const SPACING_Y = 2.4;
const BOOK_W = 1.1;
const BOOK_H = 1.7;
const BOOK_D = 0.18;
const MAX_BOOKS = 24;

interface BookMesh extends THREE.Mesh {
  userData: { bookId: string; baseY: number; hovered: boolean };
}

/** Raw-Three.js interactive book wall. Browser-only, self-disposing.
 *  Runs its own rAF loop outside Angular — no per-frame change detection. */
@Component({
  selector: 'app-book-shelf',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block h-[70vh] w-full' },
  template: `
    <div
      #host
      class="h-full w-full cursor-grab touch-none rounded-3xl active:cursor-grabbing"
      aria-hidden="true"
    ></div>
  `,
})
export class BookShelf {
  private readonly hostEl = viewChild.required<ElementRef<HTMLDivElement>>('host');
  private readonly catalog = inject(CatalogStore);
  private readonly router = inject(Router);
  private readonly zoneDoc = inject(DestroyRef);

  private renderer?: THREE.WebGLRenderer;
  private controls?: OrbitControls;
  private frame = 0;
  private disposers: (() => void)[] = [];

  constructor() {
    afterNextRender(() => this.init());
    this.zoneDoc.onDestroy(() => this.teardown());
  }

  private init(): void {
    const container = this.hostEl().nativeElement;
    const books = this.catalog.entities().slice(0, MAX_BOOKS);
    if (books.length === 0) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      100,
    );
    camera.position.set(0, 0.5, 13);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);
    this.renderer = renderer;

    // Lights — soft fill + key + coral rim (echoes the brand glow).
    scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(4, 6, 8);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xff8970, 1.4);
    rim.position.set(-6, 2, 4);
    scene.add(rim);

    // Build the book wall.
    const rows = Math.ceil(books.length / COLS);
    const group = new THREE.Group();
    const meshes: BookMesh[] = [];
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');

    books.forEach((book, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = (col - (COLS - 1) / 2) * SPACING_X;
      const y = ((rows - 1) / 2 - row) * SPACING_Y;

      const geo = new THREE.BoxGeometry(BOOK_W, BOOK_H, BOOK_D);
      const tint = GENRE_TINT[book.genre];
      const front = new THREE.MeshStandardMaterial({
        color: tint,
        roughness: 0.55,
        metalness: 0.05,
      });
      const side = new THREE.MeshStandardMaterial({
        color: 0x140e36,
        roughness: 0.7,
      });
      // BoxGeometry material order: +x,-x,+y,-y,+z,-z. Cover on +z (front).
      const mats = [side, side, side, side, front, side];
      const mesh = new THREE.Mesh(geo, mats) as unknown as BookMesh;
      mesh.position.set(x, y, 0);
      mesh.rotation.y = -col * 0.04 + (COLS - 1) * 0.02; // subtle wrap
      mesh.userData = { bookId: book.id, baseY: y, hovered: false };
      group.add(mesh);
      meshes.push(mesh);

      this.loadCover(loader, book, front);
    });
    scene.add(group);

    // Shelf planks under each row.
    for (let r = 0; r < rows; r++) {
      const y = ((rows - 1) / 2 - r) * SPACING_Y - BOOK_H / 2 - 0.12;
      const plank = new THREE.Mesh(
        new THREE.BoxGeometry(COLS * SPACING_X + 1, 0.18, 1),
        new THREE.MeshStandardMaterial({ color: 0x2a1f50, roughness: 0.8 }),
      );
      plank.position.set(0, y, -0.1);
      group.add(plank);
    }

    // Controls.
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 8;
    controls.maxDistance = 18;
    controls.minPolarAngle = Math.PI / 3;
    controls.maxPolarAngle = (2 * Math.PI) / 3;
    controls.minAzimuthAngle = -0.6;
    controls.maxAzimuthAngle = 0.6;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.6;
    this.controls = controls;

    // Pointer interaction (hover raise + click navigate).
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let hovered: BookMesh | null = null;

    const setPointer = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };
    const pick = (): BookMesh | null => {
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(meshes, false)[0];
      return (hit?.object as unknown as BookMesh) ?? null;
    };

    const onMove = (e: PointerEvent) => {
      setPointer(e);
      const hit = pick();
      if (hit !== hovered) {
        if (hovered) hovered.userData.hovered = false;
        hovered = hit;
        if (hovered) hovered.userData.hovered = true;
        container.style.cursor = hovered ? 'pointer' : 'grab';
        controls.autoRotate = !hovered;
      }
    };
    const onClick = (e: PointerEvent) => {
      setPointer(e);
      const hit = pick();
      if (hit) this.router.navigate(['/book', hit.userData.bookId]);
    };
    renderer.domElement.addEventListener('pointermove', onMove);
    renderer.domElement.addEventListener('pointerdown', onClick);
    this.disposers.push(() => {
      renderer.domElement.removeEventListener('pointermove', onMove);
      renderer.domElement.removeEventListener('pointerdown', onClick);
    });

    // Resize.
    const ro = new ResizeObserver(() => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    ro.observe(container);
    this.disposers.push(() => ro.disconnect());

    // Render loop.
    const tick = () => {
      for (const m of meshes) {
        const target = m.userData.hovered ? m.userData.baseY + 0.35 : m.userData.baseY;
        m.position.y += (target - m.position.y) * 0.15;
        const mat = (m.material as THREE.MeshStandardMaterial[])[4];
        const e = m.userData.hovered ? 0.6 : 0;
        mat.emissive.setHex(0xff8970);
        mat.emissiveIntensity += (e - mat.emissiveIntensity) * 0.15;
      }
      controls.update();
      renderer.render(scene, camera);
      this.frame = requestAnimationFrame(tick);
    };
    tick();

    // Track for disposal.
    this.disposers.push(() => {
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          const mat = obj.material;
          (Array.isArray(mat) ? mat : [mat]).forEach((m) => {
            (m as THREE.MeshStandardMaterial).map?.dispose();
            m.dispose();
          });
        }
      });
    });
  }

  private loadCover(
    loader: THREE.TextureLoader,
    book: Book,
    material: THREE.MeshStandardMaterial,
  ): void {
    loader.load(
      book.cover.medium,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        material.map = tex;
        material.color.setHex(0xffffff);
        material.needsUpdate = true;
      },
      undefined,
      () => {
        /* keep the genre tint on load failure */
      },
    );
  }

  private teardown(): void {
    cancelAnimationFrame(this.frame);
    this.disposers.forEach((d) => d());
    this.disposers = [];
    this.controls?.dispose();
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
  }
}
