#!/bin/sh
# browser-lock.sh - a 2-slot semaphore for headless browsers on this shared 8 GB Mac.
#
#   sh src/tools/browser-lock.sh <command> [args...]
#   e.g. sh src/tools/browser-lock.sh node src/tools/check.mjs --paths home
#
# Takes one of LOCK_SLOTS (2) slots under audit/.locks/ (slot-N directories; mkdir is atomic), runs the command, frees
# the slot and returns the command's exit code. A slot whose owner is dead (neither the lock shell nor its command is
# alive) is reclaimed. A slot is only taken while the 1-minute load average is at or under LOCK_LOAD_MAX.
# It gives up with exit 75 (EX_TEMPFAIL) and runs NOTHING when
#   - no slot is free within LOCK_WAIT_MAX seconds (default 240), or
#   - the 1-minute load average stays above LOCK_LOAD_MAX (60) for LOCK_LOAD_HOLD seconds (120) in a row.
# Exit 64 = no command given.
#
# Env: LOCK_DIR (default <project>/audit/.locks)  LOCK_SLOTS (2)  LOCK_WAIT_MAX (240)  LOCK_LOAD_MAX (60)
#      LOCK_LOAD_HOLD (120)  LOCK_POLL (seconds between tries, 2)
#      LOCK_FAKE_LOAD (self-test only: use this number as the load average)
# The command runs with BROWSER_LOCK_SLOT=<n> in its environment (check.mjs records it in its report).
# Every acquire / reclaim / release / give-up is appended as one JSON line to $LOCK_DIR/lock-log.jsonl (the report).
# Self-test: sh src/tools/browser-lock-selftest.sh

SELF_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT=$(CDPATH= cd -- "$SELF_DIR/../.." && pwd)
LOCK_DIR=${LOCK_DIR:-$PROJECT/audit/.locks}
SLOTS=${LOCK_SLOTS:-2}
WAIT_MAX=${LOCK_WAIT_MAX:-240}
LOAD_MAX=${LOCK_LOAD_MAX:-60}
LOAD_HOLD=${LOCK_LOAD_HOLD:-120}
POLL=${LOCK_POLL:-2}

if [ "$#" -eq 0 ]; then
  echo "usage: sh src/tools/browser-lock.sh <command> [args...]" >&2
  exit 64
fi
mkdir -p "$LOCK_DIR" || { echo "browser-lock: cannot create $LOCK_DIR" >&2; exit 75; }

CMD_TEXT=$(printf '%s ' "$@" | tr -d '"\\' | tr '\n\t' '  ' | cut -c1-160)
START=$(date +%s)

log() { # event slot load note
  printf '{"at":"%s","event":"%s","pid":%s,"slot":"%s","waitedS":%s,"load":"%s","note":"%s","cmd":"%s"}\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" "$$" "$2" "$(( $(date +%s) - START ))" "$3" "$4" "$CMD_TEXT" \
    >> "$LOCK_DIR/lock-log.jsonl" 2>/dev/null
}

load1() {
  if [ -n "${LOCK_FAKE_LOAD:-}" ]; then echo "$LOCK_FAKE_LOAD"; return; fi
  v=$(sysctl -n vm.loadavg 2>/dev/null | awk '{ gsub(/[{}]/, ""); print $1 }')
  if [ -z "$v" ] && [ -r /proc/loadavg ]; then v=$(awk '{ print $1 }' /proc/loadavg); fi
  if [ -z "$v" ]; then v=$(uptime | sed 's/.*load average[s]*: *//' | awk -F'[, ]+' '{ print $1 }'); fi
  echo "${v:-0}"
}
gt() { awk -v a="$1" -v b="$2" 'BEGIN { exit !((a + 0) > (b + 0)) }'; }
alive() { [ -n "$1" ] && ps -p "$1" >/dev/null 2>&1; }

# a slot's owner is alive when its lock shell or its command is alive; a slot without a pid file is being written
# (mkdir happened, pid not yet) and counts as alive for its first minute
owner_alive() {
  d=$1
  [ -d "$d" ] || return 1
  p=$(cat "$d/pid" 2>/dev/null); c=$(cat "$d/child" 2>/dev/null)
  if [ -z "$p" ]; then
    [ -z "$(find "$d" -prune -mmin +1 2>/dev/null)" ] && return 0
    return 1
  fi
  alive "$p" && return 0
  alive "$c" && return 0
  return 1
}

# remove a dead owner's slot; a reclaim guard directory keeps two waiters from removing a slot someone just took
reclaim() {
  d=$1; g="$d.reclaim"
  if mkdir "$g" 2>/dev/null; then
    if [ -d "$d" ] && ! owner_alive "$d"; then
      dead=$(cat "$d/pid" 2>/dev/null)
      rm -rf "$d"
      log reclaimed "${d##*/slot-}" "" "owner pid ${dead:-none} dead"
    fi
    rmdir "$g" 2>/dev/null
  elif [ -n "$(find "$g" -prune -mmin +1 2>/dev/null)" ]; then
    rmdir "$g" 2>/dev/null
  fi
}

SLOT=
HIGH_SINCE=
while :; do
  NOW=$(date +%s)
  L=$(load1)
  if gt "$L" "$LOAD_MAX"; then
    [ -z "$HIGH_SINCE" ] && HIGH_SINCE=$NOW
    if [ $(( NOW - HIGH_SINCE )) -ge "$LOAD_HOLD" ]; then
      echo "browser-lock: the 1-minute load average stayed above $LOAD_MAX for $(( NOW - HIGH_SINCE )) s (now $L) - gave up, ran nothing (exit 75): $CMD_TEXT" >&2
      log gave-up "" "$L" "load above $LOAD_MAX for $(( NOW - HIGH_SINCE )) s"
      exit 75
    fi
  else
    HIGH_SINCE=
    i=1
    while [ "$i" -le "$SLOTS" ]; do
      d="$LOCK_DIR/slot-$i"
      if [ -d "$d" ] && ! owner_alive "$d"; then reclaim "$d"; fi
      if mkdir "$d" 2>/dev/null; then
        echo "$$" > "$d/pid"
        SLOT=$i
        break
      fi
      i=$(( i + 1 ))
    done
    [ -n "$SLOT" ] && break
  fi
  if [ $(( NOW - START )) -ge "$WAIT_MAX" ]; then
    holders=""
    i=1; while [ "$i" -le "$SLOTS" ]; do holders="$holders slot-$i:$(cat "$LOCK_DIR/slot-$i/pid" 2>/dev/null || echo free)"; i=$(( i + 1 )); done
    echo "browser-lock: no free slot within $WAIT_MAX s (load $L;$holders) - gave up, ran nothing (exit 75): $CMD_TEXT" >&2
    log gave-up "" "$L" "no free slot within $WAIT_MAX s"
    exit 75
  fi
  sleep "$POLL"
done

SLOT_DIR="$LOCK_DIR/slot-$SLOT"
CHILD=
release() {
  if [ -n "$SLOT" ] && [ "$(cat "$SLOT_DIR/pid" 2>/dev/null)" = "$$" ]; then
    rm -rf "$SLOT_DIR"
    log released "$SLOT" "" "exit ${CODE:-?}"
  fi
  SLOT=
}
forward() { [ -n "$CHILD" ] && kill "-$1" "$CHILD" 2>/dev/null; }
trap 'release' EXIT
trap 'forward TERM' TERM
trap 'forward INT' INT
trap 'forward HUP' HUP

log acquired "$SLOT" "$L" ""
[ "$(( $(date +%s) - START ))" -gt 5 ] && echo "browser-lock: slot $SLOT after $(( $(date +%s) - START )) s (load $L)" >&2

BROWSER_LOCK_SLOT=$SLOT
export BROWSER_LOCK_SLOT
exec 3<&0
"$@" <&3 3<&- &
CHILD=$!
echo "$CHILD" > "$SLOT_DIR/child"
wait "$CHILD"
CODE=$?
# a trapped signal interrupts wait; keep waiting for the command itself
while alive "$CHILD" && kill -0 "$CHILD" 2>/dev/null; do
  wait "$CHILD"
  CODE=$?
done
exit "$CODE"
