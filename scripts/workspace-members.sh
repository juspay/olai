#!/bin/sh
set -eu

root="${1:-$(dirname "$0")/..}"

# `while read` rather than `for glob in $(jq …)`: an unquoted command
# substitution is pathname-expanded as well as word-split, so the `for` list
# would iterate over the members instead of over the globs. `if` rather than
# `[ … ] && echo`, because under `set -e` a failing AND-list as the last
# statement of a loop body kills the shell.
while IFS= read -r glob; do
  [ -n "$glob" ] || continue
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
