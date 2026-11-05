import trimesh
import numpy as np
from PIL import Image

print("Loading newly exported gymmy.glb...")
scene = trimesh.load('public/assets/gymmy/gymmy.glb')
print("Geometries in scene:", scene.geometry.keys())

# Render quick orthographic view with colors to verify headband and otter shape
# Let's inspect each geometry in scene:
geoms = list(scene.geometry.values())
for i, g in enumerate(geoms):
    print(f"Geom {i}: vertices={len(g.vertices)}, faces={len(g.faces)}, bounds={g.bounds}")

# Concatenate for visual preview
combined = scene.to_geometry()
if isinstance(combined, list):
    otter = combined[0]
    headband = combined[1] if len(combined) > 1 else None
else:
    otter = combined
    headband = None

print("Otter vertices:", len(otter.vertices), "bounds:", otter.bounds)
if headband:
    print("Headband vertices:", len(headband.vertices), "bounds:", headband.bounds)

# Quick software render of the head region (front, 3/4, side, back)
v = otter.vertices
n = otter.vertex_normals
mask = v[:, 1] > 0.45
head_v = v[mask]
head_n = n[mask]
head_c = np.tile([135, 95, 65], (len(head_v), 1))

if headband:
    hb_v = headband.vertices
    hb_n = headband.vertex_normals
    # sample headband texture
    tex = Image.open('assets/gymmy/3d/headband_tex.png')
    tw, th = tex.size
    hb_c = []
    for uv in headband.visual.uv:
        px = int(np.clip(uv[0] * tw, 0, tw - 1))
        py = int(np.clip((1.0 - uv[1]) * th, 0, th - 1))
        hb_c.append(tex.getpixel((px, py))[:3])
    hb_c = np.array(hb_c)
    
    all_v = np.vstack([head_v, hb_v])
    all_n = np.vstack([head_n, hb_n])
    all_c = np.vstack([head_c, hb_c])
else:
    all_v = head_v
    all_n = head_n
    all_c = head_c

def render_test(coords_x, coords_y, depths, normals_view, colors, w=600, h=600, filename="test.png"):
    img = np.zeros((h, w, 3), dtype=np.uint8)
    cx = (coords_x.min() + coords_x.max()) / 2
    cy = (coords_y.min() + coords_y.max()) / 2
    span = max(coords_x.max() - coords_x.min(), coords_y.max() - coords_y.min()) * 1.08
    scale = (w - 40) / span
    
    px = ((coords_x - cx) * scale + w / 2).astype(int)
    py = (h / 2 - (coords_y - cy) * scale).astype(int)
    
    valid = (px >= 0) & (px < w) & (py >= 0) & (py < h)
    px = px[valid]
    py = py[valid]
    d = depths[valid]
    nv = normals_view[valid]
    c = colors[valid]
    
    light = np.array([0.2, 0.4, 0.9])
    light /= np.linalg.norm(light)
    diff = np.maximum(0.25, np.sum(nv * light, axis=1, keepdims=True))
    shaded = np.clip(c * diff * 1.25, 0, 255).astype(np.uint8)
    
    order = np.argsort(d)
    img[py[order], px[order]] = shaded[order]
    Image.fromarray(img).save(filename)
    print(f"Saved {filename}")

# Front
render_test(all_v[:, 0], all_v[:, 1], all_v[:, 2], all_n, all_c, filename="assets/gymmy/verif_front.png")

# 3/4
cos_a = np.cos(np.radians(35))
sin_a = np.sin(np.radians(35))
x_34 = all_v[:, 0] * cos_a + all_v[:, 2] * sin_a
z_34 = -all_v[:, 0] * sin_a + all_v[:, 2] * cos_a
nx_34 = all_n[:, 0] * cos_a + all_n[:, 2] * sin_a
render_test(x_34, all_v[:, 1], z_34,
            np.column_stack([nx_34, all_n[:, 1], all_n[:, 2]]),
            all_c, filename="assets/gymmy/verif_34.png")

# Back
render_test(-all_v[:, 0], all_v[:, 1], -all_v[:, 2],
            np.column_stack([-all_n[:, 0], all_n[:, 1], -all_n[:, 2]]),
            all_c, filename="assets/gymmy/verif_back.png")

