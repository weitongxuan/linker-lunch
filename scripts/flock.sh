#!/usr/bin/env bash
# 檔案讀寫鎖 — 多讀單寫，以 Redis 協調

# 用 function 包裝而非字串變數：zsh 預設不對未加引號的變數做 word splitting，
# 直接 redis_cli 展開會被當成單一指令名稱而找不到指令。
redis_cli() {
  docker exec redis redis-cli -h "${REDIS_HOST:-127.0.0.1}" -p "${REDIS_PORT:-6379}" --raw "$@"
}
AGENT_ID="${AGENT_ID:-agent-$$-$(date +%s)}"
LOCK_TTL=300      # 秒，agent 異常結束的保險絲
LOCK_WAIT=30      # 秒，每次重試間隔
LOCK_MAX_RETRY=10 # 上限 10 次 ≈ 5 分鐘

_fl_path() { python3 -c 'import os,sys;print(os.path.abspath(sys.argv[1]))' "$1"; }

# 清掉過期的 reader，並列出「其他 agent」仍在讀取的 id
_fl_readers() {
  local fp="$1" now id exp
  now=$(date +%s)
  redis_cli HGETALL "flock:r:$fp" | paste - - | while IFS=$'\t' read -r id exp; do
    if [ -z "$exp" ] || [ "$exp" -lt "$now" ]; then
      redis_cli HDEL "flock:r:$fp" "$id" >/dev/null
    elif [ "$id" != "$AGENT_ID" ]; then
      echo "$id"
    fi
  done
}

acquire_read() {
  local fp holder n=0
  fp=$(_fl_path "$1")
  while [ "$n" -lt "$LOCK_MAX_RETRY" ]; do
    holder=$(redis_cli GET "flock:w:$fp")
    if [ -z "$holder" ] || [ "$holder" = "$AGENT_ID" ]; then
      # 先登記自己，再回頭確認一次 write lock，避免與 writer 的競態
      redis_cli HSET "flock:r:$fp" "$AGENT_ID" "$(( $(date +%s) + LOCK_TTL ))" >/dev/null
      redis_cli EXPIRE "flock:r:$fp" "$LOCK_TTL" >/dev/null
      holder=$(redis_cli GET "flock:w:$fp")
      if [ -z "$holder" ] || [ "$holder" = "$AGENT_ID" ]; then
        echo "[flock] READ acquired: $fp"
        return 0
      fi
      redis_cli HDEL "flock:r:$fp" "$AGENT_ID" >/dev/null
    fi
    n=$((n + 1))
    echo "[flock] $fp 正被 $holder 寫入，等待 ${LOCK_WAIT}s（$n/$LOCK_MAX_RETRY）"
    sleep "$LOCK_WAIT"
  done
  echo "[flock] READ FAILED: $fp 仍被鎖住，請回報使用者" >&2
  return 1
}

release_read() {
  local fp
  fp=$(_fl_path "$1")
  redis_cli HDEL "flock:r:$fp" "$AGENT_ID" >/dev/null
  echo "[flock] READ released: $fp"
}

acquire_write() {
  local fp got readers n=0
  fp=$(_fl_path "$1")
  while [ "$n" -lt "$LOCK_MAX_RETRY" ]; do
    got=$(redis_cli SET "flock:w:$fp" "$AGENT_ID" NX EX "$LOCK_TTL")
    if [ "$got" != "OK" ] && [ "$(redis_cli GET "flock:w:$fp")" != "$AGENT_ID" ]; then
      n=$((n + 1))
      echo "[flock] $fp write lock 被佔用，等待 ${LOCK_WAIT}s（$n/$LOCK_MAX_RETRY）"
      sleep "$LOCK_WAIT"
      continue
    fi
    # 已握有 write lock（此時新的 reader 會被擋住），等現有 reader 讀完
    readers=$(_fl_readers "$fp" | grep -c .)
    if [ "$readers" -eq 0 ]; then
      echo "[flock] WRITE acquired: $fp"
      return 0
    fi
    redis_cli EXPIRE "flock:w:$fp" "$LOCK_TTL" >/dev/null
    n=$((n + 1))
    echo "[flock] $fp 還有 $readers 個 reader，等待 ${LOCK_WAIT}s（$n/$LOCK_MAX_RETRY）"
    sleep "$LOCK_WAIT"
  done
  release_write "$fp"
  echo "[flock] WRITE FAILED: $fp 仍被鎖住，請回報使用者" >&2
  return 1
}

release_write() {
  local fp
  fp=$(_fl_path "$1")
  if [ "$(redis_cli GET "flock:w:$fp")" = "$AGENT_ID" ]; then
    redis_cli DEL "flock:w:$fp" >/dev/null
    echo "[flock] WRITE released: $fp"
  fi
}

# session 結束時清掉自己殘留的鎖
release_all() {
  local key
  docker exec redis redis-cli -h "${REDIS_HOST:-127.0.0.1}" -p "${REDIS_PORT:-6379}" --raw \
    --scan --pattern 'flock:*' | while read -r key; do
    case "$key" in
      flock:w:*) [ "$(redis_cli GET "$key")" = "$AGENT_ID" ] && redis_cli DEL "$key" >/dev/null ;;
      flock:r:*) redis_cli HDEL "$key" "$AGENT_ID" >/dev/null ;;
    esac
  done
  echo "[flock] all locks released for $AGENT_ID"
}
