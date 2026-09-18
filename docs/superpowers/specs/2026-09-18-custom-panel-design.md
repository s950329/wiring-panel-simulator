# Custom panel builder — approved design

The user approved a dedicated builder with a default 2.5D view, a two-column desktop component library grouped by purpose, click-to-inspect 360° models with verified metadata, drag/drop and click-to-place, a visible positioning grid, quarter-turn rotation, selection tools and undo/redo. Normal wiring and simulation remain separate modes.

Implementation uses existing qualified component models and ProjectDocument schema 1. Authored coordinates snap to 10 scene-units; no claim of measured millimetres or unverified electrical ratings. Baseplate and operation-panel mounts remain distinct. Existing assemblies move/copy with their host; compatible accessories retain explicit attachment slots. Existing fixed equipment wiring and the gateway cannot be removed accidentally.

A preview never changes the live project. Placement checks use actual visible model bounds, other components, ducts and the operation-panel closed/open envelopes. Applying a command rebuilds via ProjectSession, including existing wire routes. Failure/cancellation retains the old project and does not advance undo history. Full hinge sweep physics and editing board dimensions, rails or ducts are not part of this first component-layout editor.

Keyboard R rotates; Escape cancels; Ctrl/Cmd Z and Shift Z undo/redo. Native dialogs contain focus. Construction pointer events cannot activate switches or connect wires. English and Chinese UI remain supported. The full TypeScript/Node suite and online/standalone builds must pass; browser/WebGL visual acceptance remains owner-managed.
