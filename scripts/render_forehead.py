import trimesh
import numpy as np
from PIL import Image

scene = trimesh.load('public/assets/gymmy/gymmy.glb')

t_otter, g_otter = scene.graph.get('node_0')
otter = scene.geometry[g_otter].copy().apply_transform(t_otter)

t_hb, g_hb = scene.graph.get('Headband_Node')
hb = scene.geometry[g_hb].copy().apply_transform(t_hb)

print("Otter bounds:", otter.bounds)
print("Headband bounds:", hb.bounds)

# Sample texture for headband
tex = Image.open('assets/gymmy/3d/headband_snug_tex.png')
tw, th = tex.size

# Triangle rasterizer for headband
w, h = 800, 800
img = np.zeros((h, w, 3), dtype=np.uint8)
z_buf = np.full((h, w), -1e9, dtype=np.float32)

# Camera projection: looking at forehead center (0, 0.60, 0.12)
cam_target = np.array([0.0, 0.585, 0.08])
scale = 2600.0 # close-up zoom

def project(pts):
    px = ((pts[:, 0] - cam_target[0]) * scale + w / 2).astype(np.int32)
    py = (h / 2 - (pts[:, 1] - cam_target[1]) * scale).astype(np.int32)
    pz = pts[:, 2]
    return px, py, pz

# Render Otter head surface points first (for context)
v_o = otter.vertices
mask_o = (v_o[:, 1] > 0.52) & (v_o[:, 2] > -0.02)
pts_o = v_o[mask_o]
px_o, py_o, pz_o = project(pts_o)
valid_o = (px_o >= 0) & (px_o < w) & (py_o >= 0) & (py_o < h)
px_o = px_o[valid_o]
py_o = py_o[valid_o]
pz_o = pz_o[valid_o]

for x, y, z in zip(px_o, py_o, pz_o):
    if z > z_buf[y, x]:
        z_buf[y, x] = z
        # Warm brown fur
        img[y, x] = [135, 95, 65]

# Render Headband triangles:
# Rasterize headband faces
hb_v = hb.vertices
hb_uv = hb.visual.uv
hb_f = hb.faces

px_hb, py_hb, pz_hb = project(hb_v)

for tri in hb_f:
    p0, p1, p2 = tri
    x0, y0, z0 = px_hb[p0], py_hb[p0], pz_hb[p0]
    x1, y1, z1 = px_hb[p1], py_hb[p1], pz_hb[p1]
    x2, y2, z2 = px_hb[p2], py_hb[p2], pz_hb[p2]
    
    # Bounding box of triangle
    min_x = max(0, min(x0, x1, x2))
    max_x = min(w - 1, max(x0, x1, x2))
    min_y = max(0, min(y0, y1, y2))
    max_y = min(h - 1, max(y0, y1, y2))
    
    if min_x > max_x or min_y > max_y:
        continue
        
    denom = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2)
    if abs(denom) < 1e-5:
        continue
        
    uv0, uv1, uv2 = hb_uv[p0], hb_uv[p1], hb_uv[p2]
    
    # Average normal for lighting
    normal = np.cross(hb_v[p1] - hb_v[p0], hb_v[p2] - hb_v[p0])
    norm_len = np.linalg.norm(normal)
    if norm_len < 1e-6:
        continue
    normal /= norm_len
    light = np.array([0.2, 0.4, 0.9])
    light /= np.linalg.norm(light)
    diff = max(0.25, np.dot(normal, light))
    
    # Sample center UV color for triangle
    uv_c = (uv0 + uv1 + uv2) / 3.0
    tx = int(np.clip(uv_c[0] * tw, 0, tw - 1))
    ty = int(np.clip((1.0 - uv_c[1]) * th, 0, th - 1))
    base_color = np.array(tex.getpixel((tx, ty))[:3], dtype=np.float32)
    color = np.clip(base_color * diff * 1.3, 0, 255).astype(np.uint8)
    
    for y in range(min_y, max_y + 1):
        for x in range(min_x, max_x + 1):
            w0 = ((y1 - y2) * (x - x2) + (x2 - x1) * (y - y2)) / denom
            w1 = ((y2 - y0) * (x - x2) + (x0 - x2) * (y - y2)) / denom
            w2 = 1.0 - w0 - w1
            if w0 >= 0 and w1 >= 0 and w2 >= 0:
                z = w0 * z0 + w1 * z1 + w2 * z2
                if z > z_buf[y, x]:
                    z_buf[y, x] = z
                    img[y, x] = color

Image.fromarray(img).save('assets/gymmy/render_forehead_check.png')
print("Saved assets/gymmy/render_forehead_check.png")
