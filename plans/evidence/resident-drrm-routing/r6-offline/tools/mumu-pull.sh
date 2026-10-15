#!/usr/bin/env bash
# pull.sh <device path> <local file>: copies a file from MuMu through MuMuManager's shell channel.
M="/c/Program Files/Netease/MuMuPlayer/nx_main/MuMuManager.exe"
size=$("$M" sh -v 0 -c "wc -c < $1" | tr -d '\r\n ')
: > "$2.b64"
chunk=60000; off=1
while [ "$off" -le "$size" ]; do
  "$M" sh -v 0 -c "tail -c +$off $1 | head -c $chunk | base64" | tr -d '\r\n' >> "$2.b64"
  off=$((off + chunk))
done
base64 -d "$2.b64" > "$2"
rm "$2.b64"
echo "$(wc -c < "$2") of $size bytes"
