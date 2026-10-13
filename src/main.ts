import './style.css';
import { AudioEngine } from './core/audio';
import { preload } from './core/assets';
import { CameraRig } from './core/cameraRig';
import { modelIdsFor } from './core/content';
import { Input } from './core/input';
import { Loop } from './core/loop';
import { pickQuality, settingsFor, type Tier } from './core/quality';
import { FrameGovernor } from './core/qualityGovernor';
import { enableOffline } from './core/offline';
import { createRenderContext } from './core/renderer';
import { loadSave } from './core/storage';
import { tweens } from './core/tween';
import { Voice } from './core/voice';
import { Buzzy } from './entities/Buzzy';
import { PollenParticles } from './entities/PollenParticles';
import { Game } from './game';
import { GardenScene } from './scenes/GardenScene';
import { PlayStage } from './scenes/PlayStage';
import { Hud } from './ui/hud';
import { icons } from './ui/icons';
import { StartScreen } from './ui/loading';

const SHARED_MODELS = ['buzzy', 'bud', 'bloom', 'gazebo', 'tree', 'basket'];

async function boot(): Promise<void> {
  const app = document.getElementById('app')!;
  const devTool = new URLSearchParams(location.search).get('dev');
  if (import.meta.env.DEV && devTool === 'strokes') {
    (await import('./dev/strokeEditor')).mountStrokeEditor(app);
    return;
  }
  if ((import.meta.env.DEV || import.meta.env.MODE === 'e2e') && devTool === 'glyphs') {
    await (await import('./dev/glyphSheet')).mountGlyphSheet(app);
    return;
  }
  if ((import.meta.env.DEV || import.meta.env.MODE === 'e2e') && devTool === 'models') {
    await (await import('./dev/modelGallery')).mountModelGallery(app);
    return;
  }

  const quality = pickQuality();
  const save = loadSave();
  const rc = createRenderContext(app, quality);
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  const rotate = document.createElement('div');
  rotate.className = 'rotate-prompt';
  rotate.innerHTML = `<div class="rotate-phone">${icons.phone}</div>`;
  overlay.appendChild(rotate);
  app.appendChild(overlay);
  const start = new StartScreen(overlay);

  const audio = new AudioEngine();
  audio.setVolume(save.volume);
  const voice = new Voice(audio);
  voice.lang = save.lang;
  voice.volume = save.volume;
  const rig = new CameraRig(rc.camera, quality.reducedMotion);
  const garden = new GardenScene();
  const stage = new PlayStage();
  const buzzy = new Buzzy();
  buzzy.faceCamera = rc.camera;
  const particles = new PollenParticles(quality.maxParticles);
  rc.scene.add(garden.root, stage.root, buzzy.root, particles.points);
  rig.jump(garden.overviewPose(rc.camera.aspect));

  // Quality tier: device hints, then GPU limits, then the frame-time governor (boot probe + runtime step-down).
  const applyTier = (tier: Tier) => {
    const s = settingsFor(tier, quality.reducedMotion);
    rc.renderer.setPixelRatio(s.dpr);
    particles.setLimit(s.maxParticles);
    garden.setDecorDensity(s.decor);
  };
  const startTier: Tier = rc.renderer.capabilities.maxTextureSize < 4096 ? 'low' : quality.tier;
  applyTier(startTier);
  const governor = new FrameGovernor(startTier, (tier, avgMs, reason) => {
    applyTier(tier);
    console.info(`[quality] ${reason === 'probe' ? 'boot probe' : 'sustained slow frames'}: avg ${avgMs.toFixed(0)} ms → ${tier}`);
  });

  const loop = new Loop(rc.renderer, () => rc.renderer.render(rc.scene, rc.camera));
  loop.add((dt) => tweens.update(dt));
  loop.start();
  if (import.meta.env.DEV && devTool === 'perf') (await import('./dev/perfOverlay')).mountPerfOverlay(overlay, rc.renderer, loop, () => `tier ${governor.tier} dpr ${rc.renderer.getPixelRatio()}`);

  try {
    await enableOffline();
    await preload([...SHARED_MODELS, ...modelIdsFor(save.lang)], (done, total) => start.progress((done / total) * 0.9));
    await Promise.all([garden.loadModels(), buzzy.load(), garden.setLanguage(save.lang, new Set(save.bloomed))]);
  } catch (err) {
    console.error(err);
    start.fail();
    return;
  }
  buzzy.placeAt(garden.buds[0]?.root.position.clone().setX(-3).setZ(16) ?? rc.camera.position.clone().setY(0));
  // The full garden is now rendering behind the Play button: the governor's boot probe measures it.
  loop.add((dt) => governor.sample(dt));

  const input = new Input(rc.renderer.domElement);
  let game: Game | null = null;
  const hud = new Hud(overlay, {
    home: () => game?.goHome(),
    toggleLang: () => void game?.toggleLang(),
    toggleMute: () => game?.toggleMute(),
    parentTap: () => game?.parentTap(),
    parentHold: () => void game?.parentHold(),
  });
  hud.setMuted(save.volume === 0);
  game = new Game({ rc, loop, input, rig, garden, stage, buzzy, particles, audio, voice, hud, quality, save, overlay });
  // Test hook for dev builds and the e2e build only; compiled out of production.
  if (import.meta.env.DEV || import.meta.env.MODE === 'e2e') Object.assign(window, {
      __buzzy: { game, rig, camera: rc.camera, renderer: rc.renderer, tweens, garden, stage, loop, particles, governor,
        quality: () => ({ tier: governor.tier, dpr: rc.renderer.getPixelRatio(), particles: particles.limit, avgMs: governor.averageMs }),
        setTier: (t: Tier) => {
          governor.tier = t;
          applyTier(t);
        },
      },
    });

  await start.waitForTap();
  audio.unlock();
  void game.begin();
  // Warm the other language's models in the background (offline-friendly later).
  void preload(modelIdsFor(save.lang === 'en' ? 'ta' : 'en'));
}

void boot();
