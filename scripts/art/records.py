"""Updates art/records.json: the record of every source file and every output of the art
pipeline (D-28).

    python3 scripts/art/records.py

The "sources" list is written by hand: one entry per download, with its URL, licence and
SHA-256 (scripts/art/fetch_sources.py reads it). This script fills in the rest from what is on
disk:
- "items": each MakeHuman asset the heroes use, with its author and licence, read from the
  asset packs' own metadata (art/cache/makehuman/*/packs/*.json);
- "mpfbData": the parts of MPFB's bundled data that end up in the heroes;
- "outputs": every file in public/assets/characters/, with its size and SHA-256.
Uses only Python's standard library.
"""

import hashlib
import json
from datetime import date
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
ART = REPO / "art"
MH = ART / "cache" / "makehuman"
CHARACTERS = REPO / "public" / "assets" / "characters"


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def pack_metadata():
    meta = {}
    for pack_dir in sorted(MH.glob("*")):
        for pack_file in sorted(pack_dir.glob("packs/*.json")):
            for name, info in json.loads(pack_file.read_text(encoding="utf-8")).items():
                meta[(pack_dir.name, name)] = dict(info, pack=pack_file.stem)
    return meta


def items_used(hero, meta, source_of_pack):
    items = {}
    for body_name, body in hero["bodies"].items():
        paths = [body[k] for k in ("skin", "eyes", "eyeMaterial", "eyebrows", "eyelashes", "hair")
                 if body.get(k)] + [c if isinstance(c, str) else c["file"]
                                    for c in body.get("clothes", [])]
        for rel in paths:
            pack_dir = rel.split("/")[0]
            p = Path(rel)
            name = p.stem if p.parent.name == "materials" else p.parent.name
            info = meta.get((pack_dir, name), {})
            key = (pack_dir, name)
            if key not in items:
                items[key] = {
                    "name": name,
                    "type": info.get("type", p.parent.parent.name),
                    "author": info.get("author", "unknown"),
                    "licence": info.get("license", "unknown"),
                    "source": source_of_pack.get(pack_dir, pack_dir),
                    "page": info.get("source", ""),
                    "file": f"art/cache/makehuman/{rel}",
                    "usedBy": [],
                }
            items[key]["usedBy"].append(f"hero-{body_name}.glb")
    return list(items.values())


def outputs(made_by):
    out = []
    for path in sorted(CHARACTERS.glob("*")):
        if path.suffix not in (".glb", ".json"):
            continue
        info = made_by.get(path.name, {})
        out.append({
            "path": str(path.relative_to(REPO)),
            "bytes": path.stat().st_size,
            "sha256": sha256(path),
            "madeBy": info.get("script", ""),
            "from": info.get("from", []),
            "licence": "CC0-1.0 inputs only; no attribution is required",
        })
    return out


def main():
    path = ART / "records.json"
    records = json.loads(path.read_text(encoding="utf-8"))
    hero = json.loads((ART / "hero.json").read_text(encoding="utf-8"))
    source_of_pack = {s["unpackTo"].split("/")[-1]: s["id"] for s in records["sources"]
                      if s.get("unpackTo", "").startswith("makehuman/")}
    records["items"] = items_used(hero, pack_metadata(), source_of_pack)
    targets = sorted({t for m in hero["morphs"]
                      for spec in [m] + [m[b] for b in ("man", "woman") if b in m]
                      for t in spec.get("targets", {})}
                     | {t for body in hero["bodies"].values() for t in body.get("targets", {})})
    records["mpfbData"] = {
        "source": "mpfb",
        "licence": "CC0-1.0 (MakeHuman core assets)",
        "used": ["data/3dobjs/base.obj (the body)",
                 f"data/rigs/standard/rig.{hero['rig']}.json and weights.{hero['rig']}.json",
                 "data/targets/macrodetails (gender, age, muscle, weight, height, proportions)",
                 "data/targets/breast (cup size and firmness)"]
                + [f"data/targets/{t}.target.gz" for t in targets],
    }
    made_by = {
        "mannequin.glb": {"script": "scripts/art/mannequin.py", "from": ["ual1_pro", "ual2"]},
        "hero-man.glb": {"script": "scripts/art/hero.py",
                         "from": ["mpfb", "mh_system_assets", "mh_suits02", "ual1_pro", "ual2"]},
        "hero-woman.glb": {"script": "scripts/art/hero.py",
                           "from": ["mpfb", "mh_system_assets", "mh_suits02", "ual1_pro", "ual2"]},
        "heroes.json": {"script": "scripts/art/hero.py", "from": []},
    }
    records["outputs"] = outputs(made_by)
    records["updated"] = date.today().isoformat()
    path.write_text(json.dumps(records, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"updated {path.relative_to(REPO)}: {len(records['items'])} items, "
          f"{len(records['outputs'])} outputs")


if __name__ == "__main__":
    main()
