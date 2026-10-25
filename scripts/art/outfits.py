"""Makes lighter copies of MakeHuman clothes for the game's outfits (ACT1_ART.md §1; ART_PIPELINE.md).

    blender -b --factory-startup --python scripts/art/outfits.py

For each entry of art/hero.json's looks.outfits with a "simplify" ({"from": <mhclo under the
MakeHuman cache>, "ratio": <share of faces kept>}): the clothes are fitted to MPFB's default body,
simplified (Blender's Decimate), matched to the body again by MPFB (as MakeClothes does), and
written as a new MakeHuman asset in the cache, art/cache/makehuman/<the entry's "file">, with the
original's material and texture. hero.py then fits that copy like any other clothes. The copy is
the original's work, simplified; it keeps the original's licence and author.
"""

import json
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import bpy  # noqa: E402

import common as C  # noqa: E402
import hero as H  # noqa: E402


def simplify(mp, outfit):
    spec = outfit["simplify"]
    source = H.MH / spec["from"]
    target = H.MH / outfit["file"]
    target.parent.mkdir(parents=True, exist_ok=True)
    C.clear_scene()
    basemesh = mp.Human.create_human(scale=0.1, feet_on_ground=True)
    clothes = mp.Human.add_mhclo_asset(str(source), basemesh, asset_type="Clothes", subdiv_levels=0,
                                       material_type="GAMEENGINE")
    original = mp.Mhclo()
    original.load(str(source))
    before = len(clothes.data.polygons)
    # A free copy of the fitted mesh, in the body's own space, simplified.
    copy = clothes.copy()
    copy.data = clothes.data.copy()
    copy.parent = None
    copy.matrix_world = clothes.matrix_world.copy()
    bpy.context.scene.collection.objects.link(copy)
    for m in list(copy.modifiers):
        copy.modifiers.remove(m)
    bpy.ops.object.select_all(action="DESELECT")
    copy.select_set(True)
    bpy.context.view_layer.objects.active = copy
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    decimate = copy.modifiers.new("simplify", "DECIMATE")
    decimate.ratio = spec["ratio"]
    decimate.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=decimate.name)
    after = len(copy.data.polygons)
    bpy.data.objects.remove(clothes, do_unlink=True)
    # MPFB matches each vertex within one of the body's groups; armour lies on the body's skin.
    copy.vertex_groups.clear()
    copy.vertex_groups.new(name="body").add(list(range(len(copy.data.vertices))), 1.0, "REPLACE")

    stem = target.stem
    mhclo = mp.Clothes.create_mhclo_from_clothes_matching(
        basemesh, copy,
        properties_dict={"name": stem, "author": f"{original.author} (simplified for Starman Lightkeeper)",
                         "license": original.license,
                         "description": f"{original.name}, simplified to {spec['ratio']:.0%} of its faces"},
    )
    mhclo.uuid = original.uuid
    scale = mp.Clothes.get_reference_scale(basemesh)
    mhclo.write_mhclo(str(target), also_export_mhmat=False, also_export_obj=True, reference_scale=scale)
    # The original's material and texture, named for the copy.
    mhmat = Path(original.material)
    text = mhmat.read_text(encoding="utf-8")
    (target.parent / f"{stem}.mhmat").write_text(text.replace(original.name, stem), encoding="utf-8")
    for line in text.splitlines():
        parts = line.split()
        if len(parts) == 2 and parts[0].endswith("Texture"):
            shutil.copy(mhmat.parent / parts[1], target.parent / parts[1])
    lines = target.read_text(encoding="utf-8").splitlines()
    at = next(i for i, line in enumerate(lines) if line.startswith("obj_file "))
    lines.insert(at + 1, f"material {stem}.mhmat")
    target.write_text("\n".join(lines) + "\n", encoding="utf-8")
    C.log(f"{outfit['id']}: {before} faces to {after}, written to {target.relative_to(C.REPO)}")
    return {"id": outfit["id"], "from": spec["from"], "faces": [before, after]}


def main():
    cfg = C.load_json("art/hero.json")
    mp = H.load_mpfb()
    done, made = [], set()
    for outfit in cfg["looks"].get("outfits", []):
        # Cuts of one armour share its simplified copy; it is made once.
        if outfit.get("simplify") and outfit["file"] not in made:
            done.append(simplify(mp, outfit))
            made.add(outfit["file"])
    C.write_report(done, "art/out/outfits.build.json")
    print(json.dumps(done))


if __name__ == "__main__":
    main()
