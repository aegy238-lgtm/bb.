import React, { useState, useEffect, useRef } from 'react';
import { Download, Plus, Search, ChevronDown, Disc, AlertCircle, Loader2, Image as ImageIcon, Grid, Moon, Sun, RefreshCcw, Pause, Play, Square, Upload, Music, Save, Images, FileVideo, FileJson, Clock, Gauge, ArrowRightLeft, Layers } from 'lucide-react';

interface EditorProps {
  file: File;
}

interface Asset {
  id: string;
  name: string;
  src?: string;
  type: 'image' | 'audio';
  isLoose?: boolean; // Track if asset comes from deep scan (file in zip) vs parser
}

const SVG_TO_AE_SCRIPT = `
// Prestige_Converter.jsx
// Part of مصمم برستيج (Prestige Designer)
// ExtendScript for After Effects
// Imports SVGA extracted assets and reconstructs the animation with full keyframes.

(function svgaToAeWithKeys(){
    var inputFolder = Folder.selectDialog("Select the folder containing extracted SVGA assets (images)");
    if(!inputFolder) return;

    var manifest = null;
    var manifestFile = new File(inputFolder.parent.fsName + "/layers_manifest.json");
    if(!manifestFile.exists) manifestFile = new File(inputFolder.fsName + "/layers_manifest.json");

    if(manifestFile.exists){
        manifestFile.open('r');
        manifestFile.encoding = 'UTF-8';
        var content = manifestFile.read();
        manifestFile.close();
        try { manifest = eval("(" + content + ")"); } catch(e){ alert("Error parsing layers_manifest.json: " + e.toString()); }
    }

    if(!manifest) {
        alert("Could not find layers_manifest.json. Please ensure it is in the same directory or parent directory of the selected folder.");
        return;
    }

    app.beginUndoGroup("Prestige Reconstruct");

    var compW = manifest.width || 800;
    var compH = manifest.height || 600;
    var compFPS = manifest.fps || 30;
    var compDuration = manifest.duration || 10;
    if(manifest.frames && manifest.fps) compDuration = manifest.frames / manifest.fps;

    var compName = "Prestige_" + decodeURI(inputFolder.name);
    var mainComp = app.project.items.addComp(compName, compW, compH, 1, compDuration, compFPS);

    var imageMap = {};
    var files = inputFolder.getFiles();
    function stripExt(name) { return name.replace(/\\.[^\\.]+$/, ""); }

    for(var i=0; i<files.length; i++){
        var f = files[i];
        if (f instanceof File && f.name.match(/\\.(png|jpg|jpeg|gif|svg)$/i)){
            var importOptions = new ImportOptions(f);
            if (importOptions.canImportAs(ImportAsType.FOOTAGE)){
                var item = app.project.importFile(importOptions);
                imageMap[f.name] = item;
                imageMap[stripExt(f.name)] = item;
            }
        }
    }

    function applyLayerProps(aeLayer, frames, fps) {
        if(!aeLayer || !frames) return;
        var lastRot = 0;
        for(var f=0; f<frames.length; f++){
            var frame = frames[f];
            var t = (frame.time !== undefined ? frame.time : f) / fps;
            if(frame.alpha !== undefined) aeLayer.opacity.setValueAtTime(t, frame.alpha * 100);
            var tf = frame.transform;
            if(tf){
                var a = (tf.a !== undefined) ? tf.a : 1;
                var b = (tf.b !== undefined) ? tf.b : 0;
                var c = (tf.c !== undefined) ? tf.c : 0;
                var d = (tf.d !== undefined) ? tf.d : 1;
                var tx = (tf.tx !== undefined) ? tf.tx : 0;
                var ty = (tf.ty !== undefined) ? tf.ty : 0;

                aeLayer.position.setValueAtTime(t, [tx, ty]);
                var r = Math.atan2(b, a); 
                var deg = r * 180 / Math.PI;
                var sx = Math.sqrt(a*a + b*b);
                var sy = Math.sqrt(c*c + d*d);
                var det = a*d - b*c;
                if(det < 0) sy = -sy; 
                if (f > 0) {
                    var delta = deg - lastRot;
                    while (delta <= -180) delta += 360;
                    while (delta > 180) delta -= 360;
                    deg = lastRot + delta;
                }
                lastRot = deg;
                aeLayer.rotation.setValueAtTime(t, deg);
                aeLayer.scale.setValueAtTime(t, [sx * 100, sy * 100]);
            }
        }
    }

    function applyBlendMode(aeLayer, mode) {
        if(!mode) return;
        var m = mode.toString().toLowerCase().replace(/_/g, "");
        if(m === "add" || m === "lineardodge") aeLayer.blendingMode = BlendingMode.ADD;
        else if(m === "screen") aeLayer.blendingMode = BlendingMode.SCREEN;
        else if(m === "multiply") aeLayer.blendingMode = BlendingMode.MULTIPLY;
        else if(m === "overlay") aeLayer.blendingMode = BlendingMode.OVERLAY;
    }

    var layersData = manifest.layers || [];
    var win = new Window("palette", "مصمم برستيج (Processing...)");
    win.orientation = 'column';
    var pBar = win.add("progressbar", undefined, 0, layersData.length);
    pBar.preferredSize.width = 300;
    win.show();

    for(var l=0; l<layersData.length; l++){
        pBar.value = l + 1;
        var layerInfo = layersData[l];
        var imgKey = layerInfo.image;
        var item = null;
        if(imgKey) item = imageMap[imgKey] || imageMap[imgKey + ".png"] || imageMap[imgKey + ".svg"];
        var aeLayer = null;
        if(item) aeLayer = mainComp.layers.add(item);
        else { aeLayer = mainComp.layers.addNull(); aeLayer.source.name = layerInfo.name || ("Null_" + l); aeLayer.label = 1; }
        aeLayer.name = layerInfo.name || ("Layer_" + l);
        if (aeLayer.source && aeLayer.source.width) aeLayer.anchorPoint.setValue([0, 0, 0]);
        if(layerInfo.blendMode) applyBlendMode(aeLayer, layerInfo.blendMode);
        applyLayerProps(aeLayer, layerInfo.frames, compFPS);
        if(layerInfo.matteKey){
            var matteItem = imageMap[layerInfo.matteKey] || imageMap[layerInfo.matteKey + ".png"];
            if(matteItem){
                var matteLayer = mainComp.layers.add(matteItem);
                matteLayer.name = "Matte_" + aeLayer.name;
                matteLayer.anchorPoint.setValue([0, 0, 0]);
                applyLayerProps(matteLayer, layerInfo.frames, compFPS);
                matteLayer.enabled = false;
                if(aeLayer.canSetTrackMatte) aeLayer.trackMatteType = TrackMatteType.ALPHA;
            }
        }
    }
    
    win.close();
    app.endUndoGroup();
    alert("Prestige Reconstruction Complete!");
})();
`;

const SVGA_EXTRACTOR_SCRIPT = `/** Prestige_Extractor */ { function Prestige_Extractor(thisObj) { } }`;

const Editor: React.FC<EditorProps> = ({ file }) => {
  const [fileSize, setFileSize] = useState<string>('0.00 MB');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageAssets, setImageAssets] = useState<Asset[]>([]);
  const [bgColor, setBgColor] = useState<'black' | 'white' | 'grid'>('black');
  
  // Audio State
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  
  // Playback State
  const [isPlaying, setIsPlaying] = useState(true);
  
  // Display State
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });
  const [mirrorMode, setMirrorMode] = useState<'none' | 'horizontal' | 'vertical'>('none');
  
  // Export State
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<string>('');
  
  // File Capabilities & Type
  const [isEditable, setIsEditable] = useState(false);
  const [fileType, setFileType] = useState<'svga' | 'lottie' | 'unknown'>('unknown');
  
  // SVGA specific info
  const [svgaInfo, setSvgaInfo] = useState({
    version: '-',
    width: 0,
    height: 0,
    fps: 0,
    frames: 0
  });

  // Lottie specific info & state
  const [lottieData, setLottieData] = useState<any>(null);
  const [lottieParams, setLottieParams] = useState({
    fr: 30, // Frame Rate
    op: 0,  // Out Point (End Frame)
    ip: 0,  // In Point (Start Frame)
    w: 0,
    h: 0,
    durationSeconds: 0
  });

  const [retryTrigger, setRetryTrigger] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lottieContainerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  // Refs for Libraries and instances
  const playerRef = useRef<any>(null); // SVGA Player
  const lottieAnimRef = useRef<any>(null); // Lottie Animation Instance
  const parserRef = useRef<any>(null);
  const svgaDataRef = useRef<any>(null);
  const ffmpegRef = useRef<any>(null); // Using global FFmpeg
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);
  
  // For asset replacement and upload
  const assetInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const selectedAssetKeyRef = useRef<string | null>(null);

  // File Size formatting
  useEffect(() => {
    if (file) {
      const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);
      setFileSize(`${sizeInMB} MB`);
    }
  }, [file]);

  const loadFFmpeg = async () => {
    if (ffmpegLoaded) return;
    
    // Check if global exists
    if (!window.FFmpeg) {
        console.error("FFmpeg library not loaded");
        setExportStatus("FFmpeg library missing");
        return;
    }

    try {
        const { createFFmpeg } = window.FFmpeg;
        // Use unpkg for core path as it is often more reliable for SharedArrayBuffer related CORS issues in some environments
        ffmpegRef.current = createFFmpeg({ 
            log: true,
            corePath: 'https://unpkg.com/@ffmpeg/core@0.11.6/dist/ffmpeg-core.js'
        });
        
        await ffmpegRef.current.load();
        setFfmpegLoaded(true);
    } catch (e) {
      console.error("FFmpeg Load Error:", e);
      setExportStatus("Failed to load FFmpeg");
    }
  };

  const handleConvertToMP4 = async () => {
    if (!svgaDataRef.current && !lottieData) {
        alert("No animation loaded to convert.");
        return;
    }

    try {
        setIsExporting(true);
        setExportStatus('Loading Converter...');
        
        await loadFFmpeg();
        if (!ffmpegRef.current || !ffmpegRef.current.isLoaded()) {
            throw new Error("FFmpeg failed to initialize. Please check network or try again.");
        }
        
        const ffmpeg = ffmpegRef.current;
        setExportStatus('Rendering Frames...');
        
        const frames: Uint8Array[] = [];
        let width = 0;
        let height = 0;
        let fps = 30;
        let totalFrames = 0;

        if (fileType === 'svga' && playerRef.current && svgaDataRef.current) {
             width = svgaDataRef.current.videoSize.width;
             height = svgaDataRef.current.videoSize.height;
             fps = svgaDataRef.current.FPS;
             totalFrames = svgaDataRef.current.frames;
             
             playerRef.current.stop();
             for (let i = 0; i < totalFrames; i++) {
                 if (playerRef.current.drawer && typeof playerRef.current.drawer.draw === 'function') {
                    playerRef.current.drawer.draw(i);
                 } else if (typeof playerRef.current.step === 'function') {
                    playerRef.current.step(i);
                 }
                 const blob = await new Promise<Blob | null>(r => canvasRef.current?.toBlob(r, 'image/png'));
                 if (blob) {
                     const buf = await blob.arrayBuffer();
                     frames.push(new Uint8Array(buf));
                 }
                 setExportStatus(`Capturing ${i}/${totalFrames}`);
             }
             playerRef.current.start();
        } else if (fileType === 'lottie' && lottieAnimRef.current) {
             width = lottieParams.w;
             height = lottieParams.h;
             fps = lottieParams.fr;
             totalFrames = Math.floor(lottieParams.durationSeconds * fps);
             lottieAnimRef.current.stop();
             lottieAnimRef.current.destroy();
             
             const captureCanvas = document.createElement('canvas');
             captureCanvas.width = width;
             captureCanvas.height = height;
             const captureAnim = window.lottie.loadAnimation({
                renderer: 'canvas',
                loop: false,
                autoplay: false,
                animationData: JSON.parse(JSON.stringify(lottieData)),
                rendererSettings: { context: captureCanvas.getContext('2d'), clearCanvas: true }
             });
             for (let i = 0; i < totalFrames; i++) {
                 captureAnim.goToAndStop(i, true); 
                 const blob = await new Promise<Blob | null>(r => captureCanvas.toBlob(r, 'image/png'));
                 if (blob) {
                     const buf = await blob.arrayBuffer();
                     frames.push(new Uint8Array(buf));
                 }
                 setExportStatus(`Capturing ${i}/${totalFrames}`);
             }
             if (lottieContainerRef.current) {
                 lottieAnimRef.current = window.lottie.loadAnimation({
                    container: lottieContainerRef.current,
                    renderer: 'svg',
                    loop: true,
                    autoplay: true,
                    animationData: lottieData
                 });
             }
        }

        setExportStatus('Encoding MP4...');
        for (let i = 0; i < frames.length; i++) {
             const num = i.toString().padStart(3, '0');
             ffmpeg.FS('writeFile', `frame${num}.png`, frames[i]);
        }

        await ffmpeg.run(
            '-framerate', `${fps}`,
            '-i', 'frame%03d.png',
            '-c:v', 'libx264',
            '-pix_fmt', 'yuv420p',
            'output.mp4'
        );

        const data = ffmpeg.FS('readFile', 'output.mp4');
        const videoBlob = new Blob([data.buffer], { type: 'video/mp4' });
        const videoUrl = URL.createObjectURL(videoBlob);
        
        const link = document.createElement('a');
        link.href = videoUrl;
        link.download = `${file.name.split('.')[0]}.mp4`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        for (let i = 0; i < frames.length; i++) {
            const num = i.toString().padStart(3, '0');
            try { ffmpeg.FS('unlink', `frame${num}.png`); } catch(e){}
        }
        try { ffmpeg.FS('unlink', 'output.mp4'); } catch(e){}
        setExportStatus('');

    } catch (e: any) {
        console.error(e);
        let msg = e.message || "Unknown error";
        if (msg.includes("SharedArrayBuffer")) {
             msg = "Browser security settings prevented video encoding. This feature requires a secure context.";
        }
        alert("Conversion Failed: " + msg);
        setExportStatus('');
    } finally {
        setIsExporting(false);
    }
  };

  useEffect(() => {
    let isActive = true;

    const loadFile = async () => {
      if (!file) return;

      setLoading(true);
      setError(null);
      setImageAssets([]);
      setIsPlaying(true);
      setAudioFile(null);
      setAudioSrc(null);
      setExportStatus('');
      setIsEditable(false);
      svgaDataRef.current = null;
      setLottieData(null);
      
      if (audioRef.current) audioRef.current.src = "";

      if (playerRef.current) {
        playerRef.current.stop();
        playerRef.current.clear();
        if (typeof playerRef.current.destroy === 'function') playerRef.current.destroy();
        playerRef.current = null;
      }
      if (lottieAnimRef.current) {
        lottieAnimRef.current.destroy();
        lottieAnimRef.current = null;
      }

      const fileName = file.name.toLowerCase();
      if (fileName.endsWith('.svga')) {
        setFileType('svga');
        await loadSvga(isActive);
      } else if (fileName.endsWith('.json')) {
        setFileType('lottie');
        await loadLottie(isActive);
      } else {
        setFileType('unknown');
        setLoading(false);
        setError("Unsupported file format. Please upload .svga or .json (Lottie).");
      }
    };

    loadFile();
    return () => {
      isActive = false;
      if (playerRef.current) playerRef.current.stop();
      if (lottieAnimRef.current) lottieAnimRef.current.destroy();
    };
  }, [file, retryTrigger]);

  const extractEmbeddedSVGs = (text: string): Asset[] => {
    const assets: Asset[] = [];
    let idx = 0;
    const svgRegex = /<svg[\s\S]*?<\/svg>/gi;
    let match;
    while ((match = svgRegex.exec(text)) !== null) {
       const svgContent = match[0];
       const blob = new Blob([svgContent], { type: 'image/svg+xml' });
       assets.push({ id: `embedded_svg_${idx}`, name: `embedded_svg_${idx}.svg`, src: URL.createObjectURL(blob), type: 'image', isLoose: true });
       idx++;
    }
    const combinedB64Regex = /data:image\/svg\+xml;?charset=[^,;]*;?base64,([A-Za-z0-9+\/=\s]+)|data:image\/svg\+xml;base64,([A-Za-z0-9+\/=\s]+)/gi;
    while ((match = combinedB64Regex.exec(text)) !== null) {
        const b64Data = match[1] || match[2];
        if (b64Data) {
            try {
                const cleanB64 = b64Data.replace(/\s/g, '');
                const binary = atob(cleanB64);
                const array = new Uint8Array(binary.length);
                for(let i=0; i<binary.length; i++) array[i] = binary.charCodeAt(i);
                const blob = new Blob([array], { type: 'image/svg+xml' });
                assets.push({ id: `data_svg_${idx}`, name: `extracted_b64_${idx}.svg`, src: URL.createObjectURL(blob), type: 'image', isLoose: true });
                idx++;
            } catch(e) { console.warn("Failed to decode base64 svg", e); }
        }
    }
    return assets;
  };

  const loadSvga = async (isActive: boolean) => {
    try {
        if (file.size === 0) throw new Error("The uploaded file is empty.");
        let SVGALib = window.SVGA || window.svga;
        if (!SVGALib) {
          for (let i = 0; i < 20; i++) {
            await new Promise(r => setTimeout(r, 200));
            if (window.SVGA || window.svga) { SVGALib = window.SVGA || window.svga; break; }
          }
        }
        if (!SVGALib) throw new Error("SVGA Library could not be loaded. Please refresh.");

        const buffer = await file.arrayBuffer();
        const data = new Uint8Array(buffer);
        let isZip = false;
        try {
            if (data.length > 4 && data[0] === 0x50 && data[1] === 0x4B) {
                const checkZip = new window.JSZip();
                await checkZip.loadAsync(buffer);
                isZip = true;
            }
        } catch (e) { console.warn("Not a zip SVGA or check failed", e); }
        setIsEditable(isZip);
        
        parserRef.current = new SVGALib.Parser();
        let svgaData;
        try {
            svgaData = await parserRef.current.do(data);
        } catch (parserError: any) {
            console.error("SVGA Parser Error:", parserError);
            let msg = parserError.message || parserError.toString();
            if (msg === "Script error." || !msg) msg = "The SVGA parser encountered a cross-origin or internal error. This often happens if required dependencies (JSZip/Protobuf) failed to load.";
            throw new Error(msg);
        }
        svgaDataRef.current = svgaData; 

        if (!isActive) return;

        setSvgaInfo({
          version: svgaData.version || (isZip ? '1.0 (Zip)' : '1.x (Binary)'),
          width: svgaData.videoSize.width,
          height: svgaData.videoSize.height,
          fps: svgaData.FPS,
          frames: svgaData.frames
        });
        setDisplaySize({ width: svgaData.videoSize.width, height: svgaData.videoSize.height });

        const assetsMap = new Map<string, Asset>();
        if (svgaData.images) {
          Object.keys(svgaData.images).forEach((key) => {
            const imgData = svgaData.images[key];
            let src = '';
            if (typeof imgData === 'string') src = imgData.startsWith('data:') ? imgData : `data:image/png;base64,${imgData}`;
            else if (imgData instanceof Uint8Array) {
                const blob = new Blob([imgData], { type: 'image/png' });
                src = URL.createObjectURL(blob);
            }
            if (src) assetsMap.set(key, { id: key, name: key, src: src, type: 'image' });
          });
        }

        if (isZip) {
            try {
                const zip = new window.JSZip();
                await zip.loadAsync(buffer);
                const loosePromises: Promise<void>[] = [];
                zip.forEach((relativePath: string, zipEntry: any) => {
                    if (zipEntry.dir) return;
                    if (/\.(png|jpg|jpeg|gif|webp|svg)$/i.test(relativePath)) {
                        loosePromises.push((async () => {
                            try {
                                const filename = relativePath.split('/').pop() || relativePath;
                                if (!assetsMap.has(relativePath) && !assetsMap.has(filename)) {
                                    const blob = await zipEntry.async('blob');
                                    const src = URL.createObjectURL(blob);
                                    assetsMap.set(relativePath, { id: relativePath, name: relativePath, src, type: 'image', isLoose: true });
                                }
                            } catch (e) {}
                        })());
                    }
                });
                await Promise.all(loosePromises);
            } catch (e) { console.warn("Deep scan failed", e); }
        }

        setImageAssets(Array.from(assetsMap.values()));
        if (canvasRef.current) {
            canvasRef.current.width = svgaData.videoSize.width;
            canvasRef.current.height = svgaData.videoSize.height;
            playerRef.current = new SVGALib.Player(canvasRef.current);
            playerRef.current.set({ loop: 0, fillMode: 'forwards' });
            await playerRef.current.mount(svgaData);
            playerRef.current.start();
        }
        setLoading(false);

    } catch (err: any) {
        console.error("LoadSVGA Error:", err);
        if (isActive) {
          let msg = err.message;
          if (!msg || msg === "Script error.") msg = "Error parsing file. This usually happens if the file is malformed or if required dependencies (JSZip/Protobuf) failed to load. Please try refreshing.";
          setError(msg);
          setLoading(false);
        }
    }
  };

  const loadLottie = async (isActive: boolean) => {
    try {
        const text = await file.text();
        const json = JSON.parse(text);
        if (!isActive) return;
        setLottieData(json);
        setIsEditable(true);
        const fr = json.fr || 30;
        const op = json.op || 0;
        const ip = json.ip || 0;
        const w = json.w || 500;
        const h = json.h || 500;
        const duration = (op - ip) / fr;
        setLottieParams({ fr, op, ip, w, h, durationSeconds: parseFloat(duration.toFixed(2)) });
        setDisplaySize({ width: w, height: h });
        const assets: Asset[] = [];
        if (json.assets && Array.isArray(json.assets)) {
            json.assets.forEach((asset: any) => {
                if (asset.p && asset.p.startsWith('data:')) assets.push({ id: asset.id, name: asset.id, src: asset.p, type: 'image' });
                else if (asset.p) assets.push({ id: asset.id, name: asset.id, src: '', type: 'image' });
            });
        }
        const embeddedSVGs = extractEmbeddedSVGs(text);
        assets.push(...embeddedSVGs);
        setImageAssets(assets);
        if (!window.lottie) await new Promise(r => setTimeout(r, 500));
        if (window.lottie && lottieContainerRef.current) {
            lottieAnimRef.current = window.lottie.loadAnimation({
                container: lottieContainerRef.current, renderer: 'svg', loop: true, autoplay: true, animationData: JSON.parse(JSON.stringify(json))
            });
        }
        setLoading(false);
    } catch (err: any) {
        console.error(err);
        if (isActive) { setError("Failed to parse Lottie JSON file."); setLoading(false); }
    }
  };

  const handleRetry = () => setRetryTrigger(prev => prev + 1);
  const togglePlayback = () => {
    setIsPlaying(!isPlaying);
    if (fileType === 'svga' && playerRef.current) {
        if (isPlaying) { playerRef.current.pause ? playerRef.current.pause() : playerRef.current.stop(); if (audioRef.current) audioRef.current.pause(); } 
        else { playerRef.current.start(); if (audioRef.current && audioSrc) audioRef.current.play(); }
    } else if (fileType === 'lottie' && lottieAnimRef.current) {
        if (isPlaying) lottieAnimRef.current.pause(); else lottieAnimRef.current.play();
    }
  };
  const stopPlayback = () => {
    setIsPlaying(false);
    if (fileType === 'svga' && playerRef.current) {
        playerRef.current.stop(); playerRef.current.clear();
        if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    } else if (fileType === 'lottie' && lottieAnimRef.current) lottieAnimRef.current.stop();
  };

  const handleLottieParamChange = (key: 'fr' | 'durationSeconds', value: string) => {
      const numValue = parseFloat(value);
      if (isNaN(numValue) || numValue <= 0) return;
      if (key === 'fr') { const newOp = lottieParams.ip + (numValue * lottieParams.durationSeconds); setLottieParams(prev => ({ ...prev, fr: numValue, op: newOp })); } 
      else if (key === 'durationSeconds') { const newOp = lottieParams.ip + (lottieParams.fr * numValue); setLottieParams(prev => ({ ...prev, durationSeconds: numValue, op: newOp })); }
  };

  const handleExportLottie = () => {
      if (!lottieData) return;
      try {
          const newData = JSON.parse(JSON.stringify(lottieData));
          newData.fr = lottieParams.fr; newData.op = lottieParams.op;
          newData.assets = imageAssets.map(asset => {
              const original = lottieData.assets?.find((a: any) => a.id === asset.id);
              if (original && asset.src?.startsWith('data:')) return { ...original, p: asset.src, u: '', e: 1 };
              return original;
          });
          if (lottieData.assets) newData.assets = lottieData.assets;
          const blob = new Blob([JSON.stringify(newData, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a'); link.href = url; link.download = `modified_${file.name}`; document.body.appendChild(link); link.click(); document.body.removeChild(link);
          alert(`Successfully exported Lottie JSON!\nNew Frame Rate: ${newData.fr}\nNew Duration: ${lottieParams.durationSeconds}s`);
      } catch (e) { console.error("Lottie Export Error", e); alert("Failed to export Lottie JSON"); }
  };

  const handleExportLottieToSVGA = async () => {
    if (!lottieData) return;
    try {
        setIsExporting(true);
        const zip = new window.JSZip();
        imageAssets.forEach(asset => {
            if (asset.src && asset.src.startsWith('data:')) {
                const b64 = asset.src.split(',')[1];
                const filename = `${asset.id}.png`;
                zip.file(filename, b64, { base64: true });
            }
        });
        zip.file("README.txt", "Lottie to SVGA conversion requires a backend vector rasterizer. This file contains extracted assets.");
        const blob = await zip.generateAsync({type: "blob"});
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a'); link.href = url; link.download = `${file.name.replace('.json', '')}.svga`; document.body.appendChild(link); link.click(); document.body.removeChild(link);
        alert("Exported SVGA Structure (Assets Only).\n\nNote: Full vector path conversion from Lottie to SVGA requires server-side processing.");
    } catch (e) { console.error(e); alert("Conversion failed"); } finally { setIsExporting(false); }
  };

  const handleResizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newWidth = parseInt(e.target.value, 10);
    if (!isNaN(newWidth) && displaySize.width > 0) {
      const aspectRatio = displaySize.height / displaySize.width;
      setDisplaySize({ width: newWidth, height: Math.round(newWidth * aspectRatio) });
    }
  };

  const handleAssetClick = (key: string) => { selectedAssetKeyRef.current = key; assetInputRef.current?.click(); };
  const handleAssetFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedAssetKeyRef.current) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const result = event.target?.result as string;
      if (result) {
        if (fileType === 'svga' && playerRef.current && svgaDataRef.current) {
             if (svgaDataRef.current.images && svgaDataRef.current.images[selectedAssetKeyRef.current]) {
                svgaDataRef.current.images[selectedAssetKeyRef.current] = result;
                await playerRef.current.mount(svgaDataRef.current);
                playerRef.current.start();
             }
        } else if (fileType === 'lottie' && lottieData) {
             const newData = JSON.parse(JSON.stringify(lottieData));
             const assetIndex = newData.assets?.findIndex((a: any) => a.id === selectedAssetKeyRef.current);
             if (assetIndex !== -1 && newData.assets) {
                 newData.assets[assetIndex].p = result; newData.assets[assetIndex].u = ''; newData.assets[assetIndex].e = 1; 
                 setLottieData(newData);
                 if (lottieAnimRef.current) lottieAnimRef.current.destroy();
                 if (window.lottie && lottieContainerRef.current) {
                    lottieAnimRef.current = window.lottie.loadAnimation({
                        container: lottieContainerRef.current, renderer: 'svg', loop: true, autoplay: true, animationData: newData 
                    });
                 }
             }
        }
        setImageAssets(prev => prev.map(asset => asset.id === selectedAssetKeyRef.current ? { ...asset, src: result } : asset));
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };
  
  const handleExportSVGA = async () => {
    if (!file || !svgaDataRef.current) return;
    if (!isEditable) { alert("Export failed\nThis file appears to be a legacy SVGA 1.x (Binary). Only SVGA 1.0 (Zip-based) files can be edited."); return; }
    try {
      setIsExporting(true); setExportStatus('Packaging SVGA...');
      const buffer = await file.arrayBuffer();
      const zip = new window.JSZip();
      await zip.loadAsync(buffer);
      const currentImages = svgaDataRef.current.images;
      if (currentImages) {
          for (const [key, value] of Object.entries(currentImages)) {
             let zipFileName = key;
             if (!zip.file(key) && zip.file(`${key}.png`)) zipFileName = `${key}.png`;
             else if (!zip.file(key)) {
                 const matchingAsset = imageAssets.find(a => a.id === key);
                 if (matchingAsset && matchingAsset.isLoose) zipFileName = matchingAsset.name; else continue;
             }
             if (typeof value === 'string' && value.startsWith('data:')) {
                 const base64Data = value.split(',')[1];
                 zip.file(zipFileName, base64Data, { base64: true });
             }
          }
      }
      imageAssets.forEach(asset => {
          if (asset.isLoose && asset.src?.startsWith('data:')) {
              const base64Data = asset.src.split(',')[1];
              zip.file(asset.name, base64Data, { base64: true });
          }
      });
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = `modified_${file.name}`; document.body.appendChild(link); link.click(); document.body.removeChild(link);
      setExportStatus('');
    } catch (err: any) { alert(err.message); setExportStatus('Failed'); } finally { setIsExporting(false); }
  };

  const normalizeSvgaJson = (movie: any) => {
    const imagesMap = movie.images || movie.imgs || movie.imagesMap || {};
    const width = movie.viewBoxWidth || movie.width || (movie.viewBox && movie.viewBox.width) || 800;
    const height = movie.viewBoxHeight || movie.height || (movie.viewBox && movie.viewBox.height) || 600;
    const fps = movie.fps || 30;
    const framesCount = movie.framesCount || movie.frames || 0;
    let duration = (typeof movie.duration === 'number' && movie.duration > 1000) ? movie.duration / 1000.0 : (movie.duration || (framesCount / fps) || 0);
    const manifest: any = { width, height, fps, duration, layers: [], images: Object.keys(imagesMap), raw_images_map: imagesMap };
    let srcList: any[] | null = null;
    if (movie.sprites) srcList = movie.sprites;
    if (!srcList) srcList = Object.keys(imagesMap).map(k => ({ __name: k, image: k, frames: [] }));

    manifest.layers = srcList.map((item: any, idx: number) => {
        const layerName = item.name || item.__name || `layer_${idx}`;
        const layerType = ((item.imageKey || item.img) ? 'image' : 'shape');
        const layerImage = item.imageKey || item.img || null;
        const layer: any = { name: layerName, type: layerType, image: layerImage, frames: [] };
        const rawFrames = item.frames || [];
        if (rawFrames.length > 0) {
            rawFrames.forEach((fr: any, fIdx: number) => {
                let t = fr.time !== undefined ? fr.time : fIdx;
                const frameData: any = { time: t };
                if (fr.alpha !== undefined) frameData.alpha = fr.alpha;
                const tf: any = {};
                if (fr.transform) { tf.a = fr.transform.a; tf.b = fr.transform.b; tf.c = fr.transform.c; tf.d = fr.transform.d; tf.tx = fr.transform.tx; tf.ty = fr.transform.ty; }
                if (Object.keys(tf).length > 0) frameData.transform = tf;
                layer.frames.push(frameData);
            });
        }
        return layer;
    });
    return manifest;
  };

  const handleExportManifest = async () => {
      if (!file || !file.name.endsWith('.svga')) return;
      try {
          setIsExporting(true);
          const outZip = new window.JSZip();
          const mainFolder = outZip.folder("Prestige_Designer");
          const imagesFolder = mainFolder?.folder("images");
          const svgFolder = mainFolder?.folder("exported_svg");
          const scriptsFolder = mainFolder?.folder("scripts");
          if (scriptsFolder) { scriptsFolder.file("Prestige_Converter.jsx", SVG_TO_AE_SCRIPT); scriptsFolder.file("Prestige_Extractor.jsx", SVGA_EXTRACTOR_SCRIPT); }
          let movieSpecContent: string | null = null;
          if (isEditable) {
              try {
                  const buffer = await file.arrayBuffer();
                  const zip = new window.JSZip();
                  await zip.loadAsync(buffer);
                  const files = Object.keys(zip.files);
                  for(const filename of files) {
                      const fileData = await zip.file(filename)?.async('blob');
                      if (fileData) {
                           mainFolder?.file(filename, fileData);
                           if (filename.includes('movie.spec') || filename.endsWith('.json')) movieSpecContent = await zip.file(filename)?.async('string') || null;
                      }
                  }
              } catch (zipErr) { console.warn("Could not read source zip:", zipErr); }
          } else { mainFolder?.file("README.txt", "Legacy SVGA 1.x (Binary). Raw extraction skipped."); }

          imageAssets.forEach(asset => {
              if (asset.src && asset.src.startsWith('data:')) {
                  const isSvg = asset.src.includes('image/svg+xml') || asset.name.toLowerCase().endsWith('.svg');
                  const b64 = asset.src.split(',')[1];
                  if (isSvg) { let name = asset.name; if (!name.endsWith('.svg')) name += '.svg'; svgFolder?.file(name, b64, { base64: true }); } 
                  else { let name = asset.name; if (!name.includes('.')) name += '.png'; imagesFolder?.file(name, b64, { base64: true }); }
              }
          });

          let manifest = null;
          if (movieSpecContent) { try { manifest = normalizeSvgaJson(JSON.parse(movieSpecContent)); } catch (e) {} } 
          if (!manifest && svgaDataRef.current) manifest = normalizeSvgaJson(svgaDataRef.current);
          if (manifest) mainFolder?.file("layers_manifest.json", JSON.stringify(manifest, null, 2));

          const blob = await outZip.generateAsync({type: "blob"});
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a'); link.href = url; link.download = "Prestige_Designer_Assets.zip"; document.body.appendChild(link); link.click(); document.body.removeChild(link);
      } catch (e) { console.error(e); alert("Export failed: " + (e as any).message); } finally { setIsExporting(false); }
  };

  const downloadAllImages = () => {
      if (imageAssets.length === 0) return;
      imageAssets.forEach((asset, i) => {
          if(!asset.src) return;
          setTimeout(() => {
              const link = document.createElement('a'); link.href = asset.src!;
              let ext = '.png';
              if (asset.name.toLowerCase().endsWith('.svg')) ext = ''; else if (asset.src!.startsWith('data:image/svg')) ext = '.svg';
              link.download = asset.name.includes('.') ? asset.name : `${asset.name}${ext}`;
              document.body.appendChild(link); link.click(); document.body.removeChild(link);
          }, i * 200);
      });
  };
  
  const handleAudioUploadClick = () => audioInputRef.current?.click();
  const handleAudioFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const url = URL.createObjectURL(file);
          setAudioFile(file); setAudioSrc(url); stopPlayback();
          setTimeout(() => {
              if (fileType === 'svga' && playerRef.current) playerRef.current.start();
              if (audioRef.current) { audioRef.current.src = url; audioRef.current.play(); }
              setIsPlaying(true);
          }, 500);
      }
  };

  const showServerRequiredAlert = (format: string) => {
    alert(`⚠️ Cannot export ${format} directly in browser!\n\nServer-Side Required... This conversion requires a backend processing engine.`);
  };

  const InfoTag = ({ label, value }: { label: string; value: string }) => (
    <div className="bg-[#1a1a1a] px-3 py-2 rounded text-xs border border-[#333] flex items-center gap-1">
      <span className="text-gray-400">{label}:</span>
      <span className="text-gray-200 font-medium truncate max-w-[100px]" title={value}>{value}</span>
    </div>
  );

  return (
    // Updated container: Allows vertical scrolling on mobile (min-h, overflow-y-auto) while keeping desktop fixed (lg:overflow-hidden)
    <div className="flex flex-col lg:flex-row lg:h-[calc(100vh-64px)] min-h-[calc(100vh-64px)] lg:overflow-hidden overflow-y-auto bg-black text-white">
      
      <input type="file" ref={assetInputRef} className="hidden" accept="image/*" onChange={handleAssetFileChange} />
      <input type="file" ref={audioInputRef} className="hidden" accept="audio/mp3,audio/wav" onChange={handleAudioFileChange} />
      <audio ref={audioRef} />

      {/* Sidebar: Assets (Mobile: Top, Desktop: Left) */}
      <div className="w-full lg:w-80 flex flex-col border-b lg:border-b-0 lg:border-r border-[#1a1a1a] bg-[#050505] flex-shrink-0 z-10 order-1 lg:order-1">
        {fileType === 'svga' && (
          <div className="p-4 border-b border-[#1a1a1a]">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-semibold text-gray-200">Audio</h3>
            </div>
            <div onClick={handleAudioUploadClick} className={`h-20 lg:h-24 border border-dashed rounded flex flex-col items-center justify-center cursor-pointer transition-all ${audioFile ? 'border-green-500/50 bg-green-500/5' : 'border-[#333] bg-[#0a0a0a] hover:border-[#555]'}`}>
              {audioFile ? (
                <>
                  <Music size={16} className="text-green-400 mb-2" />
                  <span className="text-xs text-green-400 font-medium truncate max-w-[200px]">{audioFile.name}</span>
                </>
              ) : (
                <>
                  <Plus size={16} className="text-[#00bfa5] mb-2" />
                  <span className="text-xs text-gray-500">Add .mp3</span>
                </>
              )}
            </div>
          </div>
        )}

        <div className="flex-1 flex flex-col p-4 overflow-hidden min-h-[200px] lg:min-h-0">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-semibold text-gray-200">Assets ({imageAssets.length})</h3>
            <button onClick={downloadAllImages} className="flex items-center gap-1.5 px-2 py-1 bg-[#1a1a1a] border border-[#333] rounded text-[10px] text-blue-400 hover:text-blue-300">
              <Download size={12} /> Save All
            </button>
          </div>
          <div className="grid grid-cols-4 lg:grid-cols-3 gap-3 overflow-y-auto pr-1 pb-4 custom-scrollbar content-start h-48 lg:h-auto">
            {imageAssets.length > 0 ? (
              imageAssets.map((asset) => (
                <div key={asset.id} className="flex flex-col gap-1 group">
                  <div onClick={() => (fileType === 'svga' || fileType === 'lottie') && handleAssetClick(asset.id)} className="aspect-square bg-[#0a0a0a] rounded border border-[#333] p-1 flex items-center justify-center hover:border-blue-500 cursor-pointer relative overflow-hidden">
                    {asset.src ? <img src={asset.src} alt={asset.name} className="w-full h-full object-contain" /> : <ImageIcon size={20} className="text-gray-700" />}
                    <div className="absolute inset-0 bg-blue-500/20 opacity-0 group-hover:opacity-100 flex items-center justify-center"><Upload size={16} className="text-white" /></div>
                  </div>
                  <span className="text-[10px] text-center text-gray-500 truncate" title={asset.name}>{asset.name}</span>
                </div>
              ))
            ) : (
              <div className="col-span-3 text-center py-8 text-gray-600 text-xs">{loading ? 'Scanning...' : 'No assets found'}</div>
            )}
          </div>
        </div>
      </div>

      {/* Main Preview Area (Mobile: Middle, Desktop: Center) */}
      <div className={`order-2 lg:order-2 flex-1 relative flex items-center justify-center overflow-hidden border-b lg:border-b-0 lg:border-r border-[#1a1a1a] transition-colors duration-300 min-h-[400px] lg:min-h-0 ${bgColor === 'white' ? 'bg-[#f0f0f0]' : bgColor === 'grid' ? 'bg-[url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkYGAQYcAP3uCTZhw1gGGYhAGBZIA/nYDCgBDAm9BGDWAAJyRCgLaBCAAgXwixzAS0pgAAAABJRU5ErkJggg==")]' : 'bg-black'}`}>
        
        <div className="absolute top-4 right-4 z-30 flex items-center gap-2 bg-[#1a1a1a] p-1.5 rounded-full border border-[#333] shadow-lg">
          <button onClick={() => setBgColor('black')} className={`w-7 h-7 rounded-full flex items-center justify-center ${bgColor === 'black' ? 'bg-neutral-800 text-white' : 'text-gray-500'}`}><Moon size={14} /></button>
          <button onClick={() => setBgColor('grid')} className={`w-7 h-7 rounded-full flex items-center justify-center ${bgColor === 'grid' ? 'bg-neutral-800 text-white' : 'text-gray-500'}`}><Grid size={14} /></button>
          <button onClick={() => setBgColor('white')} className={`w-7 h-7 rounded-full flex items-center justify-center ${bgColor === 'white' ? 'bg-neutral-200 text-black' : 'text-gray-500'}`}><Sun size={14} /></button>
        </div>

        {loading && <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80"><Loader2 className="animate-spin text-blue-500 mb-2" size={32} /><span className="text-sm text-gray-400">Loading {fileType.toUpperCase()}...</span></div>}

        {error ? (
           <div className="flex flex-col items-center justify-center text-center p-6 max-w-md bg-[#111] rounded-xl border border-[#333]">
             <AlertCircle className="text-red-500 mb-4" size={48} />
             <p className="text-gray-500 text-sm mb-6">{error}</p>
             <button onClick={handleRetry} className="flex items-center gap-2 px-4 py-2 bg-neutral-800 rounded-lg text-sm text-white border border-neutral-700"><RefreshCcw size={14} /> Retry</button>
           </div>
        ) : (
          <div className="relative w-full h-full flex items-center justify-center p-8 overflow-auto">
            {fileType === 'svga' && (
                <canvas 
                    ref={canvasRef} 
                    style={{ 
                        maxWidth: '100%',
                        maxHeight: '100%',
                        width: displaySize.width > 0 ? `${displaySize.width}px` : 'auto', 
                        height: displaySize.height > 0 ? `${displaySize.height}px` : 'auto',
                        transform: mirrorMode === 'horizontal' ? 'scaleX(-1)' : mirrorMode === 'vertical' ? 'scaleY(-1)' : 'none'
                    }}
                />
            )}
            {fileType === 'lottie' && (
                <div 
                    ref={lottieContainerRef}
                    style={{ 
                        maxWidth: '100%',
                        maxHeight: '100%',
                        width: displaySize.width > 0 ? `${displaySize.width}px` : '500px', 
                        height: displaySize.height > 0 ? `${displaySize.height}px` : '500px',
                    }}
                />
            )}
            
            {isExporting && exportStatus && (
                <div className="absolute inset-0 z-40 bg-black/80 flex flex-col items-center justify-center">
                    <Loader2 className="animate-spin text-green-500 mb-3" size={40} />
                    <p className="text-white font-medium">{exportStatus}</p>
                </div>
            )}
          </div>
        )}

        <div className="absolute bottom-8 z-30 flex gap-3">
           <button onClick={togglePlayback} className="w-12 h-12 rounded-full bg-[#1a1a1a] border border-[#333] flex items-center justify-center hover:bg-[#222] text-white shadow-lg">
             {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
           </button>
           <button onClick={stopPlayback} className="w-12 h-12 rounded-full bg-[#1a1a1a] border border-[#333] flex items-center justify-center hover:bg-[#222] text-red-500 shadow-lg">
             <Square size={18} fill="currentColor" />
           </button>
        </div>
      </div>

      {/* Right Sidebar - Properties (Mobile: Bottom, Desktop: Right) */}
      <div className="w-full lg:w-80 bg-[#050505] flex flex-col flex-shrink-0 border-l border-[#1a1a1a] z-10 order-3 lg:order-3">
        
        <div className="p-5 border-b border-[#1a1a1a]">
          <h3 className="text-xs font-bold text-[#666] mb-4 uppercase tracking-widest">Animation Info</h3>
          {fileType === 'svga' ? (
              <div className="grid grid-cols-2 gap-2">
                <InfoTag label="Format" value="SVGA" />
                <InfoTag label="Version" value={svgaInfo.version} />
                <InfoTag label="Resolution" value={`${svgaInfo.width} x ${svgaInfo.height}`} />
                <InfoTag label="Duration" value={svgaInfo.fps > 0 ? `${(svgaInfo.frames / svgaInfo.fps).toFixed(2)} S` : '-'} />
                <InfoTag label="File Size" value={fileSize} />
                <InfoTag label="FPS" value={`${svgaInfo.fps}`} />
              </div>
          ) : (
              <div className="grid grid-cols-2 gap-2">
                <InfoTag label="Format" value="Lottie" />
                <InfoTag label="Ver" value={lottieData?.v || '-'} />
                <InfoTag label="Res" value={`${lottieParams.w}x${lottieParams.h}`} />
                <InfoTag label="Dur" value={`${lottieParams.durationSeconds}s`} />
                <InfoTag label="Size" value={fileSize} />
                <InfoTag label="FPS" value={`${lottieParams.fr}`} />
              </div>
          )}
        </div>

        <div className="p-5 flex-1 overflow-y-auto custom-scrollbar min-h-[300px] lg:min-h-0">
          <h3 className="text-xs font-bold text-[#666] mb-4 uppercase tracking-widest">Animation Edit</h3>
          
          {fileType === 'svga' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-gray-300">Resize (px)</label>
                  <div className="flex gap-2 w-44">
                    <input type="number" value={displaySize.width || ''} onChange={handleResizeChange} className="bg-[#111] border border-[#333] rounded px-3 py-1.5 text-xs text-right text-white w-full focus:border-blue-600" />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-gray-300">Mirror Mode</label>
                  <div className="relative w-44">
                    <select value={mirrorMode} onChange={(e) => setMirrorMode(e.target.value as any)} className="bg-[#111] border border-[#333] rounded px-3 py-1.5 text-xs text-white w-full">
                      <option value="none">No Mirror</option>
                      <option value="horizontal">Horizontal</option>
                      <option value="vertical">Vertical</option>
                    </select>
                    <ChevronDown size={12} className="absolute right-2 top-2 text-gray-500 pointer-events-none" />
                  </div>
                </div>
                <button onClick={handleExportSVGA} disabled={isExporting || !isEditable} className={`w-full text-sm font-medium py-2.5 rounded-lg border flex items-center justify-center gap-2 ${isExporting || !isEditable ? 'bg-neutral-800 border-neutral-700 text-gray-500' : 'bg-blue-600 border-blue-500 text-white'}`}>
                    {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    {isEditable ? 'Export Modified SVGA' : 'Export N/A (Legacy)'}
                </button>
                {!isEditable && <p className="text-[10px] text-gray-500 mt-2">Legacy SVGA 1.x files cannot be edited. Please use SVGA 1.0 (Zip) files.</p>}
              </div>
          )}

          {fileType === 'lottie' && (
              <div className="space-y-6">
                 <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-gray-300 flex items-center gap-2"><Gauge size={14}/> Frame Rate</label>
                    <input type="number" value={lottieParams.fr} onChange={(e) => handleLottieParamChange('fr', e.target.value)} className="bg-[#111] border border-[#333] rounded px-3 py-1.5 text-xs text-right text-white w-24 focus:border-green-500 outline-none" />
                 </div>
                 <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-gray-300 flex items-center gap-2"><Clock size={14}/> Duration (s)</label>
                    <input type="number" value={lottieParams.durationSeconds} onChange={(e) => handleLottieParamChange('durationSeconds', e.target.value)} className="bg-[#111] border border-[#333] rounded px-3 py-1.5 text-xs text-right text-white w-24 focus:border-green-500 outline-none" />
                 </div>
                 <div className="pt-4 border-t border-[#1a1a1a]">
                    <button onClick={handleExportLottie} className="w-full text-sm font-medium py-2.5 rounded-lg bg-green-600 border border-green-500 text-white flex items-center justify-center gap-2 mb-3"><Save size={16} /> Export JSON</button>
                    <button onClick={handleExportLottieToSVGA} disabled={isExporting} className="w-full text-sm font-medium py-2.5 rounded-lg bg-[#222] border border-[#333] text-gray-300 hover:text-white flex items-center justify-center gap-2">
                         {isExporting ? <Loader2 size={16} className="animate-spin"/> : <ArrowRightLeft size={16} />} Convert to SVGA
                    </button>
                 </div>
              </div>
          )}
          
          <div className="mt-8 pt-6 border-t border-[#1a1a1a]">
             <h3 className="text-xs font-bold text-[#666] mb-4 uppercase tracking-widest">Tools</h3>
             <button onClick={() => showServerRequiredAlert("GIF")} className="w-full text-left text-xs text-gray-400 py-2 hover:text-white flex items-center gap-2"><FileVideo size={14}/> Convert to GIF</button>
             <button onClick={() => showServerRequiredAlert("WEBP")} className="w-full text-left text-xs text-gray-400 py-2 hover:text-white flex items-center gap-2"><Images size={14}/> Convert to WebP</button>
             <button onClick={handleConvertToMP4} disabled={isExporting} className="w-full text-left text-xs text-gray-400 py-2 hover:text-green-400 flex items-center gap-2"><FileVideo size={14}/> Convert to MP4</button>
              {fileType === 'svga' && (
                  <button onClick={handleExportManifest} disabled={isExporting} className="w-full text-left text-xs text-gray-400 py-2 hover:text-blue-400 flex items-center gap-2"><Layers size={14}/> Export AE Manifest</button>
              )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Editor;