/**
 * THIS ROW'S SELECTORS — its own ids, spelled once, for its own steps.
 *
 * They were in the harness's `support/world.ts`, which is where every row's
 * were: one table three thousand lines long that a change to any row appended
 * to. What made that the wrong place is not its size but its OWNER — a new
 * testid for this row was a diff in a package this row does not own, reviewed
 * by people who were not changing anything.
 *
 * The ids come from `../src/testids.ts`, which is this package's own file, so
 * a rename here is a type error in the package that renamed it rather than a
 * scenario that times out thirty seconds later saying nothing about why.
 * `selector()` is the client's, through the one door the suite may spell.
 *
 * WHAT IS NOT HERE is anything more than one row's steps read — the header, the
 * sidebar shell, the outline rows every page draws, the waits. Those are the
 * harness's, and a step imports them from `@olai/tests/harness/world.ts`
 * beside these. The rule is the one the shared helpers follow: what more than
 * one row's steps stand on is the harness's.
 */

import { selector } from "@olai/web/testlib";

import { TESTID } from "../src/testids.ts";

export const CHAT_TITLE = selector(TESTID.chatTitle);
export const CHAT_WORKING = selector(TESTID.chatWorking);
export const CHAT_MODEL = selector(TESTID.chatModel);
/** Where a scenario types to narrow the open model list. */
export const CHAT_MODEL_FILTER = selector(TESTID.chatModelFilter);
/** The row the list draws when the query matches nothing. */
export const CHAT_MODEL_NONE = selector(TESTID.chatModelNone);
/** WHO the conversation is with, beside the model. `data-agent` is the roster's
 *  own id, so a scenario names an agent rather than reading a brand name. */
export const CHAT_AGENT = selector(TESTID.chatAgent);
/** The mark in front of that name — its own selector because "icon and name"
 *  is the ruling, and a name with no mark passes an assertion about the name. */
export const CHAT_AGENT_MARK = selector(TESTID.chatAgentMark);
/** The picker: which agent this conversation is with. */
export const CHAT_CHOOSE = selector(TESTID.chatChoose);
/** One agent in it. */
export const CHAT_CHOOSE_AGENT = selector(TESTID.chatChooseAgent);
/** The way out of the picker `+ new` raised — absent when the panel is asking
 *  because it HAS no conversation. */
export const CHAT_CHOOSE_CANCEL = selector(TESTID.chatChooseCancel);
/** The composer PROMISING that a message sent now waits its turn at the agent
 *  and is got to when the running turn is over — drawn while a turn runs, for
 *  an agent whose queue is a fact olai has rather than a guess. */
export const CHAT_QUEUES = selector(TESTID.chatQueues);
/** The strip between the transcript and the box while the panel is busy —
 *  what a person sees when a turn or a boot is in flight and nothing has
 *  arrived to look at yet. */
export const CHAT_BUSY = selector(TESTID.chatBusy);
export const CHAT_SESSIONS = selector(TESTID.chatSessions);
export const CHAT_SESSION_LIST = selector(TESTID.chatSessionList);
export const CHAT_SESSIONS_REFUSED = selector(TESTID.chatSessionsRefused);
export const CHAT_SESSION = selector(TESTID.chatSession);
/** The heading over one agent's rows in the unassigned list. Drawn only where more
 *  than one agent has conversations here. */
export const CHAT_SESSION_AGENT = selector(TESTID.chatSessionAgent);
/** One agent in that list that could not be asked what it has stored. Its own
 *  selector and not the whole call's refusal, because the two are two states:
 *  this one leaves every other agent's conversations on the screen. */
export const CHAT_SESSION_UNREACHABLE = selector(TESTID.chatSessionUnreachable);
/** The line under one row saying WHICH conversation replaced this one — it
 *  carries `data-successor`, because the successor need not be on the screen
 *  and the sentence alone could not pick it out of two sharing a title. */
export const CHAT_SESSION_SUPERSEDED = selector(TESTID.chatSessionSuperseded);
export const CHAT_TRANSCRIPT = selector(TESTID.chatTranscript);
/** The strip under the chat header: which MCP servers this conversation has.
 *  Drawn on every conversation, so its absence means there is none. */
export const CHAT_ROSTER = selector(TESTID.chatRoster);
/** One server on it. `data-server` is its name and `data-standing` is how it
 *  stands — the state as data, because which glyph says "connected" is a
 *  decision about pixels. */
export const CHAT_SERVER = selector(TESTID.chatServer);
/** The line saying the list is not the whole of what the agent can reach. */
export const CHAT_ROSTER_OWN = selector(TESTID.chatRosterOwn);
export const CHAT_MISSING = selector(TESTID.chatMissing);
export const CHAT_MISSING_SERVER = selector(TESTID.chatMissingServer);
export const CHAT_MISSING_WHY = selector(TESTID.chatMissingWhy);
export const CHAT_UNOPENED = selector(TESTID.chatUnopened);
export const CHAT_UNOPENED_WHY = selector(TESTID.chatUnopenedWhy);
export const CHAT_REOPEN = selector(TESTID.chatReopen);
export const CHAT_ENTRY = selector(TESTID.chatEntry);
export const CHAT_NEW = selector(TESTID.chatNew);
export const CHAT_TOOL = selector(TESTID.chatTool);
export const CHAT_TOOL_FILE = selector(TESTID.chatToolFile);
export const CHAT_TOOL_CALLED = selector(TESTID.chatToolCalled);
export const CHAT_TOOL_REPLY = selector(TESTID.chatToolReply);
export const CHAT_TOOL_TEXT = selector(TESTID.chatToolText);
export const CHAT_TOOL_FOLD = selector(TESTID.chatToolFold);
export const CHAT_TOOL_DETAIL = selector(TESTID.chatToolDetail);
export const CHAT_TOOL_PROGRESS = selector(TESTID.chatToolProgress);
export const CHAT_TOOL_REPORT = selector(TESTID.chatToolReport);
export const CHAT_TOOL_LOCATIONS = selector(TESTID.chatToolLocations);
export const CHAT_TOOL_ELAPSED = selector(TESTID.chatToolElapsed);
export const CHAT_LANE = selector(TESTID.chatLane);
export const CHAT_LANE_LABEL = selector(TESTID.chatLaneLabel);
export const CHAT_LANE_DOOR = selector(TESTID.chatLaneDoor);
export const CHAT_PREVIEW = selector(TESTID.chatPreview);
export const CHAT_PREVIEW_OF = selector(TESTID.chatPreviewOf);
export const CHAT_PREVIEW_ASKED = selector(TESTID.chatPreviewAsked);
export const CHAT_PREVIEW_NOTHING = selector(TESTID.chatPreviewNothing);
export const CHAT_SPAWN = selector(TESTID.chatSpawn);
export const CHAT_SPAWN_WORKING = selector(TESTID.chatSpawnWorking);
export const CHAT_ARMED = selector(TESTID.chatArmed);
export const CHAT_WATCHING = selector(TESTID.chatWatching);
export const CHAT_WATCHING_TASK = selector(TESTID.chatWatchingTask);
export const CHAT_WATCHING_FOR = selector(TESTID.chatWatchingFor);
export const CHAT_ARMED_ENDED = selector(TESTID.chatArmedEnded);
export const CHAT_ARMED_STILL = selector(TESTID.chatArmedStill);
/** THE STRIP UNDER THOSE: what this conversation WAKES ON. One line per
 *  running plugin that declares a doorbell, and the file a person pointed it
 *  at. Absent where there is no conversation to be scoped. */
export const CHAT_WAKE_FAULT = selector(TESTID.chatWakeFault);
export const CHAT_WAKE_WAITING = selector(TESTID.chatWakeWaiting);
export const CHAT_WAKE = selector(TESTID.chatWake);
/** One plugin's control on it. `data-plugin` is whose doorbell and `data-file`
 *  is the path or the word `off` — the STATE AS DATA, because the words around
 *  it are the plugin's own sentence and a scenario asserting those would be
 *  asserting somebody else's vocabulary. */
export const CHAT_WAKE_PICKER = selector(TESTID.chatWakePicker);
/** The strip on a `user` row that did not land, saying WHICH way in
 *  `data-delivery`, and the button that tries again — which only one of the two
 *  faces has. The words stay in the bubble above both. */
export const CHAT_DELIVERY = selector(TESTID.chatDelivery);
/** The strip on a `user` row the agent has not started on: it went out while a
 *  turn was running and is waiting its turn there. Not a delivery — nothing has
 *  failed — and it goes away when the agent takes the message up. */
export const CHAT_QUEUED = selector(TESTID.chatQueued);
export const CHAT_RESEND = selector(TESTID.chatResend);
export const CHAT_WAITING = selector(TESTID.chatWaiting);
export const CHAT_SEND = selector(TESTID.chatSend);
/** The other send: put these words INTO the turn the agent is running. Drawn
 *  only while there is a turn to interrupt and only for an agent that said it
 *  takes one — the visible door onto Alt+Enter, which is the same gesture. */
export const CHAT_INTERRUPT = selector(TESTID.chatInterrupt);
export const CHAT_CANCEL = selector(TESTID.chatCancel);
/** A picture on a message — pending in the composer, or sent, on the row. Its
 *  `data-name` is the file name, which is the only thing about it every tab
 *  agrees on; the preview is drawn ONLY by the tab that has the Blob. */
export const CHAT_ATTACHMENT = selector(TESTID.chatAttachment);
export const CHAT_ATTACHMENT_PREVIEW = selector(TESTID.chatAttachmentPreview);
/** How big a NON-picture attachment is, beside its name — what a document
 *  chip says where a picture shows itself. */
export const CHAT_ATTACHMENT_SIZE = selector(TESTID.chatAttachmentSize);
/** The `+` beside the box: the file picker, and one of the two way-ins on a
 *  phone. */
export const CHAT_ATTACH_BUTTON = selector(TESTID.chatAttachButton);
/** The camera beside the `+` — drawn only where the primary pointer is
 *  coarse (`web/src/client/chat/camera.ts`): on a desktop it is absent by
 *  design, which is the fact a desktop scenario asserts. */
export const CHAT_CAMERA_BUTTON = selector(TESTID.chatCameraButton);
/** The panel saying a dragged file would land HERE. Present only while a drag
 *  carrying files is over the panel's body. */
export const CHAT_DROP = selector(TESTID.chatDrop);
/** A node a message is ABOUT — armed in the composer, or sent, on the row.
 *  `data-node` is the id, which is what was armed and what was sent. */
export const CHAT_CONTEXT = selector(TESTID.chatContext);
export const CHAT_CONTEXT_CHIP = selector(TESTID.chatContextChip);
export const CHAT_CONTEXT_REMOVE = selector(TESTID.chatContextRemove);
/** ... and the third speaker in that lane: a sentence a PLUGIN put there
 *  through the doorbell somebody scoped this conversation to. It is a `user`
 *  row like `CHAT_MINE` and deliberately not drawn as one — the full column, on
 *  the left, never the accent bubble that means *you said this* — so a scenario
 *  asking "did I say this" is never handed a machine's words. `data-rang-by` is
 *  which plugin rang. */
export const CHAT_RANG = selector(TESTID.chatRang);
/** ... FOLDED to one line, and the control that opens it. A machine's row draws
 *  its essence line and nothing else until somebody asks — the discipline a
 *  tool row already keeps, and the reason a delivery is not a paragraph wall in
 *  the middle of a conversation. The AGENT is handed the whole body either way;
 *  the fold is a fact about a reader's eye. */
/** The MARK over a machine's row — whose face is talking. `data-mark` is the
 *  plugin's own name where the plugin contributed one, and `generic` where it
 *  did not. */
export const CHAT_PLUGIN_MARK = selector(TESTID.chatPluginMark);
/** The head a machine's row is folded TO — the plain sentence a glance reads,
 *  and where the one pressable reference lives. */
export const CHAT_RANG_BYLINE = selector(TESTID.chatRangByline);
export const CHAT_RANG_FOLD = selector(TESTID.chatRangFold);
/** What the fold holds back — the ids, the marks, the derivation. NOT IN THE
 *  PAGE until the row is open, which is what lets a scenario assert the fold
 *  without asserting a word the plugin wrote. */
export const CHAT_RANG_BODY = selector(TESTID.chatRangBody);
