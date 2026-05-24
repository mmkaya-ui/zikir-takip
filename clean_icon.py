import sys
from PIL import Image

def process_icon(img_path):
    try:
        img = Image.open(img_path).convert("RGBA")
        width, height = img.size
        
        # 1. Find bounding box of non-white
        min_x, min_y = width, height
        max_x = max_y = 0
        data = img.load()
        
        for y in range(height):
            for x in range(width):
                r, g, b, a = data[x, y]
                # Consider anything lighter than 240 as white background
                if not (r > 240 and g > 240 and b > 240):
                    min_x = min(min_x, x)
                    max_x = max(max_x, x)
                    min_y = min(min_y, y)
                    max_y = max(max_y, y)
                    
        # Crop
        if min_x < max_x and min_y < max_y:
            img = img.crop((min_x, min_y, max_x+1, max_y+1))
            
            # Make the remaining white anti-aliased corners transparent
            cropped_data = img.getdata()
            new_data = []
            for item in cropped_data:
                if item[0] > 230 and item[1] > 230 and item[2] > 230:
                    new_data.append((255, 255, 255, 0))
                else:
                    new_data.append(item)
            img.putdata(new_data)
            
            img.save(img_path)
            print(f"Processed {img_path}")
    except Exception as e:
        print(f"Error processing {img_path}: {e}")

process_icon('public/icon.png')
process_icon('public/apple-touch-icon.png')
process_icon('src/app/opengraph-image.png')
