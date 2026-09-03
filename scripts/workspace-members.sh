#!/bin/sh
# WHERE THE WORKSPACE MEMBERS ARE — expanded once, in shell, for every shell
# that needs the answer.
#
# The root manifest's `workspaces` field is this repo's one spelling of the
# layout, and its own comment says so. Expanding that field into a member list
# is a different thing from declaring it, and it had drifted the day it was
# written twice: `check-hydrated-deps.sh` refused a glob that matched nothing
# and `prove-fence.sh` silently produced a shorter list — the exact "a check
# that came back short is a check that did not run" failure both of those files
# carry paragraphs against.
#
# `packages/bundle/src/tree.testlib.ts` keeps its own reading and is not a
# third copy of this one: it is a `bun test` corpus, and a corpus that shelled
# out would make every equality in the fence depend on a subprocess. What is
# shared is the RULE, not the code — both refuse a glob that matched nothing,
# and both refuse a glob shape they cannot expand.
#
# Prints one member directory per line, repo-relative. Usage:
#
#   members=$(sh "$root/scripts/workspace-members.sh" "$root")
set -eu

root="${1:-$(dirname "$0")/..}"

# `while read` rather than `for glob in $(jq …)`, because an unquoted command
# substitution is PATHNAME-EXPANDED as well as word-split: `packages/*` would be
# expanded by the `for` list itself and the loop would iterate over the members
# instead of over the globs. The inner loop is the only place expansion is
# wanted.
#
# `if` rather than `[ … ] && echo`, because under `set -e` a failing AND-list is
# a failing COMMAND: as the last statement of a loop body it kills the shell on
# the last iteration whose test is false, before any trailing `true` can run.
while IFS= read -r glob; do
  [ -n "$glob" ] || continue
  # REFUSE A SHAPE THIS CANNOT EXPAND, which is the half of the shared rule a
  # first draft left out and which made "the rule is shared, the code is not"
  # false. POSIX sh has no globstar: `packages/**` expands to exactly the
  # top-level entries, so both tenants would be missing, `matched` would still
  # be 1, and nothing would throw — a silently short member list, the precise
  # failure this script exists to prevent. `tree.testlib.ts` reads the same
  # field with `Bun.Glob`, which DOES know `**`, so on the day the root is
  # simplified to one recursive glob the two readings would disagree with
  # nothing red. Refusing what this expander cannot honour is what keeps them
  # one rule. It also refuses a glob outside `packages/`, as that reading does.
  case "$glob" in
    *"**"*)
      echo "workspace-members: the glob '$glob' uses '**', which POSIX sh cannot" >&2
      echo "  expand — it would silently answer with the top level only. Expand it in" >&2
      echo "  the manifest, or teach this script a matching expander." >&2
      exit 1 ;;
    packages/*) ;;
    *)
      echo "workspace-members: the glob '$glob' does not name anything under packages/" >&2
      exit 1 ;;
  esac
  matched=0
  for dir in "$root"/$glob; do
    if [ -f "$dir/package.json" ]; then
      echo "${dir#"$root"/}"
      matched=1
    fi
  done
  if [ "$matched" -eq 0 ]; then
    echo "workspace-members: the workspaces glob '$glob' matched no package.json." >&2
    echo "  A glob that installs nothing is a typo or a missing directory, and every" >&2
    echo "  caller of this script is about to check something over the result." >&2
    exit 1
  fi
done <<GLOBS
$(jq -r '.workspaces[]' "$root/package.json")
GLOBS
