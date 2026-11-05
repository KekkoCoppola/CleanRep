import numpy as np

# Test bone matrix math
bones = [
    {"name": "Root", "parent": None, "pos": np.array([0.0, 0.0, 0.0])},
    {"name": "Hips", "parent": 0, "pos": np.array([0.0, 0.28, -0.03])},
    {"name": "Spine", "parent": 1, "pos": np.array([0.0, 0.38, 0.01])},
    {"name": "Chest", "parent": 2, "pos": np.array([0.0, 0.46, 0.03])},
    {"name": "Head", "parent": 3, "pos": np.array([0.0, 0.58, 0.08])},
    {"name": "Arm_L", "parent": 3, "pos": np.array([0.15, 0.46, 0.02])},
    {"name": "Hand_L", "parent": 5, "pos": np.array([0.33, 0.46, 0.02])},
]

def make_trans(v):
    m = np.eye(4, dtype=np.float32)
    m[:3, 3] = v
    return m

# Compute local translations:
local_trans = []
for i, b in enumerate(bones):
    p = b["parent"]
    if p is None:
        lt = b["pos"]
    else:
        lt = b["pos"] - bones[p]["pos"]
    local_trans.append(lt)

# Compute world matrices by propagating down the tree:
world_matrices = [None] * len(bones)
for i, b in enumerate(bones):
    p = b["parent"]
    lm = make_trans(local_trans[i])
    if p is None:
        world_matrices[i] = lm
    else:
        world_matrices[i] = world_matrices[p] @ lm

# Verify W_i @ IBM_i
for i, b in enumerate(bones):
    W_i = world_matrices[i]
    # IBM is inverse of W_i
    IBM_i = np.linalg.inv(W_i)
    product = W_i @ IBM_i
    err = np.max(np.abs(product - np.eye(4)))
    # Also verify world translation equals bone world position:
    w_pos = W_i[:3, 3]
    pos_err = np.max(np.abs(w_pos - b["pos"]))
    print(f"Bone {b['name']}: W@IBM err = {err:.6e}, world pos err = {pos_err:.6e}")

