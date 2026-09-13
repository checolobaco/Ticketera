import os
import cv2
import numpy as np
from PIL import Image

def generate_brand_video():
    scenes = [
        r"C:\Users\CNS.16\.gemini\antigravity\brain\dae7d234-9833-43dd-b415-7a5eae989b80\cloudtickets_brand30s_scene1_slogan_1789261269475.jpg",
        r"C:\Users\CNS.16\.gemini\antigravity\brain\dae7d234-9833-43dd-b415-7a5eae989b80\cloudtickets_brand30s_scene2_tech_1789261437556.jpg",
        r"C:\Users\CNS.16\.gemini\antigravity\brain\dae7d234-9833-43dd-b415-7a5eae989b80\cloudtickets_brand30s_scene3_analytics_1789261456347.jpg",
        r"C:\Users\CNS.16\.gemini\antigravity\brain\dae7d234-9833-43dd-b415-7a5eae989b80\cloudtickets_brand30s_scene4_outro_1789261503554.jpg"
    ]

    target_w, target_h = 1920, 1080
    fps = 30
    total_seconds = 30
    total_frames = fps * total_seconds # 900 frames

    output_mp4_1 = r"c:\0DE\Ticketera\fronted\public\cloudtickets_promo_30s.mp4"
    output_mp4_2 = r"C:\Users\CNS.16\.gemini\antigravity\brain\dae7d234-9833-43dd-b415-7a5eae989b80\cloudtickets_promo_30s.mp4"

    # Pre-load and resize images
    imgs = []
    for s in scenes:
        im = Image.open(s).convert("RGB")
        im = im.resize((target_w, target_h), Image.Resampling.LANCZOS)
        imgs.append(np.array(im))

    num_scenes = len(imgs)
    # 4 scenes, total 30s. Each scene gets 7.5s (225 frames) display time.
    fade_frames = 30 # 1.0s crossfade transition
    scene_duration_frames = total_frames // num_scenes # 225 frames

    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    writer = cv2.VideoWriter(output_mp4_1, fourcc, fps, (target_w, target_h))

    print("Generating 30-second brand video frames...")

    for f in range(total_frames):
        scene_idx = min(f // scene_duration_frames, num_scenes - 1)
        local_f = f % scene_duration_frames

        # Ken Burns effect: subtle zoom from 1.0 to 1.04 over each scene duration
        zoom_factor = 1.0 + 0.04 * (local_f / float(scene_duration_frames))
        
        img_current = imgs[scene_idx]
        h, w, c = img_current.shape
        crop_w = int(w / zoom_factor)
        crop_h = int(h / zoom_factor)
        start_x = (w - crop_w) // 2
        start_y = (h - crop_h) // 2
        
        cropped = img_current[start_y:start_y+crop_h, start_x:start_x+crop_w]
        frame = cv2.resize(cropped, (target_w, target_h), interpolation=cv2.INTER_LINEAR)

        # Crossfade transition
        if local_f >= (scene_duration_frames - fade_frames) and scene_idx < num_scenes - 1:
            alpha = (scene_duration_frames - local_f) / float(fade_frames)
            
            img_next = imgs[scene_idx + 1]
            next_zoom = 1.0
            crop_w_n = int(w / next_zoom)
            crop_h_n = int(h / next_zoom)
            start_x_n = (w - crop_w_n) // 2
            start_y_n = (h - crop_h_n) // 2
            cropped_next = img_next[start_y_n:start_y_n+crop_h_n, start_x_n:start_x_n+crop_w_n]
            frame_next = cv2.resize(cropped_next, (target_w, target_h), interpolation=cv2.INTER_LINEAR)

            frame = cv2.addWeighted(frame, alpha, frame_next, 1.0 - alpha, 0)

        # Light pulse effect
        pulse = 1.0 + 0.02 * np.sin(2 * np.pi * f / 30.0)
        frame = np.clip(frame.astype(np.float32) * pulse, 0, 255).astype(np.uint8)

        frame_bgr = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
        writer.write(frame_bgr)

    writer.release()
    print("30s Brand Video written successfully:", output_mp4_1)

    import shutil
    shutil.copy(output_mp4_1, output_mp4_2)
    print("30s Brand Video copied to artifacts successfully:", output_mp4_2)

if __name__ == "__main__":
    generate_brand_video()
