import trimesh
import numpy as np
from PIL import Image

print("Loading mesh...")
scene = trimesh.load('assets/gymmy/3d/source/pool2370.glb')
mesh = scene.to_geometry()
if isinstance(mesh, list):
    mesh = mesh[0]

print("Vertices:", len(mesh.vertices), "Faces:", len(mesh.faces))
print("Bounds min:", mesh.bounds[0])
print("Bounds max:", mesh.bounds[1])

# Let's downsample point cloud or vertices to render orthographic projections
# Front view (X vs Y, looking along Z or Z vs Y looking along X?)
# Let's check distribution of coordinates:
v = np.asarray(mesh.vertices)
print(f"X range: [{v[:, 0].min():.4f}, {v[:, 0].max():.4f}] (extent: {v[:, 0].max() - v[:, 0].min():.4f})")
print(f"Y range: [{v[:, 1].min():.4f}, {v[:, 1].max():.4f}] (extent: {v[:, 1].max() - v[:, 1].min():.4f})")
print(f"Z range: [{v[:, 2].min():.4f}, {v[:, 2].max():.4f}] (extent: {v[:, 2].max() - v[:, 2].min():.4f})")

# Let's render 3 ortho views: XY, ZY, XZ
def render_ortho(x_coords, y_coords, depths, w=512, h=512, filename="ortho.png"):
    img = np.zeros((h, w, 3), dtype=np.uint8)
    x_min, x_max = x_coords.min(), x_coords.max()
    y_min, y_max = y_coords.min(), y_coords.max()
    
    x_len = max(x_max - x_min, 1e-5)
    y_len = max(y_max - y_min, 1e-5)
    scale = min((w - 40) / x_len, (h - 40) / y_len)
    
    px = ((x_coords - (x_min + x_max)/2) * scale + w / 2).astype(int)
    py = (h / 2 - (y_coords - (y_min + y_max)/2) * scale).astype(int)
    
    valid = (px >= 0) & (px < w) & (py >= 0) & (py < h)
    px = px[valid]
    py = py[valid]
    d = depths[valid]
    
    d_range = max(d.max() - d.min(), 1e-5)
    d_norm = ((d - d.min()) / d_range * 200 + 55).astype(np.uint8)
    
    order = np.argsort(d)
    img[py[order], px[order]] = np.stack([d_norm[order], d_norm[order], d_norm[order]], axis=1)
    
    Image.fromarray(img).save(filename)
    print(f"Saved {filename}")

# Subsample vertices for fast rendering
step = 2
render_ortho(v[::step, 0], v[::step, 1], v[::step, 2], filename="assets/gymmy/view_xy.png")
render_ortho(v[::step, 2], v[::step, 1], v[::step, 0], filename="assets/gymmy/view_zy.png")
render_ortho(v[::step, 0], v[::step, 2], v[::step, 1], filename="assets/gymmy/view_xz.png")
