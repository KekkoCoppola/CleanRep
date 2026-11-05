import trimesh
import numpy as np

scene = trimesh.load('assets/gymmy/3d/source/pool2370.glb')
mesh = scene.to_geometry()
if isinstance(mesh, list):
    mesh = mesh[0]

v = np.asarray(mesh.vertices)

# Y ranges from 0 to 0.625
# Let's inspect vertices where Y > 0.45 (neck and head)
head_mask = v[:, 1] > 0.45
head_v = v[head_mask]

print(f"Total head vertices (Y > 0.45): {len(head_v)}")
print(f"Head X range: [{head_v[:, 0].min():.4f}, {head_v[:, 0].max():.4f}]")
print(f"Head Y range: [{head_v[:, 1].min():.4f}, {head_v[:, 1].max():.4f}]")
print(f"Head Z range: [{head_v[:, 2].min():.4f}, {head_v[:, 2].max():.4f}]")

# Let's inspect slices along Y:
for y_level in np.linspace(0.48, 0.61, 14):
    slice_mask = (v[:, 1] >= y_level - 0.005) & (v[:, 1] <= y_level + 0.005)
    slice_v = v[slice_mask]
    if len(slice_v) > 0:
        print(f"Y={y_level:.3f}: count={len(slice_v)}, X=[{slice_v[:,0].min():.3f}, {slice_v[:,0].max():.3f}], Z=[{slice_v[:,2].min():.3f}, {slice_v[:,2].max():.3f}], Z_center={(slice_v[:,2].min()+slice_v[:,2].max())/2:.3f}")
