"""Downloads the art pipeline's sources into art/cache/ and unpacks them.

    python3 scripts/art/fetch_sources.py            # everything listed in art/records.json
    python3 scripts/art/fetch_sources.py ual1 ual2  # only these

Uses only Python's standard library (3.9 or newer). Every file is checked against the SHA-256
in art/records.json; a file that does not match is deleted and the script stops. Nothing that
is downloaded is run: the archives hold models, textures and MakeHuman text files only.
Bought packs (UAL 1 Pro) cannot be downloaded; the script checks that they are in place.
MPFB itself is installed with Blender's own command (see docs/ART_PIPELINE.md).
"""

import hashlib
import json
import shutil
import sys
import urllib.request
import zipfile
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
CACHE = REPO / "art" / "cache"
DOWNLOADS = CACHE / "downloads"


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def fetch(source):
    DOWNLOADS.mkdir(parents=True, exist_ok=True)
    target = DOWNLOADS / source["file"]
    if target.exists() and sha256(target) == source["sha256"]:
        print(f"have {target.name}")
    else:
        print(f"downloading {source['url']}")
        tmp = target.with_suffix(target.suffix + ".part")
        request = urllib.request.Request(source["url"], headers={"User-Agent": "starman-art/1"})
        with urllib.request.urlopen(request) as response, open(tmp, "wb") as out:
            shutil.copyfileobj(response, out)
        got = sha256(tmp)
        if got != source["sha256"]:
            tmp.unlink()
            sys.exit(f"SHA-256 mismatch for {source['file']}: got {got}")
        tmp.replace(target)
    unpack = source.get("unpackTo")
    if unpack:
        dest = CACHE / unpack
        marker = dest / ".unpacked"
        if marker.exists() and marker.read_text().strip() == source["sha256"]:
            return
        if dest.exists():
            shutil.rmtree(dest)
        dest.mkdir(parents=True)
        with zipfile.ZipFile(target) as z:
            for name in z.namelist():
                resolved = (dest / name).resolve()
                if not str(resolved).startswith(str(dest.resolve())):
                    sys.exit(f"unsafe path in {target.name}: {name}")
            z.extractall(dest)
        marker.write_text(source["sha256"] + "\n")
        print(f"unpacked to {dest.relative_to(REPO)}")


def check_by_hand(source):
    """Sources that cannot be downloaded (bought packs) are only checked."""
    for f in source.get("files", []):
        path = REPO / f["path"]
        if not path.exists():
            print(f"missing {f['path']} ({source['name']}): {source.get('obtainedHow', '')}")
        elif sha256(path) != f["sha256"]:
            sys.exit(f"SHA-256 mismatch for {f['path']}")
        else:
            print(f"have {f['path']}")


def main():
    records = json.loads((REPO / "art" / "records.json").read_text(encoding="utf-8"))
    wanted = set(sys.argv[1:])
    for source in records["sources"]:
        if source.get("fetch") is False or "url" not in source or "file" not in source:
            if source.get("fetch") is False:
                check_by_hand(source)
            continue
        if wanted and source["id"] not in wanted:
            continue
        fetch(source)


if __name__ == "__main__":
    main()
