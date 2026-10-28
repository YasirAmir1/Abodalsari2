import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Trophy,
  Flame,
  Clock,
  Calendar,
  CheckCircle2,
  RefreshCw,
  Search,
  Key,
  AlertCircle,
  ExternalLink,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Shield,
  Activity,
  Layers,
  Sparkles,
  Info,
  Check,
  Bell,
  BellRing,
  BellOff,
  Volume2,
  VolumeX,
  Radio,
  Tv,
  X
} from 'lucide-react';
import {
  CompetitionMeta,
  FootballMatch,
  FootballMatchStatus,
  FootballStandingRow
} from '../types/football';
import {
  footballService,
  SUPPORTED_LEAGUES,
  getArabicTeamName
} from '../services/footballService';
import { soundService } from '../services/soundService';

export const SportsView: React.FC = () => {
  // Navigation tabs within Sports module
  const [activeTab, setActiveTab] = useState<'matches' | 'standings'>('matches');

  // Matches State
  const [matches, setMatches] = useState<FootballMatch[]>([]);
  const [matchFilter, setMatchFilter] = useState<'all' | 'live' | 'upcoming' | 'finished' | 'subscribed'>('all');
  const [matchSearch, setMatchSearch] = useState('');
  const [liveMatchSearch, setLiveMatchSearch] = useState('');
  const [selectedLeagueFilter, setSelectedLeagueFilter] = useState<string>('all');
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [isRefreshingScores, setIsRefreshingScores] = useState(false);
  const [matchesError, setMatchesError] = useState<string | null>(null);
  const [isMatchesCached, setIsMatchesCached] = useState(false);

  // Standings State
  const [standings, setStandings] = useState<FootballStandingRow[]>([]);
  const [currentLeague, setCurrentLeague] = useState<CompetitionMeta>(SUPPORTED_LEAGUES[0]);
  const [loadingStandings, setLoadingStandings] = useState(false);
  const [standingsError, setStandingsError] = useState<string | null>(null);
  const [isStandingsCached, setIsStandingsCached] = useState(false);

  // Settings / API Token Modal
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [tokenSaveSuccess, setTokenSaveSuccess] = useState(false);

  // Rate Limiting & Auto Refresh
  const [rateLimitInfo, setRateLimitInfo] = useState(() => footballService.getRateLimitStatus());
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  // Match Alerts & Notifications State
  const [subscribedMatchIds, setSubscribedMatchIds] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem('alsari_football_alerts');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    return Notification.permission;
  });

  const [alertsSoundEnabled, setAlertsSoundEnabled] = useState(true);

  // Active in-app notification banner
  const [activeToast, setActiveToast] = useState<{
    id: string;
    title: string;
    body: string;
    type: 'goal' | 'kickoff' | 'finish' | 'info';
    time: string;
    match?: FootballMatch;
  } | null>(null);

  // Snapshot ref of previous matches to compare score/status changes
  const prevMatchesSnapshotRef = useRef<Map<number, { home: number | null; away: number | null; status: FootballMatchStatus }>>(new Map());

  // Trigger Alert notification (browser + in-app toast + sound)
  const triggerMatchAlert = useCallback(
    (
      title: string,
      body: string,
      type: 'goal' | 'kickoff' | 'finish' | 'info',
      match?: FootballMatch
    ) => {
      // 1. Play Sound
      if (alertsSoundEnabled) {
        if (type === 'kickoff' || type === 'finish') {
          soundService.playFootballWhistle();
        } else if (type === 'goal') {
          soundService.playGoalFanfare();
        } else {
          soundService.playSuccess();
        }
      }

      // 2. Set In-App Toast
      const nowStr = new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
      setActiveToast({
        id: Math.random().toString(36).substring(2, 9),
        title,
        body,
        type,
        time: nowStr,
        match,
      });

      // 3. Dispatch Browser Notification if supported and granted
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        try {
          const n = new Notification(title, {
            body,
            icon: 'https://cdn-icons-png.flaticon.com/512/53/53283.png',
            tag: `match-alert-${Date.now()}`,
            dir: 'rtl',
            lang: 'ar',
          });
          setTimeout(() => {
            try {
              n.close();
            } catch {}
          }, 8000);
        } catch (e) {
          console.warn('Browser notification error:', e);
        }
      }
    },
    [alertsSoundEnabled]
  );

  // Request browser permission explicitly
  const requestBrowserPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      triggerMatchAlert(
        'المتصفح لا يدعم الإشعارات ⚠️',
        'لا يدعم هذا المتصفح إشعارات النظام، لكن التنبيهات الصوتية والمرئية داخل التطبيق مفعلة بالكامل.',
        'info'
      );
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      setNotificationPermission(perm);
      if (perm === 'granted') {
        triggerMatchAlert(
          'تم تفعيل إشعارات المتصفح بنجاح! 🔔',
          'ستصلك الآن إشعارات فورية عند انطلاق المباريات وتسجيل الأهداف.',
          'info'
        );
      } else if (perm === 'denied') {
        triggerMatchAlert(
          'تم رفض إذن الإشعارات ⚠️',
          'يرجى السماح بالإشعارات من شريط عنوان المتصفح، ومع ذلك ستعمل التنبيهات الصوتية والشاشية بالكامل.',
          'info'
        );
      }
    } catch (e) {
      console.warn(e);
    }
  };

  // Helper to ensure team name is always in Arabic
  const formatTeamName = (team?: { name?: string; shortName?: string; arabicName?: string }): string => {
    if (!team) return 'فريق';
    if (team.arabicName && /[\u0600-\u06FF]/.test(team.arabicName)) return team.arabicName;
    return getArabicTeamName(team.name || '', team.shortName);
  };

  // Toggle alert subscription for a match
  const toggleMatchAlert = async (match: FootballMatch) => {
    const isCurrentlySubscribed = subscribedMatchIds.includes(match.id);
    const homeName = formatTeamName(match.homeTeam);
    const awayName = formatTeamName(match.awayTeam);

    if (isCurrentlySubscribed) {
      const updated = subscribedMatchIds.filter((id) => id !== match.id);
      setSubscribedMatchIds(updated);
      try {
        localStorage.setItem('alsari_football_alerts', JSON.stringify(updated));
      } catch {}
      triggerMatchAlert(
        'تم إيقاف التنبيه 🔕',
        `تم إلغاء متابعة تنبيهات مباراة ${homeName} ضد ${awayName}`,
        'info'
      );
    } else {
      let perm = notificationPermission;
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'default') {
          try {
            perm = await Notification.requestPermission();
            setNotificationPermission(perm);
          } catch (e) {
            console.warn(e);
          }
        } else {
          perm = Notification.permission;
        }
      }

      const updated = [...subscribedMatchIds, match.id];
      setSubscribedMatchIds(updated);
      try {
        localStorage.setItem('alsari_football_alerts', JSON.stringify(updated));
      } catch {}

      if (perm === 'granted') {
        triggerMatchAlert(
          'تم تفعيل تنبيه المباراة 🔔⚽',
          `ستصلك إشعارات المتصفح وصوت التنبيه عند انطلاق المباراة وتسجيل الأهداف (${homeName} ضد ${awayName})`,
          'info',
          match
        );
      } else {
        triggerMatchAlert(
          'تم تفعيل التنبيه المباشر 🔔',
          `ستصلك أصوات الأهداف والصفارات ولافتات الإشعار داخل التطبيق لمباراة ${homeName} ضد ${awayName}`,
          'info',
          match
        );
      }
    }
  };

  // Auto-hide in-app toast
  useEffect(() => {
    if (!activeToast) return;
    const timer = setTimeout(() => {
      setActiveToast(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [activeToast]);

  // Monitor score and status changes for subscribed matches
  useEffect(() => {
    if (matches.length === 0) return;
    const prevMap = prevMatchesSnapshotRef.current;

    // First load: populate snapshot without false alarms
    if (prevMap.size === 0) {
      matches.forEach((m) => {
        prevMap.set(m.id, {
          home: m.score.fullTime.home,
          away: m.score.fullTime.away,
          status: m.status,
        });
      });
      return;
    }

    matches.forEach((m) => {
      const prev = prevMap.get(m.id);
      const isSubscribed = subscribedMatchIds.includes(m.id);

      if (isSubscribed && prev) {
        const homeName = formatTeamName(m.homeTeam);
        const awayName = formatTeamName(m.awayTeam);
        const compName = m.competition?.arabicName || m.competition?.name || '';

        // 1. Kickoff detection
        const wasUpcoming = isMatchUpcoming(prev.status);
        const isNowLive = isMatchLive(m.status);
        if (wasUpcoming && isNowLive) {
          triggerMatchAlert(
            `⚽ انطلقت المباراة: ${homeName} ضد ${awayName}`,
            `صافرة البداية أعلنت انطلاق اللقاء${compName ? ` في ${compName}` : ''}! تابع مجريات المباراة مباشرة.`,
            'kickoff',
            m
          );
        }

        // 2. Goal detection (Home team)
        if (prev.home !== null && m.score.fullTime.home !== null && m.score.fullTime.home > prev.home) {
          triggerMatchAlert(
            `⚽ هـــــدف! لصالح ${homeName}`,
            `النتيجة الحالية: ${homeName} ${m.score.fullTime.home} - ${m.score.fullTime.away ?? 0} ${awayName}`,
            'goal',
            m
          );
        }

        // 2. Goal detection (Away team)
        if (prev.away !== null && m.score.fullTime.away !== null && m.score.fullTime.away > prev.away) {
          triggerMatchAlert(
            `⚽ هـــــدف! لصالح ${awayName}`,
            `النتيجة الحالية: ${homeName} ${m.score.fullTime.home ?? 0} - ${m.score.fullTime.away} ${awayName}`,
            'goal',
            m
          );
        }

        // 3. Final whistle
        if (isMatchLive(prev.status) && isMatchFinished(m.status)) {
          triggerMatchAlert(
            `🏁 نهاية المباراة: ${homeName} ضد ${awayName}`,
            `انتهت المباراة بنتيجة: ${homeName} ${m.score.fullTime.home ?? 0} - ${m.score.fullTime.away ?? 0} ${awayName}`,
            'finish',
            m
          );
        }
      }

      // Update snapshot
      prevMap.set(m.id, {
        home: m.score.fullTime.home,
        away: m.score.fullTime.away,
        status: m.status,
      });
    });
  }, [matches, subscribedMatchIds, triggerMatchAlert]);

  // Test Goal Alert
  const testGoalNotification = () => {
    triggerMatchAlert(
      '⚽ هـــــدف تجريبي! (ريال مدريد 1 - 0 برشلونة)',
      'هذا اختبار لتنبيهات تسجيل الأهداف وصوت الاحتفال وإشعارات المتصفح.',
      'goal'
    );
  };

  // Test Kickoff Alert
  const testKickoffNotification = () => {
    triggerMatchAlert(
      '📢 صافرة البداية تجريبية!',
      'انطلقت المباراة الآن! هذا اختبار لصوت الصافرة وإشعارات بدء المباراة.',
      'kickoff'
    );
  };

  // Initialize API token input
  useEffect(() => {
    setTokenInput(footballService.getApiKey());
  }, []);

  // Update Rate Limit info periodically
  useEffect(() => {
    const timer = setInterval(() => {
      setRateLimitInfo(footballService.getRateLimitStatus());
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  // Load Matches (silent background refresh avoids unmounting the grid, preserving scroll position)
  const loadMatchesData = useCallback(async (force = false, isBackground = false) => {
    if (isBackground) {
      setIsRefreshingScores(true);
    } else {
      setLoadingMatches(true);
    }
    setMatchesError(null);
    try {
      const res = await footballService.getTodayMatches(force);
      setMatches(res.matches || []);
      setIsMatchesCached(res.isFromCache);
      if (res.error) {
        setMatchesError(res.error);
      }
      setLastUpdated(new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }));
    } catch (err: any) {
      setMatchesError(err.message || 'تعذر تحميل مباريات اليوم');
    } finally {
      setLoadingMatches(false);
      setIsRefreshingScores(false);
      setRateLimitInfo(footballService.getRateLimitStatus());
    }
  }, []);

  // Load Standings
  const loadStandingsData = useCallback(async (leagueCode: string, force = false) => {
    setLoadingStandings(true);
    setStandingsError(null);
    try {
      const res = await footballService.getLeagueStandings(leagueCode, force);
      setStandings(res.standings || []);
      if (res.competition) {
        setCurrentLeague(res.competition);
      }
      setIsStandingsCached(res.isFromCache);
      if (res.error) {
        setStandingsError(res.error);
      }
    } catch (err: any) {
      setStandingsError(err.message || 'تعذر تحميل جدول الترتيب');
    } finally {
      setLoadingStandings(false);
      setRateLimitInfo(footballService.getRateLimitStatus());
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadMatchesData(false);
    loadStandingsData('PL', false);
  }, [loadMatchesData, loadStandingsData]);

  // Handle league change
  const handleSelectLeague = (league: CompetitionMeta) => {
    setCurrentLeague(league);
    loadStandingsData(league.code, false);
  };

  // Auto-refresh interval (every 45s if enabled, silent background update to preserve scroll)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      if (activeTab === 'matches') {
        loadMatchesData(true, true);
      } else {
        loadStandingsData(currentLeague.code, true);
      }
    }, 45000);
    return () => clearInterval(interval);
  }, [autoRefresh, activeTab, currentLeague.code, loadMatchesData, loadStandingsData]);

  // Token save
  const handleSaveToken = () => {
    footballService.setApiKey(tokenInput);
    setTokenSaveSuccess(true);
    setTimeout(() => {
      setTokenSaveSuccess(false);
      setShowTokenModal(false);
      // Reload active tab
      if (activeTab === 'matches') {
        loadMatchesData(true);
      } else {
        loadStandingsData(currentLeague.code, true);
      }
    }, 1000);
  };

  // Helper match status classification (prominently features "LIVE", "IN_PLAY", or "PAUSED")
  const isMatchLive = (status: string) => {
    const s = (status || '').toUpperCase();
    return s === 'LIVE' || s === 'IN_PLAY' || s === 'PAUSED' || s === 'EXTRA_TIME' || s === 'PENALTY_SHOOTOUT';
  };

  const isMatchUpcoming = (status: string) => {
    const s = (status || '').toUpperCase();
    return s === 'TIMED' || s === 'SCHEDULED' || s === 'CALENDAR';
  };

  const isMatchFinished = (status: string) => {
    const s = (status || '').toUpperCase();
    return s === 'FINISHED' || s === 'AWARDED';
  };

  // Filtered & Prioritized Matches (LIVE matches always sorted to the top)
  const filteredMatches = useMemo(() => {
    const q = matchSearch.trim().toLowerCase();
    const result = matches.filter((m) => {
      // Status filter
      if (matchFilter === 'live' && !isMatchLive(m.status)) return false;
      if (matchFilter === 'upcoming' && !isMatchUpcoming(m.status)) return false;
      if (matchFilter === 'finished' && !isMatchFinished(m.status)) return false;
      if (matchFilter === 'subscribed' && !subscribedMatchIds.includes(m.id)) return false;

      // League filter
      if (selectedLeagueFilter !== 'all' && m.competition?.code !== selectedLeagueFilter) {
        return false;
      }

      // Search filter
      if (q) {
        const homeAr = formatTeamName(m.homeTeam).toLowerCase();
        const awayAr = formatTeamName(m.awayTeam).toLowerCase();
        const homeEn = (m.homeTeam.name || '').toLowerCase();
        const awayEn = (m.awayTeam.name || '').toLowerCase();
        const comp = (m.competition?.name || '').toLowerCase();
        const compAr = (m.competition?.arabicName || '').toLowerCase();
        const ch = (m.channel || '').toLowerCase();
        return (
          homeAr.includes(q) ||
          awayAr.includes(q) ||
          homeEn.includes(q) ||
          awayEn.includes(q) ||
          comp.includes(q) ||
          compAr.includes(q) ||
          ch.includes(q)
        );
      }

      return true;
    });

    // Technical Requirement 1: Live matches (LIVE, IN_PLAY, PAUSED) appear at the very top
    return result.sort((a, b) => {
      const aLive = isMatchLive(a.status);
      const bLive = isMatchLive(b.status);
      if (aLive && !bLive) return -1;
      if (!aLive && bLive) return 1;

      // Both live: sort by minute descending
      if (aLive && bLive) {
        return (b.minute || 0) - (a.minute || 0);
      }

      // Upcoming before finished
      const aUpcoming = isMatchUpcoming(a.status);
      const bUpcoming = isMatchUpcoming(b.status);
      if (aUpcoming && !bUpcoming) return -1;
      if (!aUpcoming && bUpcoming) return 1;

      // Same status: order chronologically
      return new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime();
    });
  }, [matches, matchFilter, selectedLeagueFilter, matchSearch, subscribedMatchIds]);

  // Live matches in progress
  const liveMatches = useMemo(() => {
    return matches.filter((m) => isMatchLive(m.status));
  }, [matches]);

  // Filtered live matches based on quick search inside the live matches list
  const filteredLiveMatches = useMemo(() => {
    const q = liveMatchSearch.trim().toLowerCase();
    if (!q) return liveMatches;
    return liveMatches.filter((m) => {
      const homeAr = formatTeamName(m.homeTeam).toLowerCase();
      const awayAr = formatTeamName(m.awayTeam).toLowerCase();
      const homeEn = (m.homeTeam.name || '').toLowerCase();
      const awayEn = (m.awayTeam.name || '').toLowerCase();
      const homeShort = (m.homeTeam.shortName || '').toLowerCase();
      const awayShort = (m.awayTeam.shortName || '').toLowerCase();
      const comp = (m.competition?.name || '').toLowerCase();
      const compAr = (m.competition?.arabicName || '').toLowerCase();
      return (
        homeAr.includes(q) ||
        awayAr.includes(q) ||
        homeEn.includes(q) ||
        awayEn.includes(q) ||
        homeShort.includes(q) ||
        awayShort.includes(q) ||
        comp.includes(q) ||
        compAr.includes(q)
      );
    });
  }, [liveMatches, liveMatchSearch]);

  // Next upcoming match for fallback UI
  const nextUpcomingMatch = useMemo(() => {
    const upcoming = matches
      .filter((m) => isMatchUpcoming(m.status))
      .sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime());
    return upcoming.length > 0 ? upcoming[0] : null;
  }, [matches]);

  // Match Counts
  const matchCounts = useMemo(() => {
    let live = 0;
    let upcoming = 0;
    let finished = 0;
    matches.forEach((m) => {
      if (isMatchLive(m.status)) live++;
      else if (isMatchUpcoming(m.status)) upcoming++;
      else if (isMatchFinished(m.status)) finished++;
    });
    return { all: matches.length, live, upcoming, finished, subscribed: subscribedMatchIds.length };
  }, [matches, subscribedMatchIds.length]);

  // Format Match Time in Arabic
  const formatMatchTime = (utcDateStr: string) => {
    try {
      const d = new Date(utcDateStr);
      return d.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Top Hero Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-sky-950 to-indigo-950 dark:from-[#060B18] dark:via-sky-950/70 dark:to-[#080E24] rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-sky-800/40">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-72 h-72 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-12 -ml-12 w-72 h-72 bg-sky-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                تحديثات كروية مباشرة
              </span>

              {matchCounts.live > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/25 text-rose-300 border border-rose-500/30 animate-pulse">
                  <Flame className="w-3.5 h-3.5 text-rose-400" />
                  {matchCounts.live} مباراة جارية الآن
                </span>
              )}

              <span className="text-xs font-semibold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 rounded-full backdrop-blur-xs flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>مفتاح المباريات الحية متصل</span>
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              <span>المباريات المباشرة والنتائج</span>
              <Trophy className="w-7 h-7 text-amber-400" />
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              تابع نتائج مباريات اليوم وجداول ترتيب كبرى الدوريات الأوروبية والعالمية لحظة بلحظة مع إحصائيات الأهداف وفوارق النقاط.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* Auto Refresh Toggle */}
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border ${
                autoRefresh
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-xs'
                  : 'bg-white/10 hover:bg-white/15 text-slate-300 border-white/10'
              }`}
              title="تفعيل التحديث التلقائي كل دقيقة"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${autoRefresh ? 'animate-spin text-emerald-400' : ''}`} />
              <span>تحديث تلقائي</span>
              {autoRefresh && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
            </button>

            {/* Manual Refresh */}
            <button
              onClick={() => {
                if (activeTab === 'matches') loadMatchesData(true, matches.length > 0);
                else loadStandingsData(currentLeague.code, true);
              }}
              disabled={loadingMatches || isRefreshingScores || loadingStandings || !rateLimitInfo.allowed}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white transition-all flex items-center gap-1.5 border border-white/10 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
              title={rateLimitInfo.allowed ? 'تحديث البيانات' : `انتظر ${rateLimitInfo.waitSeconds} ثانية`}
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${
                  loadingMatches || isRefreshingScores || loadingStandings ? 'animate-spin' : ''
                }`}
              />
              <span>{isRefreshingScores ? 'جاري التحديث...' : 'تحديث'}</span>
              {!rateLimitInfo.allowed && (
                <span className="text-[10px] text-amber-300 font-mono">
                  ({rateLimitInfo.waitSeconds}ث)
                </span>
              )}
            </button>

            {/* API Key Configuration */}
            <button
              onClick={() => setShowTokenModal(true)}
              className="p-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white transition-all border border-white/10 cursor-pointer"
              title="إعدادات مفتاح API"
            >
              <Key className="w-4 h-4 text-amber-300" />
            </button>
          </div>
        </div>

        {/* Status / Rate limit Bar */}
        <div className="mt-5 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between text-xs text-slate-300 gap-2">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${rateLimitInfo.allowed ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
              <span>الحد المجاني للطلبات:</span>
              <strong className="font-mono text-white">{rateLimitInfo.remainingCalls} / 10</strong>
              <span className="text-slate-400 text-[11px]">(بالدقيقة)</span>
            </span>

            {lastUpdated && (
              <span className="text-slate-400">
                آخر تحديث: <span className="font-mono text-slate-200">{lastUpdated}</span>
              </span>
            )}

            {isRefreshingScores && (
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-300 bg-emerald-950/70 border border-emerald-500/40 px-2.5 py-0.5 rounded-full font-bold animate-pulse">
                <RefreshCw className="w-3 h-3 animate-spin text-emerald-400" />
                <span>جاري تحديث النتائج المباشرة لحظياً...</span>
              </span>
            )}
          </div>

          {(isMatchesCached || isStandingsCached) && (
            <span className="text-xs text-sky-300/90 bg-sky-950/40 border border-sky-800/40 px-2.5 py-0.5 rounded-full">
              بيانات مخزنة مؤقتاً لتوفير استهلاك الـ API
            </span>
          )}
        </div>
      </div>

      {/* Main Tabs Navigation: Matches vs Standings */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-[#070D1E] p-2 rounded-2xl border border-slate-200 dark:border-[#141D34] shadow-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('matches')}
            className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'matches'
                ? 'bg-gradient-to-r from-sky-600 to-indigo-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>مباريات اليوم</span>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                activeTab === 'matches'
                  ? 'bg-white/20 text-white font-black'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              {matches.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('standings')}
            className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'standings'
                ? 'bg-gradient-to-r from-sky-600 to-indigo-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50'
            }`}
          >
            <Trophy className="w-4 h-4 text-amber-400" />
            <span>جدول الترتيب</span>
            <span className="text-[10px] font-sans px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-300 font-bold">
              {currentLeague.arabicName.split(' ')[0]}
            </span>
          </button>
        </div>

        {/* Global info note */}
        <div className="text-[11px] text-slate-500 dark:text-slate-400 px-2 flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-sky-500 shrink-0" />
          <span>توقيت المباريات معروض بتوقيت بغداد والمحلي</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: TODAY'S MATCHES (مباريات اليوم)                                    */}
      {/* ========================================================================= */}
      {activeTab === 'matches' && (
        <div className="space-y-4">
          {/* Sub Filters & Search Toolbar */}
          <div className="bg-white dark:bg-[#070D1E] p-4 rounded-2xl border border-slate-200 dark:border-[#141D34] shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Status Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none">
              <button
                onClick={() => setMatchFilter('all')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  matchFilter === 'all'
                    ? 'bg-slate-900 text-white dark:bg-sky-600 dark:text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                الكل ({matchCounts.all})
              </button>

              <button
                onClick={() => setMatchFilter('live')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-2 cursor-pointer ${
                  matchFilter === 'live'
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-600/40 ring-2 ring-rose-400/50 font-black'
                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-300/80 dark:border-rose-900/60 font-black'
                }`}
                title="فلترة وعرض المباريات الجارية الآن فقط"
              >
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
                </span>
                <span>🔴 مباشر / LIVE ({matchCounts.live})</span>
              </button>

              <button
                onClick={() => setMatchFilter('upcoming')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  matchFilter === 'upcoming'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                القادمة ({matchCounts.upcoming})
              </button>

              <button
                onClick={() => setMatchFilter('finished')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  matchFilter === 'finished'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                المنتهية ({matchCounts.finished})
              </button>

              <button
                onClick={() => setMatchFilter('subscribed')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                  matchFilter === 'subscribed'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/60 border border-amber-200/60 dark:border-amber-900/40'
                }`}
                title="عرض المباريات التي قمت بتفعيل التنبيه لها"
              >
                <Bell className="w-3.5 h-3.5" />
                <span>المُنبّه عليها ({matchCounts.subscribed})</span>
              </button>
            </div>

            {/* Search Input & League Filter */}
            <div className="flex items-center gap-2.5 w-full md:w-auto">
              <div className="relative flex-1 md:w-60">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={matchSearch}
                  onChange={(e) => setMatchSearch(e.target.value)}
                  placeholder="ابحث عن فريق أو بطولة..."
                  className="w-full pl-3 pr-9 py-2 text-xs bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <select
                value={selectedLeagueFilter}
                onChange={(e) => setSelectedLeagueFilter(e.target.value)}
                className="py-2 px-3 text-xs bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-700 dark:text-slate-300 focus:outline-hidden focus:ring-2 focus:ring-sky-500 cursor-pointer"
              >
                <option value="all">كافة الدوريات</option>
                {SUPPORTED_LEAGUES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.arabicName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Notifications Status & Quick Test Bar */}
          <div className="bg-gradient-to-r from-amber-500/10 via-sky-500/10 to-indigo-500/10 dark:from-amber-950/25 dark:via-sky-950/25 dark:to-indigo-950/25 p-3.5 sm:p-4 rounded-2xl border border-amber-500/25 dark:border-amber-500/20 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <BellRing className="w-4 h-4" />
              </span>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-slate-900 dark:text-white">نظام تنبيهات المباريات:</span>
                  <span className="text-slate-600 dark:text-slate-300 text-[11px] sm:text-xs">
                    اضغط زر <strong className="text-amber-600 dark:text-amber-400 font-bold">"تنبيه"</strong> بجانب أي مباراة لإشعارك عند انطلاقها وتسجيل الأهداف.
                  </span>
                </div>
                <div className="flex items-center gap-2.5 mt-1 text-[11px] text-slate-500 dark:text-slate-400 flex-wrap">
                  <span className="flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        notificationPermission === 'granted'
                          ? 'bg-emerald-500'
                          : notificationPermission === 'denied'
                          ? 'bg-rose-500'
                          : 'bg-amber-500'
                      }`}
                    />
                    <span>
                      إشعارات المتصفح:{' '}
                      <strong className="text-slate-700 dark:text-slate-200">
                        {notificationPermission === 'granted'
                          ? 'مفعلة'
                          : notificationPermission === 'denied'
                          ? 'محظورة بالمتصفح'
                          : 'بانتظار الإذن'}
                      </strong>
                    </span>
                  </span>
                  <span>•</span>
                  <span>
                    المباريات المنبهة:{' '}
                    <strong className="text-amber-600 dark:text-amber-400 font-mono font-bold">
                      {subscribedMatchIds.length}
                    </strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions & Tests */}
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              {notificationPermission !== 'granted' && (
                <button
                  type="button"
                  onClick={requestBrowserPermission}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Bell className="w-3.5 h-3.5" />
                  <span>تفعيل إذن المتصفح</span>
                </button>
              )}

              {/* Sound Toggle */}
              <button
                type="button"
                onClick={() => setAlertsSoundEnabled(!alertsSoundEnabled)}
                className={`p-1.5 px-2.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer ${
                  alertsSoundEnabled
                    ? 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 border-rose-200 dark:border-rose-900/50'
                }`}
                title={alertsSoundEnabled ? 'كتم أصوات المباريات' : 'تشغيل أصوات المباريات'}
              >
                {alertsSoundEnabled ? (
                  <>
                    <Volume2 className="w-3.5 h-3.5 text-sky-500" />
                    <span>الصوت مفعّل</span>
                  </>
                ) : (
                  <>
                    <VolumeX className="w-3.5 h-3.5 text-rose-500" />
                    <span>مكتوم</span>
                  </>
                )}
              </button>

              {/* Test Goal Sound & Notification */}
              <button
                type="button"
                onClick={testGoalNotification}
                className="px-2.5 py-1.5 bg-white dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 transition-all flex items-center gap-1 cursor-pointer"
                title="اختبار إشعار وصوت تسجيل هدف"
              >
                <span>⚽</span>
                <span>اختبار هدف</span>
              </button>

              {/* Test Kickoff Whistle */}
              <button
                type="button"
                onClick={testKickoffNotification}
                className="px-2.5 py-1.5 bg-white dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 transition-all flex items-center gap-1 cursor-pointer"
                title="اختبار إشعار وصوت صافرة البداية"
              >
                <span>📢</span>
                <span>اختبار صافرة</span>
              </button>
            </div>
          </div>

          {/* Error / Rate limit Notice if any */}
          {matchesError && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-start gap-3 text-xs text-amber-700 dark:text-amber-300">
              <AlertCircle className="w-5 h-5 shrink-0 text-amber-500 mt-0.5" />
              <div>
                <p className="font-bold">تنبيه اتصال API:</p>
                <p className="mt-0.5 leading-relaxed">{matchesError}</p>
                <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
                  تم عرض أحدث مباريات مسجلة ومحفوظة مؤقتاً لضمان استمرار المشاهدة.
                </p>
              </div>
            </div>
          )}

          {/* Loading Indicator */}
          {loadingMatches && (
            <div className="flex items-center justify-center py-12 text-slate-500 dark:text-slate-400 gap-2 text-xs">
              <RefreshCw className="w-4 h-4 animate-spin text-sky-500" />
              <span>جاري تحديث مواعيد ونتائج المباريات...</span>
            </div>
          )}

          {/* Featured Live Matches Showcase (المباريات الجارية الآن 🔴) */}
          {liveMatches.length > 0 && matchFilter !== 'finished' && matchFilter !== 'upcoming' && (
            <div className="bg-gradient-to-r from-rose-950/40 via-slate-900/80 to-purple-950/40 dark:from-rose-950/60 dark:via-[#070D1E] dark:to-purple-950/50 rounded-3xl p-4 sm:p-5 border-2 border-rose-500/40 shadow-xl shadow-rose-950/20 relative overflow-hidden">
              <div className="absolute top-0 right-0 -mr-10 -mt-10 w-44 h-44 bg-rose-500/10 rounded-full blur-2xl pointer-events-none" />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3.5 pb-3 border-b border-rose-500/20">
                <div className="flex items-center gap-2.5">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500" />
                  </span>
                  <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                    <span>المباريات المباشرة الجارية الآن</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-600 text-white font-mono font-bold">
                      {liveMatchSearch.trim() ? `${filteredLiveMatches.length} من ${liveMatches.length}` : liveMatches.length} LIVE
                    </span>
                  </h3>
                </div>

                <div className="flex items-center gap-2 text-xs text-rose-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>تحديث النتائج والأهداف فوري وتلقائي</span>
                </div>
              </div>

              {/* Quick Search within Live Matches */}
              <div className="relative mb-3.5">
                <Search className="w-4 h-4 text-rose-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={liveMatchSearch}
                  onChange={(e) => setLiveMatchSearch(e.target.value)}
                  placeholder="بحث سريع باسم النادي أو الفريق في المباريات المباشرة..."
                  className="w-full pr-10 pl-9 py-2 bg-slate-900/90 dark:bg-black/60 border border-rose-500/30 focus:border-rose-400 focus:ring-2 focus:ring-rose-500/30 text-white placeholder-slate-400 text-xs rounded-xl transition-all outline-none"
                />
                {liveMatchSearch && (
                  <button
                    type="button"
                    onClick={() => setLiveMatchSearch('')}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors cursor-pointer p-0.5"
                    title="مسح البحث"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Grid of Live Featured Matches or Empty Search State */}
              {filteredLiveMatches.length === 0 ? (
                <div className="text-center py-7 px-4 bg-slate-900/60 rounded-2xl border border-rose-500/20 text-slate-300 text-xs">
                  <Search className="w-6 h-6 mx-auto mb-2 text-rose-400/70" />
                  <p className="font-bold text-white mb-1">
                    لا توجد مباريات جارية مطابقة لـ "{liveMatchSearch}"
                  </p>
                  <p className="text-[11px] text-slate-400">
                    تأكد من كتابة اسم النادي أو الفريق بشكل صحيح، أو اضغط مسح للعودة لكافة المباريات المباشرة.
                  </p>
                  <button
                    type="button"
                    onClick={() => setLiveMatchSearch('')}
                    className="mt-3 px-3 py-1 bg-rose-600/30 hover:bg-rose-600/50 text-rose-200 border border-rose-500/40 rounded-lg text-xs font-bold transition-all cursor-pointer"
                  >
                    مسح البحث
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {filteredLiveMatches.map((lm) => {
                  const isSub = subscribedMatchIds.includes(lm.id);
                  return (
                    <div
                      key={`featured-${lm.id}`}
                      className="bg-slate-900/90 dark:bg-[#070D1E]/90 border border-rose-500/40 rounded-2xl p-4 shadow-md hover:border-rose-500/70 transition-all"
                    >
                      {/* Top bar: Competition & beIN channel & alert button */}
                      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-white/10 text-xs mb-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-600 text-white animate-pulse shadow-xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                            <span>🔴 LIVE</span>
                            {lm.minute ? (
                              <span className="font-mono bg-black/30 px-1.5 py-0.2 rounded-md text-[10px]">
                                {lm.minute}'
                              </span>
                            ) : lm.status === 'PAUSED' ? (
                              <span className="text-[10px] bg-black/30 px-1 py-0.2 rounded-md">
                                استراحة
                              </span>
                            ) : null}
                          </span>
                          <span className="font-bold text-slate-300 text-[11px] truncate">
                            {lm.competition?.arabicName || lm.competition?.name}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Alert Toggle */}
                          <button
                            type="button"
                            onClick={() => toggleMatchAlert(lm)}
                            className={`p-1.5 rounded-xl border text-xs cursor-pointer transition-all ${
                              isSub
                                ? 'bg-amber-500/20 text-amber-400 border-amber-500/50'
                                : 'bg-white/10 hover:bg-white/20 text-slate-300 border-white/10'
                            }`}
                            title={isSub ? 'التنبيه مفعل' : 'تفعيل التنبيه'}
                          >
                            {isSub ? (
                              <BellRing className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
                            ) : (
                              <Bell className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Teams & Huge Live Score */}
                      <div className="flex items-center justify-between gap-3">
                        {/* Home */}
                        <div className="flex-1 flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-white/10 p-1 flex items-center justify-center shrink-0 border border-white/10">
                            {lm.homeTeam.crest ? (
                              <img src={lm.homeTeam.crest} alt="" className="w-5 h-5 object-contain" />
                            ) : (
                              <Shield className="w-4 h-4 text-slate-400" />
                            )}
                          </div>
                          <span className="font-bold text-sm text-white truncate">
                            {formatTeamName(lm.homeTeam)}
                          </span>
                        </div>

                        {/* Live Score Display */}
                        <div className="flex items-center gap-2 px-3.5 py-1 bg-rose-500/25 border border-rose-500/40 rounded-xl text-rose-300 font-mono text-xl font-black shrink-0 shadow-inner">
                          <span>{lm.score.fullTime.home ?? 0}</span>
                          <span className="text-rose-400/70 text-sm">:</span>
                          <span>{lm.score.fullTime.away ?? 0}</span>
                        </div>

                        {/* Away */}
                        <div className="flex-1 flex items-center justify-end gap-2.5 min-w-0">
                          <span className="font-bold text-sm text-white truncate text-left">
                            {formatTeamName(lm.awayTeam)}
                          </span>
                          <div className="w-8 h-8 rounded-full bg-white/10 p-1 flex items-center justify-center shrink-0 border border-white/10">
                            {lm.awayTeam.crest ? (
                              <img src={lm.awayTeam.crest} alt="" className="w-5 h-5 object-contain" />
                            ) : (
                              <Shield className="w-4 h-4 text-slate-400" />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

          {/* Clean Fallback UI State when filtering for LIVE matches and none are in progress */}
          {!loadingMatches && matchFilter === 'live' && filteredMatches.length === 0 ? (
            <div className="p-8 sm:p-12 text-center bg-white dark:bg-[#070D1E] rounded-3xl border border-slate-200 dark:border-[#141D34] shadow-xs space-y-4">
              <div className="w-16 h-16 mx-auto rounded-3xl bg-rose-50 dark:bg-rose-950/30 flex items-center justify-center text-rose-500 border border-rose-200/50 dark:border-rose-900/40">
                <Radio className="w-8 h-8 animate-pulse" />
              </div>
              <div className="max-w-md mx-auto space-y-1.5">
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  لا توجد مباريات جارية في هذه اللحظة ⚽
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  جميع مباريات اليوم في الدوريات إما قادمة لاحقاً أو انتهت بالفعل. يمكنك تفعيل زر 'تنبيه' للمباريات القادمة لتصلك إشعارات فور انطلاقها.
                </p>
              </div>

              {nextUpcomingMatch && (
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800 text-xs text-sky-800 dark:text-sky-300">
                  <Clock className="w-4 h-4 text-sky-500" />
                  <span>
                    أقرب مباراة قادمة:{' '}
                    <strong>
                      {formatTeamName(nextUpcomingMatch.homeTeam)} ضد{' '}
                      {formatTeamName(nextUpcomingMatch.awayTeam)}
                    </strong>{' '}
                    ({formatMatchTime(nextUpcomingMatch.utcDate)})
                  </span>
                </div>
              )}

              <div>
                <button
                  type="button"
                  onClick={() => setMatchFilter('all')}
                  className="px-4 py-2 bg-slate-900 dark:bg-sky-600 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all shadow-xs cursor-pointer"
                >
                  عرض كافة مباريات اليوم ({matchCounts.all})
                </button>
              </div>
            </div>
          ) : !loadingMatches && filteredMatches.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-[#070D1E] rounded-3xl border border-slate-200 dark:border-[#141D34] shadow-xs">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
                <Calendar className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                لا توجد مباريات مطابقة للفلتر المحدد
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                جرب تغيير تصنيف الفلترة أو تفقد باقي الدوريات لعرض المباريات المجدولة.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMatches.map((m) => {
                const live = isMatchLive(m.status);
                const finished = isMatchFinished(m.status);
                const upcoming = isMatchUpcoming(m.status);
                const isSubscribed = subscribedMatchIds.includes(m.id);

                return (
                  <div
                    key={m.id}
                    className={`relative overflow-hidden rounded-2xl p-4 transition-all border ${
                      live
                        ? 'bg-gradient-to-b from-rose-950/20 via-slate-900/60 to-slate-900/90 dark:from-rose-950/30 dark:via-[#070D1E] dark:to-[#050916] border-rose-500/50 shadow-lg shadow-rose-950/20 ring-1 ring-rose-500/40'
                        : isSubscribed
                        ? 'bg-white dark:bg-[#070D1E] border-amber-500/40 dark:border-amber-500/30 shadow-xs ring-1 ring-amber-500/20'
                        : 'bg-white dark:bg-[#070D1E] border-slate-200/90 dark:border-[#141D34] hover:border-slate-300 dark:hover:border-slate-700 shadow-xs'
                    }`}
                  >
                    {/* Top Competition Bar */}
                    <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800/80 mb-3 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        {m.competition?.emblem ? (
                          <img
                            src={m.competition.emblem}
                            alt=""
                            className="w-5 h-5 object-contain shrink-0"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
                        )}
                        <span className="font-bold text-slate-700 dark:text-slate-300 truncate">
                          {m.competition?.arabicName || m.competition?.name || 'بطولة رسمية'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Alert Subscription Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleMatchAlert(m);
                          }}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all border cursor-pointer ${
                            isSubscribed
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/40 shadow-xs ring-1 ring-amber-500/25'
                              : 'bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:text-amber-600 dark:hover:text-amber-300 hover:border-amber-300 dark:hover:border-amber-700'
                          }`}
                          title={
                            isSubscribed
                              ? 'إلغاء تنبيهات هذه المباراة'
                              : 'تفعيل إشعارات المتصفح عند بدء المباراة أو تسجيل هدف'
                          }
                        >
                          {isSubscribed ? (
                            <>
                              <BellRing className="w-3.5 h-3.5 text-amber-500 animate-bounce" />
                              <span>تنبيه مفعل</span>
                            </>
                          ) : (
                            <>
                              <Bell className="w-3.5 h-3.5" />
                              <span>تنبيه</span>
                            </>
                          )}
                        </button>

                        {/* Distinctive Status Badge */}
                        {live ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black bg-rose-600 text-white shadow-md shadow-rose-600/40 animate-pulse">
                            <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                            <span>🔴 مباشر / LIVE</span>
                            {m.minute ? (
                              <span className="font-mono bg-black/30 px-1.5 py-0.2 rounded-md text-[10px]">
                                {m.minute}'
                              </span>
                            ) : m.status === 'PAUSED' ? (
                              <span className="text-[10px] bg-black/30 px-1.5 py-0.2 rounded-md">
                                استراحة
                              </span>
                            ) : null}
                          </span>
                        ) : finished ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            <span>انتهت</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-400 border border-sky-200/60 dark:border-sky-800/60">
                            <Clock className="w-3 h-3" />
                            <span>{formatMatchTime(m.utcDate)}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Teams & Scores Layout */}
                    <div className="space-y-3">
                      {/* Home Team */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800/80 p-0.5 flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700">
                            {m.homeTeam.crest ? (
                              <img
                                src={m.homeTeam.crest}
                                alt={m.homeTeam.name}
                                className="w-5 h-5 object-contain"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <Shield className="w-4 h-4 text-slate-400" />
                            )}
                          </div>
                          <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                            {formatTeamName(m.homeTeam)}
                          </span>
                        </div>

                        {/* Home Score */}
                        <div
                          className={`font-mono text-base font-black px-2.5 py-0.5 rounded-lg ${
                            live
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-inner'
                              : finished
                              ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
                              : 'text-slate-400'
                          }`}
                        >
                          {m.score.fullTime.home !== null ? m.score.fullTime.home : '-'}
                        </div>
                      </div>

                      {/* Away Team */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800/80 p-0.5 flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700">
                            {m.awayTeam.crest ? (
                              <img
                                src={m.awayTeam.crest}
                                alt={m.awayTeam.name}
                                className="w-5 h-5 object-contain"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <Shield className="w-4 h-4 text-slate-400" />
                            )}
                          </div>
                          <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                            {formatTeamName(m.awayTeam)}
                          </span>
                        </div>

                        {/* Away Score */}
                        <div
                          className={`font-mono text-base font-black px-2.5 py-0.5 rounded-lg ${
                            live
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-inner'
                              : finished
                              ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
                              : 'text-slate-400'
                          }`}
                        >
                          {m.score.fullTime.away !== null ? m.score.fullTime.away : '-'}
                        </div>
                      </div>
                    </div>

                    {/* Bottom Metadata: beIN Sports Channel & Half-time score */}
                    <div className="mt-3.5 pt-2.5 border-t border-slate-100 dark:border-slate-800/70 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* beIN Sports Broadcast Channel */}
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-300/60 dark:border-purple-800/60">
                          <Tv className="w-3 h-3 text-purple-600 dark:text-purple-400 shrink-0" />
                          <span className="font-mono">{m.channel || 'beIN Sports 1 HD'}</span>
                        </span>

                        <span>
                          {m.score.halfTime.home !== null && m.score.halfTime.away !== null ? (
                            <span>
                              الشوط الأول:{' '}
                              <strong className="font-mono text-slate-700 dark:text-slate-300">
                                {m.score.halfTime.home} - {m.score.halfTime.away}
                              </strong>
                            </span>
                          ) : live ? (
                            <span className="text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                              <span>جارية الآن</span>
                            </span>
                          ) : upcoming ? (
                            <span>تبدأ قريباً</span>
                          ) : (
                            <span>الوقت الأصلي</span>
                          )}
                        </span>
                      </div>

                      {m.matchday && (
                        <span className="font-medium bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md text-[10px]">
                          الجولة {m.matchday}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: LEAGUE STANDINGS (جدول الترتيب)                                    */}
      {/* ========================================================================= */}
      {activeTab === 'standings' && (
        <div className="space-y-4">
          {/* League Selector Horizontal Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {SUPPORTED_LEAGUES.map((league) => {
              const isSelected = currentLeague.code === league.code;
              return (
                <button
                  key={league.code}
                  onClick={() => handleSelectLeague(league)}
                  className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 flex items-center gap-2.5 border cursor-pointer ${
                    isSelected
                      ? 'bg-gradient-to-r from-sky-600 to-indigo-600 text-white border-sky-500 shadow-md ring-2 ring-sky-500/20'
                      : 'bg-white dark:bg-[#070D1E] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#141D34] hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <img
                    src={league.emblem}
                    alt=""
                    className="w-5 h-5 object-contain"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <span>{league.arabicName}</span>
                </button>
              );
            })}
          </div>

          {/* Standings Error if any */}
          {standingsError && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-start gap-3 text-xs text-amber-700 dark:text-amber-300">
              <AlertCircle className="w-5 h-5 shrink-0 text-amber-500 mt-0.5" />
              <div>
                <p className="font-bold">تنبيه اتصال:</p>
                <p className="mt-0.5">{standingsError}</p>
              </div>
            </div>
          )}

          {/* Standings Table Card */}
          <div className="bg-white dark:bg-[#070D1E] rounded-3xl border border-slate-200/90 dark:border-[#141D34] shadow-sm overflow-hidden">
            {/* Table Header Details */}
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-[#141D34] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/40">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white dark:bg-slate-800 p-1.5 border border-slate-200 dark:border-slate-700 shadow-xs flex items-center justify-center shrink-0">
                  <img
                    src={currentLeague.emblem}
                    alt={currentLeague.name}
                    className="w-full h-full object-contain"
                  />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <span>{currentLeague.arabicName}</span>
                    <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                      ({currentLeague.country})
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    جدول الترتيب الرسمي والنقاط وفوارق الأهداف لموسم 2024 / 2025
                  </p>
                </div>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-3 text-[11px] text-slate-600 dark:text-slate-400 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <span>دوري أبطال أوروبا (1-4)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span>الدوري الأوروبي</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <span>منطقة الهبوط</span>
                </div>
              </div>
            </div>

            {/* Structured Table */}
            {loadingStandings ? (
              <div className="flex items-center justify-center py-16 text-slate-500 dark:text-slate-400 gap-2 text-xs">
                <RefreshCw className="w-4 h-4 animate-spin text-sky-500" />
                <span>جاري جلب جدول الترتيب والنقاط...</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse min-w-[640px]">
                  <thead>
                    <tr className="border-b border-slate-200/80 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-900/60 uppercase">
                      <th className="py-3 px-3 text-center w-12">#</th>
                      <th className="py-3 px-3">الفريق</th>
                      <th className="py-3 px-2.5 text-center" title="المباريات الملعوبة">
                        لعب
                      </th>
                      <th className="py-3 px-2.5 text-center" title="الفوز">
                        فاز
                      </th>
                      <th className="py-3 px-2.5 text-center" title="التعادل">
                        تعادل
                      </th>
                      <th className="py-3 px-2.5 text-center" title="الخسارة">
                        خسر
                      </th>
                      <th className="py-3 px-2.5 text-center" title="الأهداف له : عليه">
                        له : عليه
                      </th>
                      <th className="py-3 px-2.5 text-center" title="فارق الأهداف">
                        الفارق
                      </th>
                      <th className="py-3 px-3 text-center font-black text-slate-900 dark:text-white" title="مجموع النقاط">
                        النقاط
                      </th>
                      <th className="py-3 px-3 text-center" title="آخر 5 مباريات">
                        النتائج الأخيرة
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                    {standings.map((row) => {
                      // Determine position color accent
                      let rankBadgeClass = 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300';
                      if (row.position <= 4) {
                        rankBadgeClass = 'bg-blue-500/15 text-blue-600 dark:text-blue-400 font-black border border-blue-500/30';
                      } else if (row.position === 5 || row.position === 6) {
                        rankBadgeClass = 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/30';
                      } else if (row.position >= standings.length - 2 && standings.length >= 8) {
                        rankBadgeClass = 'bg-rose-500/15 text-rose-600 dark:text-rose-400 font-bold border border-rose-500/30';
                      }

                      // Form parse
                      const formItems = row.form ? row.form.split(',') : [];

                      return (
                        <tr
                          key={row.team.id || row.position}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          {/* Rank # */}
                          <td className="py-3 px-3 text-center">
                            <span className={`inline-block w-6 h-6 leading-6 text-center rounded-lg text-xs ${rankBadgeClass}`}>
                              {row.position}
                            </span>
                          </td>

                          {/* Team Name and Logo */}
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 p-0.5 flex items-center justify-center shrink-0">
                                {row.team.crest ? (
                                  <img
                                    src={row.team.crest}
                                    alt={row.team.name}
                                    className="w-full h-full object-contain"
                                    onError={(e) => {
                                      (e.target as HTMLElement).style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  <Shield className="w-3.5 h-3.5 text-slate-400" />
                                )}
                              </div>
                              <span className="font-bold text-slate-900 dark:text-slate-100 truncate">
                                {formatTeamName(row.team)}
                              </span>
                            </div>
                          </td>

                          {/* Played */}
                          <td className="py-3 px-2.5 text-center font-mono text-slate-700 dark:text-slate-300">
                            {row.playedGames}
                          </td>

                          {/* Won */}
                          <td className="py-3 px-2.5 text-center font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                            {row.won}
                          </td>

                          {/* Draw */}
                          <td className="py-3 px-2.5 text-center font-mono text-slate-600 dark:text-slate-400">
                            {row.draw}
                          </td>

                          {/* Lost */}
                          <td className="py-3 px-2.5 text-center font-mono text-rose-600 dark:text-rose-400 font-bold">
                            {row.lost}
                          </td>

                          {/* Goals For : Goals Against */}
                          <td className="py-3 px-2.5 text-center font-mono text-slate-600 dark:text-slate-400">
                            {row.goalsFor}:{row.goalsAgainst}
                          </td>

                          {/* Goal Difference */}
                          <td className="py-3 px-2.5 text-center font-mono">
                            <span
                              className={
                                row.goalDifference > 0
                                  ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                                  : row.goalDifference < 0
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : 'text-slate-500'
                              }
                            >
                              {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
                            </span>
                          </td>

                          {/* Points */}
                          <td className="py-3 px-3 text-center">
                            <span className="font-mono text-sm font-black text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 px-2 py-0.5 rounded-md border border-sky-200/50 dark:border-sky-800/50">
                              {row.points}
                            </span>
                          </td>

                          {/* Form pills */}
                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {formItems.length > 0 ? (
                                formItems.map((f, idx) => {
                                  const char = f.trim().toUpperCase();
                                  let bg = 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300';
                                  let label = 'ت';
                                  if (char === 'W') {
                                    bg = 'bg-emerald-500 text-white';
                                    label = 'ف';
                                  } else if (char === 'L') {
                                    bg = 'bg-rose-500 text-white';
                                    label = 'خ';
                                  }
                                  return (
                                    <span
                                      key={idx}
                                      className={`w-4 h-4 rounded-full text-[9px] font-black flex items-center justify-center ${bg}`}
                                      title={char === 'W' ? 'فوز' : char === 'L' ? 'خسارة' : 'تعادل'}
                                    >
                                      {label}
                                    </span>
                                  );
                                })
                              ) : (
                                <span className="text-[10px] text-slate-400">-</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: API Token Settings (football-data.org)                            */}
      {/* ========================================================================= */}
      {showTokenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#070D1E] w-full max-w-md rounded-3xl border border-slate-200 dark:border-[#141D34] shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 dark:text-white text-base">
                    إعدادات مفتاح المباريات الحية
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    مزود الخدمة المباشرة API-Football / Sports
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowTokenModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>المفتاح الحالي مفعل ومربوط بنجاح</span>
              </div>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                حساب البث: Al-Sari broadcasting | يوفر نتائج حية دقيقة ومحدثة للدوريات العالمية مع قنوات beIN Sports.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  رمز API للمباريات الحية
                </label>
                <span className="text-[10px] text-slate-400 font-mono">
                  المتبقي اليوم: {rateLimitInfo.dailyRemaining} / {rateLimitInfo.dailyLimit}
                </span>
              </div>
              <input
                type="text"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="أدخل الرمز هنا (مثال: 3245db41976cfeae...)"
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 font-mono focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={handleSaveToken}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {tokenSaveSuccess ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-300" />
                    <span>تم التحديث والحفظ بنجاح</span>
                  </>
                ) : (
                  <span>حفظ المفتاح وتحديث المباريات الآن</span>
                )}
              </button>

              <button
                onClick={() => {
                  footballService.setApiKey('');
                  setTokenInput(footballService.getApiKey());
                  setShowTokenModal(false);
                }}
                className="px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 text-xs font-bold rounded-xl cursor-pointer"
                title="استعادة المفتاح الافتراضي"
              >
                المفتاح الافتراضي
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating In-App Match Notification Toast */}
      {activeToast && (
        <div className="fixed bottom-6 left-6 z-50 max-w-sm w-[90vw] sm:w-96 animate-in slide-in-from-bottom-5 duration-300">
          <div
            className={`p-4 rounded-2xl shadow-2xl border backdrop-blur-md flex items-start gap-3 ${
              activeToast.type === 'goal'
                ? 'bg-gradient-to-br from-emerald-950/95 via-slate-900/95 to-slate-900/95 border-emerald-500/50 text-white ring-2 ring-emerald-500/30'
                : activeToast.type === 'kickoff'
                ? 'bg-gradient-to-br from-sky-950/95 via-slate-900/95 to-slate-900/95 border-sky-500/50 text-white ring-2 ring-sky-500/30'
                : 'bg-slate-900/95 border-amber-500/40 text-white shadow-amber-950/20'
            }`}
          >
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-inner ${
                activeToast.type === 'goal'
                  ? 'bg-emerald-500/20 text-emerald-300 text-xl animate-bounce'
                  : activeToast.type === 'kickoff'
                  ? 'bg-sky-500/20 text-sky-300'
                  : 'bg-amber-500/20 text-amber-300'
              }`}
            >
              {activeToast.type === 'goal' ? (
                <span>⚽</span>
              ) : activeToast.type === 'kickoff' ? (
                <Radio className="w-5 h-5 text-sky-400 animate-pulse" />
              ) : (
                <BellRing className="w-5 h-5 text-amber-400" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-black text-white truncate">{activeToast.title}</h4>
                <button
                  type="button"
                  onClick={() => setActiveToast(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-white/10 cursor-pointer"
                  title="إغلاق التنبيه"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">{activeToast.body}</p>
              <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-400 pt-2 border-t border-white/10">
                <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  <span>تنبيه مباشر للمباراة</span>
                </span>
                <span className="font-mono text-slate-300">{activeToast.time}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
