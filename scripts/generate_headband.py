import trimesh
import numpy as np
from PIL import Image, ImageOps
from scipy.spatial import cKDTree

print("Loading otter mesh...")
scene = trimesh.load('assets/gymmy/3d/source/pool2370.glb')
mesh = scene.to_geometry()
if isinstance(mesh, list):
    mesh = mesh[0]

v = np.asarray(mesh.vertices)
n = np.asarray(mesh.vertex_normals)

# Head vertices
head_mask = v[:, 1] > 0.48
hv = v[head_mask]
hn = n[head_mask]
tree = cKDTree(hv)

# Headband parameters
# The band loops around the head.
# Angle theta: 0 is front (+Z), pi/2 is left (-X), pi is back (-Z), 3pi/2 is right (+X)
# Wait, let's use standard theta:
# X = R * sin(theta), Z = Z_center + R * cos(theta)
# theta = 0 -> front (+Z)
# theta = pi/2 -> right (+X)
# theta = pi -> back (-Z)
# theta = 3pi/2 -> left (-X)

N_ANGLES = 96
N_HEIGHTS = 8  # segments across band height
BAND_HEIGHT = 0.024  # vertical height of headband

thetas = np.linspace(0, 2 * np.pi, N_ANGLES, endpoint=False)

# The center of the head slice:
# Front forehead is slightly higher than back of head to give athletic tilt as in sketch
# Front (theta=0): Y = 0.592, Z_center = 0.075
# Back (theta=pi): Y = 0.570, Z_center = 0.075
y_centers = 0.581 + 0.011 * np.cos(thetas)
z_center = 0.075

# For each angle and height step, find the surface point
band_verts = []
band_uvs = []
band_normals = []

height_offsets = np.linspace(-BAND_HEIGHT / 2, BAND_HEIGHT / 2, N_HEIGHTS)

# Precompute outer surface loop for each height
for h_idx, dh in enumerate(height_offsets):
    v_row = []
    uv_row = []
    norm_row = []
    v_norm = h_idx / (N_HEIGHTS - 1)  # 0 to 1
    
    for a_idx, theta in enumerate(thetas):
        # Ray direction from head center in XZ plane
        dx = np.sin(theta)
        dz = np.cos(theta)
        yc = y_centers[a_idx] + dh
        
        # Estimate radius around head: ~0.08 to 0.09
        # Query nearest surface vertex in that direction
        # We search points along ray from r=0.06 to r=0.12
        ray_pts = np.array([[r * dx, yc, z_center + r * dz] for r in np.linspace(0.05, 0.12, 15)])
        dists, idxs = tree.query(ray_pts)
        best_pt_idx = np.argmin(dists)
        surf_pt = hv[idxs[best_pt_idx]]
        surf_norm = hn[idxs[best_pt_idx]]
        
        # Offset slightly along surface normal so band sits cleanly on fur
        offset = 0.0022  # 2.2 mm offset
        # Smooth the outward normal slightly with ray direction
        out_dir = np.array([dx, 0.1 * np.cos(theta), dz])
        out_dir /= np.linalg.norm(out_dir)
        band_norm = surf_norm * 0.7 + out_dir * 0.3
        band_norm /= np.linalg.norm(band_norm)
        
        pos = surf_pt + band_norm * offset
        
        # UV coordinate:
        # We want the front (+Z, theta ~ 0) to be the center of the logo!
        # Let's map theta from [-pi, pi] to U in [0, 1]
        # theta in [0, 2pi):
        # theta=0 -> front -> U = 0.5
        # theta=pi -> back -> U = 0.0 and 1.0
        angle_sym = theta if theta <= np.pi else theta - 2 * np.pi
        # angle_sym is in [-pi, pi], 0 is front
        u = (angle_sym / (2 * np.pi)) + 0.5
        
        v_row.append(pos)
        uv_row.append([u, v_norm])
        norm_row.append(band_norm)
        
    band_verts.append(v_row)
    band_uvs.append(uv_row)
    band_normals.append(norm_row)

band_verts = np.array(band_verts)  # (N_HEIGHTS, N_ANGLES, 3)
band_uvs = np.array(band_uvs)      # (N_HEIGHTS, N_ANGLES, 2)
band_normals = np.array(band_normals)

# Build faces (quads split into 2 triangles)
faces = []
flat_verts = band_verts.reshape(-1, 3)
flat_uvs = band_uvs.reshape(-1, 2)
flat_normals = band_normals.reshape(-1, 3)

for h in range(N_HEIGHTS - 1):
    for a in range(N_ANGLES):
        next_a = (a + 1) % N_ANGLES
        
        i00 = h * N_ANGLES + a
        i01 = h * N_ANGLES + next_a
        i10 = (h + 1) * N_ANGLES + a
        i11 = (h + 1) * N_ANGLES + next_a
        
        faces.append([i00, i01, i11])
        faces.append([i00, i11, i10])

faces = np.array(faces)

# Add the knot at the back!
# Back is at theta = pi (a = N_ANGLES // 2)
back_center = band_verts[N_HEIGHTS // 2, N_ANGLES // 2]
back_norm = band_normals[N_HEIGHTS // 2, N_ANGLES // 2]

# Knot mesh: a small rounded cylinder / ellipsoid
knot_mesh = trimesh.creation.icosphere(radius=0.007, subdivisions=2)
# scale it: slightly wider across X, flatter in thickness
knot_mesh.vertices[:, 0] *= 1.4  # X width
knot_mesh.vertices[:, 1] *= 1.2  # Y height
knot_mesh.vertices[:, 2] *= 0.8  # Z thickness
knot_mesh.vertices += back_center + back_norm * 0.004

# Two hanging ribbon ends (flaps) from knot hanging down
def create_ribbon(sign=1.0):
    # ribbon strips hanging down and slightly outward
    r_verts = []
    r_uvs = []
    r_faces = []
    n_seg = 6
    for s in range(n_seg + 1):
        t = s / n_seg
        # curve downward (-Y) and slightly back (-Z) and slightly outward (sign * X)
        ry = back_center[1] - t * 0.035
        rz = back_center[2] - 0.003 - t * 0.006 + 0.002 * np.sin(t * np.pi)
        rx = back_center[0] + sign * (0.004 + t * 0.012)
        
        # width of ribbon
        rw = 0.006 * (1.0 - t * 0.25)
        r_verts.append([rx - rw * 0.5, ry, rz])
        r_verts.append([rx + rw * 0.5, ry, rz])
        r_uvs.append([0.05, t])
        r_uvs.append([0.15, t])
        
    for s in range(n_seg):
        p0 = s * 2
        p1 = s * 2 + 1
        p2 = (s + 1) * 2
        p3 = (s + 1) * 2 + 1
        r_faces.append([p0, p1, p3])
        r_faces.append([p0, p3, p2])
        # double sided
        r_faces.append([p0, p3, p1])
        r_faces.append([p0, p2, p3])
        
    return trimesh.Trimesh(vertices=r_verts, faces=r_faces)

ribbon_l = create_ribbon(-1.0)
ribbon_r = create_ribbon(1.0)

band_mesh = trimesh.Trimesh(vertices=flat_verts, faces=faces, vertex_normals=flat_normals)
band_mesh.visual = trimesh.visual.TextureVisuals(uv=flat_uvs)

knot_uv = np.full((len(knot_mesh.vertices), 2), 0.1)
knot_mesh.visual = trimesh.visual.TextureVisuals(uv=knot_uv)

full_headband = trimesh.util.concatenate([band_mesh, knot_mesh, ribbon_l, ribbon_r])
print("Total headband vertices:", len(full_headband.vertices), "faces:", len(full_headband.faces))

# Create texture for headband:
# Resolution: 2048 x 512
TEX_W = 2048
TEX_H = 512
headband_img = Image.new("RGBA", (TEX_W, TEX_H), (18, 18, 20, 255))  # sleek stealth dark black

# Load CleanRep logo
logo = Image.open('assets/brand/CleanRep_R.png').convert("RGBA")
# Wait, let's check cleanrep-logo-512.png as well
logo_sq = Image.open('assets/brand/cleanrep-logo-512.png').convert("RGBA")

# In cleanrep-logo-512.png, the 'R' is white on a dark rounded background.
# Let's extract the white 'R' shape cleanly:
logo_arr = np.array(logo_sq)
# Where brightness is high, it's white R
r_mask = (logo_arr[:, :, 0] > 180) & (logo_arr[:, :, 1] > 180) & (logo_arr[:, :, 2] > 180)

r_img = Image.new("RGBA", logo_sq.size, (0, 0, 0, 0))
r_data = np.zeros((logo_sq.size[1], logo_sq.size[0], 4), dtype=np.uint8)
r_data[r_mask] = [255, 255, 255, 255]
r_img = Image.fromarray(r_data)

# Scale R logo to fit front of headband
# In UV space: U = 0.5 is front center.
# We want the logo to occupy roughly U in [0.44, 0.56], height roughly 75% of headband height
target_h = int(TEX_H * 0.72)
aspect = r_img.width / r_img.height
target_w = int(target_h * aspect)
r_resized = r_img.resize((target_w, target_h), Image.Resampling.LANCZOS)

# Paste centered at U=0.5 (X = TEX_W // 2)
paste_x = (TEX_W - target_w) // 2
paste_y = (TEX_H - target_h) // 2
headband_img.paste(r_resized, (paste_x, paste_y), r_resized)

headband_img.save('assets/gymmy/headband_texture.png')
print("Saved assets/gymmy/headband_texture.png")

# Now let's render a preview of the head + headband together from front, profile, 3/4 and back!
hv_combined = np.vstack([hv, full_headband.vertices])
hn_combined = np.vstack([hn, full_headband.vertex_normals])
# Colors for preview: otter fur (warm brown), headband (dark black/white)
col_otter = np.tile([135, 95, 65], (len(hv), 1))

# For headband vertices:
hb_colors = []
for uv in full_headband.visual.uv:
    u, v_coord = uv[0], uv[1]
    px = int(np.clip(u * TEX_W, 0, TEX_W - 1))
    py = int(np.clip((1.0 - v_coord) * TEX_H, 0, TEX_H - 1))
    rgba = headband_img.getpixel((px, py))
    hb_colors.append(rgba[:3])
col_combined = np.vstack([col_otter, np.array(hb_colors)])

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

# Front preview
render_preview(hv_combined[:, 0], hv_combined[:, 1], hv_combined[:, 2], 
               hn_combined, col_combined, filename="assets/gymmy/preview_front.png")

# 3/4 preview
cos_a = np.cos(np.radians(35))
sin_a = np.sin(np.radians(35))
x_34 = hv_combined[:, 0] * cos_a + hv_combined[:, 2] * sin_a
z_34 = -hv_combined[:, 0] * sin_a + hv_combined[:, 2] * cos_a
nx_34 = hn_combined[:, 0] * cos_a + hn_combined[:, 2] * sin_a
render_preview(x_34, hv_combined[:, 1], z_34,
               np.column_stack([nx_34, hn_combined[:, 1], hn_combined[:, 2]]),
               col_combined, filename="assets/gymmy/preview_34.png")

# Back preview
render_preview(-hv_combined[:, 0], hv_combined[:, 1], -hv_combined[:, 2],
               np.column_stack([-hn_combined[:, 0], hn_combined[:, 1], -hn_combined[:, 2]]),
               col_combined, filename="assets/gymmy/preview_back.png")

