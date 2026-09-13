import type {ComponentInstance} from '../src/core/component.ts';
import type {ActionOf, ComponentDefinition, MomentaryState, OverloadState, TerminalDefinition} from '../src/core/contracts.ts';

// Compile-only negative cases. Each expect-error must correspond to a real compiler rejection.
function contracts(
  button: ComponentInstance<MomentaryState, ActionOf<'press' | 'release'>>,
  overload: ComponentInstance<OverloadState, ActionOf<'trip' | 'reset' | 'setCurrent'>>,
  definition: ComponentDefinition,
) {
  button.dispatch({type: 'press'});
  overload.dispatch({type: 'setCurrent', value: 15});
  // @ts-expect-error A momentary button has no overload-trip action.
  button.dispatch({type: 'trip'});
  // @ts-expect-error Current must be numeric.
  overload.dispatch({type: 'setCurrent', value: '15'});
  // @ts-expect-error State can only change through the behavior API.
  button.state.pressed = true;
  // @ts-expect-error Button state has no generic on/off flag.
  button.state.on;
  // @ts-expect-error A product definition cannot contain an instance's location.
  definition.x;
  // @ts-expect-error Every terminal requires an explicit exit direction.
  const terminal: TerminalDefinition = {id: 'A1', localPosition: [0, 0, 0], electricalRole: 'unverified'};
  return terminal;
}
void contracts;
