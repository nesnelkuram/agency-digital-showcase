#!/bin/bash

# Create optimized versions of videos for web
mkdir -p public/videos/optimized

# Process each video in the full folder
for video in public/videos/full/*.mp4; do
    filename=$(basename "$video")
    
    # Skip if already optimized
    if [ -f "public/videos/optimized/$filename" ]; then
        echo "Skipping $filename (already optimized)"
        continue
    fi
    
    echo "Optimizing $filename..."
    
    # Optimize for web: reduce resolution, bitrate, and use efficient codec
    ffmpeg -i "$video" \
        -c:v libx264 \
        -preset slow \
        -crf 28 \
        -vf "scale='min(720,iw)':'min(1280,ih)':force_original_aspect_ratio=decrease" \
        -c:a aac \
        -b:a 128k \
        -movflags +faststart \
        -y \
        "public/videos/optimized/$filename"
done

echo "Video optimization complete!"
echo "Original size: $(du -sh public/videos/full | cut -f1)"
echo "Optimized size: $(du -sh public/videos/optimized | cut -f1)"