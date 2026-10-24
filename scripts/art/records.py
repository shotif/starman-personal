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


def file_licence(path):
    """The licence line written in a MakeHuman file itself, if it has one."""
    try:
        for line in Path(path).read_text(encoding="utf-8", errors="replace").splitlines()[:40]:
            low = line.lower()
            if "released as cc0" in low:
                return "CC0 (released as CC0 in September 2020)"
            if "licen" in low and ("cc" in low or "gpl" in low):
                return line.lstrip("#/ ").strip()
    except OSError:
        pass
    return ""


def items_used(hero, meta, source_of_pack):
    paths = {}  # relative path -> set of uses
    looks = hero.get("looks", {})

    def use(rel, what):
        paths.setdefault(rel, set()).add(what)

    for body_name, body in hero["bodies"].items():
        for k in ("eyes", "eyebrows", "eyelashes"):
            if body.get(k):
                use(body[k], f"hero-{body_name}.glb")
        for c in body.get("clothes", []):
            use(c if isinstance(c, str) else c["file"], f"hero-{body_name}.glb")
        for skin in looks.get("skins", {}).get(body_name, []):
            for rel in ([skin["mhmat"]] if "mhmat" in skin else [b[0] for b in skin["blend"]]):
                use(rel, f"looks/{body_name}/skin-{skin['id']}")
    for k in ("teeth", "tongue"):
        if hero.get(k):
            use(hero[k], "hero-man.glb, hero-woman.glb")
    for hair in looks.get("hair", []):
        if hair.get("file"):
            use(hair["file"], f"looks/*/hair-{hair['id']}.glb")
    for eyes in looks.get("eyes", []):
        use(eyes["mhmat"], f"looks/eyes-{eyes['id']}")
    items = []
    for rel, uses in sorted(paths.items()):
        pack_dir = rel.split("/")[0]
        p = Path(rel)
        name = p.stem if p.parent.name == "materials" else p.parent.name
        info = meta.get((pack_dir, name), {})
        items.append({
            "name": name,
            "type": info.get("type", p.parent.parent.name),
            "author": info.get("author", "unknown"),
            "licence": info.get("license", "unknown"),
            "fileLicence": file_licence(MH / rel),
            "source": source_of_pack.get(pack_dir, pack_dir),
            "page": info.get("source", ""),
            "file": f"art/cache/makehuman/{rel}",
            "usedBy": sorted(uses),
        })
    visemes = sorted({t for m in hero["morphs"] for t in m.get("targets", {})
                      if t.startswith("mh:visemes02/")})
    if visemes:
        info = meta.get(("visemes02", "viseme_aa"), {})
        items.append({"name": "visemes02 (15 viseme targets)", "type": "target",
                      "author": info.get("author", "unknown"), "licence": info.get("license", "unknown"),
                      "source": source_of_pack.get("visemes02", "visemes02"),
                      "file": "art/cache/makehuman/visemes02/targets/visemes/",
                      "usedBy": ["hero-man.glb", "hero-woman.glb"]})
    return items


def outputs(made_by):
    out = []
    for path in sorted(CHARACTERS.rglob("*")):
        if path.suffix not in (".glb", ".json", ".webp"):
            continue
        info = made_by.get(path.name, made_by.get("looks" if "looks" in path.parts else "", {}))
        out.append({
            "path": str(path.relative_to(REPO)),
            "bytes": path.stat().st_size,
            "sha256": sha256(path),
            "madeBy": info.get("script", ""),
            "from": info.get("from", []),
            "licence": ("CC0-1.0 and CC BY inputs; see CREDITS.md" if "bun" in path.name
                        else "CC0-1.0 inputs only; no attribution is required"),
        })
    return out


def main():
    path = ART / "records.json"
    records = json.loads(path.read_text(encoding="utf-8"))
    hero = json.loads((ART / "hero.json").read_text(encoding="utf-8"))
    source_of_pack = {s["unpackTo"].split("/")[-1]: s["id"] for s in records["sources"]
                      if s.get("unpackTo", "").startswith("makehuman/")}
    records["items"] = items_used(hero, pack_metadata(), source_of_pack)
    names = ({t for m in hero["morphs"]
              for spec in [m] + [m[b] for b in ("man", "woman") if b in m]
              for t in spec.get("targets", {})}
             | {t for body in hero["bodies"].values() for t in body.get("targets", {})})
    targets = sorted({t.replace("{race}", race) for t in names if not t.startswith("mh:")
                      for race in (("african", "asian", "caucasian") if "{race}" in t else ("",))})
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
        "looks": {"script": "scripts/art/hero.py",
                  "from": ["mpfb", "mh_system_assets", "mh_skins01", "mh_skins02", "mh_hair01"]},
    }
    records["outputs"] = outputs(made_by)
    records["updated"] = date.today().isoformat()
    path.write_text(json.dumps(records, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"updated {path.relative_to(REPO)}: {len(records['items'])} items, "
          f"{len(records['outputs'])} outputs")


if __name__ == "__main__":
    main()
