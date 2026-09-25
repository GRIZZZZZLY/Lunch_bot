/* ROCKET LUNCH — живой список (FlipGroup).

   В закупке строка меняет секцию: отметил «Куплено» — позиция уходит из
   «Осталось» в «Куплено». Для React это два разных узла: строка
   размонтируется в одной секции и монтируется в другой. Без движения она
   исчезает в одном месте и возникает в другом, соседи прыгают на её место,
   карточки секций меняют высоту одним кадром. У коллег, которые смотрят
   закупку по SSE, всё то же самое, только без собственного касания, то есть
   вообще без объяснения, куда делась позиция.

   Здесь один жест вместо набора прыжков (FLIP):
   - строка, сменившая секцию, отрывается листком (подложка --elevated и
     shadow-3, .flip-lift в motion.css) и перелетает на новое место;
   - соседи съезжают на освободившееся место, блоки ниже — следом;
   - карточка секции меняет высоту плавно, а не кадром;
   - новый блок или строка проявляется, исчезнувший гаснет призраком на своём
     старом месте.
   Всё в одном батче: одна длительность от самого дальнего пути и одна кривая
   прихода (--ease-arrive). Общая кривая здесь не вкус, а арифметика: смещение
   строки складывается со смещением её карточки, и только при одной кривой
   сумма двух движений остаётся одним движением.

   Почему класс. Снимок старой раскладки нужен до того, как React поменяет DOM,
   а это умеет только getSnapshotBeforeUpdate. В layout-эффекте старая
   раскладка уже потеряна, и прерванный полёт (ответ SSE посреди анимации)
   было бы не с чего продолжить.

   Что отслеживается: прямые дети корня — блоки (карточки, нотисы, CTA) — и
   дети контейнеров с data-flip-list — строки. Идентичность — сам DOM-узел:
   React переиспользует узлы, пережившие коммит. Строке, которая при переезде
   пересоздаётся, нужен явный ключ data-flip.

   Высота карточки анимируется как height, а не transform: scaleY сплющил бы
   радиусы 26 px и текст внутри. Это единственное исключение из правила
   «только transform и opacity», и оно дешёвое: несколько блоков на время одного
   жеста при раскладке экрана в десятки узлов.

   prefers-reduced-motion и окружение без Web Animations (jsdom): снимка нет,
   экран меняется мгновенно, как раньше. */
import { Component, type CSSProperties, type ReactNode } from 'react';

type Id = string | HTMLElement;

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface Tracked {
  el: HTMLElement;
  box: Box;
  /** Блок, в котором живёт строка; у самого блока — null. */
  block: HTMLElement | null;
}

type Snapshot = Map<Id, Tracked & { blockId: Id | null }>;

interface Offset {
  dx: number;
  dy: number;
}

const EPS = 0.5;
const ZERO: Offset = { dx: 0, dy: 0 };
const ROOT_STYLE: CSSProperties = {
  position: 'relative',
  /* Якорение прокрутки двигало бы контент на каждом кадре изменения высоты, и
     смещения, посчитанные на старте жеста, перестали бы сходиться. */
  overflowAnchor: 'none',
};

const idOf = (el: HTMLElement): Id => el.dataset.flip ?? el;

/* offsetParent === null у fixed-элементов и у скрытых: шторки и диалоги
   отслеживать нельзя, у них своё движение. */
function inFlow(el: Element): el is HTMLElement {
  return el instanceof HTMLElement && el.offsetParent !== null && !el.hasAttribute('data-flip-ghost');
}

function blockOf(root: HTMLElement, node: Element): HTMLElement | null {
  let cur: Element = node;
  while (cur.parentElement && cur.parentElement !== root) cur = cur.parentElement;
  return cur.parentElement === root && cur instanceof HTMLElement ? cur : null;
}

function collect(root: HTMLElement): { el: HTMLElement; block: HTMLElement | null }[] {
  const out: { el: HTMLElement; block: HTMLElement | null }[] = [];
  for (const el of Array.from(root.children)) if (inFlow(el)) out.push({ el, block: null });
  for (const list of Array.from(root.querySelectorAll('[data-flip-list]'))) {
    const block = blockOf(root, list);
    for (const el of Array.from(list.children)) if (inFlow(el)) out.push({ el, block });
  }
  return out;
}

/* Координаты от корня, а не от вьюпорта: прокрутка и вход страницы двигают
   корень вместе с содержимым и на разницу не влияют. */
function measure(root: HTMLElement): Map<Id, Tracked> {
  const origin = root.getBoundingClientRect();
  const map = new Map<Id, Tracked>();
  for (const { el, block } of collect(root)) {
    const r = el.getBoundingClientRect();
    map.set(idOf(el), {
      el,
      block,
      box: { top: r.top - origin.top, left: r.left - origin.left, width: r.width, height: r.height },
    });
  }
  return map;
}

function sameLayout(a: Map<Id, Box>, b: Map<Id, Tracked>): boolean {
  if (a.size !== b.size) return false;
  for (const [id, t] of b) {
    const box = a.get(id);
    if (
      !box ||
      Math.abs(box.top - t.box.top) > EPS ||
      Math.abs(box.left - t.box.left) > EPS ||
      Math.abs(box.height - t.box.height) > EPS
    )
      return false;
  }
  return true;
}

function motionAllowed(root: HTMLElement): boolean {
  if (typeof root.animate !== 'function') return false;
  return !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function tokens(root: HTMLElement) {
  const cs = getComputedStyle(root);
  const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  return {
    arrive: v('--ease-arrive', 'cubic-bezier(0.33, 1, 0.68, 1)'),
    out: v('--ease-out', 'cubic-bezier(0.16, 1, 0.3, 1)'),
    shiftIn: v('--shift-in', '10px'),
    motionIn: parseFloat(v('--motion-in', '200')) || 200,
  };
}

/* 260 мс — сдвиг на одну строку, 480 — перелёт через весь экран. Ниже 260
   перелёт читается рывком, выше 480 список начинает ждать сам себя. */
function durationFor(distance: number): number {
  return Math.round(Math.min(480, Math.max(260, 220 + distance * 0.3)));
}

function lift(el: HTMLElement, block: HTMLElement | null, ms: number) {
  el.classList.add('flip-lift');
  el.style.setProperty('--flip-ms', `${ms}ms`);
  // Блок поднимается вместе со строкой: иначе карточка ниже по DOM закрыла бы её.
  if (block) block.style.zIndex = '1';
}

/* Блок передаётся, а не ищется от строки: строку могли размонтировать на лету,
   и от отсоединённого узла до блока уже не дойти. */
function unlift(el: HTMLElement, block: HTMLElement | null) {
  el.classList.remove('flip-lift');
  el.style.removeProperty('--flip-ms');
  if (block) block.style.zIndex = '';
}

export interface FlipGroupProps {
  className?: string;
  children: ReactNode;
}

export class FlipGroup extends Component<FlipGroupProps> {
  private root: HTMLDivElement | null = null;
  private anims: Animation[] = [];
  private lifted = new Map<HTMLElement, HTMLElement | null>();
  /** Блоки, которые раскрываются с обрезкой содержимого. */
  private clipped = new Set<HTMLElement>();
  /** Раскладка без анимаций после прошлого коммита. */
  private settled = new Map<Id, Box>();
  private runningTimer: number | undefined;

  private setRoot = (el: HTMLDivElement | null) => {
    this.root = el;
  };

  componentDidMount() {
    if (this.root && motionAllowed(this.root)) this.remember(measure(this.root));
  }

  getSnapshotBeforeUpdate(): Snapshot | null {
    const root = this.root;
    if (!root || !motionAllowed(root)) return null;
    const snap: Snapshot = new Map();
    // Видимая раскладка: вместе с незаконченным полётом прошлого коммита.
    for (const [id, t] of measure(root)) snap.set(id, { ...t, blockId: t.block && idOf(t.block) });
    return snap;
  }

  componentDidUpdate(_prevProps: FlipGroupProps, _prevState: unknown, snap: Snapshot | null) {
    const root = this.root;
    if (!root || !snap) return;

    const live = this.anims.filter((a) => a.playState !== 'finished');
    const paused = live.map((a) => [a, a.currentTime] as const);
    live.forEach((a) => a.cancel());
    const now = measure(root);

    /* Раскладка та же (ответ сервера подтвердил оптимистичную отметку, пришёл
       SSE без изменений) — продолжаем жест с того же кадра. Перезапуск
       начал бы кривую заново, и строка на лету получила бы второй толчок. */
    if (sameLayout(this.settled, now)) {
      for (const [a, t] of paused) {
        a.play();
        if (t !== null) a.currentTime = t;
      }
      this.anims = paused.map(([a]) => a);
      return;
    }
    this.remember(now);

    const wasLifted = new Set(this.lifted.keys());
    this.lifted.forEach((block, el) => unlift(el, block));
    this.lifted.clear();
    this.clipped.forEach((el) => el.style.removeProperty('overflow'));
    this.clipped.clear();
    this.anims = [];

    /* Ни один узел не пережил коммит, и строк до него не было — это смена
       содержимого (заглушка загрузки → данные), а не изменение списка. Приход
       данных не анимируется. Строки в снимке значат обратное: единственная
       карточка ушла целиком, и её надо проводить, а не выбросить. */
    const survived = Array.from(now.keys()).some((id) => snap.has(id));
    const hadRows = Array.from(snap.values()).some((o) => o.block !== null);
    if (!survived && !hadRows) return;
    const tk = tokens(root);

    let far = 0;
    for (const [id, t] of now) {
      const o = snap.get(id);
      if (o) far = Math.max(far, Math.abs(o.box.top - t.box.top), Math.abs(o.box.left - t.box.left));
    }
    const ms = durationFor(far);
    const timing: KeyframeAnimationOptions = { duration: ms, easing: tk.arrive };

    const isTraveller = (id: Id, t: Tracked) => {
      const o = snap.get(id);
      if (!o || !t.block) return false;
      return o.blockId !== idOf(t.block) || wasLifted.has(t.el);
    };
    const hostsTraveller = new Map<HTMLElement, HTMLElement[]>();
    for (const [id, t] of now) {
      if (t.block && isTraveller(id, t)) hostsTraveller.set(t.block, [...(hostsTraveller.get(t.block) ?? []), t.el]);
    }

    // 1. Высоты блоков. Анимация применяется сразу, поэтому замер ниже видит
    //    раскладку первого кадра жеста, а не конечную.
    for (const [id, t] of now) {
      if (t.block) continue;
      const o = snap.get(id);
      const h = t.box.height;
      if (o) {
        if (Math.abs(o.box.height - h) > EPS) this.run(t.el, [{ height: `${o.box.height}px` }, { height: `${h}px` }], timing);
      } else if (hostsTraveller.has(t.el)) {
        /* Ни прозрачности, ни обрезки на самом блоке: они погасили бы и строку,
           которая сюда летит. Проявляется всё, кроме неё, — иначе заголовок
           карточки стоял бы в полный цвет за краем ещё не раскрытого фона. */
        const incoming = hostsTraveller.get(t.el) ?? [];
        this.run(t.el, [{ height: '0px' }, { height: `${h}px` }], timing);
        for (const child of Array.from(t.el.children)) {
          if (child instanceof HTMLElement && !incoming.some((el) => child.contains(el))) {
            this.run(child, [{ opacity: 0 }, { opacity: 1 }], timing);
          }
        }
      } else {
        // Содержимое открывается вместе с фоном, а не висит за его краем.
        const el = t.el;
        el.style.overflow = 'hidden';
        this.clipped.add(el);
        this.run(el, [{ height: '0px', opacity: 0 }, { height: `${h}px`, opacity: 1 }], timing, () => {
          el.style.removeProperty('overflow');
          this.clipped.delete(el);
        });
      }
    }

    // 2. Смещения: от видимого старого места к раскладке первого кадра.
    //    Строка вычитает смещение своего блока — она едет внутри него.
    const first = measure(root);
    const offsets = new Map<HTMLElement, Offset>();
    for (const [id, t] of first) {
      const o = snap.get(id);
      const base = (t.block && offsets.get(t.block)) || ZERO;
      if (!o) {
        offsets.set(t.el, base);
        if (t.block && snap.has(idOf(t.block))) {
          this.run(
            t.el,
            [{ opacity: 0, transform: `translateY(${tk.shiftIn})` }, { opacity: 1, transform: 'none' }],
            { duration: tk.motionIn, easing: tk.arrive },
          );
        }
        continue;
      }
      const dx = o.box.left - t.box.left - base.dx;
      const dy = o.box.top - t.box.top - base.dy;
      offsets.set(t.el, { dx: dx + base.dx, dy: dy + base.dy });
      if (Math.abs(dx) < EPS && Math.abs(dy) < EPS) continue;

      const from = `translate(${dx}px, ${dy}px)`;
      if (isTraveller(id, t)) {
        const { el, block } = t;
        lift(el, block, ms);
        this.lifted.set(el, block);
        this.run(
          el,
          [
            { transform: from },
            // Середина пути чуть крупнее: листок подняли над бумагой.
            { offset: 0.5, transform: `translate(${dx / 2}px, ${dy / 2}px) scale(1.02)` },
            { transform: 'none' },
          ],
          timing,
          () => {
            unlift(el, block);
            this.lifted.delete(el);
          },
        );
      } else {
        this.run(t.el, [{ transform: from }, { transform: 'none' }], timing);
      }
    }

    // 3. Исчезнувшее гаснет на своём месте, а не пропадает кадром.
    for (const [id, o] of snap) {
      if (now.has(id) || o.el.isConnected) continue;
      if (o.blockId !== null && snap.has(o.blockId) && !now.has(o.blockId)) continue; // уйдёт вместе с блоком
      this.ghost(root, o, now, tk.out);
    }

    /* Строки прозрачные — их фон даёт карточка. Пока они едут друг мимо друга,
       текст накладывался бы на текст; на время жеста строка берёт фон карточки. */
    root.setAttribute('data-flip-running', '');
    window.clearTimeout(this.runningTimer);
    this.runningTimer = window.setTimeout(() => root.removeAttribute('data-flip-running'), ms);
  }

  componentWillUnmount() {
    this.anims.forEach((a) => a.cancel());
    window.clearTimeout(this.runningTimer);
  }

  private remember(now: Map<Id, Tracked>) {
    this.settled = new Map(Array.from(now, ([id, t]) => [id, t.box]));
  }

  private run(el: HTMLElement, keyframes: Keyframe[], timing: KeyframeAnimationOptions, onDone?: () => void) {
    const a = el.animate(keyframes, timing);
    if (onDone) a.onfinish = onDone;
    this.anims.push(a);
  }

  private ghost(root: HTMLElement, o: Tracked, now: Map<Id, Tracked>, easing: string) {
    const g = o.el.cloneNode(true) as HTMLElement;
    g.setAttribute('data-flip-ghost', '');
    g.setAttribute('aria-hidden', 'true');
    g.inert = true;
    // Призрак — картинка, а не узел: идентичность (id, ключи, тестовые метки) не копируется.
    for (const n of [g, ...Array.from(g.querySelectorAll<HTMLElement>('[id], [data-testid], [data-flip], [data-flip-list]'))]) {
      n.removeAttribute('id');
      n.removeAttribute('data-testid');
      n.removeAttribute('data-flip-list');
      // Строка, которая улетела в другую секцию, живёт там; в призраке её нет.
      const key = n.dataset.flip;
      if (key !== undefined && n !== g && now.has(key)) n.style.visibility = 'hidden';
      n.removeAttribute('data-flip');
    }
    Object.assign(g.style, {
      position: 'absolute',
      top: '0px',
      left: '0px',
      width: `${o.box.width}px`,
      height: `${o.box.height}px`,
      margin: '0',
      pointerEvents: 'none',
    });
    // В живом блоке призрак наследует его переменные (цвета кнопок секции).
    const host = o.block?.isConnected ? o.block : root;
    host.appendChild(g);
    // Координаты снимка — от корня; отсчёт абсолютного узла — от его offsetParent.
    const rr = root.getBoundingClientRect();
    const cb = (g.offsetParent ?? root).getBoundingClientRect();
    g.style.top = `${o.box.top - (cb.top - rr.top)}px`;
    g.style.left = `${o.box.left - (cb.left - rr.left)}px`;
    const a = g.animate([{ opacity: 1 }, { opacity: 0, transform: 'scale(0.97)' }], { duration: 200, easing });
    a.onfinish = a.oncancel = () => g.remove();
  }

  render() {
    return (
      <div ref={this.setRoot} className={this.props.className} style={ROOT_STYLE}>
        {this.props.children}
      </div>
    );
  }
}
