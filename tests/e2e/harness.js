// In-page test harness, injected with page.addInitScript before the game boots.
// It drives the game through the e2e-only `window.__buzzy` hook: projects 3D objects
// to screen space and dispatches real pointer events at them, so input handling,
// raycasting and colliders are all exercised. Runs in the page to avoid round-trip
// latency while targets move.
(() => {
  // Speech: finish every utterance quickly so flows don't wait on a real voice.
  if ('speechSynthesis' in window) {
    window.speechSynthesis.speak = (u) => setTimeout(() => u.onend && u.onend(new Event('end')), 40);
    window.speechSynthesis.cancel = () => {};
  }

  const T = {
    wait: (ms) => new Promise((r) => setTimeout(r, ms)),
    b: () => window.__buzzy,
    game: () => window.__buzzy.game,

    async waitFor(fn, ms = 60000, label = 'condition') {
      const t0 = performance.now();
      while (performance.now() - t0 < ms) {
        try {
          const v = fn();
          if (v) return v;
        } catch {
          /* not ready yet */
        }
        await T.wait(100);
      }
      throw new Error(`timed out waiting for ${label}`);
    },

    ev(type, x, y) {
      const canvas = document.querySelector('canvas');
      canvas.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, isPrimary: true, pointerId: 1, bubbles: true, pointerType: 'touch' }));
    },
    tapAt(x, y) {
      T.ev('pointerdown', x, y);
      T.ev('pointerup', x, y);
    },
    proj(v) {
      const p = v.clone().project(T.b().camera);
      return [((p.x + 1) / 2) * innerWidth, ((1 - p.y) / 2) * innerHeight];
    },
    screen(obj, dy = 0) {
      const V = T.b().camera.position.constructor;
      const v = obj.getWorldPosition(new V());
      v.y += dy;
      return T.proj(v);
    },
    tapObj(obj, dy = 0) {
      const [x, y] = T.screen(obj, dy);
      T.tapAt(x, y);
    },
    async drag(from, to, steps = 20) {
      T.ev('pointerdown', ...from);
      for (let i = 1; i <= steps; i++) {
        T.ev('pointermove', from[0] + ((to[0] - from[0]) * i) / steps, from[1] + ((to[1] - from[1]) * i) / steps);
        await T.wait(16);
      }
      T.ev('pointerup', ...to);
    },

    tapBud(i) {
      T.tapObj(T.b().garden.buds[i].root, 1.4);
    },

    /** Waits for the running mini-game to accept input. */
    waitMini(id) {
      return T.waitFor(() => {
        const m = T.game().mini;
        if (!m || m.id !== id) return null;
        if (id === 'pollenPop' && !m.ready) return null;
        if (id === 'traceTrail' && !m.state) return null;
        if (id === 'basketMatch' && (m.busy || m.items.length !== 3)) return null;
        return m;
      }, 90000, `${id} ready`);
    },

    /** Pollen Pop: one wrong tap first (must never block), then the three targets. */
    async solvePop() {
      const m = await T.waitMini('pollenPop');
      const onScreen = (f) => f.bubble.root.position.y > 0.8 && f.bubble.root.position.y < 5.5;
      const wrong = await T.waitFor(() => m.floaters.find((f) => !f.bubble.isTarget && onScreen(f)), 20000, 'a visible wrong bubble');
      T.tapObj(wrong.bubble.root);
      const missesAfterWrong = m.misses;
      while (m.popped < 3) {
        const target = m.floaters.find((f) => f.bubble.isTarget && !f.bubble.popped && onScreen(f));
        if (target) T.tapObj(target.bubble.root);
        await T.wait(200);
      }
      return { missesAfterWrong, popped: m.popped };
    },

    /** Trace the Trail: a cheat tap at a stroke's end, an off-path drag, then every stroke in order. */
    async solveTrace() {
      const m = await T.waitMini('traceTrail');
      const st = m.state;
      const len = (s) => s.slice(1).reduce((a, p, i) => a + Math.hypot(p[0] - s[i][0], p[1] - s[i][1]), 0);
      const at = (s, d) => {
        let left = d;
        for (let i = 1; i < s.length; i++) {
          const l = Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]);
          if (left <= l) {
            const t = l ? left / l : 0;
            return [s[i - 1][0] + (s[i][0] - s[i - 1][0]) * t, s[i - 1][1] + (s[i][1] - s[i - 1][1]) * t];
          }
          left -= l;
        }
        return s[s.length - 1];
      };
      const scr = (p) => T.proj(m.boardPoint(p[0], p[1], 0.02));
      const first = st.strokes[0];
      T.tapAt(...scr(first[first.length - 1]));
      const progressAfterCheat = st.progress;
      await T.drag(scr([0.98, 0.5]), scr([0.98, 0.6]), 4);
      const onPathAfterOff = st.lastOnPath;
      for (let k = 0; k < st.strokes.length; k++) {
        const s = st.strokes[k];
        const L = len(s);
        T.ev('pointerdown', ...scr(s[0]));
        for (let i = 1; i <= 40; i++) {
          T.ev('pointermove', ...scr(at(s, (L * i) / 40)));
          await T.wait(10);
        }
        T.ev('pointerup', ...scr(s[s.length - 1]));
        await T.wait(150);
      }
      return { progressAfterCheat, onPathAfterOff, done: st.done };
    },

    /** Basket Match: two rounds; round one starts with a wrong drop. */
    async solveBasket() {
      let misses = 0;
      for (let round = 0; round < 2; round++) {
        const m = await T.waitFor(() => {
          const g = T.game().mini;
          return g && g.id === 'basketMatch' && !g.busy && g.items.length === 3 && g.round === round ? g : null;
        }, 90000, `basket round ${round}`);
        const basket = T.proj(m.ctx.stage.at(5.4, 0.9, 0.6));
        if (round === 0) {
          const wrong = m.items.find((it) => !it.correct);
          await T.drag(T.screen(wrong.holder, 0.85), basket);
          await T.waitFor(() => m.misses >= 1 && !m.busy, 20000, 'wrong drop bounced back');
          misses = m.misses;
        }
        const right = m.items.find((it) => it.correct);
        await T.drag(T.screen(right.holder, 0.85), basket);
        await T.waitFor(() => m.round > round || T.game().mini !== m, 60000, `round ${round} done`);
      }
      return { misses };
    },

    /** Tap bud i, solve its template, wait until it has bloomed and the garden is back. */
    async playLetter(i) {
      const bud = T.b().garden.buds[i];
      T.tapBud(i);
      await T.waitFor(() => T.game().mode === 'letter', 10000, 'letter mode');
      const template = bud.letter.template;
      const result =
        template === 'pollenPop' ? await T.solvePop() : template === 'traceTrail' ? await T.solveTrace() : await T.solveBasket();
      await T.waitFor(() => T.game().mode === 'garden' && T.b().garden.buds[i].bloomed, 90000, 'back in the garden');
      return { id: bud.letter.id, template, ...result };
    },
  };
  window.T = T;
})();
