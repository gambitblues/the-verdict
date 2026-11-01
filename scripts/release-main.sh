#!/usr/bin/env bash
# Release the current develop commit to main (GitHub Pages) as a two-parent merge commit,
# leaving out paths that are for development only and must not be served on the public site.
# Usage: scripts/release-main.sh 7.0.3
set -euo pipefail
V=${1:?usage: scripts/release-main.sh X.Y.Z}
DEV_ONLY=(dev advanced-content world-sheets)   # test screens, draft case data, hidden-truth world sheets
git fetch -q origin +refs/heads/main:refs/remotes/origin/main
D=$(git rev-parse HEAD)
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
export GIT_INDEX_FILE="$TMP/index"
git read-tree "$D"
git rm -r -q --cached --ignore-unmatch -- "${DEV_ONLY[@]}"
T=$(git write-tree)
unset GIT_INDEX_FILE
M=$(git commit-tree "$T" -p origin/main -p "$D" -m "Release v$V to main")
for p in "${DEV_ONLY[@]}"; do if git cat-file -e "$M:$p" 2>/dev/null; then echo "dev-only path $p is still in the release" >&2; exit 1; fi; done
git push origin "$M:refs/heads/main"
echo "released v$V: $M (without ${DEV_ONLY[*]})"
