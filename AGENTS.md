# Agent guidance

- Repository root contains the Safari extension project; most source lives inside the quoted ` SarahGiggarExtension` directory. Use quotes or tab-completion when changing into paths that contain leading spaces.
- Follow the workspace policy of using `rg` instead of `ls -R` or `grep -R` for searching.
- The extension code is split into shared Safari extension assets (`Shared (Extension)/`), host apps for iOS/macOS (`iOS (App)/`, `macOS (App)/`), and platform-specific extension wrappers (`iOS (Extension)/`, `macOS (Extension)/`).
- Popup/content/service-worker scripts rely on `popup.js`, `content.js`, and `background.js` under `Shared (Extension)/Shared (Extension)/Resources/`. Keep messaging keys and request payloads consistent across these files.
- Native Swift code for the host apps lives under the `Shared (App)/`, `iOS (App)/`, and `macOS (App)/` folders. Preserve existing bundle identifiers and extension identifiers when making changes.
- No automated tests are present; after changes, manually sanity-check builds or extension flows where applicable.
- Commit messages should summarize the change clearly.
