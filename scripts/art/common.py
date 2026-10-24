"""Shared helpers for the Blender art scripts (mannequin.py, hero.py).

Runs inside Blender's bundled Python. It needs no add-ons of its own; hero.py enables MPFB.

What is here:
- paths and the JSON settings under art/;
- importing the Universal Animation Library (UAL) files;
- a retargeter that copies animation from one skeleton to another by world-space rotation,
  so it works when the two skeletons have different bone names, rolls and rest poses;
- make_upright(), which straightens UAL's relaxed standing clips, and derive_clip(), which
  makes clips from others (played backwards, slowed, softened);
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

    Every mapped target bone takes the source bone's change of world-space rotation from its
    rest pose. How the two rest poses are matched depends on the bone:

    - Arms, hands and fingers (align_rest): the target's rest bone is first turned to point
      the same way as the source's, so an A-pose arm follows a T-pose arm.
    - Thighs and shins (side_only): only their sideways spread is matched, so an A-pose's
      spread legs stand under the hips, while the knees and ankles keep the target's own
      upright stance from the side.
    - The pelvis, spine, neck, head, collarbones and feet (no_align): their bone directions
      are rig conventions (one rig's pelvis bone points forward, the other's backward), so
      they take the rotation change alone: when the source's pelvis tips 5 degrees, so does
      the target's, from its own upright rest, and a flat foot stays flat.
    - The trunk (trunk): the spine, neck and head also turn together, once, so that the line
      from the target's pelvis to its head leans as the source's does at rest. Then a clip
      leans the trunk exactly as much on both.

    The hips (and root) also take the source's movement, scaled by the ratio of hip heights.
    Unmapped target bones keep their rest pose relative to their parent.
    """

    def __init__(self, src, dst, dst_to_src, hips="pelvis", root=None, align_rest=True,
                 no_align=(), trunk=(), side_only=()):
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
        no_align = {n.lower() for n in no_align}
        side_only = {n.lower() for n in side_only}
        trunk = [n for n in trunk if n in self.map]
        self.trunk = trunk
        self.trunk_tree = []
        if trunk:
            first = dst.data.bones[trunk[0]]
            self.trunk_tree = [first.name] + [c.name for c in first.children_recursive]
        trunk_turn = self._trunk_turn(trunk) if trunk else Quaternion()
        self.trunk_turn_deg = math.degrees(trunk_turn.angle) * (1 if trunk_turn.x >= 0 else -1)
        self.offset = {}
        for d, s in self.map.items():
            qd = self.rest_dw[d].to_quaternion()
            qs = self.rest_sw[s].to_quaternion()
            align = Quaternion()
            if d in trunk:
                align = trunk_turn
            elif align_rest and d.lower() in side_only:
                # Only the sideways angle seen from the front: an A-pose's spread legs come
                # together, while the knees and ankles keep the target's own upright stance.
                yd = self.rest_dw[d].to_3x3() @ Vector((0, 1, 0))
                ys = self.rest_sw[s].to_3x3() @ Vector((0, 1, 0))
                spread_d = math.atan2(yd.x, -yd.z)
                spread_s = math.atan2(ys.x, -ys.z)
                align = Quaternion((0, 1, 0), spread_d - spread_s)
            elif align_rest and d.lower() not in no_align:
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

    def _trunk_turn(self, trunk):
        """The turn about the side-to-side axis that makes the target's rest line from pelvis
        to head lean as the source's does."""
        def lean(v):
            return math.atan2(-v.y, v.z)

        top_d, top_s = trunk[-1], self.map[trunk[-1]]
        pelvis_d, pelvis_s = self.rest_dw[self.hips].translation, \
            self.rest_sw[self.map[self.hips]].translation
        want = lean(self.rest_sw[top_s].translation - pelvis_s)
        pivot = self.rest_dw[trunk[0]].translation
        arm = self.rest_dw[top_d].translation - pivot
        theta = want - lean(arm + pivot - pelvis_d)
        for _ in range(8):  # the pivot is not the pelvis, so refine
            q = Quaternion((1, 0, 0), theta)
            got = lean(pivot + q @ arm - pelvis_d)
            theta += want - got
        return Quaternion((1, 0, 0), theta)

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
        if self.trunk:
            self._match_trunk(worlds)
        return worlds

    def _match_trunk(self, worlds):
        """Turn the spine (and all it carries) about its base so that the line from the
        target's pelvis to its head points exactly as the source's does. The bones keep the
        source's rotation changes; this only removes the lean that different spine
        proportions add when the spine bends."""
        sw, sp = self.src.matrix_world, self.src.pose.bones
        v_s = (sw @ sp[self.map[self.trunk[-1]]].matrix).translation \
            - (sw @ sp[self.map[self.hips]].matrix).translation
        pelvis = worlds[self.hips].translation
        pivot = worlds[self.trunk[0]].translation.copy()
        for _ in range(3):
            head = worlds[self.trunk[-1]].translation
            want = pelvis + v_s.normalized() * (head - pelvis).length
            turn = (head - pivot).rotation_difference(want - pivot)
            if turn.angle < 1e-5:
                break
            m = Matrix.Translation(pivot) @ turn.to_matrix().to_4x4() @ Matrix.Translation(-pivot)
            for n in self.trunk_tree:
                worlds[n] = m @ worlds[n]

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


def _find(arm, name):
    low = name.lower()
    for b in arm.data.bones:
        if b.name.lower() == low:
            return b.name
    raise KeyError(name)


def _mean_quat(quats):
    """The average of nearby rotations (sum and normalise; mathutils' 4D Vector.normalized()
    leaves the fourth value alone, so the sum is normalised as a Quaternion)."""
    ref = quats[0]
    acc = [0.0, 0.0, 0.0, 0.0]
    for q in quats:
        sign = 1.0 if ref.dot(q) >= 0 else -1.0
        for k in range(4):
            acc[k] += sign * q[k]
    return Quaternion(acc).normalized()


def make_upright(arm, action, name, *, lean_back_deg=2.5, sway=0.5, bob=0.1, toe_out_deg=5.0,
                 knee_bend_deg=1.5, knee_room=0.0005, loop=True):
    """A standing clip made upright, for an armature with Unreal-style bone names.

    UAL's standing idles are relaxed: head forward, knees bent, one foot well ahead of the
    other. This keeps the clip's small movements (breathing, weight shifts, the arms and the
    head) but removes its average lean:
    - the pelvis keeps only its movement around its average, from the upright rest pose; its
      sway is scaled by `sway`, and its rise and fall by `sway * bob`;
    - the spine, neck and head keep only their movement around their average, and the spine
      leans back by `lean_back_deg` from the T-pose's slight forward lean;
    - the feet stand flat under the hips, turned out a little, and the legs reach them with a
      two-bone solve; at each frame the hips rise just enough that neither knee bends more than
      `knee_bend_deg`.
    """
    scene = bpy.context.scene
    order = bones_in_order(arm)
    rest = {b.name: b.matrix_local.copy() for b in arm.data.bones}
    pelvis = _find(arm, "pelvis")
    trunk = [_find(arm, n) for n in ("spine_01", "spine_02", "spine_03", "neck_01", "head")]
    legs = [[_find(arm, f"{part}_{s}") for part in ("thigh", "calf", "foot", "ball")]
            for s in ("l", "r")]
    leg_bones = {n for leg in legs for n in leg}
    for leg in legs:
        leg_bones.update(c.name for c in arm.data.bones[leg[0]].children_recursive)
    assign_action(arm, action)
    frames = frame_span(action)
    pose = arm.pose.bones
    basis_q = {b.name: [] for b in order}
    pel_q, pel_t = [], []
    for f in frames:
        scene.frame_set(f)
        for b in order:
            basis_q[b.name].append(pose[b.name].matrix_basis.to_quaternion())
        pel_q.append(pose[pelvis].matrix.to_quaternion())
        pel_t.append(pose[pelvis].matrix.translation.copy())
    mean_pel_q = _mean_quat(pel_q)
    mean_pel_t = sum(pel_t, Vector()) / len(pel_t)
    mean_trunk = {n: _mean_quat(basis_q[n]) for n in trunk}
    back = Quaternion((1, 0, 0), -math.radians(lean_back_deg))
    leg_len = []
    for thigh, calf, foot, _ball in legs:
        l1 = (rest[calf].translation - rest[thigh].translation).length
        l2 = (rest[foot].translation - rest[calf].translation).length
        reach = math.sqrt(l1 * l1 + l2 * l2 + 2 * l1 * l2 * math.cos(math.radians(knee_bend_deg)))
        leg_len.append(reach)

    def local(n):
        p = arm.data.bones[n].parent
        return rest[p.name].inverted() @ rest[n] if p else rest[n]

    per_frame = []
    for i, _f in enumerate(frames):
        N = {}
        for b in order:
            n = b.name
            p = b.parent.name if b.parent else None
            if p is None:
                N[n] = rest[n].copy()
                continue
            if n == pelvis:
                rot = (pel_q[i] @ mean_pel_q.inverted()) @ rest[n].to_quaternion()
                move = (pel_t[i] - mean_pel_t) * sway
                move.z *= bob  # the hips barely rise and fall, so the knees stay straight
                pos = rest[n].translation + move
                m = Matrix.Translation(pos) @ rot.to_matrix().to_4x4()
                # Raise the hips just enough that neither knee bends more than knee_bend_deg
                # (the other leg straightens, as when weight shifts onto it).
                lift = 0.0
                for (thigh, _c, foot, _b), reach in zip(legs, leg_len):
                    d = (m @ local(thigh)).translation - rest[foot].translation
                    need = math.sqrt(max(0.0, reach * reach - d.x * d.x - d.y * d.y)) - d.z
                    lift = max(lift, need)
                N[n] = Matrix.Translation((0, 0, lift)) @ m
                continue
            if n in leg_bones:
                continue  # solved below, after the pelvis
            if n in mean_trunk:
                q = mean_trunk[n].inverted() @ basis_q[n][i]
            else:
                q = basis_q[n][i]
            m = N[p] @ local(n) @ q.to_matrix().to_4x4()
            if n == trunk[0]:
                h = m.translation.copy()
                m = Matrix.Translation(h) @ back.to_matrix().to_4x4() @ Matrix.Translation(-h) @ m
            N[n] = m
        for side, (thigh, calf, foot, ball) in zip((1, -1), legs):
            hip = (N[pelvis] @ local(thigh)).translation
            l1 = (rest[calf].translation - rest[thigh].translation).length
            l2 = (rest[foot].translation - rest[calf].translation).length
            ankle = rest[foot].translation.copy()
            d = ankle - hip
            dist = min(d.length, l1 + l2 - knee_room)
            dirn = d.normalized()
            turn = Quaternion((0, 0, 1), side * math.radians(toe_out_deg))
            pole = turn @ Vector((0, -1, 0))
            pole = (pole - dirn * pole.dot(dirn)).normalized()
            cos_a = max(-1.0, min(1.0, (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist)))
            a = math.acos(cos_a)
            knee = hip + dirn * math.cos(a) * l1 + pole * math.sin(a) * l1
            ankle = hip + dirn * dist
            for bone, head, tail in ((thigh, hip, knee), (calf, knee, ankle)):
                # turn the leg out with the foot first, so the knee faces the way the toes do
                turned = turn @ rest[bone].to_quaternion()
                rest_dir = turned @ Vector((0, 1, 0))
                q = rest_dir.rotation_difference(tail - head) @ turned
                N[bone] = Matrix.Translation(head) @ q.to_matrix().to_4x4()
            fq = turn @ rest[foot].to_quaternion()
            N[foot] = Matrix.Translation(ankle) @ fq.to_matrix().to_4x4()
            N[ball] = N[foot] @ local(ball)
            for child in arm.data.bones[ball].children_recursive:
                N[child.name] = N[child.parent.name] @ local(child.name)
        per_frame.append(worlds_to_basis(arm, order, rest, N, Matrix.Identity(4)))
    start = frames[0]
    act = store_pose_track(arm, name, [f - start for f in frames], per_frame, loop)
    assign_action(arm, None)
    return act


def straighten(arm, action, name, amount=0.5, loop=True):
    """A clip with part of the spine's average forward bend taken out (amount 0 to 1), for
    an armature with Unreal-style names. UAL's walks and jogs lean well forward; the legs,
    arms and every movement are kept."""
    scene = bpy.context.scene
    trunk = [_find(arm, n) for n in ("spine_01", "spine_02", "spine_03", "neck_01", "head")]
    assign_action(arm, action)
    frames = frame_span(action)
    rows = []
    for f in frames:
        scene.frame_set(f)
        rows.append({pb.name: pb.matrix_basis.copy() for pb in arm.pose.bones})
    for n in trunk:
        mean = _mean_quat([r[n].to_quaternion() for r in rows])
        fix = Quaternion().slerp(mean.inverted(), amount)
        for r in rows:
            q = fix @ r[n].to_quaternion()
            r[n] = Matrix.Translation(r[n].translation) @ q.to_matrix().to_4x4()
    act = store_pose_track(arm, name, [f - frames[0] for f in frames], rows, loop)
    assign_action(arm, None)
    return act


def sample_basis(arm, action):
    """Each bone's matrix_basis at every frame of an action."""
    scene = bpy.context.scene
    assign_action(arm, action)
    frames = frame_span(action)
    rows = []
    for f in frames:
        scene.frame_set(f)
        rows.append({pb.name: pb.matrix_basis.copy() for pb in arm.pose.bones})
    assign_action(arm, None)
    return rows


def _blend(a, b, t):
    qa, qb = a.to_quaternion(), b.to_quaternion()
    if qa.dot(qb) < 0:
        qb.negate()
    q = qa.slerp(qb, t)
    loc = a.translation.lerp(b.translation, t)
    return Matrix.Translation(loc) @ q.to_matrix().to_4x4()


def derive_clip(arm, base, name, *, reverse=False, stretch=1.0, toward=None, amount=0.0,
                loop=True):
    """A clip made from another on the same skeleton: played backwards, slowed or sped up
    (stretch), and/or blended part of the way (amount) towards the first frame of another
    clip (toward), which softens a movement, for example a side jog into a side walk."""
    rows = sample_basis(arm, base)
    if reverse:
        rows = rows[::-1]
    if toward is not None and amount > 0:
        target = sample_basis(arm, toward)[0]
        rows = [{n: _blend(m, target[n], amount) for n, m in row.items()} for row in rows]
    if abs(stretch - 1.0) > 1e-6:
        count = int(round((len(rows) - 1) * stretch)) + 1
        out = []
        for k in range(count):
            t = k / stretch
            i = min(int(t), len(rows) - 2)
            frac = max(0.0, min(1.0, t - i))
            out.append({n: _blend(rows[i][n], rows[i + 1][n], frac) for n in rows[i]})
        rows = out
    return store_pose_track(arm, name, list(range(len(rows))), rows, loop)


# How each part of the skeleton is matched between rest poses (see Retargeter): the trunk
# and collarbones by rotation change alone (their bone directions are rig conventions), the
# feet the same (so a flat foot stays flat), the legs by their sideways spread only, and the
# arms, hands and fingers by direction (an A-pose arm onto a T-pose arm).
NO_ALIGN = ("root", "pelvis", "spine_01", "spine_02", "spine_03", "neck_01", "head",
            "clavicle_l", "clavicle_r", "foot_l", "foot_r", "ball_l", "ball_r")
SIDE_ONLY = ("thigh_l", "thigh_r", "calf_l", "calf_r")
TRUNK = ("spine_01", "spine_02", "spine_03", "neck_01", "head")


def retarget_options(dst):
    """Retargeter settings with the trunk's bone names spelt as dst spells them."""
    names = {b.name.lower(): b.name for b in dst.data.bones}
    return {"align_rest": True, "no_align": NO_ALIGN, "side_only": SIDE_ONLY,
            "trunk": [names[n] for n in TRUNK if n in names]}


def bone_map(dst, src, naming):
    """{dst bone: src bone} for a source with Unreal-style or Rigify-style names."""
    if naming == "rigify":
        by_lower = {u.lower(): r for r, u in RIGIFY_TO_UNREAL.items()}
    else:
        by_lower = {b.name.lower(): b.name for b in src.data.bones}
    return {b.name: by_lower[b.name.lower()] for b in dst.data.bones
            if b.name.lower() in by_lower}


def load_sources(cfg):
    """Import each animation library once: {library: (armature, {clip: action})}."""
    sources = {}
    for lib, info in cfg["libraries"].items():
        objs = import_glb(REPO / info["file"])
        arm = armature_of(objs)
        delete_objects([o for o in objs if o is not arm])
        acts = actions_by_name(arm)
        clear_animation(arm)
        arm.location = (0.0, 2.0, 0.0)  # out of the way; motion is measured from rest
        sources[lib] = (arm, acts)
    return sources


def build_clips(dst, clips, sources, dst_to_src_for, hips, root, retarget):
    """Bake every clip listed in art/animations.json onto dst.

    sources: {library: (armature, {clip name: action})}
    dst_to_src_for: {library: {dst bone: src bone}}
    retarget: keyword arguments for Retargeter (align_rest, no_align, trunk)
    Clips with "upright" are first made upright on the source (make_upright), and clips with
    "straighten" have part of their forward bend removed (straighten), so every character gets
    the same corrected clip. Clips with "derived" are made on dst afterwards.
    """
    made = {}
    retargeters = {}
    upright_cache = {}
    for clip in clips:
        if "derived" in clip:
            continue
        lib = clip["library"]
        src_arm, acts = sources[lib]
        if lib not in retargeters:
            retargeters[lib] = Retargeter(src_arm, dst, dst_to_src_for[lib], hips=hips,
                                          root=root, **retarget)
            log(f"retargeting from {lib}: trunk turned {retargeters[lib].trunk_turn_deg:.1f}"
                " degrees to match the source's rest lean")
        if clip["source"] not in acts:
            raise RuntimeError(f"{lib} has no clip {clip['source']}")
        action = acts[clip["source"]]
        if "upright" in clip:
            key = (lib, clip["source"], json.dumps(clip["upright"], sort_keys=True))
            if key not in upright_cache:
                upright_cache[key] = make_upright(src_arm, action, f"__upright_{clip['name']}",
                                                  loop=clip["loop"], **clip["upright"])
            action = upright_cache[key]
        elif "straighten" in clip:
            key = (lib, clip["source"], "straighten", clip["straighten"])
            if key not in upright_cache:
                upright_cache[key] = straighten(src_arm, action, f"__straight_{clip['name']}",
                                                clip["straighten"], loop=clip["loop"])
            action = upright_cache[key]
        log("retarget", clip["name"], "<-", lib, clip["source"],
            "(made upright)" if "upright" in clip else
            "(straightened)" if "straighten" in clip else "")
        made[clip["name"]] = retargeters[lib].bake(action, clip["name"], clip["loop"])
    for clip in clips:
        if "derived" not in clip:
            continue
        log("derive", clip["name"], "from", clip["from"])
        made[clip["name"]] = derive_clip(
            dst, made[clip["from"]], clip["name"], reverse=clip.get("reverse", False),
            stretch=clip.get("stretch", 1.0), toward=made.get(clip.get("toward")),
            amount=clip.get("amount", 0.0), loop=clip["loop"])
    # Keep the order of the JSON list.
    assign_action(dst, None)
    for act in upright_cache.values():
        bpy.data.actions.remove(act)
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


def _accessor_array(gltf, bin_chunk, acc):
    import numpy as np
    dtype = np.dtype(_COMPONENT[acc["componentType"]])
    comps = _COMPONENTS[acc["type"]]
    elem = dtype.itemsize * comps
    view = gltf["bufferViews"][acc["bufferView"]]
    stride = view.get("byteStride", elem)
    start = view.get("byteOffset", 0) + acc.get("byteOffset", 0)
    count = acc["count"]
    raw = np.frombuffer(bin_chunk, dtype=np.uint8, count=stride * (count - 1) + elem, offset=start)
    rows = np.lib.stride_tricks.as_strided(raw, shape=(count, elem), strides=(stride, 1))
    return np.ascontiguousarray(rows).view(dtype).reshape(count, comps)


def shrink_glb(src, dst, ratio=1 / 3):
    """The last size savings, then a repack of the binary buffer so replaced data is dropped:
    - morph target accessors that are mostly zero become sparse accessors;
    - clip rotations are stored as 16-bit normalised numbers (allowed by core glTF 2.0);
    - clip output accessors lose their optional min and max.
    Returns (morph accessors made sparse, rotation accessors made 16-bit)."""
    import numpy as np
    gltf, bin_chunk = _read_glb(src)
    accessors, views = gltf["accessors"], gltf["bufferViews"]
    # New data goes into three shared buffer views (few views keep the JSON small).
    pools = {k: bytearray() for k in ("rotations", "sparse_indices", "sparse_values")}
    pool_view = {k: len(views) + i for i, k in enumerate(pools)}

    def put(pool, blob):
        data = pools[pool]
        data += b"\0" * ((-len(data)) % 4)
        offset = len(data)
        data += blob
        return {"bufferView": pool_view[pool], "byteOffset": offset}

    rotations = set()
    for anim in gltf.get("animations", []):
        for ch in anim["channels"]:
            out = anim["samplers"][ch["sampler"]]["output"]
            accessors[out].pop("min", None)
            accessors[out].pop("max", None)
            if ch["target"]["path"] == "rotation":
                rotations.add(out)
    shortened = 0
    for ai in sorted(rotations):
        acc = accessors[ai]
        if acc["componentType"] != 5126 or "bufferView" not in acc or "sparse" in acc:
            continue
        values = _accessor_array(gltf, bin_chunk, acc)
        packed = np.round(np.clip(values, -1.0, 1.0) * 32767.0).astype("<i2")
        acc.update(put("rotations", packed.tobytes()))
        acc["componentType"] = 5122
        acc["normalized"] = True
        shortened += 1
    targets = set()
    for mesh in gltf.get("meshes", []):
        for prim in mesh["primitives"]:
            for t in prim.get("targets", []):
                targets.update(t.values())
    changed = 0
    for ai in sorted(targets):
        acc = accessors[ai]
        if "sparse" in acc or "bufferView" not in acc:
            continue
        count = acc["count"]
        values = _accessor_array(gltf, bin_chunk, acc)
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
        indices = put("sparse_indices", idx.astype(idx_type).tobytes())
        indices["componentType"] = idx_ct
        acc["sparse"] = {"count": n, "indices": indices,
                         "values": put("sparse_values", np.ascontiguousarray(values[idx]).tobytes())}
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
            data = bytes(list(pools.values())[old - len(views)])
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
    return changed, shortened


def gltf_transform():
    """The gltf-transform command from the repository's node_modules, or None."""
    cli = REPO / "node_modules" / ".bin" / "gltf-transform"
    return cli if cli.exists() else None


def finish_glb(raw, out):
    """Strip unused channels; then, if glTF-Transform is installed, resample the clips, prune,
    quantize (KHR_mesh_quantization, which Babylon.js reads without a decoder; normals in 8
    bits), store the morph targets sparsely and the clip rotations in 16 bits."""
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
        # Share identical keyframe times and values between tracks.
        ["dedup", tidy, tidy],
        # 16- and 8-bit vertex data (KHR_mesh_quantization; no decoder needed). One buffer
        # view per accessor, so shrink_glb() can drop the dense morph data.
        ["quantize", tidy, quant, "--vertex-layout", "separate", "--quantize-normal", "8"],
    ]
    for step in steps:
        subprocess.run([str(cli)] + [str(a) for a in step], check=True, env=env, cwd=str(REPO),
                       stdout=subprocess.DEVNULL)
    # glTF-Transform 4.5.1's own "sparse" step writes zeros for normalised (quantised)
    # accessors, so morph targets are made sparse here instead.
    converted, shortened = shrink_glb(quant, out)
    log(f"  stored {converted} morph targets sparsely and {shortened} rotation tracks in 16 bits")
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
