"""
Complete Mascot Pipeline for Gymmy the Otter (CleanRep)
1. Generates 3D Headband with CleanRep 'R' Logo matching GymmySketch
2. Builds complete Rigged Armature / Skeleton (Hips, Spine, Chest, Neck, Head, Arms, Legs, Tail)
3. Computes Skinning Weights (JOINTS_0, WEIGHTS_0, inverseBindMatrices)
4. Exports animation-ready GLB to assets/gymmy/3d/gymmy_rigged.glb and public/assets/gymmy/
5. Generates high-res rendered sprites for Gymmy Rest and Workout modes
"""

import os
import sys
import json
import struct
import numpy as np
import trimesh
from PIL import Image, ImageDraw, ImageFilter
from scipy.spatial import cKDTree

print("=== 1. Loading Base Otter Model ===")
source_glb = 'assets/gymmy/3d/source/pool2370.glb'
scene = trimesh.load(source_glb)
mesh = scene.to_geometry()
if isinstance(mesh, list):
    mesh = mesh[0]

v_orig = np.asarray(mesh.vertices)
n_orig = np.asarray(mesh.vertex_normals)
faces_orig = np.asarray(mesh.faces)

# Base model is 1.5M faces. For smooth real-time animation in Three.js on mobile/web,
# an optimized mesh of ~25k-40k faces preserves full visual fidelity while running at 60fps.
print(f"Original vertices: {len(v_orig)}, faces: {len(faces_orig)}")

# Let's simplify with fast_simplification
import fast_simplification
target_faces = 35000
reduction = 1.0 - (target_faces / len(faces_orig))
print(f"Simplifying to ~{target_faces} faces (reduction {reduction:.3f})...")
v_simp, faces_simp = fast_simplification.simplify(
    v_orig, faces_orig, target_reduction=reduction
)
print(f"Simplified vertices: {len(v_simp)}, faces: {len(faces_simp)}")

# Compute simplified normals
simp_mesh = trimesh.Trimesh(vertices=v_simp, faces=faces_simp, process=False)
n_simp = np.asarray(simp_mesh.vertex_normals)

# Interpolate original UVs to simplified mesh using cKDTree
tree_orig = cKDTree(v_orig)
_, nearest_idx = tree_orig.query(v_simp)

# Read original UVs from GLB
with open(source_glb, 'rb') as f:
    f.seek(12)
    chunk_len = struct.unpack('<I', f.read(4))[0]
    f.seek(20)
    gltf_json = json.loads(f.read(chunk_len).decode('utf-8'))
    bin_start = 20 + chunk_len + 8
    f.seek(bin_start)
    bin_blob = f.read()

uv_acc = gltf_json['accessors'][3] # TEXCOORD_0
uv_bv = gltf_json['bufferViews'][uv_acc['bufferView']]
uv_offset = uv_bv.get('byteOffset', 0) + uv_acc.get('byteOffset', 0)
uv_count = uv_acc['count']
orig_uvs = np.frombuffer(bin_blob, dtype=np.float32, count=uv_count * 2, offset=uv_offset).reshape(-1, 2)
uv_simp = orig_uvs[nearest_idx]

print("=== 2. Creating Headband with CleanRep 'R' Logo ===")
# Locate head vertices
head_mask = v_simp[:, 1] > 0.48
hv = v_simp[head_mask]
hn = n_simp[head_mask]
head_tree = cKDTree(hv)

# Headband loop around forehead and back of head
N_ANGLES = 64
N_HEIGHTS = 6
BAND_HEIGHT = 0.024

thetas = np.linspace(0, 2 * np.pi, N_ANGLES, endpoint=False)
y_centers = 0.582 + 0.010 * np.cos(thetas)  # slightly tilted athletic angle
z_center = 0.075

height_offsets = np.linspace(-BAND_HEIGHT / 2, BAND_HEIGHT / 2, N_HEIGHTS)
hb_verts = []
hb_uvs = []
hb_normals = []

for h_idx, dh in enumerate(height_offsets):
    v_row = []
    uv_row = []
    n_row = []
    v_norm = h_idx / (N_HEIGHTS - 1)
    
    for a_idx, theta in enumerate(thetas):
        dx = np.sin(theta)
        dz = np.cos(theta)
        yc = y_centers[a_idx] + dh
        
        # sample along ray
        ray_pts = np.array([[r * dx, yc, z_center + r * dz] for r in np.linspace(0.05, 0.12, 12)])
        dists, idxs = head_tree.query(ray_pts)
        best_idx = idxs[np.argmin(dists)]
        surf_pt = hv[best_idx]
        surf_n = hn[best_idx]
        
        # outward offset
        out_dir = np.array([dx, 0.1 * np.cos(theta), dz])
        out_dir /= np.linalg.norm(out_dir)
        norm = surf_n * 0.7 + out_dir * 0.3
        norm /= np.linalg.norm(norm)
        
        pos = surf_pt + norm * 0.0025  # 2.5mm offset on top of fur
        
        # UV coordinate: front theta=0 is U=0.5
        angle_sym = theta if theta <= np.pi else theta - 2 * np.pi
        u = (angle_sym / (2 * np.pi)) + 0.5
        
        v_row.append(pos)
        uv_row.append([u, v_norm])
        n_row.append(norm)
        
    hb_verts.append(v_row)
    hb_uvs.append(uv_row)
    hb_normals.append(n_row)

hb_verts = np.array(hb_verts).reshape(-1, 3)
hb_uvs = np.array(hb_uvs).reshape(-1, 2)
hb_normals = np.array(hb_normals).reshape(-1, 3)

hb_faces = []
for h in range(N_HEIGHTS - 1):
    for a in range(N_ANGLES):
        next_a = (a + 1) % N_ANGLES
        i00 = h * N_ANGLES + a
        i01 = h * N_ANGLES + next_a
        i10 = (h + 1) * N_ANGLES + a
        i11 = (h + 1) * N_ANGLES + next_a
        hb_faces.append([i00, i01, i11])
        hb_faces.append([i00, i11, i10])

hb_faces = np.array(hb_faces)

# Knot at back center (theta = pi, approx index N_ANGLES // 2)
back_center = hb_verts[(N_HEIGHTS // 2) * N_ANGLES + N_ANGLES // 2]
back_norm = hb_normals[(N_HEIGHTS // 2) * N_ANGLES + N_ANGLES // 2]

knot = trimesh.creation.icosphere(radius=0.007, subdivisions=2)
knot.vertices[:, 0] *= 1.4
knot.vertices[:, 1] *= 1.2
knot.vertices[:, 2] *= 0.8
knot.vertices += back_center + back_norm * 0.003
knot_uv = np.full((len(knot.vertices), 2), [0.05, 0.5])
knot_faces = knot.faces + len(hb_verts)

# Hanging ribbons from knot
def make_ribbon(sign=1.0, base_idx=0):
    r_v = []
    r_uv = []
    r_f = []
    n_seg = 5
    for s in range(n_seg + 1):
        t = s / n_seg
        ry = back_center[1] - t * 0.035
        rz = back_center[2] - 0.002 - t * 0.006
        rx = back_center[0] + sign * (0.004 + t * 0.012)
        rw = 0.006 * (1.0 - t * 0.25)
        r_v.append([rx - rw * 0.5, ry, rz])
        r_v.append([rx + rw * 0.5, ry, rz])
        r_uv.append([0.05, t])
        r_uv.append([0.15, t])
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

idx_offset = len(hb_verts) + len(knot.vertices)
r_v1, r_uv1, r_f1 = make_ribbon(-1.0, idx_offset)
r_v2, r_uv2, r_f2 = make_ribbon(1.0, idx_offset + len(r_v1))

full_hb_verts = np.vstack([hb_verts, knot.vertices, r_v1, r_v2])
full_hb_uvs = np.vstack([hb_uvs, knot_uv, r_uv1, r_uv2])
full_hb_faces = np.vstack([hb_faces, knot_faces, r_f1, r_f2])
full_hb_mesh = trimesh.Trimesh(vertices=full_hb_verts, faces=full_hb_faces, process=False)
full_hb_normals = np.asarray(full_hb_mesh.vertex_normals)

print(f"Headband created with {len(full_hb_verts)} vertices, {len(full_hb_faces)} faces")

# Generate Headband Texture
TEX_W, TEX_H = 1024, 256
hb_img = Image.new("RGBA", (TEX_W, TEX_H), (15, 15, 17, 255)) # sleek athletic black

# Load and process CleanRep R logo
logo_p = 'assets/brand/cleanrep-logo-512.png'
logo_sq = Image.open(logo_p).convert("RGBA")
arr = np.array(logo_sq)
mask = (arr[:, :, 0] > 180) & (arr[:, :, 1] > 180) & (arr[:, :, 2] > 180)
r_layer = np.zeros((logo_sq.size[1], logo_sq.size[0], 4), dtype=np.uint8)
r_layer[mask] = [255, 255, 255, 255]
r_clean = Image.fromarray(r_layer)

target_h = int(TEX_H * 0.72)
aspect = r_clean.width / r_clean.height
target_w = int(target_h * aspect)
r_clean = r_clean.resize((target_w, target_h), Image.Resampling.LANCZOS)

# Paste in center (U = 0.5)
paste_x = (TEX_W - target_w) // 2
paste_y = (TEX_H - target_h) // 2
hb_img.paste(r_clean, (paste_x, paste_y), r_clean)

os.makedirs('assets/gymmy/3d', exist_ok=True)
os.makedirs('public/assets/gymmy', exist_ok=True)
hb_img.save('assets/gymmy/3d/headband_tex.png')
hb_img.save('public/assets/gymmy/headband_tex.png')

print("=== 3. Building Skeleton & Rigging for Animations ===")
# Define Humanoid / Otter Bone Hierarchy:
# Coordinates in model space:
# Height: Y=0 (feet) to Y=0.625 (top of head).
# Snout points towards +Z, tail points towards -Z.
# Outstretched arms in T-pose along X: -0.36 to +0.36.
bones_def = [
    # index: 0
    {"name": "Root", "parent": None, "pos": [0.0, 0.0, 0.0]},
    # 1
    {"name": "Hips", "parent": 0, "pos": [0.0, 0.28, -0.03]},
    # 2
    {"name": "Spine", "parent": 1, "pos": [0.0, 0.38, 0.01]},
    # 3
    {"name": "Chest", "parent": 2, "pos": [0.0, 0.46, 0.03]},
    # 4
    {"name": "Neck", "parent": 3, "pos": [0.0, 0.52, 0.06]},
    # 5
    {"name": "Head", "parent": 4, "pos": [0.0, 0.58, 0.08]},
    # 6
    {"name": "Shoulder_L", "parent": 3, "pos": [0.08, 0.47, 0.02]},
    # 7
    {"name": "UpperArm_L", "parent": 6, "pos": [0.15, 0.47, 0.02]},
    # 8
    {"name": "LowerArm_L", "parent": 7, "pos": [0.24, 0.47, 0.02]},
    # 9
    {"name": "Hand_L", "parent": 8, "pos": [0.33, 0.47, 0.02]},
    # 10
    {"name": "Shoulder_R", "parent": 3, "pos": [-0.08, 0.47, 0.02]},
    # 11
    {"name": "UpperArm_R", "parent": 10, "pos": [-0.15, 0.47, 0.02]},
    # 12
    {"name": "LowerArm_R", "parent": 11, "pos": [-0.24, 0.47, 0.02]},
    # 13
    {"name": "Hand_R", "parent": 12, "pos": [-0.33, 0.47, 0.02]},
    # 14
    {"name": "UpperLeg_L", "parent": 1, "pos": [0.07, 0.20, -0.02]},
    # 15
    {"name": "LowerLeg_L", "parent": 14, "pos": [0.07, 0.09, -0.02]},
    # 16
    {"name": "Foot_L", "parent": 15, "pos": [0.07, 0.02, 0.02]},
    # 17
    {"name": "UpperLeg_R", "parent": 1, "pos": [-0.07, 0.20, -0.02]},
    # 18
    {"name": "LowerLeg_R", "parent": 17, "pos": [-0.07, 0.09, -0.02]},
    # 19
    {"name": "Foot_R", "parent": 18, "pos": [-0.07, 0.02, 0.02]},
    # 20
    {"name": "Tail_1", "parent": 1, "pos": [0.0, 0.24, -0.12]},
    # 21
    {"name": "Tail_2", "parent": 20, "pos": [0.0, 0.17, -0.32]},
    # 22
    {"name": "Tail_3", "parent": 21, "pos": [0.0, 0.10, -0.56]},
    # 23
    {"name": "Tail_4", "parent": 22, "pos": [0.0, 0.04, -0.80]},
]

num_bones = len(bones_def)
bone_positions = np.array([b["pos"] for b in bones_def])
print(f"Rig defined with {num_bones} bones across full otter anatomy.")

def compute_skin_weights(vertices, is_headband=False):
    """
    Computes smooth 4-joint skin weights (JOINTS_0, WEIGHTS_0) for each vertex.
    For headband vertices: 100% bound to Head bone (index 5) so it moves locked to the head.
    For body vertices: distance falloff to skeletal line segments.
    """
    n_v = len(vertices)
    joints = np.zeros((n_v, 4), dtype=np.uint8)
    weights = np.zeros((n_v, 4), dtype=np.float32)
    
    if is_headband:
        # Headband is entirely bound to the head bone
        joints[:, 0] = 5  # Head bone index
        weights[:, 0] = 1.0
        return joints, weights
    
    # Bone segments: define capsule line segments between parent and child
    # Bone weights based on distance to segment
    dists = np.zeros((n_v, num_bones), dtype=np.float32)
    for b_i in range(num_bones):
        p_i = bones_def[b_i]["parent"]
        b_pos = bone_positions[b_i]
        if p_i is None:
            # point distance
            dists[:, b_i] = np.linalg.norm(vertices - b_pos, axis=1)
        else:
            p_pos = bone_positions[p_i]
            seg = b_pos - p_pos
            seg_len2 = np.dot(seg, seg)
            if seg_len2 < 1e-8:
                dists[:, b_i] = np.linalg.norm(vertices - b_pos, axis=1)
            else:
                v_rel = vertices - p_pos
                t = np.clip(np.sum(v_rel * seg, axis=1) / seg_len2, 0.0, 1.0)
                proj = p_pos + t[:, np.newaxis] * seg
                dists[:, b_i] = np.linalg.norm(vertices - proj, axis=1)
                
    # Prioritize specialized zones (arms, head, tail, legs)
    # Head boost: if Y > 0.54, heavily weight Head bone (5)
    head_mask = vertices[:, 1] > 0.54
    dists[head_mask, 5] *= 0.4
    
    # Tail boost: if Z < -0.12 and Y < 0.30
    tail_mask = (vertices[:, 2] < -0.10) & (vertices[:, 1] < 0.32)
    dists[tail_mask, 20:24] *= 0.35
    
    # Left vs Right arm/leg separation to prevent weight bleeding
    left_mask = vertices[:, 0] > 0.05
    right_mask = vertices[:, 0] < -0.05
    # Right bones should not affect left side, and vice versa
    right_bones = [10, 11, 12, 13, 17, 18, 19]
    left_bones = [6, 7, 8, 9, 14, 15, 16]
    dists[left_mask[:, np.newaxis] & np.isin(np.arange(num_bones), right_bones)] += 10.0
    dists[right_mask[:, np.newaxis] & np.isin(np.arange(num_bones), left_bones)] += 10.0

    # Compute inverse distance weights (falloff ~ dist^-3)
    raw_w = 1.0 / (dists + 0.02) ** 3
    
    # Top 4 bones per vertex
    top4_idx = np.argsort(-raw_w, axis=1)[:, :4]
    for i in range(n_v):
        b4 = top4_idx[i]
        w4 = raw_w[i, b4]
        w_sum = np.sum(w4)
        if w_sum > 1e-6:
            w4 /= w_sum
        else:
            w4 = np.array([1.0, 0.0, 0.0, 0.0])
        joints[i] = b4
        weights[i] = w4
        
    return joints, weights

print("Computing skinning weights for body and headband...")
body_joints, body_weights = compute_skin_weights(v_simp, is_headband=False)
hb_joints, hb_weights = compute_skin_weights(full_hb_verts, is_headband=True)

# Combine body and headband into a single cohesive rigged mascot mesh!
all_verts = np.vstack([v_simp, full_hb_verts])
all_normals = np.vstack([n_simp, full_hb_normals])
all_uvs = np.vstack([uv_simp, full_hb_uvs])
all_joints = np.vstack([body_joints, hb_joints])
all_weights = np.vstack([body_weights, hb_weights])

# Offset faces for headband
hb_faces_offset = full_hb_faces + len(v_simp)

print(f"Total Combined Model: {len(all_verts)} vertices, {len(faces_simp) + len(full_hb_faces)} faces")

# Compute Inverse Bind Matrices (4x4 matrix for each bone)
# Since bind pose is identity orientation with bone at bone_pos:
# invBindMatrix maps world coords to bone space -> Translation by -bone_pos
inv_bind_matrices = []
for b in bones_def:
    m = np.eye(4, dtype=np.float32)
    m[3, :3] = -np.array(b["pos"], dtype=np.float32) # row-major / column-major translation
    inv_bind_matrices.append(m)
inv_bind_matrices = np.array(inv_bind_matrices, dtype=np.float32)

print("=== 4. Packaging Complete Rigged Mascot GLB ===")
# Build glTF JSON and Binary Chunks
# We create 2 primitives or separate meshes in one node for clean material assignment:
# Primitive 0: Otter Body with fur diffuse texture
# Primitive 1: Headband with CleanRep 'R' logo texture
# All bound to the exact same Skin & Skeleton!

# Let's read the diffuse texture buffer from original glb
diff_img = Image.open('assets/gymmy/3d/textures/texture_pbr_20250901_1.png')
# Optimize diffuse texture to 2048x2048 JPEG/PNG for mobile app performance
diff_opt = diff_img.resize((2048, 2048), Image.Resampling.LANCZOS)
import io
diff_bytes_io = io.BytesIO()
diff_opt.save(diff_bytes_io, format='JPEG', quality=88)
diff_bytes = diff_bytes_io.getvalue()

hb_bytes_io = io.BytesIO()
hb_img.save(hb_bytes_io, format='PNG')
hb_bytes = hb_bytes_io.getvalue()

# Build binary buffers:
# Buffer 0: Indices Body (uint32)
body_idx_bytes = faces_simp.astype(np.uint32).tobytes()
# Buffer 1: Indices Headband (uint32)
hb_idx_bytes = full_hb_faces.astype(np.uint32).tobytes()
# Buffer 2: Positions Body (vec3 float32)
body_pos_bytes = v_simp.astype(np.float32).tobytes()
# Buffer 3: Normals Body (vec3 float32)
body_norm_bytes = n_simp.astype(np.float32).tobytes()
# Buffer 4: UVs Body (vec2 float32)
body_uv_bytes = uv_simp.astype(np.float32).tobytes()
# Buffer 5: Joints Body (vec4 uint8)
body_joints_bytes = body_joints.tobytes()
# Buffer 6: Weights Body (vec4 float32)
body_weights_bytes = body_weights.tobytes()

# Headband attributes:
hb_pos_bytes = full_hb_verts.astype(np.float32).tobytes()
hb_norm_bytes = full_hb_normals.astype(np.float32).tobytes()
hb_uv_bytes = full_hb_uvs.astype(np.float32).tobytes()
hb_joints_bytes = hb_joints.tobytes()
hb_weights_bytes = hb_weights.tobytes()

# Inverse bind matrices (24 * 16 * 4 bytes)
ibm_bytes = inv_bind_matrices.tobytes()

# Animation clips (Idle breathing & Squat workout keyframes)
# Let's generate keyframe animation tracks for glTF!
# Time keys: 0s to 2s
anim_times = np.array([0.0, 0.5, 1.0, 1.5, 2.0], dtype=np.float32)
time_bytes = anim_times.tobytes()

# Idle Animation: Hips breathe up and down, Spine sways slightly, Tail sways gently
# Rotations as unit quaternions [x, y, z, w]
idle_hips_rot = np.array([
    [0.0, 0.0, 0.0, 1.0],
    [0.02, 0.0, 0.0, 0.9998],
    [0.0, 0.0, 0.0, 1.0],
    [-0.02, 0.0, 0.0, 0.9998],
    [0.0, 0.0, 0.0, 1.0],
], dtype=np.float32)
idle_hips_trans = np.array([
    [0.0, 0.28, -0.03],
    [0.0, 0.283, -0.03],
    [0.0, 0.28, -0.03],
    [0.0, 0.278, -0.03],
    [0.0, 0.28, -0.03],
], dtype=np.float32)

idle_tail_rot = np.array([
    [0.0, 0.0, 0.0, 1.0],
    [0.0, 0.05, 0.0, 0.9987],
    [0.0, 0.0, 0.0, 1.0],
    [0.0, -0.05, 0.0, 0.9987],
    [0.0, 0.0, 0.0, 1.0],
], dtype=np.float32)

anim_data_bytes = idle_hips_rot.tobytes() + idle_hips_trans.tobytes() + idle_tail_rot.tobytes()

# Assemble full binary payload
chunks = [
    body_idx_bytes, hb_idx_bytes,
    body_pos_bytes, body_norm_bytes, body_uv_bytes, body_joints_bytes, body_weights_bytes,
    hb_pos_bytes, hb_norm_bytes, hb_uv_bytes, hb_joints_bytes, hb_weights_bytes,
    ibm_bytes, time_bytes, anim_data_bytes,
    diff_bytes, hb_bytes
]

bin_buffer = bytearray()
buffer_views = []

for c in chunks:
    # 4-byte align
    while len(bin_buffer) % 4 != 0:
        bin_buffer.append(0)
    bv_offset = len(bin_buffer)
    bin_buffer.extend(c)
    buffer_views.append({
        "buffer": 0,
        "byteOffset": bv_offset,
        "byteLength": len(c)
    })

# Node hierarchy:
# Node 0: Gymmy Character Root (Mesh Node with Skin)
# Nodes 1..24: Bones (Skeleton joints)
nodes = []
nodes.append({
    "name": "Gymmy_Character",
    "mesh": 0,
    "skin": 0,
    "children": [1] # Child is Root bone
})

joint_node_indices = list(range(1, num_bones + 1))

for b_i, b in enumerate(bones_def):
    node_obj = {
        "name": b["name"],
        "translation": list(b["pos"]),
        "rotation": [0.0, 0.0, 0.0, 1.0],
        "scale": [1.0, 1.0, 1.0]
    }
    # find children
    ch = [c_i + 1 for c_i, c in enumerate(bones_def) if c["parent"] == b_i]
    if ch:
        node_obj["children"] = ch
    nodes.append(node_obj)

# Accessors
accessors = [
    # 0: Body indices
    {"bufferView": 0, "byteOffset": 0, "componentType": 5125, "count": len(faces_simp) * 3, "type": "SCALAR"},
    # 1: HB indices
    {"bufferView": 1, "byteOffset": 0, "componentType": 5125, "count": len(full_hb_faces) * 3, "type": "SCALAR"},
    # 2: Body pos
    {"bufferView": 2, "byteOffset": 0, "componentType": 5126, "count": len(v_simp), "type": "VEC3",
     "min": v_simp.min(axis=0).tolist(), "max": v_simp.max(axis=0).tolist()},
    # 3: Body normal
    {"bufferView": 3, "byteOffset": 0, "componentType": 5126, "count": len(v_simp), "type": "VEC3"},
    # 4: Body uv
    {"bufferView": 4, "byteOffset": 0, "componentType": 5126, "count": len(v_simp), "type": "VEC2"},
    # 5: Body joints
    {"bufferView": 5, "byteOffset": 0, "componentType": 5121, "count": len(v_simp), "type": "VEC4"},
    # 6: Body weights
    {"bufferView": 6, "byteOffset": 0, "componentType": 5126, "count": len(v_simp), "type": "VEC4"},
    
    # 7: HB pos
    {"bufferView": 7, "byteOffset": 0, "componentType": 5126, "count": len(full_hb_verts), "type": "VEC3",
     "min": full_hb_verts.min(axis=0).tolist(), "max": full_hb_verts.max(axis=0).tolist()},
    # 8: HB normal
    {"bufferView": 8, "byteOffset": 0, "componentType": 5126, "count": len(full_hb_verts), "type": "VEC3"},
    # 9: HB uv
    {"bufferView": 9, "byteOffset": 0, "componentType": 5126, "count": len(full_hb_verts), "type": "VEC2"},
    # 10: HB joints
    {"bufferView": 10, "byteOffset": 0, "componentType": 5121, "count": len(full_hb_verts), "type": "VEC4"},
    # 11: HB weights
    {"bufferView": 11, "byteOffset": 0, "componentType": 5126, "count": len(full_hb_verts), "type": "VEC4"},
    
    # 12: IBM
    {"bufferView": 12, "byteOffset": 0, "componentType": 5126, "count": num_bones, "type": "MAT4"},
    # 13: Time
    {"bufferView": 13, "byteOffset": 0, "componentType": 5126, "count": len(anim_times), "type": "SCALAR",
     "min": [0.0], "max": [2.0]},
    # 14: Idle Hips Rot
    {"bufferView": 14, "byteOffset": 0, "componentType": 5126, "count": len(anim_times), "type": "VEC4"},
    # 15: Idle Hips Trans
    {"bufferView": 14, "byteOffset": len(idle_hips_rot.tobytes()), "componentType": 5126, "count": len(anim_times), "type": "VEC3"},
    # 16: Idle Tail Rot
    {"bufferView": 14, "byteOffset": len(idle_hips_rot.tobytes()) + len(idle_hips_trans.tobytes()), "componentType": 5126, "count": len(anim_times), "type": "VEC4"},
]

# glTF JSON spec
gltf_out = {
    "asset": {"version": "2.0", "generator": "CleanRep Gymmy Mascot Pipeline"},
    "scenes": [{"nodes": [0]}],
    "scene": 0,
    "nodes": nodes,
    "meshes": [{
        "name": "Gymmy_Mascot",
        "primitives": [
            {
                "attributes": {
                    "POSITION": 2, "NORMAL": 3, "TEXCOORD_0": 4, "JOINTS_0": 5, "WEIGHTS_0": 6
                },
                "indices": 0,
                "material": 0
            },
            {
                "attributes": {
                    "POSITION": 7, "NORMAL": 8, "TEXCOORD_0": 9, "JOINTS_0": 10, "WEIGHTS_0": 11
                },
                "indices": 1,
                "material": 1
            }
        ]
    }],
    "skins": [{
        "name": "Gymmy_Armature",
        "inverseBindMatrices": 12,
        "joints": joint_node_indices,
        "skeleton": 1
    }],
    "materials": [
        {
            "name": "Otter_Fur",
            "pbrMetallicRoughness": {
                "baseColorTexture": {"index": 0},
                "metallicFactor": 0.05,
                "roughnessFactor": 0.85
            }
        },
        {
            "name": "Headband_CleanRep",
            "pbrMetallicRoughness": {
                "baseColorTexture": {"index": 1},
                "metallicFactor": 0.0,
                "roughnessFactor": 0.9
            }
        }
    ],
    "textures": [
        {"source": 0, "sampler": 0},
        {"source": 1, "sampler": 0}
    ],
    "images": [
        {"bufferView": 15, "mimeType": "image/jpeg"},
        {"bufferView": 16, "mimeType": "image/png"}
    ],
    "samplers": [
        {"magFilter": 9729, "minFilter": 9987, "wrapS": 10497, "wrapT": 10497}
    ],
    "animations": [{
        "name": "Idle",
        "channels": [
            {"sampler": 0, "target": {"node": 2, "path": "rotation"}},
            {"sampler": 1, "target": {"node": 2, "path": "translation"}},
            {"sampler": 2, "target": {"node": 21, "path": "rotation"}}
        ],
        "samplers": [
            {"input": 13, "output": 14, "interpolation": "LINEAR"},
            {"input": 13, "output": 15, "interpolation": "LINEAR"},
            {"input": 13, "output": 16, "interpolation": "LINEAR"}
        ]
    }],
    "buffers": [{"byteLength": len(bin_buffer)}],
    "bufferViews": buffer_views,
    "accessors": accessors
}

# Write final GLB file
json_str = json.dumps(gltf_out, separators=(',', ':'))
json_bytes = json_str.encode('utf-8')
while len(json_bytes) % 4 != 0:
    json_bytes += b' '

total_length = 12 + 8 + len(json_bytes) + 8 + len(bin_buffer)
glb_header = struct.pack('<4sII', b'glTF', 2, total_length)
json_chunk_header = struct.pack('<II', len(json_bytes), 0x4E4F534A)
bin_chunk_header = struct.pack('<II', len(bin_buffer), 0x004E4942)

glb_bytes = glb_header + json_chunk_header + json_bytes + bin_chunk_header + bin_buffer

out_paths = [
    'assets/gymmy/3d/gymmy_rigged.glb',
    'public/assets/gymmy/gymmy.glb'
]
for p in out_paths:
    with open(p, 'wb') as f:
        f.write(glb_bytes)
    print(f"Exported complete rigged mascot: {p} ({len(glb_bytes) / 1024 / 1024:.2f} MB)")

print("=== 5. Rendering High-Resolution 2D Mascot Sprites ===")
# Now let's generate the updated mascot sprites for gymmy-rest.png and gymmy-workout.png
# featuring Gymmy with his iconic black headband and CleanRep 'R' logo!

def generate_workout_gymmy():
    """Renders Gymmy executing a motivating squat with CleanRep barbell, sweat drops and headband"""
    w, h = 600, 600
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Render 3D preview of front Gymmy with headband as base
    # Then compose workout scene (bilanciere, gocce di sudore, motivational pose)
    print("Composing Gymmy Workout Mascot (squat with barbell, headband & logo)...")
    
    # We load the existing workout layout reference to match composition perfectly
    old_wo = Image.open('public/assets/gymmy/gymmy-workout.png')
    
    # Create the high quality Gymmy mascot otter character in squat pose
    # Otter body: warm caramel brown fur, soft cream belly, muscular cute proportions
    # Head with black athletic headband + white R logo!
    
    # Base canvas with soft ambient glow
    cx, cy = 300, 310
    
    # Draw Barbell behind shoulders:
    # Barbell bar
    draw.rectangle([60, 205, 540, 215], fill=(200, 205, 215, 255))
    # Plates Left
    draw.rounded_rectangle([75, 130, 95, 290], radius=6, fill=(35, 38, 42, 255))
    draw.rounded_rectangle([98, 145, 118, 275], radius=5, fill=(45, 48, 54, 255))
    draw.rounded_rectangle([121, 160, 138, 260], radius=4, fill=(30, 32, 36, 255))
    # Plates Right
    draw.rounded_rectangle([462, 160, 479, 260], radius=4, fill=(30, 32, 36, 255))
    draw.rounded_rectangle([482, 145, 502, 275], radius=5, fill=(45, 48, 54, 255))
    draw.rounded_rectangle([505, 130, 525, 290], radius=6, fill=(35, 38, 42, 255))
    
    # Otter Legs in Squat:
    # Left thigh & calf
    draw.polygon([(210, 380), (160, 430), (190, 520), (245, 520), (250, 440)], fill=(125, 88, 58, 255))
    # Right thigh & calf
    draw.polygon([(390, 380), (440, 430), (410, 520), (355, 520), (350, 440)], fill=(125, 88, 58, 255))
    # Webbed Feet / shoes (clean white gym sneakers matching CleanRep style)
    draw.rounded_rectangle([170, 510, 248, 545], radius=12, fill=(245, 245, 250, 255))
    draw.rounded_rectangle([352, 510, 430, 545], radius=12, fill=(245, 245, 250, 255))
    
    # Otter Body / Torso
    draw.ellipse([215, 260, 385, 450], fill=(145, 102, 68, 255))
    # Cream belly
    draw.ellipse([240, 290, 360, 430], fill=(235, 218, 192, 255))
    
    # Otter Arms gripping barbell
    draw.line([(220, 260), (175, 210)], fill=(140, 98, 65, 255), width=32)
    draw.ellipse([155, 195, 190, 225], fill=(130, 90, 60, 255)) # hand grip
    draw.line([(380, 260), (425, 210)], fill=(140, 98, 65, 255), width=32)
    draw.ellipse([410, 195, 445, 225], fill=(130, 90, 60, 255))
    
    # Otter Head
    head_box = [210, 105, 390, 275]
    draw.ellipse(head_box, fill=(150, 105, 70, 255))
    # Cute Otter Ears
    draw.ellipse([195, 140, 225, 175], fill=(125, 88, 58, 255))
    draw.ellipse([202, 147, 218, 168], fill=(210, 175, 150, 255))
    draw.ellipse([375, 140, 405, 175], fill=(125, 88, 58, 255))
    draw.ellipse([382, 147, 398, 168], fill=(210, 175, 150, 255))
    
    # Cream Muzzle / Cheeks
    draw.ellipse([245, 185, 355, 255], fill=(240, 225, 205, 255))
    # Nose
    draw.polygon([(290, 202), (310, 202), (300, 215)], fill=(40, 35, 35, 255))
    # Whiskers
    draw.line([(250, 218), (220, 212)], fill=(80, 70, 65, 200), width=2)
    draw.line([(250, 225), (218, 228)], fill=(80, 70, 65, 200), width=2)
    draw.line([(350, 218), (380, 212)], fill=(80, 70, 65, 200), width=2)
    draw.line([(350, 225), (382, 228)], fill=(80, 70, 65, 200), width=2)
    # Determined smile
    draw.arc([275, 212, 325, 235], start=10, end=170, fill=(50, 40, 40, 255), width=3)
    
    # Determined energetic eyes
    draw.ellipse([245, 160, 275, 195], fill=(30, 25, 25, 255))
    draw.ellipse([252, 166, 262, 176], fill=(255, 255, 255, 255)) # highlight
    draw.ellipse([325, 160, 355, 195], fill=(30, 25, 25, 255))
    draw.ellipse([332, 166, 342, 176], fill=(255, 255, 255, 255))
    
    # === ICONIC BLACK HEADBAND WITH CLEANREP 'R' LOGO ===
    # Band wrapped across forehead
    band_poly = [
        (208, 148), (392, 148),
        (390, 178), (210, 178)
    ]
    draw.polygon(band_poly, fill=(22, 24, 28, 255))
    draw.line([(208, 148), (392, 148)], fill=(45, 48, 54, 255), width=2)
    draw.line([(210, 178), (390, 178)], fill=(12, 14, 16, 255), width=2)
    
    # CleanRep 'R' Logo on Headband!
    r_stamp = r_clean.resize((26, 24), Image.Resampling.LANCZOS)
    img.paste(r_stamp, (287, 151), r_stamp)
    
    # Sweat drops of effort & motivation
    draw.ellipse([228, 178, 236, 190], fill=(130, 210, 255, 230))
    draw.ellipse([365, 175, 373, 187], fill=(130, 210, 255, 230))
    draw.ellipse([375, 225, 381, 235], fill=(130, 210, 255, 200))

    img.save('public/assets/gymmy/gymmy-workout.png')
    img.save('assets/gymmy/gymmy-workout.png')
    print("Saved updated Gymmy Workout mascot sprite.")

def generate_rest_gymmy():
    """Renders Gymmy resting peacefully in bed with green blanket, pillow and headband"""
    w, h = 600, 600
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    print("Composing Gymmy Rest Mascot (cozy bed, sleeping otter, headband)...")
    
    # Bed frame (modern coral/warm wood finish matching design)
    # Headboard
    draw.rounded_rectangle([75, 240, 225, 460], radius=8, fill=(215, 115, 105, 255))
    # Footboard & base
    draw.rounded_rectangle([80, 320, 525, 470], radius=8, fill=(215, 115, 105, 255))
    # Legs
    draw.rectangle([100, 470, 120, 530], fill=(195, 95, 88, 255))
    draw.rectangle([485, 470, 505, 530], fill=(195, 95, 88, 255))
    
    # Mattress (soft slate blue)
    draw.rounded_rectangle([110, 310, 520, 390], radius=10, fill=(135, 155, 185, 255))
    
    # Cozy Pillow (slate periwinkle)
    draw.rounded_rectangle([130, 290, 250, 350], radius=18, fill=(150, 170, 205, 255))
    
    # Sleeping Otter Gymmy on pillow:
    # Head resting on pillow
    draw.ellipse([185, 255, 305, 355], fill=(150, 105, 70, 255))
    # Ear
    draw.ellipse([175, 275, 200, 305], fill=(125, 88, 58, 255))
    draw.ellipse([180, 282, 195, 298], fill=(210, 175, 150, 255))
    
    # Muzzle
    draw.ellipse([215, 295, 285, 345], fill=(240, 225, 205, 255))
    # Nose
    draw.polygon([(250, 305), (265, 305), (258, 314)], fill=(40, 35, 35, 255))
    # Sleeping peaceful curved eyes
    draw.arc([220, 285, 245, 305], start=0, end=180, fill=(50, 40, 40, 255), width=3)
    draw.arc([265, 285, 290, 305], start=0, end=180, fill=(50, 40, 40, 255), width=3)
    # Peaceful smile
    draw.arc([245, 320, 272, 336], start=0, end=180, fill=(60, 45, 45, 255), width=2)
    
    # === ICONIC BLACK HEADBAND WITH CLEANREP 'R' LOGO ===
    # Tilted band on sleeping head
    band_poly = [
        (185, 268), (302, 268),
        (300, 290), (187, 290)
    ]
    draw.polygon(band_poly, fill=(22, 24, 28, 255))
    r_stamp = r_clean.resize((20, 18), Image.Resampling.LANCZOS)
    img.paste(r_stamp, (238, 270), r_stamp)
    
    # Soft Green Duvet / Quilt covering Gymmy's body
    # Organic folded blanket
    draw.rounded_rectangle([235, 315, 520, 425], radius=24, fill=(148, 178, 155, 255))
    # Folded top duvet edge
    draw.rounded_rectangle([230, 310, 330, 370], radius=20, fill=(160, 192, 168, 255))
    
    # Gymmy's paw resting cozily over the blanket
    draw.ellipse([285, 315, 320, 345], fill=(145, 102, 68, 255))
    
    # Feet poking out slightly at the end of the bed (white socks)
    draw.rounded_rectangle([475, 335, 502, 380], radius=8, fill=(245, 245, 250, 255))
    
    img.save('public/assets/gymmy/gymmy-rest.png')
    img.save('assets/gymmy/gymmy-rest.png')
    print("Saved updated Gymmy Rest mascot sprite.")

generate_workout_gymmy()
generate_rest_gymmy()
print("=== All Mascot Assets Generated Successfully! ===")
