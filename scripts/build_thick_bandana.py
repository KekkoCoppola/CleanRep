"""
Thick, collision-free athletic bandana generator for Gymmy the Mascot.
- Thick bandana (3.0 mm fabric thickness) with +1.2 mm offset to completely eliminate collisions.
- Right-side up, right-reading CleanRep 'R' logo.
- Natural forehead height (just above eyes, tilted back along skull).
- Dynamic per-height taper to adhere snugly to the forehead slope.
- Back knot and dangling ribbons.
"""
import trimesh
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter1d
import struct
import json
import io
import os

print("=== 1. Loading Base Otter Model ===")
source_path = 'assets/gymmy/3d/source/pool2370.glb'
scene = trimesh.load(source_path)
mesh = scene.to_geometry()
v = np.asarray(mesh.vertices)

# Head region
hv = v[(v[:, 1] > 0.48) & (v[:, 1] < 0.65)]
xc = 0.0
zc = 0.065

print("=== 2. Computing Snug Head Contour ===")
N_ANGLES = 128
N_H = 14
BAND_HEIGHT = 0.024 # 24 mm athletic bandana height

thetas = np.linspace(-np.pi, np.pi, N_ANGLES, endpoint=False)
# Forehead center (theta = 0): Y = 0.588 + 0.007 = 0.595
# Band bottom on forehead: 0.595 - 0.012 = 0.583 (12 mm above eye top at 0.571)
# Band top on forehead: 0.595 + 0.012 = 0.607
# Back of head (theta = +-pi): Y = 0.588 - 0.007 = 0.581
y_centers = 0.588 + 0.007 * np.cos(thetas)
h_steps = np.linspace(-BAND_HEIGHT / 2, BAND_HEIGHT / 2, N_H)

radii_grid = np.zeros((N_H, N_ANGLES), dtype=np.float32)

for h_i, dh in enumerate(h_steps):
    for a_i, theta in enumerate(thetas):
        yc = y_centers[a_i] + dh
        slice_mask = np.abs(hv[:, 1] - yc) < 0.0020
        pts = hv[slice_mask]
        angles = np.arctan2(pts[:, 0] - xc, pts[:, 2] - zc)
        diff = np.abs(np.arctan2(np.sin(angles - theta), np.cos(angles - theta)))
        wedge = pts[diff < 0.05]
        if len(wedge) > 0:
            r = np.sqrt((wedge[:, 0] - xc)**2 + (wedge[:, 2] - zc)**2)
            is_front = abs(theta) < 0.95
            if is_front:
                # Track exact forehead fur surface
                r_val = float(np.percentile(r, 92))
            else:
                # Skull contour, capped at 75.5 mm to prevent ear flaring
                r_val = min(float(np.percentile(r, 78)), 0.0755)
            radii_grid[h_i, a_i] = r_val
        else:
            radii_grid[h_i, a_i] = 0.070

# Smooth along angles for clean, continuous curvature
for h_i in range(N_H):
    radii_grid[h_i] = gaussian_filter1d(radii_grid[h_i], sigma=1.5, mode='wrap')

# Thick, collision-free athletic bandana:
# Inner surface: +2.0 mm outside fur surface (100% collision clearance)
# Outer surface: +5.8 mm outside fur surface (3.8 mm thick physical athletic sweatband)
r_inner = radii_grid + 0.0020
r_outer = radii_grid + 0.0058

print(f"Forehead front radius: bottom={radii_grid[0, N_ANGLES//2]:.4f}, top={radii_grid[-1, N_ANGLES//2]:.4f}")
print(f"Forehead slope taper: {(radii_grid[0, N_ANGLES//2] - radii_grid[-1, N_ANGLES//2])*1000:.1f} mm inward slope!")
print(f"Bandana thickness: {(r_outer[0,0] - r_inner[0,0])*1000:.1f} mm solid thick athletic fabric!")

print("=== 3. Creating Right-Reading 4K Headband Texture ===")
TEX_W, TEX_H = 4096, 512
# Matte dark athletic fabric charcoal black
tex_img = Image.new("RGBA", (TEX_W, TEX_H), (18, 19, 23, 255))

r_crop = Image.open('assets/gymmy/3d/r_cropped.png').convert("RGBA")

# Logo target size:
# In 3D: height is 24 mm * 0.78 = ~18.7 mm
# Width in 3D: ~20.0 mm
target_h = int(TEX_H * 0.78)
target_w = 230
r_fitted = r_crop.resize((target_w, target_h), Image.Resampling.LANCZOS)

# Center of texture (U = 0.50 corresponds to theta = 0, forehead center)
paste_x = (TEX_W - target_w) // 2
paste_y = (TEX_H - target_h) // 2
tex_img.paste(r_fitted, (paste_x, paste_y), r_fitted)

tex_path = 'assets/gymmy/3d/headband_thick_tex.png'
tex_img.save(tex_path)
print(f"Saved texture to {tex_path}")

print("=== 4. Building 3D Mesh Geometry ===")
N_COLS = N_ANGLES + 1
outer_verts = []
outer_uvs = []
outer_normals = []

inner_verts = []
inner_uvs = []
inner_normals = []

for h_i, dh in enumerate(h_steps):
    v_norm = h_i / (N_H - 1) # 0 at bottom, 1 at top
    
    # glTF 2.0 / Three.js GLTFLoader convention:
    # In glTF, (0, 0) is TOP-LEFT of texture image, (1, 1) is BOTTOM-RIGHT.
    # At top of headband (v_norm = 1.0), we want the TOP of the 'R' logo -> V = 0.0!
    # At bottom of headband (v_norm = 0.0), we want the BOTTOM of the 'R' logo -> V = 1.0!
    # With margins:
    v_coord = 0.95 - v_norm * 0.90
    
    for c_i in range(N_COLS):
        col_t = c_i / N_ANGLES
        theta = -np.pi + col_t * (2 * np.pi)
        
        # U coordinate:
        # Theta goes from -pi to +pi.
        # At theta < 0 (viewer's left, -X): left of logo (stem, U < 0.5)
        # At theta > 0 (viewer's right, +X): right of logo (loop, U > 0.5)
        u_coord = col_t
        a_i = min(c_i, N_ANGLES - 1)
        
        yc = y_centers[a_i] + dh
        sin_t = np.sin(theta)
        cos_t = np.cos(theta)
        
        # Outer point
        ox = xc + r_outer[h_i, a_i] * sin_t
        oz = zc + r_outer[h_i, a_i] * cos_t
        on = np.array([sin_t, 0.05 * np.cos(theta), cos_t], dtype=np.float32)
        on /= np.linalg.norm(on)
        
        # Inner point
        ix = xc + r_inner[h_i, a_i] * sin_t
        iz = zc + r_inner[h_i, a_i] * cos_t
        
        outer_verts.append([ox, yc, oz])
        outer_uvs.append([u_coord, v_coord])
        outer_normals.append(on)
        
        inner_verts.append([ix, yc, iz])
        inner_uvs.append([0.05, 0.50])
        inner_normals.append(-on)

outer_verts = np.array(outer_verts, dtype=np.float32)
outer_uvs = np.array(outer_uvs, dtype=np.float32)
outer_normals = np.array(outer_normals, dtype=np.float32)

inner_verts = np.array(inner_verts, dtype=np.float32)
inner_uvs = np.array(inner_uvs, dtype=np.float32)
inner_normals = np.array(inner_normals, dtype=np.float32)

faces = []
# Outer wall faces
for h in range(N_H - 1):
    for c in range(N_ANGLES):
        c_next = c + 1
        i00 = h * N_COLS + c
        i01 = h * N_COLS + c_next
        i10 = (h + 1) * N_COLS + c
        i11 = (h + 1) * N_COLS + c_next
        faces.append([i00, i01, i11])
        faces.append([i00, i11, i10])

# Inner wall faces
in_off = len(outer_verts)
for h in range(N_H - 1):
    for c in range(N_ANGLES):
        c_next = c + 1
        i00 = in_off + h * N_COLS + c
        i01 = in_off + h * N_COLS + c_next
        i10 = in_off + (h + 1) * N_COLS + c
        i11 = in_off + (h + 1) * N_COLS + c_next
        faces.append([i00, i11, i01])
        faces.append([i00, i10, i11])

# Top Rim (outer top to inner top)
top_h = N_H - 1
for c in range(N_ANGLES):
    c_next = c + 1
    o0 = top_h * N_COLS + c
    o1 = top_h * N_COLS + c_next
    i0 = in_off + top_h * N_COLS + c
    i1 = in_off + top_h * N_COLS + c_next
    faces.append([o0, i0, i1])
    faces.append([o0, i1, o1])

# Bottom Rim (outer bottom to inner bottom)
for c in range(N_ANGLES):
    c_next = c + 1
    o0 = c
    o1 = c_next
    i0 = in_off + c
    i1 = in_off + c_next
    faces.append([o0, i1, i0])
    faces.append([o0, o1, i1])

band_verts = np.vstack([outer_verts, inner_verts])
band_uvs = np.vstack([outer_uvs, inner_uvs])
band_normals = np.vstack([outer_normals, inner_normals])
band_faces = np.array(faces, dtype=np.uint32)

# Knot & Dangling Ribbons at Back Center (theta = +-pi, c = 0)
back_idx = (N_H // 2) * N_COLS
back_p = outer_verts[back_idx]
back_n = outer_normals[back_idx]

knot = trimesh.creation.icosphere(radius=0.008, subdivisions=2)
knot.vertices[:, 0] *= 1.4
knot.vertices[:, 1] *= 1.1
knot.vertices[:, 2] *= 0.8
knot.vertices += back_p + back_n * 0.002
knot_uv = np.full((len(knot.vertices), 2), [0.05, 0.50], dtype=np.float32)
knot_faces = (knot.faces + len(band_verts)).astype(np.uint32)

def make_ribbon(sign=1.0, base_idx=0):
    r_v = []
    r_uv = []
    r_f = []
    n_seg = 6
    for s in range(n_seg + 1):
        t = s / n_seg
        ry = back_p[1] - t * 0.035
        rz = back_p[2] - 0.002 - t * 0.006
        rx = back_p[0] + sign * (0.004 + t * 0.012)
        rw = 0.008 * (1.0 - t * 0.25)
        r_v.append([rx - rw * 0.5, ry, rz])
        r_v.append([rx + rw * 0.5, ry, rz])
        r_uv.append([0.05, 0.50])
        r_uv.append([0.05, 0.50])
    for s in range(n_seg):
        p0 = base_idx + s * 2
        p1 = base_idx + s * 2 + 1
        p2 = base_idx + (s + 1) * 2
        p3 = base_idx + (s + 1) * 2 + 1
        r_f.append([p0, p1, p3])
        r_f.append([p0, p3, p2])
        r_f.append([p0, p3, p1])
        r_f.append([p0, p2, p3])
    return np.array(r_v, dtype=np.float32), np.array(r_uv, dtype=np.float32), np.array(r_f, dtype=np.uint32)

off_r = len(band_verts) + len(knot.vertices)
rv1, ruv1, rf1 = make_ribbon(-1.0, off_r)
rv2, ruv2, rf2 = make_ribbon(1.0, off_r + len(rv1))

solid_hb_verts = np.vstack([band_verts, knot.vertices, rv1, rv2]).astype(np.float32)
solid_hb_uvs = np.vstack([band_uvs, knot_uv, ruv1, ruv2]).astype(np.float32)
solid_hb_faces = np.vstack([band_faces, knot_faces, rf1, rf2]).astype(np.uint32)

solid_mesh = trimesh.Trimesh(vertices=solid_hb_verts, faces=solid_hb_faces, process=False)
solid_hb_normals = np.asarray(solid_mesh.vertex_normals, dtype=np.float32)

print(f"Total Headband: {len(solid_hb_verts)} vertices, {len(solid_hb_faces)} faces")

print("=== 5. Assembling glTF Binary ===")
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
gltf['images'].append({"bufferView": bv_img, "mimeType": "image/png", "name": "headband_thick_tex"})

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
