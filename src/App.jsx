import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowsOutSimple,
  ChatCircleDots,
  Check,
  ClockCountdown,
  Lightning,
  Pause,
  Play,
  PushPin,
  RocketLaunch,
  Star,
  X,
} from "@phosphor-icons/react";
import missionPack from "../plugins/starter-pack.json";
import { completeMission, defaultState, MAX_STARS, sanitizeState, startMission, supply } from "./core/game.js";

const STORAGE_KEY = "orbitbit-state-v1";
const LAST_SEEN_KEY = "orbitbit-last-seen-v1";
const FOCUS_SECONDS = 25 * 60;
const MIN_WIDGET_WIDTH = 340;
const MAX_WIDGET_WIDTH = 600;
const assetUrl = (name) => `${import.meta.env.BASE_URL}assets/${name}`;

function loadState() {
  try {
    if (new URLSearchParams(window.location.search).get("demo") === "fresh") {
      return { ...defaultState };
    }
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? sanitizeState(JSON.parse(stored)) : { ...defaultState };
  } catch {
    return { ...defaultState };
  }
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function App() {
  const [state, setState] = useState(loadState);
  const [messageIndex, setMessageIndex] = useState(0);
  const [notice, setNotice] = useState("");
  const [reaction, setReaction] = useState("");
  const [pinned, setPinned] = useState(true);
  const [isPetted, setIsPetted] = useState(false);
  const [celebratingStar, setCelebratingStar] = useState(null);
  const [focusActive, setFocusActive] = useState(false);
  const [focusRemaining, setFocusRemaining] = useState(0);
  const [engaged, setEngaged] = useState(false);
  const interactiveRef = useRef(true);
  const resizeRef = useRef(null);
  const isDesktop = Boolean(
    window.orbitbitDesktop?.isDesktop
    || new URLSearchParams(window.location.search).get("shell") === "desktop",
  );
  const mission = useMemo(
    () => missionPack.missions[state.completedMissions % missionPack.missions.length],
    [state.completedMissions],
  );

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }, [state]);
  useEffect(() => { document.body.dataset.shell = isDesktop ? "desktop" : "preview"; }, [isDesktop]);

  useEffect(() => {
    if (!isDesktop) return undefined;
    const updateScale = () => {
      const scale = Math.min(window.innerWidth / 420, window.innerHeight / 470);
      document.documentElement.style.setProperty("--shell-scale", String(scale));
    };
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => {
      window.removeEventListener("resize", updateScale);
      document.documentElement.style.removeProperty("--shell-scale");
    };
  }, [isDesktop]);

  useEffect(() => {
    const lastSeen = Number(localStorage.getItem(LAST_SEEN_KEY));
    localStorage.setItem(LAST_SEEN_KEY, String(Date.now()));
    if (Number.isFinite(lastSeen) && Date.now() - lastSeen > 4 * 60 * 60 * 1000) {
      setReaction("你回来啦，我刚好也醒了。");
    }
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(""), 2400);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!reaction) return undefined;
    const timer = window.setTimeout(() => setReaction(""), 2800);
    return () => window.clearTimeout(timer);
  }, [reaction]);

  useEffect(() => {
    if (!isPetted) return undefined;
    const timer = window.setTimeout(() => setIsPetted(false), 620);
    return () => window.clearTimeout(timer);
  }, [isPetted]);

  useEffect(() => {
    if (celebratingStar === null) return undefined;
    const timer = window.setTimeout(() => setCelebratingStar(null), 1100);
    return () => window.clearTimeout(timer);
  }, [celebratingStar]);

  useEffect(() => {
    if (!focusActive) return undefined;
    const timer = window.setInterval(() => {
      setFocusRemaining((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [focusActive]);

  useEffect(() => {
    if (!focusActive || focusRemaining > 0) return;
    setFocusActive(false);
    setState((current) => supply(current));
    setReaction("专注辛苦了，起来休息一下吧。");
    setNotice("25 分钟专注完成，能量 +1");
  }, [focusActive, focusRemaining]);

  useEffect(() => {
    if (!isDesktop) return undefined;
    window.orbitbitDesktop?.setInteractive(false);
    interactiveRef.current = false;
    return () => window.orbitbitDesktop?.setInteractive(true);
  }, [isDesktop]);

  const baseSpeech = state.missionStatus === "active"
    ? `${mission.title}进行中，完成后告诉我。`
    : missionPack.messages[messageIndex % missionPack.messages.length];
  const speech = reaction || (focusActive ? "我会安静陪你，慢慢来。" : baseSpeech);
  const statusText = focusActive
    ? `专注 ${formatTime(focusRemaining)}`
    : state.missionStatus === "active"
      ? `小任务 · ${mission.durationMinutes} 分钟`
      : "安静陪伴";

  function setPointerMode(interactive) {
    if (!isDesktop || interactiveRef.current === interactive) return;
    interactiveRef.current = interactive;
    setEngaged(interactive);
    window.orbitbitDesktop?.setInteractive(interactive);
  }

  function handlePointerMove(event) {
    if (!isDesktop) return;
    const target = event.target;
    const interactive = target instanceof Element && Boolean(target.closest(
      ".pet-wrap, .control-deck, .window-actions, .companion-status, .speech-bubble, .mission-card, .toast, .resize-handle",
    ));
    setPointerMode(interactive);

    const bounds = event.currentTarget.getBoundingClientRect();
    const x = Math.max(-1, Math.min(1, (event.clientX - bounds.left - bounds.width / 2) / (bounds.width / 2)));
    const y = Math.max(-1, Math.min(1, (event.clientY - bounds.top - bounds.height / 2) / (bounds.height / 2)));
    event.currentTarget.style.setProperty("--look-x", `${x * 4}px`);
    event.currentTarget.style.setProperty("--look-y", `${y * 3}px`);
    event.currentTarget.style.setProperty("--look-r", `${x * 1.4}deg`);
  }

  function handlePointerLeave(event) {
    if (!isDesktop) return;
    setPointerMode(false);
    event.currentTarget.style.setProperty("--look-x", "0px");
    event.currentTarget.style.setProperty("--look-y", "0px");
    event.currentTarget.style.setProperty("--look-r", "0deg");
  }

  function handleMission() {
    if (focusActive) {
      setReaction("先保持这段专注，任务稍后再开始吧。");
      return;
    }
    if (state.missionStatus === "idle") {
      setState((current) => startMission(current));
      setReaction(`出发吧：${mission.title}`);
      setNotice(`任务已开始 · ${mission.durationMinutes} 分钟`);
      return;
    }

    const nextStar = state.stars < MAX_STARS ? state.stars : null;
    setState((current) => completeMission(current, mission.reward));
    setCelebratingStar(nextStar);
    setReaction(nextStar === null ? "这张星图已经全亮了，真了不起！" : "新星点亮，做得很好！");
    setNotice("任务完成 · 星图 +1");
  }

  function handleFocus() {
    if (focusActive) {
      setFocusActive(false);
      setFocusRemaining(0);
      setReaction("专注先停在这里，按自己的节奏来。");
      return;
    }
    if (state.missionStatus === "active") {
      setReaction("先完成当前小任务，再一起安静专注吧。");
      return;
    }
    setFocusRemaining(FOCUS_SECONDS);
    setFocusActive(true);
    setReaction("我会安静陪你 25 分钟。");
    setNotice("专注模式已开始");
  }

  function handleChat() {
    const nextIndex = messageIndex + 1;
    setMessageIndex(nextIndex);
    setReaction(missionPack.messages[nextIndex % missionPack.messages.length]);
  }

  function handlePet() {
    setIsPetted(true);
    setReaction("收到你的摸摸啦，我在这里。");
  }

  function beginResize(event) {
    if (!window.orbitbitDesktop?.resizeTo) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeRef.current = {
      pointerId: event.pointerId,
      startScreenX: event.screenX,
      startWidth: window.innerWidth,
    };
    setPointerMode(true);
  }

  function continueResize(event) {
    const session = resizeRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    const requestedWidth = session.startWidth + event.screenX - session.startScreenX;
    const width = Math.min(MAX_WIDGET_WIDTH, Math.max(MIN_WIDGET_WIDTH, requestedWidth));
    window.orbitbitDesktop?.resizeTo(width);
  }

  function finishResize(event) {
    const session = resizeRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    resizeRef.current = null;
  }

  function togglePin() {
    const next = !pinned;
    setPinned(next);
    window.orbitbitDesktop?.togglePin(next);
  }

  return (
    <main
      className={`desktop-stage ${isDesktop ? "is-electron" : "is-preview"}`}
      style={isDesktop ? undefined : { backgroundImage: `url(${assetUrl("orbitbit-wallpaper.png")})` }}
    >
      {!isDesktop && <DesktopPreviewChrome />}
      <section
        className={`pet-cluster ${engaged ? "is-engaged" : ""} ${focusActive ? "is-focusing" : ""} ${celebratingStar !== null ? "is-celebrating" : ""}`}
        aria-label="OrbitBit 桌面陪伴伙伴"
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        {isDesktop && (
          <>
            <div className={`companion-status ${focusActive ? "is-running" : ""}`} aria-live="polite">
              <ClockCountdown weight="fill" />
              <span>{statusText}</span>
            </div>
            <div className="window-actions" aria-label="窗口操作">
              <button className={pinned ? "is-active" : ""} onClick={togglePin} aria-label="切换置顶" title={pinned ? "取消置顶" : "保持置顶"}><PushPin weight="fill" /></button>
              <button onClick={() => window.orbitbitDesktop?.minimize()} aria-label="隐藏 OrbitBit" title="隐藏到托盘"><X weight="bold" /></button>
            </div>
          </>
        )}

        <div className={`speech-bubble ${reaction ? "is-visible" : ""}`} role="status" aria-live="polite">{speech}</div>
        <button
          className={`pet-wrap ${state.missionStatus === "active" ? "is-active" : ""} ${focusActive ? "is-resting" : ""} ${isPetted ? "is-petted" : ""}`}
          onClick={handlePet}
          onPointerUp={(event) => event.currentTarget.blur()}
          aria-label="摸摸 OrbitBit"
          title="摸摸 OrbitBit"
        >
          <img src={assetUrl("orbitbit-character.png")} alt="圆形像素宇航员 OrbitBit" draggable="false" />
        </button>

        <div className="control-deck">
          <div className="progress-panel" aria-label={`星图进度 ${state.stars} / ${MAX_STARS}`}>
            <span className="eyebrow">星图进度</span>
            <div className="star-row" aria-hidden="true">
              {Array.from({ length: MAX_STARS }, (_, index) => (
                <Star
                  key={index}
                  className={`star ${index < state.stars ? "lit" : ""} ${index === celebratingStar ? "just-lit" : ""}`}
                  weight={index < state.stars ? "fill" : "regular"}
                />
              ))}
            </div>
            <strong>{state.stars}/{MAX_STARS}</strong>
          </div>

          <div className="action-bar">
            <button className="primary-action" onClick={handleMission} onPointerUp={(event) => event.currentTarget.blur()} disabled={focusActive} title={state.missionStatus === "active" ? "完成当前任务" : "开始一个微任务"}>
              {state.missionStatus === "active" ? <Check weight="bold" /> : <RocketLaunch weight="fill" />}
              <span>{state.missionStatus === "active" ? "完成" : "任务"}</span>
            </button>
            <button className={`secondary-action ${focusActive ? "is-active" : ""}`} onClick={handleFocus} onPointerUp={(event) => event.currentTarget.blur()} aria-pressed={focusActive} title={focusActive ? "结束本次专注" : "开始 25 分钟专注"}>
              {focusActive ? <Pause weight="fill" /> : <ClockCountdown weight="fill" />}
              <span>{focusActive ? "结束" : "专注"}</span>
            </button>
            <button className="secondary-action" onClick={handleChat} onPointerUp={(event) => event.currentTarget.blur()} title="和 OrbitBit 聊天"><ChatCircleDots weight="fill" /><span>聊天</span></button>
          </div>

          <div className="energy-readout" aria-label={`能量 ${state.energy} / 5`}>
            <Lightning weight="fill" />
            <span>{state.energy}/5</span>
          </div>
        </div>

        <div className={`mission-card ${state.missionStatus === "active" ? "is-visible" : ""}`} aria-hidden={state.missionStatus !== "active"}>
          <div>
            <span className="eyebrow">当前小任务 · {mission.durationMinutes} 分钟</span>
            <strong>{mission.title}</strong>
            <p>{mission.description}</p>
          </div>
          <Play weight="fill" />
        </div>
        {notice && <div className="toast" role="status">{notice}</div>}
        {isDesktop && (
          <button
            className="resize-handle"
            aria-label="调整 OrbitBit 大小"
            title="拖动调整大小"
            onPointerDown={beginResize}
            onPointerMove={continueResize}
            onPointerUp={finishResize}
            onPointerCancel={finishResize}
          >
            <ArrowsOutSimple weight="bold" />
          </button>
        )}
      </section>
    </main>
  );
}

function DesktopPreviewChrome() {
  return (
    <>
      <div className="desktop-icons" aria-hidden="true">
        <DesktopIcon icon="screen" label="此电脑" />
        <DesktopIcon icon="bin" label="回收站" />
        <DesktopIcon icon="folder" label="任务档案" />
      </div>
      <div className="taskbar" aria-hidden="true">
        <div className="start-mark"><i /><i /><i /><i /></div>
        <div className="search-pill">⌕&nbsp;&nbsp;搜索</div>
        <div className="taskbar-apps"><span className="folder-mini" /><img src={assetUrl("orbitbit-icon.png")} alt="" /></div>
        <div className="clock">14:32<br /><small>2026/8/12</small></div>
      </div>
    </>
  );
}

function DesktopIcon({ icon, label }) {
  return <div className="desktop-icon"><span className={`desktop-glyph ${icon}`} /><small>{label}</small></div>;
}
