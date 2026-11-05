"""
Renders pristine multi-angle views of Gymmy with the thick headband to verify fit and logo quality.
Uses exact glTF 2.0 WebGL texture coordinates.
"""
import trimesh
import numpy as np
from PIL import Image
import json
import struct

print("Loading model for rendering...")
scene = trimesh.load('public/assets/gymmy/gymmy.glb')

t_otter, g_otter = scene.graph.get('node_0')
otter = scene.geometry[g_otter].copy().apply_transform(t_otter)

t_hb, g_hb = scene.graph.get('Headband_Node')
hb = scene.geometry[g_hb].copy().apply_transform(t_hb)

# Read raw glTF UVs directly from buffer to ensure 100% faithful Three.js WebGL match
with open('public/assets/gymmy/gymmy.glb', 'rb') as f:
    glb_data = f.read()

c0_len = struct.unpack_from('<I', glb_data, 12)[0]
gltf = json.loads(glb_data[20:20 + c0_len].decode('utf-8'))
bin_data = glb_data[28 + c0_len:]

hb_mesh = [m for m in gltf['meshes'] if m.get('name') == 'Gymmy_Headband'][0]
uv_acc_idx = hb_mesh['primitives'][0]['attributes']['TEXCOORD_0']
uv_acc = gltf['accessors'][uv_acc_idx]
uv_bv = gltf['bufferViews'][uv_acc['bufferView']]
offset = uv_bv['byteOffset'] + uv_acc.get('byteOffset', 0)
count = uv_acc['count']
raw_uvs = np.array(struct.unpack_from(f'<{count*2}f', bin_data, offset), dtype=np.float32).reshape(count, 2)

tex = Image.open('assets/gymmy/3d/headband_thick_tex.png')
tw, th = tex.size

def render_view(rot_deg=0.0, cam_pos=[0.0, 0.585, 0.40], cam_target=[0.0, 0.590, 0.065], scale=2800.0, out_name="view.png"):
    w, h = 900, 900
    img = np.zeros((h, w, 3), dtype=np.uint8)
    # Background: clean modern dark gym gradient
    for y in range(h):
        val = int(20 + 16 * (y / h))
        img[y, :] = [val, val + 2, val + 6]
        
    z_buf = np.full((h, w), -1e9, dtype=np.float32)
    
    # Rotation matrix around Y axis
    rad = np.deg2rad(rot_deg)
    cos_r, sin_r = np.cos(rad), np.sin(rad)
    R = np.array([
        [cos_r, 0, sin_r],
        [0, 1, 0],
        [-sin_r, 0, cos_r]
    ])
    
    # 1. Otter vertices (dense point cloud for head fur)
    v_o = otter.vertices
    mask_o = (v_o[:, 1] > 0.48) & (v_o[:, 2] > -0.15)
    pts_o = v_o[mask_o]
    
    pts_o_c = pts_o - np.array([0.0, 0.0, 0.065])
    pts_o_rot = (pts_o_c @ R.T) + np.array([0.0, 0.0, 0.065])
    
    px_o = ((pts_o_rot[:, 0] - cam_target[0]) * scale + w / 2).astype(np.int32)
    py_o = (h / 2 - (pts_o_rot[:, 1] - cam_target[1]) * scale).astype(np.int32)
    pz_o = pts_o_rot[:, 2]
    
    valid_o = (px_o >= 0) & (px_o < w) & (py_o >= 0) & (py_o < h)
    for x, y, z, orig_pt in zip(px_o[valid_o], py_o[valid_o], pz_o[valid_o], pts_o[valid_o]):
        if z > z_buf[y, x]:
            z_buf[y, x] = z
            if orig_pt[1] < 0.56 and orig_pt[2] > 0.12:
                img[y, x] = [185, 160, 135] # muzzle/snout
            else:
                img[y, x] = [130, 90, 60] # fur brown
                
    # 2. Headband triangles with per-pixel UV sampling matching Three.js WebGL
    hb_v = hb.vertices
    hb_uv = raw_uvs
    hb_f = hb.faces
    
    hb_v_c = hb_v - np.array([0.0, 0.0, 0.065])
    hb_v_rot = (hb_v_c @ R.T) + np.array([0.0, 0.0, 0.065])
    
    px_hb = (hb_v_rot[:, 0] - cam_target[0]) * scale + w / 2
    py_hb = h / 2 - (hb_v_rot[:, 1] - cam_target[1]) * scale
    pz_hb = hb_v_rot[:, 2]
    
    light_dir = np.array([0.3, 0.5, 0.8])
    light_dir /= np.linalg.norm(light_dir)
    
    for tri in hb_f:
        p0, p1, p2 = tri
        x0, y0, z0 = px_hb[p0], py_hb[p0], pz_hb[p0]
        x1, y1, z1 = px_hb[p1], py_hb[p1], pz_hb[p1]
        x2, y2, z2 = px_hb[p2], py_hb[p2], pz_hb[p2]
        
        v0_3d, v1_3d, v2_3d = hb_v_rot[p0], hb_v_rot[p1], hb_v_rot[p2]
        norm = np.cross(v1_3d - v0_3d, v2_3d - v0_3d)
        norm_len = np.linalg.norm(norm)
        if norm_len < 1e-6:
            continue
        norm /= norm_len
        if norm[2] <= -0.05:
            continue
            
        diffuse = max(0.40, np.dot(norm, light_dir))
        
        min_x = max(0, int(min(x0, x1, x2)))
        max_x = min(w - 1, int(max(x0, x1, x2)))
        min_y = max(0, int(min(y0, y1, y2)))
        max_y = min(h - 1, int(max(y0, y1, y2)))
        
        if min_x > max_x or min_y > max_y:
            continue
            
        denom = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2)
        if abs(denom) < 1e-5:
            continue
            
        uv0, uv1, uv2 = hb_uv[p0], hb_uv[p1], hb_uv[p2]
        
        for py in range(min_y, max_y + 1):
            for px in range(min_x, max_x + 1):
                w0 = ((y1 - y2) * (px - x2) + (x2 - x1) * (py - y2)) / denom
                w1 = ((y2 - y0) * (px - x2) + (x0 - x2) * (py - y2)) / denom
                w2 = 1.0 - w0 - w1
                if w0 >= 0 and w1 >= 0 and w2 >= 0:
                    pz = w0 * z0 + w1 * z1 + w2 * z2
                    if pz > z_buf[py, px]:
                        z_buf[py, px] = pz
                        u = w0 * uv0[0] + w1 * uv1[0] + w2 * uv2[0]
                        v = w0 * uv0[1] + w1 * uv1[1] + w2 * uv2[1]
                        tx = int(np.clip(u * tw, 0, tw - 1))
                        ty = int(np.clip(v * th, 0, th - 1))
                        b_col = np.array(tex.getpixel((tx, ty))[:3], dtype=np.float32)
                        col = np.clip(b_col * diffuse * 1.35, 0, 255).astype(np.uint8)
                        img[py, px] = col
                        
    Image.fromarray(img).save(out_name)
    print(f"Saved {out_name}")

print("Rendering Front View (rot=0)...")
render_view(rot_deg=0.0, scale=2800.0, out_name="assets/gymmy/check_front.png")

print("Rendering 3/4 Perspective View (rot=-28)...")
render_view(rot_deg=-28.0, scale=2800.0, out_name="assets/gymmy/check_three_quarter.png")

print("Rendering Back View Knot & Ribbons (rot=180)...")
render_view(rot_deg=180.0, scale=2800.0, out_name="assets/gymmy/check_back.png")

print("Rendering Done!")
