"""Measures how a character stands, and fails when the standing idle is not upright.

    blender -b --factory-startup --python scripts/art/posture.py
    blender -b --factory-startup --python scripts/art/posture.py -- file.glb [clip] [--report out.json]

With no files it checks public/assets/characters/{mannequin,hero-man,hero-woman}.glb. For each
file it measures the clip (default `idle`) at every frame, from the side:

- head ahead: how far the head is ahead of the midpoint of the ankles (cm, + is forward);
- trunk lean: the angle of the line from the pelvis to the head (degrees, + is forward);
- pelvis tilt: how far the pelvis has turned forward from its rest pose (degrees);
- knee bend: the angle between thigh and shin (degrees, 0 is straight);
- heel and toe lift: how far each foot's ankle and ball rise from their rest heights (cm).

The idle passes when, at every frame, the head is within 5 cm of the ankles, the trunk leans
5 degrees or less, each knee bends 10 degrees or less and both feet stay flat (lift 2.5 cm or
less). A hero also passes only if its trunk lean and pelvis tilt are within 2 degrees of the
mannequin's on the same clip. The script exits with status 1 when anything fails.
hero.py and mannequin.py call check() on the skeleton before they export.
"""

import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

REPO = Path(__file__).resolve().parents[2]
CHARACTERS = REPO / "public" / "assets" / "characters"

MARKS = {"head_ahead_cm": 5.0, "trunk_lean_deg": 5.0, "knee_bend_deg": 10.0, "foot_lift_cm": 2.5}
MATCH_DEG = 2.0


def _bone(arm, name):
    for b in arm.pose.bones:
        if b.name.lower() == name:
            return b
    raise KeyError(name)


def _rest_head(arm, name):
    b = _bone(arm, name)
    return arm.matrix_world @ b.bone.head_local


def measure_frame(arm):
    """Posture numbers for the armature's current pose (Blender: forward is -Y, up is +Z)."""
    mw = arm.matrix_world

    def head(name):
        return mw @ _bone(arm, name).head

    pelvis, top = head("pelvis"), head("head")
    ankle_l, ankle_r = head("foot_l"), head("foot_r")
    mid = (ankle_l + ankle_r) / 2
    pb = _bone(arm, "pelvis")
    rest = (mw @ pb.bone.matrix_local).to_quaternion()
    now = (mw @ pb.matrix).to_quaternion()
    fwd = (now @ rest.inverted()) @ Vector((0, -1, 0))
    knees = []
    for s in ("l", "r"):
        hip, knee, ankle = head(f"thigh_{s}"), head(f"calf_{s}"), head(f"foot_{s}")
        knees.append(math.degrees((knee - hip).angle(ankle - knee)))
    lifts = []
    for s in ("l", "r"):
        for joint in (f"foot_{s}", f"ball_{s}"):
            lifts.append((head(joint).z - _rest_head(arm, joint).z) * 100)
    return {
        "head_ahead_cm": (mid.y - top.y) * 100,
        "pelvis_ahead_cm": (mid.y - pelvis.y) * 100,
        "trunk_lean_deg": math.degrees(math.atan2(pelvis.y - top.y, top.z - pelvis.z)),
        "pelvis_tilt_deg": math.degrees(math.atan2(-fwd.z, -fwd.y)),
        "knee_bend_deg": max(knees),
        "foot_lift_cm": max(abs(v) for v in lifts),
        "feet_stagger_cm": abs(ankle_l.y - ankle_r.y) * 100,
        "feet_width_cm": abs(ankle_l.x - ankle_r.x) * 100,
        "head_height_m": top.z,
    }


def measure_action(arm, action, frames=None):
    """Measure every frame of an action. Returns {"frames": [...], "worst": {...}, "mean": {...}}."""
    ad = arm.animation_data or arm.animation_data_create()
    saved = (ad.action, ad.action_slot)
    ad.action = action
    if ad.action_slot is None and len(action.slots):
        ad.action_slot = action.slots[0]
    scene = bpy.context.scene
    s, e = action.frame_range
    frames = frames or list(range(int(round(s)), int(round(e)) + 1))
    rows = []
    for f in frames:
        scene.frame_set(f)
        rows.append(measure_frame(arm))
    ad.action = saved[0]
    if saved[0] is not None and saved[1] is not None:
        ad.action_slot = saved[1]
    keys = rows[0].keys()
    worst = {k: max(rows, key=lambda r: abs(r[k]))[k] for k in keys}
    mean = {k: sum(r[k] for r in rows) / len(rows) for k in keys}
    return {"frames": len(rows), "worst": worst, "mean": mean}


def failures(result):
    w = result["worst"]
    out = []
    for key, limit in MARKS.items():
        if abs(w[key]) > limit:
            out.append(f"{key} {w[key]:.1f} (limit {limit})")
    return out


def check(arm, action, label="idle", reference=None):
    """Measure an idle on a skeleton and stop the build if it misses the marks.

    reference: the mannequin's result for the same clip; trunk lean and pelvis tilt must then
    match it within MATCH_DEG on average."""
    result = measure_action(arm, action)
    bad = failures(result)
    if reference is not None:
        for key in ("trunk_lean_deg", "pelvis_tilt_deg"):
            d = result["mean"][key] - reference["mean"][key]
            if abs(d) > MATCH_DEG:
                bad.append(f"{key} differs from the mannequin by {d:.1f} degrees")
    print(f"[posture] {label}: " + summary(result) + (" FAIL: " + "; ".join(bad) if bad else " ok"),
          flush=True)
    if bad:
        raise SystemExit(f"posture check failed for {label}: " + "; ".join(bad))
    return result


def summary(result):
    w, m = result["worst"], result["mean"]
    return (f"head ahead {m['head_ahead_cm']:.1f} cm (worst {w['head_ahead_cm']:.1f}), "
            f"trunk lean {m['trunk_lean_deg']:.1f} deg (worst {w['trunk_lean_deg']:.1f}), "
            f"pelvis tilt {m['pelvis_tilt_deg']:.1f} deg, knee bend {w['knee_bend_deg']:.1f} deg, "
            f"foot lift {w['foot_lift_cm']:.1f} cm, feet {m['feet_width_cm']:.0f} cm apart "
            f"and {m['feet_stagger_cm']:.0f} cm staggered")


def load(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = 30
    bpy.ops.import_scene.gltf(filepath=str(path))
    arm = next(o for o in bpy.context.scene.objects if o.type == "ARMATURE")
    clips = {}
    if arm.animation_data:
        for t in list(arm.animation_data.nla_tracks):
            if t.strips:
                clips[t.name] = t.strips[0].action
            arm.animation_data.nla_tracks.remove(t)
    return arm, clips


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    report_path = None
    if "--report" in argv:
        i = argv.index("--report")
        report_path = Path(argv[i + 1])
        del argv[i:i + 2]
    files = [Path(a) for a in argv if a.endswith(".glb")]
    clip = next((a for a in argv if not a.endswith(".glb")), "idle")
    if not files:
        files = [CHARACTERS / n for n in ("mannequin.glb", "hero-man.glb", "hero-woman.glb")]
    results, bad = {}, []
    reference = None
    for path in files:
        arm, clips = load(path)
        if clip not in clips:
            bad.append(f"{path.name} has no clip {clip}")
            continue
        res = measure_action(arm, clips[clip])
        problems = failures(res)
        if reference is not None and path.name != "mannequin.glb":
            for key in ("trunk_lean_deg", "pelvis_tilt_deg"):
                d = res["mean"][key] - reference["mean"][key]
                if abs(d) > MATCH_DEG:
                    problems.append(f"{key} differs from the mannequin by {d:.1f} degrees")
        if path.name == "mannequin.glb":
            reference = res
        results[path.name] = dict(res, problems=problems)
        print(f"[posture] {path.name} {clip}: {summary(res)}"
              + (" FAIL: " + "; ".join(problems) if problems else " ok"), flush=True)
        bad += [f"{path.name}: {p}" for p in problems]
    if report_path:
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(results, indent=2) + "\n", encoding="utf-8")
    if bad:
        print("[posture] FAILED:\n  " + "\n  ".join(bad), flush=True)
        sys.exit(1)
    print("[posture] all passed", flush=True)


if __name__ == "__main__":
    main()
