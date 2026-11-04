#!/bin/sh
# browser-lock-selftest.sh - proves browser-lock.sh: runs a command and passes its exit code through, never lets more
# than 2 commands hold a slot at once, reclaims a dead owner's slot, frees the slot on SIGTERM, and gives up with exit
# 75 WITHOUT running the command when no slot frees in time or when the load stays high. Uses its own lock directory
# (audit/labs/t2/lock-test) so it never touches the real slots. No browser.
#
#   sh src/tools/browser-lock-selftest.sh
#
# Writes audit/labs/t2/lock-selftest.json. Exit 0 only when every case passes.

SELF_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT=$(CDPATH= cd -- "$SELF_DIR/../.." && pwd)
LOCK="$SELF_DIR/browser-lock.sh"
LAB="$PROJECT/audit/labs/t2"
T="$LAB/lock-test"
rm -rf "$T"; mkdir -p "$T"
export LOCK_DIR="$T/locks"
export LOCK_POLL=1
export LOCK_FAKE_LOAD=1          # the real load is not under test except in the load cases below
PASS=0; FAILN=0; JSON=""
res() { # name ok detail
  if [ "$2" = 1 ]; then PASS=$((PASS + 1)); echo "ok   $1: $3"; else FAILN=$((FAILN + 1)); echo "FAIL $1: $3"; fi
  d=$(printf '%s' "$3" | tr -d '"\\')
  JSON="$JSON{\"case\":\"$1\",\"ok\":$([ "$2" = 1 ] && echo true || echo false),\"detail\":\"$d\"},"
}
slots_left() { ls -d "$LOCK_DIR"/slot-* 2>/dev/null | grep -v reclaim | wc -l | tr -d ' '; }

# 1 exit code passes through, slot freed
sh "$LOCK" sh -c 'exit 7' 2>/dev/null; c=$?
res exit-code "$([ "$c" = 7 ] && [ "$(slots_left)" = 0 ] && echo 1 || echo 0)" "command exit 7 -> lock exit $c, slots left $(slots_left)"

# 2 the command sees its slot number
sh "$LOCK" sh -c 'echo "$BROWSER_LOCK_SLOT" > "$0"' "$T/slotnum" 2>/dev/null
s=$(cat "$T/slotnum" 2>/dev/null)
res slot-env "$([ "$s" = 1 ] || [ "$s" = 2 ] && echo 1 || echo 0)" "BROWSER_LOCK_SLOT=$s"

# 3 no command -> 64
sh "$LOCK" 2>/dev/null; c=$?
res usage "$([ "$c" = 64 ] && echo 1 || echo 0)" "no command -> exit $c"

# 4 both slots held by a live owner -> exit 75 after LOCK_WAIT_MAX, command NOT run
sleep 30 & H=$!
mkdir -p "$LOCK_DIR/slot-1" "$LOCK_DIR/slot-2"; echo "$H" > "$LOCK_DIR/slot-1/pid"; echo "$H" > "$LOCK_DIR/slot-2/pid"
t0=$(date +%s)
LOCK_WAIT_MAX=3 sh "$LOCK" touch "$T/ran-busy" 2>"$T/busy.err"; c=$?; t1=$(date +%s)
res busy-gives-up "$([ "$c" = 75 ] && [ ! -e "$T/ran-busy" ] && echo 1 || echo 0)" "exit $c after $((t1 - t0)) s, command ran: $([ -e "$T/ran-busy" ] && echo yes || echo no); stderr: $(head -c 160 "$T/busy.err")"
kill "$H" 2>/dev/null; wait "$H" 2>/dev/null

# 5 dead owners are reclaimed (pid file names a process that no longer exists)
sh -c 'exit 0' & D=$!; wait "$D"
rm -rf "$LOCK_DIR/slot-1" "$LOCK_DIR/slot-2"; mkdir -p "$LOCK_DIR/slot-1" "$LOCK_DIR/slot-2"
echo "$D" > "$LOCK_DIR/slot-1/pid"; echo "$D" > "$LOCK_DIR/slot-2/pid"
LOCK_WAIT_MAX=10 sh "$LOCK" touch "$T/ran-reclaim" 2>/dev/null; c=$?
rec=$(grep -c '"event":"reclaimed"' "$LOCK_DIR/lock-log.jsonl" 2>/dev/null)
res dead-owner-reclaimed "$([ "$c" = 0 ] && [ -e "$T/ran-reclaim" ] && [ "${rec:-0}" -ge 1 ] && echo 1 || echo 0)" "exit $c, command ran: $([ -e "$T/ran-reclaim" ] && echo yes || echo no), reclaim log lines $rec"
rm -rf "$LOCK_DIR"/slot-*

# 6 load above the limit for LOCK_LOAD_HOLD -> exit 75, command NOT run
LOCK_FAKE_LOAD=99 LOCK_LOAD_HOLD=2 sh "$LOCK" touch "$T/ran-load" 2>"$T/load.err"; c=$?
res high-load-gives-up "$([ "$c" = 75 ] && [ ! -e "$T/ran-load" ] && echo 1 || echo 0)" "exit $c, command ran: $([ -e "$T/ran-load" ] && echo yes || echo no); stderr: $(head -c 160 "$T/load.err")"

# 7 load under the limit -> runs
LOCK_FAKE_LOAD=59.9 sh "$LOCK" touch "$T/ran-lowload" 2>/dev/null; c=$?
res low-load-runs "$([ "$c" = 0 ] && [ -e "$T/ran-lowload" ] && echo 1 || echo 0)" "load 59.9 -> exit $c"

# 8 four at once: never more than 2 inside, all 4 finish
mkdir -p "$T/inside"; : > "$T/counts"
JOB='mkdir "$0/inside/$$"; ls "$0/inside" | wc -l | tr -d " " >> "$0/counts"; sleep 2; rmdir "$0/inside/$$"'
P1=; P2=; P3=; P4=
LOCK_WAIT_MAX=40 sh "$LOCK" sh -c "$JOB" "$T" 2>/dev/null & P1=$!
LOCK_WAIT_MAX=40 sh "$LOCK" sh -c "$JOB" "$T" 2>/dev/null & P2=$!
LOCK_WAIT_MAX=40 sh "$LOCK" sh -c "$JOB" "$T" 2>/dev/null & P3=$!
LOCK_WAIT_MAX=40 sh "$LOCK" sh -c "$JOB" "$T" 2>/dev/null & P4=$!
ok4=0; for p in $P1 $P2 $P3 $P4; do wait "$p" && ok4=$((ok4 + 1)); done
max=$(sort -n "$T/counts" | tail -1); runs=$(wc -l < "$T/counts" | tr -d ' ')
res two-slots "$([ "$ok4" = 4 ] && [ "$runs" = 4 ] && [ "${max:-9}" -le 2 ] && echo 1 || echo 0)" "$ok4/4 exited 0, $runs ran, at most $max inside at once"

# 9 SIGTERM to the lock shell stops the command and frees the slot
sh "$LOCK" sleep 30 2>/dev/null & LP=$!
i=0; while [ ! -s "$LOCK_DIR/slot-1/child" ] && [ ! -s "$LOCK_DIR/slot-2/child" ] && [ $i -lt 50 ]; do sleep 0.2; i=$((i + 1)); done
CH=$(cat "$LOCK_DIR"/slot-*/child 2>/dev/null | head -1)
kill -TERM "$LP" 2>/dev/null; wait "$LP" 2>/dev/null; c=$?
sleep 0.5
gone=1; [ -n "$CH" ] && ps -p "$CH" >/dev/null 2>&1 && gone=0
res sigterm-frees "$([ -n "$CH" ] && [ "$gone" = 1 ] && [ "$(slots_left)" = 0 ] && echo 1 || echo 0)" "lock exit $c, command pid ${CH:-none} gone: $gone, slots left $(slots_left)"
[ -n "$CH" ] && kill "$CH" 2>/dev/null

TOTAL=$((PASS + FAILN))
mkdir -p "$LAB"
printf '{"tool":"browser-lock-selftest.sh","at":"%s","pass":%s,"fail":%s,"cases":[%s]}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$PASS" "$FAILN" "${JSON%,}" > "$LAB/lock-selftest.json"
if [ "$FAILN" = 0 ]; then echo "browser-lock self-test: PASS ($PASS/$TOTAL cases)"; exit 0; fi
echo "browser-lock self-test: FAIL ($FAILN of $TOTAL cases)"; exit 1
