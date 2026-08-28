#!/usr/bin/env bash
set -euo pipefail

# Rebuild acp/patches/session-list-info.patch.
#
# The patch is a diff against the pin's compiled `dist/acp-agent.js`, made the
# only way one can be trusted: by EDITING A COPY by its anchors and letting
# `diff -u` count the hunks. Hand-computed hunk headers were precisely the
# recipe three rounds of "corrupt patch" runs sin-ed here; fmt by machine.
#
# Sources:
#   - the helper block spliced before the class = facts.js (the piece that is
#     TESTED, `bun test acp/session-list-info`) shipped with `export` off,
#     under a banner that names this regen command;
#   - the NEW listSessions body is the heredoc below, authored by hand for
#     the bundle's names (sanitizeTitle, this.logger, the SDK's readers).
# Anchoring is by the SURROUNDING text, not line numbers, so a pin bump that
# moves the content fails HERE with a visible name — and at the build, which
# is the point of `patch -p1 -F0`.
#
# The bundle the diff is taken from has to be the pin's PRISTINE extract —
# any build found in the store already carries olai's patches, and a patch
# against them is the four-hunk failure this script's first version taught.
# The pin version comes out of the lockfile, the one input the derivation
# itself reads, so version and bundle move together
# (`mechanism, never convention`).
#
#     bash acp/session-list-info/regenerate.sh

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
facts="$root/acp/session-list-info/facts.js"
out="$root/acp/patches/session-list-info.patch"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

version="$(jq -r '.packages["node_modules/@agentclientprotocol/claude-agent-acp"].version' "$root/acp/package-lock.json")"
if [[ -z "$version" || "$version" == "null" ]]; then
  echo "no pin found in acp/package-lock.json" >&2
  exit 1
fi
curl -sfSL "https://registry.npmjs.org/@agentclientprotocol/claude-agent-acp/-/claude-agent-acp-$version.tgz" -o "$work/pkg.tgz"
mkdir "$work/pkg"
tar -xzf "$work/pkg.tgz" -C "$work/pkg" package/dist/acp-agent.js
bundle="$work/pkg/package/dist/acp-agent.js"
echo "source bundle: pristine claude-agent-acp $version"

cp "$bundle" "$work/original.js"

# ── region 1: the helper block, before `export class ClaudeAcpAgent {` ──

first_line="$(grep -n '── reading the opening' "$facts" | head -1 | cut -d: -f1)"

{
  cat <<'BUNDLEHEAD'
/**
 * olai patch (session-list-info) — GENERATED from acp/session-list-info/facts.js
 * by `bash acp/session-list-info/regenerate.sh`. The pairing and the scanning
 * rules are TESTED there; edit THAT file, run the script, and the bundle gets
 * the answer the suite asserts. Editing the text below by hand is the drift
 * this tooling exists to remove.
 */

const sessionListFactsCache = new Map();

BUNDLEHEAD
  tail -n +"$first_line" "$facts" | sed -E -e 's/^export //'
} > "$work/helpers.js"

# ── region 2: the new listSessions body ──
cat > "$work/listSessions.js" <<'BODY'
    async listSessions(params) {
        const dir = params.cwd ?? undefined;
        const sdk_sessions = await listSessions({ dir });
        // olai patch (session-list-info), second half — the protocol's own
        // rows beside the two facts each transcript has ready, and the
        // supersession pairing over the listed set. The helper block above
        // the class is GENERATED from acp/session-list-info/facts.js; run
        // `bash acp/session-list-info/regenerate.sh` after editing THAT — the
        // rulebook and its tests live in one place.
        const rows = [];
        for (const session of sdk_sessions) {
            if (!session.cwd)
                continue;
            rows.push({
                entry: {
                    sessionId: session.sessionId,
                    cwd: session.cwd,
                    title: sanitizeTitle(session.summary),
                    updatedAt: new Date(session.lastModified).toISOString(),
                },
                lastModified: session.lastModified,
                facts: await sessionListFactsOf({
                    sessionId: session.sessionId,
                    fileSize: session.fileSize,
                    lastModified: session.lastModified,
                    dir,
                }, {
                    cache: sessionListFactsCache,
                    messages: getSessionMessages,
                    info: getSessionInfo,
                    say: (line) => this.logger.error(line),
                }),
            });
        }
        // The pairing's candidates may not be headless or daemon sessions: a
        // scripted same-directory driver can be the recorded talk just before
        // a clear was, and the line a person is about to click may name the
        // conversation a human was in, not the spawning tool's. It is one
        // more walk of the same project dir, asked for only when at least
        // one listed transcript OPENED BY /clear — the uncommon case it is
        // for. NOTE: listSessions's own answer needs neither walk.
        let detectable = null;
        if (rows.some((row) => row.facts?.clearedAt !== undefined)) {
            detectable = new Set((await listSessions({ dir, includeProgrammatic: false })).map((info) => info.sessionId));
        }
        const links = pairSupersessions(rows.map((row) => ({
            id: row.entry.sessionId,
            cwd: row.entry.cwd,
            lastModified: row.lastModified,
            clearedAt: row.facts?.clearedAt,
        })), {
            includeId: (id) => detectable === null || detectable.has(id),
            say: (line) => this.logger.error(line),
        });
        return {
            sessions: rows.map(({ entry, facts }) => facts === undefined
                ? entry
                : {
                    ...entry,
                    _meta: {
                        claudeCode: {
                            messageCount: facts.messageCount,
                            ...(links.has(entry.sessionId) ? { supersededBy: links.get(entry.sessionId) } : {}),
                        },
                    },
                }),
        };
    }
BODY

# ── splice the two regions into a copy by ANCHOR, never by line number ──

awk -v helpers="$work/helpers.js" -v listbody="$work/listSessions.js" '
  BEGIN {
    while ((getline l < helpers) > 0) helper_block = helper_block l ORS
    while ((getline l < listbody) > 0) list_block = list_block l "\n"
    in_list = 0
  }
  # Anchor 1: directly before the class, splice the helpers.
  # The marker has to be unique: one top-level `export class ... {`.
   /^export class ClaudeAcpAgent {/{
    printf "%s", helper_block
  }
  # Anchor 2: the method: replace it through its closing `    }`, by the
  # shape of its own frame: "    async listSessions(params) {" … first
  # following "    }" — the method is self-contained enough across the pin
  # that the FIRST close brace at method indent is its own end.
  /^    async listSessions\(params\) \{$/ {
    in_list = 1
    printf "%s", list_block
    next
  }
  in_list == 1 && /^    \}$/ { in_list = 0; next }
  in_list == 1 { next }
  { print }
' "$work/original.js" > "$work/rebuilt.js"

grep -c "sessionListFactsOf" "$work/rebuilt.js" > "$work/counts"
grep -c "const sessionListFactsCache" "$work/rebuilt.js" >> "$work/counts"
grep -c "pairSupersessions" "$work/rebuilt.js" >> "$work/counts"
if [[ "$(head -1 <<<"$(awk 'NR==1{print $1}' "$work/counts")")" != "1" ]]; then
  :
fi

diff -u --label a/dist/acp-agent.js --label b/dist/acp-agent.js \
  "$work/original.js" "$work/rebuilt.js" > "$work/raw.patch" || test $? -eq 1

mv "$work/raw.patch" "$out"
git apply --check "$out"
echo "$out regenerated (anchored splice, diff-computed hunks; $(grep -c '^+' "$out") additions)"
