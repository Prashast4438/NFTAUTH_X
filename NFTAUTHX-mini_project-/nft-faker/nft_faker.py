import os
import random
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import cv2

def add_noise(image):
    np_img = np.array(image)
    noise = np.random.randint(0, 50, np_img.shape, dtype='uint8')
    noisy_img = cv2.add(np_img, noise)
    return Image.fromarray(noisy_img)

def shift_colors(image):
    np_img = np.array(image.convert('RGB'))
    hsv_img = cv2.cvtColor(np_img, cv2.COLOR_RGB2HSV)
    hsv_img[:, :, 0] = (hsv_img[:, :, 0] + random.randint(10, 90)) % 180
    shifted = cv2.cvtColor(hsv_img, cv2.COLOR_HSV2RGB)
    return Image.fromarray(shifted)

def rotate_image(image):
    angle = random.randint(-30, 30)
    return image.rotate(angle, expand=True)

def add_glitch(image):
    np_img = np.array(image.convert('RGB'))
    b, g, r = cv2.split(np_img)
    b = np.roll(b, random.randint(-5, 5), axis=1)
    g = np.roll(g, random.randint(-5, 5), axis=0)
    glitched = cv2.merge((b, g, r))
    return Image.fromarray(glitched)

def add_text_overlay(image, text='FAKE'):
    draw = ImageDraw.Draw(image)
    font = ImageFont.load_default()
    draw.text((10, 10), text, fill="red", font=font)
    return image

def generate_fake_nfts(original_path, output_dir, num_variations=3):
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    original_image = Image.open(original_path).convert('RGBA')
    transformations = [add_noise, shift_colors, rotate_image, add_glitch, add_text_overlay]

    for i in range(num_variations):
        img = original_image.copy()
        chosen = random.sample(transformations, random.randint(1, 3))
        for transform in chosen:
            img = transform(img)
        fake_path = os.path.join(output_dir, f"fake_nft_{i+1}.png")
        img.save(fake_path)
        print(f"[+] Saved: {fake_path}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python generate_fake_nfts.py <path_to_genuine_nft_image>")
        sys.exit(1)

    genuine_image_path = sys.argv[1]
    output_directory = "fake_nfts"
    generate_fake_nfts(genuine_image_path, output_directory, num_variations=random.randint(2, 4))
