/* LOCO — app.js
   Shared UI: translations, theme, language, music + sound effects, toast.
   Loaded first; game.js and chat.js use window.LOCO. */
(function () {
    'use strict';

    const $ = (id) => document.getElementById(id);

    // ---------- Safe localStorage ----------
    const LS = {
        get(key, fallback) {
            try {
                const v = localStorage.getItem(key);
                return v === null ? fallback : v;
            } catch (e) { return fallback; }
        },
        set(key, value) {
            try { localStorage.setItem(key, value); } catch (e) { /* ignore */ }
        }
    };

    // ---------- Translations (one place for every text) ----------
    const I18N = {
        en: {
            siteTitle: 'LOCO — Online X O',
            welcome: 'Welcome to LOCO',
            welcomeSub: 'Create a room, share the code, and play X O with a friend.',
            createRoom: 'Create Room',
            joinRoom: 'Join Room',
            or: 'or',
            roomPlaceholder: 'Room code',
            copyCode: 'Copy room code',
            copied: 'Room code copied!',
            roomCode: 'Room',
            you: 'You',
            opponent: 'Opponent',
            waitingShort: 'Waiting…',
            cell: 'Cell {n}',

            statusWaiting: '⏳ Waiting for the second player…',
            statusYourTurn: '🎯 Your turn!',
            statusOppTurn: '⏳ Opponent’s turn…',
            statusWin: '🎉 You won!',
            statusLose: '😢 Game over — your opponent won.',
            statusDraw: '🤝 It’s a draw!',
            statusDisconnected: '📡 Connection lost — reconnecting…',

            conn_connected: 'Connected',
            conn_connecting: 'Connecting…',
            conn_disconnected: 'Offline',

            restart: 'Restart',
            backToLobby: 'Back to lobby',
            close: 'Close',
            playAgain: 'Play again',

            winTitle: 'Victory!',
            winText: 'Great game — you beat your opponent.',
            loseTitle: 'Defeat',
            loseText: 'Better luck next round.',
            drawTitle: 'Draw',
            drawText: 'Evenly matched!',

            chat: 'Chat',
            chatPlaceholder: 'Type a message…',
            send: 'Send',
            chatEmpty: 'No messages yet. Say hi! 👋',

            err_enter_code: 'Enter a room code first',
            err_invalid_code: 'Room code is not valid',
            err_room_not_found: 'Room code not found or incorrect',
            emoji: 'Emoji',
            err_room_full: 'This room is full',
            err_not_in_room: 'You are not in a room',
            err_chat_too_long: 'Message is too long',
            err_chat_rate: 'You are sending messages too fast',
            err_not_connected: 'Not connected to the server',
            err_generic: 'Something went wrong',
            err_nothing_copy: 'Create or enter a room code first',
            err_copy: 'Could not copy the code',

            toggleTheme: 'Toggle light / dark mode',
            switchLang: 'Switch language',
            sound: 'Sound',
            playMusic: 'Play music',
            pauseMusic: 'Pause music',
            mute: 'Mute',
            unmute: 'Unmute',
            volume: 'Volume',
            soundEffects: 'Sound effects',
            musicMissing: 'Music file not found (static/audio/)',

            voice: 'Voice chat',
            voiceStart: 'Start voice call',
            voiceEnd: 'End call',
            voiceAccept: 'Accept',
            voiceReject: 'Decline',
            voiceIncoming: 'Incoming voice call',
            voiceIncomingText: 'Your opponent wants to talk. Accept to start the call.',
            voiceIdle: 'Optional — talk to your opponent',
            voiceNeedPlayer: 'Available when both players are in the room',
            voiceCalling: 'Calling…',
            voiceConnecting: 'Connecting…',
            voiceConnected: 'Connected',
            voiceReconnecting: 'Reconnecting…',
            voiceEnded: 'The voice call ended',
            voiceRejectedMsg: 'Your opponent declined the call',
            voiceNoAnswer: 'No answer',
            voiceMicDenied: 'Microphone permission was denied. Allow it in your browser settings and try again.',
            voiceMicMissing: 'No microphone was found',
            voiceNoSupport: 'Voice chat is not supported in this browser',
            voiceNeedsHttps: 'Voice chat needs HTTPS (or localhost)',
            voiceFailed: 'Voice connection failed',
            micMute: 'Mute microphone',
            micUnmute: 'Unmute microphone',
            spkMute: 'Mute speaker',
            spkUnmute: 'Unmute speaker',

            playBot: 'Play vs Computer',
            botTitle: 'Play vs Computer',
            botSubtitle: 'Choose a difficulty. You play X and move first.',
            levelEasy: 'Easy',
            levelEasyDesc: 'Relaxed — makes random moves',
            levelMedium: 'Medium',
            levelMediumDesc: 'Blocks and wins when it can',
            levelHard: 'Hard',
            levelHardDesc: 'Unbeatable — the best you can do is a draw',
            computer: 'Computer',
            vsComputer: 'vs Computer',
            statusBotTurn: '🤖 Computer is thinking…',
            botInstead: 'Nobody here yet? Play vs the computer',
            cancel: 'Cancel',
            accept: 'Accept',
            decline: 'Decline',

            confirmYes: 'Yes, continue',
            confirmRestartTitle: 'Restart the game?',
            confirmRestartText: 'The current game progress will be lost.',
            confirmRestartOnline: 'The current game progress will be lost, and your opponent must accept the request.',
            confirmLeaveTitle: 'Leave the game?',
            confirmLeaveText: 'You will lose the current game progress.',
            confirmLeaveOnline: 'You will lose the current game progress and your opponent will be disconnected.',
            restartSent: 'Request sent — waiting for your opponent…',
            restartIncomingTitle: 'Restart request',
            restartIncomingText: 'Your opponent wants to restart the game. Accept?',
            restartDeclined: 'Your opponent declined the restart',
            restartDone: 'The game was restarted',

            newMessage: '💬 New message',
            voiceNeedTurn: 'The voice connection failed. Players on different networks need a TURN server — see the setup guide.',

            musicStyle: 'Music style',
            nextTrack: 'Next track',
            trackCalm: 'Calm',
            trackCalmDesc: 'Relaxing ambient',
            trackEnergetic: 'Energetic',
            trackEnergeticDesc: 'Upbeat and lively',
            trackAdventure: 'Adventure',
            trackAdventureDesc: 'Epic and heroic',

            roundsTitle: 'Match length',
            roundsHint: 'Choose the number of rounds. Both players must press Ready.',
            roundWord: 'Round',
            roundWordOne: 'round',
            roundWordMany: 'rounds',
            ready: 'Ready',
            setupWaitOpp: 'Waiting for your opponent to press Ready…',
            setupOppReady: 'Your opponent is ready',
            statusSetup: '⚙️ Choose the number of rounds',
            nextRound: 'Next round',
            statusRoundWon: '🎯 You won the round!',
            statusRoundLost: '😕 Your opponent won the round',
            statusRoundDraw: '🤝 Round drawn',
            roundWinTitle: 'Round won!',
            roundLoseTitle: 'Round lost',
            roundDrawTitle: 'Round drawn',
            roundWinText: 'You take this round.',
            roundLoseText: 'Win the next one!',
            roundDrawText: 'No point this time. The starter swaps.',
            youStartNext: 'You start the next round.',
            oppStartsNext: 'Your opponent starts the next round.',
            botStartsNext: 'The computer starts the next round.',
            scoreLine: 'X {x} : {o} O',

            nudge: 'Nudge',
            nudgeWait: 'Nudge ({s}s)',
            nudgeSent: '👋 Nudge sent',
            nudgeIncoming: '👋 Your opponent is waiting — it’s your turn!',
            err_nudge_wait: 'Please wait before nudging again'
        },
        ar: {
            siteTitle: 'LOCO — إكس أو أونلاين',
            welcome: 'أهلاً بك في LOCO',
            welcomeSub: 'أنشئ غرفة وشارك الرمز مع صديقك والعبوا إكس أو.',
            createRoom: 'إنشاء غرفة',
            joinRoom: 'انضم إلى غرفة',
            or: 'أو',
            roomPlaceholder: 'رمز الغرفة',
            copyCode: 'نسخ رمز الغرفة',
            copied: 'تم نسخ رمز الغرفة!',
            roomCode: 'الغرفة',
            you: 'أنت',
            opponent: 'الخصم',
            waitingShort: 'ينتظر…',
            cell: 'الخانة {n}',

            statusWaiting: '⏳ انتظر اللاعب الثاني...',
            statusYourTurn: '🎯 دورك الآن!',
            statusOppTurn: '⏳ انتظر دورك...',
            statusWin: '🎉 مبروك! أنت الفائز!',
            statusLose: '😢 انتهت اللعبة، فاز خصمك!',
            statusDraw: '🤝 تعادل!',
            statusDisconnected: '📡 انقطع الاتصال… جارٍ إعادة الاتصال',

            conn_connected: 'متصل',
            conn_connecting: 'جارٍ الاتصال…',
            conn_disconnected: 'غير متصل',

            restart: 'إعادة اللعب',
            backToLobby: 'العودة للقائمة',
            close: 'إغلاق',
            playAgain: 'العب مجدداً',

            winTitle: 'فوز!',
            winText: 'لعبة رائعة، لقد هزمت خصمك.',
            loseTitle: 'خسارة',
            loseText: 'حظاً أوفر في الجولة القادمة.',
            drawTitle: 'تعادل',
            drawText: 'مستواكما متقارب!',

            chat: 'الدردشة',
            chatPlaceholder: 'اكتب رسالة…',
            send: 'إرسال',
            chatEmpty: 'لا توجد رسائل بعد. ابدأ بالتحية! 👋',

            err_enter_code: 'اكتب رمز الغرفة أولاً',
            err_invalid_code: 'رمز الغرفة غير صالح',
            err_room_not_found: 'رمز الغرفة غير موجود أو خاطئ',
            emoji: 'إيموجي',
            err_room_full: 'هذه الغرفة ممتلئة',
            err_not_in_room: 'أنت لست في غرفة',
            err_chat_too_long: 'الرسالة طويلة جداً',
            err_chat_rate: 'ترسل الرسائل بسرعة كبيرة',
            err_not_connected: 'غير متصل بالخادم',
            err_generic: 'حدث خطأ ما',
            err_nothing_copy: 'أنشئ رمز غرفة أو اكتبه أولاً',
            err_copy: 'تعذّر نسخ الرمز',

            toggleTheme: 'تبديل الوضع الفاتح / الداكن',
            switchLang: 'تغيير اللغة',
            sound: 'الصوت',
            playMusic: 'تشغيل الموسيقى',
            pauseMusic: 'إيقاف الموسيقى',
            mute: 'كتم',
            unmute: 'إلغاء الكتم',
            volume: 'مستوى الصوت',
            soundEffects: 'المؤثرات الصوتية',
            musicMissing: 'ملف الموسيقى غير موجود (static/audio/)',

            voice: 'الدردشة الصوتية',
            voiceStart: 'بدء مكالمة صوتية',
            voiceEnd: 'إنهاء المكالمة',
            voiceAccept: 'قبول',
            voiceReject: 'رفض',
            voiceIncoming: 'مكالمة صوتية واردة',
            voiceIncomingText: 'خصمك يريد التحدث معك. اقبل لبدء المكالمة.',
            voiceIdle: 'اختياري — تحدّث مع خصمك',
            voiceNeedPlayer: 'متاحة عند وجود اللاعبَين معاً في الغرفة',
            voiceCalling: 'جارٍ الاتصال…',
            voiceConnecting: 'جارٍ إنشاء الاتصال…',
            voiceConnected: 'متصل',
            voiceReconnecting: 'جارٍ إعادة الاتصال…',
            voiceEnded: 'انتهت المكالمة الصوتية',
            voiceRejectedMsg: 'رفض خصمك المكالمة',
            voiceNoAnswer: 'لا يوجد رد',
            voiceMicDenied: 'تم رفض إذن الميكروفون. اسمح به من إعدادات المتصفح ثم حاول مجدداً.',
            voiceMicMissing: 'لم يتم العثور على ميكروفون',
            voiceNoSupport: 'الدردشة الصوتية غير مدعومة في هذا المتصفح',
            voiceNeedsHttps: 'الدردشة الصوتية تحتاج إلى HTTPS (أو localhost)',
            voiceFailed: 'فشل الاتصال الصوتي',
            micMute: 'كتم الميكروفون',
            micUnmute: 'تشغيل الميكروفون',
            spkMute: 'كتم السماعة',
            spkUnmute: 'تشغيل السماعة',

            playBot: 'العب ضد الكمبيوتر',
            botTitle: 'العب ضد الكمبيوتر',
            botSubtitle: 'اختر مستوى الصعوبة. أنت تلعب بـ X وتبدأ أولاً.',
            levelEasy: 'سهل',
            levelEasyDesc: 'مريح — حركاته عشوائية',
            levelMedium: 'متوسط',
            levelMediumDesc: 'يسدّ عليك ويفوز عندما يستطيع',
            levelHard: 'صعب',
            levelHardDesc: 'لا يُهزم — أفضل ما تحققه هو التعادل',
            computer: 'الكمبيوتر',
            vsComputer: 'ضد الكمبيوتر',
            statusBotTurn: '🤖 الكمبيوتر يفكّر…',
            botInstead: 'لا أحد هنا بعد؟ العب ضد الكمبيوتر',
            cancel: 'إلغاء',
            accept: 'موافقة',
            decline: 'رفض',

            confirmYes: 'نعم، متابعة',
            confirmRestartTitle: 'إعادة اللعبة؟',
            confirmRestartText: 'ستفقد تقدّمك في اللعبة الحالية.',
            confirmRestartOnline: 'ستفقد تقدّم اللعبة الحالية، ويجب أن يوافق خصمك على الطلب.',
            confirmLeaveTitle: 'مغادرة اللعبة؟',
            confirmLeaveText: 'ستفقد تقدّمك في اللعبة الحالية.',
            confirmLeaveOnline: 'ستفقد تقدّم اللعبة الحالية وسيُفصل خصمك عن اللعبة.',
            restartSent: 'تم إرسال الطلب — بانتظار خصمك…',
            restartIncomingTitle: 'طلب إعادة اللعبة',
            restartIncomingText: 'خصمك يريد إعادة اللعبة. هل توافق؟',
            restartDeclined: 'رفض خصمك إعادة اللعبة',
            restartDone: 'تمت إعادة اللعبة',

            newMessage: '💬 رسالة جديدة',
            voiceNeedTurn: 'فشل الاتصال الصوتي. اللاعبون على شبكات مختلفة يحتاجون إلى سيرفر TURN — راجع دليل الإعداد.',

            musicStyle: 'نمط الموسيقى',
            nextTrack: 'المقطع التالي',
            trackCalm: 'هادئة',
            trackCalmDesc: 'أجواء مريحة',
            trackEnergetic: 'حيوية',
            trackEnergeticDesc: 'شبابية ونشيطة',
            trackAdventure: 'مغامرات',
            trackAdventureDesc: 'ملحمية وحماسية',

            roundsTitle: 'عدد الجولات',
            roundsHint: 'اختر عدد الجولات. يجب أن يضغط اللاعبان على «جاهز».',
            roundWord: 'الجولة',
            roundWordOne: 'جولة',
            roundWordMany: 'جولات',
            ready: 'جاهز',
            setupWaitOpp: 'بانتظار ضغط خصمك على «جاهز»…',
            setupOppReady: 'خصمك جاهز',
            statusSetup: '⚙️ اختر عدد الجولات',
            nextRound: 'الجولة التالية',
            statusRoundWon: '🎯 فزت بالجولة!',
            statusRoundLost: '😕 فاز خصمك بالجولة',
            statusRoundDraw: '🤝 تعادل في الجولة',
            roundWinTitle: 'فزت بالجولة!',
            roundLoseTitle: 'خسرت الجولة',
            roundDrawTitle: 'تعادل في الجولة',
            roundWinText: 'هذه الجولة لك.',
            roundLoseText: 'فُز بالجولة القادمة!',
            roundDrawText: 'لا نقطة هذه المرة، ويتبادل اللاعبان البدء.',
            youStartNext: 'ستبدأ أنت الجولة التالية.',
            oppStartsNext: 'سيبدأ خصمك الجولة التالية.',
            botStartsNext: 'سيبدأ الكمبيوتر الجولة التالية.',
            scoreLine: 'X {x} : {o} O',

            nudge: 'نكز',
            nudgeWait: 'نكز ({s}ث)',
            nudgeSent: '👋 تم إرسال النكزة',
            nudgeIncoming: '👋 خصمك ينتظرك — حان دورك!',
            err_nudge_wait: 'انتظر قليلاً قبل النكز مرة أخرى'
        }
    };

    let lang = document.documentElement.lang === 'ar' ? 'ar' : 'en';

    const LOCO = window.LOCO = { LS: LS };
    Object.defineProperty(LOCO, 'lang', { get() { return lang; } });

    LOCO.has = (key) => Object.prototype.hasOwnProperty.call(I18N[lang], key);
    LOCO.t = function (key, params) {
        let s = I18N[lang][key];
        if (s === undefined) s = I18N.en[key];
        if (s === undefined) return key;
        if (params) s = s.replace(/\{(\w+)\}/g, (m, k) => (params[k] !== undefined ? params[k] : m));
        return s;
    };
    const t = LOCO.t;

    // ---------- Toast ----------
    let toastInstance = null;
    LOCO.toast = function (message, type, onClick) {
        const el = $('appToast');
        $('toastBody').textContent = message;
        el.className = 'toast border-0 toast-' + (type || 'info');
        el.style.cursor = onClick ? 'pointer' : '';
        el.onclick = onClick ? () => { toastInstance.hide(); onClick(); } : null;
        if (!toastInstance) toastInstance = bootstrap.Toast.getOrCreateInstance(el, { delay: 2600 });
        toastInstance.show();
    };

    // ---------- Language ----------
    const BS_LTR = 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css';
    const BS_RTL = 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.rtl.min.css';

    function swapBootstrap(rtl) {
        const old = $('bs-css');
        const href = rtl ? BS_RTL : BS_LTR;
        if (!old || old.getAttribute('href') === href) return;

        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        link.onload = () => old.remove();   // remove the old one only after the new one is ready
        old.removeAttribute('id');
        link.id = 'bs-css';
        old.after(link);
    }

    function applyLang(next, save) {
        lang = next;
        const rtl = next === 'ar';
        const root = document.documentElement;
        root.lang = next;
        root.dir = rtl ? 'rtl' : 'ltr';
        swapBootstrap(rtl);

        document.querySelectorAll('[data-i18n]').forEach((el) => {
            el.textContent = t(el.dataset.i18n);
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
            el.placeholder = t(el.dataset.i18nPlaceholder);
        });
        document.querySelectorAll('[data-i18n-title]').forEach((el) => {
            const text = t(el.dataset.i18nTitle);
            el.title = text;
            el.setAttribute('aria-label', text);
        });

        $('langLabel').textContent = rtl ? 'EN' : 'عربي';
        document.title = t('siteTitle');

        if (save) LS.set('loco_lang', next);
        updateSoundUI();
        document.dispatchEvent(new CustomEvent('loco:lang'));
    }

    $('langBtn').addEventListener('click', () => applyLang(lang === 'ar' ? 'en' : 'ar', true));

    // ---------- Theme ----------
    function applyTheme(theme, save) {
        document.documentElement.setAttribute('data-bs-theme', theme);
        // Show the icon of the mode you would switch TO
        $('themeIcon').className = 'bi ' + (theme === 'dark' ? 'bi-sun-fill' : 'bi-moon-stars-fill');
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', theme === 'dark' ? '#0B1020' : '#EDF1FA');
        if (save) LS.set('loco_theme', theme);
    }

    $('themeBtn').addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-bs-theme');
        applyTheme(current === 'dark' ? 'light' : 'dark', true);
    });

    // Follow the system theme live, but only while the user has not picked one
    if (window.matchMedia) {
        const mq = matchMedia('(prefers-color-scheme: light)');
        const onSystemChange = (e) => {
            if (LS.get('loco_theme', null) === null) applyTheme(e.matches ? 'light' : 'dark', false);
        };
        if (mq.addEventListener) mq.addEventListener('change', onSystemChange);
    }

    // ---------- Sound ----------
    const audioBase = document.body.dataset.audioBase || '/static/audio/';
    const clamp01 = (n) => (isNaN(n) ? 0.4 : Math.min(1, Math.max(0, n)));

    // Music styles: files live in static/audio/
    const TRACKS = [
        { id: 'calm', file: 'background.mp3' },
        { id: 'energetic', file: 'music-energetic.mp3' },
        { id: 'adventure', file: 'music-adventure.mp3' }
    ];
    const savedTrack = LS.get('loco_track', 'calm');

    const music = {
        el: null,
        broken: false,
        track: TRACKS.some((x) => x.id === savedTrack) ? savedTrack : 'calm',
        want: LS.get('loco_music', '1') === '1',
        muted: LS.get('loco_muted', '0') === '1',
        vol: clamp01(parseFloat(LS.get('loco_volume', '0.4')))
    };
    let sfxOn = LS.get('loco_sfx', '1') === '1';

    function ensureMusic() {
        if (music.el) return music.el;
        const a = new Audio();
        a.loop = true;
        a.preload = 'auto';
        a.addEventListener('play', updateSoundUI);
        a.addEventListener('pause', updateSoundUI);
        a.addEventListener('error', () => {
            if (!music.broken) {
                music.broken = true;
                LOCO.toast(t('musicMissing'), 'danger');
            }
            updateSoundUI();
        });
        a.src = audioBase + trackFile(music.track);   // loaded only when music is first needed
        music.el = a;
        return a;
    }

    function trackFile(id) { return (TRACKS.find((x) => x.id === id) || TRACKS[0]).file; }

    /** Choose a music style; autoplay=true also starts it (user picked it on purpose). */
    function setTrack(id, autoplay) {
        if (!TRACKS.some((x) => x.id === id)) return;
        const changed = id !== music.track;
        music.track = id;
        music.broken = false;
        LS.set('loco_track', id);
        if (music.el && changed) music.el.src = audioBase + trackFile(id);
        if (autoplay) {
            music.want = true;
            LS.set('loco_music', '1');
            playMusic();
        }
        updateSoundUI();
    }

    function nextTrack() {
        const i = TRACKS.findIndex((x) => x.id === music.track);
        setTrack(TRACKS[(i + 1) % TRACKS.length].id, true);
    }

    function applyVolume() {
        if (!music.el) return;
        music.el.volume = music.vol;
        music.el.muted = music.muted;
    }

    function playMusic() {
        const a = ensureMusic();
        applyVolume();
        const p = a.play();
        if (p && p.catch) p.catch(() => { /* blocked until the user interacts */ });
    }

    function isPlaying() { return !!(music.el && !music.el.paused); }

    function toggleMusic() {
        const a = ensureMusic();
        if (!a.paused) {
            music.want = false;
            a.pause();
        } else {
            music.want = true;
            playMusic();
        }
        LS.set('loco_music', music.want ? '1' : '0');
        updateSoundUI();
    }

    function setMuted(value) {
        music.muted = value;
        if (!value && music.vol === 0) music.vol = 0.4;
        LS.set('loco_muted', value ? '1' : '0');
        LS.set('loco_volume', String(music.vol));
        applyVolume();
        updateSoundUI();
    }

    function updateSoundUI() {
        const playing = isPlaying();
        const silent = music.muted || music.vol === 0;

        $('musicIcon').className = 'bi me-1 ' + (playing ? 'bi-pause-fill' : 'bi-play-fill');
        $('musicLabel').textContent = t(playing ? 'pauseMusic' : 'playMusic');
        $('muteIcon').className = 'bi me-1 ' + (silent ? 'bi-volume-up-fill' : 'bi-volume-mute-fill');
        $('muteLabel').textContent = t(silent ? 'unmute' : 'mute');
        $('soundIcon').className = 'bi ' + ((playing && !silent) || (!playing && sfxOn && !silent)
            ? 'bi-volume-up-fill' : 'bi-volume-mute-fill');
        $('volumeRange').value = Math.round(music.vol * 100);
        $('sfxSwitch').checked = sfxOn;
        document.querySelectorAll('.track-btn').forEach((b) => {
            b.classList.toggle('active', b.dataset.track === music.track);
        });
    }

    $('musicToggle').addEventListener('click', toggleMusic);
    $('nextTrackBtn').addEventListener('click', nextTrack);
    $('trackList').addEventListener('click', (e) => {
        const b = e.target.closest('[data-track]');
        if (b) setTrack(b.dataset.track, true);
    });
    $('muteToggle').addEventListener('click', () => setMuted(!(music.muted || music.vol === 0)));

    $('volumeRange').addEventListener('input', (e) => {
        music.vol = clamp01(parseInt(e.target.value, 10) / 100);
        if (music.vol > 0) music.muted = false;
        LS.set('loco_volume', String(music.vol));
        LS.set('loco_muted', music.muted ? '1' : '0');
        applyVolume();
        updateSoundUI();
    });

    $('sfxSwitch').addEventListener('change', (e) => {
        sfxOn = e.target.checked;
        LS.set('loco_sfx', sfxOn ? '1' : '0');
        updateSoundUI();
    });

    // Browsers block autoplay: start the music on the first click anywhere.
    function unlockAudio() {
        document.removeEventListener('click', unlockAudio);
        if (music.want) playMusic();
    }
    document.addEventListener('click', unlockAudio);

    // Sound effects: [file, playbackRate]. Each file is loaded on first use only.
    const SFX = {
        click: ['click.mp3', 1],
        move: ['click.mp3', 1.25],
        win: ['win.mp3', 1],
        draw: ['click.mp3', 0.7],
        message: ['message.mp3', 1],
        nudge: ['nudge.mp3', 1]
    };
    const sfxCache = {};

    LOCO.sfx = function (name) {
        const def = SFX[name];
        if (!def || !sfxOn || music.muted || music.vol === 0) return;
        try {
            let a = sfxCache[name];
            if (!a) {
                a = sfxCache[name] = new Audio(audioBase + def[0]);
                a.addEventListener('error', () => { a.dataset.bad = '1'; });  // missing file: stay silent
            }
            if (a.dataset.bad) return;
            a.volume = Math.min(1, music.vol * 1.5);
            a.playbackRate = def[1];
            a.currentTime = 0;
            const p = a.play();
            if (p && p.catch) p.catch(() => {});
        } catch (e) { /* sound is optional */ }
    };

    // Button click sound (board cells make the "move" sound instead)
    document.addEventListener('click', (e) => {
        const b = e.target.closest('button, .btn');
        if (b && !b.classList.contains('cell') && !b.closest('.sound-menu') && !b.closest('.emoji-panel')) LOCO.sfx('click');
    });

    // ---------- Lobby logo: your static/logo.png, with the text logo as a safety net ----------
    const heroLogo = $('heroLogo');
    const heroText = $('heroLogoText');
    function heroFallback() {
        heroLogo.parentElement.classList.add('d-none');   // hide the whole frame, not just the picture
        heroText.classList.remove('d-none');
    }
    heroLogo.addEventListener('error', heroFallback);
    if (heroLogo.complete && heroLogo.naturalWidth === 0) heroFallback();

    // ---------- Init ----------
    applyTheme(document.documentElement.getAttribute('data-bs-theme') || 'dark', false);
    applyLang(lang, false);
})();
