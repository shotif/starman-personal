"""Builds the hero with MPFB 2: public/assets/characters/hero-man.glb and hero-woman.glb.

    blender -b --factory-startup --python scripts/art/hero.py              # both bodies
    blender -b --factory-startup --python scripts/art/hero.py -- man       # one body
    blender -b --factory-startup --python scripts/art/hero.py -- --no-anim # skip animation
    blender -b --factory-startup --python scripts/art/hero.py -- --config other.json

Needs MPFB 2 installed in this Blender, and the MakeHuman and UAL files in art/cache/
(python3 scripts/art/fetch_sources.py). Settings: art/hero.json, art/animations.json and
art/lineages.json. See docs/ART_PIPELINE.md.

For each body it:
1. makes an MPFB human from the phenotype, with MPFB's "game_engine" skeleton (53 bones with
   Unreal-style names, the same names UAL uses);
2. adds eyes, eyebrows, eyelashes, hair and the suit, and the skin, all with plain
   glTF-friendly materials and textures scaled down to 1024 px or less;
3. bakes every morph in art/hero.json into shape keys on all the meshes (so the suit and hair
   follow the body), and measures how far each morph would move the joints;
4. removes the hidden helper geometry and the skin under the suit, and joins the meshes;
5. retargets the UAL clips onto the skeleton;
6. exports the .glb, an uncompressed copy in art/out/, and a manifest
   (public/assets/characters/heroes.json) with morphs, clips and lineage presets.
"""

import importlib
import json
import math
import sys
import time
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parent))

import addon_utils  # noqa: E402
import bmesh  # noqa: E402
import bpy  # noqa: E402
import numpy as np  # noqa: E402

import common as C  # noqa: E402
import posture  # noqa: E402

MPFB_MODULE = "bl_ext.user_default.mpfb"
MH = C.CACHE / "makehuman"
OUT = C.ART / "out"


# --------------------------------------------------------------------------------------------
# MPFB


def load_mpfb():
    """Enable MPFB for this run only (Blender does not save preferences in background mode)."""
    if MPFB_MODULE not in bpy.context.preferences.addons:
        mod = addon_utils.enable(MPFB_MODULE, default_set=True)
        if mod is None:
            raise SystemExit("MPFB is not installed in this Blender. See docs/ART_PIPELINE.md.")

    def get(path, name):
        return getattr(importlib.import_module(f"{MPFB_MODULE}.{path}"), name)

    return SimpleNamespace(
        Human=get("services.humanservice", "HumanService"),
        Target=get("services.targetservice", "TargetService"),
        Clothes=get("services.clothesservice", "ClothesService"),
        Rig=get("services.rigservice", "RigService"),
        Location=get("services.locationservice", "LocationService"),
        Mhclo=get("entities.clothes.mhclo", "Mhclo"),
        Props=get("entities.objectproperties", "HumanObjectProperties"),
    )


def mix_coords(basemesh):
    """The base mesh's vertex positions with every shape key mixed in."""
    key = basemesh.shape_key_add(name="__capture", from_mix=True)
    arr = np.empty(len(key.data) * 3, dtype=np.float64)
    key.data.foreach_get("co", arr)
    basemesh.shape_key_remove(key)
    return arr.reshape(-1, 3)


def coords(obj):
    arr = np.empty(len(obj.data.vertices) * 3, dtype=np.float64)
    obj.data.vertices.foreach_get("co", arr)
    return arr.reshape(-1, 3)


def tidy_delta(delta, floor=0.0005):
    """Zero the movements under half a millimetre, so the morph stores fewer vertices."""
    delta = delta.copy()
    delta[np.linalg.norm(delta, axis=1) < floor] = 0.0
    return delta


def bone_heads(rig):
    return {b.name: np.array(b.head_local) for b in rig.data.bones}


class Human:
    def __init__(self, mp, name, body, cfg):
        self.mp, self.name, self.body, self.cfg = mp, name, body, cfg
        self.assets = []  # (kind, object, mhclo)
        self.targets_dir = Path(mp.Location.get_mpfb_data("targets"))

    def build(self, rig_name):
        mp = self.mp
        pheno = json.loads(json.dumps(self.body["phenotype"]))
        self.basemesh = mp.Human.create_human(scale=0.1, macro_detail_dict=pheno,
                                              feet_on_ground=True)
        self.basemesh.name = f"{self.name}.body"
        # The body's own shape (before the skeleton is fitted, so the joints follow it).
        for tname, weight in self.body.get("targets", {}).items():
            path = self.targets_dir / f"{tname}.target.gz"
            if not path.exists():
                raise RuntimeError(f"no MPFB target {tname}")
            mp.Target.load_target(self.basemesh, str(path), weight=weight,
                                  name="base_" + tname.replace("/", "_"))
        self.rig = mp.Human.add_builtin_rig(self.basemesh, rig_name)
        self.rig.name = self.rig.data.name = f"{self.name}_rig"
        for kind, key in (("Eyes", "eyes"), ("Eyebrows", "eyebrows"), ("Eyelashes", "eyelashes")):
            if self.body.get(key):
                self.add_asset(kind, MH / self.body[key])
        for kind, key in (("Teeth", "teeth"), ("Tongue", "tongue")):
            if self.cfg.get(key):
                self.add_asset(kind, MH / self.cfg[key])
        # Every hair style is fitted, so each gets the morphs; only the default stays on the
        # hero, the others become separate parts (export_hair_parts).
        for style in self.cfg["looks"]["hair"]:
            if style.get("file"):
                obj = self.add_asset("Hair", MH / style["file"])
                obj["hair_id"] = style["id"]
        for item in self.body.get("clothes", []):
            item = {"file": item} if isinstance(item, str) else item
            obj = self.add_asset("Clothes", MH / item["file"])
            obj["look"] = json.dumps(item)

    def add_asset(self, kind, path):
        mp = self.mp
        obj = mp.Human.add_mhclo_asset(str(path), self.basemesh, asset_type=kind,
                                       subdiv_levels=0, material_type="GAMEENGINE")
        mhclo = mp.Mhclo()
        mhclo.load(str(path))
        mhclo.clothes = obj
        obj["source_mhclo"] = str(path.relative_to(C.REPO))
        self.assets.append((kind, obj, mhclo))
        C.log(f"  added {kind.lower()}: {path.parent.name} ({len(obj.data.vertices)} vertices)")
        return obj

    # ---- morphs ------------------------------------------------------------------------

    def apply_morph(self, morph):
        mp, bm = self.mp, self.basemesh
        spec = morph.get(self.name, morph)
        undo = []
        if "macro" in spec:
            old = {k: mp.Props.get_value(k, entity_reference=bm) for k in spec["macro"]}
            for k, v in spec["macro"].items():
                mp.Props.set_value(k, v, entity_reference=bm)
            mp.Target.reapply_macro_details(bm, remove_zero_weight_targets=False)
            undo.append(("macro", old))
        for tname, weight in spec.get("targets", {}).items():
            for path, w in self.target_files(tname, weight):
                key_name = f"__morph_{len(undo)}"
                mp.Target.load_target(bm, str(path), weight=w, name=key_name)
                undo.append(("key", key_name))
        return undo

    def target_files(self, tname, weight):
        """[(file, weight)] for a target name: an MPFB target, 'mh:<file>' in the MakeHuman
        cache, and '{race}' expanded over the body's races, weighted by its phenotype."""
        if "{race}" in tname:
            out = []
            for race, share in self.body["phenotype"]["race"].items():
                if share > 0:
                    out += self.target_files(tname.replace("{race}", race), weight * share)
            return out
        if tname.startswith("mh:"):
            path = MH / tname[3:]
        else:
            path = self.targets_dir / f"{tname}.target.gz"
        if not path.exists():
            raise RuntimeError(f"no target {tname}")
        return [(path, weight)]

    def revert_morph(self, undo):
        mp, bm = self.mp, self.basemesh
        for kind, data in reversed(undo):
            if kind == "macro":
                for k, v in data.items():
                    mp.Props.set_value(k, v, entity_reference=bm)
                mp.Target.reapply_macro_details(bm, remove_zero_weight_targets=False)
            else:
                bm.shape_key_remove(bm.data.shape_keys.key_blocks[data])

    def refit(self):
        for _, obj, mhclo in self.assets:
            self.mp.Clothes.fit_clothes_to_human(obj, self.basemesh, mhclo, set_parent=False)
        self.mp.Rig.refit_existing_armature(self.rig, self.basemesh)

    def capture(self):
        return {
            "body": mix_coords(self.basemesh),
            "assets": [coords(obj) for _, obj, _ in self.assets],
            "bones": bone_heads(self.rig),
        }

    def turned_eyes(self, base, yaw=0.0, pitch=0.0):
        """The baseline with each eyeball turned about its own centre (degrees; yaw turns the
        gaze to the character's left, pitch turns it up)."""
        from mathutils import Euler
        turn = np.array(Euler((math.radians(-pitch), 0.0, math.radians(yaw)), "ZXY").to_matrix())
        shot = {"body": base["body"], "bones": base["bones"], "assets": list(base["assets"])}
        for i, (kind, _, _) in enumerate(self.assets):
            if kind != "Eyes":
                continue
            co = base["assets"][i].copy()
            for side in (co[:, 0] >= 0, co[:, 0] < 0):
                part = co[side]
                centre = (part.min(axis=0) + part.max(axis=0)) / 2
                co[side] = (part - centre) @ turn.T + centre
            shot["assets"][i] = co
        return shot

    def bake_morphs(self, morphs):
        """Measure every morph against the baseline, then store them as plain shape keys."""
        base = self.capture()
        deltas = []
        for morph in morphs:
            t = time.time()
            if "eyes_turn" in morph:
                shot = self.turned_eyes(base, **morph["eyes_turn"])
            else:
                undo = self.apply_morph(morph)
                self.refit()
                shot = self.capture()
                self.revert_morph(undo)
            d_bones = {n: shot["bones"][n] - base["bones"][n] for n in base["bones"]}
            shift = max(float(np.linalg.norm(v)) for v in d_bones.values())
            deltas.append({
                "name": morph["name"],
                "body": tidy_delta(shot["body"] - base["body"]),
                "assets": [tidy_delta(s - b) for s, b in zip(shot["assets"], base["assets"])],
                "bones": d_bones,
                "maxJointShift": shift,
            })
            C.log(f"  morph {morph['name']}: joints move up to {shift * 100:.1f} cm "
                  f"({time.time() - t:.1f} s)")
        self.refit()  # back to the baseline

        # Replace MPFB's live targets with a fixed basis plus our morphs.
        bm = self.basemesh
        bm.shape_key_clear()
        bm.data.vertices.foreach_set("co", base["body"].ravel())
        bm.data.update()
        meshes = [(bm, base["body"], [d["body"] for d in deltas])]
        for i, (_, obj, _) in enumerate(self.assets):
            meshes.append((obj, base["assets"][i], [d["assets"][i] for d in deltas]))
        for obj, basis, ds in meshes:
            obj.shape_key_add(name="Basis", from_mix=False)
            for d, delta in zip(deltas, ds):
                key = obj.shape_key_add(name=d["name"], from_mix=False)
                key.data.foreach_set("co", (basis + delta).ravel())
                key.value = 0.0
        return deltas


# --------------------------------------------------------------------------------------------
# Clean-up, materials and textures


def delete_hidden_body(basemesh, clothes=(), reach=0.05, keep_groups=()):
    """Delete MPFB's helper geometry and the skin hidden under clothes (keeps shape keys).

    Skin is hidden when the clothes' own list says so (MakeHuman's delete groups), or when a
    ray from the skin outwards along its normal meets the clothes within `reach` metres, or
    inwards within 2 cm (skin that already pokes through). The ray tests catch skin that the
    lists leave and that would show through at bent knees and elbows."""
    from mathutils.bvhtree import BVHTree
    depsgraph = bpy.context.evaluated_depsgraph_get()
    trees = [BVHTree.FromObject(o, depsgraph) for o in clothes]
    vg = basemesh.vertex_groups
    body = vg["body"].index
    hidden = {g.index for g in vg if g.name.startswith("Delete.") and g.name not in keep_groups}
    me = basemesh.data
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.normal_update()
    deform = bm.verts.layers.deform.active
    doomed = []
    for v in bm.verts:
        groups = v[deform]
        if body not in groups or any(groups.get(i, 0.0) > 0.0 for i in hidden):
            doomed.append(v)
            continue
        for tree in trees:
            # outwards: covered skin; inwards a little: skin already poking through at rest
            out = tree.ray_cast(v.co - v.normal * 0.001, v.normal, reach)
            back = tree.ray_cast(v.co + v.normal * 0.001, -v.normal, 0.02)
            if out[0] is not None or back[0] is not None:
                doomed.append(v)
                break
    bmesh.ops.delete(bm, geom=doomed, context="VERTS")
    bm.to_mesh(me)
    bm.free()
    me.update()
    for m in list(basemesh.modifiers):
        if m.type != "ARMATURE":
            basemesh.modifiers.remove(m)
    return len(doomed)


def keep_bone_groups_only(obj, rig):
    bones = {b.name for b in rig.data.bones}
    for g in list(obj.vertex_groups):
        if g.name not in bones:
            obj.vertex_groups.remove(g)


def read_mhmat(path):
    info = {"_dir": Path(path).parent}
    for line in Path(path).read_text(encoding="utf-8", errors="replace").splitlines():
        parts = line.strip().split(None, 1)
        if len(parts) == 2 and not parts[0].startswith("#"):
            info[parts[0]] = parts[1].strip()
    return info


def mhmat_texture(info, key):
    name = info.get(key)
    if not name:
        return None
    p = (info["_dir"] / name).resolve()
    if p.exists():
        return p
    p = info["_dir"] / Path(name).name
    return p if p.exists() else None


def load_pixels(path, size):
    """An image scaled to at most size x size, as (width, height, RGBA float array)."""
    src = bpy.data.images.load(str(path), check_existing=False)
    w, h = src.size
    scale = min(1.0, size / max(w, h))
    if scale < 1.0:
        w, h = max(1, int(w * scale)), max(1, int(h * scale))
        src.scale(w, h)
    px = np.array(src.pixels[:], dtype=np.float32).reshape(-1, 4)
    bpy.data.images.remove(src)
    return w, h, px


def save_pixels(w, h, px, dest, fmt):
    """Write RGBA pixels as JPEG, PNG or WEBP (WEBP and PNG keep the alpha)."""
    dest = Path(dest)
    dest.parent.mkdir(parents=True, exist_ok=True)
    img = bpy.data.images.new(dest.stem, w, h, alpha=True)
    img.pixels.foreach_set(px.ravel())
    scene = bpy.context.scene
    settings = scene.render.image_settings
    settings.file_format = fmt
    settings.color_mode = "RGB" if fmt == "JPEG" else "RGBA"
    settings.quality = 85
    if fmt == "PNG":
        settings.compression = 90
    img.save_render(str(dest), scene=scene)
    bpy.data.images.remove(img)
    return dest


def grade(px, keep_alpha, tint=None, desaturate=False):
    """Fill see-through parts of opaque textures, then grey and/or tint the colour."""
    px = px.copy()
    if not keep_alpha:
        # Unused, see-through parts of an opaque texture are often white, and show at the
        # edges of cuffs and seams; fill them with the texture's average colour.
        clear = px[:, 3] < 0.5
        if clear.any() and (~clear).any():
            px[clear, :3] = px[~clear, :3].mean(axis=0)
        px[:, 3] = 1.0
    if desaturate:
        lum = px[:, :3] @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
        px[:, :3] = lum[:, None]
    if tint is not None:
        px[:, :3] = np.clip(px[:, :3] * np.array(tint[:3], dtype=np.float32), 0.0, 1.0)
    return px


def load_scaled(path, size, out_dir, colour=True, keep_alpha=False, tint=None, name=None,
                desaturate=False):
    """Load an image, scale it to at most size x size, grade it and save it as JPEG (or PNG
    with alpha); return it loaded as a Blender image."""
    w, h, px = load_pixels(path, size)
    if colour:
        px = grade(px, keep_alpha, tint, desaturate)
    ext, fmt = ("png", "PNG") if keep_alpha else ("jpg", "JPEG")
    dest = save_pixels(w, h, px, Path(out_dir) / f"{name or Path(path).stem}.{ext}", fmt)
    img = bpy.data.images.load(str(dest), check_existing=False)
    img.colorspace_settings.name = "sRGB" if colour else "Non-Color"
    return img


def tint_iris(px, tint):
    """Tint only the coloured iris of an eye texture (its saturated pixels), not the white."""
    px = px.copy()
    rgb = px[:, :3]
    sat = rgb.max(axis=1) - rgb.min(axis=1)
    mask = np.clip((sat - 0.12) / 0.15, 0.0, 1.0)[:, None]
    px[:, :3] = rgb * (1 - mask) + rgb * np.array(tint, dtype=np.float32) * mask
    return px


def colour_teeth(px, enamel, gums, shade=0.35):
    """Recolour MakeHuman's teeth texture: its grey teeth become a warm off-white and its deep
    red gums a soft pink. The texture's own shading is kept (scaled from `shade` to 1), so the
    gaps between teeth stay dark."""
    px = grade(px, keep_alpha=False)
    rgb = px[:, :3]
    lum = rgb @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    redness = rgb[:, 0] - (rgb[:, 1] + rgb[:, 2]) / 2
    gum = np.clip((redness - 0.10) / 0.12, 0.0, 1.0)
    tooth = gum < 0.5
    top_tooth = np.percentile(lum[tooth], 95) if tooth.any() else 1.0
    top_gum = np.percentile(lum[~tooth], 95) if (~tooth).any() else 1.0
    t_tooth = np.clip(lum / max(top_tooth, 1e-3), 0.0, 1.0)
    t_gum = np.clip(lum / max(top_gum, 1e-3), 0.0, 1.0)
    enamel_rgb = np.array(enamel, dtype=np.float32)[None, :] * (shade + (1 - shade) * t_tooth)[:, None]
    gum_rgb = np.array(gums, dtype=np.float32)[None, :] * (shade + (1 - shade) * t_gum)[:, None]
    px[:, :3] = enamel_rgb * (1 - gum[:, None]) + gum_rgb * gum[:, None]
    return px


def depth_shade(obj, w, h, darkest=0.45):
    """A shading map for a mouth part's texture: 1 at the front of the mouth, down to
    `darkest` at the back, so teeth and tongue sit in the mouth's shadow instead of glowing.
    Each face is painted into its own place in the texture (its UVs)."""
    me = obj.data
    co = np.empty(len(me.vertices) * 3)
    me.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    front, back = np.percentile(co[:, 1], 2), np.percentile(co[:, 1], 98)  # forward is -Y
    depth = np.clip((co[:, 1] - front) / max(back - front, 1e-6), 0.0, 1.0)
    factor = 1.0 - (1.0 - darkest) * depth ** 0.8
    uv_layer = me.uv_layers.active.data
    shade = np.full((h, w), np.nan, dtype=np.float32)
    for poly in me.polygons:
        f = float(factor[list(poly.vertices)].mean())
        uvs = np.array([uv_layer[i].uv[:] for i in poly.loop_indices]) * [w - 1, h - 1]
        for k in range(1, len(uvs) - 1):  # fan of triangles
            tri = uvs[[0, k, k + 1]]
            x0, y0 = np.floor(tri.min(axis=0)).astype(int)
            x1, y1 = np.ceil(tri.max(axis=0)).astype(int)
            xs, ys = np.meshgrid(np.arange(max(x0, 0), min(x1, w - 1) + 1),
                                 np.arange(max(y0, 0), min(y1, h - 1) + 1))
            p = np.stack([xs.ravel(), ys.ravel()], axis=1).astype(np.float64)
            a, b, c = tri
            d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
            if abs(d) < 1e-9:
                continue
            l1 = ((b[1] - c[1]) * (p[:, 0] - c[0]) + (c[0] - b[0]) * (p[:, 1] - c[1])) / d
            l2 = ((c[1] - a[1]) * (p[:, 0] - c[0]) + (a[0] - c[0]) * (p[:, 1] - c[1])) / d
            inside = (l1 >= -0.02) & (l2 >= -0.02) & (1 - l1 - l2 >= -0.02)
            shade[ys.ravel()[inside], xs.ravel()[inside]] = f
    # Grow the painted areas a few pixels so filtering at the edges does not pick up white.
    for _ in range(4):
        empty = np.isnan(shade)
        if not empty.any():
            break
        grown = shade.copy()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            moved = np.roll(np.roll(shade, dy, axis=0), dx, axis=1)
            take = empty & np.isnan(grown) & ~np.isnan(moved)
            grown[take] = moved[take]
        shade = grown
    shade[np.isnan(shade)] = darkest
    return shade.ravel()


def look_by_id(items, look_id):
    for item in items:
        if item["id"] == look_id:
            return item
    raise KeyError(look_id)


def skin_pixels(spec, size):
    """A skin option's colour texture: one MakeHuman skin, or a blend of several (a tone
    between two real skins)."""
    parts = [[spec["mhmat"], 1.0]] if "mhmat" in spec else spec["blend"]
    out = None
    for mhmat, share in parts:
        w, h, px = load_pixels(mhmat_texture(read_mhmat(MH / mhmat), "diffuseTexture"), size)
        out = px * share if out is None else out + px * share
    out[:, 3] = 1.0
    return w, h, out


def make_material(name, base_img=None, normal_img=None, alpha="OPAQUE", roughness=0.5,
                  metallic=0.0, colour=(1, 1, 1, 1)):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nodes, links = nt.nodes, nt.links
    bsdf = nodes.get("Principled BSDF")
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Base Color"].default_value = colour
    if base_img is not None:
        tex = nodes.new("ShaderNodeTexImage")
        tex.image = base_img
        if colour[:3] != (1, 1, 1):
            mix = nodes.new("ShaderNodeMix")
            mix.data_type = "RGBA"
            mix.blend_type = "MULTIPLY"
            mix.inputs["Factor"].default_value = 1.0
            links.new(tex.outputs["Color"], mix.inputs["A"])
            mix.inputs["B"].default_value = colour
            links.new(mix.outputs["Result"], bsdf.inputs["Base Color"])
        else:
            links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
        if alpha == "MASK":
            cut = nodes.new("ShaderNodeMath")
            cut.operation = "GREATER_THAN"
            cut.inputs[1].default_value = 0.5
            links.new(tex.outputs["Alpha"], cut.inputs[0])
            links.new(cut.outputs[0], bsdf.inputs["Alpha"])
        elif alpha == "BLEND":
            links.new(tex.outputs["Alpha"], bsdf.inputs["Alpha"])
            mat.surface_render_method = "BLENDED"
    if normal_img is not None:
        ntex = nodes.new("ShaderNodeTexImage")
        ntex.image = normal_img
        nmap = nodes.new("ShaderNodeNormalMap")
        links.new(ntex.outputs["Color"], nmap.inputs["Color"])
        links.new(nmap.outputs["Normal"], bsdf.inputs["Normal"])
    mat.use_backface_culling = alpha == "OPAQUE"
    return mat


ASSET_LOOK = {
    # kind: (alpha mode, roughness, texture size key, use the normal map)
    # The eye texture's alpha cuts out the clear cornea over the iris.
    "Eyes": ("MASK", 0.15, "smallTextureSize", False),
    "Eyebrows": ("BLEND", 0.8, "smallTextureSize", False),
    "Eyelashes": ("BLEND", 0.8, "smallTextureSize", False),
    "Teeth": ("OPAQUE", 0.35, "smallTextureSize", False),
    "Tongue": ("OPAQUE", 0.45, "smallTextureSize", False),
    "Hair": ("MASK", 0.6, "smallTextureSize", False),
    "Clothes": ("OPAQUE", 0.45, "textureSize", True),
}


def set_materials(human, cfg):
    tex_dir = OUT / "textures" / human.name
    looks = cfg["looks"]
    skin = look_by_id(looks["skins"][human.name], human.body["skin"])
    w, h, px = skin_pixels(skin, cfg["textureSize"])
    skin_file = save_pixels(w, h, px, tex_dir / f"skin-{skin['id']}.jpg", "JPEG")
    skin_img = bpy.data.images.load(str(skin_file), check_existing=False)
    skin_mat = make_material(f"{human.name}_skin", skin_img, roughness=0.55)
    human.basemesh.data.materials.clear()
    human.basemesh.data.materials.append(skin_mat)
    used = [str(MH / f) for f in ([skin["mhmat"]] if "mhmat" in skin else [b[0] for b in skin["blend"]])]
    eyes = look_by_id(looks["eyes"], human.body["eyeColour"])
    for index, (kind, obj, mhclo) in enumerate(human.assets):
        alpha, rough, size_key, use_normal = ASSET_LOOK[kind]
        look = json.loads(obj["look"]) if "look" in obj else {}
        label = kind.lower()
        if kind == "Clothes":
            label = look.get("name", f"clothes{index}")
        if kind == "Hair":
            look = look_by_id(looks["hair"], obj["hair_id"])
            if obj["hair_id"] != human.body["hair"]:
                label = f"hair_{obj['hair_id']}"
        rough = look.get("roughness", rough)
        mat_path = MH / eyes["mhmat"] if kind == "Eyes" else Path(mhclo.material)
        info = read_mhmat(mat_path)
        diffuse = mhmat_texture(info, "diffuseTexture")
        normal = mhmat_texture(info, "normalmapTexture") if use_normal else None
        tex_size = look.get("textureSize", cfg[size_key])
        if kind in ("Teeth", "Tongue") and cfg.get("teethColours"):
            w, h, px = load_pixels(diffuse, tex_size)
            colours = cfg["teethColours"]
            if kind == "Teeth":
                px = colour_teeth(px, colours["enamel"], colours["gums"], colours.get("shade", 0.35))
            else:
                px = grade(px, keep_alpha=False, tint=cfg.get("tongueTint"))
            px[:, :3] *= depth_shade(obj, w, h, colours.get("darkestBack", 0.45))[:, None]
            mouth_file = save_pixels(w, h, px, tex_dir / f"{label}.jpg", "JPEG")
            img = bpy.data.images.load(str(mouth_file), check_existing=False)
        elif kind == "Eyes" and eyes.get("irisTint"):
            w, h, px = load_pixels(diffuse, tex_size)
            eye_file = save_pixels(w, h, tint_iris(px, eyes["irisTint"]),
                                   tex_dir / f"eyes-{eyes['id']}.png", "PNG")
            img = bpy.data.images.load(str(eye_file), check_existing=False)
        else:
            img = load_scaled(diffuse, tex_size, tex_dir, keep_alpha=alpha != "OPAQUE",
                              tint=look.get("tint"), desaturate=look.get("desaturate", False),
                              name=f"{label}-{Path(diffuse).stem}") if diffuse else None
        nimg = load_scaled(normal, tex_size, tex_dir, colour=False) if normal else None
        mat = make_material(f"{human.name}_{label}", img, nimg, alpha=alpha, roughness=rough)
        obj.data.materials.clear()
        obj.data.materials.append(mat)
        used.append(str(mat_path))
    return used


# --------------------------------------------------------------------------------------------
# Animation


# --------------------------------------------------------------------------------------------
# Main


def clothes_file(item):
    """A clothes entry is a path, or {"file": path, "name": ..., "roughness": ...,
    "tint": [r, g, b], "textureSize": ...}."""
    return item if isinstance(item, str) else item["file"]


def to_gltf(v):
    """Blender Z-up (x, y, z) to glTF Y-up (x, z, -y)."""
    return [round(float(v[0]), 5), round(float(v[2]), 5), round(float(-v[1]), 5)]


def build_body(name, cfg, anim_cfg, with_anim):
    t0 = time.time()
    C.clear_scene()
    mp = load_mpfb()
    body = cfg["bodies"][name]
    C.log(f"building {name}")
    human = Human(mp, name, body, cfg)
    human.build(cfg["rig"])
    deltas = human.bake_morphs(cfg["morphs"])
    used_files = set_materials(human, cfg)

    # Hair styles are swappable parts, so no hair may cut the scalp away.
    hair_groups = {f"Delete.{Path(o['source_mhclo']).stem}" for k, o, _ in human.assets
                   if k == "Hair"}
    removed = delete_hidden_body(human.basemesh,
                                 [obj for kind, obj, _ in human.assets if kind == "Clothes"],
                                 keep_groups=hair_groups)
    C.log(f"  removed {removed} hidden body vertices")
    meshes = [human.basemesh] + [obj for _, obj, _ in human.assets]
    for obj in meshes:
        keep_bone_groups_only(obj, human.rig)
        for m in list(obj.modifiers):
            if m.type != "ARMATURE":
                obj.modifiers.remove(m)
    rig = human.rig
    rig.name = rig.data.name = f"Hero_{name}_Rig"

    # Every hair style becomes its own part on the same skeleton; only the default stays.
    looks = {"hair": export_hair_parts(human, cfg, deltas),
             "skins": export_skin_looks(human, cfg),
             "eyes": export_eye_looks(human, cfg)}
    meshes = [human.basemesh] + [obj for kind, obj, _ in human.assets
                                 if kind != "Hair" or obj["hair_id"] == body["hair"]]
    extra_hair = [obj for kind, obj, _ in human.assets
                  if kind == "Hair" and obj["hair_id"] != body["hair"]]
    human.assets = [a for a in human.assets if a[1] not in extra_hair]
    for obj in extra_hair:
        bpy.data.objects.remove(obj, do_unlink=True)

    # One skinned mesh: the body is the active object, so its armature modifier is kept.
    bpy.ops.object.select_all(action="DESELECT")
    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = human.basemesh
    bpy.ops.object.join()
    mesh = human.basemesh
    mesh.name = mesh.data.name = f"Hero_{name}"
    # MPFB's own custom properties would otherwise be exported as glTF extras.
    for idblock in (mesh, mesh.data, rig, rig.data):
        for k in list(idblock.keys()):
            del idblock[k]

    clips = []
    posture_result = None
    if with_anim:
        sources = C.load_sources(anim_cfg)
        maps = {lib: C.bone_map(rig, arm, anim_cfg["libraries"][lib]["naming"])
                for lib, (arm, _) in sources.items()}
        clips = C.build_clips(rig, anim_cfg["clips"], sources, maps, hips="pelvis", root="Root",
                              retarget=C.retarget_options(rig))
        for arm, _ in sources.values():
            C.delete_objects([arm])
        C.drop_foreign_actions(clips)
        # The standing idle must be upright, and lean as the mannequin's does.
        ref_path = C.ART / "out" / "posture" / "mannequin-idle.json"
        reference = json.loads(ref_path.read_text()) if ref_path.exists() else None
        if reference is None:
            C.log("  no mannequin posture yet (run mannequin.py first); checking marks only")
        idle = next(a for a in clips if a.name == "idle")
        posture_result = posture.check(rig, idle, f"hero-{name} idle", reference)
        C.write_report(posture_result, f"art/out/posture/hero-{name}-idle.json")
        C.push_to_nla(rig, clips)

    raw = OUT / f"hero-{name}.raw.glb"
    C.export_glb(raw, [rig, mesh], morphs=True, image_format="WEBP",
                 copyright_text="Hero character from MPFB/MakeHuman and Quaternius assets (CC0)")
    height = max(v.co.z for v in mesh.data.vertices) - min(v.co.z for v in mesh.data.vertices)
    output = C.REPO / body["output"]
    compressed = C.finish_glb(raw, output)
    report = C.glb_report(output)
    C.log(f"  wrote {output.name}: {report['megabytes']} MB, {report['triangles']} triangles, "
          f"{report['bones']} bones, {len(report['animations'])} clips, "
          f"{len(report['morphTargets'])} morphs; height {height:.3f} m; {time.time() - t0:.0f} s")
    morph_info = []
    for m, d in zip(cfg["morphs"], deltas):
        offsets = {b: to_gltf(v) for b, v in d["bones"].items() if np.linalg.norm(v) > 0.002}
        morph_info.append({
            "name": m["name"], "group": m["group"], "label": m["label"],
            "maxJointShiftCm": round(d["maxJointShift"] * 100, 2),
            "boneOffsets": offsets,
        })
    return {
        "raw": raw,
        "output": output,
        "compressed": compressed,
        "report": report,
        "heightMetres": round(height, 3),
        "morphs": morph_info,
        "looks": looks,
        "sourcesUsed": sorted(set(
            used_files + [str(MH / body[k]) for k in ("eyes", "eyebrows", "eyelashes")
                          if body.get(k)]
            + [str(MH / cfg[k]) for k in ("teeth", "tongue") if cfg.get(k)]
            + [str(MH / h["file"]) for h in cfg["looks"]["hair"] if h.get("file")]
            + [str(MH / clothes_file(p)) for p in body.get("clothes", [])])),
    }


LOOKS = C.OUT_CHARACTERS / "looks"
HAIR_MORPH_MIN = 0.002  # metres
HAIR_MOVE_MIN = 0.002


def export_hair_parts(human, cfg, deltas):
    """One .glb per hair style: the hair mesh skinned to the hero's own skeleton (same bones,
    order and inverse bind matrices), with the morphs that move it. Returns manifest rows."""
    rig, rows = human.rig, []
    default = human.body["hair"]
    for style in cfg["looks"]["hair"]:
        row = {"id": style["id"], "label": style["label"], "default": style["id"] == default}
        if style.get("hidden"):
            row["hidden"] = True
        if not style.get("file"):
            row.update({"file": None, "bytes": 0, "triangles": 0, "morphs": [],
                        "replaces": f"hides the primitive with material {human.name}_hair"})
            rows.append(row)
            continue
        obj = next(o for k, o, _ in human.assets if k == "Hair" and o["hair_id"] == style["id"])
        part = obj.copy()
        part.data = obj.data.copy()
        bpy.context.scene.collection.objects.link(part)
        # Keep only the morphs that move this hair by HAIR_MORPH_MIN or more, and in them only
        # the movements of HAIR_MOVE_MIN or more: hair is a light part, and smaller movements
        # are hidden under it.
        keys = part.data.shape_keys.key_blocks
        basis = np.empty(len(part.data.vertices) * 3)
        keys[0].data.foreach_get("co", basis)
        basis = basis.reshape(-1, 3)
        kept = []
        for kb in list(keys)[1:]:
            co = np.empty(basis.size)
            kb.data.foreach_get("co", co)
            delta = co.reshape(-1, 3) - basis
            moved = np.linalg.norm(delta, axis=1)
            if moved.max() < HAIR_MORPH_MIN:
                part.shape_key_remove(kb)
                continue
            delta[moved < HAIR_MOVE_MIN] = 0.0
            kb.data.foreach_set("co", (basis + delta).ravel())
            kept.append(kb.name)
        part.name = part.data.name = f"Hair_{style['id']}"
        for k in list(part.keys()):
            del part[k]
        raw = OUT / f"hair-{human.name}-{style['id']}.raw.glb"
        C.export_glb(raw, [rig, part], morphs=True, morph_normals=False, image_format="WEBP",
                     copyright_text="Hair from MakeHuman assets; see CREDITS.md")
        out = LOOKS / human.name / f"hair-{style['id']}.glb"
        C.finish_glb(raw, out)
        report = C.glb_report(out)
        bpy.data.objects.remove(part, do_unlink=True)
        row.update({"file": str(out.relative_to(C.OUT_CHARACTERS)), "bytes": report["bytes"],
                    "triangles": report["triangles"], "morphs": report["morphTargets"],
                    "material": report_material(out),
                    "replaces": f"the primitive with material {human.name}_hair"})
        rows.append(row)
        C.log(f"  hair part {style['id']}: {report['bytes'] / 1e3:.0f} kB, "
              f"{report['triangles']} triangles, {len(kept)} morphs")
    return rows


def report_material(path):
    gltf, _ = C._read_glb(path)
    return [m["name"] for m in gltf.get("materials", [])]


def export_skin_looks(human, cfg):
    rows = []
    for skin in cfg["looks"]["skins"][human.name]:
        w, h, px = skin_pixels(skin, cfg["textureSize"])
        out = save_pixels(w, h, px, LOOKS / human.name / f"skin-{skin['id']}.webp", "WEBP")
        rows.append({"id": skin["id"], "label": skin["label"],
                     **({"hidden": True} if skin.get("hidden") else {}),
                     "default": skin["id"] == human.body["skin"],
                     "file": str(out.relative_to(C.OUT_CHARACTERS)), "bytes": out.stat().st_size,
                     "normalFile": None,
                     "derived": "blend" in skin,
                     "replaces": f"baseColorTexture of material {human.name}_skin"})
    return rows


def export_eye_looks(human, cfg):
    rows = []
    for eyes in cfg["looks"]["eyes"]:
        info = read_mhmat(MH / eyes["mhmat"])
        w, h, px = load_pixels(mhmat_texture(info, "diffuseTexture"), cfg["smallTextureSize"])
        if eyes.get("irisTint"):
            px = tint_iris(px, eyes["irisTint"])
        out = save_pixels(w, h, px, LOOKS / f"eyes-{eyes['id']}.webp", "WEBP")
        rows.append({"id": eyes["id"], "label": eyes["label"],
                     "default": eyes["id"] == human.body["eyeColour"],
                     "file": str(out.relative_to(C.OUT_CHARACTERS)), "bytes": out.stat().st_size,
                     "replaces": f"baseColorTexture of material {human.name}_eyes "
                                 "(its alpha cuts out the cornea; keep alpha mode MASK)"})
    return rows


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    with_anim = "--no-anim" not in argv
    config = "art/hero.json"
    if "--config" in argv:  # try other settings without touching art/hero.json
        i = argv.index("--config")
        config = argv[i + 1]
        del argv[i:i + 2]
    names = [a for a in argv if not a.startswith("--")]
    cfg = C.load_json(config)
    anim_cfg = C.load_json("art/animations.json")
    results = {}
    C.reset_scene()
    for name in names or list(cfg["bodies"].keys()):
        results[name] = build_body(name, cfg, anim_cfg, with_anim)
    summary = {
        n: {k: (str(v.relative_to(C.REPO)) if isinstance(v, Path) else v) for k, v in r.items()}
        for n, r in results.items()
    }
    C.write_report(summary, "art/out/hero.build.json")
    write_manifest(cfg, anim_cfg, results)
    write_lineage_examples(results)
    C.log("done:", ", ".join(results))


def write_manifest(cfg, anim_cfg, results):
    """public/assets/characters/heroes.json: what the game needs to drive the hero files."""
    path = C.OUT_CHARACTERS / "heroes.json"
    manifest = json.loads(path.read_text()) if path.exists() else {}
    lineages = C.load_json("art/lineages.json")
    manifest.update({
        "about": "Made by scripts/art/hero.py from art/hero.json, art/animations.json and "
                 "art/lineages.json. Do not edit by hand.",
        "skeleton": "MPFB game_engine (Unreal-style bone names)",
        "clips": [{"name": c["name"], "loop": c["loop"]} for c in anim_cfg["clips"]],
        "heightScale": {"range": lineages["heightScaleRange"],
                        "note": "Height is a uniform scale on the character's root node."},
        "morphNote": "maxJointShiftCm is how far the morph at weight 1 would move the joints "
                     "if the skeleton were refitted. boneOffsets give that shift per bone in "
                     "glTF model space (metres, Y up); the game may add weight * offset to the "
                     "bones' rest positions for morphs that move joints. Clips do not key bone "
                     "translation except on the hips and root.",
        "lineages": lineages["presets"],
    })
    bodies = manifest.setdefault("bodies", {})
    for name, r in results.items():
        bodies[name] = {
            "file": r["output"].name,
            "bytes": r["report"]["bytes"],
            "heightMetres": r["heightMetres"],
            "triangles": r["report"]["triangles"],
            "bones": r["report"]["bones"],
            "megabytes": r["report"]["megabytes"],
            "materials": report_material(r["output"]),
            "defaultLooks": {"skin": cfg["bodies"][name]["skin"],
                             "hair": cfg["bodies"][name]["hair"],
                             "eyes": cfg["bodies"][name]["eyeColour"]},
            "morphs": r["morphs"],
        }
        manifest.setdefault("looks", {})[name] = r["looks"]
    manifest["looksNote"] = (
        "Paths are relative to this file. A skin replaces the base colour texture of the "
        "body's <body>_skin material (normalFile, when not null, replaces its normal texture). "
        "An eye colour replaces the base colour texture of <body>_eyes. A hair part is a .glb "
        "skinned to the same 53 bones, in the same order and with the same inverse bind "
        "matrices as the hero: hide the hero's primitive whose material is <body>_hair, load "
        "the part and give its mesh the hero's skeleton; set its morph weights by name as on "
        "the hero. 'shaved' has no file: hide the hair and add nothing. See "
        "docs/ART_PIPELINE.md.")
    path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    C.log("wrote", path.relative_to(C.REPO))


def write_lineage_examples(results):
    """art/out/lineages/hero-<body>-<lineage>.glb: copies with a lineage's morph weights and
    height set as the defaults, for viewing in any glTF viewer. Not shipped."""
    lineages = C.load_json("art/lineages.json")["presets"]
    out_dir = C.ART / "out" / "lineages"
    out_dir.mkdir(parents=True, exist_ok=True)
    for name, r in results.items():
        gltf, bin_chunk = C._read_glb(r["output"])
        for key, preset in lineages.items():
            g = json.loads(json.dumps(gltf))
            for mesh in g["meshes"]:
                names = mesh.get("extras", {}).get("targetNames", [])
                if names:
                    mesh["weights"] = [float(preset["morphs"].get(n, 0.0)) for n in names]
            scale = preset["heightScale"][name]
            for i in g["scenes"][g.get("scene", 0)]["nodes"]:
                g["nodes"][i]["scale"] = [scale, scale, scale]
            C._write_glb(out_dir / f"hero-{name}-{key}.glb", g, bin_chunk)
    C.log("wrote lineage examples to", out_dir.relative_to(C.REPO))


if __name__ == "__main__":
    main()
