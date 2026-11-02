#!/bin/sh
# Short view of a curated case for writing its hand file: node world-sheets/tools/show.cjs + trimming
node "$(dirname "$0")/show.cjs" "$1" | python3 -c "
import json,sys;d=json.load(sys.stdin)
for k in ['summary','charge','claim','people','profile','sex','truth','evidence','witnesses','late','follow','party']:
  v=d.get(k)
  if v is None: continue
  print(k,':',json.dumps(v,ensure_ascii=False)[:2600])"
