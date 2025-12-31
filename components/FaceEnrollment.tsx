
import React, { useEffect, useRef, useState } from 'react';
import { saveFaceDescriptor } from '../utils/db';

interface FaceEnrollmentProps {
    onComplete: () => void;
    onCancel: () => void;
}

export const FaceEnrollment: React.FC<FaceEnrollmentProps> = ({ onComplete, onCancel }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    
    // Durum Mesajları
    const [status, setStatus] = useState<string>('Sistem Başlatılıyor...');
    const [debugInfo, setDebugInfo] = useState<string>('');
    const [isModelLoaded, setIsModelLoaded] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    const streamRef = useRef<MediaStream | null>(null);
    const loopRef = useRef<number | null>(null); // RequestAnimationFrame ID

    // FaceAPI Global Erişimi
    const faceapi = (window as any).faceapi;

    // 1. AŞAMA: MODELLERİ YÜKLE
    useEffect(() => {
        const initSystem = async () => {
            if (!faceapi) {
                setStatus("HATA: FaceAPI kütüphanesi yüklenemedi.");
                return;
            }

            try {
                setStatus("Biyometrik Modeller Yükleniyor...");
                const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';

                // Paralel yükleme
                await Promise.all([
                    faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL), // Tespit
                    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL), // 68 Nokta
                    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL) // Descriptor (İmza)
                ]);

                setIsModelLoaded(true);
                setStatus("Kamera Açılıyor...");
                startCamera();

            } catch (error: any) {
                console.error("Model Yükleme Hatası:", error);
                setStatus(`HATA: Modeller yüklenemedi. (${error.message})`);
            }
        };

        initSystem();

        // Temizlik (Unmount)
        return () => {
            stopCamera();
            if (loopRef.current) cancelAnimationFrame(loopRef.current);
        };
    }, []);

    // 2. AŞAMA: KAMERAYI BAŞLAT
    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    width: { ideal: 640 }, 
                    height: { ideal: 480 },
                    facingMode: "user" 
                } 
            });
            
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (err) {
            setStatus("HATA: Kameraya erişim izni verilmedi.");
        }
    };

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
    };

    // 3. AŞAMA: TARAMA DÖNGÜSÜ (Video verisi gelince başlar)
    const handleVideoPlay = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;

        if (!video || !canvas || !isModelLoaded || isSaving) return;

        // Canvas boyutlarını videoya eşitle
        const displaySize = { width: video.videoWidth, height: video.videoHeight };
        faceapi.matchDimensions(canvas, displaySize);

        setStatus("Yüz Taranıyor... Lütfen Sabit Durun.");

        const detectFrame = async () => {
            if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) return;
            if (isSaving) return; // Kayıt yapılıyorsa dur

            // A) TESPİT ET
            // SsdMobilenetv1Options en stabil olanıdır. minConfidence: 0.5
            const detection = await faceapi.detectSingleFace(
                videoRef.current, 
                new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 })
            )
            .withFaceLandmarks()
            .withFaceDescriptor();

            // B) ÇİZİM TEMİZLİĞİ
            const ctx = canvas.getContext('2d');
            ctx?.clearRect(0, 0, canvas.width, canvas.height);

            if (detection) {
                const dims = faceapi.matchDimensions(canvas, videoRef.current, true);
                const resized = faceapi.resizeResults(detection, dims);
                
                // Yeşil kutu ve noktaları çiz
                faceapi.draw.drawDetections(canvas, resized);
                // faceapi.draw.drawFaceLandmarks(canvas, resized); // İsteğe bağlı, performansı düşürebilir

                const score = detection.detection.score;
                setDebugInfo(`Kalite: %${Math.round(score * 100)}`);

                // C) KAYIT KONTROLÜ (Eşik Değeri: 0.85)
                if (score > 0.85) {
                    // Mükemmel bir kare yakalandı!
                    handleSave(detection.descriptor);
                    return; // Döngüden çık
                }
            } else {
                setDebugInfo("Yüz Aranıyor...");
            }

            // Döngüye devam et
            loopRef.current = requestAnimationFrame(detectFrame);
        };

        // Döngüyü başlat
        loopRef.current = requestAnimationFrame(detectFrame);
    };

    // 4. AŞAMA: KAYDET VE KAPAT
    const handleSave = async (descriptor: Float32Array) => {
        setIsSaving(true); // Tekrar tetiklenmesini engelle
        if (loopRef.current) cancelAnimationFrame(loopRef.current);
        
        setStatus("Biyometrik İmza Oluşturuluyor...");
        setDebugInfo("Lütfen Bekleyin...");

        try {
            // Mantık: 128 uzunluğunda Float32Array'i DB'ye atıyoruz.
            await saveFaceDescriptor(descriptor);
            
            setStatus("BAŞARILI: Yüz Verisi Şifrelendi ve Kaydedildi.");
            
            // Kullanıcıya başarı mesajını gösterip kapat
            setTimeout(() => {
                onComplete();
            }, 1500);

        } catch (e) {
            console.error(e);
            setStatus("Kayıt Hatası! Tekrar deneyin.");
            setIsSaving(false);
            // Hatada tekrar döngüye dön
            loopRef.current = requestAnimationFrame(handleVideoPlay);
        }
    };

    return (
        <div className="fixed inset-0 z-[300] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-4 animate-in fade-in duration-300">
            <h2 className="text-2xl font-bold text-white mb-2 tracking-wider uppercase">Biyometrik Kayıt</h2>
            
            {/* Durum Mesajları */}
            <div className="text-center mb-6 h-12">
                <p className={`font-mono text-sm transition-colors duration-300 ${isSaving ? 'text-green-400' : 'text-gray-300'}`}>
                    {status}
                </p>
                <p className="text-xs text-blue-400 font-mono mt-1">{debugInfo}</p>
            </div>
            
            <div className="relative rounded-2xl overflow-hidden border-2 border-white/20 shadow-[0_0_50px_rgba(0,255,255,0.2)] bg-black w-[640px] max-w-full aspect-[4/3]">
                {/* Video: Scale X -1 ile ayna efekti veriyoruz */}
                <video 
                    ref={videoRef} 
                    autoPlay 
                    muted 
                    playsInline
                    onPlay={handleVideoPlay}
                    className="absolute inset-0 w-full h-full object-cover transform scale-x-[-1]" 
                />
                
                {/* Canvas: Çizim Katmanı */}
                <canvas 
                    ref={canvasRef} 
                    className="absolute inset-0 w-full h-full transform scale-x-[-1]" 
                />
                
                {/* Yükleniyor Efekti */}
                {!isSaving && isModelLoaded && !debugInfo.includes('Kalite') && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-64 h-64 border-2 border-blue-500/30 rounded-full animate-ping"></div>
                    </div>
                )}
                
                {/* Başarı Overlay */}
                {isSaving && status.includes('BAŞARILI') && (
                    <div className="absolute inset-0 bg-green-900/80 flex flex-col items-center justify-center backdrop-blur-sm transition-all duration-500 z-50">
                        <svg className="w-24 h-24 text-white drop-shadow-[0_0_15px_rgba(0,0,0,0.5)] mb-4 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        <span className="text-white font-bold text-xl drop-shadow-md tracking-widest">KAYDEDİLDİ</span>
                    </div>
                )}
            </div>

            <div className="mt-8">
                {!isSaving && (
                    <button 
                        onClick={onCancel}
                        className="px-8 py-2.5 rounded-full border border-red-500/30 text-red-200 hover:bg-red-500/10 hover:border-red-500 transition-colors font-mono text-sm tracking-wide"
                    >
                        İPTAL ET
                    </button>
                )}
            </div>
        </div>
    );
};
