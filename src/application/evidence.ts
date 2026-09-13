import type {SimulationController} from './simulation.ts';

/** Focusing another component may release a held input; never restore evidence from before that release. */
export function locateEvidence(simulation: SimulationController, wireIds: readonly string[],
  locate: () => void, highlight: (ids: readonly string[]) => void): boolean {
  const key = () => {
    const {mode, result} = simulation.snapshot();
    if (!result) return JSON.stringify({mode, result});
    const {iterations: _iterations, ...evidence} = result;
    return JSON.stringify({mode, evidence});
  };
  const before = key(); locate(); const current = before === key();
  highlight(current ? wireIds : []); return current;
}
