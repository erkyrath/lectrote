
## 1.5.0 (###)

- Universal transcript mode! A transcript is saved for every game you play. Select the "Browse Transcripts" menu option to see a list. Transcripts are displayed as rich text (the same Glk stylesheet as the original game); the "Save as Text" option allows you to save a plain text version.
- Update emglken to 0.6.0 (TADS save/restore bugs, monospace support, increased undo limit; consistent RNG behavior for Glulx interpreters).
- Minor Quixe optimizations.

## 1.4.6  (June 3, 2024)

- The margin preference can now go up to 35%.
- Updated inkjs to 2.2.4.
- Bumped Electron to 29.4.2.
- Mac version now requires MacOS 10.15 "Catalina" or later.

## 1.4.5  (Sep 19, 2023)

- Fix a packaging bug that prevented Adrift from working.

## 1.4.4  (Sep 2, 2023)

- Updates for emglken and glkote. (Experimental Adrift 4 support; various TADS bugs.)
- Updated inkjs to 2.2.2.
- Bumped Electron to 24.8.2.

## 1.4.3  (Jul 21, 2022)

- Fix a path bug in emglken.

## 1.4.2  (Jul 16, 2022)

- Accept ".sav" as a valid file suffix when loading save files (in addition to ".glksave").
- Updated Quixe to 2.2.1 (matching Glulx VM 3.1.3, now with double-precision math).
- Update inkjs to 2.1.0 (matching ink v1.0).
- Update emglken to 0.4.0. (Improved display of TADS status windows; most recent versions of bocfel, hugo, glulxe, and git VMs.)
- Bumped Electron to 18.3.5.

## 1.4.1  (Jan 3, 2022)

- Added a tray icon on Windows. This allows you to quit the app if it is running with no windows open. (Right-click on the tray icon for a Quit menu option.)
- Added Windows ARM and Linux ARM to the release platform list.
- Bumped Electron to 14.2.3.
- Fixed some bugs building bound apps.
- Linting and code cleanup down in the GlkOte library.

## 1.4.0  (Mar 20, 2021)

- TADS save/load works now! Although it's somewhat slow.
- Scrollback buffer is now 800 lines or paragraphs.
- Bumped Electron to 11.3.0.
