import trimesh
import numpy as np
from PIL import Image

scene = trimesh.load('assets/gymmy/3d/source/pool2370.glb')
mesh = scene.to_geometry()
if isinstance(mesh, list):
    mesh = mesh[0]

v = np.asarray(mesh.vertices)
normals = np.asarray(mesh.vertex_normals)

# Filter for head: Y > 0.48
mask = v[:, 1] > 0.48
hv = v[mask]
hn = normals[mask]

def render_closeup(coords_x, coords_y, depths, normals_view, w=600, h=600, filename="head.png"):
    img = np.zeros((h, w, 3), dtype=np.uint8)
    
    # bounds
    cx = (coords_x.min() + coords_x.max()) / 2
    cy = (coords_y.min() + coords_y.max()) / 2
    span = max(coords_x.max() - coords_x.min(), coords_y.max() - coords_y.min()) * 1.1
    scale = (w - 40) / span
    
    px = ((coords_x - cx) * scale + w / 2).astype(int)
    py = (h / 2 - (coords_y - cy) * scale).astype(int)
    
    valid = (px >= 0) & (px < w) & (py >= 0) & (py < h)
    px = px[valid]
    py = py[valid]
    d = depths[valid]
    nv = normals_view[valid]
    
    # Simple directional lighting: light from [0.3, 0.5, 0.8]
    light = np.array([0.2, 0.4, 0.9])
    light /= np.linalg.norm(light)
    
    # Lambertian diffuse + ambient
    diff = np.maximum(0, np.sum(nv * light, axis=1))
    shade = np.clip(diff * 180 + 50, 0, 255).astype(np.uint8)
    
    order = np.argsort(d)
    img[py[order], px[order]] = np.stack([shade[order], shade[order], shade[order]], axis=1)
    Image.fromarray(img).save(filename)
    print(f"Saved {filename}")

# Front view of head (X, Y, Z)
render_closeup(hv[:, 0], hv[:, 1], hv[:, 2], hn, filename="assets/gymmy/head_front.png")

# Right profile view (Z, Y, -X)
render_closeup(hv[:, 2], hv[:, 1], -hv[:, 0], np.column_stack([hn[:, 2], hn[:, 1], -hn[:, 0]]), filename="assets/gymmy/head_profile.png")

# 3/4 view
cos_a = np.cos(np.radians(35))
sin_a = np.sin(np.radians(35))
x_34 = hv[:, 0] * cos_a + hv[:, 2] * sin_a
z_34 = -hv[:, 0] * sin_a + hv[:, 2] * cos_a
nx_34 = hn[:, 0] * cos_a + hn[:, 2] * sin_a
render_closeup(x_34, hv[:, 1], z_34, np.column_stack([nx_34, hn[:, 1], hn[:, 2]]), filename="assets/gymmy/head_34.png")
