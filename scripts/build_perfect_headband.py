"""
Fix UV orientation so CleanRep 'R' logo is 100% upright, readable, and bold!
"""
import trimesh
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter1d
import struct
import json
import io

print("=== 1. Loading Base Otter Model ===")
source_path = 'assets/gymmy/3d/source/pool2370.glb'
scene = trimesh.load(source_path)
mesh = scene.to_geometry()
v = np.asarray(mesh.vertices)
n = np.asarray(mesh.vertex_normals)

hv = v[v[:, 1] > 0.50]
xc = 0.0
zc = 0.075

print("=== 2. Generating Solid 3D Headband Geometry ===")
N_ANGLES = 128
N_H = 10
BAND_HEIGHT = 0.026 # 26 mm height

thetas = np.linspace(0, 2 * np.pi, N_ANGLES, endpoint=False)
# Forehead centered at Y=0.603, back of skull at Y=0.588
y_centers = 0.598 + 0.010 * np.cos(thetas)

head_radii = []
for a_idx, theta in enumerate(thetas):
    yc = y_centers[a_idx]
    slice_mask = np.abs(hv[:, 1] - yc) < 0.015
    pts = hv[slice_mask]
    angles = np.arctan2(pts[:, 0] - xc, pts[:, 2] - zc)
    diff = np.abs(np.arctan2(np.sin(angles - theta), np.cos(angles - theta)))
    wedge = pts[diff < 0.08]
    if len(wedge) > 0:
        r = np.max(np.sqrt((wedge[:, 0] - xc)**2 + (wedge[:, 2] - zc)**2))
    else:
        r = 0.085
    head_radii.append(r)

head_radii = gaussian_filter1d(np.array(head_radii), sigma=2.0, mode='wrap')

# Physical offsets:
# Inner surface: +2.5 mm outside fur (avoids clipping)
# Outer surface: +7.0 mm outside fur (4.5 mm thick athletic headband)
r_inner = head_radii + 0.0025
r_outer = head_radii + 0.0070

outer_verts = []
outer_uvs = []
outer_normals = []

inner_verts = []
inner_uvs = []
inner_normals = []

h_steps = np.linspace(-BAND_HEIGHT / 2, BAND_HEIGHT / 2, N_H)

# Front logo region in 3D:
# Width across forehead: X in [-0.022, +0.022] (4.4 cm wide logo)
X_LOGO_MIN = -0.022
X_LOGO_MAX = 0.022

for h_i, dh in enumerate(h_steps):
    v_norm = h_i / (N_H - 1) # 0 at bottom, 1 at top
    for a_i, theta in enumerate(thetas):
        yc = y_centers[a_i] + dh
        sin_t = np.sin(theta)
        cos_t = np.cos(theta)
        
        # Outer point
        ox = xc + r_outer[a_i] * sin_t
        oz = zc + r_outer[a_i] * cos_t
        on = np.array([sin_t, 0.06 * np.cos(theta), cos_t])
        on /= np.linalg.norm(on)
        
        # Inner point
        ix = xc + r_inner[a_i] * sin_t
        iz = zc + r_inner[a_i] * cos_t
        
        # UV Mapping for glTF 2.0 (where V=0 is TOP of texture, V=1 is BOTTOM):
        # We want the TOP of the logo (top of 'R') to be at the top of the headband (v_norm = 1).
        # We want the BOTTOM of the logo (bottom of 'R') to be at the bottom of the headband (v_norm = 0).
        if oz > zc and (X_LOGO_MIN <= ox <= X_LOGO_MAX):
            # Planar front projection:
            u_rel = (ox - X_LOGO_MIN) / (X_LOGO_MAX - X_LOGO_MIN)
            u = 0.05 + u_rel * 0.40
            # V in glTF: top of texture is V=0.08, bottom of texture is V=0.92
            # At v_norm=1 (top of headband), V = 0.08!
            # At v_norm=0 (bottom of headband), V = 0.92!
            v_coord = 0.92 - v_norm * 0.84
        else:
            u = 0.75
            v_coord = 0.50
            
        outer_verts.append([ox, yc, oz])
        outer_uvs.append([u, v_coord])
        outer_normals.append(on)
        
        inner_verts.append([ix, yc, iz])
        inner_uvs.append([0.75, 0.50])
        inner_normals.append(-on)

outer_verts = np.array(outer_verts)
outer_uvs = np.array(outer_uvs)
outer_normals = np.array(outer_normals)

inner_verts = np.array(inner_verts)
inner_uvs = np.array(inner_uvs)
inner_normals = np.array(inner_normals)

# Faces
faces = []
for h in range(N_H - 1):
    for a in range(N_ANGLES):
        next_a = (a + 1) % N_ANGLES
        i00 = h * N_ANGLES + a
        i01 = h * N_ANGLES + next_a
        i10 = (h + 1) * N_ANGLES + a
        i11 = (h + 1) * N_ANGLES + next_a
        faces.append([i00, i01, i11])
        faces.append([i00, i11, i10])

in_off = len(outer_verts)
for h in range(N_H - 1):
    for a in range(N_ANGLES):
        next_a = (a + 1) % N_ANGLES
        i00 = in_off + h * N_ANGLES + a
        i01 = in_off + h * N_ANGLES + next_a
        i10 = in_off + (h + 1) * N_ANGLES + a
        i11 = in_off + (h + 1) * N_ANGLES + next_a
        faces.append([i00, i11, i01])
        faces.append([i00, i10, i11])

# Top Rim
top_h = N_H - 1
for a in range(N_ANGLES):
    next_a = (a + 1) % N_ANGLES
    o0 = top_h * N_ANGLES + a
    o1 = top_h * N_ANGLES + next_a
    i0 = in_off + top_h * N_ANGLES + a
    i1 = in_off + top_h * N_ANGLES + next_a
    faces.append([o0, i0, i1])
    faces.append([o0, i1, o1])

# Bottom Rim
for a in range(N_ANGLES):
    next_a = (a + 1) % N_ANGLES
    o0 = a
    o1 = next_a
    i0 = in_off + a
    i1 = in_off + next_a
    faces.append([o0, i1, i0])
    faces.append([o0, o1, i1])

band_all_verts = np.vstack([outer_verts, inner_verts])
band_all_uvs = np.vstack([outer_uvs, inner_uvs])
band_all_normals = np.vstack([outer_normals, inner_normals])
band_all_faces = np.array(faces)

# Knot & Ribbons at back center (theta = pi)
back_idx = (N_H // 2) * N_ANGLES + N_ANGLES // 2
back_p = outer_verts[back_idx]
back_n = outer_normals[back_idx]

knot = trimesh.creation.icosphere(radius=0.010, subdivisions=2)
knot.vertices[:, 0] *= 1.6
knot.vertices[:, 1] *= 1.3
knot.vertices[:, 2] *= 0.9
knot.vertices += back_p + back_n * 0.004
knot_uv = np.full((len(knot.vertices), 2), [0.75, 0.50])
knot_faces = knot.faces + len(band_all_verts)

def make_ribbon(sign=1.0, base_idx=0):
    r_v = []
    r_uv = []
    r_f = []
    n_seg = 6
    for s in range(n_seg + 1):
        t = s / n_seg
        ry = back_p[1] - t * 0.045
        rz = back_p[2] - 0.003 - t * 0.008
        rx = back_p[0] + sign * (0.006 + t * 0.016)
        rw = 0.009 * (1.0 - t * 0.25)
        r_v.append([rx - rw * 0.5, ry, rz])
        r_v.append([rx + rw * 0.5, ry, rz])
        r_uv.append([0.75, 0.50])
        r_uv.append([0.75, 0.50])
    for s in range(n_seg):
        p0 = base_idx + s * 2
        p1 = base_idx + s * 2 + 1
        p2 = base_idx + (s + 1) * 2
        p3 = base_idx + (s + 1) * 2 + 1
        r_f.append([p0, p1, p3])
        r_f.append([p0, p3, p2])
        r_f.append([p0, p3, p1])
        r_f.append([p0, p2, p3])
    return np.array(r_v), np.array(r_uv), np.array(r_f)

off_r = len(band_all_verts) + len(knot.vertices)
rv1, ruv1, rf1 = make_ribbon(-1.0, off_r)
rv2, ruv2, rf2 = make_ribbon(1.0, off_r + len(rv1))

solid_hb_verts = np.vstack([band_all_verts, knot.vertices, rv1, rv2]).astype(np.float32)
solid_hb_uvs = np.vstack([band_all_uvs, knot_uv, ruv1, ruv2]).astype(np.float32)
solid_hb_faces = np.vstack([band_all_faces, knot_faces, rf1, rf2]).astype(np.uint32)

solid_mesh = trimesh.Trimesh(vertices=solid_hb_verts, faces=solid_hb_faces, process=False)
solid_hb_normals = np.asarray(solid_mesh.vertex_normals, dtype=np.float32)

print("=== 3. Creating Ultra-Crisp Logo Texture ===")
TEX_W, TEX_H = 2048, 1024
tex_img = Image.new("RGBA", (TEX_W, TEX_H), (14, 15, 18, 255))

r_crop = Image.open('assets/gymmy/3d/r_cropped.png').convert("RGBA")

# Logo target region in texture:
# U in [0.05, 0.45] -> X in [102, 921] (width = 819 px)
# V in [0.08, 0.92] -> Y in [82, 942] (height = 860 px)
logo_area_w = int(0.40 * TEX_W)
logo_area_h = int(0.84 * TEX_H)
logo_area_x = int(0.05 * TEX_W)
logo_area_y = int(0.08 * TEX_H)

target_h = int(logo_area_h * 0.88)
aspect = r_crop.width / r_crop.height
target_w = int(target_h * aspect)
r_fitted = r_crop.resize((target_w, target_h), Image.Resampling.LANCZOS)

paste_x = logo_area_x + (logo_area_w - target_w) // 2
paste_y = logo_area_y + (logo_area_h - target_h) // 2
tex_img.paste(r_fitted, (paste_x, paste_y), r_fitted)

tex_img.save('assets/gymmy/3d/headband_perfect_tex.png')
print("Saved texture: assets/gymmy/3d/headband_perfect_tex.png")

print("=== 4. Packaging Updated Flawless GLB ===")
source_path = 'assets/gymmy/3d/source/pool2370.glb'
with open(source_path, 'rb') as f:
    glb_data = f.read()

chunk0_len, chunk0_type = struct.unpack_from('<II', glb_data, 12)
json_bytes = glb_data[20:20 + chunk0_len]
gltf = json.loads(json_bytes.decode('utf-8'))

chunk1_header_offset = 20 + chunk0_len
chunk1_len, chunk1_type = struct.unpack_from('<II', glb_data, chunk1_header_offset)
bin_offset = chunk1_header_offset + 8
orig_bin = glb_data[bin_offset:bin_offset + chunk1_len]

new_bin = bytearray(orig_bin)

def add_chunk(data):
    while len(new_bin) % 4 != 0:
        new_bin.append(0)
    offset = len(new_bin)
    new_bin.extend(data)
    bv_idx = len(gltf['bufferViews'])
    gltf['bufferViews'].append({
        "buffer": 0,
        "byteOffset": offset,
        "byteLength": len(data)
    })
    return bv_idx

bv_idx = add_chunk(solid_hb_faces.flatten().tobytes())
acc_idx = len(gltf['accessors'])
gltf['accessors'].append({
    "bufferView": bv_idx, "byteOffset": 0, "componentType": 5125,
    "count": len(solid_hb_faces) * 3, "type": "SCALAR"
})

bv_pos = add_chunk(solid_hb_verts.tobytes())
acc_pos = len(gltf['accessors'])
gltf['accessors'].append({
    "bufferView": bv_pos, "byteOffset": 0, "componentType": 5126,
    "count": len(solid_hb_verts), "type": "VEC3",
    "min": solid_hb_verts.min(axis=0).tolist(),
    "max": solid_hb_verts.max(axis=0).tolist()
})

bv_norm = add_chunk(solid_hb_normals.tobytes())
acc_norm = len(gltf['accessors'])
gltf['accessors'].append({
    "bufferView": bv_norm, "byteOffset": 0, "componentType": 5126,
    "count": len(solid_hb_verts), "type": "VEC3"
})

bv_uv = add_chunk(solid_hb_uvs.tobytes())
acc_uv = len(gltf['accessors'])
gltf['accessors'].append({
    "bufferView": bv_uv, "byteOffset": 0, "componentType": 5126,
    "count": len(solid_hb_verts), "type": "VEC2"
})

png_io = io.BytesIO()
tex_img.save(png_io, format='PNG')
png_bytes = png_io.getvalue()
bv_img = add_chunk(png_bytes)

img_idx = len(gltf['images'])
gltf['images'].append({"bufferView": bv_img, "mimeType": "image/png", "name": "headband_perfect_tex"})

tex_idx = len(gltf['textures'])
gltf['textures'].append({"sampler": 0, "source": img_idx})

mat_idx = len(gltf['materials'])
gltf['materials'].append({
    "name": "Headband_CleanRep_Material",
    "pbrMetallicRoughness": {
        "baseColorTexture": {"index": tex_idx},
        "metallicFactor": 0.0,
        "roughnessFactor": 0.85
    },
    "doubleSided": True
})

mesh_idx = len(gltf['meshes'])
gltf['meshes'].append({
    "name": "Gymmy_Headband",
    "primitives": [{
        "attributes": {
            "POSITION": acc_pos,
            "NORMAL": acc_norm,
            "TEXCOORD_0": acc_uv
        },
        "indices": acc_idx,
        "material": mat_idx,
        "mode": 4
    }]
})

node_idx = len(gltf['nodes'])
gltf['nodes'].append({
    "name": "Headband_Node",
    "mesh": mesh_idx,
    "translation": [0.0, 0.0, 0.0],
    "rotation": [0.0, 0.0, 0.0, 1.0],
    "scale": [1.0, 1.0, 1.0]
})

gltf['scenes'][0]['nodes'].append(node_idx)
gltf['buffers'][0]['byteLength'] = len(new_bin)

json_out = json.dumps(gltf, separators=(',', ':')).encode('utf-8')
while len(json_out) % 4 != 0:
    json_out += b' '

total_len = 12 + 8 + len(json_out) + 8 + len(new_bin)
header = struct.pack('<4sII', b'glTF', 2, total_len)
c0_hdr = struct.pack('<II', len(json_out), 0x4E4F534A)
c1_hdr = struct.pack('<II', len(new_bin), 0x004E4942)
final_glb = header + c0_hdr + json_out + c1_hdr + bytes(new_bin)

for out_p in ['public/assets/gymmy/gymmy.glb', 'assets/gymmy/3d/gymmy_rigged.glb']:
    with open(out_p, 'wb') as f:
        f.write(final_glb)
    print(f"Exported: {out_p} ({len(final_glb) / 1024 / 1024:.2f} MB)")

print("=== Complete! ===")
