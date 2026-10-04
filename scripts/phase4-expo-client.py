"""Fetch only the official SDK 57 APK in verified HTTP byte ranges.
Test infrastructure: no app or backend code is modified by this download.
"""
import concurrent.futures
import hashlib
import json
import pathlib
import urllib.request

root = pathlib.Path(__file__).resolve().parents[1]
target = root / "dist/phase4-tools/Expo-Go-57.0.9.apk"
parts = target.parent / "expo-parts"
parts.mkdir(parents=True, exist_ok=True)
release = json.load(urllib.request.urlopen("https://api.github.com/repos/expo/expo-go-releases/releases/tags/Expo-Go-57.0.9", timeout=30))
asset = next(item for item in release["assets"] if item["name"] == "Expo-Go-57.0.9.apk")
url, size = asset["browser_download_url"], asset["size"]
chunk = 2 * 1024 * 1024
def download(index):
    start, end = index * chunk, min((index + 1) * chunk, size) - 1
    output = parts / str(index)
    if output.exists() and output.stat().st_size == end - start + 1:
        return index
    for attempt in range(3):
        try:
            request = urllib.request.Request(url, headers={"Range": f"bytes={start}-{end}", "User-Agent": "Barangayan-local-verification"})
            with urllib.request.urlopen(request, timeout=90) as response:
                assert response.status == 206
                assert response.headers["Content-Range"] == f"bytes {start}-{end}/{size}"
                data = response.read()
            assert len(data) == end - start + 1
            output.write_bytes(data)
            return index
        except Exception:
            if attempt == 2:
                raise
count = (size + chunk - 1) // chunk
with concurrent.futures.ThreadPoolExecutor(max_workers=24) as executor:
    for completed, _ in enumerate(executor.map(download, range(count)), 1):
        if completed % 10 == 0:
            print(f"Downloaded {completed}/{count} verified parts", flush=True)
with target.open("wb") as stream:
    for index in range(count):
        stream.write((parts / str(index)).read_bytes())
digest = hashlib.sha256(target.read_bytes()).hexdigest()
if asset.get("digest"):
    assert asset["digest"] == "sha256:" + digest
print(json.dumps({"bytes": size, "sha256": digest, "officialDigestVerified": bool(asset.get("digest"))}), flush=True)
