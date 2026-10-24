"""Renders review pictures of the character files into art/out/previews/ (not shipped).

    blender -b --factory-startup --python scripts/art/preview.py

Makes posture-before-after.png (the old and new standing idle from the side, if the old files
were kept in art/out/posture/, then the new bodies from the front, side and back and in
mid-stride); and, for each hero body, a sheet of the three lineage presets (art/lineages.json),
a sheet of face close-ups and a sheet of animation poses. Uses Blender's EEVEE renderer.
"""

import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import bpy  # noqa: E402
import numpy as np  # noqa: E402
from mathutils import Vector  # noqa: E402

import common as C  # noqa: E402

PREVIEWS = C.ART / "out" / "previews"
POSES = ["idle:10", "walk:8", "jog:5", "strafe_left:8", "jog_back:8", "crouch_left:10",
         "pistol_aim:0", "pistol_shoot:3", "power_both_ready:10", "kick:12", "melee_combo:30",
         "dodge_left:12", "hit_knockback:6", "death:50", "climb_ledge:10", "turn_left:30",
         "roll:15", "walk_back:8"]


def setup_scene(width, height):
    scene = C.reset_scene()
    scene.render.engine = "BLENDER_EEVEE"
    scene.eevee.taa_render_samples = 16
    scene.render.resolution_x, scene.render.resolution_y = width, height
    world = bpy.data.worlds.new("Preview")
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (0.45, 0.47, 0.5, 1.0)
    bg.inputs[1].default_value = 0.8
    scene.world = world
    for name, energy, rot in (("Key", 3.0, (50, 0, 30)), ("Fill", 1.0, (70, 0, -120))):
        light = bpy.data.lights.new(name, "SUN")
        light.energy = energy
        obj = bpy.data.objects.new(name, light)
        obj.rotation_euler = tuple(math.radians(a) for a in rot)
        scene.collection.objects.link(obj)
    cam = bpy.data.objects.new("Camera", bpy.data.cameras.new("Camera"))
    scene.collection.objects.link(cam)
    scene.camera = cam
    return scene, cam


def load_character(path):
    objs = C.import_glb(path)
    arm = C.armature_of(objs)
    clips = C.actions_by_name(arm)
    C.clear_animation(arm)
    for pb in arm.pose.bones:
        pb.matrix_basis.identity()
    meshes = [o for o in objs if o.type == "MESH"]
    return arm, meshes, clips


def set_morphs(meshes, weights):
    for m in meshes:
        if m.data.shape_keys:
            for kb in m.data.shape_keys.key_blocks[1:]:
                kb.value = float(weights.get(kb.name, 0.0))


def render_tile(scene, path):
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    img = bpy.data.images.load(str(path))
    px = np.array(img.pixels[:]).reshape(img.size[1], img.size[0], 4)
    bpy.data.images.remove(img)
    return px


def save_sheet(tiles, cols, out):
    rows = math.ceil(len(tiles) / cols)
    h, w = tiles[0].shape[:2]
    sheet = np.ones((rows * h, cols * w, 4))
    for i, t in enumerate(tiles):
        r, c = divmod(i, cols)
        sheet[(rows - 1 - r) * h:(rows - r) * h, c * w:(c + 1) * w] = t
    img = bpy.data.images.new(out.stem, cols * w, rows * h)
    img.pixels = sheet.ravel().tolist()
    img.filepath_raw = str(out)
    img.file_format = "PNG"
    img.save()
    C.log("wrote", out.relative_to(C.REPO))


def aim(cam, target, angle_deg, dist, lens=50):
    a = math.radians(angle_deg)
    cam.data.lens = lens
    cam.location = target + Vector((dist * math.sin(a), -dist * math.cos(a), 0.0))
    cam.rotation_euler = (math.radians(90), 0, a)


def lineage_sheet(body, path, lineages):
    scene, cam = setup_scene(420, 640)
    arm, meshes, _ = load_character(path)
    tiles = []
    tmp = PREVIEWS / "tile.png"
    for key, preset in lineages.items():
        set_morphs(meshes, preset["morphs"])
        s = preset["heightScale"][body]
        arm.scale = (s, s, s)
        for angle in (0, 90):
            aim(cam, Vector((0, 0, 0.95)), angle, 5.2)
            tiles.append(render_tile(scene, tmp))
    save_sheet(tiles, len(tiles), PREVIEWS / f"{body}-lineages.png")


def face_sheet(body, path, morphs):
    scene, cam = setup_scene(400, 400)
    arm, meshes, _ = load_character(path)
    head = arm.matrix_world @ arm.pose.bones["head"].head + Vector((0, 0, 0.07))
    tiles = []
    tmp = PREVIEWS / "tile.png"
    views = [({}, 15), ({}, 90)] + [({m: 1.0}, 15) for m in morphs if m.startswith("face_")]
    for weights, angle in views:
        set_morphs(meshes, weights)
        aim(cam, head, angle, 0.6)
        tiles.append(render_tile(scene, tmp))
    save_sheet(tiles, 6, PREVIEWS / f"{body}-faces.png")


def _material(name):
    return bpy.data.materials.get(name) or next(
        (m for m in bpy.data.materials if m.name.startswith(name + ".")), None)


def _base_image_node(mat):
    for node in mat.node_tree.nodes:
        if node.type == "TEX_IMAGE":
            return node
    return None


def _hide_material(mat):
    """Make a material invisible (to hide the hero's default hair)."""
    bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    for link in list(bsdf.inputs["Alpha"].links):
        mat.node_tree.links.remove(link)
    bsdf.inputs["Alpha"].default_value = 0.0
    mat.surface_render_method = "BLENDED"


def looks_sheet(body, path, manifest):
    """art/out/previews/looks-<body>.png: every skin, every hair style and every eye colour."""
    looks = manifest["looks"][body]
    scene, cam = setup_scene(360, 400)
    arm, meshes, _ = load_character(path)
    head = arm.matrix_world @ arm.pose.bones["head"].head + Vector((0, 0, 0.06))
    tmp = PREVIEWS / "tile.png"
    tiles = []
    skin_mat = _material(f"{body}_skin")
    skin_node = _base_image_node(skin_mat)
    default_skin = skin_node.image
    for skin in looks["skins"]:
        skin_node.image = bpy.data.images.load(str(C.OUT_CHARACTERS / skin["file"]))
        aim(cam, head, 20, 0.75)
        label = _label(scene, cam, f"skin: {skin['label']}")
        tiles.append(render_tile(scene, tmp))
        bpy.data.objects.remove(label)
    skin_node.image = default_skin
    hair_mat = _material(f"{body}_hair")
    _hide_material(hair_mat)
    for hair in looks["hair"]:
        added = []
        if hair["file"]:
            added = C.import_glb(C.OUT_CHARACTERS / hair["file"])
        for angle in (20, 160):
            aim(cam, head, angle, 0.9)
            label = _label(scene, cam, f"hair: {hair['label']}")
            tiles.append(render_tile(scene, tmp))
            bpy.data.objects.remove(label)
        C.delete_objects(added)
    eye_node = _base_image_node(_material(f"{body}_eyes"))
    eye_target = arm.matrix_world @ arm.pose.bones["head"].head + Vector((0, -0.06, 0.04))
    for eyes in looks["eyes"]:
        eye_node.image = bpy.data.images.load(str(C.OUT_CHARACTERS / eyes["file"]))
        aim(cam, eye_target, 0, 0.32)
        label = _label(scene, cam, f"eyes: {eyes['label']}")
        tiles.append(render_tile(scene, tmp))
        bpy.data.objects.remove(label)
    save_sheet(tiles, 6, PREVIEWS / f"looks-{body}.png")


def visemes_sheet(body, path, morphs):
    """art/out/previews/visemes.png: the 15 visemes, the blinks and the eye turns, close up."""
    scene, cam = setup_scene(360, 360)
    arm, meshes, _ = load_character(path)
    target = arm.matrix_world @ arm.pose.bones["head"].head + Vector((0, -0.02, 0.0))
    tmp = PREVIEWS / "tile.png"
    tiles = []
    names = [m for m in morphs if m.startswith(("viseme_", "blink_", "look_"))]
    for name in names:
        set_morphs(meshes, {name: 1.0})
        aim(cam, target, 15, 0.42)
        label = _label(scene, cam, name)
        tiles.append(render_tile(scene, tmp))
        bpy.data.objects.remove(label)
    set_morphs(meshes, {"viseme_aa": 1.0})
    aim(cam, target, 70, 0.42)
    label = _label(scene, cam, "viseme_aa (side)")
    tiles.append(render_tile(scene, tmp))
    save_sheet(tiles, 6, PREVIEWS / "visemes.png")


def pose_sheet(name, path):
    scene, cam = setup_scene(320, 440)
    arm, _, clips = load_character(path)
    tiles = []
    tmp = PREVIEWS / "tile.png"
    for view in POSES:
        clip, frame = view.split(":")
        C.assign_action(arm, clips[clip])
        scene.frame_set(int(frame))
        aim(cam, Vector((0, 0, 0.9)), 30, 5.0)
        tiles.append(render_tile(scene, tmp))
    save_sheet(tiles, 6, PREVIEWS / f"{name}-poses.png")


def _label(scene, cam, text):
    """Put a caption at the top of the camera's view."""
    bpy.context.view_layer.update()
    curve = bpy.data.curves.new("Label", "FONT")
    curve.body = text
    curve.size = 0.006
    curve.align_x = "CENTER"
    obj = bpy.data.objects.new("Label", curve)
    mat = bpy.data.materials.new("Label")
    mat.use_nodes = True
    emit = mat.node_tree.nodes.new("ShaderNodeEmission")
    emit.inputs["Color"].default_value = (0.02, 0.02, 0.03, 1)
    mat.node_tree.links.new(emit.outputs[0], mat.node_tree.nodes["Material Output"].inputs[0])
    curve.materials.append(mat)
    scene.collection.objects.link(obj)
    obj.matrix_world = cam.matrix_world
    # close to the camera, so it is never behind the subject
    obj.location = cam.matrix_world @ Vector((0, 0.0575, -0.2))
    return obj


def _stance_tile(path, clip, view, caption, frame=None):
    """One orthographic view of a clip, with a plumb line through the middle of the ankles."""
    scene, cam = setup_scene(400, 700)
    arm, _, clips = load_character(path)
    action = clips[clip]
    C.assign_action(arm, action)
    if frame is None:  # mid-stride: the frame with the feet furthest apart
        best = (-1, 0)
        for f in C.frame_span(action):
            scene.frame_set(f)
            gap = (arm.pose.bones["foot_l"].head - arm.pose.bones["foot_r"].head).length
            best = max(best, (gap, f))
        frame = best[1]
    scene.frame_set(frame)
    mw = arm.matrix_world
    ankle = (mw @ arm.pose.bones["foot_l"].head + mw @ arm.pose.bones["foot_r"].head) / 2
    angle = {"front": 0, "side": 90, "back": 180}[view]
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = 2.3
    a = math.radians(angle)
    target = Vector((ankle.x, ankle.y, 0.98))
    cam.location = target + Vector((4 * math.sin(a), -4 * math.cos(a), 0))
    cam.rotation_euler = (math.radians(90), 0, a)
    if view == "side":
        bpy.ops.mesh.primitive_cylinder_add(radius=0.003, depth=2.1, location=(ankle.x, ankle.y, 1.05))
    bpy.context.view_layer.update()
    _label(scene, cam, caption)
    return render_tile(scene, PREVIEWS / "tile.png")


def posture_sheet():
    """art/out/previews/posture-before-after.png: the old and new idle from the side, then the
    new bodies from the front, side and back, and mid-stride in the walk."""
    before = C.ART / "out" / "posture"
    tiles = []
    for body in ("man", "woman"):
        old = before / f"before-hero-{body}.glb"
        if old.exists():
            tiles.append(_stance_tile(old, "idle", "side", f"{body}: old idle", 10))
        tiles.append(_stance_tile(C.OUT_CHARACTERS / f"hero-{body}.glb", "idle", "side",
                                  f"{body}: new idle", 10))
    for body in ("man", "woman"):
        path = C.OUT_CHARACTERS / f"hero-{body}.glb"
        for view in ("front", "side", "back"):
            tiles.append(_stance_tile(path, "idle", view, f"{body}: {view}", 10))
        tiles.append(_stance_tile(path, "walk", "side", f"{body}: walk"))
    save_sheet(tiles, 4, PREVIEWS / "posture-before-after.png")


def main():
    PREVIEWS.mkdir(parents=True, exist_ok=True)
    posture_sheet()
    lineages = C.load_json("art/lineages.json")["presets"]
    morphs = [m["name"] for m in C.load_json("art/hero.json")["morphs"]]
    manifest = json.loads((C.OUT_CHARACTERS / "heroes.json").read_text())
    for body in ("man", "woman"):
        path = C.OUT_CHARACTERS / f"hero-{body}.glb"
        if not path.exists():
            continue
        if body in manifest.get("looks", {}):
            looks_sheet(body, path, manifest)
        if body == "woman":
            visemes_sheet(body, path, morphs)
        lineage_sheet(body, path, lineages)
        face_sheet(body, path, morphs)
        pose_sheet(f"hero-{body}", path)
    if (C.OUT_CHARACTERS / "mannequin.glb").exists():
        pose_sheet("mannequin", C.OUT_CHARACTERS / "mannequin.glb")
    (PREVIEWS / "tile.png").unlink(missing_ok=True)


if __name__ == "__main__":
    main()
