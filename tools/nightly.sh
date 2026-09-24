#!/usr/bin/env bash
# 半夜排程進入點(launchd 叫這支)。只產生提案檔,不改資料、不 commit。
set -u
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 1
LOG_DIR="$ROOT/tools/nightly-review/logs"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/$(date +%F).log"
exec >>"$LOG" 2>&1
echo "=== $(date '+%F %T') start ==="

# launchd 的環境很乾淨:自己找 python3,並讓 .env 的 key 生效(腳本內會讀)
export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"

if [ ! -x tools/.bin/ocr ] || [ tools/ocr.swift -nt tools/.bin/ocr ]; then
  mkdir -p tools/.bin
  xcrun swiftc -O tools/ocr.swift -o tools/.bin/ocr || echo "OCR 編譯失敗,這晚不做菜單"
fi

python3 tools/google-places-sync.py --limit "${NIGHTLY_LIMIT:-40}"
STATUS=$?
echo "=== $(date '+%F %T') end (exit $STATUS) ==="
exit $STATUS
