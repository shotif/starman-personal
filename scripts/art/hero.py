"""Builds the hero with MPFB 2: public/assets/characters/hero-man.glb and hero-woman.glb.

    blender -b --factory-startup --python scripts/art/hero.py              # both bodies
    blender -b --factory-startup --python scripts/art/hero.py -- man       # one body
    blender -b --factory-startup --python scripts/art/hero.py -- --no-anim # skip animation

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


def bone_heads(rig):
    return {b.name: np.array(b.head_local) for b in rig.data.bones}


class Human:
    def __init__(self, mp, name, body):
        self.mp, self.name, self.body = mp, name, body
        self.assets = []  # (kind, object, mhclo)
        self.targets_dir = Path(mp.Location.get_mpfb_data("targets"))

    def build(self, rig_name):
        mp = self.mp
        pheno = json.loads(json.dumps(self.body["phenotype"]))
        self.basemesh = mp.Human.create_human(scale=0.1, macro_detail_dict=pheno,
                                              feet_on_ground=True)
        self.basemesh.name = f"{self.name}.body"
        self.rig = mp.Human.add_builtin_rig(self.basemesh, rig_name)
        self.rig.name = self.rig.data.name = f"{self.name}_rig"
        for kind, key in (("Eyes", "eyes"), ("Eyebrows", "eyebrows"),
                          ("Eyelashes", "eyelashes"), ("Hair", "hair")):
            if self.body.get(key):
                self.add_asset(kind, MH / self.body[key])
        for path in self.body.get("clothes", []):
            self.add_asset("Clothes", MH / path)

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
            path = self.targets_dir / f"{tname}.target.gz"
            if not path.exists():
                raise RuntimeError(f"no MPFB target {tname}")
            key_name = "__morph_" + tname.replace("/", "_")
            mp.Target.load_target(bm, str(path), weight=weight, name=key_name)
            undo.append(("key", key_name))
        return undo

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

    def bake_morphs(self, morphs):
        """Measure every morph against the baseline, then store them as plain shape keys."""
        base = self.capture()
        deltas = []
        for morph in morphs:
            t = time.time()
            undo = self.apply_morph(morph)
            self.refit()
            shot = self.capture()
            self.revert_morph(undo)
            d_bones = {n: shot["bones"][n] - base["bones"][n] for n in base["bones"]}
            shift = max(float(np.linalg.norm(v)) for v in d_bones.values())
            deltas.append({
                "name": morph["name"],
                "body": shot["body"] - base["body"],
                "assets": [s - b for s, b in zip(shot["assets"], base["assets"])],
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


def delete_hidden_body(basemesh):
    """Delete MPFB's helper geometry and the skin hidden under clothes (keeps shape keys)."""
    vg = basemesh.vertex_groups
    body = vg["body"].index
    hidden = {g.index for g in vg if g.name.startswith("Delete.")}
    me = basemesh.data
    bm = bmesh.new()
    bm.from_mesh(me)
    deform = bm.verts.layers.deform.active
    doomed = []
    for v in bm.verts:
        groups = v[deform]
        if body not in groups or any(groups.get(i, 0.0) > 0.0 for i in hidden):
            doomed.append(v)
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


def load_scaled(path, size, out_dir, colour=True, keep_alpha=False):
    """Load an image, scale it to at most size x size and save it as JPEG (or PNG with alpha)."""
    out_dir.mkdir(parents=True, exist_ok=True)
    src = bpy.data.images.load(str(path), check_existing=False)
    w, h = src.size
    scale = min(1.0, size / max(w, h))
    if scale < 1.0:
        src.scale(max(1, int(w * scale)), max(1, int(h * scale)))
    ext = "png" if keep_alpha else "jpg"
    dest = out_dir / f"{Path(path).stem}.{ext}"
    scene = bpy.context.scene
    settings = scene.render.image_settings
    settings.file_format = "PNG" if keep_alpha else "JPEG"
    settings.color_mode = "RGBA" if keep_alpha else "RGB"
    settings.quality = 88
    settings.compression = 90
    src.save_render(str(dest), scene=scene)
    bpy.data.images.remove(src)
    img = bpy.data.images.load(str(dest), check_existing=False)
    img.colorspace_settings.name = "sRGB" if colour else "Non-Color"
    return img


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
    "Hair": ("MASK", 0.6, "smallTextureSize", False),
    "Clothes": ("OPAQUE", 0.45, "textureSize", True),
}


def set_materials(human, cfg):
    tex_dir = OUT / "textures" / human.name
    size = cfg["textureSize"]
    skin = read_mhmat(MH / human.body["skin"])
    skin_img = load_scaled(mhmat_texture(skin, "diffuseTexture"), size, tex_dir)
    skin_mat = make_material(f"{human.name}_skin", skin_img, roughness=0.55)
    human.basemesh.data.materials.clear()
    human.basemesh.data.materials.append(skin_mat)
    used = [str(MH / human.body["skin"])]
    for kind, obj, mhclo in human.assets:
        alpha, rough, size_key, use_normal = ASSET_LOOK[kind]
        mat_path = MH / human.body["eyeMaterial"] if kind == "Eyes" else Path(mhclo.material)
        info = read_mhmat(mat_path)
        diffuse = mhmat_texture(info, "diffuseTexture")
        normal = mhmat_texture(info, "normalmapTexture") if use_normal else None
        img = load_scaled(diffuse, cfg[size_key], tex_dir, keep_alpha=alpha != "OPAQUE") \
            if diffuse else None
        nimg = load_scaled(normal, cfg[size_key], tex_dir, colour=False) if normal else None
        mat = make_material(f"{human.name}_{kind.lower()}", img, nimg, alpha=alpha,
                            roughness=rough)
        obj.data.materials.clear()
        obj.data.materials.append(mat)
        used.append(str(mat_path))
    return used


# --------------------------------------------------------------------------------------------
# Animation


def ual_sources(anim_cfg):
    sources = {}
    for lib, info in anim_cfg["libraries"].items():
        objs = C.import_glb(C.REPO / info["file"])
        arm = C.armature_of(objs)
        C.delete_objects([o for o in objs if o is not arm])
        acts = C.actions_by_name(arm)
        C.clear_animation(arm)
        arm.location = (0.0, 2.0, 0.0)  # out of the way; motion is measured from rest
        sources[lib] = (arm, acts)
    return sources


def mpfb_to_ual_maps(rig, anim_cfg):
    unreal_to_rigify = {u: r for r, u in C.RIGIFY_TO_UNREAL.items()}
    lower = {n.lower(): n for n in C.UNREAL_BONES}
    maps = {}
    for lib, info in anim_cfg["libraries"].items():
        m = {}
        for b in rig.data.bones:
            u = lower.get(b.name.lower())
            if u is None:
                continue
            m[b.name] = unreal_to_rigify[u] if info["naming"] == "rigify" else u
        maps[lib] = m
    return maps


# --------------------------------------------------------------------------------------------
# Main


def to_gltf(v):
    """Blender Z-up (x, y, z) to glTF Y-up (x, z, -y)."""
    return [round(float(v[0]), 5), round(float(v[2]), 5), round(float(-v[1]), 5)]


def build_body(name, cfg, anim_cfg, with_anim):
    t0 = time.time()
    C.clear_scene()
    mp = load_mpfb()
    body = cfg["bodies"][name]
    C.log(f"building {name}")
    human = Human(mp, name, body)
    human.build(cfg["rig"])
    deltas = human.bake_morphs(cfg["morphs"])
    used_files = set_materials(human, cfg)

    removed = delete_hidden_body(human.basemesh)
    C.log(f"  removed {removed} hidden body vertices")
    meshes = [human.basemesh] + [obj for _, obj, _ in human.assets]
    for obj in meshes:
        keep_bone_groups_only(obj, human.rig)
        for m in list(obj.modifiers):
            if m.type != "ARMATURE":
                obj.modifiers.remove(m)

    # One skinned mesh: the body is the active object, so its armature modifier is kept.
    bpy.ops.object.select_all(action="DESELECT")
    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = human.basemesh
    bpy.ops.object.join()
    mesh = human.basemesh
    mesh.name = mesh.data.name = f"Hero_{name}"
    rig = human.rig
    rig.name = rig.data.name = f"Hero_{name}_Rig"
    # MPFB's own custom properties would otherwise be exported as glTF extras.
    for idblock in (mesh, mesh.data, rig, rig.data):
        for k in list(idblock.keys()):
            del idblock[k]

    clips = []
    if with_anim:
        sources = ual_sources(anim_cfg)
        maps = mpfb_to_ual_maps(rig, anim_cfg)
        clips = C.build_clips(
            rig, anim_cfg["clips"], sources, maps, hips="pelvis", root="Root",
            strafe_args={"pelvis": "pelvis",
                         "spine_weights": [("spine_01", 0.35), ("spine_02", 0.35),
                                           ("spine_03", 0.30)]},
            align_rest=True)
        for arm, _ in sources.values():
            C.delete_objects([arm])
        C.drop_foreign_actions(clips)
        C.push_to_nla(rig, clips)

    raw = OUT / f"hero-{name}.raw.glb"
    C.export_glb(raw, [rig, mesh], morphs=True,
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
        "sourcesUsed": sorted(set(
            used_files + [str(MH / body[k]) for k in ("eyes", "eyebrows", "eyelashes", "hair")
                          if body.get(k)] + [str(MH / p) for p in body.get("clothes", [])])),
    }


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    with_anim = "--no-anim" not in argv
    names = [a for a in argv if not a.startswith("--")]
    cfg = C.load_json("art/hero.json")
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
            "heightMetres": r["heightMetres"],
            "triangles": r["report"]["triangles"],
            "bones": r["report"]["bones"],
            "megabytes": r["report"]["megabytes"],
            "morphs": r["morphs"],
        }
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
