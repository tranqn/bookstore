import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import * as THREE from 'three';
import type { Book, Genre } from '../../core/models/book';
import { CatalogStore } from '../../stores/catalog.store';

/** Accent tint per genre — the hover-highlight fallback until the cover loads. */
const GENRE_TINT: Record<Genre, string> = {
  Fantasy: '#6a5acd',
  Romantik: '#ff8970',
  'Science-Fiction': '#3fb6c2',
  Thriller: '#8a2b4a',
  Sachbuch: '#c9a24b',
};

/** Canonical genre order — drives the genre-sorted layout and the gap colours,
 *  so panning sweeps the genres in order instead of randomly. */
const GENRE_ORDER: Genre[] = ['Fantasy', 'Romantik', 'Science-Fiction', 'Thriller', 'Sachbuch'];

/** Dim genre glow painted in the gaps *outside* each square (navigation map). */
const GENRE_GAP: Record<Genre, THREE.Color> = GENRE_ORDER.reduce(
  (acc, g) => {
    const c = new THREE.Color(GENRE_TINT[g]);
    const hsl = { h: 0, s: 0, l: 0 };
    c.getHSL(hsl);
    c.setHSL(hsl.h, Math.min(hsl.s, 0.55), 0.15); // keep the hue, dim it right down
    acc[g] = c;
    return acc;
  },
  {} as Record<Genre, THREE.Color>,
);

// Each tile is a SQUARE: a solid background quad (tints on hover) with a
// transparent content quad on top — the cover centred + metadata in the frame.
const TEX_SIZE = 512; // content canvas resolution (downscaled onto the tile)

// Resting tile background — a dark neutral above the scene clear colour so the
// squares read as a card grid (and the wall isn't too dark). On hover it eases
// to the cover-derived tint.
const BASE_BG = new THREE.Color(0x201c3a);

// Infinite-grid tiling: vertical neighbours jump by this many catalogue entries.
// Coprime-ish with the catalogue size so panning sweeps the whole shelf.
const ROW_STRIDE = 9;

const DISTORTION = -0.12; // barrel amount (phantom.land uses ≈ -0.116)
// Gentle vignette: keep the wall bright nearly to the edges, only the far
// corners fall off into the dark background.
const VIGNETTE_OFFSET = 0.5;
const VIGNETTE_DARKNESS = 0.3;
const FRICTION = 0.92; // momentum decay per frame after release
const CLICK_SLOP = 6; // px of travel below which a pointerup counts as a click
const ZOOM_OUT = 0.62; // camera.zoom while the pointer is held (phantom overview)

const wrap = (n: number, m: number): number => ((n % m) + m) % m;

interface Cell {
  genreMesh: THREE.Mesh; // unit-sized; its colour fills the gap = genre map
  genreMat: THREE.MeshBasicMaterial;
  bgMesh: THREE.Mesh; // the square; gradient-tints to the cover colour on hover
  bgMat: THREE.ShaderMaterial;
  contentMesh: THREE.Mesh;
  contentMat: THREE.MeshBasicMaterial;
  x: number;
  y: number;
  col: number;
  row: number;
  bookIndex: number;
  entry: CardTex; // current book's content texture + cover-derived tint
  h: number; // eased hover 0..1 (background tint progress)
}

/** Background-square material: flat `uBase` at rest, easing to a vertical
 *  gradient of the cover-derived `uColor` as `uHover` → 1. */
const makeBgMaterial = (): THREE.ShaderMaterial =>
  new THREE.ShaderMaterial({
    uniforms: {
      uBase: { value: BASE_BG.clone() },
      uColor: { value: new THREE.Color(0xffffff) },
      uHover: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uBase;
      uniform vec3 uColor;
      uniform float uHover;
      varying vec2 vUv;
      void main() {
        vec3 grad = mix(uColor * 0.7, uColor * 1.05, vUv.y);
        gl_FragColor = vec4(mix(uBase, grad, uHover), 1.0);
        // Encode to the render target's colour space (transfer fns are
        // auto-injected by the renderer for ShaderMaterials).
        #include <colorspace_fragment>
      }
    `,
  });

interface CardTex {
  contentTexture: THREE.CanvasTexture;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  cover?: HTMLImageElement;
  lqip?: HTMLImageElement;
  /** Hover-highlight colour, sampled from the cover (genre tint until loaded). */
  highlight: THREE.Color;
}

/** phantom.land-style cover wall: a single WebGL canvas holding an infinite,
 *  drag-pannable grid of square book tiles, warped by a barrel-distortion +
 *  vignette post-process. Each tile shows the cover centred with its metadata
 *  framed around it; hovering tints the tile background with a colour pulled
 *  from that cover. Browser-only, self-disposing, runs its own rAF loop outside
 *  Angular (no per-frame change detection). */
@Component({
  selector: 'app-book-gallery',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block h-full w-full' },
  template: `
    <div
      #host
      class="h-full w-full cursor-grab touch-none overflow-hidden active:cursor-grabbing"
      data-lenis-prevent-touch=""
      aria-hidden="true"
    ></div>
  `,
})
export class BookGallery {
  private readonly hostEl = viewChild.required<ElementRef<HTMLDivElement>>('host');
  private readonly catalog = inject(CatalogStore);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  /** Book id to centre the wall on (deep link `/gallery?focus=<bookId>`). */
  readonly focus = input<string>();

  private renderer?: THREE.WebGLRenderer;
  private frame = 0;
  private disposers: (() => void)[] = [];
  /** Tiny scratch canvas reused to average a cover down to its dominant colour. */
  private sampler?: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D };

  constructor() {
    afterNextRender(() => this.init());
    this.destroyRef.onDestroy(() => this.teardown());
  }

  private init(): void {
    const container = this.hostEl().nativeElement;
    // Sort by genre (then rating) so the wall sweeps through genres in order —
    // navigable, and the gap colours form contiguous bands.
    const books = [...this.catalog.entities()].sort(
      (a, b) => GENRE_ORDER.indexOf(a.genre) - GENRE_ORDER.indexOf(b.genre) || b.rating - a.rating,
    );
    if (books.length === 0) return;

    let w = container.clientWidth || 1;
    let h = container.clientHeight || 1;

    // --- Renderer -----------------------------------------------------------
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.setClearColor(0x0a0913, 1);
    renderer.domElement.style.touchAction = 'none';
    container.appendChild(renderer.domElement);
    this.renderer = renderer;

    // --- Tile sizing (px == world units via an orthographic camera) ---------
    // Square tiles, sized so the framed metadata stays readable (~5 columns).
    const side = Math.min(Math.max(w / 5.2, 250), 340);
    const gap = side * 0.1;
    const unitX = side + gap;
    const unitY = side + gap;
    const cols = Math.ceil(w / unitX) + 4;
    const rows = Math.ceil(h / unitY) + 4;
    const spanX = cols * unitX;
    const spanY = rows * unitY;
    const halfX = spanX / 2;
    const halfY = spanY / 2;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, -100, 100);
    camera.position.z = 10;

    // --- Content-texture cache (one transparent canvas per book, lazy) ------
    const texCache = new Map<string, CardTex>();
    const contentFor = (book: Book): CardTex => this.buildContent(texCache, book);

    // --- Cell pool ----------------------------------------------------------
    const n = books.length;
    const geo = new THREE.PlaneGeometry(side, side);
    const geoUnit = new THREE.PlaneGeometry(unitX, unitY); // fills the gap too
    const cells: Cell[] = [];

    // Centre the wall on the focused book (or book 0) by biasing column ids.
    const centreCol = Math.floor((cols - 1) / 2);
    const centreRow = Math.floor((rows - 1) / 2);
    const focusIdx = Math.max(
      0,
      books.findIndex((b) => b.id === this.focus()),
    );
    const baseIdx = wrap(centreCol + centreRow * ROW_STRIDE, n);
    const colBias = focusIdx - baseIdx;

    for (let iy = 0; iy < rows; iy++) {
      for (let ix = 0; ix < cols; ix++) {
        const col = ix + colBias;
        const row = iy;
        const bookIndex = wrap(col + row * ROW_STRIDE, n);
        const entry = contentFor(books[bookIndex]);

        // Genre glow that fills the cell (incl. the gap) — the navigation map.
        const genreMat = new THREE.MeshBasicMaterial({
          color: GENRE_GAP[books[bookIndex].genre].clone(),
        });
        const genreMesh = new THREE.Mesh(geoUnit, genreMat);

        const bgMat = makeBgMaterial();
        const bgMesh = new THREE.Mesh(geo, bgMat);

        const contentMat = new THREE.MeshBasicMaterial({
          map: entry.contentTexture,
          transparent: true,
          depthWrite: false,
        });
        const contentMesh = new THREE.Mesh(geo, contentMat);
        contentMesh.renderOrder = 1;

        const x = (ix - (cols - 1) / 2) * unitX;
        const y = ((rows - 1) / 2 - iy) * unitY;
        genreMesh.position.set(x, y, -0.1);
        bgMesh.position.set(x, y, 0);
        contentMesh.position.set(x, y, 0.1);
        scene.add(genreMesh);
        scene.add(bgMesh);
        scene.add(contentMesh);

        cells.push({
          genreMesh,
          genreMat,
          bgMesh,
          bgMat,
          contentMesh,
          contentMat,
          x,
          y,
          col,
          row,
          bookIndex,
          entry,
          h: 0,
        });
      }
    }
    this.disposers.push(() => {
      geo.dispose();
      geoUnit.dispose();
    });

    // --- Distortion + vignette post-process ---------------------------------
    const pr = renderer.getPixelRatio();
    const rt = new THREE.WebGLRenderTarget(Math.round(w * pr), Math.round(h * pr), {
      depthBuffer: true,
    });
    rt.texture.colorSpace = THREE.SRGBColorSpace;
    rt.texture.minFilter = THREE.LinearFilter;
    rt.texture.magFilter = THREE.LinearFilter;

    const distortMat = new THREE.ShaderMaterial({
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tDiffuse: { value: rt.texture },
        distortion: { value: new THREE.Vector2(DISTORTION, DISTORTION) },
        vignetteOffset: { value: VIGNETTE_OFFSET },
        vignetteDarkness: { value: VIGNETTE_DARKNESS },
        isVignette: { value: true },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse;
        uniform vec2 distortion;
        uniform float vignetteOffset;
        uniform float vignetteDarkness;
        uniform bool isVignette;
        varying vec2 vUv;
        const vec2 CENTER = vec2(0.5);

        vec2 getTransform(vec2 uv) {
          vec2 m = 2.0 * (uv - 0.5);
          vec2 d = (0.88 + distortion * dot(m, m)) * m;
          return d * 0.5 + 0.5;
        }

        void main() {
          vec3 color = vec3(0.0);
          vec2 du = getTransform(vUv);
          if (du.x >= 0.0 && du.x <= 1.0 && du.y >= 0.0 && du.y <= 1.0) {
            color = texture2D(tDiffuse, du).rgb;
          }
          if (isVignette) {
            float dist = distance(vUv, CENTER);
            color *= smoothstep(
              0.8,
              vignetteOffset * 0.799,
              (vignetteDarkness + vignetteOffset) * dist
            );
          }
          gl_FragColor = vec4(color, 1.0);
        }
      `,
    });
    const postScene = new THREE.Scene();
    const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), distortMat));

    // --- Interaction state --------------------------------------------------
    const velocity = new THREE.Vector2(0, 0);
    const pendingDrag = new THREE.Vector2(0, 0);
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let travel = 0;
    let hoverId: string | null = null;
    const pointer = new THREE.Vector2();
    const raycaster = new THREE.Raycaster();

    // Map a screen point through the *same* distortion the shader applies, so
    // the tile we pick is the one visually under the cursor.
    const pickAt = (clientX: number, clientY: number): Cell | null => {
      const rect = renderer.domElement.getBoundingClientRect();
      const ux = (clientX - rect.left) / rect.width;
      const uy = 1 - (clientY - rect.top) / rect.height;
      const mx = 2 * (ux - 0.5);
      const my = 2 * (uy - 0.5);
      const r2 = mx * mx + my * my;
      const dx = (0.88 + DISTORTION * r2) * mx;
      const dy = (0.88 + DISTORTION * r2) * my;
      pointer.set(dx, dy); // already in NDC (-1..1)
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(
        cells.map((c) => c.genreMesh),
        false,
      )[0];
      if (!hit) return null;
      return cells.find((c) => c.genreMesh === hit.object) ?? null;
    };

    const onPointerDown = (e: PointerEvent) => {
      dragging = true;
      travel = 0;
      lastX = e.clientX;
      lastY = e.clientY;
      velocity.set(0, 0);
      hoverId = null; // no spotlight while panning
      container.style.cursor = 'grabbing';
      try {
        renderer.domElement.setPointerCapture(e.pointerId);
      } catch {
        /* no active pointer (e.g. synthetic event) */
      }
    };
    const onPointerMove = (e: PointerEvent) => {
      if (dragging) {
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;
        travel += Math.abs(dx) + Math.abs(dy);
        // Screen-down (dy>0) moves content down → world y decreases.
        pendingDrag.x += dx;
        pendingDrag.y -= dy;
      } else {
        const cell = pickAt(e.clientX, e.clientY);
        const id = cell ? books[cell.bookIndex].id : null;
        if (id !== hoverId) {
          hoverId = id;
          container.style.cursor = id ? 'pointer' : 'grab';
        }
      }
    };
    const onPointerUp = (e: PointerEvent) => {
      if (dragging && travel < CLICK_SLOP) {
        const cell = pickAt(e.clientX, e.clientY);
        if (cell) this.router.navigate(['/book', books[cell.bookIndex].id]);
      }
      dragging = false;
      try {
        renderer.domElement.releasePointerCapture(e.pointerId);
      } catch {
        /* pointer already released */
      }
    };
    // Drag (pointer) only — no wheel hijacking, so the page keeps scrolling
    // normally over this embedded canvas. `data-lenis-prevent-touch` stops the
    // page's smooth-scroll from fighting touch-drags.
    const el = renderer.domElement;
    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointerleave', onPointerUp);
    this.disposers.push(() => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointerleave', onPointerUp);
    });

    // --- Pan + recycle one cell ---------------------------------------------
    const shiftCell = (c: Cell, dx: number, dy: number): void => {
      c.x += dx;
      c.y += dy;
      let changed = false;
      while (c.x > halfX) {
        c.x -= spanX;
        c.col -= cols;
        changed = true;
      }
      while (c.x < -halfX) {
        c.x += spanX;
        c.col += cols;
        changed = true;
      }
      while (c.y > halfY) {
        c.y -= spanY;
        c.row += rows;
        changed = true;
      }
      while (c.y < -halfY) {
        c.y += spanY;
        c.row -= rows;
        changed = true;
      }
      if (changed) {
        const idx = wrap(c.col + c.row * ROW_STRIDE, n);
        if (idx !== c.bookIndex) {
          c.bookIndex = idx;
          c.entry = contentFor(books[idx]);
          c.contentMat.map = c.entry.contentTexture;
          c.contentMat.needsUpdate = true;
          c.genreMat.color.copy(GENRE_GAP[books[idx].genre]);
        }
      }
    };

    // --- Resize -------------------------------------------------------------
    const ro = new ResizeObserver(() => {
      w = container.clientWidth || 1;
      h = container.clientHeight || 1;
      camera.left = -w / 2;
      camera.right = w / 2;
      camera.top = h / 2;
      camera.bottom = -h / 2;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      const p = renderer.getPixelRatio();
      rt.setSize(Math.round(w * p), Math.round(h * p));
    });
    ro.observe(container);
    this.disposers.push(() => ro.disconnect());

    // --- Render loop --------------------------------------------------------
    let camZoom = 1;
    const tick = () => {
      // Hold-to-zoom: ease the camera out while the pointer is held (overview),
      // back in on release — phantom.land-style. The ease means a quick click
      // barely zooms, so click-to-open still works.
      const zoomTarget = dragging ? ZOOM_OUT : 1;
      camZoom += (zoomTarget - camZoom) * 0.12;
      if (Math.abs(camera.zoom - camZoom) > 1e-4) {
        camera.zoom = camZoom;
        camera.updateProjectionMatrix();
      }

      // Per-frame pan delta: live drag while held, else coasting momentum.
      let dx: number;
      let dy: number;
      if (dragging) {
        dx = pendingDrag.x;
        dy = pendingDrag.y;
        pendingDrag.set(0, 0);
        velocity.set(dx, dy);
      } else {
        dx = velocity.x;
        dy = velocity.y;
        velocity.multiplyScalar(FRICTION);
        if (velocity.lengthSq() < 0.01) velocity.set(0, 0);
      }
      // Screen px → world units (more world per px when zoomed out) so the
      // drag keeps tracking the cursor at any zoom.
      const wdx = dx / camZoom;
      const wdy = dy / camZoom;

      for (const c of cells) {
        if (wdx !== 0 || wdy !== 0) shiftCell(c, wdx, wdy);
        c.genreMesh.position.set(c.x, c.y, -0.1);
        c.bgMesh.position.set(c.x, c.y, 0);
        c.contentMesh.position.set(c.x, c.y, 0.1);
        // Hover fills the square with a gradient of the cover-derived colour.
        const isHover = !dragging && hoverId === books[c.bookIndex].id;
        c.h += ((isHover ? 1 : 0) - c.h) * 0.16;
        c.bgMat.uniforms['uColor'].value.copy(c.entry.highlight);
        c.bgMat.uniforms['uHover'].value = c.h;
      }

      renderer.setRenderTarget(rt);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.render(postScene, postCamera);
      this.frame = requestAnimationFrame(tick);
    };
    tick();

    // --- Disposal -----------------------------------------------------------
    this.disposers.push(() => {
      rt.dispose();
      distortMat.dispose();
      (postScene.children[0] as THREE.Mesh).geometry.dispose();
      for (const c of cells) {
        c.genreMat.dispose();
        c.bgMat.dispose();
        c.contentMat.dispose();
      }
      for (const ct of texCache.values()) {
        ct.contentTexture.dispose();
        if (ct.cover) ct.cover.src = '';
      }
      texCache.clear();
    });
  }

  /** Lazily build (and cache) a book's transparent content texture
   *  (centred cover + framed metadata) and its cover-derived hover tint. */
  private buildContent(cache: Map<string, CardTex>, book: Book): CardTex {
    const hit = cache.get(book.id);
    if (hit) return hit;

    const canvas = document.createElement('canvas');
    canvas.width = TEX_SIZE;
    canvas.height = TEX_SIZE;
    const ctx = canvas.getContext('2d')!;
    const contentTexture = new THREE.CanvasTexture(canvas);
    contentTexture.colorSpace = THREE.SRGBColorSpace;
    contentTexture.generateMipmaps = false;
    contentTexture.minFilter = THREE.LinearFilter;

    const highlight = new THREE.Color(GENRE_TINT[book.genre]);
    this.clampTint(highlight);

    const entry: CardTex = { contentTexture, canvas, ctx, highlight };
    cache.set(book.id, entry);

    const repaint = () => {
      this.paintContent(entry, book);
      contentTexture.needsUpdate = true;
    };
    repaint(); // placeholder + metadata immediately

    if (book.cover.lqip) {
      const lq = new Image();
      lq.onload = () => {
        entry.lqip = lq;
        repaint();
      };
      lq.src = book.cover.lqip;
    }
    const img = new Image();
    img.onload = () => {
      entry.cover = img;
      this.deriveTint(entry, img); // hover colour from the real cover
      repaint();
    };
    img.src = book.cover.medium;

    return entry;
  }

  /** Draw the centred cover + metadata frame onto the transparent content canvas. */
  private paintContent(entry: CardTex, book: Book): void {
    const { ctx } = entry;
    const S = TEX_SIZE;
    ctx.clearRect(0, 0, S, S);

    // --- Cover: centred 2:3 portrait, object-fit, rounded -------------------
    const coverW = Math.round(S * 0.42);
    const coverH = Math.round(coverW * 1.5);
    const cx = Math.round((S - coverW) / 2);
    const cy = Math.round((S - coverH) / 2);
    ctx.save();
    this.roundRectPath(ctx, cx, cy, coverW, coverH, 10);
    ctx.clip();
    const art = entry.cover ?? entry.lqip;
    if (art) {
      this.drawCover(ctx, art, cx, cy, coverW, coverH);
    } else {
      ctx.fillStyle = GENRE_TINT[book.genre];
      ctx.fillRect(cx, cy, coverW, coverH);
    }
    ctx.restore();

    // --- Metadata: framed around the cover ---------------------------------
    const padX = 26;
    const corner = (S - padX * 2) * 0.46; // width budget for each top corner
    ctx.textBaseline = 'alphabetic';

    // Author (top-left).
    ctx.textAlign = 'left';
    ctx.fillStyle = '#d8d4f0';
    ctx.font = '600 21px ui-monospace, monospace';
    ctx.fillText(this.ellipsis(ctx, book.author, corner), padX, 50);

    // Title (top-right, up to 2 lines, uppercase).
    ctx.textAlign = 'right';
    ctx.fillStyle = '#f6f4ff';
    ctx.font = '700 22px ui-sans-serif, system-ui, sans-serif';
    let ty = 50;
    for (const line of this.wrapText(ctx, book.title.toUpperCase(), corner, 2)) {
      ctx.fillText(line, S - padX, ty);
      ty += 26;
    }

    // Bottom band: rating (left) · genre pill (centre) · price (right).
    // (publishedYear is a seed default of 2000 for every title — not shown.)
    const by = S - 38;
    ctx.font = '600 20px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#cfcbe8';
    ctx.fillText(`★ ${book.rating.toFixed(1)}`, padX, by);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#f6f4ff';
    ctx.fillText(`€${book.price.amount.toFixed(2)}`, S - padX, by);

    this.drawPill(ctx, book.genre.toUpperCase(), S / 2, by - 7);

    ctx.textAlign = 'left'; // reset shared context state
  }

  /** Outlined rounded pill (genre), centred on (cx, cy). */
  private drawPill(ctx: CanvasRenderingContext2D, label: string, cx: number, cy: number): void {
    ctx.font = '600 16px ui-monospace, monospace';
    const half = 13;
    const w = ctx.measureText(label).width + 26;
    this.roundRectPath(ctx, cx - w / 2, cy - half, w, half * 2, half);
    ctx.strokeStyle = 'rgba(246,244,255,0.55)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#f6f4ff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, cx, cy + 1);
    ctx.textBaseline = 'alphabetic';
  }

  private roundRectPath(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ): void {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  }

  /** Average a cover down to its dominant colour, pushed into a readable mid
   *  range, and store it as the tile's hover-highlight (in place). */
  private deriveTint(entry: CardTex, img: HTMLImageElement): void {
    const s = (this.sampler ??= (() => {
      const canvas = document.createElement('canvas');
      canvas.width = 8;
      canvas.height = 8;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      return { canvas, ctx };
    })());
    try {
      s.ctx.clearRect(0, 0, 8, 8);
      s.ctx.drawImage(img, 0, 0, 8, 8);
      const { data } = s.ctx.getImageData(0, 0, 8, 8);
      let r = 0;
      let g = 0;
      let b = 0;
      let count = 0;
      for (let i = 0; i < data.length; i += 4) {
        const rr = data[i];
        const gg = data[i + 1];
        const bb = data[i + 2];
        const mx = Math.max(rr, gg, bb);
        const mn = Math.min(rr, gg, bb);
        if (mx > 245 && mn > 245) continue; // skip near-white paper/margins
        if (mx < 14) continue; // skip near-black
        r += rr;
        g += gg;
        b += bb;
        count++;
      }
      if (count === 0) return; // keep the genre-tint fallback
      entry.highlight.setRGB(r / count / 255, g / count / 255, b / count / 255);
      this.clampTint(entry.highlight);
    } catch {
      /* tainted canvas (cross-origin cover) — keep the genre tint */
    }
  }

  /** Clamp a colour into a tasteful, text-readable mid range (in place). */
  private clampTint(color: THREE.Color): void {
    const hsl = { h: 0, s: 0, l: 0 };
    color.getHSL(hsl);
    hsl.s = Math.min(Math.max(hsl.s, 0.25), 0.6);
    hsl.l = Math.min(Math.max(hsl.l, 0.34), 0.44);
    color.setHSL(hsl.h, hsl.s, hsl.l);
  }

  private drawCover(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void {
    const ir = img.width / img.height;
    const br = w / h;
    let sw = img.width;
    let sh = img.height;
    let sx = 0;
    let sy = 0;
    if (ir > br) {
      sw = img.height * br;
      sx = (img.width - sw) / 2;
    } else {
      sh = img.width / br;
      sy = (img.height - sh) / 2;
    }
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  }

  private wrapText(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxW: number,
    maxLines: number,
  ): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line);
        line = word;
        if (lines.length === maxLines - 1) break;
      } else {
        line = test;
      }
    }
    if (lines.length < maxLines) lines.push(line);
    const last = lines.length - 1;
    if (lines[last]) lines[last] = this.ellipsis(ctx, lines[last], maxW);
    return lines.filter(Boolean);
  }

  private ellipsis(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
    if (ctx.measureText(text).width <= maxW) return text;
    let t = text;
    while (t.length > 1 && ctx.measureText(`${t}…`).width > maxW) {
      t = t.slice(0, -1);
    }
    return `${t}…`;
  }

  private teardown(): void {
    cancelAnimationFrame(this.frame);
    this.disposers.forEach((d) => d());
    this.disposers = [];
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
  }
}
