
import React, { useEffect, useRef, useState } from 'react';

interface MotionControllerProps {
    active: boolean;
    stealthMode?: boolean; // YENİ: Gizli mod (kamera çalışır ama görünmez)
    onHandMove: (x: number, y: number) => void;
    onGesture: (gesture: 'fist' | 'open' | 'zoom' | 'point' | 'pinch') => void; // 'pinch' eklendi
    onZoom?: (zoomFactor: number) => void;
    onCursorMove?: (x: number, y: number) => void;
    onClick?: () => void; // YENİ: Tıklama aksiyonu
    onError?: (error: string) => void;
}

export const MotionController: React.FC<MotionControllerProps> = ({ active, stealthMode = false, onHandMove, onGesture, onZoom, onCursorMove, onClick, onError }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const handsRef = useRef<any>(null);
    const cameraRef = useRef<any>(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [status, setStatus] = useState<string>('');
    const [isHandDetected, setIsHandDetected] = useState(false);
    const [detectedGesture, setDetectedGesture] = useState<'open' | 'fist' | 'zoom' | 'point' | 'pinch' | null>(null);

    // Hareket yumuşatma için (Kamera dönüşü)
    const lastPos = useRef({ x: 0, y: 0 });
    
    // İmleç yumuşatma için (Cursor)
    const lastCursorPos = useRef({ x: 0.5, y: 0.5 });
    
    // Zoom referans değeri
    const baseHandSizeRef = useRef<number | null>(null);

    // Tıklama Debounce (Sürekli tıklamayı önlemek için)
    const isPinchingRef = useRef(false);
    const lastClickTimeRef = useRef(0);

    useEffect(() => {
        if (!active) {
            if (cameraRef.current) {
                cameraRef.current.stop();
                cameraRef.current = null;
            }
            if (handsRef.current) {
                handsRef.current.close();
                handsRef.current = null;
            }
            setIsLoaded(false);
            setIsHandDetected(false);
            setDetectedGesture(null);
            return;
        }

        const loadMediaPipe = async () => {
            setStatus('Kamera Başlatılıyor...');
            
            if (!(window as any).Hands) {
                if(onError) onError("MediaPipe kütüphanesi yüklenemedi.");
                return;
            }

            try {
                const hands = new (window as any).Hands({
                    locateFile: (file: string) => {
                        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
                    }
                });

                hands.setOptions({
                    maxNumHands: 1,
                    modelComplexity: 1,
                    minDetectionConfidence: 0.5,
                    minTrackingConfidence: 0.5
                });

                hands.onResults((results: any) => {
                    const canvas = canvasRef.current;
                    const ctx = canvas?.getContext('2d');
                    
                    if (canvas && ctx) {
                        ctx.save();
                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                        ctx.scale(-1, 1);
                        ctx.translate(-canvas.width, 0);
                        
                        ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
                        
                        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
                            setIsHandDetected(true);
                            for (const landmarks of results.multiHandLandmarks) {
                                const drawingUtils = (window as any);
                                if (drawingUtils.drawConnectors && drawingUtils.drawLandmarks) {
                                    let color = '#00FF00'; // Default Open
                                    if (detectedGesture === 'zoom') color = '#00FFFF';
                                    else if (detectedGesture === 'fist') color = '#FF0000';
                                    else if (detectedGesture === 'point') color = '#FFFF00'; // Point Sarı
                                    else if (detectedGesture === 'pinch') color = '#FFFFFF'; // Pinch Beyaz/Mavi

                                    drawingUtils.drawConnectors(ctx, landmarks, (window as any).HAND_CONNECTIONS, {color: color, lineWidth: 2});
                                    drawingUtils.drawLandmarks(ctx, landmarks, {color: '#FFFFFF', lineWidth: 1, radius: 3});
                                    
                                    // Pinch durumunda başparmak ve işaret parmağı arasına çizgi çek
                                    if (detectedGesture === 'pinch' || detectedGesture === 'point') {
                                        const thumb = landmarks[4];
                                        const index = landmarks[8];
                                        ctx.beginPath();
                                        ctx.moveTo(thumb.x * canvas.width, thumb.y * canvas.height);
                                        ctx.lineTo(index.x * canvas.width, index.y * canvas.height);
                                        ctx.strokeStyle = detectedGesture === 'pinch' ? '#0088FF' : '#FFFF00';
                                        ctx.lineWidth = 4;
                                        ctx.stroke();
                                    }
                                }
                            }
                        } else {
                            setIsHandDetected(false);
                            setDetectedGesture(null);
                            baseHandSizeRef.current = null;
                        }
                        ctx.restore();
                    }

                    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
                        const landmarks = results.multiHandLandmarks[0];
                        const wrist = landmarks[0];
                        
                        // 1. Parmak Uçları ve Kökleri
                        const thumbTip = landmarks[4];
                        const indexTip = landmarks[8];
                        const middleTip = landmarks[12];
                        const ringTip = landmarks[16];
                        const pinkyTip = landmarks[20];

                        // 2. El Boyutu (Derinlik referansı)
                        const currentHandSize = Math.hypot(middleTip.x - wrist.x, middleTip.y - wrist.y);

                        // 3. Jest Algılama Mantığı
                        
                        // A) Yumruk Kontrolü
                        let isFist = true;
                        [8, 12, 16, 20].forEach(idx => {
                            const tip = landmarks[idx];
                            const dist = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
                            if (dist > 0.35) isFist = false; 
                        });

                        // B) Pinch (Çimdik/Tıkla) Kontrolü - En yüksek öncelik
                        const pinchDist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
                        // Pinch eşiği: El boyutuna göre dinamik olabilir ama sabit 0.05 genelde iyi çalışır.
                        const isPinching = pinchDist < 0.05;

                        // C) İşaret Etme (Point) Kontrolü
                        const distIndex = Math.hypot(indexTip.x - wrist.x, indexTip.y - wrist.y);
                        const distMiddle = Math.hypot(middleTip.x - wrist.x, middleTip.y - wrist.y);
                        const distRing = Math.hypot(ringTip.x - wrist.x, ringTip.y - wrist.y);
                        const distPinky = Math.hypot(pinkyTip.x - wrist.x, pinkyTip.y - wrist.y);

                        const isPointing = (distIndex > 0.25) && 
                                           (distMiddle < distIndex * 0.7) && 
                                           (distRing < distIndex * 0.7) && 
                                           (distPinky < distIndex * 0.7);

                        // D) Zoom Kontrolü
                        const fingerSpread = Math.hypot(indexTip.x - pinkyTip.x, indexTip.y - pinkyTip.y);
                        const spreadRatio = fingerSpread / currentHandSize;
                        const isZoomPose = !isFist && !isPointing && (spreadRatio < 0.45);

                        // KARAR MEKANİZMASI
                        let currentGesture: 'fist' | 'zoom' | 'point' | 'open' | 'pinch' = 'open';

                        // İmleç Koordinatlarını Sürekli Güncelle (Point veya Pinch durumunda)
                        // Pinch yaparken de imleci hareket ettirebilmeliyiz.
                        if (isPointing || isPinching) {
                            // Koordinat kaynağı: İşaret parmağı ucu veya (Pinch ise) iki parmağın ortası
                            let rawX, rawY;
                            if (isPinching) {
                                rawX = 1 - ((thumbTip.x + indexTip.x) / 2);
                                rawY = (thumbTip.y + indexTip.y) / 2;
                            } else {
                                rawX = 1 - indexTip.x;
                                rawY = indexTip.y;
                            }

                            if (onCursorMove) {
                                const smoothFactor = 0.4; // İmleç hızı
                                const smoothX = lastCursorPos.current.x + (rawX - lastCursorPos.current.x) * smoothFactor;
                                const smoothY = lastCursorPos.current.y + (rawY - lastCursorPos.current.y) * smoothFactor;
                                lastCursorPos.current = { x: smoothX, y: smoothY };
                                onCursorMove(smoothX, smoothY);
                            }
                        }

                        if (isFist) {
                            currentGesture = 'fist';
                            baseHandSizeRef.current = null;
                        } else if (isPinching) {
                            currentGesture = 'pinch';
                            baseHandSizeRef.current = null;
                            
                            // TIKLAMA MANTIĞI (Tek seferlik tetikleme)
                            if (!isPinchingRef.current) {
                                isPinchingRef.current = true;
                                const now = Date.now();
                                if (now - lastClickTimeRef.current > 300) { // 300ms debounce
                                    if (onClick) onClick();
                                    lastClickTimeRef.current = now;
                                }
                            }
                        } else if (isPointing) {
                            currentGesture = 'point';
                            isPinchingRef.current = false; // Pinch bitti
                            baseHandSizeRef.current = null;
                        } else if (isZoomPose) {
                            currentGesture = 'zoom';
                            isPinchingRef.current = false;
                            if (baseHandSizeRef.current === null) {
                                baseHandSizeRef.current = currentHandSize;
                            }
                            if (onZoom && baseHandSizeRef.current) {
                                const zoomFactor = currentHandSize / baseHandSizeRef.current;
                                onZoom(zoomFactor);
                            }
                        } else {
                            currentGesture = 'open';
                            isPinchingRef.current = false;
                            baseHandSizeRef.current = null;
                            
                            const x = landmarks[9].x; 
                            const y = landmarks[9].y;
                            const smoothX = lastPos.current.x + (x - lastPos.current.x) * 0.2;
                            const smoothY = lastPos.current.y + (y - lastPos.current.y) * 0.2;
                            lastPos.current = { x: smoothX, y: smoothY };
                            onHandMove(1 - smoothX, smoothY);
                        }

                        setDetectedGesture(currentGesture);
                        onGesture(currentGesture);
                    }
                });

                handsRef.current = hands;

                if (videoRef.current) {
                    const camera = new (window as any).Camera(videoRef.current, {
                        onFrame: async () => {
                            if (handsRef.current) {
                                await handsRef.current.send({ image: videoRef.current });
                            }
                        },
                        width: 320,
                        height: 240
                    });
                    cameraRef.current = camera;
                    await camera.start();
                    setIsLoaded(true);
                    setStatus('Kamera Aktif');
                }
            } catch (err: any) {
                console.error("Camera Error:", err);
                if (onError) onError("Kamera başlatılamadı: " + err.message);
                setStatus('Hata');
            }
        };

        loadMediaPipe();

        return () => {
            if (cameraRef.current) cameraRef.current.stop();
        };
    }, [active]);

    // Stealth Mode: Görünmezlik sınıfı (opacity-0 ve pointer-events-none)
    const visibilityClass = stealthMode ? 'opacity-0 pointer-events-none' : (active ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10');

    return (
        <div className={`fixed top-24 left-6 z-[200] transition-all duration-500 ${visibilityClass}`}>
            <div className={`relative w-48 h-36 rounded-xl overflow-hidden border-2 transition-colors duration-300 bg-black/50 shadow-2xl ${
                isHandDetected 
                ? (detectedGesture === 'zoom' ? 'border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.5)]' 
                  : detectedGesture === 'fist' ? 'border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.5)]' 
                  : detectedGesture === 'pinch' ? 'border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.8)]'
                  : detectedGesture === 'point' ? 'border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.5)]'
                  : 'border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.3)]') 
                : 'border-white/10'
            }`}>
                <video ref={videoRef} className="hidden" playsInline muted></video>
                <canvas ref={canvasRef} width={320} height={240} className="w-full h-full object-cover"></canvas>
                
                <div className={`absolute bottom-0 left-0 right-0 text-[9px] text-center py-1 font-mono backdrop-blur-md transition-colors ${isHandDetected ? 'bg-black/60 text-white' : 'bg-black/60 text-white/60'}`}>
                    {isHandDetected 
                        ? (detectedGesture === 'zoom' ? 'ZOOM MODU' 
                          : detectedGesture === 'fist' ? 'ÇIKIŞ MODU' 
                          : detectedGesture === 'pinch' ? 'TIKLAMA'
                          : detectedGesture === 'point' ? 'İMLEÇ MODU'
                          : 'DÖNDÜRME MODU') 
                        : status || 'BEKLENİYOR...'}
                </div>

                {!isLoaded && (
                     <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                     </div>
                )}
            </div>
            
            {isLoaded && (
                <div className="mt-2 flex flex-col gap-1 items-start animate-in fade-in slide-in-from-top-2">
                    <div className={`bg-black/60 backdrop-blur px-3 py-1 rounded-full border border-white/10 text-[9px] font-mono flex items-center gap-2 ${detectedGesture === 'open' ? 'text-green-300 border-green-500/30' : 'text-white/50'}`}>
                        <span className={`w-2 h-2 rounded-full ${detectedGesture === 'open' ? 'bg-green-500 animate-pulse' : 'bg-gray-600'}`}></span>
                        Avuç Açık: Döndür
                    </div>
                    <div className={`bg-black/60 backdrop-blur px-3 py-1 rounded-full border border-white/10 text-[9px] font-mono flex items-center gap-2 ${detectedGesture === 'point' ? 'text-yellow-300 border-yellow-500/30' : 'text-white/50'}`}>
                        <span className={`w-2 h-2 rounded-full ${detectedGesture === 'point' ? 'bg-yellow-400 animate-pulse' : 'bg-gray-600'}`}></span>
                        İşaret Parmağı: İmleç
                    </div>
                    <div className={`bg-black/60 backdrop-blur px-3 py-1 rounded-full border border-white/10 text-[9px] font-mono flex items-center gap-2 ${detectedGesture === 'pinch' ? 'text-blue-300 border-blue-500/30' : 'text-white/50'}`}>
                        <span className={`w-2 h-2 rounded-full ${detectedGesture === 'pinch' ? 'bg-blue-500 animate-pulse' : 'bg-gray-600'}`}></span>
                        Pinch: Tıkla
                    </div>
                    <div className={`bg-black/60 backdrop-blur px-3 py-1 rounded-full border border-white/10 text-[9px] font-mono flex items-center gap-2 ${detectedGesture === 'zoom' ? 'text-cyan-300 border-cyan-500/30' : 'text-white/50'}`}>
                        <span className={`w-2 h-2 rounded-full ${detectedGesture === 'zoom' ? 'bg-cyan-400 animate-pulse' : 'bg-gray-600'}`}></span>
                        Bitişik: Yaklaş/Uzaklaş
                    </div>
                    <div className={`bg-black/60 backdrop-blur px-3 py-1 rounded-full border border-white/10 text-[9px] font-mono flex items-center gap-2 ${detectedGesture === 'fist' ? 'text-red-300 border-red-500/30' : 'text-white/50'}`}>
                        <span className={`w-2 h-2 rounded-full ${detectedGesture === 'fist' ? 'bg-red-500' : 'bg-gray-600'}`}></span>
                        Yumruk: Dağıt
                    </div>
                </div>
            )}
        </div>
    );
};
