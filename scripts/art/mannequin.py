"""Builds public/assets/characters/mannequin.glb: Quaternius's UAL mannequin (CC0) with the
game's core animations (art/animations.json), for the code prototype.

    blender -b --factory-startup --python scripts/art/mannequin.py

Needs the UAL files in art/cache/ (python3 scripts/art/fetch_sources.py).
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import bpy  # noqa: E402

import common as C  # noqa: E402


def main():
    cfg = C.load_json("art/animations.json")
    C.reset_scene()

    # The target: UAL 2's mannequin and skeleton (Unreal-style bone names).
    dst_objs = C.import_glb(C.REPO / cfg["libraries"]["ual2"]["file"])
    dst = C.armature_of(dst_objs)
    mesh = [o for o in dst_objs if o.type == "MESH" and o.parent is dst][0]
    C.delete_objects([o for o in dst_objs if o not in (dst, mesh)])
    C.clear_animation(dst)
    dst.name = "Mannequin_Rig"
    dst.data.name = "Mannequin_Rig"
    mesh.name = "Mannequin"
    # UAL's *_leaf bones only mark finger and toe tips; they carry no weights.
    gone = C.remove_bones(dst, lambda n: "_leaf" in n)
    C.log("removed leaf bones:", len(gone))

    # The sources: UAL 1 (Rigify names) and UAL 2 (Unreal names), imported again as sources.
    sources, maps = {}, {}
    for lib, info in cfg["libraries"].items():
        objs = C.import_glb(C.REPO / info["file"])
        arm = C.armature_of(objs)
        C.delete_objects([o for o in objs if o.type == "MESH"])
        acts = C.actions_by_name(arm)
        C.clear_animation(arm)
        sources[lib] = (arm, acts)
        if info["naming"] == "rigify":
            maps[lib] = {u: r for r, u in C.RIGIFY_TO_UNREAL.items()}
        else:
            maps[lib] = {u: u for u in C.UNREAL_BONES}

    clips = C.build_clips(
        dst, cfg["clips"], sources, maps, hips="pelvis", root="root",
        strafe_args={"pelvis": "pelvis",
                     "spine_weights": [("spine_01", 0.35), ("spine_02", 0.35),
                                       ("spine_03", 0.30)]},
        align_rest=False)

    for arm, _ in sources.values():
        C.delete_objects([arm])
    C.drop_foreign_actions(clips)
    C.push_to_nla(dst, clips)

    raw = C.export_glb(C.ART / "out" / "mannequin.raw.glb", [dst, mesh], morphs=False,
                       copyright_text="Mannequin and animations by Quaternius (CC0)")
    out = C.OUT_CHARACTERS / "mannequin.glb"
    C.finish_glb(raw, out)
    report = C.glb_report(out)
    C.write_report(report, "art/out/mannequin.report.json")
    C.log("wrote", out, report["megabytes"], "MB", report["triangles"], "triangles",
          report["bones"], "bones")
    C.log("animations:", ", ".join(report["animations"]))


if __name__ == "__main__":
    main()
