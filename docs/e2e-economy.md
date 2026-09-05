# E2E redundancy audit after #510

Audited the merged PR's 258 added scenario declarations (275 executions after
expanding Examples), relative to `4b90ba9f6`, against the 1,382 declarations at
`a23d8fb4` / squash merge `2499a1aa6`. The audit read the added steps, compared
nearby existing workflows and relevant lower-level tests, and inspected retained
Cucumber JSON timings. It does not equate matching titles or shared setup with
redundancy, nor passing tests with proof that a suite is mathematically minimal.

The initial answer is **there was avoidable duplication**. No identical complete
step sequences (including Background, ignoring Given/When/Then/And spelling)
were found, but semantic overlap justified four fewer scenario executions.

## Consolidations in this follow-up

| Repeated work | Where its assertions now live | Executions removed |
| --- | --- | --- |
| `daily_note_pending`: invalid-day refusal repeated the existing `document_editing` invalid-day scenario | Existing invalid-day scenario now also asserts button readiness, retries and checks for page errors | 1 |
| `new_file_pending`: the document example for explicit navigation repeated the separate later-visit scenario | Later-visit scenario also asserts file existence; the short navigation scenario retains the outline path | 1 |
| `commit_draft_lifecycle`: two scenarios separately rebuilt the same commit preparation for message and file-selection retention | One scenario prepares both, checks the retained message and exact first commit, then commits the excluded file | 1 |
| `node_agent_sessions`: repeated stored-session assignment/setup for navigation before and after reload | One scenario checks history/current navigation, unchanged binding, replies, then history selection and navigation after reload | 1 |

This removes three declarations plus one Examples execution. It does not remove
history reload, document navigation, retry or partial-commit assertions. The
stored-session assignment workflow remains distinct from creating fresh sessions
through the UI.

A separate cost was found in `new_file_pending`: each dismissal example used
ordinary `I press "Escape"` while incoming responses were deliberately held.
Its key-settling wait consumed **10.368 seconds per example** in the retained
`new-file-lifecycle-fixed.json` report. The step now says `without waiting`;
the following assertion still waits for the form to close before reopening it.
This changes test synchronization, not the app's timeout or behavior.

The follow-up's targeted run passes **39 scenarios / 472 steps** across all five
changed feature files. The two dismissal scenarios now take **1.346s and 1.382s**
in `e2e-economy.json`, versus **11.689s and 11.711s** in the earlier record;
their Escape steps take approximately 1.5ms each. This is an observed local
comparison, not a promised reduction in parallel CI wall time. No full suite was
launched while the maintainer's separate manual CI run was underway.

## Lower-level overlap retained deliberately

| Lower-level coverage | What the browser workflow additionally observes |
| --- | --- |
| `chat/scoped.test.ts`: idle/capacity eviction, refused starts, scope state | Row-menu refusal visibility, automatic panel opening, roster status, clicking to resume, rendered transcript, prompts and questions after recovery |
| `chat/succession.test.ts`: missing intermediate sessions, harness boundaries and cycles | Creating real distinct sessions, choosing Fresh/history/current, header identity and navigation; the cycle permutations stay below e2e |
| `chat/attachments.test.ts` and `browser/chat/attach.test.ts`: chunking, cumulative cap, ownership and concurrent writes | Actual file picker/drop and asynchronous reads, retained previews/drafts, resolved server filenames, RPC upload and the harness reading resulting bytes |
| `chat/questions.test.ts`: unique registry IDs and rejection of foreign/late answers | Draft isolation in rendered forms across node selection, drawer remount and harness restart, followed by submitted answers |
| `web/client/edit/undoing.test.ts`: pending inverses, failed replay and older history | Actual blur-save/key ordering, retained text and Undo/Redo through the browser; the refusal permutations stay below e2e |
| `web/client/pins/reorder.test.ts`: gap/neighbor arithmetic | Held mouse gestures, Escape/secondary-button handling, live shelf identity changes, indicator cleanup and subsequent reorder/Undo |
| `ops/plan.test.ts`: title/property preconditions and removed-pin refusal | The browser captures and sends the original baseline; refusal stays visible and the draft remains correctable |
| `git/browser/commit/selection.test.ts`: selected-file derivation | Prepared state survives a plugin rebuild and the resulting Git commit contains exactly the reviewed files |

These are overlaps in business behavior, not evidence that the lower-level tests
exercise the browser path. Several fixes in #510 were precisely failures to
connect working lower-level behavior to the correct UI state or request.

In particular, the two pending-note Undo scenarios were **retained**: one starts
with no older inverse and verifies Redo; the other has an older title inverse
that must not be spent. Removing the empty-history case could miss a shortcut
that incorrectly decides there is nothing to undo while the first save is pending.
Likewise source/destination removal during drag, same-size/reordered pin lists,
phone/desktop entry points, and reload/server restart exercise different operands,
handlers or lifetimes. Similar wording is insufficient grounds to remove them.

## Recorded cost and limits

The 248 retained local JSON reports supplied passing samples for 272 of the 275
added executions. Their selected recorded durations total approximately 802
seconds **serially**, including recorded hooks. These are mixed historical runs,
not a controlled before/after benchmark or an estimate of remote CI wall time.
Three keyboard-selection cases did not match the current names/paths in this
report collection; that does not mean they were never run.

Examples from those records: a full 50 MiB attachment/hash workflow took 4.11s;
idle-capacity navigation across nine nodes took 16.71s; the three idle-timer cases
took 9.20–10.01s each. Reconnect cases include approximately 10s waiting for the
production connection state to become reconnecting. That wait has a different
purpose from the deliberately held-response Escape wait corrected here.

The audit supports specific consolidation and synchronization fixes. It does
**not** support either blanket claim “no e2e covers anything unit-tested” or
“all possible redundancy has been proven absent.” Future additions should name
the distinct browser failure they catch and extend an existing workflow when its
setup and outcome already cover the same path.
