
## 1.5.5 (Jul 13, 2025)

- Fixed a crash with Z-machine games that put the header extension in static memory. (Generated by a recent version of the Dialog compiler.)
- Accept Ink games that have been exported for play (.js suffix).
- Fixed an autosave bug for Ink games version 18 and up.
- Updated inkjs to 2.3.2.

## 1.5.4 (Jun 4, 2025)

- Glk spec 0.7.6: the glk_image_draw_scaled_ext() call.
- Bumped Electron to 34.5.7.

## 1.5.3 (Feb 22, 2025)

- Added a "Retain Transcripts" preference: "Forever", "Last N transcripts", "For N days". Defaults to "Forever", which was the previous behavior.
- If you open a game and its transcript at the same time, game updates will appear in the transcript window.
- If you open the same game in two windows, they will have separate transcripts. Also, the second one will not try to use the autosave slot. (Two windows fighting over the same autosave is bad.)
- The build process now produces a "Lectrote-X.Y.Z-WinInstall.exe" installer product (using makensis). This installs the win32-x64 version.
- Bumped Electron to 33.4.1.

## 1.5.2 (Dec 2, 2024)

- Fixed the Find menu options in game windows. They now also work in transcript windows.

## 1.5.1 (Oct 12, 2024)

- Added a "Show File Location" menu option (shows the current game file or transcript file in the OS file browser).
- Show the text "Image N" or the provided alt text where an image was displayed in the original game. (Story windows only).
- If the timestamp option is on for a transcript window, saving as text will include timestamps in the text file.
- Bumped Electron to 31.7.0.

## 1.5.0 (Sep 29, 2024)

- Universal transcript mode! A transcript is saved for every game you play. Select the "Browse Transcripts" menu option to see a list. Transcripts are displayed as rich text (the same Glk stylesheet as the original game); the "Save as Text" option allows you to save a plain text version.
- Updated emglken to 0.6.0 (fixed TADS save/restore bugs, monospace support, increased undo limit; consistent RNG behavior for Glulx interpreters; fixed a Unicode bug).
- Updated inkjs to 2.3.0.
- Minor Quixe optimizations.

## 1.4.6  (Jun 3, 2024)

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
