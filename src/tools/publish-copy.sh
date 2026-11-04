#!/bin/sh
# publish-copy.sh — refresh the repo copy of this project (a WHITELIST: the built site, its source and the handoff docs).
# The crawl evidence (audit/), the graded skill workspace (reforge/), the hero options board and its option sources
# (audit/labs/, src/labs/) and the original downloads (assets/) stay in the working project. Re-run for every update;
# it fails closed if the copy names another client of ours, carries the sister store's content, or does not rebuild
# dist/ byte for byte.
#
#   sh src/tools/publish-copy.sh <repo-dir>      then: node src/tools/make-preview.mjs --out <repo-dir>/preview
set -eu
P=$(cd "$(dirname "$0")/../.." && pwd)
D=${1:?usage: sh src/tools/publish-copy.sh <repo-dir>}
mkdir -p "$D"
for d in dist src docs; do
  mkdir -p "$D/$d"
  rsync -a --delete --delete-excluded --exclude '.DS_Store' --exclude 'labs/' --exclude '__pycache__/' --exclude 'OWNER-BRIEF.md' --exclude 'shoot-references.mjs' "$P/$d/" "$D/$d/"
done
cp "$P/docs/README.md" "$D/README.md"
printf 'preview/\ndist-*/\n.DS_Store\nnode_modules/\n__pycache__/\n' > "$D/.gitignore"
# a client's repo names no other client of ours; the names live in a local file (never published) so this script names
# nobody.
G="$P/audit/publish-guard.txt"; [ -s "$G" ] || { echo "STOP: $G is missing"; exit 1; }
if grep -rliIE "$(cat "$G")" "$D" --exclude-dir=.git --exclude-dir=preview; then
  echo "STOP: the copy names another client (files above)"; exit 1
fi
# the SHIPPED site never carries the sister store's content (Central Jersey Dispensary shares the live JS bundle); the
# docs and tools may name it, because they explain why its content is excluded
if grep -rliIE 'Central Jersey|centraljersey|Somerset|hero-cjd|cjd-logo' "$D/dist"; then echo "STOP: the shipped site carries sister-store content"; exit 1; fi
# the copy must rebuild the site exactly
(cd "$D" && node src/tools/build.mjs --out dist-verify >/dev/null)
if ! diff -rq "$D/dist" "$D/dist-verify" >/dev/null; then diff -rq "$D/dist" "$D/dist-verify" | head; echo "STOP: the copy does not rebuild dist/ byte for byte"; rm -rf "$D/dist-verify"; exit 1; fi
rm -rf "$D/dist-verify"
echo "repo copy refreshed: $D (no other client named; rebuilds dist/ byte for byte)"
