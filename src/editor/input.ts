export type EditorShortcut = 'rotate' | 'copy' | 'delete' | 'cancel' | 'undo' | 'redo';
type Keys = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>;
export function crossedDragThreshold(dx: number, dy: number): boolean { return Math.hypot(dx, dy) > 6; }
/** Never intercept text editing or native dialog navigation. */
export function editorShortcut(e: Keys, typing: boolean, modal: boolean): EditorShortcut | null {
    if (typing || modal || e.altKey) return null;
    const key = e.key.toLowerCase(), command = e.ctrlKey || e.metaKey;
    if (command) {
        if (key === 'z') return e.shiftKey ? 'redo' : 'undo';
        if (key === 'y') return 'redo';
        if (key === 'd') return 'copy';
        return null;
    }
    if (key === 'r') return 'rotate';
    if (key === 'escape') return 'cancel';
    if (key === 'delete' || key === 'backspace') return 'delete';
    return null;
}

/** Suppress the legacy wire panel's global shortcuts while builder owns input. */
export function editorOwnsWiringKey(key: string): boolean { return ['delete', 'backspace', 'escape'].includes(key.toLowerCase()); }
