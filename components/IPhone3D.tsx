import React, { useMemo, useEffect, useState, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { clone as cloneScene } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { videoCache } from '../utils/videoCache';
import { shouldAutoplayVideos } from '../utils/deviceDetection';

interface IPhone3DProps {
  videoSrc: string;
  /** Full-quality URL. When provided and the phone is selected, the component
   *  keeps the (already-loaded) preview playing on screen and streams the full
   *  video in the background, then swaps the texture seamlessly once it can
   *  play — YouTube-style. Preview is the same opening footage as full, so the
   *  swap is invisible. */
  fullVideoSrc?: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  onClick?: () => void;
  isNearCamera?: boolean;
  isSelected?: boolean;
  enableSound?: boolean;
  /** When false, video stays paused on the first frame instead of playing.
   *  Controlled by usePlaybackOrchestrator to limit concurrent decoder count + heap. */
  playbackAllowed?: boolean;
}

const IPhone3D: React.FC<IPhone3DProps> = ({
  videoSrc,
  fullVideoSrc,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  onClick,
  isNearCamera = true,
  isSelected = false,
  enableSound = false,
  playbackAllowed = true
}) => {
  // Check if we should autoplay videos
  const [canAutoplay] = useState(() => shouldAutoplayVideos());

  // Canvas runs frameloop="demand" — it only paints when invalidate() is
  // called. A playing VideoTexture does NOT trigger a render on its own, so
  // without driving invalidate() per decoded frame the video plays (audio
  // included) but the screen stays black/frozen. We grab invalidate here and
  // pump it from a requestVideoFrameCallback loop in the driver effect below.
  const { invalidate } = useThree();

  // Every phone with a videoSrc gets a <video> element — even ones the
  // orchestrator hasn't activated. Non-active ones load only metadata + first
  // frame (preload="metadata"), seek to 0.1s for a poster, and stay paused.
  // No decoder slot is consumed while paused, so heap/GPU cost is minimal
  // and the user sees a real video frame instead of a gradient placeholder.
  const shouldPlay = playbackAllowed || isSelected;
  const hasNoVideo = !videoSrc;

  // Load iPhone model — DRACO compressed
  const { scene } = useGLTF('/models/iphone_14_pro_max/scene.gltf', true) as any;
  
  // Clone the scene — SkeletonUtils.clone shares geometry/textures, only copies transforms
  const clonedScene = useMemo(() => {
    const cloned = cloneScene(scene);
    
    // First, let's find the bounding box to understand the model size
    const box = new THREE.Box3().setFromObject(cloned);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    
    // Model size and center calculated
    
    // Center the model
    cloned.position.sub(center);
    
    // Rotate 180 degrees around Y axis to show front
    cloned.rotation.set(0, Math.PI, 0);
    
    return cloned;
  }, [scene]);

  // Track created materials/textures for cleanup
  const createdMaterials = useRef<THREE.Material[]>([]);
  const createdTextures = useRef<THREE.Texture[]>([]);

  // Refs the seamless preview→full swap effect needs to reach without
  // re-running the (expensive) material-build effect.
  const screenMeshRef = useRef<any>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const previewTextureRef = useRef<THREE.VideoTexture | null>(null);

  // Cleanup on component unmount — dispose video, textures, materials
  useEffect(() => {
    return () => {
      const release = (v: HTMLVideoElement | null | undefined) => {
        if (!v) return;
        v.pause();
        v.removeAttribute('src');
        v.load(); // release network resources
        if (v.parentNode) v.parentNode.removeChild(v);
      };
      clonedScene.traverse((child: any) => {
        if (child.isMesh) {
          // Release every <video> we may have attached: the live one (__video),
          // the base preview (__previewVideo), and the upgraded full (__fullVideo).
          release(child.__video);
          release(child.__previewVideo);
          release(child.__fullVideo);
          child.__video = null;
          child.__previewVideo = null;
          child.__fullVideo = null;
        }
      });

      // Dispose all materials and textures we created
      createdTextures.current.forEach(t => t.dispose());
      createdMaterials.current.forEach(m => m.dispose());
      createdTextures.current = [];
      createdMaterials.current = [];
    };
  }, [clonedScene]);
  
  // Find and update materials
  useEffect(() => {
    // Dispose previously created resources before creating new ones
    createdTextures.current.forEach(t => t.dispose());
    createdMaterials.current.forEach(m => m.dispose());
    createdTextures.current = [];
    createdMaterials.current = [];

    // Tear down any prior <video> elements so we don't leak orphaned DOM
    // nodes when this effect re-runs.
    clonedScene.traverse((child: any) => {
      if (child.isMesh) {
        [child.__video, child.__previewVideo, child.__fullVideo].forEach((prev: HTMLVideoElement | null) => {
          if (!prev) return;
          prev.pause();
          prev.removeAttribute('src');
          prev.load();
          if (prev.parentNode) prev.parentNode.removeChild(prev);
        });
        child.__video = null;
        child.__previewVideo = null;
        child.__fullVideo = null;
      }
    });

    const trackMaterial = (m: THREE.Material) => { createdMaterials.current.push(m); return m; };
    const trackTexture = (t: THREE.Texture) => { createdTextures.current.push(t); return t; };

    // First, let's analyze the model structure
    // Analyze model structure
    let meshCount = 0;
    let texturedMeshes: any[] = [];
    
    clonedScene.traverse((child: any) => {
      if (child.isMesh) {
        meshCount++;
        // Track mesh info
        
        // Check all texture types
        if (child.material) {
          const textures = [];
          if (child.material.map) textures.push('map');
          if (child.material.emissiveMap) textures.push('emissiveMap');
          if (child.material.normalMap) textures.push('normalMap');
          if (child.material.roughnessMap) textures.push('roughnessMap');
          if (child.material.metalnessMap) textures.push('metalnessMap');
          
          if (textures.length > 0) {
            // Track textures
            texturedMeshes.push({
              mesh: child,
              name: child.name,
              materialName: child.material.name,
              textures: textures
            });
          }
        }
      }
    });
    
    // Mesh count tracked
    
    // Now find the screen mesh - usually it's the one with emissiveMap or specific name
    let screenMesh = null;

    // Strategy 0 (authoritative): the canonical display mesh in this exact GLTF
    // (iphone_14_pro_max). The emissiveMap/front-most heuristics below were
    // NON-DETERMINISTIC across clones: SkeletonUtils.clone() SHARES materials,
    // so once preview phones swapped their screen material the heuristic could
    // resolve to a DIFFERENT mesh on a later clone (e.g. the selected/full
    // phone). That put the video on a hidden internal mesh while the real,
    // visible screen ("YbXWdqEcjbfTKuN_0") stayed black — the exact
    // "audio plays, screen black on click" bug. Pinning the known mesh name
    // makes every clone (preview AND full) paint the visible screen.
    const SCREEN_MESH_NAME = 'YbXWdqEcjbfTKuN_0';
    screenMesh = texturedMeshes.find(item => item.name === SCREEN_MESH_NAME);

    // Strategy 1 (fallback): Find by emissive map (screens often glow)
    if (!screenMesh) {
      screenMesh = texturedMeshes.find(item =>
        item.textures.includes('emissiveMap') ||
        (item.textures.includes('map') && item.name.toLowerCase().includes('screen'))
      );
    }

    // Strategy 2 (fallback): find the front-most textured mesh
    if (!screenMesh && texturedMeshes.length > 0) {
      // iPhone screens are usually at Z position close to max
      screenMesh = texturedMeshes.reduce((prev, curr) => {
        return curr.mesh.position.z > prev.mesh.position.z ? curr : prev;
      });
    }
    
    // Apply image texture to the found screen mesh
    if (screenMesh) {
      // Screen mesh found
      const mesh = screenMesh.mesh;
      
      // Remap UV coordinates to be uniform (0-1 range)
      if (mesh.geometry && mesh.geometry.attributes.uv) {
        const uvAttribute = mesh.geometry.attributes.uv;
        const uvArray = uvAttribute.array;
        
        // Get bounds of current UVs
        let minU = Infinity, maxU = -Infinity;
        let minV = Infinity, maxV = -Infinity;
        
        for (let i = 0; i < uvArray.length; i += 2) {
          minU = Math.min(minU, uvArray[i]);
          maxU = Math.max(maxU, uvArray[i]);
          minV = Math.min(minV, uvArray[i + 1]);
          maxV = Math.max(maxV, uvArray[i + 1]);
        }
        
        // UV bounds calculated
        
        // Normalize UVs to 0-1 range
        const rangeU = maxU - minU || 1;
        const rangeV = maxV - minV || 1;
        
        for (let i = 0; i < uvArray.length; i += 2) {
          uvArray[i] = (uvArray[i] - minU) / rangeU;
          uvArray[i + 1] = (uvArray[i + 1] - minV) / rangeV;
        }
        
        // Mark UV attribute as needing update
        uvAttribute.needsUpdate = true;
        mesh.geometry.attributes.uv.needsUpdate = true;
        mesh.geometry.uvsNeedUpdate = true;
        
        // UV coordinates remapped
      }
      
      
      // Phones with no assigned video keep a black screen (rare — only when
      // the grid has more slots than the available video pool).
      if (hasNoVideo) {
        mesh.material = trackMaterial(new THREE.MeshBasicMaterial({
          color: '#000000',
          toneMapped: false,
          side: THREE.FrontSide,
        }));
        return;
      }

      // Always create a <video> element for the screen, even when the phone
      // is inactive. Inactive phones use preload="metadata" and seek to
      // currentTime=0.1 so the texture displays a real poster frame instead
      // of a synthetic placeholder. They stay paused → no decoder slot used.
      const video = document.createElement('video');
      const isFullVideo = videoSrc.includes('/full/');

      video.src = videoSrc;
      video.crossOrigin = 'anonymous';
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.setAttribute('playsinline', 'true');
      video.setAttribute('webkit-playsinline', 'true');
      video.playbackRate = 1.0;

      if (shouldPlay) {
        // Active phone — start streaming and autoplay
        video.preload = 'auto';
        video.autoplay = true;
        if (!isFullVideo) videoCache.preloadVideo(videoSrc);
      } else {
        // Inactive — fetch just enough to render the first frame, then pause
        video.preload = 'metadata';
        video.autoplay = false;
        video.addEventListener('loadedmetadata', () => {
          if (video.paused && video.duration > 0.3) {
            try { video.currentTime = 0.1; } catch { /* iOS may throw before metadata fully ready */ }
          }
        }, { once: true });
        // Paused posters never trigger the playing-render loop, so paint the
        // poster frame once the seek lands, otherwise the screen stays blank.
        video.addEventListener('seeked', () => invalidate(), { once: true });
        video.addEventListener('loadeddata', () => invalidate(), { once: true });
      }

      // iOS Safari workaround: <video> must be in the DOM for WebGL to be
      // allowed to read its frames into a texture. Without this, audio
      // decodes (you hear sound) but the canvas stays black.
      video.style.position = 'fixed';
      video.style.left = '0';
      video.style.top = '0';
      video.style.width = '1px';
      video.style.height = '1px';
      video.style.opacity = '0';
      video.style.pointerEvents = 'none';
      video.style.zIndex = '-1';
      document.body.appendChild(video);

      // Store video reference on mesh for later control (play/pause effect).
      // __previewVideo is the persistent base layer; __video is whatever is
      // currently bound (preview now, full after a seamless swap).
      (mesh as any).__video = video;
      (mesh as any).__previewVideo = video;
      screenMeshRef.current = mesh;
      previewVideoRef.current = video;

      if (shouldPlay) {
        video.play().catch(() => {
          setTimeout(() => { video.play().catch(() => {}); }, 100);
        });
      }

      const videoTexture = trackTexture(new THREE.VideoTexture(video));
      videoTexture.minFilter = THREE.LinearFilter;
      videoTexture.magFilter = THREE.LinearFilter;
      videoTexture.generateMipmaps = false;
      videoTexture.colorSpace = THREE.SRGBColorSpace;
      // NOTE: removed `videoTexture.format = THREE.RGBFormat` — deprecated and
      // removed in three.js r144+. With it set on modern three.js the WebGL
      // texture upload silently fails and the screen stays black even though
      // the underlying <video> plays audio. Default RGBAFormat works fine.
      videoTexture.wrapS = THREE.ClampToEdgeWrapping;
      videoTexture.wrapT = THREE.ClampToEdgeWrapping;
      videoTexture.repeat.set(-1, 1);
      videoTexture.offset.set(1, 0);
      previewTextureRef.current = videoTexture;

      // Always bind the video texture — three.js renders empty frames as
      // transparent until the browser decodes the first frame, then paints
      // it automatically. No need for a black "loading" placeholder swap,
      // which previously kept the screen blank for the full preload window.
      mesh.material = trackMaterial(new THREE.MeshBasicMaterial({
        map: videoTexture,
        toneMapped: false,
        side: THREE.FrontSide,
      }));
    }

    // Style the frame
    clonedScene.traverse((child: any) => {
      if (child.isMesh) {
        const meshName = child.name.toLowerCase();

        if (meshName.includes('frame') ||
            meshName.includes('body') ||
            meshName.includes('case') ||
            child.material?.name?.toLowerCase().includes('metal') ||
            child.material?.name?.toLowerCase().includes('aluminum')) {
          child.material = trackMaterial(new THREE.MeshStandardMaterial({
            color: '#e5e5e7',
            metalness: 0.95,
            roughness: 0.05,
            envMapIntensity: 1
          }));
        }

        if (meshName.includes('glass') ||
            meshName.includes('lens') ||
            meshName.includes('camera')) {
          child.material = trackMaterial(new THREE.MeshStandardMaterial({
            color: '#1a1a1a',
            metalness: 0.9,
            roughness: 0.1,
            envMapIntensity: 0.5
          }));
        }
      }
    });
    // NOTE: shouldPlay/enableSound intentionally NOT in deps — toggling them
    // would recreate the whole video element on every orchestrator shift or
    // selection. The "playback control" + "sound" + "preview→full swap"
    // effects below mutate the *same* element instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clonedScene, videoSrc, hasNoVideo]);

  // On-demand render driver. Canvas is frameloop="demand", so a playing
  // VideoTexture won't paint unless we call invalidate() per frame (otherwise
  // audio decodes but the screen stays frozen/black). This loop reads the
  // *currently bound* screen video (screenMeshRef.__video) each tick, so it
  // automatically follows the preview→full swap without re-binding. It only
  // invalidates while that video is actually playing, so an idle grid still
  // costs zero GPU. Paused poster frames are painted by one-shot invalidate()
  // calls wired up where the video is created/swapped.
  useEffect(() => {
    let stopped = false;
    let rafId = 0;
    const loop = () => {
      if (stopped) return;
      const mesh = screenMeshRef.current;
      const v: HTMLVideoElement | null = mesh && mesh.__video;
      if (v && !v.paused && v.readyState >= 2) invalidate();
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => { stopped = true; if (rafId) cancelAnimationFrame(rafId); };
  }, [invalidate]);

  // Seamless preview→full swap (YouTube-style). While selected, keep the
  // already-loaded preview on screen and stream the full video in the
  // background; once it can play, swap the texture + bound video element with
  // no black gap. On deselect/unmount, revert to the preview and tear the
  // full element down. Preview === full's opening footage, so the swap is
  // visually invisible.
  useEffect(() => {
    const mesh = screenMeshRef.current;
    const previewVideo = previewVideoRef.current;
    if (!isSelected || hasNoVideo || !fullVideoSrc || !mesh || !previewVideo) return;

    const full = document.createElement('video');
    full.src = fullVideoSrc;
    full.crossOrigin = 'anonymous';
    full.loop = true;
    full.muted = true; // muted until adopted, then unmuted if enableSound
    full.playsInline = true;
    full.setAttribute('playsinline', 'true');
    full.setAttribute('webkit-playsinline', 'true');
    full.preload = 'auto';
    full.style.position = 'fixed';
    full.style.left = '0';
    full.style.top = '0';
    full.style.width = '1px';
    full.style.height = '1px';
    full.style.opacity = '0';
    full.style.pointerEvents = 'none';
    full.style.zIndex = '-1';
    document.body.appendChild(full);

    let adopted = false;
    const adopt = () => {
      if (adopted) return;
      adopted = true;

      const fullTex = new THREE.VideoTexture(full);
      fullTex.minFilter = THREE.LinearFilter;
      fullTex.magFilter = THREE.LinearFilter;
      fullTex.generateMipmaps = false;
      fullTex.colorSpace = THREE.SRGBColorSpace;
      fullTex.wrapS = THREE.ClampToEdgeWrapping;
      fullTex.wrapT = THREE.ClampToEdgeWrapping;
      fullTex.repeat.set(-1, 1);
      fullTex.offset.set(1, 0);

      mesh.material.map = fullTex;
      mesh.material.needsUpdate = true;
      mesh.__fullTexture = fullTex;
      mesh.__fullVideo = full;
      mesh.__video = full; // render driver + controls now target the full video

      full.muted = !enableSound;
      full.volume = enableSound ? 1 : 0;
      full.play().catch(() => {});
      // The full film starts at its beginning (same shot as the preview), so the
      // cut is invisible. Stop the preview to free its decoder slot.
      previewVideo.pause();
      invalidate();
    };

    full.addEventListener('canplay', adopt, { once: true });
    full.addEventListener('loadeddata', adopt, { once: true });
    full.load();

    return () => {
      full.removeEventListener('canplay', adopt);
      full.removeEventListener('loadeddata', adopt);

      // Revert the on-screen texture/video back to the preview layer.
      if (previewTextureRef.current) {
        mesh.material.map = previewTextureRef.current;
        mesh.material.needsUpdate = true;
      }
      mesh.__video = previewVideo;
      previewVideo.muted = true;
      previewVideo.play().catch(() => {});

      // Dispose the full texture + element.
      if (mesh.__fullTexture) { mesh.__fullTexture.dispose(); mesh.__fullTexture = null; }
      mesh.__fullVideo = null;
      full.pause();
      full.removeAttribute('src');
      full.load();
      if (full.parentNode) full.parentNode.removeChild(full);
      invalidate();
    };
  }, [isSelected, fullVideoSrc, enableSound, hasNoVideo, invalidate]);

  // Control video playback based on orchestrator allowance, viewport visibility, and selection state
  useEffect(() => {
    if (!clonedScene) return;

    let screenMesh: any = null;
    clonedScene.traverse((child: any) => {
      if (child.isMesh && child.__video) {
        screenMesh = child;
      }
    });

    if (screenMesh && screenMesh.__video) {
      const video = screenMesh.__video;

      // Small delay to ensure video element is ready
      setTimeout(() => {
        // Orchestrator override: if playback is not allowed, always pause
        if (!playbackAllowed && !isSelected) {
          if (!video.paused) {
            video.pause();
            // Snap back to poster frame so the texture shows it again
            if (video.duration > 0.3) {
              try { video.currentTime = 0.1; } catch { /* ignore */ }
            }
          }
          return;
        }

        // Activating phone — upgrade preload if we started in metadata mode
        if (video.preload !== 'auto') {
          video.preload = 'auto';
        }

        // Autoplay logic for desktop
        if (canAutoplay && !isSelected) {
          // For preview videos on desktop - play if near camera
          if (isNearCamera) {
            if (video.paused) {
              video.play().catch(() => {});
            }
          } else {
            // Pause if far from camera to save resources
            if (!video.paused) {
              video.pause();
            }
          }
        }
        // Manual play logic (for selected videos or mobile)
        else if (isNearCamera && isSelected) {
          // Play selected video
          if (video.paused) {
            video.play().catch(() => {});
          }
        } else {
          // Pause in all other cases
          if (!video.paused) {
            video.pause();
          }
        }
      }, 100);
    }

    return () => {
      // Cleanup on unmount
      if (screenMesh && screenMesh.__video) {
        screenMesh.__video.pause();
      }
    };
  }, [clonedScene, isNearCamera, isSelected, enableSound, canAutoplay, playbackAllowed]);
  
  // Control sound based on selection state - immediate mute when deselected
  useEffect(() => {
    if (!clonedScene) return;
    
    let screenMesh: any = null;
    clonedScene.traverse((child: any) => {
      if (child.isMesh && child.__video) {
        screenMesh = child;
      }
    });
    
    if (screenMesh && screenMesh.__video) {
      const video = screenMesh.__video;
      
      // Immediately control mute state based on selection
      if (isSelected && enableSound) {
        video.muted = false;
        video.volume = 1.0;
      } else {
        video.muted = true;
        video.volume = 0;
      }
    }
  }, [clonedScene, enableSound, isSelected]);

  // Calculate scale once and memoize it
  const calculatedScale = useMemo(() => {
    const box = new THREE.Box3().setFromObject(clonedScene);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    
    // Target size: slightly larger than ModernPhone
    const targetSize = 1.8;
    const scaleValue = targetSize / maxDim;
    
    // Scale calculated
    return scaleValue * scale;
  }, [clonedScene, scale]);

  return (
    <group 
      position={position} 
      rotation={rotation}
      onClick={onClick}
    >
      <primitive 
        object={clonedScene} 
        scale={calculatedScale}
      />
    </group>
  );
};

// Preload the DRACO-compressed model
useGLTF.preload('/models/iphone_14_pro_max/scene.gltf', true);

export default IPhone3D;