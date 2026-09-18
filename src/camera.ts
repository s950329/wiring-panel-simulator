import * as T from 'three';
// Read the breaker/contactors from their nameplate side. Pushing the breaker
// forward from this view moves its linked lever away from the viewer.
export const DEFAULT_AZIMUTH = -Math.PI / 2;
export const clampElevation = (v: number) => Math.max(0, Math.min(Math.PI / 2, v));
export function cameraBasis(azimuth: number, elevation: number): {right: [number, number, number]; up: [number, number, number]; back: [number, number, number]} { const s = Math.sin(azimuth), c = Math.cos(azimuth), sp = Math.sin(elevation), cp = Math.cos(elevation); return { right: [c, 0, -s], up: [-s * sp, cp, -c * sp], back: [s * cp, sp, c * cp] }; }
export class HemisphereCamera {
    camera: T.PerspectiveCamera | T.OrthographicCamera;
    aspect = 1;
    azimuth: number;
    elevation: number;
    radius: number;
    target: T.Vector3;
    minRadius?: number;
    maxRadius?: number;
    fitRadius?: number;
    hasResized?: boolean;
    constructor(camera: T.PerspectiveCamera | T.OrthographicCamera) { this.camera = camera; this.azimuth = DEFAULT_AZIMUTH; this.elevation = 1.03; this.radius = 1060; this.target = new T.Vector3(0, 0, 5); this.update(); }
    update() { this.elevation = clampElevation(this.elevation); this.radius = Math.max(this.minRadius || 280, Math.min(this.maxRadius || 2400, this.radius)); const b = cameraBasis(this.azimuth, this.elevation); this.camera.position.copy(this.target).addScaledVector(new T.Vector3(...b.back), this.radius); const m = new T.Matrix4().makeBasis(new T.Vector3(...b.right), new T.Vector3(...b.up), new T.Vector3(...b.back)); this.camera.quaternion.setFromRotationMatrix(m); this.camera.updateMatrixWorld();
        if (this.camera instanceof T.OrthographicCamera) {
            const halfHeight = this.radius * Math.tan(20 * Math.PI / 180);
            Object.assign(this.camera, {left: -halfHeight * this.aspect, right: halfHeight * this.aspect, top: halfHeight, bottom: -halfHeight});
            this.camera.updateProjectionMatrix();
        } }
    orbit(dx: number, dy: number) { this.azimuth -= dx * .006; this.elevation = clampElevation(this.elevation + dy * .006); this.update(); }
    zoom(d: number) { this.radius *= Math.exp(d * .001); this.update(); }
    preset(name: string) { this.target.set(0, 0, 5); this.azimuth = DEFAULT_AZIMUTH; this.radius = this.fitRadius || 1060; this.elevation = name === 'top' ? Math.PI / 2 : name === 'side' ? 0 : name === 'construction' ? 1.33 : 1.03; this.update(); }
}
