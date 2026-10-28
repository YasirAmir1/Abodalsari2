import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Sun,
  Moon,
  LogOut,
  Menu,
  RefreshCw,
  Cloud,
  CloudSun,
  CloudRain,
  CloudLightning,
  CloudFog,
  CloudMoon,
  UserCheck,
  ChevronDown,
  Wind,
  Droplets,
  Thermometer,
  MapPin,
  X
} from 'lucide-react';
import { Logo } from './Logo';

interface HeaderProps {
  pageTitle: string;
  currentTab?: string;
  isAgentMode: boolean;
  agentsList: { id: string; name: string }[];
  selectedAgentId: string;
  onSelectAgent: (id: string) => void;
  onLogout?: () => void;
  isDark?: boolean;
  onToggleDark?: () => void;
  onToggleSidebar?: () => void;
  onSync?: () => void;
}

interface TomorrowWeather {
  tempMax: number;
  tempMin: number;
  condition: string;
  weatherCode: number;
}

interface WeatherInfo {
  temp: number;
  feelsLike: number;
  condition: string;
  weatherCode: number;
  isDay: boolean;
  windSpeed: number;
  humidity: number;
  precipitation: number;
  city: string;
  tomorrow: TomorrowWeather;
  lastUpdated?: string;
}

const WEATHER_CACHE_KEY = 'al_sari_weather_alam_v2';
const WEATHER_CACHE_EXPIRY = 25 * 60 * 1000; // 25 minutes smart cache

// Convert Open-Meteo WMO weather codes to Arabic labels
const getWeatherDescription = (code: number, isDay: boolean): string => {
  if (code === 0) return isDay ? 'صافٍ مشمس' : 'صافٍ ليلاً';
  if (code === 1 || code === 2) return isDay ? 'غائم جزئياً' : 'صحو جزئياً';
  if (code === 3) return 'غائم تماماً';
  if (code === 45 || code === 48) return 'ضباب خفيف';
  if (code >= 51 && code <= 57) return 'رذاذ مطري';
  if (code >= 61 && code <= 67) return 'أمطار';
  if (code >= 71 && code <= 77) return 'تساقط ثلوج';
  if (code >= 80 && code <= 82) return 'زخات مطرية';
  if (code >= 95 && code <= 99) return 'عواصف رعدية';
  return isDay ? 'معتدل' : 'صافٍ';
};

export const Header: React.FC<HeaderProps> = ({
  pageTitle,
  currentTab,
  isAgentMode,
  agentsList,
  selectedAgentId,
  onSelectAgent,
  onLogout,
  isDark = false,
  onToggleDark,
  onToggleSidebar,
  onSync
}) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [showWeatherTooltip, setShowWeatherTooltip] = useState(false);
  const [weather, setWeather] = useState<WeatherInfo>(() => {
    const currentHour = new Date().getHours();
    const isDayTime = currentHour >= 6 && currentHour < 18;

    // Instant recovery from local smart cache if available
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(WEATHER_CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.data) {
            return parsed.data;
          }
        }
      } catch {
        // Fallback to default
      }
    }

    return {
      temp: 26,
      feelsLike: 25,
      condition: isDayTime ? 'صافٍ مشمس' : 'صافٍ ليلاً',
      weatherCode: 0,
      isDay: isDayTime,
      windSpeed: 8,
      humidity: 32,
      precipitation: 0,
      city: 'تكريت - قضاء العلم',
      tomorrow: {
        tempMax: 31,
        tempMin: 18,
        condition: 'صافٍ مشمس',
        weatherCode: 0
      }
    };
  });

  // Fetch real-time weather from Open-Meteo for Tikrit - Al-Alam with smart cache
  useEffect(() => {
    let isMounted = true;

    const fetchWeather = async () => {
      try {
        // Check local cache validity
        const cached = localStorage.getItem(WEATHER_CACHE_KEY);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (Date.now() - parsed.timestamp < WEATHER_CACHE_EXPIRY) {
              if (isMounted) setWeather(parsed.data);
              return;
            }
          } catch {
            // Ignore parse errors and fetch fresh
          }
        }

        // Open-Meteo API query for Tikrit - Al-Alam District (Lat: 34.6983, Lon: 43.6931)
        const res = await fetch(
          'https://api.open-meteo.com/v1/forecast?latitude=34.6983&longitude=43.6931&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=Asia%2FBaghdad'
        );

        if (!res.ok) return;

        const data = await res.json();
        if (data && data.current && isMounted) {
          const current = data.current;
          const isDay = current.is_day === 1;
          const code = current.weather_code ?? 0;

          // Tomorrow's forecast from daily array (index 1 is tomorrow)
          const tomorrowCode = data.daily?.weather_code?.[1] ?? 0;
          const tomorrowMax = Math.round(data.daily?.temperature_2m_max?.[1] ?? (current.temperature_2m + 2));
          const tomorrowMin = Math.round(data.daily?.temperature_2m_min?.[1] ?? (current.temperature_2m - 7));

          const weatherData: WeatherInfo = {
            temp: Math.round(current.temperature_2m),
            feelsLike: Math.round(current.apparent_temperature ?? current.temperature_2m),
            condition: getWeatherDescription(code, isDay),
            weatherCode: code,
            isDay: isDay,
            windSpeed: Math.round(current.wind_speed_10m ?? 8),
            humidity: Math.round(current.relative_humidity_2m ?? 35),
            precipitation: current.precipitation ?? 0,
            city: 'تكريت - قضاء العلم',
            tomorrow: {
              tempMax: tomorrowMax,
              tempMin: tomorrowMin,
              condition: getWeatherDescription(tomorrowCode, true),
              weatherCode: tomorrowCode
            },
            lastUpdated: new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })
          };

          setWeather(weatherData);
          localStorage.setItem(
            WEATHER_CACHE_KEY,
            JSON.stringify({ timestamp: Date.now(), data: weatherData })
          );
        }
      } catch (err) {
        // Fallback silently without breaking the UI, retaining current cache
        console.debug('Weather fetch note:', err);
      }
    };

    fetchWeather();
    const interval = setInterval(fetchWeather, 20 * 60 * 1000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleSyncClick = () => {
    if (onSync && !isSyncing) {
      setIsSyncing(true);
      onSync();
      setTimeout(() => setIsSyncing(false), 900);
    }
  };

  // Weather Icon Component based on weather code and day/night
  // Weather Icon Component based on weather code and day/night
  const renderWeatherIcon = (
    code: number = weather.weatherCode,
    isDay: boolean = weather.isDay,
    customClass?: string
  ) => {
    const iconClass = customClass || "w-4 h-4 shrink-0 transition-transform duration-300";

    if (code === 0) {
      return isDay ? (
        <Sun className={`${iconClass} text-amber-500 animate-[spin_12s_linear_infinite]`} />
      ) : (
        <Moon className={`${iconClass} text-indigo-400`} />
      );
    }
    if (code === 1 || code === 2) {
      return isDay ? (
        <CloudSun className={`${iconClass} text-amber-500`} />
      ) : (
        <CloudMoon className={`${iconClass} text-indigo-400`} />
      );
    }
    if (code === 3) {
      return <Cloud className={`${iconClass} text-slate-400`} />;
    }
    if (code === 45 || code === 48) {
      return <CloudFog className={`${iconClass} text-slate-400`} />;
    }
    if (code >= 51 && code <= 82) {
      return <CloudRain className={`${iconClass} text-sky-500`} />;
    }
    if (code >= 95) {
      return <CloudLightning className={`${iconClass} text-amber-400`} />;
    }

    return isDay ? (
      <Sun className={`${iconClass} text-amber-500`} />
    ) : (
      <Moon className={`${iconClass} text-indigo-400`} />
    );
  };

  // Format today's date in Iraqi Arabic
  const todayFormatted = new Date().toLocaleDateString('ar-IQ', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <header className="h-16 bg-white/90 dark:bg-[#0B132B]/95 backdrop-blur-md border-b border-slate-200/90 dark:border-slate-800/90 px-3.5 md:px-6 flex items-center justify-between sticky top-0 z-20 select-none transition-colors duration-200">
      {/* Right Zone in RTL: Mobile Hamburger + Breadcrumb / Page Title + Agent Switcher */}
      <div className="flex items-center gap-2.5 md:gap-3.5 min-w-0">
        {/* Mobile Hamburger Menu Button */}
        <button
          onClick={onToggleSidebar}
          className="md:hidden p-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer shrink-0 shadow-xs active:scale-95"
          title="فتح القائمة الجانبية"
          aria-label="القائمة الجانبية"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Mobile App Brand Icon */}
        <div className="md:hidden flex items-center shrink-0">
          <Logo size="sm" className="shadow-2xs" />
        </div>

        {/* Title & Breadcrumb Block */}
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-base md:text-lg font-black text-slate-900 dark:text-white tracking-tight truncate">
              {pageTitle}
            </h1>

            {/* Agent Mode Badge & Switcher */}
            {isAgentMode && currentTab !== 'agents' && currentTab !== 'agent_portal' && (
              <div className="hidden sm:flex items-center gap-1.5 mr-1.5 shrink-0">
                <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 px-2 py-0.5 rounded-md border border-amber-200/80 dark:border-amber-700/60 shadow-xs">
                  <UserCheck className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                  <span>الوكيل</span>
                </span>
                <div className="relative">
                  <select
                    value={selectedAgentId}
                    onChange={(e) => onSelectAgent(e.target.value)}
                    className="text-xs font-bold bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-lg pl-6 pr-2.5 py-1 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer appearance-none shadow-2xs hover:bg-slate-200/70 dark:hover:bg-slate-700/70 transition-colors"
                  >
                    {agentsList.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3 h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Left Zone in RTL: Date & Tikrit - Al-Alam Weather + Control Actions */}
      <div className="flex items-center gap-2 sm:gap-2.5">
        {/* Date & Weather Capsule Group */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Tikrit - Al-Alam Weather & Tomorrow Forecast Group */}
          <div className="relative">
            <div className="flex items-center gap-1.5">
              {/* Main Weather Capsule for Tikrit - Al-Alam */}
              <button
                onClick={() => setShowWeatherTooltip((prev) => !prev)}
                className="flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 rounded-full text-xs font-bold bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/50 text-amber-900 dark:text-amber-200 hover:border-amber-300 dark:hover:border-amber-700 hover:bg-amber-100/70 dark:hover:bg-amber-900/40 transition-all cursor-pointer shadow-2xs"
                title={`الطقس المباشر في ${weather.city}: ${weather.temp}°م · ${weather.condition} (اضغط لمزيد من التفاصيل)`}
              >
                {renderWeatherIcon(weather.weatherCode, weather.isDay)}
                <span className="hidden md:inline text-slate-700 dark:text-slate-300 font-medium">
                  {weather.city}
                </span>
                <span className="font-extrabold tabular-nums text-slate-900 dark:text-white">
                  {weather.temp}°م
                </span>
                <span className="hidden lg:inline text-xs text-amber-700 dark:text-amber-300/90 font-medium border-r border-amber-200 dark:border-amber-800/60 pr-1.5">
                  {weather.condition}
                </span>
              </button>

              {/* Tomorrow Forecast Circular Badge (بدائرة صغيرة) */}
              <button
                onClick={() => setShowWeatherTooltip((prev) => !prev)}
                className="w-8 h-8 rounded-full flex flex-col items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100 dark:from-slate-850 dark:to-amber-950/40 border border-amber-300/90 dark:border-amber-700/70 text-amber-950 dark:text-amber-200 shadow-2xs hover:scale-105 active:scale-95 hover:border-amber-400 dark:hover:border-amber-600 transition-all cursor-pointer relative group shrink-0"
                title={`توقعات غداً في تكريت - قضاء العلم: ${weather.tomorrow.condition} · العظمى ${weather.tomorrow.tempMax}°م / الصغرى ${weather.tomorrow.tempMin}°م`}
                aria-label="توقعات طقس يوم غد"
              >
                <span className="text-[8px] font-black text-amber-800 dark:text-amber-300 leading-none">غداً</span>
                <span className="text-[10px] font-extrabold text-slate-900 dark:text-white tabular-nums leading-tight">
                  {weather.tomorrow.tempMax}°
                </span>
                {/* Floating micro status dot */}
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-[#0B132B]" />
              </button>
            </div>

            {/* Expanded Weather Details & Tomorrow Forecast Popover */}
            {showWeatherTooltip && (
              <>
                {/* Invisible backdrop to dismiss on click outside */}
                <div
                  className="fixed inset-0 z-40 cursor-default"
                  onClick={() => setShowWeatherTooltip(false)}
                />

                <div className="fixed sm:absolute top-16 sm:top-full left-2 right-2 sm:left-0 sm:right-auto sm:mt-2 z-50 w-auto sm:w-84 max-w-[calc(100vw-1rem)] sm:max-w-none p-3.5 rounded-2xl bg-white/95 dark:bg-[#0F172A]/95 backdrop-blur-xl border border-slate-200 dark:border-slate-800 shadow-2xl text-xs space-y-3 animate-in fade-in zoom-in-95 duration-150">
                  {/* Popover Header */}
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-2.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
                      <div className="truncate">
                        <div className="font-black text-slate-900 dark:text-white text-xs sm:text-sm">
                          {weather.city}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">
                          محافظة صلاح الدين · العراق
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        مباشر
                      </span>
                      <button
                        onClick={() => setShowWeatherTooltip(false)}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        title="إغلاق"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Current Weather Highlight Card */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50/70 dark:from-amber-950/30 dark:to-orange-950/20 border border-amber-200/60 dark:border-amber-800/40">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 shadow-2xs border border-amber-100 dark:border-amber-900/40">
                        {renderWeatherIcon(weather.weatherCode, weather.isDay, "w-6 h-6")}
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-amber-800/80 dark:text-amber-300/80">الطقس الحالي</div>
                        <div className="font-black text-sm text-slate-900 dark:text-white">{weather.condition}</div>
                      </div>
                    </div>
                    <div className="text-left">
                      <div className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">
                        {weather.temp}°م
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                        المحسوسة: {weather.feelsLike}°م
                      </div>
                    </div>
                  </div>

                  {/* Detailed Metrics Grid (معلومات أكثر عن الطقس) */}
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    {/* Feels Like */}
                    <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-medium">
                        <Thermometer className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                        <span>المحسوسة</span>
                      </span>
                      <span className="font-extrabold text-slate-900 dark:text-white tabular-nums">
                        {weather.feelsLike}°م
                      </span>
                    </div>

                    {/* Relative Humidity */}
                    <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-medium">
                        <Droplets className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                        <span>الرطوبة</span>
                      </span>
                      <span className="font-extrabold text-slate-900 dark:text-white tabular-nums">
                        {weather.humidity}%
                      </span>
                    </div>

                    {/* Wind Speed */}
                    <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-medium">
                        <Wind className="w-3.5 h-3.5 text-teal-500 shrink-0" />
                        <span>الرياح</span>
                      </span>
                      <span className="font-extrabold text-slate-900 dark:text-white tabular-nums">
                        {weather.windSpeed} كم/س
                      </span>
                    </div>

                    {/* Precipitation */}
                    <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-medium">
                        <CloudRain className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <span>الهطول</span>
                      </span>
                      <span className="font-extrabold text-slate-900 dark:text-white tabular-nums">
                        {weather.precipitation} ملم
                      </span>
                    </div>
                  </div>

                  {/* Tomorrow's Forecast Card with Circular Badge (المتوقع ليوم غدا بدائرة صغيرة) */}
                  <div className="p-2.5 rounded-xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200/70 dark:border-sky-800/50 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      {/* Circular Tomorrow Indicator */}
                      <div className="w-9 h-9 rounded-full bg-white dark:bg-slate-800 border border-sky-300 dark:border-sky-700/80 shadow-2xs flex items-center justify-center shrink-0">
                        {renderWeatherIcon(weather.tomorrow.weatherCode, true, "w-4 h-4 text-sky-600 dark:text-sky-400")}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-bold text-sky-900 dark:text-sky-200">
                          <span>المتوقع ليوم غد</span>
                          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                            ({weather.tomorrow.condition})
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">
                          أجواء مستقرة في تكريت والعلم
                        </div>
                      </div>
                    </div>

                    <div className="text-left shrink-0">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-black text-amber-700 dark:text-amber-400 tabular-nums">
                          {weather.tomorrow.tempMax}°
                        </span>
                        <span className="text-slate-300 dark:text-slate-600">/</span>
                        <span className="text-xs font-bold text-sky-700 dark:text-sky-400 tabular-nums">
                          {weather.tomorrow.tempMin}°
                        </span>
                      </div>
                      <div className="text-[9px] text-slate-400">عظمى / صغرى</div>
                    </div>
                  </div>

                  {/* Smart Cache & Source Footer */}
                  <div className="flex items-center justify-between text-[9px] text-slate-400 dark:text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-800">
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                      كاش ذكي مفعّل · Open-Meteo
                    </span>
                    {weather.lastUpdated && <span>آخر تحديث: {weather.lastUpdated}</span>}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Date Capsule */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700/80 rounded-full text-xs font-bold text-slate-700 dark:text-slate-300 shadow-2xs">
            <Calendar className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
            <span className="tabular-nums">{todayFormatted}</span>
          </div>
        </div>

        {/* Separator Line */}
        <div className="h-5 w-[1px] bg-slate-200 dark:bg-slate-800 mx-0.5 hidden sm:block" />

        {/* Action Icon Buttons */}
        <div className="flex items-center gap-1.5">
          {/* Manual Sync Button */}
          {onSync && (
            <button
              onClick={handleSyncClick}
              disabled={isSyncing}
              className="w-9 h-9 rounded-xl border border-sky-200 dark:border-sky-800/80 bg-sky-50/90 dark:bg-sky-950/40 hover:bg-sky-100 dark:hover:bg-sky-900/60 flex items-center justify-center text-sky-600 dark:text-sky-400 transition-all shadow-2xs active:scale-95 cursor-pointer disabled:opacity-70"
              title="مزامنة وتحديث البيانات الآن"
              aria-label="مزامنة وتحديث البيانات"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-sky-700 dark:text-sky-300' : ''}`} />
            </button>
          )}

          {/* Dark / Light Mode Toggle */}
          <button
            onClick={onToggleDark}
            className="w-9 h-9 rounded-xl border border-slate-200/90 dark:border-slate-700/80 bg-white dark:bg-slate-800/90 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 transition-all shadow-2xs active:scale-95 cursor-pointer"
            title={isDark ? 'التبديل إلى الوضع النهاري' : 'التبديل إلى الوضع الليلي'}
            aria-label="تبديل مظهر العرض"
          >
            {isDark ? (
              <Sun className="w-4 h-4 text-amber-400 animate-in zoom-in spin-in-180 duration-300" />
            ) : (
              <Moon className="w-4 h-4 text-slate-700 animate-in zoom-in spin-in-180 duration-300" />
            )}
          </button>

          {/* Logout Button */}
          {onLogout && (
            <button
              onClick={onLogout}
              className="w-9 h-9 rounded-xl border border-red-200/90 dark:border-red-900/80 bg-red-50/80 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/60 flex items-center justify-center text-red-600 dark:text-red-400 transition-all shadow-2xs active:scale-95 cursor-pointer"
              title="تسجيل الخروج والعودة إلى صفحة الدخول"
              aria-label="تسجيل الخروج"
            >
              <LogOut className="w-4 h-4 rotate-180" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

