import trimesh
import numpy as np
from PIL import Image

scene = trimesh.load('assets/gymmy/3d/source/pool2370.glb')
mesh = scene.to_geometry()
if isinstance(mesh, list):
    mesh = mesh[0]

v = np.asarray(mesh.vertices)
n = np.asarray(mesh.vertex_normals)

head_mask = v[:, 1] > 0.48
hv = v[head_mask]
hn = n[head_mask]

# Head center in XZ plane
xc = 0.0
zc = 0.075

# Let's inspect outer radius as a function of theta for the headband height (Y ~ 0.585)
N_ANGLES = 96
N_HEIGHTS = 8
BAND_HEIGHT = 0.026

thetas = np.linspace(0, 2 * np.pi, N_ANGLES, endpoint=False)
# Athletic tilt: forehead (theta=0) slightly higher than back (theta=pi)
y_centers = 0.588 + 0.012 * np.cos(thetas)

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
        yc = y_centers[a_idx] + dh
        
        # Filter vertices within a thin horizontal slice around yc
        slice_mask = np.abs(hv[:, 1] - yc) < 0.012
        slice_pts = hv[slice_mask]
        
        # Compute angles from (xc, zc)
        angles = np.arctan2(slice_pts[:, 0] - xc, slice_pts[:, 2] - zc)
        
        # Angular difference to theta
        diff = np.abs(np.arctan2(np.sin(angles - theta), np.cos(angles - theta)))
        wedge_mask = diff < 0.08 # ~4.5 degrees
        
        wedge_pts = slice_pts[wedge_mask]
        if len(wedge_pts) > 0:
            radii = np.sqrt((wedge_pts[:, 0] - xc)**2 + (wedge_pts[:, 2] - zc)**2)
            max_r = np.max(radii)
        else:
            max_r = 0.085
            
        # Place headband 3.5 mm outside the fur surface
        band_r = max_r + 0.0035
        bx = xc + band_r * np.sin(theta)
        bz = zc + band_r * np.cos(theta)
        by = yc
        
        # Outward normal
        norm = np.array([np.sin(theta), 0.1 * np.cos(theta), np.cos(theta)])
        norm /= np.linalg.norm(norm)
        
        # UV coordinate: front theta=0 is U=0.5
        angle_sym = theta if theta <= np.pi else theta - 2 * np.pi
        u = (angle_sym / (2 * np.pi)) + 0.5
        
        v_row.append([bx, by, bz])
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

# Knot at back center (theta = pi)
back_center = hb_verts[(N_HEIGHTS // 2) * N_ANGLES + N_ANGLES // 2]
back_norm = hb_normals[(N_HEIGHTS // 2) * N_ANGLES + N_ANGLES // 2]

knot = trimesh.creation.icosphere(radius=0.008, subdivisions=2)
knot.vertices[:, 0] *= 1.4
knot.vertices[:, 1] *= 1.2
knot.vertices[:, 2] *= 0.8
knot.vertices += back_center + back_norm * 0.003
knot_uv = np.full((len(knot.vertices), 2), [0.05, 0.5])
knot_faces = knot.faces + len(hb_verts)

# Ribbons
def make_ribbon(sign=1.0, base_idx=0):
    r_v = []
    r_uv = []
    r_f = []
    n_seg = 6
    for s in range(n_seg + 1):
        t = s / n_seg
        ry = back_center[1] - t * 0.038
        rz = back_center[2] - 0.003 - t * 0.008
        rx = back_center[0] + sign * (0.005 + t * 0.014)
        rw = 0.007 * (1.0 - t * 0.25)
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

full_hb_verts = np.vstack([hb_verts, knot.vertices, r_v1, r_v2]).astype(np.float32)
full_hb_uvs = np.vstack([hb_uvs, knot_uv, r_uv1, r_uv2]).astype(np.float32)
full_hb_faces = np.vstack([hb_faces, knot_faces, r_f1, r_f2]).astype(np.uint32)
full_hb_mesh = trimesh.Trimesh(vertices=full_hb_verts, faces=full_hb_faces, process=False)

print(f"Generated snug headband: {len(full_hb_verts)} verts, bounds: {full_hb_mesh.bounds}")

# Load headband texture
tex = Image.open('assets/gymmy/3d/headband_tex.png')
tw, th = tex.size
hb_colors = []
for uv in full_hb_uvs:
    px = int(np.clip(uv[0] * tw, 0, tw - 1))
    py = int(np.clip((1.0 - uv[1]) * th, 0, th - 1))
    hb_colors.append(tex.getpixel((px, py))[:3])
hb_colors = np.array(hb_colors)

# Render test preview
all_v = np.vstack([hv, full_hb_verts])
all_n = np.vstack([hn, full_hb_mesh.vertex_normals])
col_otter = np.tile([135, 95, 65], (len(hv), 1))
all_c = np.vstack([col_otter, hb_colors])

def render_preview(coords_x, coords_y, depths, normals_view, colors, w=600, h=600, filename="preview.png"):
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

render_preview(all_v[:, 0], all_v[:, 1], all_v[:, 2], all_n, all_c, filename="assets/gymmy/snug_front.png")

cos_a = np.cos(np.radians(35))
sin_a = np.sin(np.radians(35))
x_34 = all_v[:, 0] * cos_a + all_v[:, 2] * sin_a
z_34 = -all_v[:, 0] * sin_a + all_v[:, 2] * cos_a
nx_34 = all_n[:, 0] * cos_a + all_n[:, 2] * sin_a
render_preview(x_34, all_v[:, 1], z_34,
            np.column_stack([nx_34, all_n[:, 1], all_n[:, 2]]),
            all_c, filename="assets/gymmy/snug_34.png")

render_preview(-all_v[:, 0], all_v[:, 1], -all_v[:, 2],
            np.column_stack([-all_n[:, 0], all_n[:, 1], -all_n[:, 2]]),
            all_c, filename="assets/gymmy/snug_back.png")

