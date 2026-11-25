/* ColorPicker — paletas harmônicas a partir de uma cor base (tudo em HSL) */

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const banco = {
  ler(k, padrao) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? padrao; } catch { return padrao; } },
  salvar(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem storage */ } }
};

/* ---------- Conversões ---------- */
const limitar = (v, a, b) => Math.min(b, Math.max(a, v));
const giro = (h) => ((h % 360) + 360) % 360;
function hexParaRgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const rgbParaHex = (r, g, b) => '#' + [r, g, b].map((x) => Math.round(x).toString(16).padStart(2, '0')).join('').toUpperCase();
function rgbParaHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s * 100, l * 100];
}
function hslParaHex(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return rgbParaHex(f(0) * 255, f(8) * 255, f(4) * 255);
}
const hexParaHsl = (hex) => rgbParaHsl(...hexParaRgb(hex));
const hexValido = (t) => /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(t.trim());
const normHex = (t) => { let h = t.trim().replace('#', '').toUpperCase(); if (h.length === 3) h = h.split('').map((c) => c + c).join(''); return '#' + h; };

/* Luminância relativa (WCAG) para escolher texto claro ou escuro */
function luminancia(hex) {
  const [r, g, b] = hexParaRgb(hex).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contraste = (a, b) => { const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const textoSobre = (hex) => (contraste(hex, '#111111') >= contraste(hex, '#FFFFFF') ? '#111111' : '#FFFFFF');

/* Nome aproximado da cor em português */
function nomeCor(hex) {
  const [h, s, l] = hexParaHsl(hex);
  if (l > 94) return 'Branco';
  if (l < 9) return 'Preto';
  if (s < 10) return l > 65 ? 'Cinza claro' : l < 35 ? 'Cinza escuro' : 'Cinza';
  const nomes = [[15, 'Vermelho'], [40, 'Laranja'], [65, 'Amarelo'], [85, 'Lima'], [150, 'Verde'], [175, 'Turquesa'], [200, 'Ciano'], [235, 'Azul'], [260, 'Anil'], [285, 'Violeta'], [320, 'Magenta'], [345, 'Rosa'], [361, 'Vermelho']];
  let nome = nomes.find(([max]) => h < max)[1];
  if (nome === 'Laranja' && l < 35) nome = 'Marrom';
  const mod = l > 75 ? ' claro' : l < 30 ? ' escuro' : s < 30 ? ' acinzentado' : '';
  return nome + mod;
}

/* ---------- Harmonias ---------- */
function harmonia(tipo, [h, s, l]) {
  const c = (dh, ds = 0, dl = 0) => hslParaHex(giro(h + dh), limitar(s + ds, 8, 100), limitar(l + dl, 8, 92));
  switch (tipo) {
    case 'complementar': return [c(0, 0, -22), c(0), c(0, -10, 24), c(180), c(180, -5, -20)];
    case 'split': return [c(0), c(0, -15, 28), c(150), c(210), c(210, 0, -24)];
    case 'triadica': return [c(0), c(0, -10, 26), c(120), c(240), c(240, 0, -22)];
    case 'tetradica': return [c(0), c(90), c(180), c(270), c(0, -20, 32)];
    case 'mono': return [-30, -15, 0, 15, 30].map((dl) => hslParaHex(h, limitar(s - Math.abs(dl) / 3, 10, 100), limitar(l + dl, 10, 92)));
    default: return [c(-40, 0, -10), c(-20, 0, -4), c(0), c(20, 0, 6), c(40, 0, 12)];
  }
}

/* ---------- Estado ---------- */
const salvo = banco.ler('cp_atual', null);
const estado = {
  base: salvo?.base || '#4F46E5',
  tipo: salvo?.tipo || 'analoga',
  cores: salvo?.cores || null,
  travas: salvo?.travas || [false, false, false, false, false],
  fmt: 'css'
};
let salvas = banco.ler('cp_salvas', []);

function gerar(aleatoria = false) {
  if (aleatoria) {
    // nova base aleatória, mas sem cores muito apagadas
    const h = Math.random() * 360, s = 45 + Math.random() * 45, l = 38 + Math.random() * 24;
    estado.base = hslParaHex(h, s, l);
    const tipos = ['analoga', 'complementar', 'split', 'triadica', 'tetradica', 'mono'];
    if (estado.travas.every((t) => !t)) estado.tipo = tipos[Math.floor(Math.random() * tipos.length)];
  }
  const novas = harmonia(estado.tipo, hexParaHsl(estado.base));
  estado.cores = novas.map((c, i) => (estado.travas[i] && estado.cores ? estado.cores[i] : c));
  desenhar();
}

const ICONES = {
  cadeado: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  aberto: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.5-2"/></svg>',
  editar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18c1.2 0 2-.8 2-1.8 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3Z"/><circle cx="7.5" cy="10.5" r="1"/><circle cx="12" cy="7.5" r="1"/><circle cx="16.5" cy="10.5" r="1"/></svg>',
  base: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>'
};

function desenhar() {
  const cores = estado.cores;
  $('#paleta').innerHTML = cores.map((c, i) => {
    const [r, g, b] = hexParaRgb(c);
    return `<div class="cor" style="--c:${c};--t:${textoSobre(c)}">
      <div class="cor__acoes ${estado.travas[i] ? 'fixo' : ''}">
        <button data-trava="${i}" class="${estado.travas[i] ? 'travada' : ''}" aria-pressed="${estado.travas[i]}" aria-label="${estado.travas[i] ? 'Destravar' : 'Travar'} cor ${i + 1}" title="${estado.travas[i] ? 'Destravar' : 'Travar'}">${estado.travas[i] ? ICONES.cadeado : ICONES.aberto}</button>
        <label title="Ajustar cor">${ICONES.editar}<input type="color" data-ajustar="${i}" value="${c.toLowerCase()}" aria-label="Ajustar cor ${i + 1}"></label>
        <button data-base="${i}" aria-label="Usar como cor base" title="Usar como cor base">${ICONES.base}</button>
      </div>
      <div class="cor__info">
        <button class="cor__hex" data-copiar="${c}" title="Copiar HEX">${c}</button>
        <button class="cor__rgb" data-copiar="rgb(${r}, ${g}, ${b})" title="Copiar RGB">rgb(${r}, ${g}, ${b})</button>
        <span class="cor__nome">${nomeCor(c)}</span>
      </div>
    </div>`;
  }).join('');

  $('#base').value = estado.base.toLowerCase();
  $('#base-hex').value = estado.base;
  $('#harmonia').value = estado.tipo;

  // Cores na marca, na prévia e no código
  const raiz = document.documentElement.style;
  cores.forEach((c, i) => { raiz.setProperty(`--c${i}`, c); raiz.setProperty(`--p${i}`, c); raiz.setProperty(`--t${i}`, textoSobre(c)); });
  // fundo da prévia: a cor mais clara da paleta, clareada
  const clara = [...cores].sort((a, b) => luminancia(b) - luminancia(a))[0];
  const [h, s] = hexParaHsl(clara);
  raiz.setProperty('--p4', hslParaHex(h, Math.min(s, 40), 96));
  raiz.setProperty('--t4', '#1a1a1a');
  desenharCodigo();
  banco.salvar('cp_atual', { base: estado.base, tipo: estado.tipo, cores, travas: estado.travas });
}

function textoExport(fmt, cores) {
  if (fmt === 'hex') return cores.join('\n');
  if (fmt === 'rgb') return cores.map((c) => `rgb(${hexParaRgb(c).join(', ')})`).join('\n');
  if (fmt === 'json') return JSON.stringify(cores.map((c) => ({ hex: c, rgb: hexParaRgb(c), nome: nomeCor(c) })), null, 2);
  return ':root {\n' + cores.map((c, i) => `  --cor-${i + 1}: ${c}; /* ${nomeCor(c)} */`).join('\n') + '\n}';
}
function desenharCodigo() { $('#codigo').textContent = textoExport(estado.fmt, estado.cores); }

/* ---------- Copiar ---------- */
let timerToast;
function toast(msg, cor) {
  const t = $('#toast');
  t.innerHTML = '';
  if (cor) { const i = document.createElement('i'); i.style.setProperty('--c', cor); t.append(i); }
  t.append(msg);
  t.hidden = false;
  clearTimeout(timerToast);
  timerToast = setTimeout(() => { t.hidden = true; }, 1800);
}
async function copiar(texto, cor) {
  try { await navigator.clipboard.writeText(texto); toast(`${texto.length > 30 ? 'Código' : texto} copiado!`, cor); }
  catch { toast('Não foi possível copiar'); }
}

/* ---------- Eventos ---------- */
$('#paleta').addEventListener('click', (e) => {
  const cp = e.target.closest('[data-copiar]');
  if (cp) { copiar(cp.dataset.copiar, cp.closest('.cor').style.getPropertyValue('--c')); return; }
  const tv = e.target.closest('[data-trava]');
  if (tv) { const i = +tv.dataset.trava; estado.travas[i] = !estado.travas[i]; desenhar(); return; }
  const bs = e.target.closest('[data-base]');
  if (bs) { estado.base = estado.cores[+bs.dataset.base]; estado.travas = estado.travas.map(() => false); gerar(); toast('Nova cor base', estado.base); }
});
$('#paleta').addEventListener('input', (e) => {
  const i = e.target.dataset.ajustar;
  if (i === undefined) return;
  estado.cores[+i] = e.target.value.toUpperCase();
  estado.travas[+i] = true;
  const el = e.target.closest('.cor');
  el.style.setProperty('--c', estado.cores[+i]); el.style.setProperty('--t', textoSobre(estado.cores[+i]));
});
$('#paleta').addEventListener('change', (e) => { if (e.target.dataset.ajustar !== undefined) desenhar(); });

$('#base').addEventListener('input', (e) => { estado.base = e.target.value.toUpperCase(); gerar(); });
$('#base-hex').addEventListener('input', (e) => {
  if (hexValido(e.target.value) && e.target.value.replace('#', '').length === 6) { estado.base = normHex(e.target.value); gerar(); }
});
$('#base-hex').addEventListener('blur', (e) => { e.target.value = estado.base; });
$('#harmonia').addEventListener('change', (e) => { estado.tipo = e.target.value; gerar(); });
$('#gerar').addEventListener('click', () => gerar(true));
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !e.target.matches('input, select, textarea, button')) { e.preventDefault(); gerar(true); }
});

$$('[data-fmt]').forEach((b) => b.addEventListener('click', () => {
  estado.fmt = b.dataset.fmt;
  $$('[data-fmt]').forEach((x) => x.setAttribute('aria-pressed', x === b));
  desenharCodigo();
}));
$('#copiar-codigo').addEventListener('click', () => copiar($('#codigo').textContent));

/* ---------- Paletas salvas ---------- */
function desenharSalvas() {
  $('#n-salvas').textContent = salvas.length ? `(${salvas.length})` : '';
  $('#salvas').innerHTML = salvas.length ? salvas.map((p, i) => `<li class="salva">
      <div class="salva__cores">${p.cores.map((c) => `<button style="background:${c}" data-copiar-salva="${c}" title="Copiar ${c}" aria-label="Copiar ${c}"></button>`).join('')}</div>
      <div class="salva__rodape"><span>${p.nome}</span><div>
        <button data-abrir="${i}">Abrir</button><button data-css="${i}">CSS</button><button class="perigo" data-del="${i}" aria-label="Excluir paleta">✕</button>
      </div></div></li>`).join('')
    : '<li class="vazio">Nenhuma paleta salva ainda. Clique em ♥ Salvar para guardar a atual.</li>';
}
$('#salvar').addEventListener('click', () => {
  const chave = estado.cores.join();
  if (salvas.some((p) => p.cores.join() === chave)) { toast('Essa paleta já está salva'); return; }
  const nomes = { analoga: 'Análoga', complementar: 'Complementar', split: 'Compl. dividida', triadica: 'Triádica', tetradica: 'Tetrádica', mono: 'Monocromática' };
  salvas.unshift({ cores: [...estado.cores], nome: `${nomes[estado.tipo]} · ${nomeCor(estado.base)}` });
  banco.salvar('cp_salvas', salvas); desenharSalvas(); toast('Paleta salva ♥');
});
$('#salvas').addEventListener('click', (e) => {
  const c = e.target.closest('[data-copiar-salva]');
  if (c) { copiar(c.dataset.copiarSalva, c.dataset.copiarSalva); return; }
  const a = e.target.closest('[data-abrir]');
  if (a) { estado.cores = [...salvas[+a.dataset.abrir].cores]; estado.base = estado.cores[2]; estado.travas = estado.cores.map(() => true); desenhar(); scrollTo({ top: 0, behavior: 'smooth' }); toast('Paleta aberta (cores travadas)'); return; }
  const css = e.target.closest('[data-css]');
  if (css) { copiar(textoExport('css', salvas[+css.dataset.css].cores)); return; }
  const d = e.target.closest('[data-del]');
  if (d) {
    if (!d.classList.contains('confirmar')) { d.classList.add('confirmar'); d.textContent = 'Excluir?'; setTimeout(() => { if (d.isConnected) { d.classList.remove('confirmar'); d.textContent = '✕'; } }, 3000); return; }
    salvas.splice(+d.dataset.del, 1); banco.salvar('cp_salvas', salvas); desenharSalvas();
  }
});

if (estado.cores) desenhar(); else gerar();
desenharSalvas();
