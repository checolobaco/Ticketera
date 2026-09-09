import os
import cv2
import numpy as np
from PIL import Image

def generate_video():
    scenes = [
        r"C:\Users\CNS.16\.gemini\antigravity\brain\dae7d234-9833-43dd-b415-7a5eae989b80\harvy_valencia_scene1_poweredby_1788937712552.jpg",
        r"C:\Users\CNS.16\.gemini\antigravity\brain\dae7d234-9833-43dd-b415-7a5eae989b80\harvy_valencia_scene2_whatsapp_1788936733597.jpg",
        r"C:\Users\CNS.16\.gemini\antigravity\brain\dae7d234-9833-43dd-b415-7a5eae989b80\harvy_valencia_scene3_fastaccess_1788936763531.jpg",
        r"C:\Users\CNS.16\.gemini\antigravity\brain\dae7d234-9833-43dd-b415-7a5eae989b80\harvy_valencia_scene4_perks_1788936797058.jpg",
        r"C:\Users\CNS.16\.gemini\antigravity\brain\dae7d234-9833-43dd-b415-7a5eae989b80\harvy_valencia_scene5_v2_1788937752156.jpg"
    ]

    target_w, target_h = 1920, 1080
    fps = 30
    total_seconds = 40
    total_frames = fps * total_seconds # 1200 frames

    output_mp4_1 = r"c:\0DE\Ticketera\fronted\public\harvy_valencia_tulua_40s.mp4"
    output_mp4_2 = r"C:\Users\CNS.16\.gemini\antigravity\brain\dae7d234-9833-43dd-b415-7a5eae989b80\harvy_valencia_tulua_40s.mp4"

    # Pre-load and resize images
    imgs = []
    for s in scenes:
        im = Image.open(s).convert("RGB")
        im = im.resize((target_w, target_h), Image.Resampling.LANCZOS)
        imgs.append(np.array(im))

    num_scenes = len(imgs)
    # 5 scenes, total 40s. Each scene gets 8s display time.
    # Crossfade duration = 1.0s (30 frames)
    fade_frames = 30
    scene_duration_frames = total_frames // num_scenes # 240 frames (8.0s) per scene segment

    # Set up OpenCV VideoWriter
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    writer = cv2.VideoWriter(output_mp4_1, fourcc, fps, (target_w, target_h))

    print("Generating updated 40-second video frames...")

    for f in range(total_frames):
        # Determine current scene index and offset
        scene_idx = min(f // scene_duration_frames, num_scenes - 1)
        local_f = f % scene_duration_frames

        # Ken Burns effect: subtle zoom from 1.0 to 1.04 over each scene duration
        zoom_factor = 1.0 + 0.04 * (local_f / float(scene_duration_frames))
        
        img_current = imgs[scene_idx]
        
        # Apply Ken Burns zoom
        h, w, c = img_current.shape
        crop_w = int(w / zoom_factor)
        crop_h = int(h / zoom_factor)
        start_x = (w - crop_w) // 2
        start_y = (h - crop_h) // 2
        
        cropped = img_current[start_y:start_y+crop_h, start_x:start_x+crop_w]
        frame = cv2.resize(cropped, (target_w, target_h), interpolation=cv2.INTER_LINEAR)

        # Crossfade transition to next scene if near the end of scene segment
        if local_f >= (scene_duration_frames - fade_frames) and scene_idx < num_scenes - 1:
            alpha = (scene_duration_frames - local_f) / float(fade_frames)
            
            # Next scene frame with slight initial zoom
            img_next = imgs[scene_idx + 1]
            next_zoom = 1.0
            crop_w_n = int(w / next_zoom)
            crop_h_n = int(h / next_zoom)
            start_x_n = (w - crop_w_n) // 2
            start_y_n = (h - crop_h_n) // 2
            cropped_next = img_next[start_y_n:start_y_n+crop_h_n, start_x_n:start_x_n+crop_w_n]
            frame_next = cv2.resize(cropped_next, (target_w, target_h), interpolation=cv2.INTER_LINEAR)

            frame = cv2.addWeighted(frame, alpha, frame_next, 1.0 - alpha, 0)

        # Add subtle glow / brightness pulse in concert rhythm
        pulse = 1.0 + 0.02 * np.sin(2 * np.pi * f / 30.0)
        frame = np.clip(frame.astype(np.float32) * pulse, 0, 255).astype(np.uint8)

        # Convert RGB to BGR for cv2
        frame_bgr = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
        writer.write(frame_bgr)

    writer.release()
    print("Updated Video 1 written successfully:", output_mp4_1)

    # Copy to brain artifacts dir as well
    import shutil
    shutil.copy(output_mp4_1, output_mp4_2)
    print("Updated Video 2 copied successfully:", output_mp4_2)

if __name__ == "__main__":
    generate_video()
