/**
 * THE DRESSINGS THIS APP INSTALLS — one import per folder, for the effect.
 *
 * The seam (`./seam.ts`) is a table and a lay-out and imports NO dressing;
 * this is the one module that names them, so "which properties are live in
 * olai" is one list in one place rather than a set of imports scattered
 * wherever somebody first needed a component.
 *
 * SIDE-EFFECT IMPORTS, deliberately, and the shape says what it is: each
 * folder registers itself at module load (`./kolu-terminal/index.ts`,
 * `./odu-ci/index.ts`, which argue the reversal from the drawer-registers
 * arrangement this replaced). What a consumer does is import THIS, once, to
 * mean "the app's faces are installed" — `../props/PropsDrawer.tsx` does, and
 * it is the only importer.
 *
 * `./duration/` is not here, and that is not an omission: the ⏱ chip is a live
 * face with no property key to hang off, so it registers nothing and is drawn
 * by the row instead. Its own header argues that in full, including what
 * moving it onto the table would take.
 */

import "./kolu-terminal/index.ts"
import "./odu-ci/index.ts"
