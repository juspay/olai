#!/usr/bin/env bash
set -euo pipefail

wrapper=${1:?usage: check-wrapper-knobs.sh <wrapper> <knobs-table>}
table=${2:?usage: check-wrapper-knobs.sh <wrapper> <knobs-table>}

reader=$(
  cat <<'AWK'
match($0, /[A-Za-z_][A-Za-z0-9_]*=\$\{[A-Za-z_][A-Za-z0-9_]*-'[^']*'\}/) {
  hit = substr($0, RSTART, RLENGTH)
  value = substr(hit, index(hit, "-'") + 2)
  print "baked\t" substr(hit, 1, index(hit, "=") - 1) "\t" substr(value, 1, length(value) - 2)
}
match($0, /export PATH="\$\{[A-Za-z_][A-Za-z0-9_]*\}""\$\{PATH:[+]:\$PATH\}"/) {
  hit = substr($0, RSTART, RLENGTH)
  rest = substr(hit, index(hit, "{") + 1)
  print "spliced\t" substr(rest, 1, index(rest, "}") - 1)
}
match($0, /for key in [^;]*;/) {
  print "recorded\t" substr($0, RSTART + 11, RLENGTH - 12)
}
AWK
)
said=$(awk "$reader" "$wrapper")

asked() { awk -F'\t' -v want="$1" -v key="$2" '$1 == want && $2 == key { print $3; hit = 1 } END { exit hit ? 0 : 1 }'; }

refuse() {
  printf '%s\n' "$@" >&2
  cat "$wrapper" >&2
  exit 1
}

names=""
while IFS=$'\t' read -r name kind path holds; do
  [ -n "$name" ] || continue
  names="${names:+$names }$name"

  if ! baked=$(printf '%s\n' "$said" | asked baked "$name"); then
    refuse "the packaged binary does not bake $name into its wrapper," \
      "so \`nix run\` would start with no answer for it. Wrapper:"
  fi
  if [ "$baked" != "$path" ]; then
    printf '%s\n' "the wrapper's baked $name does not match the fold's path:" \
      "  wrapper: $baked" "  fold:    $path" >&2
    exit 1
  fi

  case "$kind" in
    file)
      if [ ! -x "$baked" ]; then
        echo "the wrapper's baked $name is not executable: $baked" >&2
        exit 1
      fi
      ;;
    dir)
      if [ ! -d "$baked" ] || { [ -n "$holds" ] && [ ! -x "$baked/$holds" ]; }; then
        echo "the wrapper's pinned $name is not a directory holding ${holds:-the answer}: $baked" >&2
        exit 1
      fi
      if ! printf '%s\n' "$said" | asked spliced "$name" >/dev/null; then
        refuse "the wrapper names $name but never splices it onto PATH —" \
          "the probe would resolve nothing. Wrapper:"
      fi
      ;;
  esac
  echo "packaged $name: $baked"
done <<<"$table"

recorded=$(printf '%s\n' "$said" | awk -F'\t' '$1 == "recorded" { print $2 }')
if [ "$recorded" != "$names" ]; then
  refuse "the wrapper's OLAI_WRAPPER_DEFAULTS loop names \"$recorded\"," \
    "and the fold declares \"$names\". Wrapper:"
fi
