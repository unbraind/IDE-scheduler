# Changelog

## [0.0.14] - 2025-08-31

### Fixed
- Correct icon usage across all extension surfaces:
  - Marketplace tile icon now points to a light/neutral variant via `icon: assets/icons/scheduler-icon-light.png` to avoid dark-on-dark rendering in the store.
  - Activity Bar icon now uses proper theme-specific mappings (`contributes.viewsContainers.activitybar[0].icon`):
    - `light`: `assets/icons/scheduler-icon-light.png`
    - `dark`: `assets/icons/scheduler-icon-dark.png`
  - Command icon for `kilo-scheduler.openKiloCodeExtension` corrected to use theme-appropriate assets (previously reversed):
    - `light`: `assets/icons/scheduler-icon-light.png`
    - `dark`: `assets/icons/scheduler-icon-dark.png`

### Removed
- Deleted obsolete icon assets no longer referenced anywhere:
  - `assets/icons/kilo-dark.svg`
  - `assets/icons/kilo-light.svg`
  - `assets/icons/roo-icon-black.svg`
  - `assets/icons/roo-icon-white.svg`
  - `assets/icons/scheduler-icon.png`
  - `assets/icons/scheduler-icon.svg`

### Added
- New themed icons used consistently throughout the extension:
  - `assets/icons/scheduler-icon-light.png`
  - `assets/icons/scheduler-icon-dark.png`
- Experimental setting to show active schedules count as an Activity Bar badge:
  - Setting key: `kilo-scheduler.experimental.activityBadge`
  - When enabled, the Kilo Scheduler icon in the Activity Bar shows the number of active schedules; hidden when zero.

### Changed
- Bumped extension version to `0.0.14`.
- Normalized icon references in `package.json` to use theme-aware objects where applicable.

### Notes
- All references to removed icons were audited and updated to the new scheduler icons. `.vscodeignore` already includes `!assets/icons/**`, so the new icons are packaged correctly in the VSIX.

## [0.0.11] - 2025-05-31

### Added
- Upgraded to Roo Code's latest custom_modes.yaml support

## [0.0.10] - 2025-04-25

### Fixed
- Resolved an issue where `startDate` was set by default.

### Changed
- Updated scheduling logic for interval-based tasks:
  - **If a start date/time is specified:** Intervals are now calculated from the original start time. For example, for an hourly task with a start time of 10:00am, if execution is delayed (e.g., due to inactivity or the computer being off/in deep sleep) and the task runs at 10:15am, the next execution is scheduled for 11:00am.
  - **If no start time is specified:** The interval is calculated from the last execution time. For example, if the last execution was at 10:15am, the next execution will be at 11:15am.
- Updated "Usage Tips" in the README
