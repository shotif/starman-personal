"""Shared helpers for the Blender art scripts (mannequin.py, hero.py).

Runs inside Blender's bundled Python. It needs no add-ons of its own; hero.py enables MPFB.

What is here:
- paths and the JSON settings under art/;
- importing the Universal Animation Library (UAL) files;
- a retargeter that copies animation from one skeleton to another by world-space rotation,
  so it works when the two skeletons have different bone names, rolls and rest poses;
- a "strafe" clip made from a walk, because the free UAL files have no sideways walk;
- glTF export, and finish_glb(), which strips rest-pose channels and, with glTF-Transform from
  node_modules, resamples, quantizes and stores morph targets sparsely;
- a reader that reports triangles, bones, clips and morph targets of a .glb.
"""

import json
import math
import os
import struct
from pathlib import Path

import bpy
from mathutils import Matrix, Quaternion, Vector

REPO = Path(__file__).resolve().parents[2]
ART = REPO / "art"
CACHE = ART / "cache"
OUT_CHARACTERS = REPO / "public" / "assets" / "characters"
FPS = 30

# UAL 1's Godot file uses Rigify-style names; UAL 2 and our mannequin use Unreal-style names.
RIGIFY_TO_UNREAL = {
    "root": "root",
    "DEF-hips": "pelvis",
    "DEF-spine.001": "spine_01",
    "DEF-spine.002": "spine_02",
    "DEF-spine.003": "spine_03",
    "DEF-neck": "neck_01",
    "DEF-head": "Head",
}
for _side, _s in (("L", "l"), ("R", "r")):
    RIGIFY_TO_UNREAL.update({
        f"DEF-shoulder.{_side}": f"clavicle_{_s}",
        f"DEF-upper_arm.{_side}": f"upperarm_{_s}",
        f"DEF-forearm.{_side}": f"lowerarm_{_s}",
        f"DEF-hand.{_side}": f"hand_{_s}",
        f"DEF-thigh.{_side}": f"thigh_{_s}",
        f"DEF-shin.{_side}": f"calf_{_s}",
        f"DEF-foot.{_side}": f"foot_{_s}",
        f"DEF-toe.{_side}": f"ball_{_s}",
    })
    for _f in ("index", "middle", "ring", "pinky"):
        for _i in (1, 2, 3):
            RIGIFY_TO_UNREAL[f"DEF-f_{_f}.0{_i}.{_side}"] = f"{_f}_0{_i}_{_s}"
    for _i in (1, 2, 3):
        RIGIFY_TO_UNREAL[f"DEF-thumb.0{_i}.{_side}"] = f"thumb_0{_i}_{_s}"

UNREAL_BONES = sorted(set(RIGIFY_TO_UNREAL.values()))


def log(*args):
    print("[art]", *args, flush=True)


def load_json(rel):
    with open(REPO / rel, encoding="utf-8") as f:
        return json.load(f)


# --------------------------------------------------------------------------------------------
# Scene helpers


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.fps = FPS
    scene.render.fps_base = 1.0
    return scene


def clear_scene():
    """Empty the file without resetting preferences (so enabled add-ons stay enabled)."""
    scene = bpy.context.scene
    for coll in (bpy.data.objects, bpy.data.meshes, bpy.data.armatures, bpy.data.actions,
                 bpy.data.materials, bpy.data.images, bpy.data.cameras, bpy.data.lights,
                 bpy.data.node_groups, bpy.data.textures):
        bpy.data.batch_remove(list(coll))
    for c in list(bpy.data.collections):
        bpy.data.collections.remove(c)
    scene.render.fps = FPS
    scene.render.fps_base = 1.0
    scene.frame_set(0)
    return scene


def import_glb(path):
    path = Path(path)
    if not path.exists():
        raise SystemExit(f"Missing {path}. Run: python3 scripts/art/fetch_sources.py")
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    return [o for o in bpy.data.objects if o not in before]


def armature_of(objects):
    arms = [o for o in objects if o.type == "ARMATURE"]
    if len(arms) != 1:
        raise RuntimeError(f"expected one armature, found {[o.name for o in arms]}")
    return arms[0]


def delete_objects(objects):
    for o in list(objects):
        bpy.data.objects.remove(o, do_unlink=True)


def actions_by_name(arm):
    """The importer puts every clip in its own NLA track. Return {clip name: action}."""
    found = {}
    ad = arm.animation_data
    if ad:
        for track in ad.nla_tracks:
            for strip in track.strips:
                if strip.action:
                    found[track.name] = strip.action
        if ad.action:
            found.setdefault(ad.action.name.split(".")[0], ad.action)
    return found


def clear_animation(arm):
    ad = arm.animation_data
    if not ad:
        return
    for track in list(ad.nla_tracks):
        ad.nla_tracks.remove(track)
    ad.action = None


def assign_action(arm, action):
    ad = arm.animation_data or arm.animation_data_create()
    ad.action = action
    if action is not None and ad.action_slot is None and len(action.slots):
        ad.action_slot = action.slots[0]


def bones_in_order(arm):
    """Bones with every parent before its children."""
    order = []

    def walk(b):
        order.append(b)
        for c in b.children:
            walk(c)

    for b in arm.data.bones:
        if b.parent is None:
            walk(b)
    return order


def remove_bones(arm, predicate):
    """Delete bones (for example UAL's *_leaf end markers) from an armature."""
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    eb = arm.data.edit_bones
    gone = [b.name for b in eb if predicate(b.name)]
    for name in gone:
        eb.remove(eb[name])
    bpy.ops.object.mode_set(mode="OBJECT")
    return gone


def apply_object_transforms(objects):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)


# --------------------------------------------------------------------------------------------
# Writing actions


def new_action(name, arm):
    act = bpy.data.actions.new(name)
    slot = act.slots.new(id_type="OBJECT", name=arm.name)
    layer = act.layers.new("Layer")
    strip = layer.strips.new(type="KEYFRAME")
    bag = strip.channelbag(slot, ensure=True)
    act.use_fake_user = True
    return act, bag


def write_keys(bag, data_path, index, group, frames, values):
    fc = bag.fcurves.new(data_path, index=index, group_name=group)
    fc.keyframe_points.add(len(frames))
    co = []
    for f, v in zip(frames, values):
        co.extend((f, v))
    fc.keyframe_points.foreach_set("co", co)
    fc.keyframe_points.foreach_set("interpolation", [1] * len(frames))  # LINEAR
    fc.update()


def store_pose_track(arm, name, frames, basis_per_frame, loop):
    """basis_per_frame: list of {bone: Matrix (matrix_basis)}. Writes location + quaternion."""
    act, bag = new_action(name, arm)
    bones = list(basis_per_frame[0].keys())
    for bname in bones:
        locs = [basis_per_frame[i][bname].to_translation() for i in range(len(frames))]
        quats = []
        prev = None
        for i in range(len(frames)):
            q = basis_per_frame[i][bname].to_quaternion()
            if prev is not None and prev.dot(q) < 0:
                q.negate()
            quats.append(q)
            prev = q
        path = f'pose.bones["{bname}"]'
        moves = max(v.length for v in locs) > 1e-5
        if moves:
            for k in range(3):
                write_keys(bag, path + ".location", k, bname, frames, [v[k] for v in locs])
        for k in range(4):
            write_keys(bag, path + ".rotation_quaternion", k, bname, frames, [q[k] for q in quats])
    act["loop"] = bool(loop)
    act.use_cyclic = bool(loop)
    return act


def frame_span(action):
    s, e = action.frame_range
    return list(range(int(round(s)), int(round(e)) + 1))


# --------------------------------------------------------------------------------------------
# Retargeting


class Retargeter:
    """Copies motion from a source armature to a target armature.

    For each mapped bone the target takes the source bone's world-space rotation change from
    its rest pose. With align_rest=True the target's rest bones are first turned to point the
    same way as the source's (for example an A-pose onto a T-pose), so the change is measured
    from matching postures. The hips (and root) also take the source's movement, scaled by the
    ratio of hip heights. Unmapped target bones keep their rest pose relative to their parent.
    """

    def __init__(self, src, dst, dst_to_src, hips="pelvis", root=None, align_rest=True):
        self.src, self.dst = src, dst
        self.map = {d: s for d, s in dst_to_src.items()
                    if d in dst.data.bones and s in src.data.bones}
        self.hips = hips
        self.root = root
        self.order = bones_in_order(dst)
        sw, dw = src.matrix_world, dst.matrix_world
        self.dst_inv = dw.inverted()
        self.rest_d = {b.name: b.matrix_local.copy() for b in dst.data.bones}
        self.rest_dw = {n: dw @ m for n, m in self.rest_d.items()}
        self.rest_sw = {b.name: sw @ b.matrix_local for b in src.data.bones}
        self.offset = {}
        for d, s in self.map.items():
            qd = self.rest_dw[d].to_quaternion()
            qs = self.rest_sw[s].to_quaternion()
            align = Quaternion()
            if align_rest:
                yd = (self.rest_dw[d].to_3x3() @ Vector((0, 1, 0))).normalized()
                ys = (self.rest_sw[s].to_3x3() @ Vector((0, 1, 0))).normalized()
                align = yd.rotation_difference(ys)
            self.offset[d] = qs.inverted() @ align @ qd
        # Hip height above each armature's origin sets the scale of hip movement.
        hd = self.rest_dw[hips].translation.z - dw.translation.z
        hs = self.rest_sw[self.map[hips]].translation.z - sw.translation.z
        self.move_scale = hd / hs if hs > 1e-6 else 1.0
        for pb in dst.pose.bones:
            pb.rotation_mode = "QUATERNION"

    def target_worlds(self):
        """World matrices for every target bone for the source's current frame."""
        src_pose = self.src.pose.bones
        sw = self.src.matrix_world
        worlds = {}
        for b in self.order:
            n = b.name
            p = b.parent.name if b.parent else None
            if p is None:
                rest_world_from_parent = self.rest_dw[n]
                parent_world = Matrix.Identity(4)
            else:
                rest_world_from_parent = self.rest_dw[p].inverted() @ self.rest_dw[n]
                parent_world = worlds[p]
            follow = parent_world @ rest_world_from_parent
            s = self.map.get(n)
            if s is None:
                worlds[n] = follow
                continue
            ws = sw @ src_pose[s].matrix
            rot = ws.to_quaternion() @ self.offset[n]
            if n == self.hips or n == self.root:
                move = (ws.translation - self.rest_sw[s].translation) * self.move_scale
                pos = self.rest_dw[n].translation + move
            else:
                pos = follow.translation
            worlds[n] = Matrix.Translation(pos) @ rot.to_matrix().to_4x4()
        return worlds

    def bake(self, src_action, name, loop):
        assign_action(self.src, src_action)
        scene = bpy.context.scene
        frames = frame_span(src_action)
        per_frame = []
        for f in frames:
            scene.frame_set(f)
            per_frame.append(worlds_to_basis(self.dst, self.order, self.rest_d,
                                             self.target_worlds(), self.dst_inv))
        start = frames[0]
        return store_pose_track(self.dst, name, [f - start for f in frames], per_frame, loop)


def worlds_to_basis(arm, order, rest, worlds, arm_inv):
    """Turn world matrices into each pose bone's matrix_basis."""
    pose = {n: arm_inv @ w for n, w in worlds.items()}
    basis = {}
    for b in order:
        n = b.name
        if b.parent is None:
            basis[n] = rest[n].inverted() @ pose[n]
        else:
            p = b.parent.name
            local_rest = rest[p].inverted() @ rest[n]
            basis[n] = local_rest.inverted() @ pose[p].inverted() @ pose[n]
    return basis


def current_worlds(arm, order):
    mw = arm.matrix_world
    return {b.name: mw @ arm.pose.bones[b.name].matrix for b in order}


def make_strafe(arm, walk_action, name, side, pelvis, spine_weights, yaw_deg=80.0):
    """A sideways walk made from a forward walk.

    The pelvis (and so the legs) turns towards the side of travel, and the spine turns back
    so the chest, head and arms still face forward. The legs then step sideways. It is a
    stand-in until a captured strafe exists (the paid UAL versions have one).
    """
    order = bones_in_order(arm)
    rest = {b.name: b.matrix_local.copy() for b in arm.data.bones}
    arm_inv = arm.matrix_world.inverted()
    yaw = math.radians(yaw_deg if side == "left" else -yaw_deg)
    assign_action(arm, walk_action)
    scene = bpy.context.scene
    frames = frame_span(walk_action)
    turned_by = {pelvis: 1.0}
    acc = 1.0
    for bone_name, w in spine_weights:
        acc -= w
        turned_by[bone_name] = acc
    per_frame = []
    for f in frames:
        scene.frame_set(f)
        old = current_worlds(arm, order)
        new = {}
        for b in order:
            n = b.name
            if b.parent is None:
                new[n] = old[n]
                continue
            p = b.parent.name
            follow = new[p] @ (old[p].inverted() @ old[n])
            if n in turned_by:
                t = turned_by[n]
                rot = Quaternion((0, 0, 1), yaw * t) @ old[n].to_quaternion()
                pos = old[n].translation if n == pelvis else follow.translation
                new[n] = Matrix.Translation(pos) @ rot.to_matrix().to_4x4()
            else:
                new[n] = follow
        per_frame.append(worlds_to_basis(arm, order, rest, new, arm_inv))
    start = frames[0]
    return store_pose_track(arm, name, [f - start for f in frames], per_frame, True)


def build_clips(dst, clips, sources, dst_to_src_for, hips, root, strafe_args, align_rest):
    """Bake every clip listed in art/animations.json onto dst.

    sources: {library: (armature, {clip name: action})}
    dst_to_src_for: {library: {dst bone: src bone}}
    """
    made = {}
    retargeters = {}
    for clip in clips:
        if "derived" in clip:
            continue
        lib = clip["library"]
        if lib not in retargeters:
            src_arm, _ = sources[lib]
            retargeters[lib] = Retargeter(src_arm, dst, dst_to_src_for[lib], hips=hips,
                                          root=root, align_rest=align_rest)
        _, acts = sources[lib]
        if clip["source"] not in acts:
            raise RuntimeError(f"{lib} has no clip {clip['source']}")
        log("retarget", clip["name"], "<-", lib, clip["source"])
        made[clip["name"]] = retargeters[lib].bake(acts[clip["source"]], clip["name"],
                                                   clip["loop"])
    for clip in clips:
        if clip.get("derived") == "strafe":
            log("derive", clip["name"], "from", clip["from"])
            made[clip["name"]] = make_strafe(dst, made[clip["from"]], clip["name"],
                                             clip["side"], **strafe_args)
    # Keep the order of the JSON list.
    assign_action(dst, None)
    return [made[c["name"]] for c in clips]


def drop_foreign_actions(keep):
    keep = set(keep)
    for act in list(bpy.data.actions):
        if act not in keep:
            bpy.data.actions.remove(act)


def push_to_nla(arm, actions):
    """One NLA track per clip, named after the clip, so the exporter names animations well."""
    ad = arm.animation_data or arm.animation_data_create()
    ad.action = None
    for act in actions:
        track = ad.nla_tracks.new()
        track.name = act.name
        strip = track.strips.new(act.name, int(act.frame_range[0]), act)
        strip.name = act.name
        track.mute = True


# --------------------------------------------------------------------------------------------
# Export and reporting


def export_glb(path, objects, morphs=True, copyright_text=""):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=False,
        export_animations=True,
        export_animation_mode="NLA_TRACKS",
        export_force_sampling=True,
        export_optimize_animation_size=True,
        # Every clip keys every bone (constant ones with two keys), so a clip fully sets the
        # pose. strip_rest_channels() later removes the channels that never leave the rest pose.
        export_optimize_animation_keep_anim_armature=True,
        export_anim_single_armature=True,
        export_reset_pose_bones=True,
        export_rest_position_armature=True,
        export_skins=True,
        export_influence_nb=4,
        export_morph=morphs,
        export_morph_normal=morphs,
        export_morph_tangent=False,
        export_morph_animation=False,
        export_try_sparse_sk=True,
        export_image_format="AUTO",
        export_jpeg_quality=85,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
        export_extras=True,
        export_copyright=copyright_text,
    )
    return path


def _read_glb(path):
    data = Path(path).read_bytes()
    json_len = struct.unpack_from("<I", data, 12)[0]
    gltf = json.loads(data[20:20 + json_len].decode("utf-8"))
    rest = data[20 + json_len:]
    bin_chunk = b""
    if len(rest) >= 8:
        bin_len, _ = struct.unpack_from("<II", rest, 0)
        bin_chunk = rest[8:8 + bin_len]
    return gltf, bin_chunk


def _write_glb(path, gltf, bin_chunk):
    js = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
    js += b" " * ((4 - len(js) % 4) % 4)
    binp = bin_chunk + b"\0" * ((4 - len(bin_chunk) % 4) % 4)
    total = 12 + 8 + len(js) + (8 + len(binp) if binp else 0)
    out = struct.pack("<III", 0x46546C67, 2, total) + struct.pack("<II", len(js), 0x4E4F534A) + js
    if binp:
        out += struct.pack("<II", len(binp), 0x004E4942) + binp
    Path(path).write_bytes(out)


def _accessor_floats(gltf, bin_chunk, index):
    import numpy as np
    acc = gltf["accessors"][index]
    view = gltf["bufferViews"][acc["bufferView"]]
    comps = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}[acc["type"]]
    if acc["componentType"] != 5126:
        raise ValueError("expected float accessor")
    start = view.get("byteOffset", 0) + acc.get("byteOffset", 0)
    stride = view.get("byteStride", 4 * comps)
    raw = np.frombuffer(bin_chunk, dtype=np.uint8, count=stride * acc["count"], offset=start)
    rows = raw.reshape(acc["count"], stride)[:, :4 * comps].copy()
    return rows.view("<f4").reshape(acc["count"], comps)


def strip_rest_channels(src, dst, tolerance=1e-5):
    """Remove translation and scale channels that hold the rest value in every clip.

    Blender writes translation, rotation and scale for every bone in every clip. A bone whose
    translation (or scale) never leaves its rest value in any clip does not need those
    channels; dropping them makes the file smaller and lets the game move such a bone (for
    example to follow a morph that shifts a joint) without a clip undoing it. Rotation is kept
    everywhere, so every clip still sets the whole pose.
    """
    import numpy as np
    gltf, bin_chunk = _read_glb(src)
    nodes = gltf["nodes"]
    defaults = {"translation": [0.0, 0.0, 0.0], "scale": [1.0, 1.0, 1.0]}
    moving = set()
    for anim in gltf.get("animations", []):
        for ch in anim["channels"]:
            path = ch["target"]["path"]
            if path not in defaults:
                continue
            node = ch["target"]["node"]
            rest = np.array(nodes[node].get(path, defaults[path]))
            values = _accessor_floats(gltf, bin_chunk, anim["samplers"][ch["sampler"]]["output"])
            if np.abs(values - rest).max() > tolerance:
                moving.add((node, path))
    removed = 0
    for anim in gltf.get("animations", []):
        keep = [ch for ch in anim["channels"]
                if ch["target"]["path"] not in defaults
                or (ch["target"]["node"], ch["target"]["path"]) in moving]
        removed += len(anim["channels"]) - len(keep)
        used = sorted({ch["sampler"] for ch in keep})
        remap = {old: new for new, old in enumerate(used)}
        anim["samplers"] = [anim["samplers"][i] for i in used]
        for ch in keep:
            ch["sampler"] = remap[ch["sampler"]]
        anim["channels"] = keep
    _write_glb(dst, gltf, bin_chunk)
    return removed, sorted({nodes[n].get("name") for n, p in moving if p == "translation"})


_COMPONENT = {5120: "<i1", 5121: "<u1", 5122: "<i2", 5123: "<u2", 5125: "<u4", 5126: "<f4"}
_COMPONENTS = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}


def sparsify_morphs(src, dst, ratio=1 / 3):
    """Store morph target accessors that are mostly zero as sparse accessors, then repack the
    binary buffer so the dense copies are dropped. Returns how many accessors changed."""
    import numpy as np
    gltf, bin_chunk = _read_glb(src)
    accessors, views = gltf["accessors"], gltf["bufferViews"]
    targets = set()
    for mesh in gltf.get("meshes", []):
        for prim in mesh["primitives"]:
            for t in prim.get("targets", []):
                targets.update(t.values())
    extra = []  # (bytes) for new buffer views, indexed from len(views)
    changed = 0
    for ai in sorted(targets):
        acc = accessors[ai]
        if "sparse" in acc or "bufferView" not in acc:
            continue
        dtype = np.dtype(_COMPONENT[acc["componentType"]])
        comps = _COMPONENTS[acc["type"]]
        elem = dtype.itemsize * comps
        view = views[acc["bufferView"]]
        stride = view.get("byteStride", elem)
        start = view.get("byteOffset", 0) + acc.get("byteOffset", 0)
        count = acc["count"]
        raw = np.frombuffer(bin_chunk, dtype=np.uint8, count=stride * (count - 1) + elem,
                            offset=start)
        rows = np.lib.stride_tricks.as_strided(raw, shape=(count, elem), strides=(stride, 1))
        values = np.ascontiguousarray(rows).view(dtype).reshape(count, comps)
        nonzero = np.any(values != 0, axis=1)
        n = int(nonzero.sum())
        if n / count >= ratio:
            continue
        del acc["bufferView"]
        acc.pop("byteOffset", None)
        changed += 1
        if n == 0:
            continue  # an accessor with no buffer view is all zeros
        idx = np.nonzero(nonzero)[0]
        if count <= 255:
            idx_type, idx_ct = np.dtype("<u1"), 5121
        elif count <= 65535:
            idx_type, idx_ct = np.dtype("<u2"), 5123
        else:
            idx_type, idx_ct = np.dtype("<u4"), 5125
        extra.append(idx.astype(idx_type).tobytes())
        iv = len(views) + len(extra) - 1
        extra.append(np.ascontiguousarray(values[idx]).tobytes())
        vv = len(views) + len(extra) - 1
        acc["sparse"] = {"count": n,
                         "indices": {"bufferView": iv, "componentType": idx_ct},
                         "values": {"bufferView": vv}}
    # Repack: keep only buffer views that something still uses.
    used = set()
    for acc in accessors:
        if "bufferView" in acc:
            used.add(acc["bufferView"])
        if "sparse" in acc:
            used.add(acc["sparse"]["indices"]["bufferView"])
            used.add(acc["sparse"]["values"]["bufferView"])
    for img in gltf.get("images", []):
        if "bufferView" in img:
            used.add(img["bufferView"])
    out = bytearray()
    new_views, remap = [], {}
    for old in sorted(used):
        if old < len(views):
            v = dict(views[old])
            data = bin_chunk[v.get("byteOffset", 0):v.get("byteOffset", 0) + v["byteLength"]]
        else:
            v = {"buffer": 0}
            data = extra[old - len(views)]
        out += b"\0" * ((-len(out)) % 8)
        v["byteOffset"] = len(out)
        v["byteLength"] = len(data)
        out += data
        remap[old] = len(new_views)
        new_views.append(v)
    for acc in accessors:
        if "bufferView" in acc:
            acc["bufferView"] = remap[acc["bufferView"]]
        if "sparse" in acc:
            acc["sparse"]["indices"]["bufferView"] = remap[acc["sparse"]["indices"]["bufferView"]]
            acc["sparse"]["values"]["bufferView"] = remap[acc["sparse"]["values"]["bufferView"]]
    for img in gltf.get("images", []):
        if "bufferView" in img:
            img["bufferView"] = remap[img["bufferView"]]
    gltf["bufferViews"] = new_views
    gltf["buffers"] = [{"byteLength": len(out)}]
    _write_glb(dst, gltf, bytes(out))
    return changed


def gltf_transform():
    """The gltf-transform command from the repository's node_modules, or None."""
    cli = REPO / "node_modules" / ".bin" / "gltf-transform"
    return cli if cli.exists() else None


def finish_glb(raw, out):
    """Strip unused channels; then, if glTF-Transform is installed, resample the clips, prune,
    quantize (KHR_mesh_quantization, which Babylon.js reads without a decoder) and store the
    morph targets sparsely."""
    import shutil
    import subprocess
    out = Path(out)
    out.parent.mkdir(parents=True, exist_ok=True)
    stripped = Path(raw).with_suffix(".stripped.glb")
    removed, moving = strip_rest_channels(raw, stripped)
    log(f"  removed {removed} rest-pose channels; translation kept for {moving}")
    cli = gltf_transform()
    if cli is None:
        log("  glTF-Transform is not in node_modules: copying without compression")
        shutil.copyfile(stripped, out)
        return False
    env = dict(os.environ)
    env["PATH"] = os.pathsep.join([str(Path.home() / ".local" / "bin"), env.get("PATH", "")])
    tidy = Path(raw).with_suffix(".tidy.glb")
    quant = Path(raw).with_suffix(".quant.glb")
    steps = [
        # Resample clips (lossless), drop unused data; no other changes to the scene.
        ["optimize", stripped, tidy, "--compress", "false", "--texture-compress", "false",
         "--simplify", "false", "--instance", "false", "--join", "false", "--flatten", "false",
         "--palette", "false", "--weld", "false", "--prune", "true",
         "--prune-solid-textures", "false", "--resample", "true", "--sparse", "false"],
        # 16- and 8-bit vertex data (KHR_mesh_quantization; no decoder needed). One buffer
        # view per accessor, so sparsify_morphs() can drop the dense morph data.
        ["quantize", tidy, quant, "--vertex-layout", "separate"],
    ]
    for step in steps:
        subprocess.run([str(cli)] + [str(a) for a in step], check=True, env=env, cwd=str(REPO),
                       stdout=subprocess.DEVNULL)
    # glTF-Transform 4.5.1's own "sparse" step writes zeros for normalised (quantised)
    # accessors, so morph targets are made sparse here instead.
    converted = sparsify_morphs(quant, out)
    log(f"  stored {converted} morph target accessors sparsely")
    return True


def glb_report(path):
    """Read a .glb's JSON chunk: triangles, bones, clips, morph targets, images, size."""
    path = Path(path)
    data = path.read_bytes()
    magic, _version, _length = struct.unpack_from("<III", data, 0)
    if magic != 0x46546C67:
        raise ValueError(f"{path} is not a .glb")
    chunk_len, _chunk_type = struct.unpack_from("<II", data, 12)
    gltf = json.loads(data[20:20 + chunk_len].decode("utf-8"))
    accessors = gltf.get("accessors", [])
    tris = 0
    morph_names = []
    meshes = []
    for mesh in gltf.get("meshes", []):
        mtris = 0
        for prim in mesh.get("primitives", []):
            if prim.get("mode", 4) != 4:
                continue
            if "indices" in prim:
                mtris += accessors[prim["indices"]]["count"] // 3
            else:
                mtris += accessors[prim["attributes"]["POSITION"]]["count"] // 3
        tris += mtris
        names = mesh.get("extras", {}).get("targetNames", [])
        morph_names.extend(n for n in names if n not in morph_names)
        meshes.append({"name": mesh.get("name"), "triangles": mtris, "morphTargets": len(names)})
    skins = gltf.get("skins", [])
    nodes = gltf.get("nodes", [])
    images = []
    for img in gltf.get("images", []):
        images.append({"name": img.get("name"), "mimeType": img.get("mimeType")})
    return {
        "path": str(path.relative_to(REPO)) if path.is_relative_to(REPO) else str(path),
        "bytes": len(data),
        "megabytes": round(len(data) / 1e6, 2),
        "triangles": tris,
        "meshes": meshes,
        "bones": len(skins[0]["joints"]) if skins else 0,
        "boneNames": [nodes[j].get("name") for j in skins[0]["joints"]] if skins else [],
        "animations": [a.get("name") for a in gltf.get("animations", [])],
        "morphTargets": morph_names,
        "images": images,
        "extensionsUsed": gltf.get("extensionsUsed", []),
    }


def write_report(report, rel):
    out = REPO / rel
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
        f.write("\n")
    return out
