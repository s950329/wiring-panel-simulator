import type {TerminalView, Vec3} from './core/contracts.ts';
export interface LabelOptions {bg?: string; fg?: string; size?: number; rotation?: number; border?: boolean}
export interface TerminalOptions {brass?: boolean; labelText?: string | null; scale?: number; exitDirection?: Vec3 | null}
import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
export const mat = {
    black: new T.MeshStandardMaterial({ color: 0x1e2222, roughness: .48 }), dark: new T.MeshStandardMaterial({ color: 0x0d1112, roughness: .68 }),
    gray: new T.MeshStandardMaterial({ color: 0xaeb1b4, roughness: .47 }), white: new T.MeshStandardMaterial({ color: 0xdadcd7, roughness: .42 }),
    cream: new T.MeshStandardMaterial({ color: 0xdadcd0, roughness: .27, metalness: .16 }), duct: new T.MeshStandardMaterial({ color: 0x9b9c98, roughness: .44 }),
    steel: new T.MeshStandardMaterial({ color: 0xb7c0c2, metalness: .82, roughness: .29 }), zinc: new T.MeshStandardMaterial({ color: 0x91999b, metalness: .74, roughness: .45 }),
    brass: new T.MeshStandardMaterial({ color: 0xa59150, metalness: .77, roughness: .36 }), yellow: new T.MeshStandardMaterial({ color: 0xe5b100, roughness: .38 }),
    glass: new T.MeshPhysicalMaterial({ color: 0xeaf4ff, transmission: .68, opacity: .48, transparent: true, roughness: .13, metalness: .05, depthWrite: false }),
};
const geometryCache = new Map<string, T.BufferGeometry>();
let activeGeometryCache = geometryCache;
/** @template R @param {() => R} build @returns {R} */
export function withLocalGeometry<R>(build: () => R): R { const before = activeGeometryCache; activeGeometryCache = new Map(); try {
    return build();
}
finally {
    activeGeometryCache = before;
} }
export const isSharedGeometry = (geometry: T.BufferGeometry) => [...geometryCache.values()].includes(geometry);
export const isSharedMaterial = (material: T.Material) => Object.values(mat).some(shared => shared === material);
export function box(g: T.Object3D, w: number, h: number, d: number, x = 0, y = 0, z = 0, m: T.Material = mat.black, r = 0) { let k = `b${w},${h},${d},${r}`; let geo = activeGeometryCache.get(k); if (!geo) {
    geo = r ? new RoundedBoxGeometry(w, h, d, 2, r) : new T.BoxGeometry(w, h, d);
    activeGeometryCache.set(k, geo);
} const o = new T.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; g.add(o); return o; }
export function cyl(g: T.Object3D, r: number, h: number, x: number, y: number, z: number, m: T.Material = mat.steel, n = 24, r2 = r) { let k = `c${r},${r2},${h},${n}`; let geo = activeGeometryCache.get(k); if (!geo) {
    geo = new T.CylinderGeometry(r, r2, h, n);
    activeGeometryCache.set(k, geo);
} const o = new T.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; g.add(o); return o; }
export function ring(g: T.Object3D, r: number, t: number, x: number, y: number, z: number, m: T.Material = mat.steel) { let k = `r${r},${t}`; let geo = activeGeometryCache.get(k); if (!geo) {
    geo = new T.TorusGeometry(r, t, 7, 32);
    activeGeometryCache.set(k, geo);
} const o = new T.Mesh(geo, m); o.rotation.x = -Math.PI / 2; o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; }
export function screw(g: T.Object3D, x: number, y: number, z: number, scale = 1, m: T.Material = mat.steel) { const s = new T.Group(); s.position.set(x, y, z); g.add(s); cyl(s, 4.4 * scale, 1.2 * scale, 0, 0, 0, m, 16); cyl(s, 3.6 * scale, 2.6 * scale, 0, 1.6 * scale, 0, m, 16, 4.2 * scale); box(s, 5 * scale, .26 * scale, .8 * scale, 0, 3.05 * scale, 0, mat.dark); box(s, .9 * scale, .26 * scale, 4.6 * scale, 0, 3.06 * scale, 0, mat.dark); s.rotation.y = (x * 31 + z * .21) % 1.8; return s; }
export function label(g: T.Object3D, text: string, w: number, d: number, x: number, y: number, z: number, { bg = '#dbded3', fg = '#212726', size = 30, rotation = 0, border = false }: LabelOptions = {}) { const c = document.createElement('canvas'); c.width = Math.max(128, Math.round(w * 8)); c.height = Math.max(64, Math.round(d * 8)); const ctx = c.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context is unavailable'); ctx.fillStyle = bg; ctx.fillRect(0, 0, c.width, c.height); if (border) {
    ctx.strokeStyle = fg;
    ctx.lineWidth = 2;
    ctx.strokeRect(3, 3, c.width - 6, c.height - 6);
} const lines = text.split('\n'); ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `600 ${Math.min(c.height / (lines.length + 0.25) * .78, size * c.width / 200)}px Arial, sans-serif`; lines.forEach((s, i) => ctx.fillText(s, c.width / 2, c.height * (i + .5) / lines.length, c.width - 6)); const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4; const o = new T.Mesh(new T.PlaneGeometry(w, d), new T.MeshStandardMaterial({ map: tex, roughness: .53, side: T.DoubleSide })); o.rotation.x = -Math.PI / 2; o.rotation.z = rotation; o.position.set(x, y, z); g.add(o); const photoKey = text.startsWith('SHIHLIN  S-P16') ? 'sp16-nameplate.png' : text.includes('S-C21L') ? 'sc21l-nameplate.png' : text.startsWith('SHIHLIN   AP-22') ? 'ap22-top-label.png' : text === '儀表用電源' ? 'power-supply-label.png' : null; if (photoKey && typeof window !== 'undefined') {
    const url = window.WIRING_TEXTURES?.[photoKey] || '/textures/' + photoKey;
    new T.TextureLoader().load(url, t => { if (o.material.userData.projectDisposed) {
        t.dispose();
        return;
    } t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; const old = o.material.map; o.material.map = t; if (old && old !== t)
        old.dispose(); o.material.transparent = true; o.material.alphaTest = .1; o.material.needsUpdate = true; });
} return o; }
export function tube(g: T.Object3D, points: readonly Vec3[], r: number, m: T.Material = mat.black) { const curve = new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p))); const o = new T.Mesh(new T.TubeGeometry(curve, 48, r, 10, false), m); o.castShadow = true; g.add(o); return o; }
export function hit<O extends T.Object3D>(o: O, action: string, extra: Record<string, unknown> = {}): O { o.userData = { ...o.userData, action, ...extra }; return o; }
export function terminal(g: T.Object3D, store: TerminalView[], id: string, x: number, y: number, z: number, { brass = false, labelText = null, scale = 1, exitDirection = null }: TerminalOptions = {}) { const t = new T.Group(); t.position.set(x, y, z); g.add(t); box(t, 11 * scale, 2.5 * scale, 12 * scale, 0, -1, 0, brass ? mat.brass : mat.zinc, .5); screw(t, 0, 1, 0, scale, brass ? mat.brass : mat.steel); const target = cyl(t, 6 * scale, 5 * scale, 0, 2, 0, new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }), 12); hit(target, 'terminal', { terminal: id }); store.push({ id, object: t, hit: target, local: [x, y, z], scale, definition: { id, localPosition: [x, y, z], exitDirection: exitDirection || [0, 0, z >= 0 ? 1 : -1], electricalRole: 'unverified' } }); if (labelText)
    label(g, labelText, 10, 6, x, y + .05, z - 10, { bg: '#202525', fg: '#c8cdcb', size: 22 }); return t; }
export function mountingFoot(g: T.Object3D, w: number, d: number) { box(g, w, 5, d, 0, 2.5, 0, mat.gray, 2); for (const x of [-w / 2 + 8, w / 2 - 8])
    for (const z of [-d / 2 + 7, d / 2 - 7]) {
        box(g, 6, 1, 10, x, 5.1, z, mat.dark, 2);
    } }
export function rail(g: T.Object3D, length: number, width = 37) { box(g, width - 8, 2, length, 0, 1, 0, mat.zinc); box(g, 2, 7, length, -width / 2 + 3, 4, 0, mat.steel); box(g, 2, 7, length, width / 2 - 3, 4, 0, mat.steel); box(g, 6, 1.6, length, -width / 2 + 3, 8, 0, mat.steel); box(g, 6, 1.6, length, width / 2 - 3, 8, 0, mat.steel); for (let z = -length / 2 + 18; z < length / 2; z += 38)
    box(g, 5, 0.3, 17, 0, 2.3, z, mat.cream, 2); screw(g, 0, 2, -length / 2 + 12); screw(g, 0, 2, length / 2 - 12); }
export function duct(g: T.Object3D, length: number, width = 43) { box(g, width, 2.6, length, 0, 1.3, 0, mat.duct); for (const x of [-width / 2 + 1.4, width / 2 - 1.4]) {
    box(g, 2.8, 8, length, x, 6, 0, mat.duct);
    for (let z = -length / 2 + 3; z < length / 2 - 2; z += 12) {
        box(g, 2.7, 28, 7.6, x, 23, z, mat.duct, 1.1);
        box(g, 5.6, 4, 8, x, 38, z, mat.duct, 1.1);
    }
} for (let z = -length / 2 + 28; z < length / 2; z += 70) {
    box(g, 7, .25, 20, 0, 2.75, z, mat.cream, 2);
} screw(g, 0, 3, -length / 2 + 22); screw(g, 0, 3, length / 2 - 22); }
