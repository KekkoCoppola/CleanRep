import trimesh
import numpy as np
from PIL import Image

scene = trimesh.load('public/assets/gymmy/gymmy.glb')

# Get world geometry for both
t_otter, g_otter = scene.graph.get('node_0')
otter_mesh = scene.geometry[g_otter].copy()
otter_mesh.apply_transform(t_otter)

t_hb, g_hb = scene.graph.get('Headband_Node')
hb_mesh = scene.geometry[g_hb].copy()
hb_mesh.apply_transform(t_hb)

print("Otter world bounds:", otter_mesh.bounds)
print("Headband world bounds:", hb_mesh.bounds)

# Let's inspect distance from headband vertices to otter head vertices:
from scipy.spatial import cKDTree
tree = cKDTree(otter_mesh.vertices)
dists, _ = tree.query(hb_mesh.vertices)
print(f"Distance from headband to otter surface: min={dists.min():.4f}, mean={dists.mean():.4f}, max={dists.max():.4f}")

# Render close-up of Head + Headband
v_o = otter_mesh.vertices
n_o = otter_mesh.vertex_normals
mask = v_o[:, 1] > 0.48
hv_o = v_o[mask]
hn_o = n_o[mask]
col_o = np.tile([135, 95, 65], (len(hv_o), 1))

# Headband colors from texture
tex = Image.open('assets/gymmy/3d/headband_tex.png')
tw, th = tex.size
hb_colors = []
for uv in hb_mesh.visual.uv:
    px = int(np.clip(uv[0] * tw, 0, tw - 1))
    py = int(np.clip((1.0 - uv[1]) * th, 0, th - 1))
    hb_colors.append(tex.getpixel((px, py))[:3])
hb_colors = np.array(hb_colors)

all_v = np.vstack([hv_o, hb_mesh.vertices])
all_n = np.vstack([hn_o, hb_mesh.vertex_normals])
all_c = np.vstack([col_o, hb_colors])

def render_view(coords_x, coords_y, depths, normals_view, colors, w=600, h=600, filename="preview.png"):
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
    diff = np.maximum(0.2, np.sum(nv * light, axis=1, keepdims=True))
    shaded = np.clip(c * diff * 1.3, 0, 255).astype(np.uint8)
    
    order = np.argsort(d)
    img[py[order], px[order]] = shaded[order]
    Image.fromarray(img).save(filename)
    print(f"Saved {filename}")

render_view(all_v[:, 0], all_v[:, 1], all_v[:, 2], all_n, all_c, filename="assets/gymmy/check_head_front.png")

cos_a = np.cos(np.radians(35))
sin_a = np.sin(np.radians(35))
x_34 = all_v[:, 0] * cos_a + all_v[:, 2] * sin_a
z_34 = -all_v[:, 0] * sin_a + all_v[:, 2] * cos_a
nx_34 = all_n[:, 0] * cos_a + all_n[:, 2] * sin_a
render_view(x_34, all_v[:, 1], z_34,
            np.column_stack([nx_34, all_n[:, 1], all_n[:, 2]]),
            all_c, filename="assets/gymmy/check_head_34.png")

render_view(-all_v[:, 0], all_v[:, 1], -all_v[:, 2],
            np.column_stack([-all_n[:, 0], all_n[:, 1], -all_n[:, 2]]),
            all_c, filename="assets/gymmy/check_head_back.png")

