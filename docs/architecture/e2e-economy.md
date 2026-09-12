# E2E redundancy audit after #510

This audit asks whether the end-to-end scenarios added by #510 duplicated coverage that already existed.

Two counts are used throughout. A *declaration* is one `Scenario` or `Scenario Outline` written in a feature file. An *execution* is one run of it, so an outline with three `Examples` rows is one declaration and three executions.

## Scope and method

The audit compared what #510 added against what the suite already had.

- Audited: the 258 scenario declarations #510 added, which expand to 275 executions, measured against `4b90ba9f6`, and compared with the 1,382 declarations at `a23d8fb4` and squash merge `2499a1aa6`.
- Method: read the added steps, compare them with nearby existing workflows and with the relevant unit tests, and inspect the Cucumber JSON timing reports that were kept.
- Not assumed: that a matching title or a shared `Background` means two scenarios are redundant, or that a passing suite is a minimal one.
- Finding: there was avoidable duplication. No two scenarios had identical complete step sequences, counting `Background` and ignoring whether a step says Given, When, Then or And. Overlap in what the steps actually exercise still justified four fewer executions.

## Consolidations

Four executions were merged into scenarios that already covered the same path, keeping every assertion.

| Repeated work | Where its assertions now live | Executions removed |
| --- | --- | --- |
| `daily_note_pending` repeated the invalid-day refusal that `document_editing` already had | The existing invalid-day scenario now also checks the button becomes ready again, retries, and checks for page errors | 1 |
| `new_file_pending`: the document example for leaving the page repeated a separate later-visit scenario | The later-visit scenario now also checks the file exists; the short navigation scenario keeps the outline path | 1 |
| `commit_draft_lifecycle`: two scenarios built the same commit preparation, one to check the message survived and one to check the file selection did | One scenario prepares both, checks the retained message and the exact first commit, then commits the excluded file | 1 |
| `node_agent_sessions`: the same stored-session assignment and setup was rebuilt for navigation before reload and again after it | One scenario checks history and current navigation, the unchanged binding and the replies, then history selection and navigation after a reload | 1 |

This removes three declarations plus one `Examples` row. It removes no assertion about history reload, document navigation, retry or partial commits. Assigning a stored session is still a different workflow from creating a fresh session through the UI.

## Escape wait in `new_file_pending`

One scenario was slow for a reason unrelated to what it tested.

- Each dismissal example pressed Escape with the ordinary `I press "Escape"` step while the server's replies were deliberately held back. That step's built-in settling wait cost 10.368 seconds per example, as recorded in the kept report `new-file-lifecycle-fixed.json`.
- The step now reads `without waiting`, which skips that settling wait. The next assertion still waits for the form to close before reopening it, so nothing is checked earlier than before.
- This changes how the test synchronizes, not the app's timeout or behavior.
- The follow-up's targeted run passes 39 scenarios / 472 steps across all five changed feature files.
- The two dismissal scenarios now take 1.346s and 1.382s in `e2e-economy.json`, against 11.689s and 11.711s in the earlier record. Their Escape steps take roughly 1.5ms each.
- This is an observed local comparison, not a promised reduction in parallel CI wall time. No full suite was launched while the maintainer's separate manual CI run was in progress.

## Overlap with unit tests, kept on purpose

These browser scenarios cover behavior that unit tests also cover, because the browser path is where it has actually broken.

| Unit coverage | What the browser workflow additionally observes |
| --- | --- |
| `chat/server/readings.test.ts` and `browser/agents/page-owners.test.ts`: shared reading and page lease lifetimes | Two tabs and several folds, plugin rebuild, server restart, shared head/foot on the page, and one reader leaving while another remains usable |
| `chat/scoped.test.ts`: idle and capacity eviction, refused starts, scope state | The refusal being visible in the row menu, the fold opening after start, Needs you/Chats standings, clicking to resume, the rendered transcript, and prompts and questions after recovery |
| `chat/succession.test.ts`: missing intermediate sessions, agent boundaries and cycles | Creating real distinct sessions, choosing fresh, historical or current, the agent-line identity and fold/page history navigation. The cycle permutations stay below the browser |
| `chat/attachments.test.ts` and `browser/chat/attach.test.ts`: chunking, cumulative cap, ownership, concurrent writes | The real file picker and drop, asynchronous file reads, previews and drafts surviving, the filenames the server resolves, the RPC upload, and the agent reading the resulting bytes |
| `chat/questions.test.ts`: unique registry IDs, rejecting foreign and late answers | Draft answers staying separate in the rendered forms across node selection, drawer remount and agent restart, followed by submitting them |
| `outlines/browser/edit/undoing.test.ts`: pending undo entries, failed replay, older history | The real ordering of blur-save and key events, retained text, and Undo and Redo in the browser. The refusal permutations stay below the browser |
| `pins/browser/reorder.test.ts`: gap and neighbor arithmetic | Held mouse gestures, Escape and secondary-button handling, the shelf changing under the gesture, indicator cleanup, and a later reorder with Undo |
| `ops/plan.test.ts`: title and property preconditions, refusing a removed pin | The browser capturing and sending the original baseline, the refusal staying visible, and the draft staying correctable |
| `git/browser/commit/selection.test.ts`: deriving the selected files | The prepared state surviving a plugin rebuild, and the resulting Git commit containing exactly the reviewed files |

These are overlaps in behavior, not evidence that the unit tests exercise the browser path. Several #510 fixes were exactly that: working logic underneath, wired to the wrong UI state or request.

The two pending-note Undo scenarios were also kept. One starts with no earlier undo entry and checks Redo; the other has an earlier title entry that Undo must not consume. Dropping the empty-history case could hide a shortcut that wrongly concludes there is nothing to undo while the first save is still in flight. In the same way, removing the drag source versus removing its destination, pin lists of the same size versus reordered ones, phone versus desktop entry points, and reload versus server restart each drive different data, handlers or lifetimes. Similar wording is not a reason to delete them.

## Recorded cost and limits

Timings come from reports of past runs, so they bound the suite's cost loosely rather than benchmarking it.

- The 248 kept local JSON reports supplied passing samples for 272 of the 275 added executions.
- Their selected recorded durations total roughly 802 seconds if run one after another, including recorded hooks. These are mixed historical runs, not a controlled before-and-after benchmark, and not an estimate of remote CI wall time.
- Three keyboard-selection cases did not match the current names or paths in this collection of reports. That does not mean they were never run.
- Samples from those records: the full 50 MiB attachment and hash workflow took 4.11s; navigating nine nodes at capacity took 16.71s; the three idle-timer cases took 9.20s to 10.01s each.
- Reconnect cases spend about 10s waiting for the production connection state to become "reconnecting". That wait is doing real work, unlike the Escape wait corrected above.
- The audit supports these specific merges and the one synchronization fix. It does not support the claim that no browser test covers anything a unit test covers, nor the claim that all redundancy has been ruled out.
- Future additions should name the browser-specific failure they catch, and extend an existing workflow whenever its setup and outcome already cover the same path.
