# Wiring Panel Simulator

[English](README.md) | [繁體中文](README.zh-TW.md)

A browser-based **3D industrial wiring simulator** for practicing wiring, understanding control circuits, and testing circuit behavior without a physical training panel.

> **Work in progress.** This project is intended for education and training only.

**[Live Demo](https://leo-wiring-panel.leochien0808.chatgpt.site)**

## Why this project?

Industrial wiring is usually learned with physical training equipment. Once class is over, however, most learners do not have a wiring panel at home.

This project began with a simple question:

> **Can I continue practicing industrial wiring in a browser when I do not have access to the physical panel?**

Wiring Panel Simulator recreates the essential learning experience in 3D. It focuses on identifying components, connecting terminals, inspecting wire routes, operating controls, and observing basic circuit behavior—not merely drawing a schematic.

## Features

- **Interactive 3D panel** — rotate through 360°, zoom, and inspect the equipment from different angles.
- **Terminal-to-terminal wiring** — select two terminals to create a connection.
- **Automatic wire routing** — route wires through available cable ducts and 3D space while checking component collisions and wire spacing.
- **Movable operation panel** — open the panel to access rear terminals and validate wiring in both open and closed positions.
- **Electrical simulation** — operate circuit breakers, NO/NC push buttons, magnetic contactors, auxiliary contacts, thermal overload protection, indicator lamps, buzzers, and a basic three-phase motor circuit.
- **Visual feedback** — highlight selected wires, active indicators, conductive paths, and diagnostic evidence.
- **JSON import/export** — save and restore complete wiring projects without replacing the current project when validation fails.
- **Automated validation** — test electrical logic, routing, geometry, component behavior, and project compatibility independently from WebGL rendering.
- **Standalone build** — generate a single HTML file that runs locally in a modern browser.
- **Interface languages** — Traditional Chinese and English, selected from browser preferences with a saved manual choice; supported in both the web and standalone versions.

## Current training scenarios

The simulator currently focuses on basic motor-control training. Two ready-to-import examples are included:

- [`examples/a04-motor-start.project.json`](examples/a04-motor-start.project.json) — a complete direct-on-line motor starter.
- [`examples/board-024-classroom.project.json`](examples/board-024-classroom.project.json) — the classroom control-circuit exercise.

The A04 example demonstrates the following sequence:

```text
QF1 ON
   ↓
Press START
   ↓
MC1 energizes
   ↓
The auxiliary contact creates a holding circuit
   ↓
The motor runs

Press STOP or trip the thermal overload
   ↓
MC1 releases and the motor stops
```

## Quick start

### Requirements

- Node.js 22 (CI uses 22.16.0)
- npm
- A modern browser with WebGL 2 and hardware acceleration

### Run locally

```bash
git clone https://github.com/s950329/wiring-panel-simulator.git
cd wiring-panel-simulator
npm ci
npm run dev
```

Vite will print the local development URL in the terminal.

## Basic usage

1. Drag on empty space to rotate the panel.
2. Select the first terminal.
3. Select the destination terminal.
4. Let the simulator calculate the wire route.
5. Complete the circuit.
6. Close the operation panel.
7. Enter test mode, switch QF1 on, and operate the circuit.

You do not need to draw wires manually in the 3D scene.

## Development and testing

```bash
npm test                 # Full validation suite
npm run test:electrical  # Electrical simulation tests
npm run typecheck        # TypeScript checks
npm run build            # Production build
npm run offline          # Standalone HTML
```

The application separates the **electrical model**, **routing logic**, and **3D presentation**, so core behavior can be tested without relying on WebGL.

All authored application code, tools, and tests are **strict TypeScript**, including the optional Node Playwright browser checks; Python is not required. Browser JavaScript is generated during the build. See the [TypeScript development guide](docs/typescript-migration.md) for compiler coverage, CLI tools, and optional browser verification.

For implementation details, see:

- [`ARCHITECTURE.md`](ARCHITECTURE.md)
- [`docs/electrical-user-guide.md`](docs/electrical-user-guide.md)
- [`docs/electrical-models.md`](docs/electrical-models.md)
- [`docs/project-format.md`](docs/project-format.md)

## Roadmap

- [x] Interactive 3D training panel
- [x] Terminal-based wiring and automatic routing
- [x] Movable operation panel
- [x] JSON import/export
- [x] Basic control-circuit and motor-start simulation
- [x] Automated electrical, routing, geometry, and project tests
- [ ] More industrial components and training circuits
- [ ] Clearer circuit diagnostics and error explanations
- [ ] More configurable training panels
- [ ] A more complete beginner learning mode

## Contributing

**Translations:** To add a language, create a catalog in `src/i18n/locales/` and register it in `src/i18n/registry.ts`; the language selector and browser detection use that registry. See the [localization guide](docs/localization.md#add-a-language) for examples, placeholder and fallback rules, and validation.

Bug reports, suggestions, and pull requests are welcome. Contributions are especially useful in these areas:

- Adding or validating industrial components
- Correcting terminal definitions or electrical behavior
- Improving automatic wire routing
- Adding training exercises
- Improving documentation, accessibility, and learning experience

Both software engineering and electrical or industrial-automation experience are valuable. Please open an issue before starting a large change so the design can be discussed first.

## Safety

This simulator is for **education, training, and simulation only**.

Some component dimensions, terminal arrangements, and electrical behavior are based on training materials, photographs, and observed equipment. They may not exactly match a particular manufacturer or model.

The simulator does not replace:

- Manufacturer documentation
- Verified engineering drawings
- Applicable electrical codes and regulations
- Qualified electrical instruction

**Do not use simulation results as the sole basis for wiring real energized equipment.**

## License

This project is **source-available**, not OSI open source. It is licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE).

Noncommercial use, study, modification, and distribution are permitted under the license. Commercial use requires a separate license from the project owner.
