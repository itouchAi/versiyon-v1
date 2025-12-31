
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";

interface ScreensaverProps {
  active: boolean;
  onClick: () => void;
  className?: string;
  style?: React.CSSProperties;
  bgColor?: string;
  textColor?: string;
  userText?: string;
  isNatureMode?: boolean;
}

// Weather Types
type WeatherCondition = 'clear' | 'cloudy' | 'rain' | 'snow' | 'unknown';
interface WeatherData {
    temp: number;
    condition: WeatherCondition;
    city: string;
}

// 7-Segment Haritası (0-9)
const DIGIT_MAP: Record<number, string[]> = {
    0: ['A', 'B', 'C', 'D', 'E', 'F'],
    1: ['B', 'C'],
    2: ['A', 'B', 'D', 'E', 'G'],
    3: ['A', 'B', 'C', 'D', 'G'],
    4: ['B', 'C', 'F', 'G'],
    5: ['A', 'C', 'D', 'F', 'G'],
    6: ['A', 'C', 'D', 'E', 'F', 'G'],
    7: ['A', 'B', 'C'],
    8: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
    9: ['A', 'B', 'C', 'D', 'F', 'G'],
};

/* GEOMETRİ VE GRID SİSTEMİ (4x7) */
const H1 = '14.2857%'; const H2 = '28.5714%'; 
const H_POS_0 = '0%'; const H_POS_1 = '14.2857%'; const H_POS_3 = '42.8571%'; const H_POS_4 = '57.1428%'; const H_POS_6 = '85.7142%';
const W1 = '25%'; const W2 = '50%'; 
const W_POS_0 = '0%'; const W_POS_1 = '25%'; const W_POS_3 = '75%';

const SEGMENT_STYLES: Record<string, React.CSSProperties> = {
    A: { top: H_POS_0, left: W_POS_1, width: W2, height: H1 }, G: { top: H_POS_3, left: W_POS_1, width: W2, height: H1 }, D: { top: H_POS_6, left: W_POS_1, width: W2, height: H1 },
    F: { top: H_POS_1, left: W_POS_0, width: W1, height: H2 }, B: { top: H_POS_1, left: W_POS_3, width: W1, height: H2 }, E: { top: H_POS_4, left: W_POS_0, width: W1, height: H2 }, C: { top: H_POS_4, left: W_POS_3, width: W1, height: H2 },
};
const SEGMENT_TRANSFORMS: Record<string, string> = {
    A: 'translateY(2px)', D: 'translateY(-2px)', G: 'translateY(0)', F: 'translateX(2px)', E: 'translateX(2px)', B: 'translateX(-2px)', C: 'translateX(-2px)',
};
const ROTATION_AXIS: Record<string, 'X' | 'Y'> = { A: 'X', G: 'X', D: 'X', F: 'Y', B: 'Y', E: 'Y', C: 'Y' };
const SEGMENT_Z_PRIORITY: Record<string, number> = { A: 1, F: 2, B: 3, G: 4, E: 5, C: 6, D: 7 };

const Segment: React.FC<{ id: string; active: boolean; color: string; bgColor: string; zIndexBase?: number; }> = ({ id, active, color, bgColor, zIndexBase = 0 }) => {
    const axis = ROTATION_AXIS[id];
    const rotateVal = active ? '0deg' : '-180deg';
    const transformString = `rotate${axis}(${rotateVal})`;
    const priority = SEGMENT_Z_PRIORITY[id];
    const zIndex = active ? (50 + zIndexBase + priority) : 1;

    return (
        <div className="absolute" style={{ ...SEGMENT_STYLES[id], zIndex: zIndex, perspective: '1200px' }}>
             <div className="w-full h-full relative transition-transform duration-700 cubic-bezier(0.4, 0.0, 0.2, 1)" style={{ transformStyle: 'preserve-3d', transform: `${SEGMENT_TRANSFORMS[id]} ${transformString}` }}>
                <div className="absolute inset-[0.5px] rounded-[4px] border border-white/10" style={{ backfaceVisibility: 'hidden', backgroundColor: color, boxShadow: `inset 2px 2px 4px rgba(255,255,255,0.4), inset -2px -2px 4px rgba(0,0,0,0.4), 0 0 10px ${color}66, 15px 15px 25px rgba(0,0,0,0.7)`, zIndex: 2 }}>
                     <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent rounded-[4px] pointer-events-none"></div>
                </div>
                <div className="absolute inset-[0.5px] rounded-[4px]" style={{ backfaceVisibility: 'hidden', backgroundColor: bgColor, transform: `rotate${axis}(180deg)`, zIndex: 1 }} />
             </div>
        </div>
    );
};

const Digit: React.FC<{ value: number; color: string; bgColor: string; size: string; zIndexBase?: number }> = ({ value, color, bgColor, size, zIndexBase }) => {
    const activeSegments = DIGIT_MAP[value] || [];
    return ( <div className="relative inline-block mx-[0.5vmin]" style={{ width: `calc(${size} * 0.5714)`, height: size }}> {['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((seg) => ( <Segment key={seg} id={seg} active={activeSegments.includes(seg)} color={color} bgColor={bgColor} zIndexBase={zIndexBase} /> ))} </div> );
};

const AnimatedWeatherIcon: React.FC<{ condition: WeatherCondition, color: string, size?: string }> = ({ condition, color, size="64" }) => {
    const iconFilter = "drop-shadow(4px 4px 6px rgba(0,0,0,0.6))";
    if (condition === 'clear') return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="overflow-visible" style={{ filter: iconFilter }}><g className="origin-center animate-spin-slow-custom"><circle cx="12" cy="12" r="5" fill={color} fillOpacity="0.2" stroke={color} strokeWidth="1.5" /><path d="M12 2V4 M12 20V22 M4.93 4.93L6.34 6.34 M17.66 17.66L19.07 19.07 M2 12H4 M20 12H22 M4.93 19.07L6.34 17.66 M17.66 6.34L19.07 4.93" stroke={color} strokeWidth="1.5" strokeLinecap="round" /></g></svg>;
    if (condition === 'cloudy') return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="overflow-visible" style={{ filter: iconFilter }}><path d="M16 19H7a4 4 0 0 1 0-8 3 3 0 0 1 3-3 4.5 4.5 0 0 1 5.6 1.5 2.5 2.5 0 0 1 .4 4.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="animate-cloud-drift-1" fill={color} fillOpacity="0.1" /><path d="M19 12H18.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" /><path d="M14 17H19a3 3 0 0 0 0-6 2.5 2.5 0 0 0-3.5 1" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="animate-cloud-drift-2 opacity-70" /></svg>;
    if (condition === 'rain') return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="overflow-visible" style={{ filter: iconFilter }}><path d="M16 16H7a4 4 0 0 1 0-8 3 3 0 0 1 3-3 4.5 4.5 0 0 1 5.6 1.5 2.5 2.5 0 0 1 2.4 4.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill={color} fillOpacity="0.1" /><line x1="8" y1="18" x2="8" y2="22" stroke={color} strokeWidth="1.5" strokeLinecap="round" className="animate-rain-fall-1" /><line x1="12" y1="18" x2="12" y2="22" stroke={color} strokeWidth="1.5" strokeLinecap="round" className="animate-rain-fall-2" /><line x1="16" y1="18" x2="16" y2="22" stroke={color} strokeWidth="1.5" strokeLinecap="round" className="animate-rain-fall-3" /></svg>;
    if (condition === 'snow') return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="overflow-visible" style={{ filter: iconFilter }}><path d="M16 16H7a4 4 0 0 1 0-8 3 3 0 0 1 3-3 4.5 4.5 0 0 1 5.6 1.5 2.5 2.5 0 0 1 2.4 4.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill={color} fillOpacity="0.1" /><circle cx="8" cy="20" r="1" fill={color} className="animate-snow-fall-1" /><circle cx="12" cy="20" r="1" fill={color} className="animate-snow-fall-2" /><circle cx="16" cy="20" r="1" fill={color} className="animate-snow-fall-3" /></svg>;
    return null;
}

export const Screensaver: React.FC<ScreensaverProps> = ({ 
  active, 
  onClick, 
  className, 
  style,
  bgColor = '#000000',
  textColor = '#ff0000',
  userText,
  isNatureMode = false
}) => {
  const [time, setTime] = useState(new Date());
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  
  // AI Image Generation State
  const [generatedBgImage, setGeneratedBgImage] = useState<string | null>(null);
  const [lastGenMode, setLastGenMode] = useState<string>(""); // e.g., "morning-clear"
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, [active]);

  const fetchWeather = () => {
      if (navigator.geolocation) {
          // High Accuracy FALSE for better compatibility
          const options = { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 };
          
          navigator.geolocation.getCurrentPosition(
              async (position) => {
                  try {
                      const { latitude, longitude } = position.coords;
                      // FIXED: Added timezone=auto and cache buster
                      const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&timezone=auto&_t=${Date.now()}`);
                      const weatherJson = await weatherRes.json();
                      const cityRes = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`);
                      const cityJson = await cityRes.json();

                      const code = weatherJson.current_weather.weathercode;
                      let condition: WeatherCondition = 'clear';
                      // FIXED: 1, 2, 3 codes are definitely CLOUDY (partly cloudy, overcast)
                      if (code >= 1 && code <= 3) condition = 'cloudy';
                      else if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) condition = 'rain';
                      else if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) condition = 'snow';
                      else if (code > 3) condition = 'cloudy';

                      let cityName = cityJson.city || cityJson.locality || "LOC";
                      cityName = cityName.substring(0, 3).toUpperCase();

                      setWeatherData({ temp: weatherJson.current_weather.temperature, condition: condition, city: cityName });
                  } catch (error) { console.error("Screensaver weather fetch error", error); }
              },
              (error) => console.warn("Location permission needed for screensaver weather", error),
              options
          );
      }
  };

  useEffect(() => {
    if (!active) return;
    fetchWeather();
    const interval = setInterval(fetchWeather, 900000); 
    return () => clearInterval(interval);
  }, [active]);

  // --- AI SCENERY GENERATOR (ENHANCED PHOTOREALISM) ---
  useEffect(() => {
      if (!active || !isNatureMode || !weatherData || !process.env.API_KEY) return;

      const hour = time.getHours();
      let timeMode = 'night';
      let timeDesc = '';

      // Determine Time Mode with Photorealistic Lighting Descriptions
      if (hour >= 6 && hour < 11) { 
          timeMode = 'morning'; 
          timeDesc = "Golden hour morning light, soft sun rays, mist, warm atmosphere."; 
      }
      else if (hour >= 11 && hour < 17) { 
          timeMode = 'noon'; 
          timeDesc = "Bright daylight, clear blue sky, vibrant natural colors."; 
      }
      else if (hour >= 17 && hour < 21) { 
          timeMode = 'evening'; 
          timeDesc = "Sunset lighting, orange and purple sky, dramatic silhouettes."; 
      }
      else { 
          timeMode = 'night'; 
          timeDesc = "Night time, moonlight, stars visible, dark and moody."; 
      }

      const currentModeKey = `${timeMode}-${weatherData.condition}`;

      // Eğer mod değişmediyse tekrar üretme
      if (currentModeKey === lastGenMode) return;

      const generateScenery = async () => {
          setIsGenerating(true);
          setGenerationError(null); // Temizle
          setGeneratedBgImage(null); // Clear previous image for transition effect
          
          try {
              const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
              
              let weatherDesc = "Clear sky.";
              // FIXED: Better description for cloudy/cold weather
              if(weatherData.condition === 'cloudy') weatherDesc = "Overcast, diffused light, moody clouds, greyish sky, no direct sun.";
              if(weatherData.condition === 'rain') weatherDesc = "Rainy, wet surfaces, reflections on ground, moody.";
              if(weatherData.condition === 'snow') weatherDesc = "Snowy, white ground, freezing cold atmosphere.";

              // COLD WEATHER OVERRIDE: If temp is low, force cold look regardless of sky
              if(weatherData.temp < 10) {
                  weatherDesc += " Very cold atmosphere, winter vibes, visible breath, frost on surfaces.";
              }

              // FIXED PROMPT: Strict positional layout to prevent inconsistencies
              const prompt = `A hyper-realistic wide-angle photograph of a park scene with a specific composition:
              1. Left side: A large, ancient oak tree.
              2. Center: An empty wooden park bench.
              3. Right side: A vintage street lamp.
              Condition: ${weatherDesc}
              Time of day: ${timeDesc}
              Style: Cinematic, 8k resolution, highly detailed, photorealistic.`;
              
              const response = await ai.models.generateContent({
                  model: 'gemini-2.5-flash-image',
                  contents: { parts: [{ text: prompt }] },
                  config: { imageConfig: { aspectRatio: "16:9" } }
              });

              let imageFound = false;
              if (response.candidates && response.candidates.length > 0 && response.candidates[0].content && response.candidates[0].content.parts) {
                  for (const part of response.candidates[0].content.parts) {
                      if (part.inlineData) {
                          imageFound = true;
                          const base64 = `data:image/png;base64,${part.inlineData.data}`;
                          const img = new Image();
                          img.src = base64;
                          img.onload = () => {
                              setGeneratedBgImage(base64);
                              setLastGenMode(currentModeKey);
                              setIsGenerating(false);
                          };
                          img.onerror = () => {
                              setGenerationError("Görsel işlenirken hata oluştu.");
                              setIsGenerating(false);
                          };
                      }
                  }
              }
              
              // If model refused to generate image or returned text only
              if (!imageFound) {
                  const textPart = response.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text;
                  setGenerationError(textPart ? `Model reddetti: ${textPart.slice(0, 50)}...` : "Görsel verisi alınamadı.");
                  setIsGenerating(false);
              }

          } catch (e: any) {
              console.error("Scenery Generation Error:", e);
              let errorMsg = "Bağlantı hatası.";
              if (e.message) {
                  if (e.message.includes('403')) errorMsg = "Yetki hatası (API Key?)";
                  else if (e.message.includes('429')) errorMsg = "Kota aşıldı.";
                  else if (e.message.includes('500')) errorMsg = "Sunucu hatası.";
                  else errorMsg = e.message.slice(0, 100);
              }
              setGenerationError(errorMsg);
              setIsGenerating(false);
          }
      };

      // Debounce generation to avoid rapid calls
      const timeout = setTimeout(generateScenery, 1000);
      return () => clearTimeout(timeout);

  }, [active, isNatureMode, weatherData?.condition, time.getHours()]);

  const hours = time.getHours();
  const minutes = time.getMinutes();
  const seconds = time.getSeconds();
  
  // Date Separation for Nature Mode
  const dayName = time.toLocaleDateString('tr-TR', { weekday: 'long' });
  const dayNumber = time.getDate();
  const monthNameFull = time.toLocaleDateString('tr-TR', { month: 'long' });
  const year = time.getFullYear();
  
  const dateStr = time.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  
  const digitSize = "40vmin";

  const isDefaultBlack = bgColor.toLowerCase() === '#000000' || bgColor.toLowerCase() === '#000';
  const effectiveBgColor = isNatureMode ? 'transparent' : (isDefaultBlack ? '#000000' : bgColor);
  const isDay = hours >= 6 && hours < 18;
  const effectiveTextColor = isNatureMode ? (isDay ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.95)') : textColor;
  const effectiveSegmentBgColor = isNatureMode ? (isDay ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)') : effectiveBgColor;
  
  const embossStyle: React.CSSProperties = {
      textShadow: isNatureMode 
        ? (isDay 
            ? '0px 2px 4px rgba(255,255,255,0.9), 0px 0px 8px rgba(255,255,255,0.5)' 
            : '0px 4px 8px rgba(0,0,0,0.9), 0px 2px 15px rgba(0,0,0,0.8)') // Deeper shadow for readability in Nature Mode
        : '3px 3px 6px rgba(0,0,0,0.6), -1px -1px 2px rgba(255,255,255,0.15)',
      color: effectiveTextColor,
      fontWeight: 'bold'
  };

  // --- SPECIAL LAYOUT FOR NATURE MODE ---
  if (isNatureMode) {
      return (
        <div className="absolute inset-0 flex bg-black cursor-pointer select-none z-[100]" onClick={onClick}>
            {/* LEFT VISUAL AREA */}
            <div className="relative flex-1 h-full overflow-hidden bg-black">
                
                {/* 1. LAYER: STYLISH LOADING TEXT (When no image is ready) */}
                {!generatedBgImage && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center z-0 animate-pulse">
                        <div className="text-2xl md:text-3xl font-light tracking-[0.2em] text-white/60 font-mono text-center px-4">
                            DİNAMİK EKRAN GÖRÜNTÜSÜ OLUŞTURULUYOR
                        </div>
                        <div className="mt-6 w-32 h-0.5 bg-gradient-to-r from-transparent via-white/40 to-transparent"></div>
                    </div>
                )}
                
                {/* 2. LAYER: AI GENERATED IMAGE (FADE IN) */}
                <div className={`absolute inset-0 transition-opacity duration-[2000ms] ease-in-out z-10 ${generatedBgImage ? 'opacity-100' : 'opacity-0'}`}>
                    {generatedBgImage && <img src={generatedBgImage} alt="Nature Scenery" className="w-full h-full object-cover object-left" />}
                </div>

                {/* 3. LAYER: ERROR INDICATOR (Bottom Left) */}
                {generationError && (
                    <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2 backdrop-blur px-3 py-1 rounded-full border bg-red-900/60 border-red-500/30">
                        <span className="text-[9px] font-mono text-red-200">
                            Hata: {generationError}
                        </span>
                    </div>
                )}
            </div>

            {/* RIGHT SIDEBAR PANEL */}
            <div className="w-[140px] h-full bg-[#0a0a0a]/90 backdrop-blur-xl border-l border-white/10 flex flex-col items-center py-8 px-2 gap-6 shadow-[0_0_50px_rgba(0,0,0,0.5)] z-20 relative">
                
                {/* 1. WEATHER (Top) - %50 Increased */}
                {weatherData && (
                    <div className="flex flex-col items-center animate-in slide-in-from-right-4 duration-700 shrink-0">
                        <AnimatedWeatherIcon condition={weatherData.condition} color="white" size="60" />
                        <div className="mt-1 text-center">
                            <span className="text-3xl font-bold text-white tracking-tighter block leading-none">{Math.round(weatherData.temp)}°</span>
                        </div>
                    </div>
                )}

                {/* 2. DATE (Below Weather) - Reorganized & %100 Increased */}
                <div className="text-center w-full shrink-0 flex flex-col gap-1 border-b border-white/10 pb-4">
                    {/* Day Name (%50 bigger + Blue Accent) */}
                    <div className="text-xl text-blue-400 font-bold uppercase tracking-widest leading-none break-words mb-1">{dayName}</div>
                    
                    {/* Vertical Date Stack (%100 bigger feel) */}
                    <div className="text-4xl text-white font-black leading-none tracking-tight">{dayNumber}</div>
                    <div className="text-lg text-white/90 font-medium leading-none mt-1">{monthNameFull}</div>
                    <div className="text-lg text-white/90 font-medium leading-none mt-1">{year}</div>
                </div>

                {/* 3. CLOCK (Main Vertical Stack) */}
                <div className="flex-1 flex flex-col justify-center items-center w-full gap-2">
                    {/* Hours */}
                    <div className="text-6xl font-bold text-white tracking-tighter leading-none text-center">
                        {hours.toString().padStart(2, '0')}
                    </div>
                    
                    {/* Separator (Side by side dots) */}
                    <div className="flex gap-3 my-1 opacity-80">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse delay-75"></div>
                    </div>
                    
                    {/* Minutes */}
                    <div className="text-6xl font-bold text-white tracking-tighter leading-none text-center">
                        {minutes.toString().padStart(2, '0')}
                    </div>

                    {/* Separator */}
                    <div className="flex gap-3 my-1 opacity-80">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse delay-75"></div>
                    </div>

                    {/* Seconds (Same size as others) */}
                    <div className="text-6xl font-bold text-white tracking-tighter leading-none text-center">
                        {seconds.toString().padStart(2, '0')}
                    </div>
                </div>

                {/* User Text Footer */}
                {userText && (
                    <div className="mt-auto pt-4 text-center text-[10px] text-white/40 italic max-w-full break-words">
                        "{userText}"
                    </div>
                )}
            </div>
        </div>
      );
  }

  // --- DEFAULT LAYOUT (Original) ---
  return (
    <div className={`absolute inset-0 flex flex-col items-center justify-center cursor-pointer overflow-hidden select-none z-[100] ${className || ''}`} style={{ ...style, backgroundColor: effectiveBgColor }} onClick={onClick}>
      
      {/* --- WEATHER WIDGET --- */}
      {weatherData && (
          <div className="absolute top-10 right-10 flex flex-col items-center animate-in fade-in zoom-in duration-1000 z-20 bg-black/20 backdrop-blur-sm p-4 rounded-xl border border-white/10 shadow-xl">
              <AnimatedWeatherIcon condition={weatherData.condition} color={effectiveTextColor} />
              <div className="flex flex-col items-center mt-2" style={embossStyle}>
                  <span className="text-4xl font-bold font-mono tracking-tighter">{Math.round(weatherData.temp)}°C</span>
                  <span className="text-2xl font-mono opacity-80">{weatherData.city}</span>
              </div>
          </div>
      )}

      {/* --- CLOCK UI --- */}
      <div 
        className={`relative z-10 flex flex-col items-center justify-center gap-2 p-10 rounded-3xl transition-all duration-500 bg-black/30 backdrop-blur-md border border-white/10 shadow-2xl`}
      >
         <div className="flex items-center gap-4 sm:gap-6 mb-8">
            <div className="flex"><Digit value={Math.floor(hours / 10)} color={effectiveTextColor} bgColor={effectiveSegmentBgColor} size={digitSize} zIndexBase={10} /><Digit value={hours % 10} color={effectiveTextColor} bgColor={effectiveSegmentBgColor} size={digitSize} zIndexBase={20} /></div>
            <div className="flex flex-col gap-[3vmin] mx-2 justify-center opacity-80 relative" style={{ height: digitSize, zIndex: 25 }}><div className="w-[3vmin] h-[3vmin] rounded-full" style={{ backgroundColor: effectiveTextColor, boxShadow: `0 0 20px ${effectiveTextColor}, 5px 5px 10px rgba(0,0,0,0.5)` }} /><div className="w-[3vmin] h-[3vmin] rounded-full" style={{ backgroundColor: effectiveTextColor, boxShadow: `0 0 20px ${effectiveTextColor}, 5px 5px 10px rgba(0,0,0,0.5)` }} /></div>
            <div className="flex"><Digit value={Math.floor(minutes / 10)} color={effectiveTextColor} bgColor={effectiveSegmentBgColor} size={digitSize} zIndexBase={30} /><Digit value={minutes % 10} color={effectiveTextColor} bgColor={effectiveSegmentBgColor} size={digitSize} zIndexBase={40} /></div>
            <div className="flex flex-col gap-[3vmin] mx-2 justify-center opacity-80 relative" style={{ height: digitSize, zIndex: 45 }}><div className="w-[3vmin] h-[3vmin] rounded-full" style={{ backgroundColor: effectiveTextColor, boxShadow: `0 0 20px ${effectiveTextColor}, 5px 5px 10px rgba(0,0,0,0.5)` }} /><div className="w-[3vmin] h-[3vmin] rounded-full" style={{ backgroundColor: effectiveTextColor, boxShadow: `0 0 20px ${effectiveTextColor}, 5px 5px 10px rgba(0,0,0,0.5)` }} /></div>
            <div className="flex"><Digit value={Math.floor(seconds / 10)} color={effectiveTextColor} bgColor={effectiveSegmentBgColor} size={digitSize} zIndexBase={50} /><Digit value={seconds % 10} color={effectiveTextColor} bgColor={effectiveSegmentBgColor} size={digitSize} zIndexBase={60} /></div>
         </div>
         <div className="flex flex-col items-center gap-4 w-full text-center">
             <div className="text-6xl md:text-8xl font-bold tracking-wide uppercase drop-shadow-2xl" style={embossStyle}>{dayName}</div>
             <div className="text-4xl md:text-6xl font-medium opacity-90 tracking-wider drop-shadow-xl" style={embossStyle}>{dateStr}</div>
             {userText && <div className="text-3xl md:text-5xl font-light opacity-80 mt-4 px-4 max-w-[80vw] break-words drop-shadow-lg" style={embossStyle}>{userText}</div>}
         </div>
      </div>
    </div>
  );
};
