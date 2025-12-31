
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Type, LiveServerMessage, Modality, FunctionDeclaration, Tool } from "@google/genai"; // Import Gemini SDK
import { Experience } from './components/Experience';
import { UIOverlay } from './components/UIOverlay';
import { ClockWidget } from './components/ClockWidget';
import { Screensaver } from './components/Screensaver';
import { LyricsBox } from './components/LyricsBox';
import { MotionController } from './components/MotionController'; // NEW IMPORT
import { FaceEnrollment } from './components/FaceEnrollment'; // YENİ: Yüz Kayıt Bileşeni
import { PresetType, AudioMode, BackgroundMode, BgImageStyle, ShapeType, SlideshowSettings, SlideshowTransition, SlideshowOrder, SongInfo, AutoScreensaverSettings, LyricLine, SecurityMode } from './types';
import { getSongImages, saveSongImages, getSongLyrics, saveSongLyrics, getSongInfo, saveSongInfo } from './utils/db'; // Import DB Utils Updated

// Ekran Koruyucu Durumları (Kesin Sıralı - 5 Adım)
type ScreensaverState = 
    'idle' | 
    // GİRİŞ ADIMLARI
    'e1_app_blur' |      // 1. Ana ekran blur
    'e2_app_shrink' |    // 2. Ana ekran sıkışma - SS Opak ama aşağıda
    'e3_ss_slide_up' |   // 3. SS alttan gelme
    'e4_ss_unblur' |     // 4. SS netleşme
    'e5_ss_expand' |     // 5. SS büyüme
    'active' |           // Tam ekran aktif
    // ÇIKIŞ ADIMLARI (Tersi)
    'x1_ss_shrink' |     // 1. SS sıkışma
    'x2_ss_blur' |       // 2. SS blur
    'x3_ss_slide_down' | // 3. SS aşağı kayma
    'x4_app_expand' |    // 4. Ana ekran büyüme - SS aşağıda kalır
    'x5_app_unblur';     // 5. Ana ekran netleşme

// --- AUDIO UTILS FOR GEMINI LIVE ---
function floatTo16BitPCM(float32Array: Float32Array) {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    let offset = 0;
    for (let i = 0; i < float32Array.length; i++, offset += 2) {
        let s = Math.max(-1, Math.min(1, float32Array[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    return buffer;
}

function base64EncodeAudio(float32Array: Float32Array) {
    const int16Buffer = floatTo16BitPCM(float32Array);
    let binary = '';
    const bytes = new Uint8Array(int16Buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

function base64DecodeAudio(base64: string) {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

// --- HELPER: Normalize Mood String ---
function normalizeMood(rawMood: string): string {
    if (!rawMood) return 'energetic';
    const lower = rawMood.toLowerCase();
    
    if (lower.includes('calm') || lower.includes('peace') || lower.includes('relax') || lower.includes('sooth') || lower.includes('chill')) return 'calm';
    if (lower.includes('sad') || lower.includes('melanchol') || lower.includes('reflect') || lower.includes('nostalg') || lower.includes('emotion') || lower.includes('grief')) return 'sad';
    if (lower.includes('romant') || lower.includes('love') || lower.includes('passion') || lower.includes('tender') || lower.includes('intima')) return 'romantic';
    if (lower.includes('myster') || lower.includes('dark') || lower.includes('haunt') || lower.includes('eerie') || lower.includes('suspense')) return 'mysterious';
    if (lower.includes('energ') || lower.includes('power') || lower.includes('happy') || lower.includes('upbeat') || lower.includes('dance') || lower.includes('triumph') || lower.includes('determin')) return 'energetic';
    
    return 'energetic'; // Default fallback
}

// --- HELPER: Fetch Weather for Assistant ---
async function fetchWeatherForAssistant(): Promise<string> {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            resolve("Tarayıcınız konum özelliğini desteklemiyor.");
            return;
        }
        const options = { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 };

        navigator.geolocation.getCurrentPosition(async (pos) => {
            try {
                const { latitude, longitude } = pos.coords;
                const wRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`);
                const wJson = await wRes.json();
                const cRes = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=tr`);
                const cJson = await cRes.json();
                
                const city = cJson.city || cJson.locality || cJson.principalSubdivision || "Bilinmeyen Konum";
                const temp = wJson.current_weather.temperature;
                const code = wJson.current_weather.weathercode;
                
                let condition = "Açık";
                if (code === 0) condition = "Açık";
                else if (code === 1 || code === 2) condition = "Parçalı Bulutlu";
                else if (code === 3) condition = "Kapalı (Bulutlu)";
                else if (code >= 45 && code <= 48) condition = "Sisli";
                else if (code >= 51 && code <= 67) condition = "Yağmurlu";
                else if (code >= 71 && code <= 77) condition = "Karlı";
                else if (code >= 80 && code <= 82) condition = "Sağanak Yağışlı";
                else if (code >= 95) condition = "Fırtınalı";
                else condition = "Bulutlu";

                resolve(`Konum: ${city}. Sıcaklık: ${temp}°C. Durum: ${condition}.`);
            } catch (e) {
                resolve("Hava durumu servisine erişilemedi (API Hatası).");
            }
        }, (error) => {
            if (error.code === 1) resolve("Konum izni reddedildi.");
            else if (error.code === 2) resolve("Konum bilgisi şu an kullanılamıyor.");
            else if (error.code === 3) resolve("Konum alma işlemi zaman aşımına uğradı.");
            else resolve("Konum alınırken bilinmeyen bir hata oluştu.");
        }, options);
    });
}

// --- HELPER: Cover Art Extraction ---
async function extractCoverArt(file: File): Promise<string | null> {
    return new Promise((resolve) => {
        if (!(window as any).jsmediatags) {
            console.warn("jsmediatags library not loaded");
            resolve(null);
            return;
        }

        (window as any).jsmediatags.read(file, {
            onSuccess: (tag: any) => {
                const { tags } = tag;
                if (tags.picture) {
                    const { data, format } = tags.picture;
                    let base64String = "";
                    for (let i = 0; i < data.length; i++) {
                        base64String += String.fromCharCode(data[i]);
                    }
                    resolve(`data:${format};base64,${window.btoa(base64String)}`);
                } else {
                    resolve(null);
                }
            },
            onError: (error: any) => {
                console.log("Cover art error:", error);
                resolve(null);
            }
        });
    });
}

// --- TOOL DECLARATIONS ---
const toolsDeclarations: Tool[] = [
  {
    functionDeclarations: [
      {
        name: 'changeColor',
        description: 'Change the color of the particles. Use hex codes or color names.',
        parameters: { type: Type.OBJECT, properties: { color: { type: Type.STRING, description: 'The color to set (e.g., #ff0000, blue, gold)' } }, required: ['color'] }
      },
      { name: 'changeShape', description: 'Change the 3D shape.', parameters: { type: Type.OBJECT, properties: { shape: { type: Type.STRING, enum: ['sphere', 'cube', 'prism', 'star', 'spiky'] } }, required: ['shape'] } },
      { name: 'setPreset', description: 'Apply a visual preset.', parameters: { type: Type.OBJECT, properties: { preset: { type: Type.STRING, enum: ['none', 'fire', 'water', 'electric', 'mercury', 'disco'] } }, required: ['preset'] } },
      { name: 'controlMusic', description: 'Control music playback state (play/pause) and volume.', parameters: { type: Type.OBJECT, properties: { playing: { type: Type.BOOLEAN, description: 'True to play/resume, False to pause/stop' }, volume: { type: Type.NUMBER, description: 'Volume level 0-100' } } } },
      { name: 'controlImage', description: 'Control background images. Can switch to next, previous or random image.', parameters: { type: Type.OBJECT, properties: { action: { type: Type.STRING, enum: ['next', 'prev', 'random'], description: 'Action to perform on image deck' } }, required: ['action'] } },
      { name: 'controlParticles', description: 'Configure particles.', parameters: { type: Type.OBJECT, properties: { count: { type: Type.NUMBER }, size: { type: Type.NUMBER }, density: { type: Type.NUMBER } } } },
      { name: 'controlPhysics', description: 'Control physics.', parameters: { type: Type.OBJECT, properties: { strength: { type: Type.NUMBER }, radius: { type: Type.NUMBER } } } },
      { name: 'controlView', description: 'Control view.', parameters: { type: Type.OBJECT, properties: { bgMode: { type: Type.STRING }, uiHidden: { type: Type.BOOLEAN }, autoRotate: { type: Type.BOOLEAN }, screensaver: { type: Type.BOOLEAN } } } },
      { name: 'controlEffects', description: 'Toggle effects.', parameters: { type: Type.OBJECT, properties: { bloom: { type: Type.BOOLEAN }, trails: { type: Type.BOOLEAN }, depth: { type: Type.NUMBER }, lyrics3D: { type: Type.BOOLEAN } } } },
      { name: 'writeText', description: 'Write text.', parameters: { type: Type.OBJECT, properties: { text: { type: Type.STRING } }, required: ['text'] } },
      { name: 'controlMotion', description: 'Turn motion control (hand tracking) on or off.', parameters: { type: Type.OBJECT, properties: { active: { type: Type.BOOLEAN } }, required: ['active'] } },
      { name: 'getSystemInfo', description: 'Get current date, time, location and weather conditions.', parameters: { type: Type.OBJECT, properties: {} } },
      { name: 'closeAssistant', description: 'Close and deactivate the voice assistant. Say goodbye first.', parameters: { type: Type.OBJECT, properties: {} } },
      { name: 'summarizeSong', description: 'Retrieve and read the analysis, meaning, and details of the currently loaded song.', parameters: { type: Type.OBJECT, properties: {} } }
    ]
  }
];

const App: React.FC = () => {
  const [currentText, setCurrentText] = useState<string>('');
  const [widgetUserText, setWidgetUserText] = useState<string>('');
  const [particleColor, setParticleColor] = useState<string>('#ffffff');
  
  // Arka Plan State'leri
  const [bgMode, setBgMode] = useState<BackgroundMode>('dark');
  const [customBgColor, setCustomBgColor] = useState<string>('#000000');
  
  // Çoklu Arka Plan Resmi Yönetimi
  const [bgImages, setBgImages] = useState<string[]>([]);
  const [bgImage, setBgImage] = useState<string | null>(null);
  
  // REFS FOR GEMINI LIVE CALLBACKS (Prevents Stale Closures)
  const bgImagesRef = useRef<string[]>([]);
  const bgImageRef = useRef<string | null>(null);

  // Sync Refs
  useEffect(() => { bgImagesRef.current = bgImages; }, [bgImages]);
  useEffect(() => { bgImageRef.current = bgImage; }, [bgImage]);

  // AI Generated Images
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [generatedPrompts, setGeneratedPrompts] = useState<string[]>([]); 
  
  // AI Status Management
  const [imageGenStatus, setImageGenStatus] = useState<{
      state: 'idle' | 'loading' | 'success' | 'error' | 'warning';
      message: string;
  }>({ state: 'idle', message: '' });

  // --- AUTO CLEAR STATUS MESSAGE ---
  useEffect(() => {
      if (imageGenStatus.state === 'success' || imageGenStatus.state === 'error' || imageGenStatus.state === 'warning') {
          const timer = setTimeout(() => {
              setImageGenStatus({ state: 'idle', message: '' });
          }, 2000);
          return () => clearTimeout(timer);
      }
  }, [imageGenStatus.state]);

  // Slayt Gösterisi State
  const [slideshowSettings, setSlideshowSettings] = useState<SlideshowSettings>({
      active: false,
      duration: 5,
      order: 'sequential',
      transition: 'fade'
  });
  const [activeTransitionClass, setActiveTransitionClass] = useState('transition-opacity duration-700');
  
  const [croppedBgImage, setCroppedBgImage] = useState<string | null>(null); 
  const [bgImageStyle, setBgImageStyle] = useState<BgImageStyle>('cover');
  const [isWidgetMinimized, setIsWidgetMinimized] = useState<boolean>(false);
  const [isUIHidden, setIsUIHidden] = useState<boolean>(false);
  const [isSceneVisible, setIsSceneVisible] = useState<boolean>(true);
  const [currentShape, setCurrentShape] = useState<ShapeType>('sphere');
  const [imageSourceXY, setImageSourceXY] = useState<string | null>(null);
  const [imageSourceYZ, setImageSourceYZ] = useState<string | null>(null);
  const [useImageColors, setUseImageColors] = useState<boolean>(false);
  const [depthIntensity, setDepthIntensity] = useState<number>(0); 
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [brushSize, setBrushSize] = useState<number>(10);
  const [canvasRotation, setCanvasRotation] = useState<[number, number, number]>([0, 0, 0]);
  const [clearCanvasTrigger, setClearCanvasTrigger] = useState<number>(0);
  const [cameraResetTrigger, setCameraResetTrigger] = useState<number>(0);
  const getDrawingDataRef = useRef<{ getXY: () => string, getYZ: () => string } | null>(null);
  const [activePreset, setActivePreset] = useState<PresetType>('none');
  const [audioMode, setAudioMode] = useState<AudioMode>('none');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioTitle, setAudioTitle] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [volume, setVolume] = useState<number>(0.5);
  const [repulsionStrength, setRepulsionStrength] = useState<number>(50);
  const [repulsionRadius, setRepulsionRadius] = useState<number>(50);
  const [particleCount, setParticleCount] = useState<number>(40000); 
  const [particleSize, setParticleSize] = useState<number>(20); 
  const [modelDensity, setModelDensity] = useState<number>(50); 
  const [isUIInteraction, setIsUIInteraction] = useState<boolean>(false);
  const [isAutoRotating, setIsAutoRotating] = useState<boolean>(false);

  // --- Lyrics & Analysis State ---
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const lyricsRef = useRef<LyricLine[]>([]); // NEW: Lyrics Reference for Live API
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState<string>('');
  const [showLyrics, setShowLyrics] = useState(false); 
  const [useLyricParticles, setUseLyricParticles] = useState(false); 
  const [useLyricEcho, setUseLyricEcho] = useState(false); 
  const [activeLyricText, setActiveLyricText] = useState<string>(''); 
  
  // --- Song Info State ---
  const [songInfo, setSongInfo] = useState<SongInfo | null>(null);
  const songInfoRef = useRef<SongInfo | null>(null);
  const [showInfoPanel, setShowInfoPanel] = useState<boolean>(true); 
  
  // --- Force Trigger for Hand Explosion ---
  const [forceTrigger, setForceTrigger] = useState<number>(0);
  // --- Hand Zoom Level ---
  const [handZoomLevel, setHandZoomLevel] = useState<number>(1.0);

  useEffect(() => {
      songInfoRef.current = songInfo;
  }, [songInfo]);

  useEffect(() => {
      lyricsRef.current = lyrics;
  }, [lyrics]);

  // --- MOOD SYNC STATE ---
  const [isMoodSyncActive, setIsMoodSyncActive] = useState<boolean>(false);
  
  // --- BLOOM / GLOW STATE ---
  const [enableBloom, setEnableBloom] = useState<boolean>(false);

  // --- TRAIL (PARTICLE TRAILS) STATE ---
  const [enableTrails, setEnableTrails] = useState<boolean>(false);

  // --- NATURE SCREEN SAVER MODE ---
  const [isNatureMode, setIsNatureMode] = useState<boolean>(false);

  // --- MOTION CONTROL STATE ---
  const [isMotionControlActive, setIsMotionControlActive] = useState<boolean>(false);
  
  // --- SECURITY MODE STATE ---
  const [securityMode, setSecurityMode] = useState<SecurityMode>('none'); 
  
  // --- FACE ENROLLMENT STATE ---
  const [isEnrollingFace, setIsEnrollingFace] = useState(false); // YENİ: Yüz kayıt modalı durumu

  // --- VIRTUAL CURSOR STATE ---
  const cursorRef = useRef<HTMLDivElement>(null);
  const [isCursorActive, setIsCursorActive] = useState(false);
  const [isCursorHovering, setIsCursorHovering] = useState(false);
  const [isCursorClicking, setIsCursorClicking] = useState(false); // Yeni: Tıklama efekti için
  // Ref to track the last hovered element for event simulation
  const lastHoveredRef = useRef<HTMLElement | null>(null);
  // Track cursor position for click events
  const cursorPositionRef = useRef({ x: 0, y: 0 });

  // --- AUTOMATIC SCREENSAVER STATE ---
  const [autoSsSettings, setAutoSsSettings] = useState<AutoScreensaverSettings>({
      enabled: false,
      timeout: 60000 
  });
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- LIVE CHAT STATE ---
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [liveStatus, setLiveStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'speaking'>('disconnected');
  const liveSessionRef = useRef<any>(null);
  const liveInputContextRef = useRef<AudioContext | null>(null);
  const liveOutputContextRef = useRef<AudioContext | null>(null);
  const liveAudioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const liveNextStartTimeRef = useRef<number>(0);
  
  const isAutoLiveRef = useRef(false);
  const pendingCloseRef = useRef(false); // Asistan kapatma isteği

  // --- USER SETTINGS MEMORY ---
  const userSettingsRef = useRef({
      preset: activePreset,
      strength: repulsionStrength,
      density: modelDensity,
      color: particleColor,
      echo: useLyricEcho,
      bloom: enableBloom,
      trails: enableTrails
  });

  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const workerRef = useRef<Worker | null>(null);
  const hiddenAudioRef = useRef<HTMLAudioElement>(null); 
  const audioInputRef = useRef<HTMLInputElement>(null);
  const [isModelReady, setIsModelReady] = useState(false);
  
  const analysisIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [audioVersion, setAudioVersion] = useState(0); 
  
  const audioTitleRef = useRef<string | null>(null);

  // --- Audio Engine State ---
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | MediaStreamAudioSourceNode | null>(null);

  // --- Screensaver State ---
  const [ssState, setSsState] = useState<ScreensaverState>('idle');
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [ssBgColor, setSsBgColor] = useState('#000000');
  const [ssTextColor, setSsTextColor] = useState('#ffffff');
  
  // --- CAMERA ACTIVATION LOGIC ---
  // Kamera, kullanıcı manuel açtıysa VEYA ekran koruyucu aktif ve kilit modu 'hand' ise açık kalmalı
  // FAKAT Yüz Kayıt Modu aktifse, el kontrol kamerasını devre dışı bırakmalıyız ki çakışma olmasın.
  const calculatedMotionActive = !isEnrollingFace && (isMotionControlActive || (ssState === 'active' && securityMode === 'hand'));

  useEffect(() => {
      audioTitleRef.current = audioTitle;
  }, [audioTitle]);

  // ... (Geri kalan kodlar aynı) ...

  // --- AUDIO VOLUME SYNC ---
  useEffect(() => {
      if (hiddenAudioRef.current) {
          hiddenAudioRef.current.volume = volume;
      }
  }, [volume, audioVersion]);

  // --- AUDIO PLAYBACK SYNC ---
  useEffect(() => {
      if (hiddenAudioRef.current && audioMode === 'file') {
          if (isPlaying) {
              const playPromise = hiddenAudioRef.current.play();
              if (playPromise !== undefined) {
                  playPromise.catch(error => {
                      console.log("Playback prevented.", error);
                  });
              }
          } else {
              hiddenAudioRef.current.pause();
          }
      }
  }, [isPlaying, audioUrl, audioVersion, audioMode]);

  // --- LYRIC SYNC ENGINE ---
  const currentLyricRef = useRef<string>(''); 
  const rafRef = useRef<number | null>(null);
  const [debugNextLineTime, setDebugNextLineTime] = useState<number | null>(null);

  useEffect(() => {
      const audio = hiddenAudioRef.current;
      if (!audio || lyrics.length === 0) {
          if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
          return;
      }

      const checkLyrics = () => {
          if (!audio.paused) {
              const currentTime = audio.currentTime;
              setAudioCurrentTime(currentTime);
              setAudioDuration(audio.duration || 0);

              let activeLine = null;
              let nextLineIndex = -1;

              for (let i = lyrics.length - 1; i >= 0; i--) {
                  if (currentTime >= lyrics[i].start) {
                      activeLine = lyrics[i];
                      nextLineIndex = i + 1;
                      break; 
                  }
              }
              
              if (nextLineIndex >= 0 && nextLineIndex < lyrics.length) {
                  setDebugNextLineTime(lyrics[nextLineIndex].start);
              } else if (lyrics.length > 0 && currentTime < lyrics[0].start) {
                  setDebugNextLineTime(lyrics[0].start); 
              } else {
                  setDebugNextLineTime(null);
              }

              if (activeLine) {
                  if (currentLyricRef.current !== activeLine.text) {
                      currentLyricRef.current = activeLine.text;
                      setActiveLyricText(activeLine.text);
                  }
              } else {
                  if (currentLyricRef.current !== '') {
                      currentLyricRef.current = '';
                      setActiveLyricText('');
                  }
              }
          }
          rafRef.current = requestAnimationFrame(checkLyrics);
      };

      rafRef.current = requestAnimationFrame(checkLyrics);

      return () => {
          if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      };
  }, [lyrics, audioVersion]); 

  // --- AUDIO GRAPH SETUP ---
  useEffect(() => {
      if (!audioUrl || !hiddenAudioRef.current || audioMode !== 'file') return;

      const setupAudio = async () => {
          try {
              if (!audioContextRef.current) {
                  audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
              }
              const ctx = audioContextRef.current;

              if (ctx.state === 'suspended') {
                  await ctx.resume();
              }

              if (!analyserRef.current) {
                  analyserRef.current = ctx.createAnalyser();
                  analyserRef.current.fftSize = 2048; 
                  analyserRef.current.smoothingTimeConstant = 0.8;
              }

              if (!sourceNodeRef.current) {
                  sourceNodeRef.current = ctx.createMediaElementSource(hiddenAudioRef.current);
                  sourceNodeRef.current.connect(analyserRef.current);
                  analyserRef.current.connect(ctx.destination);
              }
          } catch (e) {
              console.error("Audio Graph Setup Error:", e);
          }
      };

      setupAudio();

      return () => {};

  }, [audioUrl, audioVersion, audioMode]);

  // --- MICROPHONE SETUP ---
  useEffect(() => {
      if (audioMode === 'mic') {
          const setupMic = async () => {
              try {
                  if (!audioContextRef.current) {
                      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
                  }
                  const ctx = audioContextRef.current;
                  if (ctx.state === 'suspended') await ctx.resume();

                  if (sourceNodeRef.current) {
                      sourceNodeRef.current.disconnect();
                  }

                  if (!analyserRef.current) {
                      analyserRef.current = ctx.createAnalyser();
                      analyserRef.current.fftSize = 2048;
                      analyserRef.current.smoothingTimeConstant = 0.8;
                  }

                  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                  const source = ctx.createMediaStreamSource(stream);
                  source.connect(analyserRef.current);
                  
                  sourceNodeRef.current = source;
                  setIsPlaying(true);
              } catch (e) {
                  console.error("Mic Error:", e);
                  setAudioMode('none');
              }
          };
          setupMic();
      }
  }, [audioMode]);

  // --- HELPER FUNCTIONS ---
  const handleInteractionResume = () => {
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
          audioContextRef.current.resume();
      }
      setIsUIInteraction(true);
  };

  const applyMoodSettings = (rawMood: string) => {
      const mood = normalizeMood(rawMood); 
      switch(mood) {
        case 'energetic': setActivePreset('electric'); setRepulsionStrength(90); setModelDensity(40); setEnableBloom(true); break;
        case 'calm': setActivePreset('water'); setRepulsionStrength(20); setModelDensity(80); setEnableBloom(false); break;
        case 'sad': setActivePreset('none'); setParticleColor('#5588aa'); setUseLyricEcho(true); setModelDensity(60); break;
        case 'romantic': setActivePreset('none'); setParticleColor('#ff55aa'); setEnableBloom(true); setCurrentShape('sphere'); break;
        case 'mysterious': setActivePreset('mercury'); setEnableTrails(true); setRepulsionStrength(40); break;
        default: setActivePreset('none');
      }
  };

  const handleMoodSyncToggle = () => {
    setIsMoodSyncActive(prev => {
        const newState = !prev;
        if (newState) {
            userSettingsRef.current = {
                preset: activePreset,
                strength: repulsionStrength,
                density: modelDensity,
                color: particleColor,
                echo: useLyricEcho,
                bloom: enableBloom,
                trails: enableTrails
            };
            if (songInfo && songInfo.mood) applyMoodSettings(songInfo.mood);
        } else {
            if (userSettingsRef.current) {
                setActivePreset(userSettingsRef.current.preset);
                setRepulsionStrength(userSettingsRef.current.strength);
                setModelDensity(userSettingsRef.current.density);
                setParticleColor(userSettingsRef.current.color);
                setUseLyricEcho(userSettingsRef.current.echo);
                setEnableBloom(userSettingsRef.current.bloom);
                setEnableTrails(userSettingsRef.current.trails);
            }
        }
        return newState;
    });
  };

  const generateImagesFromPrompts = async (prompts: string[]) => {
      if (!process.env.API_KEY) return;
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const newImages: string[] = [];
      setImageGenStatus({ state: 'loading', message: 'Görseller üretiliyor...' });
      
      const promises = prompts.slice(0, 4).map(async (prompt) => {
          try {
              const result = await ai.models.generateContent({
                  model: 'gemini-2.5-flash-image',
                  contents: { parts: [{ text: prompt }] },
                  config: { imageConfig: { aspectRatio: '1:1' } }
              });
              if (result.candidates?.[0]?.content?.parts) {
                  for (const part of result.candidates[0].content.parts) {
                      if (part.inlineData) {
                          return `data:image/png;base64,${part.inlineData.data}`;
                      }
                  }
              }
          } catch (e) {
              console.error("Image Gen Error", e);
          }
          return null;
      });

      const results = await Promise.all(promises);
      const validImages = results.filter((img): img is string => img !== null);
      
      setGeneratedImages(validImages);
      if (validImages.length > 0) {
          setImageGenStatus({ state: 'success', message: `${validImages.length} görsel üretildi.` });
          if(audioTitle) saveSongImages(audioTitle, validImages);
      } else {
          setImageGenStatus({ state: 'error', message: 'Görsel üretilemedi.' });
      }
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const analyzeAudio = async (url: string | null, language: string, analysisId: number) => {
      if (!url || !process.env.API_KEY) return;
      
      if (isLiveActive) disconnectGeminiLive();

      setIsAnalyzing(true);
      setAnalysisStatus('Ses İşleniyor...'); 

      try {
          const response = await fetch(url);
          const blob = await response.blob();
          
          if (blob.size > 19 * 1024 * 1024) { 
               setAnalysisStatus('Dosya Çok Büyük');
               setStatus('error', 'Dosya çok büyük (Max 19MB).', true);
               setIsAnalyzing(false);
               return;
          }

          const base64Data = await blobToBase64(blob);
          const mimeType = blob.type || 'audio/mp3';

          setAnalysisStatus('Gemini Analiz Ediyor...'); 
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          
          const prompt = `
          Analyze the audio file provided. This is a STRICT lyrics transcription task for a Karaoke application.

          RULES:
          1.  **NO FILTERING:** Transcribe EVERYTHING. Include ad-libs, background vocals, vocalizations like "ooh", "aah", "yeah", "nanana", "oh".
          2.  **ABSOLUTE VERBATIM:** Do not summarize. Do not skip choruses. Do not skip repeated lines. If a line is repeated 10 times, list it 10 times with accurate timestamps.
          3.  **FILL THE GAPS:** The user reported missing lyrics/gaps in analysis. Pay extreme attention to every second. If there is a voice, transcribe it.
          4.  **NO INSTRUMENTAL TAGS:** Do NOT use [Instrumental] or [Music] tags unless there is absolutely NO vocal sound for more than 10 seconds. If there is humming or ad-libs, write them down instead of "Instrumental".
          5.  **PRECISE TIMING:** Start and End times must be exact.
          6.  **Language:** ${language} (But transcribe sounds regardless of language).

          Return ONLY valid JSON in this structure:
          {
            "lyrics": [
              {"text": "Verse 1 line 1", "start": 0.0, "end": 4.5},
              ...
            ],
            "info": {
              "artistName": "Name",
              "artistBio": "Bio",
              "meaningTR": "Turkish meaning",
              "meaningEN": "English meaning",
              "mood": "energetic",
              "suggestedColor": "#HexCode"
            },
            "visualPrompts": ["prompt 1", "prompt 2", "prompt 3", "prompt 4"]
          }
          `;

          const result = await ai.models.generateContent({
              model: 'gemini-2.5-flash', 
              contents: {
                  parts: [
                      { inlineData: { mimeType: mimeType, data: base64Data } },
                      { text: prompt }
                  ]
              },
              config: { responseMimeType: 'application/json' }
          });

          const responseText = result.text;
          if (responseText) {
              const cleanedText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
              let data;
              try {
                  data = JSON.parse(cleanedText);
              } catch (e) {
                  console.error("JSON Parse Error", e);
                  throw new Error("Veri formatı hatalı.");
              }
              
              if (data.lyrics && Array.isArray(data.lyrics)) {
                  const rawLyrics = data.lyrics.sort((a: any, b: any) => a.start - b.start);
                  const processedLyrics: LyricLine[] = [];
                  for (let i = 0; i < rawLyrics.length; i++) {
                      const current = { ...rawLyrics[i] };
                      const next = rawLyrics[i + 1];
                      if (next) {
                          current.end = next.start; 
                      } else {
                          current.end = 9999; 
                      }
                      processedLyrics.push(current);
                  }

                  setLyrics(processedLyrics);
                  if (processedLyrics.length > 0) {
                      setShowLyrics(true);
                      if(audioTitle) saveSongLyrics(audioTitle, processedLyrics);
                  }
              }

              if (data.info) {
                  const normalizedMood = normalizeMood(data.info.mood);
                  const currentCover = songInfoRef.current?.coverArt || null;
                  
                  const infoData: SongInfo = {
                      artistName: data.info.artistName || "Bilinmeyen Sanatçı",
                      artistBio: data.info.artistBio || "",
                      meaningTR: data.info.meaningTR || "",
                      meaningEN: data.info.meaningEN || "",
                      mood: normalizedMood as any,
                      suggestedColor: data.info.suggestedColor,
                      coverArt: currentCover, 
                      isAiGenerated: true
                  };
                  setSongInfo(infoData);
                  setShowInfoPanel(true);
                  
                  if (normalizedMood && isMoodSyncActive) {
                      applyMoodSettings(normalizedMood);
                  }
                  
                  if(audioTitle) saveSongInfo(audioTitle, infoData);
              }

              if (data.visualPrompts) {
                  setGeneratedPrompts(data.visualPrompts);
                  generateImagesFromPrompts(data.visualPrompts);
              }
              
              setStatus('success', 'Analiz Başarıyla Tamamlandı', true);
          } else {
              throw new Error("Boş yanıt alındı.");
          }

      } catch (e: any) {
          console.error("Gemini Audio Analysis Error", e);
          setAnalysisStatus('Hata');
          setStatus('error', `Analiz Hatası: ${e.message || 'Bilinmeyen Hata'}`, true);
      } finally {
          setIsAnalyzing(false);
          setTimeout(() => setAnalysisStatus(''), 2000);
      }
  };

  // --- AUTOMATIC SCREENSAVER LOGIC ---
  useEffect(() => {
      const resetInactivityTimer = () => {
          if (inactivityTimerRef.current) {
              clearTimeout(inactivityTimerRef.current);
              inactivityTimerRef.current = null;
          }
          if (autoSsSettings.enabled && ssState === 'idle') {
              inactivityTimerRef.current = setTimeout(() => {
                  if (ssState === 'idle') setSsState('e1_app_blur');
              }, autoSsSettings.timeout);
          }
      };
      const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
      const handleActivity = () => resetInactivityTimer();
      if (autoSsSettings.enabled) {
          events.forEach(event => window.addEventListener(event, handleActivity));
          resetInactivityTimer();
      } else {
          if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      }
      return () => {
          if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
          events.forEach(event => window.removeEventListener(event, handleActivity));
      };
  }, [autoSsSettings, ssState]); 

  // Hand Motion Handler
  const handleHandMove = (x: number, y: number) => {
      // x ve y 0..1 arasında gelir.
      // x: 0 (Sol) -> 1 (Sağ) => Canvas Rotation Y
      // y: 0 (Yukarı) -> 1 (Aşağı) => Canvas Rotation X

      // Rotation range: -PI to PI
      const rotY = (x - 0.5) * Math.PI * 2; 
      const rotX = (y - 0.5) * Math.PI;

      setCanvasRotation([rotX, rotY, 0]);
  };

  const handleHandGesture = (gesture: 'fist' | 'open' | 'zoom' | 'point' | 'pinch') => {
      if (gesture === 'fist') {
          if (ssState === 'active') {
              // YENİ: Kilit açma kontrolü (Güvenlik modu 'hand' ise veya 'none' ise izin ver)
              if (securityMode === 'hand' || securityMode === 'none') {
                  setSsState('x1_ss_shrink'); // Ekran koruyucudan çık
              }
          } else {
              // Ana ekranda yumruk yapınca partikülleri dağıt (Explode)
              if (isSceneVisible) {
                  setForceTrigger(prev => prev + 1);
              }
          }
      } else if (gesture === 'point' || gesture === 'pinch') {
          setIsCursorActive(true);
      } else {
          // Point dışındaki jestlerde imleci gizle
          setIsCursorActive(false);
          // İmleç kaybolduğunda hover durumunu temizle
          if (lastHoveredRef.current) {
              lastHoveredRef.current.classList.remove('hand-hover-active');
              
              const leaveEvent = new MouseEvent('mouseleave', { bubbles: true, cancelable: true, view: window });
              lastHoveredRef.current.dispatchEvent(leaveEvent);
              lastHoveredRef.current = null;
              setIsCursorHovering(false);
          }
      }
  };

  // --- HAND CLICK LOGIC ---
  const handleHandClick = () => {
      setIsCursorClicking(true);
      setTimeout(() => setIsCursorClicking(false), 200);

      const x = cursorPositionRef.current.x;
      const y = cursorPositionRef.current.y;

      const element = document.elementFromPoint(x, y);
      const interactive = element?.closest('button, input, select, [role="button"], a') as HTMLElement;

      if (interactive) {
          // Tıklama efektini tetikle
          const clickEvent = new MouseEvent('click', {
              view: window,
              bubbles: true,
              cancelable: true
          });
          interactive.dispatchEvent(clickEvent);
          interactive.click(); // Ayrıca native click metodunu da çağır
      } else if (element) {
          // İnteraktif olmayan bir yere tıklandıysa bile event gönder (örn: canvas etkileşimi)
          const clickEvent = new MouseEvent('click', {
              view: window,
              bubbles: true,
              cancelable: true,
              clientX: x,
              clientY: y
          });
          element.dispatchEvent(clickEvent);
      }
  };

  // --- VIRTUAL CURSOR LOGIC ---
  const handleCursorMove = (x: number, y: number) => {
      if (cursorRef.current) {
          // 0-1 aralığını ekran piksellerine çevir
          const screenX = x * window.innerWidth;
          const screenY = y * window.innerHeight;
          
          cursorPositionRef.current = { x: screenX, y: screenY };
          cursorRef.current.style.transform = `translate(${screenX}px, ${screenY}px)`;
          
          // ELEMENT DETECTION & EVENT SIMULATION
          // pointer-events: none olduğu için imlecin kendisini atlar ve altındakini bulur.
          const element = document.elementFromPoint(screenX, screenY);
          
          // Hedefin etkileşimli bir öğe (veya onun çocuğu) olup olmadığını kontrol et
          // Closest ile en yakın etkileşimli ebeveyni buluyoruz (örn: SVG'nin içindeki path yerine button)
          const interactive = element?.closest('button, input, select, [role="button"], a') as HTMLElement;
          
          // --- CSS CLASS & EVENT DISPATCHING ---
          
          // Eğer yeni bir öğeye geçiş yaptıysak
          if (interactive !== lastHoveredRef.current) {
              
              // 1. Önceki öğeyi temizle
              if (lastHoveredRef.current) {
                  lastHoveredRef.current.classList.remove('hand-hover-active');
                  
                  // React state'ini tetiklemek için native event
                  const leaveEvent = new MouseEvent('mouseleave', { bubbles: true, cancelable: true, view: window });
                  const outEvent = new MouseEvent('mouseout', { bubbles: true, cancelable: true, view: window });
                  lastHoveredRef.current.dispatchEvent(outEvent);
                  lastHoveredRef.current.dispatchEvent(leaveEvent);
              }

              // 2. Yeni öğeyi aktif et
              if (interactive) {
                  interactive.classList.add('hand-hover-active');
                  setIsCursorHovering(true);

                  // React handler'larını (onMouseEnter) tetiklemek için event
                  const enterEvent = new MouseEvent('mouseenter', { bubbles: true, cancelable: true, view: window });
                  const overEvent = new MouseEvent('mouseover', { bubbles: true, cancelable: true, view: window });
                  const moveEvent = new MouseEvent('mousemove', { bubbles: true, cancelable: true, view: window, clientX: screenX, clientY: screenY });
                  
                  interactive.dispatchEvent(overEvent);
                  interactive.dispatchEvent(enterEvent);
                  interactive.dispatchEvent(moveEvent);
              } else {
                  setIsCursorHovering(false);
              }
              
              lastHoveredRef.current = interactive;
          } else if (interactive) {
              // Aynı öğe üzerinde hareket ediyorsa (gerekirse move event gönderilebilir)
              // Bazı efektler mouse pozisyonuna bağlı olabilir
              const moveEvent = new MouseEvent('mousemove', { bubbles: true, cancelable: true, view: window, clientX: screenX, clientY: screenY });
              interactive.dispatchEvent(moveEvent);
          }

      }
  };

  const handleHandZoom = (zoomFactor: number) => {
      setHandZoomLevel(zoomFactor);
  };

  // --- FACE ENROLLMENT HANDLERS ---
  const handleSecurityModeChange = (mode: SecurityMode) => {
      if (mode === 'face') {
          // 'face' seçildiğinde direkt enrollment'ı başlatıyoruz
          setIsEnrollingFace(true);
      } else {
          setSecurityMode(mode);
      }
  };

  const handleFaceEnrollmentComplete = () => {
      setIsEnrollingFace(false);
      setSecurityMode('face'); // Kayıt başarılıysa modu 'face' yap
  };

  const handleFaceEnrollmentCancel = () => {
      setIsEnrollingFace(false);
      // İptal edilirse mod değişmez (veya 'none' kalır)
  };

  // --- GEMINI LIVE CONNECTION HANDLER ---
  const connectToGeminiLive = async (isAutoStart = false) => {
      if (!process.env.API_KEY) {
          setStatus('error', "API Anahtarı Eksik", true);
          return;
      }
      setLiveStatus('connecting');
      setIsLiveActive(true);
      pendingCloseRef.current = false;
      if (isAutoStart) isAutoLiveRef.current = true;
      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          liveInputContextRef.current = new AudioContextClass({ sampleRate: 16000 });
          liveOutputContextRef.current = new AudioContextClass({ sampleRate: 24000 });
          if (liveInputContextRef.current.state === 'suspended') await liveInputContextRef.current.resume();
          if (liveOutputContextRef.current.state === 'suspended') await liveOutputContextRef.current.resume();
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const sessionPromise = ai.live.connect({
              model: 'gemini-2.5-flash-native-audio-preview-09-2025',
              callbacks: {
                  onopen: () => {
                      setLiveStatus('connected');
                      const ctx = liveInputContextRef.current;
                      if (ctx) {
                          const source = ctx.createMediaStreamSource(stream);
                          const processor = ctx.createScriptProcessor(4096, 1, 1);
                          processor.onaudioprocess = (e) => {
                              const inputData = e.inputBuffer.getChannelData(0);
                              const base64Data = base64EncodeAudio(inputData);
                              sessionPromise.then(session => { session.sendRealtimeInput({ media: { mimeType: "audio/pcm;rate=16000", data: base64Data } }); });
                          };
                          source.connect(processor);
                          processor.connect(ctx.destination);
                      }
                  },
                  onmessage: async (msg: LiveServerMessage) => {
                      if (msg.toolCall) {
                          for (const fc of msg.toolCall.functionCalls) {
                              let toolResult = { result: "Action executed successfully" };
                              if (fc.name === 'changeColor') { setParticleColor(fc.args.color as string); setUseImageColors(false); } 
                              else if (fc.name === 'changeShape') { setCurrentShape(fc.args.shape as ShapeType); setCurrentText(''); setIsSceneVisible(true); } 
                              else if (fc.name === 'setPreset') { setActivePreset(fc.args.preset as PresetType); } 
                              else if (fc.name === 'controlMusic') { 
                                  // Boolean değerlerini kesin olarak true/false'a zorla
                                  const shouldPlay = fc.args.playing === true || fc.args.playing === "true";
                                  const shouldPause = fc.args.playing === false || fc.args.playing === "false";
                                  
                                  if (shouldPlay) setIsPlaying(true);
                                  if (shouldPause) setIsPlaying(false);
                                  
                                  if (fc.args.volume !== undefined) setVolume(Math.max(0, Math.min(1, (fc.args.volume as number) / 100))); 
                                  
                                  toolResult = { result: `Music is now ${shouldPlay ? 'Playing' : (shouldPause ? 'Paused' : isPlaying ? 'Playing' : 'Paused')}` };
                              } 
                              else if (fc.name === 'controlImage') {
                                  // Image Deck Control (Using Refs to avoid Stale Closures)
                                  const action = fc.args.action as string;
                                  const currentDeck = bgImagesRef.current;
                                  const currentImg = bgImageRef.current;

                                  if (currentDeck.length > 0) {
                                      setBgMode('image');
                                      let currentIndex = currentDeck.indexOf(currentImg || '');
                                      if (currentIndex === -1) currentIndex = 0;
                                      
                                      let nextIndex = currentIndex;
                                      if (action === 'next') nextIndex = (currentIndex + 1) % currentDeck.length;
                                      else if (action === 'prev') nextIndex = (currentIndex - 1 + currentDeck.length) % currentDeck.length;
                                      else if (action === 'random') nextIndex = Math.floor(Math.random() * currentDeck.length);
                                      
                                      const nextImage = currentDeck[nextIndex];
                                      setBgImage(nextImage);
                                      
                                      toolResult = { result: "Background image changed." };
                                  } else {
                                      toolResult = { result: "No images in the deck to change." };
                                  }
                              }
                              else if (fc.name === 'controlParticles') { if (fc.args.count) setParticleCount(Math.max(20000, Math.min(60000, fc.args.count as number))); if (fc.args.size) setParticleSize(Math.max(1, Math.min(50, fc.args.size as number))); if (fc.args.density) setModelDensity(Math.max(0, Math.min(100, fc.args.density as number))); } 
                              else if (fc.name === 'controlPhysics') { if (fc.args.strength) setRepulsionStrength(fc.args.strength as number); if (fc.args.radius) setRepulsionRadius(fc.args.radius as number); } 
                              else if (fc.name === 'controlView') { if (fc.args.bgMode) setBgMode(fc.args.bgMode as BackgroundMode); if (fc.args.uiHidden !== undefined) setIsUIHidden(!!fc.args.uiHidden); if (fc.args.autoRotate !== undefined) setIsAutoRotating(!!fc.args.autoRotate); if (fc.args.screensaver) setSsState('active'); } 
                              else if (fc.name === 'controlEffects') { if (fc.args.bloom !== undefined) setEnableBloom(!!fc.args.bloom); if (fc.args.trails !== undefined) setEnableTrails(!!fc.args.trails); if (fc.args.lyrics3D !== undefined) setUseLyricParticles(!!fc.args.lyrics3D); if (fc.args.depth !== undefined) setDepthIntensity(fc.args.depth as number); } 
                              else if (fc.name === 'writeText') { setCurrentText(fc.args.text as string); setIsSceneVisible(true); } 
                              else if (fc.name === 'controlMotion') { setIsMotionControlActive(!!fc.args.active); toolResult = { result: `Motion control is now ${fc.args.active ? 'active' : 'inactive'}.` }; }
                              else if (fc.name === 'getSystemInfo') { const now = new Date(); const timeStr = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }); const dateStr = now.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' }); const weatherInfo = await fetchWeatherForAssistant(); toolResult = { result: JSON.stringify({ time: timeStr, date: dateStr, weatherStatus: weatherInfo }) }; }
                              else if (fc.name === 'closeAssistant') {
                                  // İşaret bayrağını kaldır, asistan veda konuşmasını yapınca kapanacak
                                  pendingCloseRef.current = true;
                                  toolResult = { result: "Closing sequence initiated. Say a brief goodbye message now." };
                                  // FALLBACK SAFETY: If audio doesn't end properly, force close after 4 seconds
                                  setTimeout(() => {
                                      disconnectGeminiLive();
                                  }, 4000);
                              }
                              else if (fc.name === 'summarizeSong') {
                                  // Şarkı bilgilerini al (Referans üzerinden, bu sayede closure sorunu yaşanmaz)
                                  const info = songInfoRef.current;
                                  const currentLyrics = lyricsRef.current; // Şarkı sözleri referansından al

                                  if (info) {
                                       // Tüm bilgiyi JSON olarak döndür ki model kendi cümlelerini kursun
                                       toolResult = { 
                                           result: JSON.stringify({
                                               artist: info.artistName,
                                               bio: info.artistBio,
                                               meaning_tr: info.meaningTR,
                                               meaning_en: info.meaningEN,
                                               mood: info.mood,
                                               has_lyrics: currentLyrics && currentLyrics.length > 0
                                           })
                                       };
                                  } else {
                                       toolResult = { result: "Şu an bellekte analiz edilmiş bir şarkı verisi bulunmuyor. Lütfen önce bir şarkı yükleyin ve analiz edilmesini bekleyin." };
                                  }
                              }
                              sessionPromise.then(session => { session.sendToolResponse({ functionResponses: [{ id: fc.id, name: fc.name, response: toolResult }] }); });
                          }
                      }
                      const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                      if (audioData && liveOutputContextRef.current) {
                          setLiveStatus('speaking');
                          const ctx = liveOutputContextRef.current;
                          if(ctx.state === 'suspended') await ctx.resume();
                          const buffer = await decodeAudioData(base64DecodeAudio(audioData), ctx, 24000);
                          liveNextStartTimeRef.current = Math.max(liveNextStartTimeRef.current, ctx.currentTime);
                          const source = ctx.createBufferSource();
                          source.buffer = buffer;
                          source.connect(ctx.destination);
                          
                          // Veda konuşması bittiğinde kapat
                          source.addEventListener('ended', () => { 
                              liveAudioSourcesRef.current.delete(source); 
                              if (liveAudioSourcesRef.current.size === 0) { 
                                  setLiveStatus('connected');
                                  if (pendingCloseRef.current) {
                                      disconnectGeminiLive();
                                  }
                              } 
                          });
                          
                          source.start(liveNextStartTimeRef.current);
                          liveNextStartTimeRef.current += buffer.duration;
                          liveAudioSourcesRef.current.add(source);
                      }
                      if (msg.serverContent?.interrupted) { liveAudioSourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} }); liveAudioSourcesRef.current.clear(); liveNextStartTimeRef.current = 0; setLiveStatus('connected'); }
                  },
                  onclose: () => { disconnectGeminiLive(); },
                  onerror: (err) => { console.error("Gemini Live Error", err); setStatus('error', "Bağlantı Hatası"); disconnectGeminiLive(); }
              },
              config: {
                  responseModalities: [Modality.AUDIO],
                  speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
                  tools: toolsDeclarations, 
                  systemInstruction: `
                  Sen 'Partikül Yazı Morfolojisi' deneyiminin asistanısın. Türkçe konuşmalısın.
                  Yeteneklerin:
                  1. Müzik Kontrolü: Müziği açabilir (play), durdurabilir (pause) ve ses seviyesini değiştirebilirsin (controlMusic).
                  2. Şarkı Analizi: Çalan şarkının anlamını ve detaylarını okuyabilirsin (summarizeSong).
                  3. Resim Kontrolü: Galerideki resimler arasında geçiş yapabilirsin (controlImage - next/prev/random).
                  4. Görsel Efektler: Partikül rengini, şeklini ve efektleri değiştirebilirsin.
                  5. Sistem: Hava durumu ve saati söyleyebilirsin (getSystemInfo).
                  
                  Kapatma emri (closeAssistant) aldığında, ÖNCE kısa bir veda cümlesi kur ("Görüşmek üzere", "İyi günler" vb.), sonra kendini kapat.
                  Şarkı analizi is istendiğinde 'summarizeSong' aracını kullan ve dönen JSON verisini kullanıcıya özetle.
                  ` 
              }
          });
          liveSessionRef.current = sessionPromise;
      } catch (e) { console.error("Connection Failed", e); setStatus('error', "Bağlantı Kurulamadı"); disconnectGeminiLive(); }
  };

  const disconnectGeminiLive = () => {
      setLiveStatus('disconnected');
      setIsLiveActive(false);
      isAutoLiveRef.current = false;
      pendingCloseRef.current = false;
      // FIX: Check state before closing to avoid "Cannot close a closed AudioContext" error
      if (liveInputContextRef.current && liveInputContextRef.current.state !== 'closed') {
          liveInputContextRef.current.close();
      }
      if (liveOutputContextRef.current && liveOutputContextRef.current.state !== 'closed') {
          liveOutputContextRef.current.close();
      }
      liveAudioSourcesRef.current.forEach(s => { try { s.stop(); } catch(e){} });
      liveAudioSourcesRef.current.clear();
      if (liveSessionRef.current) { liveSessionRef.current.then((session: any) => session.close()); liveSessionRef.current = null; }
  };

  const toggleLiveConnection = () => { if (isLiveActive) disconnectGeminiLive(); else connectToGeminiLive(); };

  useEffect(() => {
      if (ssState === 'active' && isNatureMode && !isLiveActive && liveStatus === 'disconnected') { connectToGeminiLive(true); }
      if (ssState === 'idle' && isLiveActive && isAutoLiveRef.current) { disconnectGeminiLive(); }
  }, [ssState, isNatureMode, isLiveActive, liveStatus]);

  // Helper to manage status timeout
  const statusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setStatus = (state: 'idle' | 'loading' | 'success' | 'error' | 'warning', message: string, autoClear = false) => {
      setImageGenStatus({ state, message });
      if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
      if (autoClear) { statusTimeoutRef.current = setTimeout(() => { setImageGenStatus({ state: 'idle', message: '' }); }, 2000); } // 2 saniye
  };

  // ... (Slideshow logic same as before) ...
  useEffect(() => {
      let intervalId: any;
      const getTransitionClassString = (t: SlideshowTransition) => {
          switch (t) {
              case 'slide-left': return 'animate-slide-left'; case 'slide-right': return 'animate-slide-right'; case 'slide-up': return 'animate-slide-up'; case 'slide-down': return 'animate-slide-down'; case 'fade': return 'animate-fade-in-out'; case 'blur': return 'animate-blur-in-out'; case 'transform': return 'animate-transform-zoom'; case 'particles': return 'animate-pixelate'; default: return 'transition-all duration-1000';
          }
      };
      if (slideshowSettings.active && bgImages.length > 1 && bgMode === 'image') {
          intervalId = setInterval(() => {
              setBgImages(currentImages => {
                  if (currentImages.length <= 1) return currentImages;
                  setBgImage(currentImg => {
                      const currentIndex = currentImages.indexOf(currentImg || '');
                      let nextIndex = 0;
                      if (slideshowSettings.order === 'random') { do { nextIndex = Math.floor(Math.random() * currentImages.length); } while (nextIndex === currentIndex && currentImages.length > 1); } 
                      else { nextIndex = (currentIndex + 1) % currentImages.length; }
                      return currentImages[nextIndex];
                  });
                  return currentImages;
              });
              setCroppedBgImage(null);
              let nextT = slideshowSettings.transition;
              if (nextT === 'random') { const effects = ['slide-left', 'slide-right', 'slide-up', 'slide-down', 'fade', 'blur', 'transform']; nextT = effects[Math.floor(Math.random() * effects.length)] as any; }
              setActiveTransitionClass(getTransitionClassString(nextT));
          }, Math.max(3000, slideshowSettings.duration * 1000));
      }
      return () => { if (intervalId) clearInterval(intervalId); };
  }, [slideshowSettings, bgImages.length, bgMode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') { setActivePreset('none'); if (isDrawing) setIsDrawing(false); } };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDrawing]);

  // --- EKRAN KORUYUCU (Mouse tracking) ---
  useEffect(() => {
      const handleMouseMove = (e: MouseEvent) => {
          if (ssState !== 'idle') return;
          if (e.clientY <= 10 || e.clientY >= window.innerHeight - 10) { if (!hoverTimerRef.current) hoverTimerRef.current = setTimeout(() => setSsState('e1_app_blur'), 2000); } 
          else { if (hoverTimerRef.current) { clearTimeout(hoverTimerRef.current); hoverTimerRef.current = null; } }
      };
      window.addEventListener('mousemove', handleMouseMove);
      return () => { window.removeEventListener('mousemove', handleMouseMove); if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current); };
  }, [ssState]); 

  // ... (Screensaver state machine useEffect same as before) ...
  useEffect(() => {
      let timer: ReturnType<typeof setTimeout>;
      if (ssState === 'e1_app_blur') timer = setTimeout(() => setSsState('e2_app_shrink'), 300);
      else if (ssState === 'e2_app_shrink') timer = setTimeout(() => setSsState('e3_ss_slide_up'), 300);
      else if (ssState === 'e3_ss_slide_up') timer = setTimeout(() => setSsState('e4_ss_unblur'), 300);
      else if (ssState === 'e4_ss_unblur') timer = setTimeout(() => setSsState('e5_ss_expand'), 300);
      else if (ssState === 'e5_ss_expand') timer = setTimeout(() => setSsState('active'), 300);
      else if (ssState === 'active') { /* Stay active */ }
      else if (ssState === 'x1_ss_shrink') timer = setTimeout(() => setSsState('x2_ss_blur'), 300);
      else if (ssState === 'x2_ss_blur') timer = setTimeout(() => setSsState('x3_ss_slide_down'), 300);
      else if (ssState === 'x3_ss_slide_down') timer = setTimeout(() => setSsState('x4_app_expand'), 300);
      else if (ssState === 'x4_app_expand') timer = setTimeout(() => setSsState('x5_app_unblur'), 300);
      else if (ssState === 'x5_app_unblur') timer = setTimeout(() => setSsState('idle'), 300);
      return () => { if (timer) clearTimeout(timer); };
  }, [ssState]);

  const handleScreensaverClick = () => { if (ssState === 'active') setSsState('x1_ss_shrink'); };

  // ... (Handlers same as before) ...
  const handleBgModeChange = (mode: BackgroundMode, extraData?: string) => { setBgMode(mode); if (mode === 'light') { setParticleColor('#000000'); setUseImageColors(false); } else if (mode === 'dark') setParticleColor('#ffffff'); if (mode === 'image' && extraData) { setBgImage(extraData); setCroppedBgImage(null); } if (mode === 'color' && extraData) setCustomBgColor(extraData); };
  const handleBgImagesAdd = (newImages: string[]) => { setBgImages(prev => [...prev, ...newImages]); if (!bgImage && newImages.length > 0) { setBgImage(newImages[0]); setCroppedBgImage(null); setBgMode('image'); } };
  const handleBgImageSelectFromDeck = (img: string) => { setBgImage(img); setCroppedBgImage(null); setBgMode('image'); setSlideshowSettings(prev => ({ ...prev, active: false })); };
  const handleApplyCrop = (croppedDataUrl: string) => { setCroppedBgImage(croppedDataUrl); setBgMode('image'); };
  const handleRemoveBgImage = (imgToRemove: string) => { setBgImages(prev => { const newList = prev.filter(img => img !== imgToRemove); if (bgImage === imgToRemove) { if (newList.length > 0) { setBgImage(newList[0]); setCroppedBgImage(null); } else { setBgImage(null); setCroppedBgImage(null); setBgMode('dark'); } } return newList; }); };
  const handleDeckReset = (deleteImages: boolean, resetSize: boolean) => { if (deleteImages) { setBgImages([]); setBgImage(null); setCroppedBgImage(null); setBgMode('dark'); setSlideshowSettings(prev => ({ ...prev, active: false })); } if (resetSize) { setBgImageStyle('cover'); setCroppedBgImage(null); } };
  const handleBgImageStyleChange = (style: BgImageStyle) => { setBgImageStyle(style); if (style !== 'cover') setCroppedBgImage(null); };
  const handleTextSubmit = (text: string) => { setCurrentText(text); setImageSourceXY(null); setImageSourceYZ(null); setDepthIntensity(0); setIsDrawing(false); setCanvasRotation([0, 0, 0]); setCameraResetTrigger(prev => prev + 1); setIsSceneVisible(true); setShowLyrics(false); };
  const handleDualImageUpload = (imgXY: string | null, imgYZ: string | null, useOriginalColors: boolean, keepRotation = false) => { setImageSourceXY(imgXY); setImageSourceYZ(imgYZ); setUseImageColors(useOriginalColors); setCurrentText(''); setActivePreset('none'); setIsSceneVisible(true); setShowLyrics(false); if (isDrawing) { setDepthIntensity(0); setIsDrawing(false); if (!keepRotation) setCanvasRotation([0, 0, 0]); } else { setDepthIntensity(0); setCanvasRotation([0, 0, 0]); } };
  const handleImageUpload = (imgSrc: string, useOriginalColors: boolean) => { handleDualImageUpload(imgSrc, null, useOriginalColors, false); };
  const handleDrawingStart = () => { setCurrentText(''); setImageSourceXY(null); setImageSourceYZ(null); setUseImageColors(false); setIsDrawing(true); setParticleColor(particleColor); setCanvasRotation([0, 0, 0]); setClearCanvasTrigger(prev => prev + 1); setIsSceneVisible(true); setShowLyrics(false); };
  const handleDrawingConfirm = () => { if (getDrawingDataRef.current) { const dataUrlXY = getDrawingDataRef.current.getXY(); const dataUrlYZ = getDrawingDataRef.current.getYZ(); handleDualImageUpload(dataUrlXY, dataUrlYZ, true, true); } };
  const handleColorChange = (color: string) => { setParticleColor(color); setActivePreset('none'); if ((imageSourceXY || imageSourceYZ) && !isDrawing) setUseImageColors(false); };
  const handleResetColors = () => { if (imageSourceXY || imageSourceYZ) setUseImageColors(true); };
  
  // ... (Audio handlers same as before) ...
  const handleAudioChange = async (mode: AudioMode, url: string | null, title?: string, lang?: string) => { 
      const cleanTitle = title ? title.replace(/\.(mp3|wav|ogg|m4a|flac)$/i, '') : null;
      if (sourceNodeRef.current) { try { sourceNodeRef.current.disconnect(); } catch(e) { console.warn("Disconnect warning", e); } sourceNodeRef.current = null; }
      const newAnalysisId = analysisIdRef.current + 1; analysisIdRef.current = newAnalysisId;
      if (abortControllerRef.current) { abortControllerRef.current.abort(); } if (workerRef.current) { workerRef.current.terminate(); workerRef.current = null; }
      setAudioVersion(v => v + 1); setAudioMode(mode); setAudioUrl(url); setAudioTitle(cleanTitle); setIsPlaying(true); setActiveLyricText(''); 
      if (mode === 'file' && url && cleanTitle) {
          if (audioInputRef.current?.files?.[0]) {
              const file = audioInputRef.current.files[0];
              extractCoverArt(file).then(cover => { setSongInfo(prev => { if (prev) return { ...prev, coverArt: cover }; return { artistName: cleanTitle.split('-')[0]?.trim() || "Yükleniyor...", artistBio: "Analiz Ediliyor...", meaningTR: "...", meaningEN: "...", coverArt: cover, isAiGenerated: false }; }); });
          }
          try {
              const [cachedLyrics, cachedInfo, cachedImages] = await Promise.all([ getSongLyrics(cleanTitle), getSongInfo(cleanTitle), getSongImages(cleanTitle) ]);
              if (cachedLyrics && cachedLyrics.length > 0) { console.log("CACHE HIT: Loading from DB"); setLyrics(cachedLyrics); setUseLyricParticles(false); setShowLyrics(true); setShowInfoPanel(true); setAnalysisStatus('Hafızadan Yüklendi'); setIsAnalyzing(false); if (cachedImages && cachedImages.length > 0) { setGeneratedImages(cachedImages); } if (cachedInfo) { setSongInfo(cachedInfo); } else { setSongInfo(prev => prev || { artistName: cleanTitle.split('-')[0]?.trim() || "Yükleniyor...", artistBio: "Bilgi bulunamadı", meaningTR: "Daha önce analiz edilmiş ancak detaylar eksik.", meaningEN: "Previously analyzed but details missing.", coverArt: null, isAiGenerated: true }); } return; }
          } catch (e) { console.warn("Cache check failed, proceeding to analysis", e); }
          setLyrics([]); setGeneratedImages([]); setGeneratedPrompts([]); setSongInfo(prev => { if (prev && prev.coverArt) return prev; return { artistName: cleanTitle?.split('-')[0]?.trim() || "Yükleniyor...", artistBio: "Analiz Ediliyor...", meaningTR: "...", meaningEN: "...", coverArt: null, isAiGenerated: false }; });
          setTimeout(() => { if (analysisIdRef.current === newAnalysisId) { analyzeAudio(url, lang || 'turkish', newAnalysisId); } }, 1500); 
      } else { setIsAnalyzing(false); setAnalysisStatus(''); setLyrics([]); setShowLyrics(false); setIsSceneVisible(true); }
  };

  const handleClearCanvas = () => { setClearCanvasTrigger(prev => prev + 1); };
  const handleShapeChange = (shape: ShapeType) => { setCurrentShape(shape); setCurrentText(''); setImageSourceXY(null); setImageSourceYZ(null); setUseImageColors(false); setDepthIntensity(0); setIsSceneVisible(true); setShowLyrics(false); };
  const handleResetAll = () => {
    setCurrentText(''); setParticleColor('#ffffff'); setImageSourceXY(null); setImageSourceYZ(null); setUseImageColors(false); setDepthIntensity(0); setActivePreset('none'); setAudioMode('none'); setAudioUrl(null); setAudioTitle(null); setIsPlaying(true); setRepulsionStrength(50); setRepulsionRadius(50); setParticleCount(40000); setParticleSize(20); setModelDensity(50); setIsDrawing(false); setCanvasRotation([0, 0, 0]); setCurrentShape('sphere'); setCameraResetTrigger(prev => prev + 1); setBgMode('dark'); setIsSceneVisible(true); setBgImage(null); setCroppedBgImage(null); setSlideshowSettings(prev => ({...prev, active: false})); setIsAutoRotating(false); setShowLyrics(false); setLyrics([]); setIsAnalyzing(false); setUseLyricParticles(false); setActiveLyricText(''); setUseLyricEcho(false); setGeneratedImages([]); setGeneratedPrompts([]); setImageGenStatus({state:'idle', message:''}); setSongInfo(null); setEnableBloom(false); setEnableTrails(false); setIsNatureMode(false); setIsMotionControlActive(false); setHandZoomLevel(1.0);
    if (audioInputRef.current) audioInputRef.current.value = '';
    setAudioVersion(v => v + 1);
  };
  
  const rotateCanvasX = () => setCanvasRotation(prev => [prev[0] + Math.PI / 2, prev[1], prev[2]]);
  const rotateCanvasY = () => setCanvasRotation(prev => [prev[0], prev[1] + Math.PI / 2, prev[2]]);
  const rotateCanvasZ = () => setCanvasRotation(prev => [prev[0], prev[1], prev[2] + Math.PI / 2]);

  const displayImage = bgMode === 'image' ? (croppedBgImage || bgImage) : null;

  // --- Screensaver & App Layer Styles ---
  let appDuration = '0.25s', ssDuration = '0.25s';
  let appFilter = 'blur(0px) brightness(1)', appTransform = 'scale(1)', appInset = '0px', appRadius = '0px';
  let ssTransform = 'translateY(100%)', ssInset = '20px', ssBlur = 'blur(10px)', ssOpacity = '0', ssPointer = 'none', ssRadius = '30px', ssScale = '0.95';

  switch (ssState) {
      case 'idle': break;
      case 'e1_app_blur': appDuration = '0.25s'; appFilter = 'blur(0px) brightness(1)'; appInset = '20px'; appRadius = '30px'; appTransform = 'scale(0.95)'; break;
      case 'e2_app_shrink': appDuration = '0.25s'; appFilter = 'blur(10px) brightness(0.7)'; appInset = '20px'; appRadius = '30px'; appTransform = 'scale(0.95)'; ssDuration = '0.25s'; ssOpacity = '1'; ssTransform = 'translateY(100%)'; ssBlur = 'blur(10px)'; break;
      case 'e3_ss_slide_up': appFilter = 'blur(10px) brightness(0.5)'; appInset = '20px'; appRadius = '30px'; appTransform = 'scale(0.95)'; ssDuration = '0.25s'; ssOpacity = '1'; ssTransform = 'translateY(0)'; ssInset = '20px'; ssBlur = 'blur(10px)'; ssRadius = '30px'; ssScale = '0.95'; break;
      case 'e4_ss_unblur': appFilter = 'blur(10px) brightness(0.5)'; appInset = '20px'; appRadius = '30px'; appTransform = 'scale(0.95)'; ssDuration = '0.25s'; ssOpacity = '1'; ssTransform = 'translateY(0)'; ssBlur = 'blur(0px)'; ssInset = '20px'; ssRadius = '30px'; ssScale = '0.95'; break;
      case 'e5_ss_expand': appFilter = 'blur(10px) brightness(0.5)'; appInset = '20px'; appRadius = '30px'; appTransform = 'scale(0.95)'; ssDuration = '0.25s'; ssOpacity = '1'; ssTransform = 'translateY(0)'; ssBlur = 'blur(0px)'; ssInset = '0px'; ssRadius = '0px'; ssScale = '1'; break;
      case 'active': appFilter = 'blur(10px) brightness(0.5)'; appInset = '20px'; appRadius = '30px'; appTransform = 'scale(0.95)'; ssOpacity = '1'; ssPointer = 'auto'; ssTransform = 'translateY(0)'; ssBlur = 'blur(0px)'; ssInset = '0px'; ssRadius = '0px'; ssScale = '1'; break;
      case 'x1_ss_shrink': appFilter = 'blur(10px) brightness(0.5)'; appInset = '20px'; appRadius = '30px'; appTransform = 'scale(0.95)'; ssDuration = '0.25s'; ssOpacity = '1'; ssTransform = 'translateY(0)'; ssBlur = 'blur(0px)'; ssInset = '20px'; ssRadius = '30px'; ssScale = '0.95'; break;
      case 'x2_ss_blur': appFilter = 'blur(10px) brightness(0.5)'; appInset = '20px'; appRadius = '30px'; appTransform = 'scale(0.95)'; ssDuration = '0.25s'; ssOpacity = '1'; ssTransform = 'translateY(0)'; ssBlur = 'blur(10px)'; ssInset = '20px'; ssRadius = '30px'; ssScale = '0.95'; break;
      case 'x3_ss_slide_down': appFilter = 'blur(10px) brightness(0.5)'; appInset = '20px'; appRadius = '30px'; appTransform = 'scale(0.95)'; ssDuration = '0.25s'; ssOpacity = '1'; ssTransform = 'translateY(100%)'; ssBlur = 'blur(10px)'; ssInset = '20px'; ssRadius = '30px'; ssScale = '0.95'; break;
      case 'x4_app_expand': ssOpacity = '1'; ssTransform = 'translateY(100%)'; appDuration = '0.25s'; appFilter = 'blur(10px) brightness(0.7)'; appInset = '0px'; appRadius = '0px'; appTransform = 'scale(1)'; break;
      case 'x5_app_unblur': ssOpacity = '0'; ssDuration = '0.25s'; appDuration = '0.25s'; appFilter = 'blur(0px) brightness(1)'; appInset = '0px'; appRadius = '0px'; appTransform = 'scale(1)'; break;
  }

  const appLayerStyle: React.CSSProperties = { transition: `all ${appDuration} cubic-bezier(0.4, 0, 0.2, 1)`, position: 'absolute', overflow: 'hidden', zIndex: 0, filter: appFilter, transform: appTransform, top: appInset !== '0px' ? appInset : 0, left: appInset !== '0px' ? appInset : 0, right: appInset !== '0px' ? appInset : 0, bottom: appInset !== '0px' ? appInset : 0, width: appInset !== '0px' ? `calc(100% - ${parseInt(appInset)*2}px)` : '100%', height: appInset !== '0px' ? `calc(100% - ${parseInt(appInset)*2}px)` : '100%', borderRadius: appRadius };
  const ssLayerStyle: React.CSSProperties = { transition: `all ${ssDuration} cubic-bezier(0.4, 0, 0.2, 1)`, position: 'absolute', zIndex: 100, opacity: ssOpacity, pointerEvents: ssPointer as any, transform: ssTransform.includes('translate') ? `${ssTransform} scale(${ssScale})` : ssTransform, top: ssInset !== '0px' ? ssInset : 0, left: ssInset !== '0px' ? ssInset : 0, right: ssInset !== '0px' ? ssInset : 0, bottom: ssInset !== '0px' ? ssInset : 0, width: ssInset !== '0px' ? `calc(100% - ${parseInt(ssInset)*2}px)` : '100%', height: ssInset !== '0px' ? `calc(100% - ${parseInt(ssInset)*2}px)` : '100%', filter: ssBlur, borderRadius: ssRadius };

  // Prioritize Lyric Text over Current Text if enabled
  const displayParticlesText = (showLyrics && useLyricParticles && activeLyricText) ? activeLyricText : currentText;

  // Status Styling Logic
  let statusBg = "bg-purple-900/60 border-purple-400/20";
  let statusShadow = "shadow-[0_0_15px_#a855f7]";
  let statusIcon = <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin"></div>;

  if (imageGenStatus.state === 'success') {
      statusBg = "bg-green-900/60 border-green-400/20";
      statusShadow = "shadow-[0_0_15px_#22c55e]";
      statusIcon = <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg>;
  } else if (imageGenStatus.state === 'error') {
      statusBg = "bg-red-900/60 border-red-400/20";
      statusShadow = "shadow-[0_0_15px_#ef4444]";
      statusIcon = <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>;
  } else if (imageGenStatus.state === 'warning') {
      statusBg = "bg-yellow-900/60 border-yellow-400/20";
      statusShadow = "shadow-[0_0_15px_#eab308]";
      statusIcon = <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>;
  }

  return (
    <div className="relative w-full h-full overflow-hidden bg-black">
      <style>{`
          @keyframes gradientMove { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
          @keyframes colorCycle { 0% { background-color: #ff0000; } 20% { background-color: #ffff00; } 40% { background-color: #00ff00; } 60% { background-color: #00ffff; } 80% { background-color: #0000ff; } 100% { background-color: #ff00ff; } }
          .animate-color-cycle { animation: colorCycle 10s infinite alternate linear; }
          /* ... (Diğer animasyonlar) ... */
          @keyframes slide-left { 0% { transform: translateX(100%); opacity: 0; } 100% { transform: translateX(0); opacity: 1; } } .animate-slide-left { animation: slide-left 1s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
          @keyframes slide-right { 0% { transform: translateX(-100%); opacity: 0; } 100% { transform: translateX(0); opacity: 1; } } .animate-slide-right { animation: slide-right 1s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
          @keyframes slide-up { 0% { transform: translateY(100%); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } } .animate-slide-up { animation: slide-up 1s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
          @keyframes slide-down { 0% { transform: translateY(-100%); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } } .animate-slide-down { animation: slide-down 1s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
          @keyframes fade-in-out { 0% { opacity: 0; } 100% { opacity: 1; } } .animate-fade-in-out { animation: fade-in-out 1.5s ease-in-out forwards; }
          @keyframes blur-in-out { 0% { filter: blur(20px); opacity: 0; } 100% { filter: blur(0px); opacity: 1; } } .animate-blur-in-out { animation: blur-in-out 1.2s ease-out forwards; }
          @keyframes transform-zoom { 0% { transform: scale(1.5) rotate(5deg); opacity: 0; } 100% { transform: scale(1) rotate(0deg); opacity: 1; } } .animate-transform-zoom { animation: transform-zoom 1.5s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
          @keyframes pixelate { 0% { filter: contrast(200%) brightness(500%) saturate(0); opacity: 0; transform: scale(1.2); } 50% { filter: contrast(100%) brightness(100%) saturate(1); opacity: 1; transform: scale(1); } 100% { opacity: 1; } } .animate-pixelate { animation: pixelate 1s steps(10) forwards; }
      `}</style>

      {audioUrl && (
          <audio key={audioVersion} ref={hiddenAudioRef} src={audioUrl} loop hidden crossOrigin="anonymous" />
      )}

      {/* YÜZ KAYIT MODALI (YENİ) */}
      {isEnrollingFace && (
          <FaceEnrollment 
              onComplete={handleFaceEnrollmentComplete} 
              onCancel={handleFaceEnrollmentCancel} 
          />
      )}

      {/* MOTION CONTROLLER COMPONENT */}
      <MotionController 
          active={calculatedMotionActive} 
          stealthMode={false} // Ekran koruyucuda görünür olsun (false)
          onHandMove={handleHandMove} 
          onGesture={handleHandGesture}
          onZoom={handleHandZoom}
          onCursorMove={handleCursorMove}
          onClick={handleHandClick} // YENİ: Tıklama handler'ı bağlandı
          onError={(msg) => setStatus('error', msg, true)} 
      />

      {/* VIRTUAL CURSOR (HAND CONTROL) */}
      {calculatedMotionActive && isCursorActive && ssState !== 'active' && (
          <div 
              ref={cursorRef}
              className={`fixed top-0 left-0 w-8 h-8 pointer-events-none z-[9999] transition-transform duration-75 ease-out`}
              style={{ willChange: 'transform' }}
          >
              <div className={`w-full h-full rounded-full border-2 transition-all duration-300 ${
                  isCursorClicking
                    ? 'border-blue-500 bg-blue-500 scale-75 shadow-[0_0_30px_rgba(59,130,246,1)]' // Tıklama durumu
                    : isCursorHovering 
                        ? 'border-orange-500 bg-orange-500/30 scale-125 shadow-[0_0_20px_rgba(249,115,22,0.6)]' 
                        : 'border-white/80 bg-white/10 shadow-[0_0_10px_rgba(255,255,255,0.4)]'
              }`}></div>
              {/* Orta Nokta */}
              <div className={`absolute top-1/2 left-1/2 w-1 h-1 bg-white rounded-full -translate-x-1/2 -translate-y-1/2 transition-all ${isCursorClicking ? 'scale-0' : 'scale-100'}`}></div>
          </div>
      )}

      <div id="app-layer" style={appLayerStyle} className="bg-black shadow-2xl">
          <div className="relative w-full h-full overflow-hidden">
            <div className="absolute inset-0 z-0 transition-colors duration-1000 ease-in-out" style={{ backgroundColor: bgMode === 'dark' ? '#000' : bgMode === 'light' ? '#fff' : bgMode === 'color' ? customBgColor : 'transparent' }}>
                {displayImage && (<img key={displayImage} src={displayImage} alt="background" className={`w-full h-full object-cover select-none pointer-events-none ${slideshowSettings.active ? activeTransitionClass : 'transition-opacity duration-700'}`} style={{ objectFit: bgImageStyle, objectPosition: 'center center' }} />)}
                {bgMode === 'gradient' && ( <div className="w-full h-full bg-[linear-gradient(45deg,#ff0000,#ff7300,#fffb00,#48ff00,#00ffd5,#002bff,#7a00ff,#ff00c8,#ff0000)] bg-[length:400%_400%] animate-gradient-xy opacity-80" style={{ animation: 'gradientMove 15s ease infinite' }} /> )}
                {bgMode === 'auto' && ( <div className="w-full h-full animate-color-cycle" /> )}
            </div>
            
            <ClockWidget 
                isMinimized={isWidgetMinimized} 
                onToggleMinimize={() => setIsWidgetMinimized(!isWidgetMinimized)} 
                bgMode={bgMode} 
                bgImageStyle={bgImageStyle} 
                isUIHidden={isUIHidden} 
                ssBgColor={ssBgColor} 
                setSsBgColor={setSsBgColor} 
                ssTextColor={ssTextColor} 
                setSsTextColor={setSsTextColor} 
                userText={widgetUserText} 
                onUserTextChange={setWidgetUserText}
                isNatureMode={isNatureMode}
                onToggleNatureMode={() => setIsNatureMode(!isNatureMode)}
                autoSsSettings={autoSsSettings}
                onAutoSsChange={setAutoSsSettings}
            />

            {/* Non-intrusive Analysis Indicator (Left/Center Top) */}
            {isAnalyzing && (
                <div className="absolute top-20 right-6 z-30 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 flex items-center gap-3 animate-pulse shadow-[0_0_15px_#3b82f6]">
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-white text-xs font-mono tracking-wider">{analysisStatus}</span>
                </div>
            )}

            {/* AI Image Generation Status (Right Top - Stacked) */}
            {imageGenStatus.state !== 'idle' && (
                <div className={`absolute top-32 right-6 z-30 ${statusBg} backdrop-blur-md px-4 py-2 rounded-full border flex items-center gap-3 animate-in fade-in slide-in-from-right-5 duration-300 ${statusShadow}`}>
                    {statusIcon}
                    <span className="text-white text-xs font-mono tracking-wider">{imageGenStatus.message}</span>
                </div>
            )}

            {/* DOM Lyrics Box - Only show if Particles are disabled and we have lyrics */}
            {showLyrics && !useLyricParticles && ( <LyricsBox lyrics={lyrics} currentTime={audioCurrentTime} duration={audioDuration} audioRef={hiddenAudioRef} visible={showLyrics} /> )}

            <div className={`absolute inset-0 z-10 transition-all duration-1000 ${isSceneVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none blur-sm'}`}>
                <Experience 
                  text={displayParticlesText} 
                  imageXY={imageSourceXY} 
                  imageYZ={imageSourceYZ} 
                  useImageColors={useImageColors} 
                  particleColor={particleColor} 
                  disableInteraction={isUIInteraction} 
                  depthIntensity={depthIntensity} 
                  repulsionStrength={repulsionStrength} 
                  repulsionRadius={repulsionRadius} 
                  particleCount={particleCount} 
                  particleSize={particleSize} 
                  modelDensity={modelDensity} 
                  activePreset={activePreset} 
                  audioMode={audioMode} 
                  analyser={analyserRef.current} 
                  isPlaying={isPlaying} 
                  volume={volume} 
                  isDrawing={isDrawing} 
                  brushSize={brushSize} 
                  getDrawingDataRef={getDrawingDataRef} 
                  canvasRotation={canvasRotation} 
                  clearCanvasTrigger={clearCanvasTrigger} 
                  currentShape={currentShape} 
                  cameraResetTrigger={cameraResetTrigger} 
                  isSceneVisible={isSceneVisible} 
                  isAutoRotating={isAutoRotating} 
                  onStopAutoRotation={() => setIsAutoRotating(false)} 
                  enableAudioReactivity={useLyricEcho} 
                  enableBloom={enableBloom}
                  enableTrails={enableTrails} // Pass Trail State
                  forceTrigger={forceTrigger} // NEW: Pass forceTrigger
                  handZoomLevel={handZoomLevel} // NEW: Pass zoom level
                  isMotionControlActive={isMotionControlActive} // PASS THIS PROP
                />
            </div>
            
            <UIOverlay 
                onSubmit={handleTextSubmit} 
                onImageUpload={handleImageUpload} 
                onDrawingStart={handleDrawingStart} 
                onDrawingConfirm={handleDrawingConfirm} 
                isDrawing={isDrawing} 
                brushSize={brushSize} 
                onBrushSizeChange={setBrushSize} 
                canvasRotation={canvasRotation} 
                onRotateX={rotateCanvasX} 
                onRotateY={rotateCanvasY} 
                onRotateZ={rotateCanvasZ} 
                currentColor={particleColor} 
                onColorChange={handleColorChange} 
                onResetColors={handleResetColors} 
                isOriginalColors={useImageColors} 
                onInteractionStart={handleInteractionResume} 
                onInteractionEnd={() => setIsUIInteraction(false)} 
                hasImage={!!imageSourceXY || !!imageSourceYZ} 
                depthIntensity={depthIntensity} 
                onDepthChange={setDepthIntensity} 
                repulsionStrength={repulsionStrength} 
                onRepulsionChange={setRepulsionStrength} 
                repulsionRadius={repulsionRadius} 
                onRadiusChange={setRepulsionRadius} 
                particleCount={particleCount} 
                onParticleCountChange={setParticleCount} 
                particleSize={particleSize} 
                onParticleSizeChange={setParticleSize} 
                modelDensity={modelDensity} 
                onModelDensityChange={setModelDensity} 
                activePreset={activePreset} 
                onPresetChange={setActivePreset} 
                onAudioChange={handleAudioChange} 
                audioMode={audioMode} 
                audioTitle={audioTitle} 
                isPlaying={isPlaying} 
                onTogglePlay={() => setIsPlaying(!isPlaying)} 
                volume={volume} 
                onVolumeChange={setVolume} 
                onResetAll={handleResetAll} 
                onClearCanvas={handleClearCanvas} 
                bgMode={bgMode} 
                onBgModeChange={handleBgModeChange} 
                onBgImageConfirm={(img, style) => {}} 
                customBgColor={customBgColor} 
                currentShape={currentShape} 
                onShapeChange={handleShapeChange} 
                isWidgetMinimized={isWidgetMinimized} 
                isUIHidden={isUIHidden} 
                onToggleUI={() => setIsUIHidden(!isUIHidden)} 
                isSceneVisible={isSceneVisible} 
                onToggleScene={() => { setIsSceneVisible(!isSceneVisible); if(lyrics.length > 0 && !isSceneVisible) setShowLyrics(true); else setShowLyrics(false); }} 
                bgImages={bgImages} 
                onBgImagesAdd={handleBgImagesAdd} 
                onBgImageSelect={handleBgImageSelectFromDeck} 
                onBgImageStyleChange={handleBgImageStyleChange} 
                bgImageStyle={bgImageStyle} 
                onRemoveBgImage={handleRemoveBgImage} 
                onBgTransformChange={handleApplyCrop} 
                onResetDeck={handleDeckReset} 
                slideshowSettings={slideshowSettings} 
                onSlideshowSettingsChange={setSlideshowSettings} 
                isAutoRotating={isAutoRotating} 
                onToggleAutoRotation={() => setIsAutoRotating(!isAutoRotating)} 
                useLyricParticles={useLyricParticles}
                onToggleLyricParticles={() => setUseLyricParticles(!useLyricParticles)}
                hasLyrics={lyrics.length > 0}
                useLyricEcho={useLyricEcho}
                onToggleLyricEcho={() => setUseLyricEcho(!useLyricEcho)}
                generatedImages={generatedImages} 
                generatedPrompts={generatedPrompts} 
                ref={audioInputRef} 
                songInfo={songInfo} 
                showInfoPanel={showInfoPanel && audioMode !== 'none'} 
                onToggleInfoPanel={() => setShowInfoPanel(!showInfoPanel)}
                isMoodSyncActive={isMoodSyncActive}
                onToggleMoodSync={handleMoodSyncToggle}
                // BLOOM PROPS
                enableBloom={enableBloom}
                onToggleBloom={() => setEnableBloom(!enableBloom)}
                // TRAIL PROPS
                enableTrails={enableTrails}
                onToggleTrails={() => setEnableTrails(!enableTrails)}
                // LYRIC UI PROPS
                showLyrics={showLyrics}
                onToggleShowLyrics={() => setShowLyrics(!showLyrics)}
                // LIVE CHAT PROPS
                isLiveActive={isLiveActive}
                liveStatus={liveStatus}
                onToggleLive={toggleLiveConnection}
                // MOTION CONTROL PROPS
                isMotionControlActive={isMotionControlActive}
                onToggleMotionControl={() => setIsMotionControlActive(!isMotionControlActive)}
                // SECURITY MODE PROPS
                securityMode={securityMode}
                onSecurityModeChange={handleSecurityModeChange}
            />
          </div>
      </div>

      <div id="screensaver-layer" style={ssLayerStyle} className="shadow-2xl">
          <Screensaver active={ssState === 'active' || ssState.startsWith('e') || ssState.startsWith('x')} onClick={handleScreensaverClick} bgColor={ssBgColor} textColor={ssTextColor} userText={widgetUserText} isNatureMode={isNatureMode} />
      </div>
    </div>
  );
};

export default App;
