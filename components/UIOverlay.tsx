
import React, { useState, useRef, useEffect, forwardRef } from 'react';
import { createPortal } from 'react-dom';
import { PresetType, AudioMode, BackgroundMode, BgImageStyle, ShapeType, SlideshowSettings, SlideshowTransition, SlideshowOrder, SongInfo, SecurityMode } from '../types';

const FONTS = [
  { name: 'Mono', value: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' },
  { name: 'Sans Serif', value: 'ui-sans-serif, system-ui, sans-serif' },
  { name: 'Serif', value: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif' },
  { name: 'Cursive', value: '"Comic Sans MS", "Chalkboard SE", "Comic Neue", sans-serif' },
  { name: 'Fantasy', value: 'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif' },
];

interface UIOverlayProps {
  onSubmit: (text: string) => void;
  onImageUpload: (imgSrc: string, useOriginalColors: boolean) => void;
  onDrawingStart: () => void;
  onDrawingConfirm: () => void;
  isDrawing: boolean;
  brushSize: number;
  onBrushSizeChange: (size: number) => void;
  canvasRotation: [number, number, number];
  onRotateX: () => void;
  onRotateY: () => void;
  onRotateZ: () => void;
  currentColor: string;
  onColorChange: (color: string) => void;
  onResetColors: () => void;
  isOriginalColors: boolean;
  onInteractionStart: () => void;
  onInteractionEnd: () => void;
  hasImage: boolean;
  depthIntensity: number;
  onDepthChange: (val: number) => void;
  repulsionStrength: number;
  onRepulsionChange: (val: number) => void;
  repulsionRadius: number;
  onRadiusChange: (val: number) => void;
  particleCount: number;
  onParticleCountChange: (val: number) => void;
  particleSize: number;
  onParticleSizeChange: (val: number) => void;
  modelDensity: number;
  onModelDensityChange: (val: number) => void;
  activePreset: PresetType;
  onPresetChange: (preset: PresetType) => void;
  onAudioChange: (mode: AudioMode, url: string | null, title?: string, lang?: string) => void;
  audioMode: AudioMode;
  audioTitle?: string | null;
  isPlaying?: boolean;
  onTogglePlay?: () => void;
  volume?: number;
  onVolumeChange?: (vol: number) => void;
  onResetAll: () => void;
  onClearCanvas: () => void;
  bgMode: BackgroundMode;
  onBgModeChange: (mode: BackgroundMode, data?: string) => void;
  onBgImageConfirm: (img: string, style: BgImageStyle) => void; 
  customBgColor: string;
  currentShape: ShapeType;
  onShapeChange: (shape: ShapeType) => void;
  isWidgetMinimized: boolean;
  isUIHidden: boolean;
  onToggleUI: () => void;
  isSceneVisible?: boolean;
  onToggleScene?: () => void;
  bgImages?: string[];
  onBgImagesAdd?: (images: string[]) => void;
  onBgImageSelect?: (img: string) => void;
  onBgImageStyleChange?: (style: BgImageStyle) => void;
  bgImageStyle?: BgImageStyle;
  onRemoveBgImage?: (img: string) => void;
  onBgPositionChange?: (pos: string, zoom: number) => void; 
  onBgTransformChange?: (croppedDataUrl: string) => void; 
  onResetDeck?: (deleteImages: boolean, resetSize: boolean) => void;
  slideshowSettings?: SlideshowSettings;
  onSlideshowSettingsChange?: (settings: React.SetStateAction<SlideshowSettings>) => void;
  isAutoRotating?: boolean;
  onToggleAutoRotation?: () => void;
  useLyricParticles?: boolean;
  onToggleLyricParticles?: () => void;
  hasLyrics?: boolean;
  useLyricEcho?: boolean; 
  onToggleLyricEcho?: () => void; 
  generatedImages?: string[];
  generatedPrompts?: string[];
  songInfo?: SongInfo | null;
  showInfoPanel?: boolean;
  onToggleInfoPanel?: () => void;
  isMoodSyncActive?: boolean;
  onToggleMoodSync?: () => void;
  enableBloom?: boolean;
  onToggleBloom?: () => void;
  enableTrails?: boolean;
  onToggleTrails?: () => void;
  showLyrics?: boolean;
  onToggleShowLyrics?: () => void;
  isLiveActive?: boolean;
  liveStatus?: 'disconnected' | 'connecting' | 'connected' | 'speaking';
  onToggleLive?: () => void;
  isMotionControlActive?: boolean;
  onToggleMotionControl?: () => void;
  securityMode?: SecurityMode;
  onSecurityModeChange?: (mode: SecurityMode) => void;
}

const StylishSlider: React.FC<{
    value: number;
    min: number;
    max: number;
    step?: number;
    onChange: (val: number) => void;
    colorClass?: string;
    trackColorClass?: string;
}> = ({ value, min, max, step = 1, onChange, colorClass = "bg-blue-500", trackColorClass = "bg-white/10" }) => {
    const percentage = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
    return (
        <div className="relative w-full h-7 flex items-center select-none group cursor-pointer">
            <div className={`absolute w-full h-1.5 ${trackColorClass} rounded-full overflow-hidden backdrop-blur-sm border border-white/5`}>
                <div className={`h-full ${colorClass} opacity-80 group-hover:opacity-100 transition-all duration-300 relative shadow-[0_0_10px_currentColor]`} style={{ width: `${percentage}%` }}><div className="absolute right-0 top-0 bottom-0 w-2 bg-white/50 blur-[2px]"></div></div>
            </div>
            <div className={`absolute h-4 w-4 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)] border-2 border-white/50 transform transition-all duration-200 ease-out group-hover:scale-125 group-active:scale-95 pointer-events-none z-10 flex items-center justify-center`} style={{ left: `calc(${percentage}% - 8px)` }}>
                <div className={`w-1.5 h-1.5 rounded-full ${colorClass.replace('bg-', 'bg-opacity-50 bg-')}`}></div>
            </div>
            <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20" />
        </div>
    );
};

const ImageDeck: React.FC<{
    images: string[];
    activeIndex: number;
    onIndexChange: (index: number) => void;
    onSelect: (img: string) => void;
    onRemove: (img: string) => void;
    onHover?: (img: string) => void;
    positionClass?: string;
    side: 'left' | 'right';
    isUIHidden: boolean;
    hideInCleanMode: boolean;
    extraButtons?: React.ReactNode;
    downloadable?: boolean;
}> = ({ images, activeIndex, onIndexChange, onSelect, onRemove, onHover, positionClass, side, isUIHidden, hideInCleanMode, extraButtons, downloadable }) => {
    const [expanded, setExpanded] = useState(false);
    const [scrollOffset, setScrollOffset] = useState(0);
    const [animState, setAnimState] = useState<'idle' | 'next' | 'prev'>('idle');
    const animTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const VISIBLE_STACK = 3;
    const EXPANDED_VISIBLE_COUNT = 6;
    
    useEffect(() => { if (images.length === 0 && activeIndex !== 0) onIndexChange(0); }, [images.length]);

    const handleWheel = (e: React.WheelEvent) => {
        e.stopPropagation();
        if (images.length <= 1) return;
        if (expanded) {
            if (images.length <= EXPANDED_VISIBLE_COUNT) return;
            const dir = e.deltaY > 0 ? 1 : -1;
            setScrollOffset(prev => Math.max(0, Math.min(Math.max(0, images.length - EXPANDED_VISIBLE_COUNT), prev + dir)));
        } else {
            if (animState !== 'idle') return;
            const dir = e.deltaY > 0 ? 'next' : 'prev';
            setAnimState(dir);
            if (animTimeoutRef.current) clearTimeout(animTimeoutRef.current);
            animTimeoutRef.current = setTimeout(() => {
                setAnimState('idle');
                onIndexChange(dir === 'next' ? (activeIndex + 1) % images.length : (activeIndex - 1 + images.length) % images.length);
            }, 400); 
        }
    };

    const handleContextMenu = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); setExpanded(!expanded); if (!expanded) setScrollOffset(0); };
    const handleCardClick = (e: React.MouseEvent, img: string, realIndex?: number) => { e.stopPropagation(); if (expanded) { if (realIndex !== undefined) onIndexChange(realIndex); onSelect(img); setExpanded(false); } else { onSelect(img); } };
    const downloadImage = (e: React.MouseEvent, dataUrl: string, index: number) => { e.stopPropagation(); const link = document.createElement('a'); link.href = dataUrl; link.download = `image_${index + 1}.png`; document.body.appendChild(link); link.click(); document.body.removeChild(link); };

    const renderCollapsedStack = () => {
        if (images.length === 0) return null;
        if (images.length === 1) {
             return ( <div className="relative w-full h-full perspective-[500px]"> <div className="deck-card group" style={{ backgroundImage: `url(${images[0]})`, zIndex: 50, transform: 'scale(1)', opacity: 1 }} onContextMenu={handleContextMenu} onClick={(e) => handleCardClick(e, images[0])}> {!expanded && extraButtons} </div> </div> );
        }
        const stackItems = [];
        const count = Math.min(images.length, VISIBLE_STACK);
        for (let i = 0; i < count; i++) {
            let logicalIndex = (activeIndex + i) % images.length;
            let zIndex = 50 - i * 10;
            let transform = `translateY(${-i * 4}px) translateX(${i * 2}px) scale(${1 - i * 0.05})`;
            let opacity = 1 - i * 0.2;
            let className = "deck-card group";
            if (animState === 'next') { if (i === 0) { className += " anim-throw-back"; zIndex = 60; } else { className += " anim-slide-forward"; } } else if (animState === 'prev') { if (i === 0 || i === 1) className += " anim-slide-backward"; }
            stackItems.push( <div key={`stack-${logicalIndex}-${i}`} className={className} style={{ backgroundImage: `url(${images[logicalIndex]})`, zIndex, transform, opacity }} onContextMenu={handleContextMenu} onClick={(e) => handleCardClick(e, images[logicalIndex])} > {i === 0 && !expanded && extraButtons} </div> );
        }
        if (animState === 'prev') { const prevIndex = (activeIndex - 1 + images.length) % images.length; stackItems.push(<div key="ghost-prev" className="deck-card anim-fetch-front" style={{ backgroundImage: `url(${images[prevIndex]})`, zIndex: 100 }} />); }
        return <div className="relative w-full h-full perspective-[500px]">{stackItems}</div>;
    };

    const renderExpandedList = () => {
        const visibleImages = images.slice(scrollOffset, scrollOffset + EXPANDED_VISIBLE_COUNT);
        return ( <div className="flex flex-col-reverse gap-2 w-full h-full animate-in slide-in-from-bottom-4 duration-300"> {visibleImages.map((img, idx) => { const realIdx = scrollOffset + idx; return ( <div key={`exp-${realIdx}`} className="w-full h-16 rounded-lg bg-cover bg-center border border-white/20 hover:border-blue-400 hover:scale-105 transition-all shadow-lg relative group cursor-pointer shrink-0" style={{ backgroundImage: `url(${img})` }} onClick={(e) => handleCardClick(e, img, realIdx)} onMouseEnter={() => onHover && onHover(img)} > <button onClick={(e) => { e.stopPropagation(); onRemove(img); }} className="absolute -top-2 -right-2 w-5 h-5 bg-red-600 rounded-full text-white flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-10 hover:bg-red-500" title="Sil">-</button> {downloadable && ( <button onClick={(e) => downloadImage(e, img, realIdx)} className="absolute -top-2 -left-2 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-10 hover:bg-blue-500" title="İndir"> <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> </button> )} {realIdx === activeIndex && <div className="absolute inset-0 border-2 border-blue-500 rounded-lg pointer-events-none"></div>} </div> ); })} </div> );
    };

    const shouldHide = isUIHidden && hideInCleanMode;
    const hideTransform = side === 'right' ? 'translate-x-[150%]' : 'translate-y-[200%]';
    const containerClass = shouldHide ? `${hideTransform} opacity-0 pointer-events-none` : "translate-0 opacity-100";
    const posStyle = positionClass || (side === 'left' ? 'right-48 bottom-[5.5rem]' : 'right-6 bottom-[5.5rem]');

    useEffect(() => { if(expanded) { const close = () => setExpanded(false); window.addEventListener('click', close); return () => window.removeEventListener('click', close); } }, [expanded]);
    
    return ( 
        <div className={`absolute w-24 h-16 transition-all duration-500 ease-in-out z-[55] ${posStyle} ${containerClass}`} onWheel={handleWheel} onClick={(e) => e.stopPropagation()} > 
            {expanded ? ( <div className="absolute bottom-0 w-28 flex flex-col p-2 max-h-[80vh]" style={{ transform: 'translateX(-8px)' }}>{renderExpandedList()}</div> ) : renderCollapsedStack()} 
        </div> 
    );
};

export const UIOverlay = forwardRef<HTMLInputElement, UIOverlayProps>(({ 
  onSubmit, onImageUpload, onDrawingStart, onDrawingConfirm, isDrawing, brushSize, onBrushSizeChange, canvasRotation, onRotateX, onRotateY, onRotateZ, currentColor, onColorChange, onResetColors, isOriginalColors, onInteractionStart, onInteractionEnd, hasImage, depthIntensity, onDepthChange, repulsionStrength, onRepulsionChange, repulsionRadius, onRadiusChange, particleCount, onParticleCountChange, particleSize, onParticleSizeChange, modelDensity, onModelDensityChange, activePreset, onPresetChange, onAudioChange, audioMode, audioTitle, isPlaying = true, onTogglePlay, volume = 0.5, onVolumeChange, onResetAll, onClearCanvas, bgMode, onBgModeChange, onBgImageConfirm, customBgColor, currentShape, onShapeChange, isWidgetMinimized, isUIHidden, onToggleUI, isSceneVisible = true, onToggleScene, bgImages = [], onBgImagesAdd, onBgImageSelect, onBgImageStyleChange, bgImageStyle = 'cover', onRemoveBgImage, onBgPositionChange, onBgTransformChange, onResetDeck, slideshowSettings, onSlideshowSettingsChange, isAutoRotating = true, onToggleAutoRotation, useLyricParticles = false, onToggleLyricParticles, hasLyrics = false, useLyricEcho = false, onToggleLyricEcho, generatedImages = [], generatedPrompts = [], songInfo, showInfoPanel = true, onToggleInfoPanel, isMoodSyncActive, onToggleMoodSync, enableBloom = false, onToggleBloom, enableTrails = false, onToggleTrails, showLyrics = false, onToggleShowLyrics, isLiveActive, liveStatus, onToggleLive, isMotionControlActive, onToggleMotionControl, securityMode, onSecurityModeChange
}, ref) => {
  const [inputValue, setInputValue] = useState('');
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isBgPaletteOpen, setIsBgPaletteOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [isShapeMenuOpen, setIsShapeMenuOpen] = useState(false); 
  const [savedColor, setSavedColor] = useState(currentColor);
  const [showImageModal, setShowImageModal] = useState(false);
  const [useOriginalImageColors, setUseOriginalImageColors] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState('turkish');
  const [showMusicSettings, setShowMusicSettings] = useState(false);
  const [musicShowInCleanMode, setMusicShowInCleanMode] = useState(false);
  const [showVolumeControl, setShowVolumeControl] = useState(false);
  const [isMusicPlayerMinimized, setIsMusicPlayerMinimized] = useState(false);
  const [musicFont, setMusicFont] = useState(FONTS[0].value);
  const [musicBold, setMusicBold] = useState(false);
  const [musicItalic, setMusicItalic] = useState(false);
  const [isInfoExpanded, setIsInfoExpanded] = useState(false);
  const [userDeckIndex, setUserDeckIndex] = useState(0);
  const [aiDeckIndex, setAiDeckIndex] = useState(0);
  const [deckShowSettings, setDeckShowSettings] = useState(false);
  const [deckHideInCleanMode, setDeckHideInCleanMode] = useState(false);
  const [aiDeckShowSettings, setAiDeckShowSettings] = useState(false);
  const [aiDeckHideInCleanMode, setAiDeckHideInCleanMode] = useState(false);
  const [showSlideshowPanel, setShowSlideshowPanel] = useState(false);
  const [showTransitionGrid, setShowTransitionGrid] = useState(false);
  const [showResetMenu, setShowResetMenu] = useState(false);
  const [chkDeleteAll, setChkDeleteAll] = useState(false);
  const [chkResetSize, setChkResetSize] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });
  const [cropScale, setCropScale] = useState(1);
  const [isDraggingCrop, setIsDraggingCrop] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [startOffset, setStartOffset] = useState({ x: 0, y: 0 });
  const [showEffectsMenu, setShowEffectsMenu] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null); 
  const bgImageInputRef = useRef<HTMLInputElement>(null);
  const cropContainerRef = useRef<HTMLDivElement>(null);
  const cropImageRef = useRef<HTMLImageElement>(null);
  
  // Last Volume Memory for Mute/Unmute
  const lastVolumeRef = useRef(0.5);

  // Update last volume when user changes it via slider (only if not muted)
  useEffect(() => {
      if (volume > 0) {
          lastVolumeRef.current = volume;
      }
  }, [volume]);

  const handleVolumeClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onVolumeChange) {
          if (volume > 0) {
              // Mute: Save current volume and set to 0
              lastVolumeRef.current = volume;
              onVolumeChange(0);
          } else {
              // Unmute: Restore last known volume or default to 0.5
              onVolumeChange(lastVolumeRef.current || 0.5);
          }
      }
  };
  
  const isLightMode = bgMode === 'light';
  const isAnyMenuOpen = isSettingsOpen || isThemeMenuOpen || isShapeMenuOpen || isBgPaletteOpen || isPaletteOpen || showMusicSettings || deckShowSettings || showResetMenu || showSlideshowPanel || showEffectsMenu || aiDeckShowSettings;
  const actualAudioInputRef = (ref as React.RefObject<HTMLInputElement>) || audioInputRef;

  const closeAllMenus = () => {
    setIsSettingsOpen(false); setIsThemeMenuOpen(false); setIsShapeMenuOpen(false); setIsBgPaletteOpen(false); setIsPaletteOpen(false); setShowMusicSettings(false); setDeckShowSettings(false); setShowResetMenu(false); setShowSlideshowPanel(false); setShowEffectsMenu(false); setAiDeckShowSettings(false);
    if (isInfoExpanded) setIsInfoExpanded(false);
    onInteractionEnd();
  };

  useEffect(() => { if (isDrawing) closeAllMenus(); }, [isDrawing]);
  useEffect(() => { [...bgImages, ...generatedImages].forEach(src => { const img = new Image(); img.src = src; }); }, [bgImages, generatedImages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') { if (inputValue.trim() === '') onSubmit(''); else onSubmit(inputValue); } };
  const handleShapeSelect = (shape: ShapeType) => { onShapeChange(shape); setIsShapeMenuOpen(false); };
  const handleSpectrumMove = (e: React.MouseEvent<HTMLDivElement>) => { const rect = e.currentTarget.getBoundingClientRect(); const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)); const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)); onColorChange(`hsl(${x * 360}, 100%, ${(1 - y) * 100}%)`); };
  const handleSpectrumClick = (e: React.MouseEvent<HTMLDivElement>) => { const rect = e.currentTarget.getBoundingClientRect(); const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)); const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)); const color = `hsl(${x * 360}, 100%, ${(1 - y) * 100}%)`; setSavedColor(color); onColorChange(color); if (!isDrawing) setIsPaletteOpen(false); onInteractionEnd(); };
  const handleBgSpectrumMove = (e: React.MouseEvent<HTMLDivElement>) => { const rect = e.currentTarget.getBoundingClientRect(); const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)); const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)); onBgModeChange('color', `hsl(${x * 360}, 100%, ${(1 - y) * 100}%)`); };
  const handleBgSpectrumClick = (e: React.MouseEvent<HTMLDivElement>) => { handleBgSpectrumMove(e); setIsBgPaletteOpen(false); };
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onload = (event) => { if (event.target?.result) { setPendingImage(event.target.result as string); setUseOriginalImageColors(true); setShowImageModal(true); onInteractionStart(); } }; reader.readAsDataURL(file); } if (fileInputRef.current) fileInputRef.current.value = ''; };
  const handleBgImagesSelect = (e: React.ChangeEvent<HTMLInputElement>) => { const files = e.target.files; if (files && files.length > 0) { Promise.all(Array.from(files).map((file) => new Promise<string>((resolve) => { const reader = new FileReader(); reader.onload = (e) => resolve(e.target?.result as string); reader.readAsDataURL(file as any as Blob); }))).then(images => { if (onBgImagesAdd) onBgImagesAdd(images); setIsThemeMenuOpen(false); onInteractionEnd(); }); } if (bgImageInputRef.current) bgImageInputRef.current.value = ''; }
  const handleAudioSelect = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) { onAudioChange('file', URL.createObjectURL(file as any as Blob), file.name, selectedLanguage); onInteractionEnd(); } }
  const confirmImageUpload = () => { if (pendingImage) { onImageUpload(pendingImage, useOriginalImageColors); setInputValue(''); } setShowImageModal(false); setPendingImage(null); onInteractionEnd(); };
  const cancelDrawing = () => onResetAll();
  const stopProp = (e: React.PointerEvent | React.MouseEvent) => e.stopPropagation();
  const toggleThemeMenu = () => { setIsThemeMenuOpen(!isThemeMenuOpen); setIsShapeMenuOpen(false); setIsSettingsOpen(false); setIsBgPaletteOpen(false); };
  const toggleShapeMenu = () => { setIsShapeMenuOpen(!isShapeMenuOpen); setIsThemeMenuOpen(false); setIsSettingsOpen(false); setIsBgPaletteOpen(false); }
  const handleGenImageHover = (img: string) => { onBgModeChange('image', img); };
  const handleGenImageClick = (img: string) => { if (onBgImageSelect) onBgImageSelect(img); if (onSlideshowSettingsChange) onSlideshowSettingsChange(prev => ({...prev, active: false})); };
  const hideLeftClass = isUIHidden ? "-translate-x-[200%] opacity-0 pointer-events-none" : "translate-x-0 opacity-100";
  
  const handleBgImageSelectFromDeck = (img: string) => { if (onBgImageSelect) onBgImageSelect(img); if (onSlideshowSettingsChange) onSlideshowSettingsChange(prev => ({...prev, active: false})); };
  const currentUserActiveImage = bgImages && bgImages.length > 0 ? bgImages[userDeckIndex % bgImages.length] : null;
  
  const openResetMenu = (e: React.MouseEvent) => { 
      e.stopPropagation(); 
      setChkDeleteAll(false);
      setChkResetSize(false);
      setShowResetMenu(true); 
      setDeckShowSettings(false); 
  };
  
  const handleTrashConfirm = () => {
      if (onResetDeck) onResetDeck(chkDeleteAll, chkResetSize);
      if (chkDeleteAll) setUserDeckIndex(0);
      setShowResetMenu(false);
  };

  const toggleSlideshow = () => { if (onSlideshowSettingsChange && slideshowSettings) { onSlideshowSettingsChange(prev => ({ ...prev, active: !prev.active })); } };
  const updateSlideshow = (updates: Partial<SlideshowSettings>) => { if (onSlideshowSettingsChange) { onSlideshowSettingsChange(prev => ({ ...prev, ...updates })); } };
  const TRANSITION_ICONS: Record<SlideshowTransition, React.ReactNode> = { 'random': <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l5 5M4 4l5 5"/></svg>, 'slide-left': <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>, 'slide-right': <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>, 'slide-up': <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg>, 'slide-down': <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>, 'particles': <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="4" cy="4" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="20" cy="4" r="2"/><circle cx="4" cy="20" r="2"/><circle cx="12" cy="20" r="2"/><circle cx="20" cy="20" r="2"/></svg>, 'transform': <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a15 15 0 0 1 0 20"/></svg>, 'fade': <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeDasharray="4 4"/></svg>, 'blur': <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg> };
  const TRANSITION_NAMES: Record<SlideshowTransition, string> = { 'random': 'Rastgele', 'slide-left': 'Sola Kay', 'slide-right': 'Sağa Kay', 'slide-up': 'Yukarı', 'slide-down': 'Aşağı', 'particles': 'Partikül', 'transform': 'Dönüşüm', 'fade': 'Solma', 'blur': 'Bulanık' };

  const vinylArt = songInfo?.coverArt;
  const isLoadingInfo = songInfo?.artistBio === "Analiz Ediliyor...";
  const isUnknownArtist = songInfo?.artistBio === "Bilinmeyen Sanatçı" || songInfo?.artistName === "AI Artist";
  const toggleInfoExpand = (e: React.MouseEvent) => { e.stopPropagation(); setIsInfoExpanded(!isInfoExpanded); };
  const handleInfoBackdropClick = (e: React.MouseEvent) => { e.stopPropagation(); setIsInfoExpanded(false); };

  // --- CLEAN MODE & HIDE LOGIC ---
  const hiddenItemClass = isUIHidden ? "w-0 p-0 m-0 opacity-0 border-0" : "w-10 opacity-100";
  const dividerClass = isUIHidden ? "w-0 mx-0 opacity-0" : "w-px mx-1";
  const shouldHideUserDeck = isUIHidden && deckHideInCleanMode;
  const shouldHideAIDeck = isUIHidden && aiDeckHideInCleanMode;

  const dockShadowClass = bgMode !== 'dark' ? 'shadow-[0_4px_20px_rgba(0,0,0,0.5)]' : '';
  const isMusicVisible = (!isUIHidden || musicShowInCleanMode) && !isDrawing;
  const musicHideClass = isMusicVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-[200%] pointer-events-none';

  return (
    <>
      <style>{`
        /* ... Styles ... */
        @keyframes electric-pulse { 0% { box-shadow: 0 0 5px #0ff; border-color: #0ff; } 50% { box-shadow: 0 0 20px #0ff, 0 0 10px #fff; border-color: #fff; } 100% { box-shadow: 0 0 5px #0ff; border-color: #0ff; } }
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin-slow { animation: spin-slow 8s linear infinite; }
        .paused-spin { animation-play-state: paused; }
        .icon-animate-wiggle:hover { animation: wiggle 0.5s ease-in-out infinite; }
        .icon-animate-bounce:hover { animation: bounce 0.5s infinite; }
        .icon-animate-pulse:hover { animation: pulse 1s infinite; }
        .icon-animate-spin:hover { animation: spin 1s linear infinite; }
        @keyframes wiggle { 0%, 100% { transform: rotate(-10deg); } 50% { transform: rotate(10deg); } }
        @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .preset-btn { transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); }
        .preset-btn.active { transform: scale(1.15); z-index: 10; }
        
        .preset-electric.active { box-shadow: 0 0 15px #0ff, inset 0 0 10px rgba(0, 255, 255, 0.5); border-color: #0ff !important; background: rgba(0, 255, 255, 0.1) !important; }
        .preset-electric svg { animation: none; }
        .preset-electric:hover svg, .preset-electric.active svg { animation: wiggle 0.5s ease-in-out infinite; filter: drop-shadow(0 0 5px #0ff); }
        
        .preset-fire.active { box-shadow: 0 0 15px #f50, inset 0 0 10px rgba(255, 85, 0, 0.5); border-color: #f50 !important; background: rgba(255, 85, 0, 0.1) !important; }
        .preset-fire svg { animation: none; }
        .preset-fire:hover svg, .preset-fire.active svg { animation: bounce 0.5s infinite; filter: drop-shadow(0 0 5px #f50); }
        
        .preset-water.active { box-shadow: 0 0 15px #0af, inset 0 0 10px rgba(0, 170, 255, 0.5); border-color: #0af !important; background: rgba(0, 170, 255, 0.1) !important; }
        .preset-water svg { animation: none; }
        .preset-water:hover svg, .preset-water.active svg { animation: wiggle 1s infinite; filter: drop-shadow(0 0 5px #0af); }
        
        .preset-mercury.active { box-shadow: 0 0 15px #aaa, inset 0 0 10px rgba(170, 170, 170, 0.5); border-color: #fff !important; background: rgba(255, 255, 255, 0.1) !important; }
        .preset-mercury:hover div, .preset-mercury.active div { animation: pulse 1s infinite; background: white; }
        
        @keyframes rainbow-border { 0% { border-color: red; box-shadow: 0 0 10px red; } 20% { border-color: yellow; box-shadow: 0 0 10px yellow; } 40% { border-color: lime; box-shadow: 0 0 10px lime; } 60% { border-color: cyan; box-shadow: 0 0 10px cyan; } 80% { border-color: blue; box-shadow: 0 0 10px blue; } 100% { border-color: magenta; box-shadow: 0 0 10px magenta; } }
        .preset-disco.active { animation: rainbow-border 2s linear infinite; transform: scale(1.15) rotate(10deg); }
        
        .theme-menu-item { position: relative; opacity: 0; transform: translateY(-10px); transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); pointer-events: none; }
        .shape-menu-open .theme-menu-item, .theme-menu-open .theme-menu-item { opacity: 1; transform: translateY(0); pointer-events: auto; }
        .deck-card { position: absolute; width: 100%; height: 100%; background-size: cover; background-position: center; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.2); transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1); transform-origin: center bottom; }
        @keyframes throwToBack { 0% { transform: translateY(0) scale(1); opacity: 1; z-index: 60; } 50% { transform: translateY(-100px) rotate(10deg) scale(1.1); opacity: 0.8; z-index: 60; } 51% { z-index: 0; } 100% { transform: translateY(0) rotate(0) scale(0.9); opacity: 1; z-index: 0; } }
        .anim-throw-back { animation: throwToBack 0.4s forwards; }
        @keyframes slideForward { 0% { transform: translateY(-4px) scale(0.95); opacity: 0.9; } 100% { transform: translateY(0) scale(1); opacity: 1; } }
        .anim-slide-forward { animation: slideForward 0.4s forwards; }
        @keyframes fetchFromBack { 0% { transform: translateY(20px) scale(0.8); opacity: 0; z-index: 0; } 50% { transform: translateY(-50px) rotate(-5deg) scale(1.05); opacity: 1; z-index: 60; } 100% { transform: translateY(0) scale(1); opacity: 1; z-index: 60; } }
        .anim-fetch-front { animation: fetchFromBack 0.4s forwards; }
        @keyframes slideBackward { 0% { transform: translateY(0) scale(1); opacity: 1; } 100% { transform: translateY(-4px) scale(0.95); opacity: 0.9; } }
        .anim-slide-backward { animation: slideBackward 0.4s forwards; }
        .vinyl-grooves { background: repeating-radial-gradient( #111 0, #111 2px, #222 3px, #222 4px ); }
        .perspective-1000 { perspective: 1000px; }
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
        .custom-chic-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-chic-scrollbar::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); border-radius: 4px; }
        .custom-chic-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 4px; border: 1px solid rgba(255,255,255,0.05); }
        .custom-chic-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.3); }
        .custom-thin-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-thin-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-thin-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0); border-radius: 4px; transition: background 0.3s; }
        .custom-thin-scrollbar:hover::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.3); }
        @keyframes marquee-loop { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .animate-marquee-loop { animation: marquee-loop 15s linear infinite; display: flex; width: max-content; }
        .mask-linear-fade { mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent); WebkitMaskImage: linear-gradient(to right, transparent, black 10%, black 90%, transparent); }
        .custom-vol-slider-h { -webkit-appearance: none; height: 8px; background: rgba(255,255,255,0.2); border-radius: 4px; outline: none; cursor: pointer; }
        .custom-vol-slider-h::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 16px; height: 16px; border-radius: 50%; background: white; cursor: pointer; box-shadow: 0 0 10px rgba(0,0,0,0.5); }
      `}</style>
      
      {isAnyMenuOpen && ( <div className="fixed inset-0 z-40 bg-transparent" onPointerDown={closeAllMenus} /> )}
      {isInfoExpanded && ( <div className="fixed inset-0 z-[150] bg-black/40 backdrop-blur-sm transition-opacity duration-700" onClick={handleInfoBackdropClick} /> )}

      <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
      <input type="file" accept="audio/*" ref={actualAudioInputRef} onChange={handleAudioSelect} className="hidden" />
      <input type="file" accept="image/*" multiple ref={bgImageInputRef} onChange={handleBgImagesSelect} className="hidden" />

      {/* --- MÜZİK ÇALAR WIDGET --- */}
      {audioMode !== 'none' && (
          <div className={`absolute top-6 left-1/2 -translate-x-1/2 z-[60] group/player transition-all duration-700 ease-in-out ${musicHideClass}`}>
              <div className="pointer-events-auto relative">
                  {/* ... Müzik Player İçeriği ... */}
                  <div className={`absolute -bottom-8 right-0 flex gap-1 transition-all duration-300 transform ${isMusicPlayerMinimized ? 'opacity-0 pointer-events-none scale-0' : 'opacity-0 translate-y-[-0.5rem] group-hover/player:opacity-100 group-hover/player:translate-y-0 scale-100'} `}>
                       <button onClick={(e) => { e.stopPropagation(); setShowMusicSettings(!showMusicSettings); }} className="p-1.5 bg-black/60 hover:bg-black/80 backdrop-blur-md rounded-full text-white/80 hover:text-white border border-white/10 transition-colors shadow-sm" title="Ayarlar"> <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={showMusicSettings ? 'rotate-90' : ''}><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg> </button>
                       <button onClick={(e) => { e.stopPropagation(); setIsMusicPlayerMinimized(true); setShowMusicSettings(false); }} className="p-1.5 bg-black/60 hover:bg-black/80 backdrop-blur-md rounded-full text-white/80 hover:text-white border border-white/10 transition-colors shadow-sm" title="Simge Durumuna Küçült"> <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"></line></svg> </button>
                  </div>
                  <div className={`relative transition-all duration-700 ease-[cubic-bezier(0.25,0.8,0.25,1)] translate-y-0 ${isMusicPlayerMinimized ? 'w-12 h-12 rounded-full' : 'w-[200px] h-12 rounded-full'} backdrop-blur-xl border shadow-[0_4px_20px_rgba(0,0,0,0.3)] ${isLightMode ? 'bg-white/20 border-white/40 text-black' : 'bg-black/20 border-white/10 text-white'} overflow-hidden `} onMouseEnter={() => { onInteractionStart(); setShowVolumeControl(true); }} onMouseLeave={() => { onInteractionEnd(); setShowVolumeControl(false); setShowMusicSettings(false); }}>
                      <div className={`absolute inset-0 flex items-center justify-between px-2 z-20 transition-opacity duration-300 pointer-events-none ${isMusicPlayerMinimized ? 'opacity-0' : 'opacity-0 group-hover/player:opacity-100 group-hover/player:pointer-events-auto'} `}>
                           <div className="flex items-center relative group/vol">
                              <button onClick={handleVolumeClick} className="p-1.5 hover:bg-white/10 rounded-full text-current transition-colors z-10" title={volume === 0 ? "Sesi Aç" : "Sessize Al"}> 
                                  {volume === 0 ? (
                                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>
                                  ) : (
                                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg> 
                                  )}
                              </button>
                              <div className="w-0 overflow-hidden group-hover/vol:w-20 transition-all duration-300 ease-out flex items-center"> <div className="w-16 h-1 bg-current/20 rounded-full ml-1 relative flex items-center"> <input type="range" min="0" max="1" step="0.01" value={volume} onChange={(e) => onVolumeChange && onVolumeChange(parseFloat(e.target.value))} className="custom-vol-slider-h w-full opacity-80 hover:opacity-100" /> </div> </div>
                           </div>
                           <div className="pr-0.5"> <button onClick={(e) => { e.stopPropagation(); onTogglePlay && onTogglePlay(); }} className="p-1.5 hover:bg-white/10 rounded-full text-current transition-colors"> {isPlaying ? ( <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg> ) : ( <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> )} </button> </div>
                      </div>
                      <div className={`absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none transition-all duration-500 ease-in-out ${!isMusicPlayerMinimized ? 'group-hover/player:blur-sm group-hover/player:opacity-40 group-hover/player:scale-95' : ''} `}>
                           <div className={`flex w-full h-full items-center transition-all duration-700 ease-[cubic-bezier(0.25,0.8,0.25,1)] pointer-events-auto ${isMusicPlayerMinimized ? 'justify-center' : 'justify-between pl-1 pr-3'} `}>
                               <div className={` relative flex-shrink-0 border-2 flex items-center justify-center overflow-hidden transition-all duration-700 ease-[cubic-bezier(0.25,0.8,0.25,1)] ${isLightMode ? 'border-black/10 bg-white/50' : 'border-white/10 bg-white/5'} ${isMusicPlayerMinimized ? 'w-10 h-10 rounded-full border-2 hover:scale-110 cursor-pointer shadow-lg shadow-white/10' : 'w-8 h-8 rounded-full'} `} onClick={(e) => { if(isMusicPlayerMinimized) { e.stopPropagation(); setIsMusicPlayerMinimized(false); } }}>
                                  {songInfo?.coverArt ? ( <img src={songInfo.coverArt} alt="art" className={`w-full h-full object-cover ${isPlaying ? 'animate-spin-slow' : ''}`} /> ) : ( <div className={`w-full h-full flex items-center justify-center ${isPlaying ? 'animate-spin-slow' : ''}`}> <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg> </div> )}
                                  {isMusicPlayerMinimized && ( <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-300"> <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" className="drop-shadow-md"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg> </div> )}
                               </div>
                               <div className={`flex flex-col overflow-hidden transition-all duration-700 ease-[cubic-bezier(0.25,0.8,0.25,1)] ml-2 flex-1 text-right ${isMusicPlayerMinimized ? 'w-0 opacity-0' : 'opacity-100'} `}>
                                  <div className="w-full overflow-hidden whitespace-nowrap mask-linear-fade flex items-center justify-end"> <div className={`${(audioTitle && audioTitle.length > 18) ? 'animate-marquee-loop' : ''} flex flex-row items-center`}> <span className="text-[10px] tracking-wide block pr-2" style={{ fontFamily: musicFont, fontWeight: musicBold ? 'bold' : 'normal', fontStyle: musicItalic ? 'italic' : 'normal', whiteSpace: 'nowrap' }}>{audioTitle || "Bilinmeyen Şarkı"}</span> {(audioTitle && audioTitle.length > 18) && ( <span className="text-[10px] tracking-wide ml-6 block pr-2" style={{ fontFamily: musicFont, fontWeight: musicBold ? 'bold' : 'normal', fontStyle: musicItalic ? 'italic' : 'normal', whiteSpace: 'nowrap' }}>{audioTitle || "Bilinmeyen Şarkı"}</span> )} </div> </div>
                                  <span className="text-[9px] opacity-60 font-mono truncate">{songInfo?.artistName || "Sanatçı"}</span>
                               </div>
                           </div>
                      </div>
                  </div>
                  
                  {/* Music Settings Panel (İçerik aynı) */}
                  {showMusicSettings && ( <div className="absolute top-full left-0 mt-4 w-64 bg-[#111]/95 backdrop-blur-xl border border-white/20 rounded-xl p-4 shadow-[0_10px_40px_rgba(0,0,0,0.8)] animate-config-pop z-[100] origin-top-left" onPointerDown={stopProp}> <h5 className="text-[10px] font-mono text-gray-400 text-center uppercase tracking-widest mb-3 border-b border-white/10 pb-1">Müzik Ayarları</h5> <div className="mb-3"> <div className="relative"> <select value={musicFont} onChange={(e) => setMusicFont(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg text-[10px] text-white p-2 outline-none cursor-pointer hover:bg-white/10 transition-colors"> {FONTS.map(f => (<option key={f.name} value={f.value} className="bg-gray-900 text-white">{f.name}</option>))} </select> </div> </div> <div className="flex gap-2 mb-3"> <button onClick={() => setMusicBold(!musicBold)} className={`flex-1 py-1.5 rounded border text-[10px] font-bold transition-all ${musicBold ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}>Kalın</button> <button onClick={() => setMusicItalic(!musicItalic)} className={`flex-1 py-1.5 rounded border text-[10px] italic transition-all ${musicItalic ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}>Eğik</button> </div> <div className="space-y-2"> <div className="flex items-center justify-between bg-white/5 p-2 rounded-lg border border-white/5"> <div className="flex flex-col"> <span className={`text-[10px] ${isMoodSyncActive ? 'text-blue-200' : 'text-gray-300'}`}>Mood-Sync</span> <span className="text-[8px] text-gray-500 italic">Duyguya Göre Değiş</span> </div> <button onClick={onToggleMoodSync} className={`w-8 h-4 rounded-full relative transition-colors ${isMoodSyncActive ? 'bg-blue-600' : 'bg-white/10'}`}><div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${isMoodSyncActive ? 'translate-x-4' : 'translate-x-0'}`} /></button> </div> <div className="flex items-center justify-between bg-white/5 p-2 rounded-lg border border-white/5"> <span className="text-[10px] text-gray-300">Temiz Modda Göster</span> <button onClick={() => setMusicShowInCleanMode(!musicShowInCleanMode)} className={`w-8 h-4 rounded-full relative transition-colors ${musicShowInCleanMode ? 'bg-blue-600' : 'bg-white/10'}`}><div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${musicShowInCleanMode ? 'translate-x-4' : 'translate-x-0'}`} /></button> </div> <div className="bg-white/5 p-2 rounded-lg border border-white/5"> <div className="flex items-center justify-between mb-2"> <span className="text-[10px] text-gray-300 flex items-center gap-2"> Şarkı Sözleri {showLyrics && <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>} </span> <button onClick={() => onToggleShowLyrics && onToggleShowLyrics()} className={`w-8 h-4 rounded-full relative transition-colors ${showLyrics ? 'bg-green-600' : 'bg-white/10'}`}><div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${showLyrics ? 'translate-x-4' : 'translate-x-0'}`} /></button> </div> {showLyrics && ( <div className="flex items-center justify-between pl-2 border-l border-white/10 ml-1 animate-in slide-in-from-left-2 duration-300"> <span className="text-[10px] text-gray-400">3D Partikül Modu</span> <button onClick={onToggleLyricParticles} className={`w-8 h-4 rounded-full relative transition-colors ${useLyricParticles ? 'bg-purple-600' : 'bg-white/10'}`}> <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${useLyricParticles ? 'translate-x-4' : 'translate-x-0'}`} /> </button> </div> )} </div> <div className="flex items-center justify-between bg-white/5 p-2 rounded-lg border border-white/5"> <span className="text-[10px] text-gray-300" title="Yazının müziğe tepki vermesini engeller">Eko Efekti</span> <button onClick={onToggleLyricEcho} className={`w-8 h-4 rounded-full relative transition-colors ${useLyricEcho ? 'bg-cyan-600' : 'bg-white/10'}`}><div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${useLyricEcho ? 'translate-x-4' : 'translate-x-0'}`} /></button> </div> <div className="flex items-center justify-between bg-white/5 p-2 rounded-lg border border-white/5"> <span className="text-[10px] text-gray-300">Disk Görünümü</span> <button onClick={() => onToggleInfoPanel && onToggleInfoPanel()} className={`w-8 h-4 rounded-full relative transition-colors ${showInfoPanel ? 'bg-green-600' : 'bg-white/10'}`}><div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${showInfoPanel ? 'translate-x-4' : 'translate-x-0'}`} /></button> </div> </div> </div> )}
              </div>
          </div>
      )}

      {/* --- Song Info Panel (Değişiklik yok) --- */}
      {(showInfoPanel && audioMode !== 'none') && !isDrawing && (
          <div onClick={toggleInfoExpand} className={` cursor-pointer preserve-3d transition-all duration-700 ease-[cubic-bezier(0.4,0,0.2,1)] transform-gpu ${isWidgetMinimized ? '-translate-y-[100px]' : ''} ${hideLeftClass} ${isInfoExpanded ? 'rotate-y-180 z-[200]' : 'rotate-y-0 z-[50]'} `} style={{ position: 'fixed', top: isInfoExpanded ? '50%' : 'auto', bottom: isInfoExpanded ? 'auto' : '96px', left: isInfoExpanded ? '50%' : '24px', width: isInfoExpanded ? '500px' : '230px', height: isInfoExpanded ? '500px' : '252px', transform: isInfoExpanded ? 'translate(-50%, -50%) rotateY(180deg)' : `translate(0, 0) rotateY(0deg) ${isWidgetMinimized ? 'translateY(-100px)' : ''}`, overflow: 'visible' }} >
              {/* ... Song Info Content ... */}
              <div className={` absolute inset-0 backface-hidden rounded-3xl border backdrop-blur-xl shadow-2xl flex flex-col ${isLightMode ? 'bg-white/40 border-black/10 text-black' : 'bg-black/40 border-white/20 text-white'} ${!isInfoExpanded ? 'bg-black/20 border-white/20 shadow-[0_0_15px_rgba(0,0,0,0.3)]' : ''} `} style={{ overflow: 'visible' }} >
                  <div className="absolute left-1/2 -translate-x-1/2 -top-16"> <div className={`w-32 h-32 rounded-full shadow-xl border-4 ${isLightMode ? 'border-gray-200' : 'border-gray-800'} relative flex items-center justify-center overflow-hidden ${isPlaying || isLoadingInfo ? 'animate-spin-slow' : 'animate-spin-slow paused-spin'}`}> {vinylArt ? ( <img src={vinylArt} alt="Cover" className="w-full h-full object-cover" /> ) : ( <div className="w-full h-full vinyl-grooves opacity-80 flex items-center justify-center"> {isLoadingInfo && <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>} </div> )} <div className={`absolute w-8 h-8 rounded-full ${isLightMode ? 'bg-gray-200' : 'bg-black'} border-2 border-white/20 z-10`}></div> <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-white/20 to-transparent pointer-events-none"></div> </div> </div>
                  <div className="pt-[65px] px-4 pb-4 flex flex-col items-center justify-start flex-grow">
                      <div className="text-center w-full mt-0 mb-2"> <h3 className={`font-bold leading-tight tracking-tight drop-shadow-sm text-xl w-full truncate max-w-[190px] mx-auto px-2 ${isLoadingInfo ? 'animate-pulse opacity-50' : ''}`}>{songInfo ? songInfo.artistName : "Analiz Bekleniyor..."}</h3> {songInfo && !isUnknownArtist && !isLoadingInfo && ( <p className="opacity-70 font-mono text-[10px] mt-1 truncate w-full max-w-[190px] mx-auto">{songInfo.artistBio}</p> )} </div>
                      {songInfo && !isLoadingInfo && ( <div className="w-full px-1 flex flex-col gap-2 mt-1 overflow-hidden h-[110px]"> <div className={`text-xs leading-snug text-white font-medium italic text-center drop-shadow-md overflow-hidden text-ellipsis line-clamp-3`}> <span className="font-bold not-italic opacity-80 text-[10px] mr-1 block mb-0.5 text-blue-300">Şarkı Analizi (TR):</span> "{songInfo.meaningTR}" </div> <div className={`text-xs leading-snug text-white/90 font-medium italic text-center drop-shadow-md overflow-hidden text-ellipsis line-clamp-3`}> <span className="font-bold not-italic opacity-80 text-[10px] mr-1 block mb-0.5 text-blue-300">Song Analysis (En):</span> "{songInfo.meaningEN}" </div> </div> )} {isLoadingInfo && ( <div className="mt-4 text-[10px] opacity-60 font-mono animate-pulse">Analiz Ediliyor...</div> )}
                  </div>
              </div>
              <div className={`absolute inset-0 backface-hidden rounded-3xl border backdrop-blur-3xl shadow-2xl flex flex-col ${isLightMode ? 'bg-white/85 border-black/10 text-black' : 'bg-[#111]/85 border-white/10 text-white'}`} style={{ transform: 'rotateY(180deg)', overflow: 'visible' }} dir="ltr" >
                  <div className="absolute left-1/2 -translate-x-1/2 -top-16 z-30 pointer-events-none"> <div className={`w-32 h-32 rounded-full shadow-xl border-4 ${isLightMode ? 'border-gray-200' : 'border-gray-800'} relative flex items-center justify-center overflow-hidden ${isPlaying || isLoadingInfo ? 'animate-spin-slow' : 'animate-spin-slow paused-spin'}`}> {vinylArt ? ( <img src={vinylArt} alt="Cover" className="w-full h-full object-cover" /> ) : ( <div className="w-full h-full vinyl-grooves opacity-80 flex items-center justify-center"> {isLoadingInfo && <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>} </div> )} <div className={`absolute w-8 h-8 rounded-full ${isLightMode ? 'bg-gray-200' : 'bg-black'} border-2 border-white/20 z-10`}></div> <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-white/20 to-transparent pointer-events-none"></div> </div> </div> {vinylArt && <img src={vinylArt} alt="bg" className="absolute inset-0 w-full h-full object-cover opacity-10 blur-sm scale-110 pointer-events-none rounded-3xl overflow-hidden" />}
                  <div className={`p-8 pt-[70px] pb-4 z-20 flex-shrink-0 border-b ${isLightMode ? 'border-black/5 bg-white/50' : 'border-white/5 bg-black/50'} backdrop-blur-md rounded-t-3xl`}> <h2 className="text-3xl font-bold leading-tight text-center mt-2">{songInfo?.artistName || "Detay Yok"}</h2> {songInfo && !isUnknownArtist && <p className="font-mono text-sm opacity-60 mt-1 text-center">{songInfo.artistBio}</p>} </div>
                  <div className="flex-1 p-8 pt-6 overflow-y-auto custom-thin-scrollbar relative z-10"> {songInfo ? ( <div className="space-y-8"> <div> <h4 className="font-bold text-lg mb-2 opacity-80 border-b border-current pb-1 inline-block uppercase tracking-wider">Şarkı Analizi (TR)</h4> <p className="text-2xl leading-relaxed italic opacity-90">{songInfo.meaningTR}</p> </div> <div> <h4 className="font-bold text-lg mb-2 opacity-80 border-b border-current pb-1 inline-block uppercase tracking-wider">Song Analysis (En)</h4> <p className="text-2xl leading-relaxed italic opacity-80">{songInfo.meaningEN}</p> </div> {songInfo.mood && ( <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-2"> <span className="text-[10px] font-mono uppercase opacity-60">Mood:</span> <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded-full uppercase font-bold tracking-wide border border-blue-500/30">{songInfo.mood}</span> </div> )} </div> ) : <p className="opacity-50">Henüz analiz verisi yok.</p>} <div className="mt-8 pt-8 border-t border-dashed border-opacity-20 border-gray-500 text-center opacity-50 text-xs">Yapay Zeka tarafından analiz edilmiştir.</div> </div>
              </div>
          </div>
      )}
      
      {/* ... Deck Components ... */}
      <ImageDeck 
        images={generatedImages} 
        activeIndex={aiDeckIndex} 
        onIndexChange={setAiDeckIndex} 
        onSelect={handleGenImageClick} 
        onRemove={(img) => {}} 
        onHover={handleGenImageHover} 
        positionClass="bottom-[6.5rem] right-6" 
        side="right" 
        isUIHidden={isUIHidden} 
        hideInCleanMode={aiDeckHideInCleanMode} 
        downloadable={true} 
        extraButtons={ 
            <>
                <div className="absolute top-1 right-1 flex gap-1 items-center">
                    <button 
                        onClick={(e) => { e.stopPropagation(); setAiDeckShowSettings(!aiDeckShowSettings); setShowResetMenu(false); }} 
                        className="w-4 h-4 bg-black/60 rounded-full flex items-center justify-center text-white/80 hover:text-white hover:bg-black/80 opacity-0 group-hover:opacity-100 transition-all duration-200 backdrop-blur-sm"
                        title="AI Ayarları"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1 0-2.83 2 2 0 0 1 0-2.83l.06.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                    </button>
                    {(!generatedImages || generatedImages.length > 0) && (
                        <div className="w-4 h-4 bg-purple-600 rounded-full flex items-center justify-center text-white/90 text-[8px] font-bold shadow-sm cursor-default">AI</div>
                    )}
                </div>
            </>
        } 
      />

      {/* AI DECK SETTINGS MENU (En Sağ) */}
      {aiDeckShowSettings && !isDrawing && (
        <div className="absolute bottom-48 right-6 z-[70] bg-[#111]/95 backdrop-blur-xl border border-white/20 p-4 rounded-xl shadow-2xl w-48 animate-config-pop origin-bottom" onWheel={(e) => e.stopPropagation()}>
            <h5 className="text-[10px] font-mono text-gray-400 text-center uppercase tracking-widest mb-3 border-b border-white/10 pb-1">AI Galeri</h5>
            <div className="flex items-center justify-between">
                <span className="text-[10px] text-gray-300">Temiz Modda Gizle</span>
                <button 
                    onClick={() => setAiDeckHideInCleanMode(!aiDeckHideInCleanMode)} 
                    className={`w-8 h-4 rounded-full relative transition-colors ${aiDeckHideInCleanMode ? 'bg-purple-600' : 'bg-white/10'}`}
                >
                    <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${aiDeckHideInCleanMode ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
            </div>
            <div className="mt-4 pt-2 border-t border-white/10 flex justify-center">
                <button onClick={() => setAiDeckShowSettings(false)} className="w-full py-1.5 rounded text-[10px] font-medium bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-all">Kapat</button>
            </div>
        </div>
      )}
      
      {/* USER DECK (AI Deck'in Solunda) */}
      <ImageDeck 
        images={bgImages} 
        activeIndex={userDeckIndex} 
        onIndexChange={setUserDeckIndex} 
        onSelect={handleBgImageSelectFromDeck} 
        onRemove={onRemoveBgImage || (() => {})} 
        onHover={handleBgImageSelectFromDeck} 
        positionClass="bottom-[6.5rem] right-32" 
        side="left" 
        isUIHidden={isUIHidden} 
        hideInCleanMode={deckHideInCleanMode} 
        extraButtons={ <> <button onClick={(e) => { e.stopPropagation(); setDeckShowSettings(!deckShowSettings); setShowResetMenu(false); }} className="absolute top-1 right-1 w-4 h-4 bg-black/60 rounded-full flex items-center justify-center text-white/80 hover:text-white hover:bg-black/80 opacity-0 group-hover:opacity-100 transition-all duration-200 backdrop-blur-sm"><svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1 0-2.83 2 2 0 0 1 0-2.83l.06.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg></button> <button onClick={openResetMenu} className="absolute top-1 left-1 w-4 h-4 bg-red-600/80 rounded-full flex items-center justify-center text-white hover:bg-red-500 opacity-0 group-hover:opacity-100 transition-all duration-200 backdrop-blur-sm"><svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button> </> } 
      />
      
      {/* RESTORED: Image Context Menu (Bottom Right) (Değişiklik yok) */}
      {bgMode === 'image' && !isDrawing && deckShowSettings && (
        <div className={`absolute bottom-48 right-32 z-[70] bg-[#111]/90 backdrop-blur-xl border border-white/20 p-3 rounded-xl shadow-2xl flex flex-col gap-2 w-40 transition-all duration-300 origin-bottom animate-config-pop ${shouldHideUserDeck && !deckShowSettings ? 'opacity-0 translate-y-10 pointer-events-none' : 'opacity-100 translate-y-0'}`}>
            <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-1">
                <span className="text-[10px] font-mono text-gray-400 uppercase tracking-widest">RESİM BOYUTU</span>
            </div>
            
            <div className="flex gap-1">
                <button 
                    onClick={() => onBgImageStyleChange && onBgImageStyleChange('cover')} 
                    className={`flex-1 py-1.5 rounded text-[10px] font-bold transition-all border ${bgImageStyle === 'cover' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}
                >
                    Doldur
                </button>
                 <button 
                    onClick={(e) => { e.stopPropagation(); setShowSlideshowPanel(!showSlideshowPanel); }} 
                    className={`w-8 rounded text-[10px] font-bold transition-all border flex items-center justify-center ${showSlideshowPanel ? 'bg-white/20 border-white/30 text-white' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1 0-2.83 2 2 0 0 1 0-2.83l.06.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                </button>
            </div>
            
            <button onClick={() => onBgImageStyleChange && onBgImageStyleChange('contain')} className={`w-full py-1.5 rounded text-[10px] font-medium transition-all border ${bgImageStyle === 'contain' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}>Ortala</button>
            <button onClick={() => onBgImageStyleChange && onBgImageStyleChange('fill')} className={`w-full py-1.5 rounded text-[10px] font-medium transition-all border ${bgImageStyle === 'fill' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}>Uzat</button>
            <button onClick={toggleSlideshow} className={`w-full py-2 rounded text-[10px] font-bold uppercase tracking-wide transition-all border flex items-center justify-center gap-2 ${slideshowSettings?.active ? 'bg-green-600 border-green-500 text-white animate-pulse' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}>
                 <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>
                 SLAYT {slideshowSettings?.active ? '(AÇIK)' : ''}
            </button>
            <div className="flex items-center justify-between pt-2 border-t border-white/10 mt-1">
                <span className="text-[9px] text-gray-500">Temiz Modda Gizle</span>
                <button onClick={() => setDeckHideInCleanMode(!deckHideInCleanMode)} className={`w-8 h-4 rounded-full relative transition-colors ${deckHideInCleanMode ? 'bg-blue-600' : 'bg-white/10'}`}>
                    <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${deckHideInCleanMode ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
            </div>
        </div>
      )}
      
      {/* TRASH MENU (Değişiklik yok) */}
      {showResetMenu && !isDrawing && (
        <div className="absolute bottom-48 right-32 z-[70] bg-[#111]/95 backdrop-blur-xl border border-white/20 p-4 rounded-xl shadow-2xl w-48 animate-config-pop origin-bottom" onWheel={(e) => e.stopPropagation()}>
            <h5 className="text-[10px] font-mono text-gray-400 text-center uppercase tracking-widest mb-3 border-b border-white/10 pb-1">Yönetim</h5>
            <div className="space-y-2 mb-4">
                <div onClick={() => setChkDeleteAll(!chkDeleteAll)} className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all border ${chkDeleteAll ? 'bg-red-900/30 border-red-500/50' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}><div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${chkDeleteAll ? 'bg-red-500 border-red-500' : 'border-white/30'}`}>{chkDeleteAll && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>}</div><span className={`text-[10px] font-bold ${chkDeleteAll ? 'text-red-200' : 'text-gray-400'}`}>Tümünü Sil</span></div>
                <div onClick={() => setChkResetSize(!chkResetSize)} className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all border ${chkResetSize ? 'bg-blue-900/30 border-blue-500/50' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}><div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${chkResetSize ? 'bg-blue-500 border-blue-500' : 'border-white/30'}`}>{chkResetSize && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>}</div><span className={`text-[10px] font-bold ${chkResetSize ? 'text-blue-200' : 'text-gray-400'}`}>Boyutu Sıfırla</span></div>
            </div>
            <div className="flex gap-2">
                <button onClick={() => setShowResetMenu(false)} className="flex-1 py-2 rounded text-[10px] font-medium transition-all border bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10">İptal</button>
                <button onClick={handleTrashConfirm} disabled={!chkDeleteAll && !chkResetSize} className={`flex-1 py-2 rounded text-[10px] font-bold transition-all border flex items-center justify-center ${(!chkDeleteAll && !chkResetSize) ? 'opacity-50 cursor-not-allowed bg-white/5 border-white/5 text-gray-500' : 'bg-green-600 border-green-500 text-white hover:bg-green-500'}`}>Onayla</button>
            </div>
        </div>
      )}
      
      {/* Slideshow Config Panel (Değişiklik yok) */}
      {showSlideshowPanel && bgMode === 'image' && (
        <div className="absolute bottom-48 right-[18.5rem] z-[70] bg-[#111]/95 backdrop-blur-xl border border-white/20 p-3 rounded-xl shadow-2xl w-40 animate-in fade-in slide-in-from-right-4 origin-bottom">
             <h5 className="text-[10px] font-mono text-gray-400 text-center uppercase tracking-widest mb-2 border-b border-white/10 pb-1">Slayt Ayarları</h5>
             <div className="mb-3">
                 <div className="flex justify-between text-[10px] text-gray-400 mb-1"><span>Süre</span><span className="text-blue-400">{slideshowSettings?.duration || 5}s</span></div>
                 <StylishSlider min={3} max={60} step={1} value={slideshowSettings?.duration || 5} onChange={(val) => updateSlideshow({ duration: val })} colorClass="bg-blue-500" />
             </div>
             <div className="mb-3">
                 <div className="flex gap-1"><button onClick={() => updateSlideshow({ order: 'sequential' })} className={`flex-1 py-1.5 rounded text-[9px] font-bold border transition-all ${slideshowSettings?.order === 'sequential' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white/5 border-white/10 text-gray-400'}`}>Sıralı</button><button onClick={() => updateSlideshow({ order: 'random' })} className={`flex-1 py-1.5 rounded text-[9px] font-bold border transition-all ${slideshowSettings?.order === 'random' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white/5 border-white/10 text-gray-400'}`}>Rastgele</button></div>
             </div>
             <div className="mb-1">
                 <div className="flex justify-between items-center mb-1"><label className="text-[9px] text-gray-400 block">Efekt</label><button onClick={() => setShowTransitionGrid(!showTransitionGrid)} className="text-[9px] text-blue-400 hover:text-blue-300">{showTransitionGrid ? 'Kapat' : 'Değiştir'}</button></div>
                 {!showTransitionGrid ? ( <div className="w-full bg-white/5 border border-white/10 rounded-lg p-1.5 flex items-center justify-between"><span className="text-[10px] text-white truncate">{TRANSITION_NAMES[slideshowSettings?.transition || 'fade']}</span><span className="text-white/50 scale-90">{TRANSITION_ICONS[slideshowSettings?.transition || 'fade']}</span></div> ) : ( <div className="grid grid-cols-3 gap-1 animate-in fade-in zoom-in duration-200"> {(Object.keys(TRANSITION_ICONS) as SlideshowTransition[]).map((t) => ( <button key={t} onClick={() => { updateSlideshow({ transition: t }); setShowTransitionGrid(false); }} className={`p-1.5 rounded border flex flex-col items-center gap-1 transition-all ${slideshowSettings?.transition === t ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'}`} title={TRANSITION_NAMES[t]}>{TRANSITION_ICONS[t]}</button> ))} </div> )}
             </div>
        </div>
      )}

      {/* --- BOTTOM DOCK (DYNAMIC WIDTH) --- */}
      <div className={`absolute bottom-6 right-6 z-[100] flex justify-end pointer-events-none transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] ${isUIHidden ? 'w-[6.5rem]' : 'w-[calc(100%-3rem)]'}`}>
        <div 
            className={`pointer-events-auto flex items-center justify-between p-2 rounded-2xl transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] w-full backdrop-blur-xl border ${dockShadowClass} shadow-2xl ${isLightMode ? 'bg-white/40 border-black/5' : 'bg-black/20 border-white/5'} ${isUIHidden ? 'bg-black/10 border-white/5' : ''}`} 
            onPointerDown={stopProp}
        >
          {/* --- LEFT GROUP (COLLAPSIBLE) --- */}
          {/* FİX: overflow-hidden kaldırıldı (sadece gizliyken geçerli) */}
          <div className={`flex items-center gap-2 transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] ${isUIHidden ? 'max-w-0 opacity-0 mr-0 overflow-hidden' : 'max-w-[1200px] opacity-100 overflow-visible'}`}>
              
              {/* Renk Paleti Popover */}
              {isPaletteOpen && !isUIHidden && ( <div className="absolute bottom-full left-0 mb-2 bg-black/80 backdrop-blur-xl border border-white/20 p-2 rounded-xl shadow-2xl animate-in fade-in zoom-in duration-200 origin-bottom-left" onMouseEnter={() => onInteractionStart()} onMouseLeave={() => { if(!isDrawing) onColorChange(savedColor); onInteractionEnd(); }}> <div className="text-white/60 text-[10px] mb-1 font-mono text-center">Renk Seçici</div> <div className="w-48 h-32 rounded-lg cursor-crosshair relative overflow-hidden shadow-inner border border-white/10" onMouseMove={(e) => { if(e.buttons === 1) handleSpectrumMove(e); }} onClick={handleSpectrumClick} style={{ background: 'white' }}> <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)' }} /> <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 50%, rgba(0,0,0,0) 50%, rgba(0,0,0,1) 100%)' }} /> </div> </div> )}
              
              {/* EFEKTLER MENÜSÜ */}
              {showEffectsMenu && !isUIHidden && (
                  <div className="absolute bottom-full left-32 mb-2 flex flex-row gap-2 bg-[#111]/90 backdrop-blur-xl border border-white/20 p-2 rounded-xl shadow-2xl animate-in slide-in-from-bottom-2 fade-in duration-300 origin-bottom z-[150]" onPointerDown={stopProp}>
                      <button onClick={(e) => { e.stopPropagation(); onPresetChange('electric'); setShowEffectsMenu(false); }} className={`preset-btn preset-electric w-8 h-8 rounded-lg border flex items-center justify-center ${activePreset === 'electric' ? 'active' : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'}`} title="Elektrik"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg></button>
                      <button onClick={(e) => { e.stopPropagation(); onPresetChange('fire'); setShowEffectsMenu(false); }} className={`preset-btn preset-fire w-8 h-8 rounded-lg border flex items-center justify-center ${activePreset === 'fire' ? 'active' : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'}`} title="Ateş"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.1.2-2.2.5-3 .5.7 1 1.3 2 1.5z"></path></svg></button>
                      <button onClick={(e) => { e.stopPropagation(); onPresetChange('water'); setShowEffectsMenu(false); }} className={`preset-btn preset-water w-8 h-8 rounded-lg border flex items-center justify-center ${activePreset === 'water' ? 'active' : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'}`} title="Su"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path></svg></button>
                      <button onClick={(e) => { e.stopPropagation(); onPresetChange('mercury'); setShowEffectsMenu(false); }} className={`preset-btn preset-mercury w-8 h-8 rounded-lg border flex items-center justify-center ${activePreset === 'mercury' ? 'active' : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'}`} title="Civa"><div className="w-3 h-3 rounded-full bg-gradient-to-br from-gray-300 to-gray-600"></div></button>
                      <button onClick={(e) => { e.stopPropagation(); onPresetChange('disco'); setShowEffectsMenu(false); }} className={`preset-btn preset-disco w-8 h-8 rounded-lg border flex items-center justify-center ${activePreset === 'disco' ? 'active' : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'}`} title="Disko"><div className="w-3 h-3 rounded-full bg-[conic-gradient(red,yellow,lime,aqua,blue,magenta,red)] animate-spin"></div></button>
                  </div>
              )}

              {/* 1. RESET BUTTON */}
              {!isDrawing && (
                  <button 
                      onClick={onResetAll} 
                      className={`flex-shrink-0 rounded-xl flex items-center justify-center transition-all duration-500 border group overflow-hidden h-10 w-10 ${isLightMode ? 'border-transparent hover:border-red-200 text-black/60 hover:text-red-500 hover:bg-red-50' : 'border-transparent hover:border-red-500/30 text-white/60 hover:text-red-400 hover:bg-red-500/10'}`}
                      title="Sıfırla"
                  >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:rotate-180 transition-transform duration-500"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
                  </button>
              )}

              {/* 2. TEXT INPUT */}
              {!isDrawing && (
                  <div className={`relative group transition-all duration-500 focus-within:w-64 overflow-hidden w-32 md:w-48 lg:w-64`}>
                      <input 
                          type="text" 
                          value={inputValue}
                          onChange={(e) => setInputValue(e.target.value)}
                          onKeyDown={handleKeyDown}
                          placeholder="..."
                          className={`w-full h-10 px-4 pr-10 rounded-xl border outline-none text-sm font-medium transition-all ${isLightMode ? 'bg-black/5 border-black/5 focus:bg-white focus:border-black/20 text-black placeholder:text-black/40' : 'bg-white/5 border-white/5 focus:bg-black/50 focus:border-white/20 text-white placeholder:text-white/30'}`}
                      />
                      <button 
                          onClick={() => inputValue.trim() && onSubmit(inputValue)}
                          className={`absolute right-1 top-1 w-8 h-8 rounded-lg flex items-center justify-center transition-all ${inputValue.trim() ? (isLightMode ? 'text-blue-600 hover:bg-blue-50' : 'text-blue-400 hover:bg-white/10') : 'opacity-0 pointer-events-none'}`}
                      >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                      </button>
                  </div>
              )}

              {/* DIVIDER */}
              {!isDrawing && <div className={`h-6 transition-all duration-500 ${dividerClass} ${isLightMode ? 'bg-black/10' : 'bg-white/10'}`}></div>}

              {/* 3. COLOR BUTTON */}
              {!isDrawing && (
                  <button 
                      onClick={() => setIsPaletteOpen(!isPaletteOpen)} 
                      className={`flex-shrink-0 rounded-xl flex items-center justify-center transition-all duration-500 border relative overflow-hidden h-10 w-10 ${isPaletteOpen ? (isLightMode ? 'bg-black/10 border-black/20' : 'bg-white/10 border-white/20') : (isLightMode ? 'border-transparent hover:bg-black/5 text-black/60 hover:text-black' : 'border-transparent hover:bg-white/5 text-white/60 hover:text-white')}`}
                      title="Renk Seç"
                  >
                      <div className="w-4 h-4 rounded-full border border-white/30 shadow-sm" style={{ backgroundColor: currentColor }}></div>
                      <div className="absolute inset-0 rounded-xl bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-0 hover:opacity-100 pointer-events-none"></div>
                  </button>
              )}

              {/* 4. EFEKTLER BUTTON */}
              {!isDrawing && (
                  <button 
                      onClick={(e) => { e.stopPropagation(); setShowEffectsMenu(!showEffectsMenu); }} 
                      className={`flex-shrink-0 rounded-xl flex items-center justify-center transition-all duration-500 border h-10 w-10 ${showEffectsMenu ? (isLightMode ? 'bg-black/10 border-black/20' : 'bg-white/10 border-white/20') : (isLightMode ? 'border-transparent hover:bg-black/5 text-black/60 hover:text-black' : 'border-transparent hover:bg-white/5 text-white/60 hover:text-white')}`}
                      title="Efektler"
                  >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path></svg>
                  </button>
              )}
              
              {/* THEME MENU */}
              {!isDrawing && (
                  <div className={`relative h-10 w-10`}> 
                    <button onClick={(e) => { e.stopPropagation(); toggleThemeMenu(); }} className={`w-full h-full rounded-xl flex items-center justify-center transition-all duration-300 border group ${isLightMode ? `border-transparent text-black ${isThemeMenuOpen ? 'bg-black/10' : 'hover:bg-black/5'}` : `border-transparent text-white ${isThemeMenuOpen ? 'bg-white/10' : 'hover:bg-white/5'}`}`} title="Tema ve Arka Plan">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon-animate-spin"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path><path d="M16 16.5l-3 3"></path><path d="M11 11.5l-3 3"></path></svg>
                    </button> 
                    {isThemeMenuOpen && (
                        <div className="absolute bottom-full left-0 mb-2 flex flex-row gap-1 bg-[#111]/90 backdrop-blur-xl border border-white/20 p-2 rounded-xl shadow-2xl animate-in slide-in-from-bottom-2 fade-in duration-300 origin-bottom-left z-[150]" onPointerDown={stopProp}> 
                            <button onClick={() => { onBgModeChange('dark'); setIsThemeMenuOpen(false); }} className="w-8 h-8 rounded-lg border border-white/10 flex items-center justify-center bg-black/80 text-white hover:bg-black icon-animate-wiggle" title="Karanlık Mod"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg></button>
                            <button onClick={() => { onBgModeChange('light'); setIsThemeMenuOpen(false); }} className="w-8 h-8 rounded-lg border border-white/10 flex items-center justify-center bg-white text-black hover:bg-gray-200 icon-animate-wiggle" title="Aydınlık Mod"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line></svg></button>
                            <button onClick={() => { bgImageInputRef.current?.click(); }} className="w-8 h-8 rounded-lg border border-white/10 flex items-center justify-center bg-gray-800 text-white hover:bg-gray-700 icon-animate-bounce" title="Resim"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg></button>
                            <button onClick={(e) => { e.stopPropagation(); setIsBgPaletteOpen(!isBgPaletteOpen); setIsThemeMenuOpen(false); }} className="w-8 h-8 rounded-lg border border-white/10 flex items-center justify-center bg-gradient-to-tr from-pink-500 to-purple-500 text-white icon-animate-pulse" title="Renk"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="13.5" cy="6.5" r=".5"></circle><circle cx="17.5" cy="10.5" r=".5"></circle><circle cx="8.5" cy="7.5" r=".5"></circle><circle cx="6.5" cy="12.5" r=".5"></circle></svg></button>
                            <button onClick={() => { onBgModeChange('gradient'); setIsThemeMenuOpen(false); }} className="w-8 h-8 rounded-lg border border-white/10 flex items-center justify-center bg-[linear-gradient(45deg,#ff0000,#00ff00,#0000ff)] text-white hover:opacity-80 icon-animate-spin" title="Gradient"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path></svg></button>
                            <button onClick={() => { onBgModeChange('auto'); setIsThemeMenuOpen(false); }} className="w-8 h-8 rounded-lg border border-white/10 flex items-center justify-center bg-gray-900 text-white hover:bg-gray-800 icon-animate-spin" title="Auto"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg></button>
                        </div> 
                    )}
                    {/* Background Color Picker Popover */}
                    {isBgPaletteOpen && ( <div className="absolute bottom-full left-0 mb-2 bg-black/80 backdrop-blur-xl border border-white/20 p-2 rounded-xl shadow-2xl animate-in fade-in zoom-in duration-200 origin-bottom-left z-[160]" onMouseEnter={() => onInteractionStart()} onMouseLeave={() => { if(!isDrawing) onInteractionEnd(); }}> <div className="text-white/60 text-[10px] mb-1 font-mono text-center">Arka Plan Rengi</div> <div className="w-48 h-32 rounded-lg cursor-crosshair relative overflow-hidden shadow-inner border border-white/10" onMouseMove={(e) => { if(e.buttons === 1) handleBgSpectrumMove(e); }} onClick={handleBgSpectrumClick} style={{ background: 'white' }}> <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)' }} /> <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 50%, rgba(0,0,0,0) 50%, rgba(0,0,0,1) 100%)' }} /> </div> </div> )}
                  </div>
              )}

              {/* SHAPE BUTTON */}
              {!isDrawing && (
                <div className={`relative h-10 w-10`}>
                    <button onClick={(e) => { e.stopPropagation(); toggleShapeMenu(); }} className={`w-full h-full rounded-xl flex items-center justify-center transition-all duration-300 border group ${isLightMode ? 'border-transparent hover:bg-black/5 text-black/60 hover:text-black' : 'border-transparent hover:bg-white/5 text-white/60 hover:text-white'} ${isShapeMenuOpen ? 'bg-white/10' : ''}`} title="Şekil Değiştir">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon-animate-wiggle"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                    </button>
                    {isShapeMenuOpen && (
                        <div className="absolute bottom-full left-0 mb-2 flex flex-row gap-1 bg-[#111]/90 backdrop-blur-xl border border-white/20 p-2 rounded-xl shadow-2xl animate-in slide-in-from-bottom-2 fade-in duration-300 origin-bottom-left z-[150]" onPointerDown={stopProp}>
                           <button onClick={() => handleShapeSelect('sphere')} className="w-8 h-8 rounded-lg border border-white/10 hover:bg-white/10 flex items-center justify-center text-white" title="Küre"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle></svg></button>
                           <button onClick={() => handleShapeSelect('cube')} className="w-8 h-8 rounded-lg border border-white/10 hover:bg-white/10 flex items-center justify-center text-white" title="Küp"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg></button>
                           <button onClick={() => handleShapeSelect('prism')} className="w-8 h-8 rounded-lg border border-white/10 hover:bg-white/10 flex items-center justify-center text-white" title="Prizma"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path></svg></button>
                           <button onClick={() => handleShapeSelect('star')} className="w-8 h-8 rounded-lg border border-white/10 hover:bg-white/10 flex items-center justify-center text-white" title="Yıldız"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg></button>
                           <button onClick={() => handleShapeSelect('spiky')} className="w-8 h-8 rounded-lg border border-white/10 hover:bg-white/10 flex items-center justify-center text-white" title="Dikenli"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line></svg></button>
                        </div>
                    )}
                </div>
              )}
              
              {/* --- LIVE BUTTON --- */}
              {!isDrawing && (
                  <button
                      onClick={onToggleLive}
                      className={`flex-shrink-0 rounded-xl flex items-center justify-center transition-all duration-500 border group relative overflow-hidden h-10 w-10 ${
                          isLiveActive 
                            ? (liveStatus === 'speaking' 
                                ? 'bg-green-500/20 text-green-300 border-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.4)]' 
                                : (liveStatus === 'connecting' ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50 animate-pulse' : 'bg-blue-500/20 text-blue-300 border-blue-500/50'))
                            : (isLightMode 
                                ? 'border-transparent hover:bg-black/5 text-black/60 hover:text-blue-600' 
                                : 'border-transparent hover:bg-white/5 text-white/60 hover:text-blue-300')
                      }`}
                      title={isLiveActive ? (liveStatus === 'speaking' ? "Konuşuyor..." : "Dinliyor...") : "Asistanla Sohbet Et"}
                      onMouseEnter={onInteractionStart} 
                      onMouseLeave={onInteractionEnd}
                  >
                      {isLiveActive && liveStatus === 'speaking' && ( <> <div className="absolute inset-0 rounded-xl border border-green-400 opacity-0 animate-[ping_1.5s_cubic-bezier(0,0,0.2,1)_infinite]"></div> <div className="absolute inset-0 rounded-xl border border-green-400 opacity-0 animate-[ping_1.5s_cubic-bezier(0,0,0.2,1)_infinite_0.5s]"></div> </> )}
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill={isLiveActive ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`relative z-10 transition-transform duration-300 ${isLiveActive ? '' : 'group-hover:scale-110'} ${liveStatus === 'speaking' ? 'animate-bounce' : ''}`}> <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path> <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path> <line x1="12" y1="19" x2="12" y2="23"></line> <line x1="8" y1="23" x2="16" y2="23"></line> </svg>
                  </button>
              )}

              {/* MOTION BUTTON */}
              {!isDrawing && (
                  <button
                      onClick={onToggleMotionControl}
                      className={`flex-shrink-0 rounded-xl flex items-center justify-center transition-all duration-500 border group relative overflow-hidden h-10 w-10 ${
                          isMotionControlActive
                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-[0_0_15px_rgba(34,211,238,0.4)]'
                            : (isLightMode 
                                ? 'border-transparent hover:bg-black/5 text-black/60 hover:text-cyan-600' 
                                : 'border-transparent hover:bg-white/5 text-white/60 hover:text-cyan-300')
                      }`}
                      title={isMotionControlActive ? "El Kontrolünü Kapat" : "El Kontrolünü Aç (Kamera)"}
                      onMouseEnter={onInteractionStart} 
                      onMouseLeave={onInteractionEnd}
                  >
                      {isMotionControlActive && ( <div className="absolute inset-0 rounded-xl border border-cyan-400 opacity-20 animate-pulse"></div> )}
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`relative z-10 transition-transform duration-300 ${isMotionControlActive ? 'scale-110' : 'group-hover:scale-110'}`}> <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"></path> <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"></path> <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"></path> <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"></path> </svg>
                  </button>
              )}

              {/* MUSIC BUTTON (Direct Input Trigger) */}
              {!isDrawing && (
                  <button 
                    onClick={() => { if(actualAudioInputRef.current) actualAudioInputRef.current.click(); }} 
                    className={`flex-shrink-0 rounded-xl flex items-center justify-center transition-all duration-500 border h-10 w-10 ${audioMode !== 'none' ? 'bg-green-500/20 text-green-300 border-green-500/50' : isLightMode ? 'border-transparent hover:bg-black/5 text-black/60 hover:text-black' : 'border-transparent hover:bg-white/5 text-white/60 hover:text-white'}`} 
                    title="Müzik/Ses Ekle" 
                    onMouseEnter={onInteractionStart} onMouseLeave={onInteractionEnd}
                  >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon-animate-wiggle"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
                  </button>
              )}
              
              {/* IMAGE UPLOAD BUTTON (Fixed: Trigger fileInputRef for Particle Image) */}
              {!isDrawing && (
                  <button 
                    onClick={() => { if(fileInputRef.current) fileInputRef.current.click(); }} 
                    className={`flex-shrink-0 rounded-xl flex items-center justify-center transition-all duration-500 border h-10 w-10 ${isLightMode ? 'border-transparent hover:bg-black/5 text-black/60 hover:text-black' : 'border-transparent hover:bg-white/5 text-white/60 hover:text-white'}`} 
                    title="Resim Yükle (Partikül)" 
                    onMouseEnter={onInteractionStart} onMouseLeave={onInteractionEnd}
                  >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon-animate-bounce"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                  </button>
              )}
              
              {/* Drawing / Cancel Button */}
              <button onClick={isDrawing ? cancelDrawing : onDrawingStart} className={`flex-shrink-0 rounded-xl flex items-center justify-center transition-all duration-500 border ${isDrawing ? 'bg-red-500/20 text-red-200 border-red-500/50 hover:bg-red-500/40 w-10 h-10' : `h-10 w-10`} ${isLightMode ? 'border-transparent hover:bg-black/5 text-black/60 hover:text-black' : 'border-transparent hover:bg-white/5 text-white/60 hover:text-white'}`} title={isDrawing ? "İptal" : "Çizim Yap"} onMouseEnter={onInteractionStart} onMouseLeave={onInteractionEnd}>
                {isDrawing ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon-animate-bounce"><path d="M12 19l7-7 3 3-7 7-3-3z"></path><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path><path d="M2 2l7.586 7.586"></path><circle cx="11" cy="11" r="2"></circle></svg>
                )}
              </button>

              {/* DRAWING CONFIRM BUTTON (Visible ONLY when drawing) */}
              {isDrawing && (
                  <button 
                      onClick={onDrawingConfirm} 
                      className={`w-10 h-10 flex-shrink-0 rounded-xl flex items-center justify-center transition-all duration-300 border bg-green-500/20 text-green-300 border-green-500/50 hover:bg-green-500/40 animate-in fade-in slide-in-from-left-2`}
                      title="Onayla ve Oluştur"
                  >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  </button>
              )}

              {/* DIVIDER */}
              {!isDrawing && <div className={`h-6 transition-all duration-500 ${dividerClass} ${isLightMode ? 'bg-black/10' : 'bg-white/10'}`}></div>}
          </div>

          {/* --- RIGHT GROUP --- */}
          <div className="flex items-center gap-2">
              {!isDrawing && (
                <>
                    {/* Auto Rotation - Hide in Clean Mode */}
                    <div className={`overflow-hidden transition-all duration-500 ${isUIHidden ? 'w-0 opacity-0' : 'w-10 opacity-100'}`}>
                        <button onClick={onToggleAutoRotation} className={`flex-shrink-0 rounded-xl flex items-center justify-center transition-all duration-300 border group h-10 w-10 ${isLightMode ? 'border-transparent hover:bg-black/5 text-black/60 hover:text-black' : 'border-transparent hover:bg-white/5 text-white/60 hover:text-white'}`} title={isAutoRotating ? "Dönmeyi Durdur" : "Rastgele Döndür"}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`group-hover:animate-spin ${!isAutoRotating ? 'opacity-50' : ''}`}><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"></path><path d="M21 3v5h-5"></path></svg>
                        </button>
                    </div>
                    
                    {/* Scene Toggle - KEEP BUT DIM */}
                    <button onClick={onToggleScene} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 border group ${isUIHidden ? 'opacity-50 hover:opacity-100' : ''} ${isLightMode ? 'border-transparent hover:bg-black/5 text-black/60 hover:text-black' : 'border-transparent hover:bg-white/5 text-white/60 hover:text-white'}`} title={isSceneVisible ? "Nesneyi Gizle" : "Nesneyi Göster"}>
                        {isSceneVisible ? (<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon-animate-pulse"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>) : (<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-50"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><line x1="2" y1="2" x2="22" y2="22"></line></svg>)}
                    </button>

                    {/* CONFIG BUTTON - Hide in Clean Mode - FİX: overflow-hidden kaldırıldı */}
                    <div className={`relative transition-all duration-500 ${isUIHidden ? 'w-0 opacity-0 overflow-hidden' : 'w-10 opacity-100 overflow-visible'}`}>
                        <button 
                            onClick={(e) => { e.stopPropagation(); setIsSettingsOpen(!isSettingsOpen); closeAllMenus(); setIsSettingsOpen(!isSettingsOpen); }} 
                            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 border group ${isLightMode ? `border-transparent hover:bg-black/5 text-black/60 hover:text-black ${isSettingsOpen ? 'bg-black/10' : ''}` : `border-transparent hover:bg-white/5 text-white/60 hover:text-white ${isSettingsOpen ? 'bg-white/10' : ''}`}`}
                            title="Konfigürasyon"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon-animate-spin"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.47a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                        </button>
                        {isSettingsOpen && (
                            <div className="absolute bottom-full right-0 mb-4 w-72 bg-[#111]/95 backdrop-blur-xl border border-white/20 rounded-xl p-4 shadow-[0_10px_40px_rgba(0,0,0,0.8)] animate-config-pop z-[150] origin-bottom-right" onPointerDown={stopProp} onWheel={(e) => e.stopPropagation()}>
                                <h5 className="text-[10px] font-mono text-gray-400 text-center uppercase tracking-widest mb-3 border-b border-white/10 pb-1">Sistem Ayarları</h5>
                                
                                <div className="max-h-[60vh] overflow-y-auto pr-2 custom-chic-scrollbar space-y-4">
                                    {/* KİLİT AÇMA & GÜVENLİK */}
                                    <div>
                                        <h6 className="text-[10px] text-red-500 font-bold mb-2 uppercase tracking-wider flex items-center gap-2">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                            KİLİT AÇMA & GÜVENLİK
                                        </h6>
                                        <div className="flex gap-1">
                                            <button onClick={() => onSecurityModeChange && onSecurityModeChange('none')} className={`flex-1 py-1.5 rounded text-[9px] font-bold border transition-all ${securityMode === 'none' ? 'bg-red-600 border-red-500 text-white' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}>Hiçbiri</button>
                                            <button onClick={() => onSecurityModeChange && onSecurityModeChange('hand')} className={`flex-1 py-1.5 rounded text-[9px] font-bold border transition-all ${securityMode === 'hand' ? 'bg-red-600 border-red-500 text-white' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}>El Hareketi</button>
                                            <button onClick={() => onSecurityModeChange && onSecurityModeChange('face')} className={`flex-1 py-1.5 rounded text-[9px] font-bold border transition-all ${securityMode === 'face' ? 'bg-red-600 border-red-500 text-white' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}>Yüz Tanıma</button>
                                        </div>
                                    </div>

                                    {/* FİZİK MOTORU */}
                                    <div className="pt-2 border-t border-white/10">
                                        <h6 className="text-[10px] text-blue-400 font-bold mb-2 uppercase tracking-wider flex items-center gap-2">
                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M2 12h20"></path></svg>
                                            Fizik Motoru
                                        </h6>
                                        <div className="space-y-3 pl-1">
                                            <div>
                                                <div className="flex justify-between text-[10px] text-gray-400 mb-1"><span>Itme Kuvveti</span><span>%{repulsionStrength}</span></div>
                                                <StylishSlider min={0} max={100} value={repulsionStrength} onChange={onRepulsionChange} colorClass="bg-blue-500" />
                                            </div>
                                            <div>
                                                <div className="flex justify-between text-[10px] text-gray-400 mb-1"><span>Etki Alanı</span><span>%{repulsionRadius}</span></div>
                                                <StylishSlider min={0} max={100} value={repulsionRadius} onChange={onRadiusChange} colorClass="bg-cyan-500" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* PARTİKÜL YAPISI */}
                                    <div className="pt-2 border-t border-white/10">
                                        <h6 className="text-[10px] text-purple-400 font-bold mb-2 uppercase tracking-wider flex items-center gap-2">
                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle></svg>
                                            Partikül Yapısı
                                        </h6>
                                        <div className="space-y-3 pl-1">
                                            <div>
                                                <div className="flex justify-between text-[10px] text-gray-400 mb-1"><span>Yoğunluk (Adet)</span><span>{Math.round(particleCount/1000)}k</span></div>
                                                <StylishSlider min={20000} max={60000} step={1000} value={particleCount} onChange={onParticleCountChange} colorClass="bg-purple-500" />
                                            </div>
                                            <div>
                                                <div className="flex justify-between text-[10px] text-gray-400 mb-1"><span>Boyut (Pxl)</span><span>{particleSize}px</span></div>
                                                <StylishSlider min={1} max={50} value={particleSize} onChange={onParticleSizeChange} colorClass="bg-pink-500" />
                                            </div>
                                            <div>
                                                <div className="flex justify-between text-[10px] text-gray-400 mb-1"><span>Form Sıklığı</span><span>%{modelDensity}</span></div>
                                                <StylishSlider min={0} max={100} value={modelDensity} onChange={onModelDensityChange} colorClass="bg-orange-500" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* GÖRSEL EFEKTLER */}
                                    <div className="pt-2 border-t border-white/10">
                                        <h6 className="text-[10px] text-green-400 font-bold mb-2 uppercase tracking-wider flex items-center gap-2">
                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path></svg>
                                            Görsel Efektler
                                        </h6>
                                        <div className="space-y-2 pl-1">
                                            <div className="flex items-center justify-between bg-white/5 p-2 rounded-lg border border-white/5 group hover:bg-white/10 transition-colors">
                                                <div className="flex flex-col"><span className="text-[10px] text-gray-200">Neon Patlama (Bloom)</span><span className="text-[8px] text-gray-500 italic">Yüksek parlaklık efekti</span></div>
                                                <button onClick={onToggleBloom} className={`w-8 h-4 rounded-full relative transition-colors ${enableBloom ? 'bg-green-600' : 'bg-white/10'}`}><div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${enableBloom ? 'translate-x-4' : 'translate-x-0'}`} /></button>
                                            </div>
                                            <div className="flex items-center justify-between bg-white/5 p-2 rounded-lg border border-white/5 group hover:bg-white/10 transition-colors">
                                                <div className="flex flex-col"><span className="text-[10px] text-gray-200">İz Efekti (Motion Blur)</span><span className="text-[8px] text-gray-500 italic">Hız izleri bırakır</span></div>
                                                <button onClick={onToggleTrails} className={`w-8 h-4 rounded-full relative transition-colors ${enableTrails ? 'bg-blue-600' : 'bg-white/10'}`}><div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${enableTrails ? 'translate-x-4' : 'translate-x-0'}`} /></button>
                                            </div>
                                            <div className="mt-2">
                                                <div className="flex justify-between text-[10px] text-gray-400 mb-1"><span>Derinlik</span><span>{depthIntensity.toFixed(1)}</span></div>
                                                <StylishSlider min={0} max={5} step={0.1} value={depthIntensity} onChange={onDepthChange} colorClass="bg-emerald-500" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    {/* UI Toggle (Minimize) - KEEP BUT DIM */}
                    <button onClick={onToggleUI} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 border group ${isUIHidden ? 'opacity-50 hover:opacity-100' : ''} ${isLightMode ? 'border-transparent hover:bg-black/5 text-black/60 hover:text-black' : 'border-transparent hover:bg-white/5 text-white/60 hover:text-white'}`} title={isUIHidden ? "Arayüzü Göster" : "Temiz Mod"}>
                        {isUIHidden ? (<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon-animate-spin"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>) : (<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon-animate-bounce"><line x1="5" y1="12" x2="19" y2="12"></line></svg>)}
                    </button>
                </>
              )}
          </div>

        </div>
      </div>

      {/* Particle Image Upload Modal (Moved to Portal) */}
      {showImageModal && createPortal(
          <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-[#111] border border-white/20 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
                  <h3 className="text-lg font-bold text-white mb-2 text-center">Partikül Resmi</h3>
                  <div className="w-full aspect-square bg-black/50 rounded-lg overflow-hidden border border-white/10 mb-4 flex items-center justify-center relative">
                      {pendingImage && <img src={pendingImage} alt="Preview" className="w-full h-full object-contain" />}
                  </div>
                  
                  <div className="mb-4">
                      <label className="text-xs text-gray-400 block mb-2 text-center">Renk Ayarları</label>
                      <div className="flex gap-2 bg-white/5 p-1 rounded-lg">
                          <button 
                              onClick={() => setUseOriginalImageColors(true)}
                              className={`flex-1 py-2 rounded-md text-xs font-medium transition-all ${useOriginalImageColors ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                          >
                              Orijinal Renkler
                          </button>
                          <button 
                              onClick={() => setUseOriginalImageColors(false)}
                              className={`flex-1 py-2 rounded-md text-xs font-medium transition-all ${!useOriginalImageColors ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                          >
                              Tema Rengi
                          </button>
                      </div>
                  </div>

                  <div className="flex gap-3">
                      <button 
                          onClick={() => { setShowImageModal(false); setPendingImage(null); }}
                          className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white font-medium text-sm transition-colors border border-white/5"
                      >
                          İptal
                      </button>
                      <button 
                          onClick={confirmImageUpload}
                          className="flex-1 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-sm shadow-lg hover:shadow-blue-500/20 transition-all transform hover:scale-[1.02]"
                      >
                          Oluştur
                      </button>
                  </div>
              </div>
          </div>,
          document.body
      )}
    </>
  );
});
