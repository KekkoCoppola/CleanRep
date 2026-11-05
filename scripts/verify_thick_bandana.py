import trimesh
import numpy as np
from PIL import Image

print("=== Checking Collisions and Clearances ===")
scene = trimesh.load('public/assets/gymmy/gymmy.glb')

t_otter, g_otter = scene.graph.get('node_0')
otter = scene.geometry[g_otter].copy().apply_transform(t_otter)

t_hb, g_hb = scene.graph.get('Headband_Node')
hb = scene.geometry[g_hb].copy().apply_transform(t_hb)

ov = otter.vertices
hv = hb.vertices

# Isolate headband Y range
min_y, max_y = hv[:, 1].min() - 0.005, hv[:, 1].max() + 0.005
head_mask = (ov[:, 1] >= min_y) & (ov[:, 1] <= max_y) & (ov[:, 2] > -0.05)
head_pts = ov[head_mask]

print(f"Head vertices in bandana height window: {len(head_pts)}")

# For each head vertex, check distance to headband inner surface
# Cylinder coordinates relative to center (0.0, 0.065)
xc, zc = 0.0, 0.065
head_r = np.sqrt((head_pts[:, 0] - xc)**2 + (head_pts[:, 2] - zc)**2)
head_theta = np.arctan2(head_pts[:, 0] - xc, head_pts[:, 2] - zc)

# Sample inner surface of headband (first N_H * N_COLS vertices are outer, second N_H * N_COLS are inner)
N_ANGLES = 128
N_H = 14
N_COLS = N_ANGLES + 1
inner_verts = hv[N_H * N_COLS : 2 * N_H * N_COLS]
inner_r = np.sqrt((inner_verts[:, 0] - xc)**2 + (inner_verts[:, 2] - zc)**2)
inner_theta = np.arctan2(inner_verts[:, 0] - xc, inner_verts[:, 2] - zc)

# Check closest inner point for head vertices
# Head vertices should all be INSIDE the inner wall (head_r < inner_r at matching theta and y)
collision_count = 0
min_clearance = 999.0
for p in head_pts:
    py = p[1]
    ptheta = np.arctan2(p[0] - xc, p[2] - zc)
    pr = np.sqrt((p[0] - xc)**2 + (p[2] - zc)**2)
    
    # find near inner verts
    near_mask = (np.abs(inner_verts[:, 1] - py) < 0.003) & (np.abs(inner_theta - ptheta) < 0.05)
    if np.any(near_mask):
        match_r = np.mean(inner_r[near_mask])
        clearance = match_r - pr
        if clearance < min_clearance:
            min_clearance = clearance
        if clearance < 0: # Fur is outside inner surface of bandana -> collision!
            collision_count += 1

print(f"Min Clearance between Fur and Headband Inner Wall: {min_clearance * 1000:.2f} mm")
print(f"Fur vertices clipping through headband: {collision_count}")
if collision_count == 0:
    print("SUCCESS: 0 COLLISIONS! Fur is completely inside headband!")
else:
    print(f"WARNING: {collision_count} vertices clipping!")

