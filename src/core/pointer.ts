import type {SceneHit} from '../scene.ts';
export interface PointerGesture {
  id: number; x: number; y: number; lastX: number; lastY: number;
  hit: SceneHit | null; moved: boolean; startPosition: number; startCurrent: number;
}
export interface PinchGesture {distance: number; radius: number}
