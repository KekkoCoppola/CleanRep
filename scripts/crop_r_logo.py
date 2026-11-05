import numpy as np
from PIL import Image

r_source = Image.open('assets/brand/cleanrep-logo-512.png').convert('RGBA')
arr = np.array(r_source)
mask = (arr[:, :, 0] > 175) & (arr[:, :, 1] > 175) & (arr[:, :, 2] > 175)

y_idx, x_idx = np.where(mask)
min_x, max_x = x_idx.min(), x_idx.max()
min_y, max_y = y_idx.min(), y_idx.max()

# Create pure transparent RGBA image with only the white R
r_clean = Image.new("RGBA", (max_x - min_x + 1, max_y - min_y + 1), (0, 0, 0, 0))
r_clean_data = np.zeros((max_y - min_y + 1, max_x - min_x + 1, 4), dtype=np.uint8)
r_clean_data[mask[min_y:max_y+1, min_x:max_x+1]] = [255, 255, 255, 255]
r_clean = Image.fromarray(r_clean_data)

print(f"Cropped 'R' logo dimensions: {r_clean.size} (aspect ratio: {r_clean.width / r_clean.height:.3f})")
r_clean.save('assets/gymmy/3d/r_cropped.png')
print("Saved assets/gymmy/3d/r_cropped.png")

