#!/usr/bin/env bash
# PreToolUse hook: before editing UI files, remind Claude to read DESIGN.md first.
input=$(cat)
file=$(printf '%s' "$input" | python3 -c 'import sys,json
try: print(json.load(sys.stdin).get("tool_input",{}).get("file_path",""))
except Exception: print("")')
if printf '%s' "$file" | grep -qE '/(src/(components|pages|features|layouts|index\.css)|tailwind\.config\.js)'; then
  python3 - <<'PY'
import json
print(json.dumps({"hookSpecificOutput":{"hookEventName":"PreToolUse","additionalContext":"UI file edit detected. Read /DESIGN.md (project root) first and follow it as the source of truth for the Design System (see CLAUDE.md)."}}))
PY
fi
exit 0
