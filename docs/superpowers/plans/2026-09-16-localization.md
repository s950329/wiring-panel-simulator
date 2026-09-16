# Chinese / English localization

## Design

The locale is presentation state, not project or simulation state. Start from a saved manual choice, otherwise walk `navigator.languages` in preference order (falling back to `navigator.language`); use English when no supported locale matches. The native select beside Download HTML offers browser default, 繁體中文, and English. Manual choices survive reloads where storage is available, but blocked storage must not prevent use. Browser language changes only affect automatic mode.

Keep the existing canonical Chinese messages in the framework-free application and pure simulation core. A source-message catalog (gettext-style keys, positional placeholders) provides translations. The presentation adapter translates only registered messages in text nodes and accessibility attributes. It retains the original source for live retranslation; never replaces controls or sends application actions. Explicit ignore boundaries protect project names and raw identifiers. New languages add a catalog plus one registry entry. Incomplete future catalogs fall back to English, then source Chinese. No remote translation requests or new runtime dependencies.

## Implementation and verification

- [x] Add failing core tests for locale negotiation, preference precedence, storage errors, placeholder preservation, fallback and repeated source updates.
- [x] Implement the locale registry, catalogs and pure controller / source-message formatter.
- [x] Add the UI adapter and native select, document metadata and browser language event handling. Protect user-authored values and remove the wiring prompt's DOM-as-state dependency.
- [x] Verify English coverage of current source messages and nested diagnostics; test source restoration without replacing controls or modifying application data.
- [ ] Advance WIRE-R20 and legacy snapshot compatibility, build online / single-file outputs from the same source, and run regression checks.
- [ ] Publish a focused Git commit based on current remote main; do not replace the concurrent bilingual README/license changes. Verify the remote revision and report the actual validation status.

The owner performs visual/WebGL acceptance. Locale tests must not require WebGL.
