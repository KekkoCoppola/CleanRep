import trimesh
import numpy as np
from PIL import Image

# 1. Load original otter
scene = trimesh.load('assets/gymmy/3d/source/pool2370.glb')
mesh = scene.to_geometry()
v = np.asarray(mesh.vertices)
n = np.asarray(mesh.vertex_normals)

# Slice of head vertices above Y = 0.50
hv = v[v[:, 1] > 0.50]

xc = 0.0
zc = 0.075

# 2. Build Solid 3D Headband
# Parameters:
N_ANGLES = 96
N_H = 6 # height subdivisions
BAND_BOTTOM_FRONT = 0.590
BAND_TOP_FRONT = 0.614
BAND_HEIGHT = BAND_TOP_FRONT - BAND_BOTTOM_FRONT # ~24mm

thetas = np.linspace(0, 2 * np.pi, N_ANGLES, endpoint=False)
# Forehead is slightly higher than the back of head
y_centers = 0.602 + 0.010 * np.cos(thetas)

# Find head radius at each angle theta
head_radii = []
for a_idx, theta in enumerate(thetas):
    yc = y_centers[a_idx]
    # Slice around yc
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

head_radii = np.array(head_radii)
# Smooth radii across angles to prevent micro-bumps
from scipy.ndimage import gaussian_filter1d
head_radii = gaussian_filter1d(head_radii, sigma=2.0, mode='wrap')

# Physical offsets:
# Inner surface: +2.5 mm outside fur
# Outer surface: +6.0 mm outside fur (3.5 mm thick athletic band!)
r_inner = head_radii + 0.0025
r_outer = head_radii + 0.0060

# Generate Outer Cylinder Wall
outer_verts = []
outer_uvs = []
outer_normals = []

# Generate Inner Cylinder Wall
inner_verts = []
inner_uvs = []
inner_normals = []

h_steps = np.linspace(-BAND_HEIGHT / 2, BAND_HEIGHT / 2, N_H)

# Texture Atlas layout:
# Headband texture: 1024 x 1024
# Top half [Y: 0..512]: Front CleanRep 'R' Logo!
# Bottom half [Y: 512..1024]: Black fabric texture for sides/back/inside
# For front region (abs(X) < 0.035, Z > zc):
# Planar UV projection directly maps X and Y to the logo region!

for h_i, dh in enumerate(h_steps):
    v_norm = h_i / (N_H - 1)
    for a_i, theta in enumerate(thetas):
        yc = y_centers[a_i] + dh
        sin_t = np.sin(theta)
        cos_t = np.cos(theta)
        
        # Outer point
        ox = xc + r_outer[a_i] * sin_t
        oz = zc + r_outer[a_i] * cos_t
        on = np.array([sin_t, 0.05 * np.cos(theta), cos_t])
        on /= np.linalg.norm(on)
        
        # Inner point
        ix = xc + r_inner[a_i] * sin_t
        iz = zc + r_inner[a_i] * cos_t
        
        # UV Mapping for outer surface:
        # Front region is theta around 0 (cos_t > 0.85, roughly abs(theta) < 30 degrees)
        # Front width in X is from -0.035 to +0.035
        # Logo target box in 3D: X in [-0.022, 0.022], Y in [0.592, 0.612]
        if cos_t > 0.70: # Front area
            # Planar projection for the logo!
            # Map X from [-0.024, 0.024] to U in [0.05, 0.95]
            # Map Y from [0.590, 0.614] to V in [0.55, 0.95]
            u_logo = np.clip((ox - (-0.024)) / 0.048, 0.0, 1.0)
            v_logo = np.clip((yc - 0.590) / 0.024, 0.0, 1.0)
            # Logo is placed in top region of texture: U in [0.1, 0.9], V in [0.55, 0.95]
            u = 0.1 + u_logo * 0.8
            v_coord = 0.52 + v_logo * 0.44
        else:
            # Solid black fabric region (bottom part of texture: U in [0.1, 0.9], V in [0.1, 0.4])
            u = 0.2 + 0.6 * (a_i / N_ANGLES)
            v_coord = 0.15 + 0.25 * v_norm
            
        outer_verts.append([ox, yc, oz])
        outer_uvs.append([u, v_coord])
        outer_normals.append(on)
        
        inner_verts.append([ix, yc, iz])
        inner_uvs.append([0.3, 0.2]) # solid black
        inner_normals.append(-on)

outer_verts = np.array(outer_verts)
outer_uvs = np.array(outer_uvs)
outer_normals = np.array(outer_normals)

inner_verts = np.array(inner_verts)
inner_uvs = np.array(inner_uvs)
inner_normals = np.array(inner_normals)

# Build Faces for Outer Wall, Inner Wall, Top Rim, Bottom Rim:
faces = []

# Outer wall faces (facing outwards)
for h in range(N_H - 1):
    for a in range(N_ANGLES):
        next_a = (a + 1) % N_ANGLES
        i00 = h * N_ANGLES + a
        i01 = h * N_ANGLES + next_a
        i10 = (h + 1) * N_ANGLES + a
        i11 = (h + 1) * N_ANGLES + next_a
        faces.append([i00, i01, i11])
        faces.append([i00, i11, i10])

# Inner wall faces (facing inwards, offset by len(outer_verts))
in_off = len(outer_verts)
for h in range(N_H - 1):
    for a in range(N_ANGLES):
        next_a = (a + 1) % N_ANGLES
        i00 = in_off + h * N_ANGLES + a
        i01 = in_off + h * N_ANGLES + next_a
        i10 = in_off + (h + 1) * N_ANGLES + a
        i11 = in_off + (h + 1) * N_ANGLES + next_a
        # Inward winding
        faces.append([i00, i11, i01])
        faces.append([i00, i10, i11])

# Top Rim (connecting top outer loop to top inner loop)
top_h = N_H - 1
for a in range(N_ANGLES):
    next_a = (a + 1) % N_ANGLES
    o0 = top_h * N_ANGLES + a
    o1 = top_h * N_ANGLES + next_a
    i0 = in_off + top_h * N_ANGLES + a
    i1 = in_off + top_h * N_ANGLES + next_a
    faces.append([o0, i0, i1])
    faces.append([o0, i1, o1])

# Bottom Rim (connecting bottom outer loop to bottom inner loop)
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

# Add Knot & Ribbons at back center (theta = pi, a = N_ANGLES // 2)
back_idx = (N_H // 2) * N_ANGLES + N_ANGLES // 2
back_p = outer_verts[back_idx]
back_n = outer_normals[back_idx]

knot = trimesh.creation.icosphere(radius=0.009, subdivisions=2)
knot.vertices[:, 0] *= 1.5
knot.vertices[:, 1] *= 1.3
knot.vertices[:, 2] *= 0.9
knot.vertices += back_p + back_n * 0.004
knot_uv = np.full((len(knot.vertices), 2), [0.3, 0.2])
knot_faces = knot.faces + len(band_all_verts)

# Hanging Ribbons
def make_ribbon(sign=1.0, base_idx=0):
    r_v = []
    r_uv = []
    r_f = []
    n_seg = 6
    for s in range(n_seg + 1):
        t = s / n_seg
        ry = back_p[1] - t * 0.040
        rz = back_p[2] - 0.003 - t * 0.008
        rx = back_p[0] + sign * (0.005 + t * 0.015)
        rw = 0.008 * (1.0 - t * 0.25)
        r_v.append([rx - rw * 0.5, ry, rz])
        r_v.append([rx + rw * 0.5, ry, rz])
        r_uv.append([0.3, 0.2])
        r_uv.append([0.3, 0.2])
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

print(f"Solid Headband Created: {len(solid_hb_verts)} vertices, {len(solid_hb_faces)} faces")
print(f"Bounds: min={solid_mesh.bounds[0]}, max={solid_mesh.bounds[1]}")

# 3. Create High-Definition Texture with Crisp CleanRep 'R' Logo
TEX_DIM = 2048
hb_tex = Image.new("RGBA", (TEX_DIM, TEX_DIM), (14, 15, 18, 255)) # stealth dark fabric

# Load CleanRep R Logo
logo_sq = Image.open('assets/brand/cleanrep-logo-512.png').convert("RGBA")
arr = np.array(logo_sq)
# Crisp white mask for R logo
mask = (arr[:, :, 0] > 175) & (arr[:, :, 1] > 175) & (arr[:, :, 2] > 175)
r_img = Image.new("RGBA", logo_sq.size, (0, 0, 0, 0))
r_data = np.zeros((logo_sq.size[1], logo_sq.size[0], 4), dtype=np.uint8)
r_data[mask] = [255, 255, 255, 255]
r_img = Image.fromarray(r_data)

# Target region in texture:
# U in [0.1, 0.9] -> X in [205, 1843]
# V in [0.52, 0.96] -> Y in [0.04 * TEX_DIM, 0.48 * TEX_DIM] (in image coordinates, Y=0 is top)
logo_area_w = int(TEX_DIM * 0.8)
logo_area_h = int(TEX_DIM * 0.44)
logo_top = int(TEX_DIM * (1.0 - 0.96))
logo_left = int(TEX_DIM * 0.1)

# Fit logo maintaining aspect ratio:
aspect = r_img.width / r_img.height
target_h = int(logo_area_h * 0.85)
target_w = int(target_h * aspect)
r_fitted = r_img.resize((target_w, target_h), Image.Resampling.LANCZOS)

paste_x = logo_left + (logo_area_w - target_w) // 2
paste_y = logo_top + (logo_area_h - target_h) // 2

hb_tex.paste(r_fitted, (paste_x, paste_y), r_fitted)
hb_tex.save('assets/gymmy/3d/headband_solid_tex.png')
print("Saved texture assets/gymmy/3d/headband_solid_tex.png")

# Now package this solid headband directly into pool2370.glb!
import struct
import json
import io

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

def add_buffer_chunk(data):
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

# 1. Headband Indices
hb_idx_bytes = solid_hb_faces.flatten().tobytes()
bv_hb_idx = add_buffer_chunk(hb_idx_bytes)
acc_hb_idx = len(gltf['accessors'])
gltf['accessors'].append({
    "bufferView": bv_hb_idx,
    "byteOffset": 0,
    "componentType": 5125, # UNSIGNED_INT
    "count": len(solid_hb_faces) * 3,
    "type": "SCALAR"
})

# 2. Headband Positions
hb_pos_bytes = solid_hb_verts.tobytes()
bv_hb_pos = add_buffer_chunk(hb_pos_bytes)
acc_hb_pos = len(gltf['accessors'])
gltf['accessors'].append({
    "bufferView": bv_hb_pos,
    "byteOffset": 0,
    "componentType": 5126, # FLOAT
    "count": len(solid_hb_verts),
    "type": "VEC3",
    "min": solid_hb_verts.min(axis=0).tolist(),
    "max": solid_hb_verts.max(axis=0).tolist()
})

# 3. Headband Normals
hb_norm_bytes = solid_hb_normals.tobytes()
bv_hb_norm = add_buffer_chunk(hb_norm_bytes)
acc_hb_norm = len(gltf['accessors'])
gltf['accessors'].append({
    "bufferView": bv_hb_norm,
    "byteOffset": 0,
    "componentType": 5126,
    "count": len(solid_hb_verts),
    "type": "VEC3"
})

# 4. Headband UVs
hb_uv_bytes = solid_hb_uvs.tobytes()
bv_hb_uv = add_buffer_chunk(hb_uv_bytes)
acc_hb_uv = len(gltf['accessors'])
gltf['accessors'].append({
    "bufferView": bv_hb_uv,
    "byteOffset": 0,
    "componentType": 5126,
    "count": len(solid_hb_verts),
    "type": "VEC2"
})

# 5. Headband Image Texture
hb_png_io = io.BytesIO()
hb_tex.save(hb_png_io, format='PNG')
hb_png_bytes = hb_png_io.getvalue()

bv_hb_img = add_buffer_chunk(hb_png_bytes)
img_hb_idx = len(gltf['images'])
gltf['images'].append({
    "bufferView": bv_hb_img,
    "mimeType": "image/png",
    "name": "headband_solid_cleanrep_texture"
})

tex_hb_idx = len(gltf['textures'])
gltf['textures'].append({
    "sampler": 0,
    "source": img_hb_idx
})

# 6. Headband Material
mat_hb_idx = len(gltf['materials'])
gltf['materials'].append({
    "name": "Headband_CleanRep_Material",
    "pbrMetallicRoughness": {
        "baseColorTexture": {"index": tex_hb_idx},
        "metallicFactor": 0.0,
        "roughnessFactor": 0.82
    },
    "doubleSided": True
})

# 7. Headband Mesh
mesh_hb_idx = len(gltf['meshes'])
gltf['meshes'].append({
    "name": "Gymmy_Solid_Headband",
    "primitives": [{
        "attributes": {
            "POSITION": acc_hb_pos,
            "NORMAL": acc_hb_norm,
            "TEXCOORD_0": acc_hb_uv
        },
        "indices": acc_hb_idx,
        "material": mat_hb_idx,
        "mode": 4
    }]
})

# 8. Add Headband Node to Scene
node_hb_idx = len(gltf['nodes'])
gltf['nodes'].append({
    "name": "Headband_Node",
    "mesh": mesh_hb_idx,
    "translation": [0.0, 0.0, 0.0],
    "rotation": [0.0, 0.0, 0.0, 1.0],
    "scale": [1.0, 1.0, 1.0]
})

gltf['scenes'][0]['nodes'].append(node_hb_idx)
gltf['buffers'][0]['byteLength'] = len(new_bin)

# Save GLB
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
    print(f"Exported flawless solid mascot: {out_p} ({len(final_glb) / 1024 / 1024:.2f} MB)")

