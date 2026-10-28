import React, { useEffect, useRef, useState } from 'react';
import './entry-motion.css';

const FLOW_VIDEO = '/media/novaworks-flow.mp4';
const FLOW_POSTER = '/media/novaworks-flow-poster.webp';
const REDUCE_QUERY = '(prefers-reduced-motion: reduce)';
const SMALL_QUERY = '(max-width: 760px)';

/** Static-first workflow scene with motion gated by user and browser context. */
export default function EntryMotion() {
  const scene = useRef(null);
  const video = useRef(null);
  const userPaused = useRef(false);
  const manualRequest = useRef(false);
  const autoPlaying = useRef(false);
  const autoAttempted = useRef(false);
  const [inView, setInView] = useState(false);
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || document.visibilityState === 'visible');
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia?.(REDUCE_QUERY).matches === true);
  const [small, setSmall] = useState(() => typeof window !== 'undefined' && window.matchMedia?.(SMALL_QUERY).matches === true);
  const [slowNetwork, setSlowNetwork] = useState(false);
  const [mediaRequested, setMediaRequested] = useState(false);
  const [autoResume, setAutoResume] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [mediaFailed, setMediaFailed] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);

  useEffect(() => {
    const node = scene.current;
    if (!node || !('IntersectionObserver' in window)) { setInView(true); return; }
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.2 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const motion = window.matchMedia(REDUCE_QUERY);
    const viewport = window.matchMedia(SMALL_QUERY);
    const connection = navigator.connection;
    const syncMotion = () => setReduced(motion.matches);
    const syncViewport = () => setSmall(viewport.matches);
    const syncVisibility = () => setVisible(document.visibilityState === 'visible');
    const syncConnection = () => setSlowNetwork(Boolean(connection?.saveData || /^(slow-2g|2g)$/.test(connection?.effectiveType || '')));
    motion.addEventListener?.('change', syncMotion);
    viewport.addEventListener?.('change', syncViewport);
    document.addEventListener('visibilitychange', syncVisibility);
    connection?.addEventListener?.('change', syncConnection);
    syncConnection();
    return () => {
      motion.removeEventListener?.('change', syncMotion);
      viewport.removeEventListener?.('change', syncViewport);
      document.removeEventListener('visibilitychange', syncVisibility);
      connection?.removeEventListener?.('change', syncConnection);
    };
  }, []);

  const autoEligible = !reduced && !small && !slowNetwork && visible && inView && !userPaused.current && !mediaFailed;
  const sourceAttached = !reduced && !mediaFailed && (mediaRequested || autoEligible);

  useEffect(() => {
    const player = video.current;
    if (reduced) {
      player?.pause();
      setPlaying(false);
      setMediaRequested(false);
      manualRequest.current = false;
      autoPlaying.current = false;
      autoAttempted.current = true;
      userPaused.current = true;
      setAutoResume(false);
      return;
    }
    if (!player) return;
    if (!visible || !inView) {
      if (!player.paused) {
        if (autoPlaying.current) setAutoResume(true);
        else {
          manualRequest.current = false;
          userPaused.current = true;
        }
        autoPlaying.current = false;
        player.pause();
      }
      return;
    }
    if ((small || slowNetwork) && !manualRequest.current) {
      if (!player.paused) player.pause();
      autoPlaying.current = false;
      userPaused.current = true;
      setAutoResume(false);
      return;
    }
    const shouldAutoPlay = autoEligible && (!autoAttempted.current || autoResume);
    if (manualRequest.current || shouldAutoPlay) {
      if (shouldAutoPlay) {
        autoAttempted.current = true;
        setMediaRequested(true);
      }
      player.play().catch(() => {
        setPlaying(false);
        autoPlaying.current = false;
        setAutoResume(false);
        // Keep the poster and Play control available after autoplay denial.
      });
    }
  }, [autoEligible, autoResume, inView, reduced, small, slowNetwork, sourceAttached, visible]);

  function togglePlayback() {
    const player = video.current;
    if (playing) {
      userPaused.current = true;
      manualRequest.current = false;
      autoPlaying.current = false;
      setAutoResume(false);
      player?.pause();
      setPlaying(false);
      return;
    }
    if (reduced || mediaFailed) return;
    userPaused.current = false;
    manualRequest.current = true;
    autoPlaying.current = false;
    autoAttempted.current = true;
    setAutoResume(false);
    setMediaRequested(true);
    player?.play().catch(() => setPlaying(false));
  }

  function handlePlay() {
    setPlaying(true);
    if (manualRequest.current) {
      autoPlaying.current = false;
    } else {
      autoPlaying.current = true;
      setAutoResume(false);
    }
  }

  function handleMediaError() {
    setMediaFailed(true);
    setMediaRequested(false);
    setPlaying(false);
    manualRequest.current = false;
    autoPlaying.current = false;
    setAutoResume(false);
  }

  return <section ref={scene} className="entry-motion" aria-label="How company work connects">
    <div className="entry-motion-frame" data-reduced-motion={reduced || undefined}>
      {!posterFailed && <img className="entry-motion-poster" src={FLOW_POSTER} alt="" onError={() => setPosterFailed(true)} />}
      <video ref={video} className={'entry-motion-video'+(sourceAttached?' is-active':'')} src={sourceAttached ? FLOW_VIDEO : undefined} poster={posterFailed ? undefined : FLOW_POSTER} muted playsInline loop preload="none" aria-hidden="true" tabIndex={-1} onPlay={handlePlay} onPause={() => setPlaying(false)} onError={handleMediaError} />
      {posterFailed || mediaFailed ? <div className="entry-motion-art" aria-hidden="true"><span className="entry-art-orbit"/><span className="entry-art-card entry-art-customer"><i/><b/><em/></span><span className="entry-art-card entry-art-project"><i/><b/><b/><em/></span><span className="entry-art-card entry-art-invoice"><i/><b/><b/><b/><em/></span></div> : null}
      <div className="entry-motion-caption"><span>One connected workflow</span><span className="entry-motion-steps"><b>Customer</b><i/><b>Project</b><i/><b>Invoice</b></span></div>
    </div>
    {!mediaFailed && !reduced && <button className="entry-motion-control" type="button" onClick={togglePlayback} aria-pressed={playing}>{playing ? 'Pause animation' : 'Play animation'}</button>}
  </section>;
}
