/* Quiz do Regulamento – WorldSkills Brasil Seletiva Nacional 2025
   JavaScript puro, sem dependências. Lê data/questions.json. */
(function () {
  'use strict';

  var STORE_KEY = 'snw25-quiz-v1';
  var THEME_KEY = 'snw25-theme';
  var TIPOS = {
    vf: 'Verdadeiro ou Falso',
    multipla: 'Múltipla escolha',
    multipla_varias: 'Várias corretas',
    lacuna: 'Completar lacuna',
    ordenar: 'Ordenar',
    associar: 'Associar',
    cenario: 'Cenário prático'
  };
  var DIFS = { facil: 'Fácil', medio: 'Médio', dificil: 'Difícil' };

  var app = document.getElementById('app');
  var ALL = [];
  var BY_ID = {};
  var SECOES = [];
  var session = null;

  /* ------------------------------------------------------------ storage */
  function emptyStore() { return { answers: {}, sessions: [], prefs: {} }; }
  function loadStore() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return emptyStore();
      var s = JSON.parse(raw);
      if (!s || typeof s !== 'object') return emptyStore();
      s.answers = s.answers && typeof s.answers === 'object' ? s.answers : {};
      s.sessions = Array.isArray(s.sessions) ? s.sessions : [];
      s.prefs = s.prefs && typeof s.prefs === 'object' ? s.prefs : {};
      return s;
    } catch (e) { return emptyStore(); }
  }
  var store = loadStore();
  function saveStore() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { /* armazenamento indisponível: segue sem salvar */ }
  }
  function recordAnswer(id, ok) {
    var r = store.answers[id] || { c: 0, w: 0 };
    if (ok) r.c++; else r.w++;
    r.last = ok; r.ts = Date.now();
    store.answers[id] = r;
    saveStore();
  }

  /* ------------------------------------------------------------ theme */
  var themeBtn = document.getElementById('themeToggle');
  function currentTheme() {
    var t = document.documentElement.getAttribute('data-theme');
    if (t) return t;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  themeBtn.addEventListener('click', function () {
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
  });

  /* ------------------------------------------------------------ helpers */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      var v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else if (k === 'style') el.setAttribute('style', v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }
  function append(el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { append(el, x); }); return; }
    el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function range(n) { var r = []; for (var i = 0; i < n; i++) r.push(i); return r; }
  function isIdentity(a) { for (var i = 0; i < a.length; i++) if (a[i] !== i) return false; return true; }
  function norm(s) {
    return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/\s+/g, ' ').replace(/[.;!]+$/, '').trim();
  }
  function pct(a, b) { return b ? Math.round((100 * a) / b) : 0; }
  function fmtTime(sec) { sec = Math.max(0, sec | 0); var m = Math.floor(sec / 60), s = sec % 60; return m + ':' + (s < 10 ? '0' : '') + s; }
  function secNum(s) { return parseInt(s, 10) || 0; }
  function render(node) { app.innerHTML = ''; app.appendChild(node); }
  function focusMain() { var m = document.getElementById('main'); try { m.focus({ preventScroll: true }); } catch (e) { m.focus(); } window.scrollTo(0, 0); }

  /* ------------------------------------------------------------ grading */
  function isAnswered(q, a) {
    switch (q.tipo) {
      case 'vf': return typeof a === 'boolean';
      case 'multipla': case 'cenario': return typeof a === 'number';
      case 'multipla_varias': return Array.isArray(a) && a.length > 0;
      case 'lacuna': return typeof a === 'string' && a.trim() !== '';
      case 'ordenar': return Array.isArray(a);
      case 'associar': return Array.isArray(a) && a.every(function (x) { return typeof x === 'number'; });
    }
    return false;
  }
  function grade(q, a) {
    if (!isAnswered(q, a)) return false;
    switch (q.tipo) {
      case 'vf': case 'multipla': case 'cenario': return a === q.resposta;
      case 'multipla_varias':
        var x = a.slice().sort(), y = q.resposta.slice().sort();
        return x.length === y.length && x.every(function (v, i) { return v === y[i]; });
      case 'lacuna':
        var n = norm(a);
        return q.resposta.some(function (r) { return norm(r) === n; });
      case 'ordenar': return isIdentity(a);
      case 'associar': return a.every(function (v, i) { return v === i; });
    }
    return false;
  }
  function describe(q, a) {
    if (!isAnswered(q, a)) return ['(sem resposta)'];
    switch (q.tipo) {
      case 'vf': return [a ? 'Verdadeiro' : 'Falso'];
      case 'multipla': case 'cenario': return [q.opcoes[a]];
      case 'multipla_varias': return a.slice().sort().map(function (i) { return q.opcoes[i]; });
      case 'lacuna': return [a];
      case 'ordenar': return a.map(function (i, k) { return (k + 1) + '. ' + q.opcoes[i]; });
      case 'associar': return a.map(function (d, i) { return q.opcoes[i][0] + ' → ' + q.opcoes[d][1]; });
    }
    return [];
  }
  function correctAnswer(q) {
    switch (q.tipo) {
      case 'vf': return [q.resposta ? 'Verdadeiro' : 'Falso'];
      case 'multipla': case 'cenario': return [q.opcoes[q.resposta]];
      case 'multipla_varias': return q.resposta.map(function (i) { return q.opcoes[i]; });
      case 'lacuna': return [q.resposta[0]];
      case 'ordenar': return q.opcoes.map(function (t, k) { return (k + 1) + '. ' + t; });
      case 'associar': return q.opcoes.map(function (p) { return p[0] + ' → ' + p[1]; });
    }
    return [];
  }

  /* ------------------------------------------------------------ view prep */
  function makeView(q, shuffleOpts) {
    var v = {};
    if (q.tipo === 'multipla' || q.tipo === 'cenario' || q.tipo === 'multipla_varias') {
      v.order = shuffleOpts ? shuffle(range(q.opcoes.length)) : range(q.opcoes.length);
    } else if (q.tipo === 'ordenar') {
      var p; var tries = 0;
      do { p = shuffle(range(q.opcoes.length)); tries++; } while (isIdentity(p) && tries < 20);
      v.initial = p;
    } else if (q.tipo === 'associar') {
      v.terms = shuffleOpts ? shuffle(range(q.opcoes.length)) : range(q.opcoes.length);
      v.defs = shuffle(range(q.opcoes.length));
    }
    return v;
  }
  function initialAnswer(q, v) {
    if (q.tipo === 'ordenar') return v.initial.slice();
    if (q.tipo === 'associar') return q.opcoes.map(function () { return null; });
    if (q.tipo === 'multipla_varias') return [];
    return null;
  }

  /* ------------------------------------------------------------ renderers */
  var uid = 0;
  var RENDER = {};

  RENDER.vf = function (q, v, a, set, ro) {
    var name = 'q' + (++uid);
    return h('div', { class: 'opts vf', role: 'radiogroup', 'aria-label': 'Verdadeiro ou falso' },
      [true, false].map(function (val) {
        var cls = 'opt' + (ro.lock ? ' locked' : '');
        if (ro.show) { if (val === q.resposta) cls += ' is-correct'; else if (a === val) cls += ' is-wrong'; }
        return h('label', { class: cls },
          h('input', { type: 'radio', name: name, checked: a === val, disabled: ro.lock, onchange: function () { set(val); } }),
          h('span', null, val ? 'Verdadeiro' : 'Falso'));
      }));
  };

  RENDER.multipla = function (q, v, a, set, ro) {
    var name = 'q' + (++uid);
    return h('div', { class: 'opts', role: 'radiogroup', 'aria-label': 'Alternativas' },
      v.order.map(function (oi, k) {
        var cls = 'opt' + (ro.lock ? ' locked' : '');
        if (ro.show) { if (oi === q.resposta) cls += ' is-correct'; else if (a === oi) cls += ' is-wrong'; }
        return h('label', { class: cls },
          h('input', { type: 'radio', name: name, checked: a === oi, disabled: ro.lock, onchange: function () { set(oi); } }),
          h('span', null, h('b', null, String.fromCharCode(65 + k) + ') '), q.opcoes[oi]));
      }));
  };
  RENDER.cenario = RENDER.multipla;

  RENDER.multipla_varias = function (q, v, a, set, ro) {
    var sel = Array.isArray(a) ? a.slice() : [];
    return h('div', { class: 'opts', role: 'group', 'aria-label': 'Selecione todas as corretas' },
      v.order.map(function (oi) {
        var on = sel.indexOf(oi) >= 0, right = q.resposta.indexOf(oi) >= 0;
        var cls = 'opt' + (ro.lock ? ' locked' : '');
        if (ro.show) { if (right) cls += ' is-correct'; else if (on) cls += ' is-wrong'; }
        return h('label', { class: cls },
          h('input', { type: 'checkbox', checked: on, disabled: ro.lock, onchange: function (e) {
            var i = sel.indexOf(oi);
            if (e.target.checked && i < 0) sel.push(oi);
            if (!e.target.checked && i >= 0) sel.splice(i, 1);
            set(sel.slice());
          } }),
          h('span', null, q.opcoes[oi], ro.show && right && !on ? h('em', { class: 'small muted' }, ' (faltou marcar)') : null));
      }));
  };

  RENDER.lacuna = function (q, v, a, set, ro) {
    var id = 'lac' + (++uid);
    var input = h('input', { type: 'text', id: id, autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', value: a || '', disabled: ro.lock,
      'aria-label': 'Resposta da lacuna', placeholder: 'Digite a resposta', oninput: function (e) { set(e.target.value, true); } });
    var wrap = h('div', null, h('label', { for: id, class: 'small muted' }, 'Sua resposta:'), input);
    if (ro.show) wrap.appendChild(h('p', { class: 'small muted', style: 'margin-top:6px' }, 'Respostas aceitas: ' + q.resposta.join(' · ')));
    return wrap;
  };

  RENDER.ordenar = function (q, v, a, set, ro) {
    var order = a.slice();
    var list = h('ol', { class: 'order-list', 'aria-label': 'Itens para ordenar' });
    var dragFrom = null;
    function move(from, to) {
      if (to < 0 || to >= order.length) return;
      var x = order.splice(from, 1)[0]; order.splice(to, 0, x);
      set(order.slice(), true); draw(to);
    }
    function draw(focusIdx, focusDir) {
      list.innerHTML = '';
      order.forEach(function (oi, k) {
        var cls = 'order-item';
        if (ro.show) cls += oi === k ? ' is-correct' : ' is-wrong';
        var up = h('button', { type: 'button', 'aria-label': 'Mover "' + q.opcoes[oi] + '" para cima', disabled: ro.lock || k === 0, onclick: function () { move(k, k - 1); focusBtn(k - 1, 'up'); } }, '↑');
        var dn = h('button', { type: 'button', 'aria-label': 'Mover "' + q.opcoes[oi] + '" para baixo', disabled: ro.lock || k === order.length - 1, onclick: function () { move(k, k + 1); focusBtn(k + 1, 'down'); } }, '↓');
        var li = h('li', { class: cls, draggable: ro.lock ? null : 'true', 'data-k': k },
          h('span', { class: 'num', 'aria-hidden': 'true' }, (k + 1) + '.'),
          h('span', { class: 'txt' }, q.opcoes[oi]),
          ro.lock ? null : h('span', { class: 'mv' }, up, dn));
        if (!ro.lock) {
          li.addEventListener('dragstart', function (e) { dragFrom = k; li.classList.add('dragging'); try { e.dataTransfer.setData('text/plain', String(k)); e.dataTransfer.effectAllowed = 'move'; } catch (er) {} });
          li.addEventListener('dragend', function () { li.classList.remove('dragging'); });
          li.addEventListener('dragover', function (e) { e.preventDefault(); li.classList.add('drop-target'); });
          li.addEventListener('dragleave', function () { li.classList.remove('drop-target'); });
          li.addEventListener('drop', function (e) { e.preventDefault(); li.classList.remove('drop-target'); if (dragFrom != null && dragFrom !== k) move(dragFrom, k); dragFrom = null; });
        }
        list.appendChild(li);
      });
    }
    function focusBtn(k, dir) {
      var items = list.querySelectorAll('.order-item');
      if (!items[k]) return;
      var btns = items[k].querySelectorAll('.mv button');
      var b = dir === 'up' ? btns[0] : btns[1];
      if (b && b.disabled) b = dir === 'up' ? btns[1] : btns[0];
      if (b) b.focus();
    }
    draw();
    return h('div', null, ro.lock ? null : h('p', { class: 'hint' }, 'Use as setas ↑ ↓ ou arraste os itens para colocá-los na ordem.'), list);
  };

  RENDER.associar = function (q, v, a, set, ro) {
    var cur = a.slice();
    return h('div', { class: 'match' }, v.terms.map(function (ti) {
      var id = 'as' + (++uid);
      var cls = 'match-row';
      if (ro.show) cls += cur[ti] === ti ? ' is-correct' : ' is-wrong';
      var sel = h('select', { id: id, disabled: ro.lock, onchange: function (e) {
        cur[ti] = e.target.value === '' ? null : parseInt(e.target.value, 10); set(cur.slice());
      } }, h('option', { value: '' }, 'Escolha…'),
        v.defs.map(function (di) { return h('option', { value: String(di), selected: cur[ti] === di }, q.opcoes[di][1]); }));
      return h('div', { class: cls },
        h('label', { class: 'term', for: id }, q.opcoes[ti][0]),
        sel,
        ro.show && cur[ti] !== ti ? h('span', { class: 'small' }, 'Correto: ' + q.opcoes[ti][1]) : null);
    }));
  };

  function tagsFor(q) {
    return h('div', { class: 'tags' },
      h('span', { class: 'tag' }, q.secao),
      h('span', { class: 'tag' }, TIPOS[q.tipo]),
      h('span', { class: 'tag d-' + q.dificuldade }, DIFS[q.dificuldade]));
  }

  function hintFor(q) {
    if (q.tipo === 'multipla_varias') return 'Marque todas as alternativas corretas.';
    if (q.tipo === 'lacuna') return 'Digite a palavra ou o número que completa a frase.';
    if (q.tipo === 'associar') return 'Escolha a definição correspondente a cada item.';
    return null;
  }

  /* ------------------------------------------------------------ filters */
  function defaultPrefs() {
    return { mode: 'estudo', secoes: SECOES.slice(), tipos: Object.keys(TIPOS), difs: Object.keys(DIFS),
      qtdEstudo: 0, qtdSimulado: 20, timer: false, minutos: 30, embaralharQ: true, embaralharA: true, soErradas: false };
  }
  function getPrefs() {
    var d = defaultPrefs(), p = store.prefs || {};
    for (var k in d) if (p[k] !== undefined) d[k] = p[k];
    d.secoes = d.secoes.filter(function (s) { return SECOES.indexOf(s) >= 0; });
    return d;
  }
  function filterQuestions(p) {
    return ALL.filter(function (q) {
      if (p.secoes.indexOf(q.secao) < 0 || p.tipos.indexOf(q.tipo) < 0 || p.difs.indexOf(q.dificuldade) < 0) return false;
      if (p.soErradas) { var r = store.answers[q.id]; if (!r || r.last !== false) return false; }
      return true;
    });
  }

  /* ------------------------------------------------------------ HOME */
  function renderHome() {
    stopTimer();
    session = null;
    var p = getPrefs();
    var answeredIds = Object.keys(store.answers).filter(function (id) { return BY_ID[id]; });
    var totC = 0, totW = 0;
    answeredIds.forEach(function (id) { totC += store.answers[id].c; totW += store.answers[id].w; });
    var wrongNow = answeredIds.filter(function (id) { return store.answers[id].last === false; }).length;

    var countOut = h('strong', null, '0');
    var startBtn = h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, 'Começar');
    var qtdField, timerRow;

    function read() {
      var f = form;
      p.mode = f.querySelector('input[name=mode]:checked').value;
      p.secoes = [].map.call(f.querySelectorAll('input[name=secao]:checked'), function (i) { return i.value; });
      p.tipos = [].map.call(f.querySelectorAll('input[name=tipo]:checked'), function (i) { return i.value; });
      p.difs = [].map.call(f.querySelectorAll('input[name=dif]:checked'), function (i) { return i.value; });
      var n = parseInt(f.querySelector('#qtd').value, 10);
      if (p.mode === 'estudo') p.qtdEstudo = isNaN(n) ? 0 : Math.max(0, n);
      else p.qtdSimulado = isNaN(n) || n < 1 ? 20 : n;
      p.timer = f.querySelector('#timer').checked;
      var m = parseInt(f.querySelector('#minutos').value, 10); p.minutos = isNaN(m) || m < 1 ? 30 : m;
      p.embaralharQ = f.querySelector('#embQ').checked;
      p.embaralharA = f.querySelector('#embA').checked;
      p.soErradas = f.querySelector('#soErr').checked;
    }
    function update() {
      read();
      var n = filterQuestions(p).length;
      countOut.textContent = String(n);
      startBtn.disabled = n === 0;
      var isSim = p.mode === 'simulado';
      qtdField.querySelector('label').textContent = isSim ? 'Nº de perguntas' : 'Nº de perguntas (0 = todas)';
      qtdField.querySelector('input').value = String(isSim ? p.qtdSimulado : p.qtdEstudo);
      timerRow.hidden = !isSim;
      store.prefs = p; saveStore();
    }

    function chipGroup(legend, name, items, selected, labelFn, countFn) {
      var boxes = items.map(function (it) {
        return h('label', { class: 'chip' },
          h('input', { type: 'checkbox', name: name, value: it, checked: selected.indexOf(it) >= 0 }),
          labelFn(it), h('span', { class: 'n' }, '(' + countFn(it) + ')'));
      });
      function setAll(v) { boxes.forEach(function (b) { b.querySelector('input').checked = v; }); update(); }
      return h('fieldset', null,
        h('legend', null, legend, ' ',
          h('button', { type: 'button', class: 'linkish', onclick: function () { setAll(true); } }, 'todas'),
          h('button', { type: 'button', class: 'linkish', onclick: function () { setAll(false); } }, 'nenhuma')),
        h('div', { class: 'chips' }, boxes));
    }
    function cnt(key) { return function (v) { return ALL.filter(function (q) { return q[key] === v; }).length; }; }

    qtdField = h('div', { class: 'field' }, h('label', { for: 'qtd' }, ''), h('input', { id: 'qtd', type: 'number', min: '0', max: String(ALL.length), inputmode: 'numeric' }));
    timerRow = h('div', { class: 'row' },
      h('label', { class: 'check' }, h('input', { id: 'timer', type: 'checkbox', checked: p.timer }), 'Usar cronômetro'),
      h('div', { class: 'field' }, h('label', { for: 'minutos' }, 'Minutos'), h('input', { id: 'minutos', type: 'number', min: '1', max: '300', value: String(p.minutos), inputmode: 'numeric' })));

    var form = h('form', { class: 'card', novalidate: true, onsubmit: function (e) { e.preventDefault(); read(); startSession(p, null); } },
      h('h2', null, 'Como você quer estudar?'),
      h('div', { class: 'modes', role: 'radiogroup', 'aria-label': 'Modo' },
        h('label', { class: 'mode' }, h('input', { type: 'radio', name: 'mode', value: 'estudo', checked: p.mode === 'estudo' }),
          h('strong', null, 'Modo Estudo'), h('span', null, 'Correção imediata, com explicação e referência após cada resposta.')),
        h('label', { class: 'mode' }, h('input', { type: 'radio', name: 'mode', value: 'simulado', checked: p.mode === 'simulado' }),
          h('strong', null, 'Modo Simulado'), h('span', null, 'Perguntas aleatórias, cronômetro opcional e correção só no final.'))),
      h('div', { style: 'height:14px' }),
      h('div', { class: 'row' }, qtdField),
      timerRow,
      h('details', { style: 'margin-top:10px' },
        h('summary', null, 'Filtros e opções'),
        h('div', { style: 'padding-top:8px' },
          chipGroup('Seções', 'secao', SECOES, p.secoes, function (s) { return s; }, cnt('secao')),
          chipGroup('Tipos de pergunta', 'tipo', Object.keys(TIPOS), p.tipos, function (t) { return TIPOS[t]; }, cnt('tipo')),
          chipGroup('Dificuldade', 'dif', Object.keys(DIFS), p.difs, function (d) { return DIFS[d]; }, cnt('dificuldade')),
          h('label', { class: 'check' }, h('input', { id: 'embQ', type: 'checkbox', checked: p.embaralharQ }), 'Embaralhar perguntas'),
          h('label', { class: 'check' }, h('input', { id: 'embA', type: 'checkbox', checked: p.embaralharA }), 'Embaralhar alternativas'),
          h('label', { class: 'check' }, h('input', { id: 'soErr', type: 'checkbox', checked: p.soErradas }), 'Só as que errei da última vez (' + wrongNow + ')'))),
      h('p', { class: 'muted', style: 'margin-top:12px' }, countOut, ' perguntas correspondem aos filtros.'),
      startBtn);
    form.addEventListener('change', update);
    form.addEventListener('input', function (e) { if (e.target.id === 'qtd' || e.target.id === 'minutos') { read(); store.prefs = p; saveStore(); countOut.textContent = String(filterQuestions(p).length); } });

    var hist = store.sessions.slice(-5).reverse();
    var progress = h('section', { class: 'card', 'aria-labelledby': 'h-prog' },
      h('h2', { id: 'h-prog' }, 'Seu progresso'),
      h('div', { class: 'stats' },
        h('div', { class: 'stat' }, h('b', null, answeredIds.length + '/' + ALL.length), h('span', null, 'perguntas já respondidas')),
        h('div', { class: 'stat' }, h('b', null, pct(totC, totC + totW) + '%'), h('span', null, 'acertos no total')),
        h('div', { class: 'stat' }, h('b', null, wrongNow), h('span', null, 'erradas na última tentativa'))),
      hist.length ? h('div', null, h('h3', { style: 'margin-top:14px' }, 'Últimas sessões'),
        h('ul', { class: 'plain small' }, hist.map(function (s) {
          var d = new Date(s.ts);
          return h('li', null, d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) +
            ' · ' + (s.mode === 'simulado' ? 'Simulado' : 'Estudo') + ' · ' + s.correct + '/' + s.total + ' (' + pct(s.correct, s.total) + '%)');
        }))) : h('p', { class: 'muted small', style: 'margin-top:12px' }, 'Nenhuma sessão concluída ainda.'),
      h('div', { class: 'actions' },
        wrongNow ? h('button', { type: 'button', class: 'btn', onclick: function () {
          var ids = answeredIds.filter(function (id) { return store.answers[id].last === false; });
          startSession(Object.assign({}, p, { mode: 'estudo', timer: false }), ids);
        } }, 'Revisar as ' + wrongNow + ' que errei') : null,
        answeredIds.length ? h('button', { type: 'button', class: 'btn btn-danger', onclick: function () {
          if (confirm('Apagar todo o progresso e o histórico salvos neste navegador?')) { store.answers = {}; store.sessions = []; saveStore(); renderHome(); }
        } }, 'Apagar progresso') : null));

    var porSecao = SECOES.map(function (s) { return s + ' (' + ALL.filter(function (q) { return q.secao === s; }).length + ')'; });

    render(h('div', null,
      h('section', { class: 'hero' },
        h('h1', null, 'Quiz do Regulamento – Seletiva Nacional WorldSkills 2025'),
        h('p', null, 'O regulamento traz as regras da WorldSkills Brasil – Seletiva Nacional 2025, organizada pelo SENAI-DN para escolher os competidores que representarão o Brasil na WorldSkills Xangai (setembro de 2026). Ele trata de inscrição e prazos, elegibilidade, papéis do júri, Projeto Teste, sistema de avaliação (CIS), premiação, acesso, segurança, patrocínio e resolução de conflitos.'),
        h('div', { class: 'stats' },
          h('div', { class: 'stat' }, h('b', null, ALL.length), h('span', null, 'perguntas')),
          h('div', { class: 'stat' }, h('b', null, SECOES.length), h('span', null, 'seções')),
          h('div', { class: 'stat' }, h('b', null, Object.keys(TIPOS).length), h('span', null, 'tipos de pergunta'))),
        h('details', null, h('summary', null, 'Perguntas por seção'), h('ul', { class: 'plain small' }, porSecao.map(function (t) { return h('li', null, t); })))),
      form,
      progress));
    update();
  }

  /* ------------------------------------------------------------ SESSION */
  var timerId = null;
  function stopTimer() { if (timerId) { clearInterval(timerId); timerId = null; } }

  function startSession(p, ids) {
    var list = ids ? ids.map(function (id) { return BY_ID[id]; }).filter(Boolean) : filterQuestions(p);
    if (p.embaralharQ || p.mode === 'simulado') list = shuffle(list);
    var n = p.mode === 'simulado' ? p.qtdSimulado : p.qtdEstudo;
    if (!ids && n > 0) list = list.slice(0, n);
    if (!list.length) return;
    session = {
      mode: p.mode, prefs: p,
      items: list.map(function (q) { var v = makeView(q, p.embaralharA); return { q: q, v: v, a: initialAnswer(q, v), touched: false, checked: false }; }),
      idx: 0, start: Date.now(),
      timeLimit: p.mode === 'simulado' && p.timer && !ids ? p.minutos * 60 : 0
    };
    if (session.timeLimit) {
      timerId = setInterval(function () {
        var left = session.timeLimit - Math.floor((Date.now() - session.start) / 1000);
        var el = document.getElementById('timer-out');
        if (el) { el.textContent = fmtTime(left); el.classList.toggle('low', left <= 60); }
        if (left <= 0) { stopTimer(); finishSession(true); }
      }, 1000);
    }
    renderQuestion();
  }

  function renderQuestion() {
    var s = session, it = s.items[s.idx], q = it.q, study = s.mode === 'estudo';
    var ro = { lock: study && it.checked, show: study && it.checked };
    var body = h('div');
    var submitBtn, nextBtn;

    function set(val, keepDom) {
      it.a = val; it.touched = true;
      if (submitBtn) submitBtn.disabled = !isAnswered(q, it.a);
      if (!study) refreshDots();
      if (!keepDom && q.tipo === 'multipla_varias') { /* checkbox já reflete o estado */ }
    }

    var fieldId = 'qtitle';
    body.appendChild(tagsFor(q));
    body.appendChild(h('h2', { class: 'q-text', id: fieldId, tabindex: '-1' }, q.enunciado));
    var hn = hintFor(q); if (hn && !ro.lock) body.appendChild(h('p', { class: 'hint' }, hn));
    body.appendChild(RENDER[q.tipo](q, it.v, it.a, set, ro));

    if (study && it.checked) {
      var ok = grade(q, it.a);
      body.appendChild(h('div', { class: 'feedback ' + (ok ? 'ok' : 'bad'), role: 'status' },
        h('h3', null, ok ? '✓ Correto!' : '✗ Não foi dessa vez'),
        !ok ? h('div', { class: 'correct-ans' }, h('strong', null, 'Resposta correta: '),
          (function () { var c = correctAnswer(q); return c.length === 1 ? c[0] : h('ul', { class: 'plain' }, c.map(function (t) { return h('li', null, t); })); })()) : null,
        h('p', { style: 'margin:6px 0 0' }, q.explicacao),
        h('p', { class: 'ref' }, '📖 ' + q.referencia)));
    }

    var actions = h('div', { class: 'actions' });
    if (study) {
      if (!it.checked) {
        submitBtn = h('button', { type: 'button', class: 'btn btn-primary', disabled: !isAnswered(q, it.a) && q.tipo !== 'ordenar', onclick: function () {
          if (!isAnswered(q, it.a)) return;
          it.checked = true; recordAnswer(q.id, grade(q, it.a)); renderQuestion();
          var fb = app.querySelector('.feedback'); if (fb) { fb.setAttribute('tabindex', '-1'); fb.focus(); }
        } }, 'Responder');
        actions.appendChild(submitBtn);
        actions.appendChild(h('button', { type: 'button', class: 'btn', onclick: function () { go(1); } }, 'Pular'));
      } else {
        nextBtn = h('button', { type: 'button', class: 'btn btn-primary', onclick: function () {
          if (s.idx === s.items.length - 1) finishSession(); else go(1);
        } }, s.idx === s.items.length - 1 ? 'Ver resultado' : 'Próxima →');
        actions.appendChild(nextBtn);
      }
    } else {
      actions.appendChild(h('button', { type: 'button', class: 'btn', disabled: s.idx === 0, onclick: function () { go(-1); } }, '← Anterior'));
      if (s.idx < s.items.length - 1) actions.appendChild(h('button', { type: 'button', class: 'btn btn-primary', onclick: function () { go(1); } }, 'Próxima →'));
      actions.appendChild(h('button', { type: 'button', class: 'btn' + (s.idx === s.items.length - 1 ? ' btn-primary' : ''), onclick: function () {
        var pend = s.items.filter(function (x) { return !(x.touched && isAnswered(x.q, x.a)); }).length;
        if (pend && !confirm('Há ' + pend + ' pergunta(s) sem resposta. Finalizar mesmo assim?')) return;
        finishSession();
      } }, 'Finalizar simulado'));
    }
    body.appendChild(actions);

    var dots = null;
    function refreshDots() {
      if (!dots) return;
      [].forEach.call(dots.children, function (b, i) {
        var x = s.items[i];
        b.classList.toggle('answered', x.touched && isAnswered(x.q, x.a));
      });
    }
    if (!study) {
      dots = h('nav', { class: 'nav-dots', 'aria-label': 'Ir para a pergunta' }, s.items.map(function (x, i) {
        return h('button', { type: 'button', class: i === s.idx ? 'current' : '', 'aria-current': i === s.idx ? 'step' : null,
          'aria-label': 'Pergunta ' + (i + 1), onclick: function () { s.idx = i; renderQuestion(); } }, String(i + 1));
      }));
      body.appendChild(dots);
      refreshDots();
    }

    var answered = s.items.filter(function (x) { return study ? x.checked : (x.touched && isAnswered(x.q, x.a)); }).length;
    var head = h('div', { class: 'quiz-head' },
      h('div', null, h('strong', null, (study ? 'Estudo' : 'Simulado') + ' · Pergunta ' + (s.idx + 1) + ' de ' + s.items.length)),
      h('div', { style: 'display:flex;gap:8px;align-items:center' },
        s.timeLimit ? h('span', { class: 'timer', id: 'timer-out', 'aria-label': 'Tempo restante' }, fmtTime(s.timeLimit - Math.floor((Date.now() - s.start) / 1000))) : null,
        h('button', { type: 'button', class: 'btn', style: 'min-height:40px;padding:6px 12px', onclick: function () {
          if (study) { if (s.items.some(function (x) { return x.checked; })) finishSession(); else renderHome(); }
          else if (confirm('Sair do simulado? As respostas não serão corrigidas.')) renderHome();
        } }, study ? 'Encerrar' : 'Sair')));

    render(h('div', null, head,
      h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(s.items.length), 'aria-valuenow': String(answered), 'aria-label': 'Progresso' },
        h('i', { style: 'width:' + pct(answered, s.items.length) + '%' })),
      h('article', { class: 'card' }, body)));
  }

  function go(d) {
    var s = session; var n = s.idx + d;
    if (n < 0 || n >= s.items.length) { if (s.mode === 'estudo' && n >= s.items.length) finishSession(); return; }
    s.idx = n; renderQuestion();
    var t = document.getElementById('qtitle'); if (t) t.focus(); window.scrollTo(0, 0);
  }

  function finishSession(timeUp) {
    stopTimer();
    var s = session; if (!s) return;
    var study = s.mode === 'estudo';
    var items = study ? s.items.filter(function (x) { return x.checked; }) : s.items;
    if (!items.length) { renderHome(); return; }
    var results = items.map(function (x) {
      var answered = study ? true : (x.touched && isAnswered(x.q, x.a));
      var ok = answered && grade(x.q, x.a);
      if (!study) recordAnswer(x.q.id, ok);
      return { it: x, ok: ok, answered: answered };
    });
    var correct = results.filter(function (r) { return r.ok; }).length;
    store.sessions.push({ ts: Date.now(), mode: s.mode, correct: correct, total: results.length });
    if (store.sessions.length > 50) store.sessions = store.sessions.slice(-50);
    saveStore();
    renderResult(s, results, correct, timeUp);
  }

  function renderResult(s, results, correct, timeUp) {
    var total = results.length, p = pct(correct, total);
    var bySec = {};
    results.forEach(function (r) { var k = r.it.q.secao; bySec[k] = bySec[k] || { c: 0, t: 0 }; bySec[k].t++; if (r.ok) bySec[k].c++; });
    var secs = Object.keys(bySec).sort(function (a, b) { return secNum(a) - secNum(b); });
    var wrong = results.filter(function (r) { return !r.ok; });
    var elapsed = Math.round((Date.now() - s.start) / 1000);
    var nota = (10 * correct / total).toFixed(1).replace('.', ',');

    render(h('div', null,
      h('section', { class: 'card', style: 'margin-top:20px' },
        h('h1', { tabindex: '-1', id: 'res-title' }, s.mode === 'simulado' ? 'Resultado do simulado' : 'Resultado do estudo'),
        timeUp ? h('p', { class: 'feedback bad', role: 'alert' }, '⏰ O tempo acabou. As perguntas sem resposta contam como erradas.') : null,
        h('div', { class: 'score' },
          h('div', { class: 'ring', style: '--p:' + p, role: 'img', 'aria-label': p + '% de acertos' }, h('b', null, p + '%')),
          h('div', null,
            h('p', { style: 'font-size:1.15rem;margin:0' }, h('strong', null, correct + ' de ' + total), ' corretas'),
            h('p', { class: 'muted', style: 'margin:0' }, 'Nota: ' + nota + ' / 10'),
            h('p', { class: 'muted small', style: 'margin:0' }, 'Tempo: ' + fmtTime(elapsed)))),
        h('div', { class: 'actions' },
          wrong.length ? h('button', { type: 'button', class: 'btn btn-primary', onclick: function () {
            startSession(Object.assign({}, s.prefs, { timer: false }), wrong.map(function (r) { return r.it.q.id; }));
          } }, 'Refazer só as que errei (' + wrong.length + ')') : null,
          h('button', { type: 'button', class: 'btn', onclick: renderHome }, 'Voltar ao início'))),
      h('section', { class: 'card', 'aria-labelledby': 'h-sec' },
        h('h2', { id: 'h-sec' }, 'Desempenho por seção'),
        h('div', { class: 'bars' }, secs.map(function (k) {
          var b = bySec[k], pp = pct(b.c, b.t);
          return h('div', { class: 'bar-row' }, h('span', null, k), h('span', { class: 'pct' }, b.c + '/' + b.t + ' · ' + pp + '%'),
            h('div', { class: 'bar', 'aria-hidden': 'true' }, h('i', { style: 'width:' + pp + '%' })));
        }))),
      h('section', { class: 'card', 'aria-labelledby': 'h-rev' },
        h('h2', { id: 'h-rev' }, 'Revisão dos erros'),
        wrong.length ? wrong.map(function (r) {
          var q = r.it.q;
          function lst(arr, cls) { return arr.length === 1 ? h('p', { class: cls, style: 'margin:2px 0' }, arr[0]) : h('ul', { class: 'plain ' + cls }, arr.map(function (t) { return h('li', null, t); })); }
          return h('div', { class: 'review-item' },
            tagsFor(q),
            h('p', { style: 'font-weight:600;margin:0' }, q.enunciado),
            h('div', { class: 'lbl' }, 'Sua resposta'), lst(r.answered ? describe(q, r.it.a) : ['(sem resposta)'], 'yours'),
            h('div', { class: 'lbl' }, 'Resposta correta'), lst(correctAnswer(q), 'right'),
            h('p', { style: 'margin:8px 0 0' }, q.explicacao),
            h('p', { class: 'ref muted small', style: 'margin:4px 0 0' }, '📖 ' + q.referencia));
        }) : h('p', { class: 'empty' }, '🎉 Nenhum erro. Parabéns!'))));
    var t = document.getElementById('res-title'); if (t) t.focus(); window.scrollTo(0, 0);
  }

  /* ------------------------------------------------------------ boot */
  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-action=home]');
    if (a) {
      e.preventDefault();
      if (session && session.mode === 'simulado' && !confirm('Sair do simulado em andamento?')) return;
      renderHome(); focusMain();
    }
  });

  fetch('data/questions.json', { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function (data) {
      ALL = data.filter(function (q) { return q && q.id && RENDER[q.tipo]; });
      ALL.forEach(function (q) { BY_ID[q.id] = q; });
      SECOES = [];
      ALL.forEach(function (q) { if (SECOES.indexOf(q.secao) < 0) SECOES.push(q.secao); });
      SECOES.sort(function (a, b) { return secNum(a) - secNum(b); });
      renderHome();
    })
    .catch(function (err) {
      render(h('div', { class: 'card', role: 'alert' },
        h('h2', null, 'Não foi possível carregar as perguntas'),
        h('p', null, 'Abra o site por um servidor (por exemplo, GitHub Pages ou "python -m http.server"), e não direto pelo arquivo.'),
        h('p', { class: 'muted small' }, String(err))));
    });
})();
