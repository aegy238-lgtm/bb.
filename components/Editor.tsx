
import React, { useState, useEffect, useRef } from 'react';
import { Download, Plus, Search, ChevronDown, Disc, AlertCircle, Loader2, Image as ImageIcon, Grid, Moon, Sun, RefreshCcw, Pause, Play, Square, Upload, Music, Save, Images, FileVideo, FileJson, Clock, Gauge, ArrowRightLeft, Layers } from 'lucide-react';
import JSZip from 'jszip';
import protobuf from 'protobufjs';

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
// SVGAConverter_AE.jsx
// ExtendScript for After Effects
// Imports SVGA extracted assets and reconstructs them with a Progress Bar UI

(function svgaToAeWithProgress(){
    
    // 1. Select Folder
    var inputFolder = Folder.selectDialog("Select the folder containing extracted SVGA assets (images/svgs)");
    if(!inputFolder){
        return;
    }

    // Find valid files (SVG or PNG)
    var files = inputFolder.getFiles(function(f){ 
        return f instanceof File && (/\\.svg$/i.test(f.name) || /\\.png$/i.test(f.name)); 
    });

    if(files.length === 0){ 
        alert("No valid assets (SVG/PNG) found in folder."); 
        return; 
    }

    // 2. Setup Composition
    app.beginUndoGroup("SVGA Import");
    var compW = 1920, compH = 1080, compD = 10, compFPS = 30;
    
    // Try to find manifest to get real dimensions
    var manifestFile = new File(inputFolder.parent.fsName + "/layers_manifest.json");
    if(manifestFile.exists){
        manifestFile.open('r');
        try {
            var m = eval("(" + manifestFile.read() + ")");
            if(m.width) compW = m.width;
            if(m.height) compH = m.height;
            if(m.fps) compFPS = m.fps;
            if(m.duration) compD = m.duration;
        } catch(e){}
        manifestFile.close();
    }

    var mainComp = app.project.items.addComp("SVGA_Import_" + inputFolder.name, compW, compH, 1, compD, compFPS);

    // 3. UI Construction (Matching the screenshot style)
    var win = new Window("palette", "SVGA to AE Progress");
    win.orientation = "column";
    win.alignChildren = ["fill", "top"];
    win.spacing = 10;
    win.margins = 20;

    // Title
    var titleGroup = win.add("group");
    titleGroup.orientation = "row";
    titleGroup.add("statictext", undefined, "SVGA -> AE Conversion");

    // Progress Bar
    var pBar = win.add("progressbar", undefined, 0, files.length);
    pBar.preferredSize.width = 300;
    pBar.preferredSize.height = 20;

    // Status Text
    var stText = win.add("statictext", undefined, "Initializing...");
    stText.preferredSize.width = 300;

    win.show();

    // 4. Processing Loop
    try {
        for(var i=0; i<files.length; i++){
            var f = files[i];
            
            // Update UI
            pBar.value = i + 1;
            stText.text = "Processing " + (i + 1) + " / " + files.length + " sprite";
            win.update(); // Force UI redraw

            // Import Logic
            var importOptions = new ImportOptions(f);
            if (importOptions.canImportAs(ImportAsType.FOOTAGE)){
                var importedItem = app.project.importFile(importOptions);
                var layer = mainComp.layers.add(importedItem);
                
                // Basic center positioning
                layer.position.setValue([compW/2, compH/2]);
            }
            
            // Small sleep to ensure UI updates visually (optional)
            $.sleep(10); 
        }
    } catch(err) {
        alert("Error: " + err.toString());
    }

    win.close();
    app.endUndoGroup();
    alert("Import Complete!\\nCreated Comp: " + mainComp.name);

})();
`;

const SVGA_EXTRACTOR_SCRIPT = `/**
 * SVGAConverter_AE
 * ----------------
 * A dockable After Effects panel to extract vector assets from SVGA files.
 * Supports SVGA v1 (JSON) and v2 (Protobuf).
 * Cross-Platform: Windows (Powershell) & macOS (Unzip).
 */

{
    function SVGA_Extractor(thisObj) {
        
        // --- 1. UI BUILDER / بناء الواجهة ---
        function buildUI(thisObj) {
            var win = (thisObj instanceof Panel) ? thisObj : new Window("palette", "SVGAConverter_AE", undefined, {resizeable: true});
            win.orientation = "column";
            win.alignChildren = ["fill", "top"];
            win.spacing = 10;
            win.margins = 16;

            // Header
            var pnlHead = win.add("panel", undefined, "");
            pnlHead.alignment = "fill";
            var title = pnlHead.add("statictext", undefined, "SVGA → SVG Extractor");
            title.alignment = "center";
            title.graphics.font = ScriptUI.newFont("Tahoma", "BOLD", 16);
            
            // Input Group
            var grpInput = win.add("group");
            grpInput.orientation = "row";
            grpInput.alignChildren = ["fill", "center"];
            
            var txtPath = grpInput.add("edittext", undefined, "Select .svga file...");
            txtPath.size = [200, 25];
            
            var btnBrowse = grpInput.add("button", undefined, "Browse");
            
            // Console / Log Area
            var txtLog = win.add("edittext", undefined, "Ready...", {multiline: true, readonly: true});
            txtLog.size = [300, 150];
            
            // Action Button
            var btnExtract = win.add("button", undefined, "Extract Assets");
            btnExtract.size = [300, 40];
            btnExtract.enabled = false;

            // Footer
            var copyright = win.add("statictext", undefined, "v1.5 Cross-Platform");
            copyright.alignment = "right";
            copyright.graphics.foregroundColor = copyright.graphics.newPen(copyright.graphics.PenType.SOLID_COLOR, [0.5, 0.5, 0.5], 1);

            // --- EVENT HANDLERS / التفاعل ---
            var selectedFile = null;

            btnBrowse.onClick = function() {
                var f = File.openDialog("Select SVGA File", "SVGA Files:*.svga;All Files:*.*");
                if (f) {
                    selectedFile = f;
                    txtPath.text = f.fsName;
                    btnExtract.enabled = true;
                    log("Selected: " + f.name);
                }
            };

            btnExtract.onClick = function() {
                if (!selectedFile || !selectedFile.exists) {
                    alert("Please select a valid file.");
                    return;
                }
                txtLog.text = ""; // Clear log
                log("--- Starting Extraction ---");
                
                // Small delay to let UI update
                win.update();
                
                // Run Logic
                extractLogic(selectedFile);
            };

            function log(msg) {
                var d = new Date();
                var time = d.getHours() + ":" + d.getMinutes() + ":" + d.getSeconds();
                txtLog.text = "[" + time + "] " + msg + "\n" + txtLog.text;
            }

            // --- HELPER FUNCTIONS / دوال مساعدة ---
            
            function decodeBase64(data) {
                var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
                var result = [];
                var buffer = 0;
                var bits = 0;
                for (var i = 0; i < data.length; i++) {
                    var c = chars.indexOf(data.charAt(i));
                    if (c >= 0) {
                        buffer = (buffer << 6) + c;
                        bits += 6;
                        if (bits >= 8) {
                            bits -= 8;
                            result.push((buffer >> bits) & 0xFF);
                        }
                    }
                }
                return result;
            }

            function writeString(path, content) {
                var f = new File(path);
                f.encoding = "UTF-8";
                f.open("w");
                f.write(content);
                f.close();
            }

            // --- CORE LOGIC / منطق الاستخراج ---
            function extractLogic(file) {
                try {
                    // 1. Setup Folders
                    var unpackPath = file.path + "/_svga_unpack_" + new Date().getTime();
                    var unpack = Folder(unpackPath);
                    if (!unpack.exists) unpack.create();

                    // 2. Unzip (Cross-Platform)
                    log("Unzipping archive...");
                    var cmd = "";
                    var isWin = ($.os.indexOf("Windows") !== -1);
                    
                    if (isWin) {
                        // Powershell for Windows
                        cmd = 'powershell -command "Expand-Archive -LiteralPath \'' + file.fsName + '\' -DestinationPath \'' + unpack.fsName + '\' -Force"';
                    } else {
                        // Unzip for Mac
                        cmd = 'unzip -o "' + file.fsName + '" -d "' + unpack.fsName + '"';
                    }
                    
                    var exitCode = system.callSystem(cmd);
                    
                    // Check if folder has content
                    var checkFile = unpack.getFiles();
                    if (checkFile.length === 0) {
                        log("ERROR: Unzip failed or empty.");
                        log("System Response: " + exitCode);
                        return;
                    }

                    var exported = Folder(unpack.fsName + "/exported_svg");
                    if (!exported.exists) exported.create();

                    var extractedCount = 0;

                    // 3. Process v1 (movie.spec) - JSON Format
                    var specFile = File(unpack.fsName + "/movie.spec");
                    if (specFile.exists) {
                        log("Found v1 (movie.spec)...");
                        specFile.open("r");
                        specFile.encoding = "UTF-8";
                        var specData = specFile.read();
                        specFile.close();
                        
                        try {
                            var json = eval("(" + specData + ")");
                            var assets = json.images || {};
                            
                            for (var name in assets) {
                                var img = assets[name];
                                if (typeof img === 'string' && img.indexOf("data:image/svg+xml;base64,") === 0) {
                                    var base64 = img.split(",")[1];
                                    var decoded = decodeBase64(base64);
                                    var svg = "";
                                    for (var i = 0; i < decoded.length; i++) {
                                        svg += String.fromCharCode(decoded[i]);
                                    }
                                    writeString(exported.fsName + "/" + name + ".svg", svg);
                                    extractedCount++;
                                }
                            }
                        } catch (e) {
                            log("Error parsing Spec: " + e.message);
                        }
                    }

                    // 4. Process v2 (movie.binary) - Protobuf Format
                    var binaryFile = File(unpack.fsName + "/movie.binary");
                    if (binaryFile.exists) {
                        log("Found v2 (movie.binary)...");
                        binaryFile.encoding = "BINARY"; 
                        binaryFile.open("r");
                        var binData = binaryFile.read();
                        binaryFile.close();

                        // Regex extraction for SVG tags
                        var matches = binData.match(/<svg[\s\S]*?<\/svg>/g);
                        if (matches) {
                            for (var j = 0; j < matches.length; j++) {
                                writeString(exported.fsName + "/vector_" + j + ".svg", matches[j]);
                                extractedCount++;
                            }
                        }
                    }

                    // 5. Process /images/ folder (Assets)
                    var imagesFolder = Folder(unpack.fsName + "/images");
                    if (imagesFolder.exists) {
                        log("Checking images folder...");
                        var imgFiles = imagesFolder.getFiles();
                        for (var k = 0; k < imgFiles.length; k++) {
                            var f = imgFiles[k];
                            if (f instanceof File) {
                                // Direct SVGs
                                if (f.name.match(/\.svg$/i)) {
                                    f.copy(exported.fsName + "/" + f.name);
                                    extractedCount++;
                                }
                                // Hidden Base64 inside txt/json/png
                                else if (f.name.match(/\.(txt|json|png)$/i) && f.length < 2000000) {
                                    f.open("r");
                                    var content = f.read();
                                    f.close();
                                    if (content.indexOf("data:image/svg+xml;base64,") >= 0) {
                                        var b64 = content.split(",")[1];
                                        var dec = decodeBase64(b64);
                                        var svgStr = "";
                                        for (var x = 0; x < dec.length; x++) {
                                            svgStr += String.fromCharCode(dec[x]);
                                        }
                                        writeString(exported.fsName + "/" + f.name + ".svg", svgStr);
                                        extractedCount++;
                                    }
                                }
                            }
                        }
                    }

                    log("SUCCESS! Extracted " + extractedCount + " files.");
                    log("Folder: " + exported.fsName);
                    
                    // Open folder in Explorer/Finder
                    if (isWin) {
                         system.callSystem("explorer " + Folder(exported.fsName).fsName);
                    } else {
                         system.callSystem("open " + Folder(exported.fsName).fsName);
                    }

                } catch (err) {
                    log("CRITICAL ERROR: " + err.line + " - " + err.message);
                    alert(err.message);
                }
            }

            win.layout.layout(true);
            return win;
        }

        var myScriptPal = buildUI(thisObj);
        if (myScriptPal != null && myScriptPal instanceof Window) {
            myScriptPal.center();
            myScriptPal.show();
        }
    }

    SVGA_Extractor(this);
}
`;

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

  // Main Loading Logic (Switch between SVGA and Lottie)
  useEffect(() => {
    let isActive = true;

    const loadFile = async () => {
      if (!file) return;

      // Reset states
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
      
      if (audioRef.current) {
        audioRef.current.src = "";
      }

      // Cleanup previous players
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

      // Detect File Type
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

  // Helper function to extract embedded SVGs from text content (Lottie/JSON/Scripts)
  // Mimics the logic of the provided extract_svga.jsx script
  const extractEmbeddedSVGs = (text: string): Asset[] => {
    const assets: Asset[] = [];
    let idx = 0;

    // 1. Inline <svg> tags
    const svgRegex = /<svg[\s\S]*?<\/svg>/gi;
    let match;
    while ((match = svgRegex.exec(text)) !== null) {
       const svgContent = match[0];
       const blob = new Blob([svgContent], { type: 'image/svg+xml' });
       assets.push({
           id: `embedded_svg_${idx}`,
           name: `embedded_svg_${idx}.svg`,
           src: URL.createObjectURL(blob),
           type: 'image',
           isLoose: true
       });
       idx++;
    }

    // 2. Base64 Data URI
    // Captures both data:image/svg+xml;base64,... and data:image/svg+xml;charset=...;base64,...
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
                assets.push({
                    id: `data_svg_${idx}`,
                    name: `extracted_b64_${idx}.svg`,
                    src: URL.createObjectURL(blob),
                    type: 'image',
                    isLoose: true
                });
                idx++;
            } catch(e) { console.warn("Failed to decode base64 svg", e); }
        }
    }
    
    // 3. URL Encoded Data URI
    const urlEncRegex = /data:image\/svg\+xml(?:;[^,]*)?,([^"'()\s>]+)/gi;
    while ((match = urlEncRegex.exec(text)) !== null) {
        const raw = match[1];
        try {
            const decoded = decodeURIComponent(raw);
            if (decoded.includes('<svg')) {
                 const blob = new Blob([decoded], { type: 'image/svg+xml' });
                 assets.push({
                    id: `url_svg_${idx}`,
                    name: `extracted_url_${idx}.svg`,
                    src: URL.createObjectURL(blob),
                    type: 'image',
                    isLoose: true
                });
                idx++;
            }
        } catch(e) {}
    }

    return assets;
  };

  const loadSvga = async (isActive: boolean) => {
    try {
        if (file.size === 0) throw new Error("The uploaded file is empty.");

        // Wait for SVGA library
        let SVGALib = window.SVGA || window.svga;
        if (!SVGALib) {
          for (let i = 0; i < 20; i++) {
            await new Promise(r => setTimeout(r, 200));
            if (window.SVGA || window.svga) { 
                SVGALib = window.SVGA || window.svga; 
                break; 
            }
          }
        }
        if (!SVGALib) throw new Error("SVGA Library could not be loaded. Please refresh.");

        const buffer = await file.arrayBuffer();
        const data = new Uint8Array(buffer);
        
        // Check for Zip (SVGA 2.0 vs 1.0)
        let isZip = false;
        try {
            // PK magic bytes (0x50 0x4B)
            if (data.length > 4 && data[0] === 0x50 && data[1] === 0x4B) {
                const checkZip = new JSZip();
                await checkZip.loadAsync(buffer);
                isZip = true;
            }
        } catch (e) {
            console.warn("Not a zip SVGA or check failed", e);
        }
        setIsEditable(isZip);
        
        // Initialize Parser (Always create fresh instance to avoid stale state)
        parserRef.current = new SVGALib.Parser();
        
        let svgaData;
        try {
            svgaData = await parserRef.current.do(data);
        } catch (parserError: any) {
            console.error("SVGA Parser Error:", parserError);
            // Catch generic script errors that often occur with SVGA Lite on malformed files
            throw new Error("Unable to parse SVGA file. The file appears to be corrupted or incompatible.");
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
        
        setDisplaySize({
          width: svgaData.videoSize.width,
          height: svgaData.videoSize.height
        });

        // 1. Extract images using standard SVGA Parser (Primary - used for playback)
        const assetsMap = new Map<string, Asset>();
        if (svgaData.images) {
          Object.keys(svgaData.images).forEach((key) => {
            const imgData = svgaData.images[key];
            let src = '';
            if (typeof imgData === 'string') {
                src = imgData.startsWith('data:') ? imgData : `data:image/png;base64,${imgData}`;
            } else if (imgData instanceof Uint8Array) {
                const blob = new Blob([imgData], { type: 'image/png' });
                src = URL.createObjectURL(blob);
            }
            if (src) assetsMap.set(key, { id: key, name: key, src: src, type: 'image' });
          });
        }

        // 2. Deep Scan using JSZip (Replica of python extract_svga.py logic)
        // Wrapped in try/catch so it doesn't fail the entire load if zip is weird
        if (isZip) {
            try {
                const zip = new JSZip();
                await zip.loadAsync(buffer);
                
                const loosePromises: Promise<void>[] = [];
                zip.forEach((relativePath, zipEntry) => {
                    if (zipEntry.dir) return;

                    // 2a. Direct file extraction (png, jpg, svg...)
                    if (/\.(png|jpg|jpeg|gif|webp|svg)$/i.test(relativePath)) {
                        loosePromises.push((async () => {
                            try {
                                const filename = relativePath.split('/').pop() || relativePath;
                                // Check both full path and filename to avoid duplicates if parser found them
                                if (!assetsMap.has(relativePath) && !assetsMap.has(filename)) {
                                    const blob = await zipEntry.async('blob');
                                    const src = URL.createObjectURL(blob);
                                    assetsMap.set(relativePath, { 
                                        id: relativePath, 
                                        name: relativePath, 
                                        src, 
                                        type: 'image',
                                        isLoose: true
                                    });
                                }
                            } catch (e) {
                                console.warn("Failed to extract asset:", relativePath);
                            }
                        })());
                    }

                    // 2b. JSON Deep Scan (mimic decode_base64_images_from_json)
                    // Parses json files inside zip to find base64 image definitions
                    if (relativePath.toLowerCase().endsWith('.json')) {
                        loosePromises.push((async () => {
                            try {
                                const jsonText = await zipEntry.async('string');
                                const json = JSON.parse(jsonText);
                                const imagesMap = json.images || json.imagesMap || {};
                                
                                Object.entries(imagesMap).forEach(([key, val]: [string, any]) => {
                                    let b64 = '';
                                    if (typeof val === 'string' && val.startsWith('data:')) {
                                        b64 = val;
                                    } else if (typeof val === 'object' && val !== null) {
                                        const raw = val.base64 || val.data;
                                        if (typeof raw === 'string' && raw.startsWith('data:')) {
                                            b64 = raw;
                                        }
                                    }

                                    if (b64) {
                                        // Try to derive name
                                        let name = key;
                                        if (!name.includes('.')) {
                                             const match = b64.match(/data:image\/([a-zA-Z]+);/);
                                             if (match && match[1]) {
                                                 name += `.${match[1] === 'jpeg' ? 'jpg' : match[1]}`;
                                             } else {
                                                 name += '.png';
                                             }
                                        }

                                        if (!assetsMap.has(key)) {
                                            assetsMap.set(key, {
                                                id: key,
                                                name: name,
                                                src: b64,
                                                type: 'image',
                                                isLoose: true
                                            });
                                        }
                                    }
                                });
                            } catch (e) {
                                // Ignore json parsing errors for non-relevant files
                            }
                        })());
                    }
                });
                await Promise.all(loosePromises);
            } catch (e) {
                console.warn("Deep scan failed, proceeding with basic assets only", e);
            }
        }

        setImageAssets(Array.from(assetsMap.values()));

        // Mount Player
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
          // Clean up "Script error." which is generic
          if (!msg || msg === "Script error.") {
              msg = "Error parsing file. Please ensure it is a valid, uncorrupted SVGA file.";
          }
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
        setIsEditable(true); // JSON is always text-editable client side

        // Extract metadata
        const fr = json.fr || 30;
        const op = json.op || 0;
        const ip = json.ip || 0;
        const w = json.w || 500;
        const h = json.h || 500;
        const duration = (op - ip) / fr;

        setLottieParams({
            fr, op, ip, w, h,
            durationSeconds: parseFloat(duration.toFixed(2))
        });
        
        setDisplaySize({ width: w, height: h });

        // Extract Standard Lottie Assets
        const assets: Asset[] = [];
        if (json.assets && Array.isArray(json.assets)) {
            json.assets.forEach((asset: any) => {
                if (asset.p && asset.p.startsWith('data:')) {
                    assets.push({ id: asset.id, name: asset.id, src: asset.p, type: 'image' });
                } else if (asset.p) {
                   // External path - can't really preview easily without base path, assume placeholder
                   assets.push({ id: asset.id, name: asset.id, src: '', type: 'image' });
                }
            });
        }

        // Run Embedded SVG Extractor (Deep Scan for Lottie/JSON)
        const embeddedSVGs = extractEmbeddedSVGs(text);
        assets.push(...embeddedSVGs);

        setImageAssets(assets);

        // Wait for Lottie lib
        if (!window.lottie) {
             await new Promise(r => setTimeout(r, 500)); // Simple wait
        }

        if (window.lottie && lottieContainerRef.current) {
            lottieAnimRef.current = window.lottie.loadAnimation({
                container: lottieContainerRef.current,
                renderer: 'svg',
                loop: true,
                autoplay: true,
                animationData: JSON.parse(JSON.stringify(json)) // Deep copy to prevent mutation issues
            });
        }
        setLoading(false);

    } catch (err: any) {
        console.error(err);
        if (isActive) {
            setError("Failed to parse Lottie JSON file.");
            setLoading(false);
        }
    }
  };

  const handleRetry = () => {
    setRetryTrigger(prev => prev + 1);
  };

  // --- Playback Controls ---
  const togglePlayback = () => {
    setIsPlaying(!isPlaying);
    
    if (fileType === 'svga' && playerRef.current) {
        if (isPlaying) {
             playerRef.current.pause ? playerRef.current.pause() : playerRef.current.stop();
             if (audioRef.current) audioRef.current.pause();
        } else {
             playerRef.current.start();
             if (audioRef.current && audioSrc) audioRef.current.play();
        }
    } else if (fileType === 'lottie' && lottieAnimRef.current) {
        if (isPlaying) {
            lottieAnimRef.current.pause();
        } else {
            lottieAnimRef.current.play();
        }
    }
  };

  const stopPlayback = () => {
    setIsPlaying(false);
    if (fileType === 'svga' && playerRef.current) {
        playerRef.current.stop();
        playerRef.current.clear();
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
    } else if (fileType === 'lottie' && lottieAnimRef.current) {
        lottieAnimRef.current.stop();
    }
  };

  // --- Lottie Editing Logic ---
  const handleLottieParamChange = (key: 'fr' | 'durationSeconds', value: string) => {
      const numValue = parseFloat(value);
      if (isNaN(numValue) || numValue <= 0) return;

      if (key === 'fr') {
          const newOp = lottieParams.ip + (numValue * lottieParams.durationSeconds);
          setLottieParams(prev => ({ ...prev, fr: numValue, op: newOp }));
      } else if (key === 'durationSeconds') {
          const newOp = lottieParams.ip + (lottieParams.fr * numValue);
          setLottieParams(prev => ({ ...prev, durationSeconds: numValue, op: newOp }));
      }
  };

  const handleExportLottie = () => {
      if (!lottieData) return;
      try {
          const newData = JSON.parse(JSON.stringify(lottieData));
          newData.fr = lottieParams.fr;
          newData.op = lottieParams.op;
          newData.assets = imageAssets.map(asset => {
              // Standard asset update
              const original = lottieData.assets?.find((a: any) => a.id === asset.id);
              if (original && asset.src?.startsWith('data:')) {
                  return { ...original, p: asset.src, u: '', e: 1 };
              }
              return original;
          });
          if (lottieData.assets) newData.assets = lottieData.assets;

          const blob = new Blob([JSON.stringify(newData, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `modified_${file.name}`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          alert(`Successfully exported Lottie JSON!\nNew Frame Rate: ${newData.fr}\nNew Duration: ${lottieParams.durationSeconds}s`);
      } catch (e) {
          console.error("Lottie Export Error", e);
          alert("Failed to export Lottie JSON");
      }
  };

  const handleExportLottieToSVGA = async () => {
    if (!lottieData) return;
    try {
        setIsExporting(true);
        // Load Protobuf Schema (Ideally this is loaded once)
        // Since we can't fetch external .proto files easily in this env without setup, 
        // we'll construct the protobuf definition dynamically or use a simplified mock for the shell.
        
        // IMPORTANT: In a real app, you would load "svga.proto" here.
        // For this demo, we will construct a valid SVGA 2.0 Zip structure manually 
        // using the assets and a binary placeholder or minimal data.
        
        // 1. Prepare Zip
        const zip = new JSZip();
        
        // 2. Add Images from Lottie
        const imagesMap: Record<string, any> = {};
        imageAssets.forEach(asset => {
            if (asset.src && asset.src.startsWith('data:')) {
                const b64 = asset.src.split(',')[1];
                // Use asset ID as filename
                const filename = `${asset.id}.png`;
                zip.file(filename, b64, { base64: true });
                // We don't have real vector conversion here (server side required), 
                // so this is a structural export.
            }
        });

        // 3. Create a dummy movie.binary (Protobuf) 
        // To make it a valid SVGA, it needs a movie.binary.
        // Without the proto definition loaded, we can't encode valid protobuf.
        // We will create a text file explaining this limitation in the zip.
        zip.file("README.txt", "Lottie to SVGA conversion requires a backend vector rasterizer. This file contains extracted assets.");

        // 4. Download
        const blob = await zip.generateAsync({type: "blob"});
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${file.name.replace('.json', '')}.svga`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        alert("Exported SVGA Structure (Assets Only).\n\nNote: Full vector path conversion from Lottie to SVGA requires server-side processing.");
    } catch (e) {
        console.error(e);
        alert("Conversion failed");
    } finally {
        setIsExporting(false);
    }
  };

  // --- SVGA Specific Handlers ---
  const handleResizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newWidth = parseInt(e.target.value, 10);
    if (!isNaN(newWidth) && displaySize.width > 0) {
      const aspectRatio = displaySize.height / displaySize.width;
      setDisplaySize({
        width: newWidth,
        height: Math.round(newWidth * aspectRatio)
      });
    }
  };

  const handleAssetClick = (key: string) => {
      selectedAssetKeyRef.current = key;
      assetInputRef.current?.click();
  };

  const handleAssetFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedAssetKeyRef.current) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const result = event.target?.result as string;
      if (result) {
        if (fileType === 'svga' && playerRef.current && svgaDataRef.current) {
             // Check if the key exists in the active SVGA data
             if (svgaDataRef.current.images && svgaDataRef.current.images[selectedAssetKeyRef.current]) {
                svgaDataRef.current.images[selectedAssetKeyRef.current] = result;
                await playerRef.current.mount(svgaDataRef.current);
                playerRef.current.start();
             } else {
                 // Loose file replacement (visual only, won't affect playback if not used by frames)
                 console.log("Replaced loose asset:", selectedAssetKeyRef.current);
             }
        } else if (fileType === 'lottie' && lottieData) {
             // Lottie Logic
             const newData = JSON.parse(JSON.stringify(lottieData));
             const assetIndex = newData.assets?.findIndex((a: any) => a.id === selectedAssetKeyRef.current);
             if (assetIndex !== -1 && newData.assets) {
                 newData.assets[assetIndex].p = result;
                 newData.assets[assetIndex].u = ''; 
                 newData.assets[assetIndex].e = 1; 
                 setLottieData(newData);
                 if (lottieAnimRef.current) lottieAnimRef.current.destroy();
                 if (window.lottie && lottieContainerRef.current) {
                    lottieAnimRef.current = window.lottie.loadAnimation({
                        container: lottieContainerRef.current,
                        renderer: 'svg',
                        loop: true,
                        autoplay: true,
                        animationData: newData 
                    });
                 }
             }
        }
        
        // Update UI Assets list
        setImageAssets(prev => prev.map(asset => 
          asset.id === selectedAssetKeyRef.current ? { ...asset, src: result } : asset
        ));
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };
  
  const handleExportSVGA = async () => {
    if (!file || !svgaDataRef.current) return;
    if (!isEditable) {
      alert("Export failed\nThis file appears to be a legacy SVGA 1.x (Binary) or corrupted file. Only SVGA 1.0 (Zip-based) files can be edited and exported.");
      return;
    }
    try {
      setIsExporting(true);
      setExportStatus('Packaging SVGA...');
      const buffer = await file.arrayBuffer();
      const zip = new JSZip();
      await zip.loadAsync(buffer);
      
      // We update the zip with all current image assets (including deep scanned loose ones if they were modified)
      // Note: We prioritize the ones in svgaData.images as they are the ones used for rendering
      const currentImages = svgaDataRef.current.images;
      
      // 1. Update active images
      if (currentImages) {
          for (const [key, value] of Object.entries(currentImages)) {
             let zipFileName = key;
             // Try to find the correct filename in the zip
             if (!zip.file(key) && zip.file(`${key}.png`)) zipFileName = `${key}.png`;
             else if (!zip.file(key)) {
                 // If not found directly, check if we have a matching asset with loose file logic
                 const matchingAsset = imageAssets.find(a => a.id === key);
                 if (matchingAsset && matchingAsset.isLoose) zipFileName = matchingAsset.name;
                 else continue; // Skip if we can't map it back to a file
             }
    
             if (typeof value === 'string' && value.startsWith('data:')) {
                 const base64Data = value.split(',')[1];
                 zip.file(zipFileName, base64Data, { base64: true });
             }
          }
      }
      
      // 2. Update loose assets that might have been replaced but are not in svgaData.images
      imageAssets.forEach(asset => {
          if (asset.isLoose && asset.src?.startsWith('data:')) {
              const base64Data = asset.src.split(',')[1];
              zip.file(asset.name, base64Data, { base64: true });
          }
      });

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `modified_${file.name}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setExportStatus('');
    } catch (err: any) {
      alert(err.message);
      setExportStatus('Failed');
    } finally {
      setIsExporting(false);
    }
  };

  // --- Logic ported from extract_svga.py ---
  const normalizeSvgaJson = (movie: any) => {
    // 1. Build simplified manifest
    const imagesMap = movie.images || movie.imgs || movie.imagesMap || {};
    
    // Determine viewBox/fps/duration
    const width = movie.viewBoxWidth || movie.width || (movie.viewBox && movie.viewBox.width) || 800;
    const height = movie.viewBoxHeight || movie.height || (movie.viewBox && movie.viewBox.height) || 600;
    const fps = movie.fps || 30;
    const framesCount = movie.framesCount || movie.frames || 0;
    let duration = 0;
    if (typeof movie.duration === 'number' && movie.duration > 1000) {
        duration = movie.duration / 1000.0;
    } else {
        duration = movie.duration || (framesCount / fps) || 0;
    }

    const manifest: any = {
        width,
        height,
        fps,
        duration,
        layers: [],
        images: Object.keys(imagesMap),
        raw_images_map: imagesMap
    };

    // 2. Find sprites/layers/objects list
    let srcList: any[] | null = null;
    const candidates = ["sprites", "layers", "objects", "elements"];
    for (const key of candidates) {
        if (movie[key] && Array.isArray(movie[key])) {
            srcList = movie[key];
            break;
        }
    }

    // Fallback: Check if movie has object keys with 'frames'
    if (!srcList) {
        const potentialLayers = [];
        for (const [k, v] of Object.entries(movie)) {
            if (v && typeof v === 'object' && !Array.isArray(v)) {
                // Check inner values
                const inner = Object.values(v)[0] as any;
                if (inner && (inner.frames || inner.transform || inner.matrix)) {
                     // Flatten this dict into layers
                     for (const [name, obj] of Object.entries(v)) {
                         potentialLayers.push({ ...obj as any, __name: name });
                     }
                }
            }
        }
        if (potentialLayers.length > 0) srcList = potentialLayers;
    }

    // Fallback: Create layers from images
    if (!srcList) {
        srcList = Object.keys(imagesMap).map(k => ({ __name: k, image: k, frames: [] }));
    }

    // 3. Normalize layers
    manifest.layers = srcList.map((item: any, idx: number) => {
        const layerName = item.name || item.__name || item.id || `layer_${idx}`;
        const layerType = item.type || ((item.image || item.res || item.img) ? 'image' : 'shape');
        const layerImage = item.image || item.img || item.res || null;

        const layer: any = {
            name: layerName,
            type: layerType,
            image: layerImage,
            frames: []
        };

        const rawFrames = item.frames || item.actions || item.tween || item.keyframes || [];
        
        if (rawFrames.length > 0) {
            rawFrames.forEach((fr: any) => {
                let t = fr.time;
                if (t === undefined) t = fr.frame;
                if (t === undefined) t = fr.index;
                
                // Copy transform props
                const transform: any = {};
                for (const k in fr) {
                    if (k !== 'time' && k !== 'frame' && k !== 'index') {
                        transform[k] = fr[k];
                    }
                }
                layer.frames.push({ time: t, transform });
            });
        } else {
             // Look for static transform
             const staticT: any = {};
             ['x','y','scaleX','scaleY','rotation','alpha','matrix','transform','tx','ty'].forEach(k => {
                 if (item[k] !== undefined) staticT[k] = item[k];
             });
             if (Object.keys(staticT).length > 0) {
                 layer.frames.push({ time: 0, transform: staticT });
             }
        }

        return layer;
    });

    return manifest;
  };

  const handleExportManifest = async () => {
      if (!file || !file.name.endsWith('.svga')) return;
      try {
          setIsExporting(true);
          
          const outZip = new JSZip();
          // Create the structure requested: SVGAConverter_AE at root
          const mainFolder = outZip.folder("SVGAConverter_AE");
          const imagesFolder = mainFolder?.folder("images");
          const svgFolder = mainFolder?.folder("exported_svg");
          const scriptsFolder = mainFolder?.folder("scripts");
          
          if (scriptsFolder) {
              scriptsFolder.file("SVGAConverter_AE.jsx", SVG_TO_AE_SCRIPT);
              scriptsFolder.file("extract_svg_from_svga.jsx", SVGA_EXTRACTOR_SCRIPT);
          }

          let movieSpecContent: string | null = null;

          // 1. Raw Extraction to SVGAConverter_AE root
          if (isEditable) {
              try {
                  const buffer = await file.arrayBuffer();
                  const zip = new JSZip();
                  await zip.loadAsync(buffer);
    
                  const files = Object.keys(zip.files);
                  for(const filename of files) {
                      const fileData = await zip.file(filename)?.async('blob');
                      if (fileData) {
                           // Place raw files in root
                           mainFolder?.file(filename, fileData);
                           
                           if ((filename.includes('movie') && (filename.endsWith('.spec') || filename.endsWith('.json'))) || filename === 'movie.spec') {
                               movieSpecContent = await zip.file(filename)?.async('string') || null;
                           }
                      }
                  }
              } catch (zipErr) {
                  console.warn("Could not read source file as zip:", zipErr);
              }
          } else {
              // Legacy file handling: Add a note
              mainFolder?.file("README.txt", "This source file is a legacy SVGA 1.x (Binary) container. Raw file extraction is not possible. Images and Manifest have been reconstructed from parsed data.");
          }

          // 2. Export Assets (Images vs SVGs)
          imageAssets.forEach(asset => {
              if (asset.src && asset.src.startsWith('data:')) {
                  const isSvg = asset.src.includes('image/svg+xml') || asset.name.toLowerCase().endsWith('.svg');
                  const b64 = asset.src.split(',')[1];
                  
                  if (isSvg) {
                      let name = asset.name;
                      if (!name.toLowerCase().endsWith('.svg')) name += '.svg';
                      svgFolder?.file(name, b64, { base64: true });
                  } else {
                      let name = asset.name;
                      if (!name.includes('.')) name += '.png';
                      imagesFolder?.file(name, b64, { base64: true });
                  }
              }
          });

          // 3. Generate layers_manifest.json
          let manifest = null;
          if (movieSpecContent) {
              try {
                  const movie = JSON.parse(movieSpecContent);
                  manifest = normalizeSvgaJson(movie);
              } catch (e) {
                  console.error("Failed to parse movie spec for manifest", e);
              }
          } 
          
          if (!manifest && svgaDataRef.current) {
              // Fallback: build from svga-lite parsed data (less accurate but works)
               manifest = normalizeSvgaJson(svgaDataRef.current);
          }

          if (manifest) {
              mainFolder?.file("layers_manifest.json", JSON.stringify(manifest, null, 2));
          }

          // 4. Download
          const blob = await outZip.generateAsync({type: "blob"});
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = "SVGAConverter_AE.zip"; 
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

      } catch (e) {
          console.error(e);
          alert("Export manifest failed: " + (e as any).message);
      } finally {
          setIsExporting(false);
      }
  };

  const downloadAllImages = () => {
      if (imageAssets.length === 0) return;
      imageAssets.forEach((asset, i) => {
          if(!asset.src) return;
          setTimeout(() => {
              const link = document.createElement('a');
              link.href = asset.src!;
              // Detect extension for proper download name
              let ext = '.png';
              if (asset.name.toLowerCase().endsWith('.svg')) ext = ''; 
              else if (asset.src!.startsWith('data:image/svg')) ext = '.svg';
              
              link.download = asset.name.includes('.') ? asset.name : `${asset.name}${ext}`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
          }, i * 200);
      });
  };
  
  const handleAudioUploadClick = () => audioInputRef.current?.click();
  const handleAudioFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const url = URL.createObjectURL(file);
          setAudioFile(file);
          setAudioSrc(url);
          stopPlayback();
          setTimeout(() => {
              if (fileType === 'svga' && playerRef.current) playerRef.current.start();
              if (audioRef.current) { audioRef.current.src = url; audioRef.current.play(); }
              setIsPlaying(true);
          }, 500);
      }
  };

  const showServerRequiredAlert = (format: string) => {
    alert(`⚠️ Cannot export ${format} directly in browser!\n\nServer-Side Required... This conversion usually requires a backend processing engine (FFmpeg, Lottie-Node) to render vector graphics to video or convert formats losslessly.`);
  };

  const InfoTag = ({ label, value }: { label: string; value: string }) => (
    <div className="bg-[#1a1a1a] px-3 py-2 rounded text-xs border border-[#333] flex items-center gap-1">
      <span className="text-gray-400">{label}:</span>
      <span className="text-gray-200 font-medium truncate max-w-[100px]" title={value}>{value}</span>
    </div>
  );

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-64px)] overflow-hidden bg-black text-white">
      
      <input type="file" ref={assetInputRef} className="hidden" accept="image/*" onChange={handleAssetFileChange} />
      <input type="file" ref={audioInputRef} className="hidden" accept="audio/mp3,audio/wav" onChange={handleAudioFileChange} />
      <audio ref={audioRef} />

      {/* Sidebar: Assets */}
      <div className="w-full lg:w-80 flex flex-col border-r border-[#1a1a1a] bg-[#050505] flex-shrink-0 z-10">
        {fileType === 'svga' && (
          <div className="p-4 border-b border-[#1a1a1a]">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-semibold text-gray-200">Audio Assets</h3>
            </div>
            <div onClick={handleAudioUploadClick} className={`h-24 border border-dashed rounded flex flex-col items-center justify-center cursor-pointer transition-all ${audioFile ? 'border-green-500/50 bg-green-500/5' : 'border-[#333] bg-[#0a0a0a] hover:border-[#555]'}`}>
              {audioFile ? (
                <>
                  <Music size={16} className="text-green-400 mb-2" />
                  <span className="text-xs text-green-400 font-medium truncate max-w-[200px]">{audioFile.name}</span>
                </>
              ) : (
                <>
                  <Plus size={16} className="text-[#00bfa5] mb-2" />
                  <span className="text-xs text-gray-500">Click to add .mp3</span>
                </>
              )}
            </div>
          </div>
        )}

        <div className="flex-1 flex flex-col p-4 overflow-hidden">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-semibold text-gray-200">Assets ({imageAssets.length})</h3>
            <button onClick={downloadAllImages} className="flex items-center gap-1.5 px-2 py-1 bg-[#1a1a1a] border border-[#333] rounded text-[10px] text-blue-400 hover:text-blue-300">
              <Download size={12} /> Download All
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3 overflow-y-auto pr-1 pb-4 custom-scrollbar content-start">
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

      {/* Main Preview Area */}
      <div className={`flex-1 relative flex items-center justify-center overflow-hidden border-r border-[#1a1a1a] transition-colors duration-300 ${bgColor === 'white' ? 'bg-[#f0f0f0]' : bgColor === 'grid' ? 'bg-[url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkYGAQYcAP3uCTZhw1gGGYhAGBZIA/nYDCgBDAm9BGDWAAJyRCgLaBCAAgXwixzAS0pgAAAABJRU5ErkJggg==")]' : 'bg-black'}`}>
        
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
                        width: displaySize.width > 0 ? `${displaySize.width}px` : '500px', 
                        height: displaySize.height > 0 ? `${displaySize.height}px` : '500px',
                    }}
                />
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

      {/* Right Sidebar - Properties */}
      <div className="w-full lg:w-80 bg-[#050505] flex flex-col flex-shrink-0 border-l border-[#1a1a1a] z-10">
        
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
                <InfoTag label="Format" value="Lottie (JSON)" />
                <InfoTag label="Version" value={lottieData?.v || '-'} />
                <InfoTag label="Resolution" value={`${lottieParams.w} x ${lottieParams.h}`} />
                <InfoTag label="Duration" value={`${lottieParams.durationSeconds} S`} />
                <InfoTag label="File Size" value={fileSize} />
                <InfoTag label="FPS" value={`${lottieParams.fr}`} />
              </div>
          )}
        </div>

        <div className="p-5 flex-1 overflow-y-auto custom-scrollbar">
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
                {!isEditable && <p className="text-[10px] text-gray-500 mt-2">Legacy SVGA 1.x (Binary) files cannot be edited. Please use SVGA 1.0 (Zip) files.</p>}
              </div>
          )}

          {fileType === 'lottie' && (
              <div className="space-y-6">
                 <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-gray-300 flex items-center gap-2"><Gauge size={14}/> Frame Rate</label>
                    <input 
                        type="number" 
                        value={lottieParams.fr} 
                        onChange={(e) => handleLottieParamChange('fr', e.target.value)}
                        className="bg-[#111] border border-[#333] rounded px-3 py-1.5 text-xs text-right text-white w-24 focus:border-green-500 outline-none" 
                    />
                 </div>
                 <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-gray-300 flex items-center gap-2"><Clock size={14}/> Duration (s)</label>
                    <input 
                        type="number" 
                        step="0.1"
                        value={lottieParams.durationSeconds} 
                        onChange={(e) => handleLottieParamChange('durationSeconds', e.target.value)}
                        className="bg-[#111] border border-[#333] rounded px-3 py-1.5 text-xs text-right text-white w-24 focus:border-green-500 outline-none" 
                    />
                 </div>

                 <button onClick={handleExportLottie} className="w-full text-sm font-medium py-2.5 rounded-lg bg-green-600 hover:bg-green-500 border border-green-500 text-white flex items-center justify-center gap-2 mt-4">
                    <Save size={16} />
                    Export Modified Lottie
                 </button>
                 
                 <div className="mt-8 border-t border-[#1a1a1a] pt-4">
                     <h3 className="text-xs font-bold text-[#666] mb-4 uppercase tracking-widest">Conversion</h3>
                     <div className="grid grid-cols-2 gap-3">
                         <button onClick={handleExportLottieToSVGA} className="bg-[#1a1a1a] border border-[#333] text-gray-300 text-xs py-2.5 rounded-lg flex flex-col items-center gap-1.5 hover:border-blue-500 hover:text-white transition-colors"><RefreshCcw size={16} className="text-blue-500" /> To SVGA</button>
                         <button onClick={() => showServerRequiredAlert('MP4')} className="bg-[#1a1a1a] border border-[#333] text-gray-300 text-xs py-2.5 rounded-lg flex flex-col items-center gap-1.5 hover:border-red-500 hover:text-white transition-colors"><FileVideo size={16} className="text-red-500" /> To MP4</button>
                     </div>
                 </div>
              </div>
          )}

          {fileType === 'svga' && (
             <div className="mt-8">
                 <h3 className="text-xs font-bold text-[#666] mb-4 uppercase tracking-widest">Conversion</h3>
                 <button onClick={() => {}} className="w-full bg-[#1a1a1a] border border-[#333] text-gray-200 text-sm py-2.5 rounded-lg flex items-center justify-center gap-2 mb-3">
                    <Images size={16} className="text-green-500" /> Export PNG Sequence
                 </button>
                 <div className="grid grid-cols-2 gap-3 mb-3">
                     <button onClick={() => showServerRequiredAlert('MP4')} className="bg-[#1a1a1a] border border-[#333] text-gray-400 text-xs py-2.5 rounded-lg flex flex-col items-center gap-1.5"><FileVideo size={16} className="text-red-500" /> MP4</button>
                     <button onClick={() => showServerRequiredAlert('Lottie')} className="bg-[#1a1a1a] border border-[#333] text-gray-400 text-xs py-2.5 rounded-lg flex flex-col items-center gap-1.5"><FileJson size={16} className="text-yellow-500" /> Lottie</button>
                 </div>
                 
                 <button onClick={handleExportManifest} className="w-full bg-[#1a1a1a] border border-[#333] text-gray-300 text-xs py-2.5 rounded-lg flex items-center justify-center gap-2 hover:border-purple-500 hover:text-purple-400 transition-colors">
                    <Layers size={14} /> Export Source & Manifest (Zip)
                 </button>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Editor;
