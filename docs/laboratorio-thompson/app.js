import { simulate, unified, ordered, visible, setText, EPSILON } from './engine.js';

const $ = id => document.getElementById(id);
const data = await fetch('./models.json').then(r => { if (!r.ok) throw Error('No se pudo cargar models.json'); return r.json(); });
const models = data.models;
const details = {
  var: ['Reservada var', 'Tres literales concatenados. q1→q2 y q3→q4 son enlaces λ.', 'q0 consume v; q2 consume a; q4 consume r para alcanzar q5.'],
  print: ['Reservada print', 'Cinco literales concatenados mediante cuatro enlaces λ.', 'q6, q8, q10, q12 y q14 consumen p, r, i, n y t.'],
  if: ['Reservada if', 'Dos literales concatenados por q17→q18 mediante λ.', 'q16 consume i y q18 consume f; solo entonces se llega a q19.'],
  else: ['Reservada else', 'Cuatro literales concatenados con enlaces λ.', 'q20, q22, q24 y q26 consumen e, l, s y e.'],
  id: ['Identificador', 'ID_INICIO es obligatorio; ID_CONT* permite cero o más continuaciones.', 'q28→q29 exige letra ASCII o _. Desde q32 se puede salir a q33 o repetir q30→q31. «var» también es ID en este AFND aislado.'],
  float: ['Número decimal', 'DÍGITO+ · . · DÍGITO+ concatena dos repeticiones positivas y un punto literal.', 'q34→q35 exige un dígito antes de q38→q39; q40→q41 exige otro antes de q43. «12.» queda incompleto.'],
  int: ['Número entero', 'DÍGITO+ exige una primera transición antes de repetir.', 'Desde q46 se llega a q44 por λ; q44→q45 consume el primer dígito. q45 repite o llega a q47.'],
  string: ['Cadena entre comillas', 'Las comillas son obligatorias y CUERPO_CADENA* puede estar vacío.', 'q48 abre la cadena; q52 permite omitir o recorrer q50→q51; q54→q55 exige la comilla de cierre. Extensión pendiente de confirmación docente.'],
  comment: ['Comentario de línea', 'Dos barras obligatorias seguidas de CUERPO_COMENTARIO*.', 'q56 y q58 consumen las barras. q62 permite cuerpo vacío o repeticiones q60→q61. CR y LF quedan fuera del lexema.'],
  op: ['Operador simple', 'Unión de cinco literales, abreviada por la clase OPERADOR.', 'q64→q65 consume exactamente un operador. La unión elemental con λ aparece en el esquema auxiliar.'],
  delim: ['Delimitador simple', 'Unión de cinco literales, abreviada por DELIMITADOR.', 'q66→q67 consume exactamente un delimitador. La expansión elemental se ilustra aparte.'],
  whitespace: ['Espacio en blanco', 'BLANCO+ exige al menos uno de espacio, TAB, CR o LF.', 'q70→q68 es λ; q68→q69 consume un blanco; q69 repite o acepta en q71. El Lexer omite este token.']
};
const formatInput = s => s === '' ? 'ε (cadena vacía)' : Array.from(s).map(visible).join(' ');
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let model = models[0], run, step = 0, timer = null, zoom = 1, fitZoom = true, tab = 'explorar', lessonIndex = 0, isUnified = false, quizMode = 'current';
let progress = {};
try { progress = JSON.parse(localStorage.getItem('thompson-progress-v1') || '{}'); } catch { progress = {}; }
function saveProgress() { try { localStorage.setItem('thompson-progress-v1', JSON.stringify(progress)); } catch {} }
function stop() { if (timer) clearInterval(timer); timer = null; $('play').disabled = false; $('pause').disabled = true; }
function switchTab(next) { tab = next; document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('selected', b.dataset.tab === next)); document.querySelectorAll('.tabview').forEach(s => s.hidden = s.id !== next); if (next === 'aprender') renderLesson(); if (next === 'practicar') renderQuiz(); }
document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));

function chooseModel(next, unifiedView = false) {
  stop(); model = next; isUnified = unifiedView; step = 0; zoom = matchMedia('(max-width: 600px)').matches ? .8 : 1; fitZoom = !matchMedia('(max-width: 600px)').matches; lessonIndex = 0;
  document.querySelectorAll('.modelbtn').forEach(b => { const selected = !isUnified && b.dataset.id === next.id; b.classList.toggle('selected', selected); b.setAttribute('aria-current', selected ? 'true' : 'false'); });
  $('unify').classList.toggle('selected', isUnified);
  $('section').textContent = isUnified ? 'VISTA COMPLEMENTARIA · q72' : `SECCIÓN ${next.section}`;
  $('title').textContent = isUnified ? 'Lexer unificado' : next.name;
  $('subtitle').textContent = isUnified ? 'q72 conecta por λ los doce fragmentos. La prioridad léxica se decide después de reconocer el lexema completo.' : details[next.id][0];
  $('regex').textContent = isUnified ? 'Unión λ de los 12 fragmentos' : next.regex;
  $('input').value = isUnified ? 'var' : next.examples.accept[0];
  $('examples').replaceChildren(); $('exampleSelect').replaceChildren(new Option('Elige un ejemplo', ''));
  if (!isUnified) for (const [kind, values] of Object.entries(next.examples)) for (const value of values) {
    const button = document.createElement('button'); button.textContent = `${kind === 'accept' ? '✓' : '×'} ${formatInput(value)}`;
    button.classList.toggle('invalid', kind === 'reject'); button.addEventListener('click', () => { $('input').value = value; rebuild(); }); $('examples').append(button);
    $('exampleSelect').add(new Option(`${kind === 'accept' ? '✓ Válida' : '× Inválida'} · ${formatInput(value)}`, value));
  }
  $('aux').hidden = !(next.id === 'op' || next.id === 'delim') || isUnified;
  if (!$('aux').hidden) drawAux();
  rebuild(); if (tab === 'aprender') renderLesson(); if (tab === 'practicar') renderQuiz();
}
models.forEach(m => { const b = document.createElement('button'); b.className = 'modelbtn'; b.dataset.id = m.id; b.title = `${m.section} · ${m.name}`; b.setAttribute('aria-label', b.title); b.innerHTML = `<span class="modelshort">${m.section}</span><span class="modeltext"><strong>${m.section} · ${m.name}</strong><small>${details[m.id][0]}</small></span>`; b.addEventListener('click', () => { chooseModel(m); if (matchMedia('(max-width: 760px)').matches) setMenuOpen(false); }); $('models').append(b); });
const searchKey = text => text.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
$('modelSearch').addEventListener('input', event => {
  const query = searchKey(event.target.value.trim());
  let visibleCount = 0;
  for (const m of models) {
    const button = $('models').querySelector(`[data-id="${m.id}"]`);
    button.hidden = !searchKey(`${m.section} ${m.name} ${m.id} ${details[m.id][0]}`).includes(query);
    if (!button.hidden) visibleCount++;
  }
  $('noModels').hidden = visibleCount !== 0;
});
$('unify').addEventListener('click', () => chooseModel(model, true));
function setMenuOpen(open) { $('shell').classList.toggle('menu-collapsed', !open); $('sidebarToggle').setAttribute('aria-expanded', String(open)); $('sidebarToggle').setAttribute('aria-label', open ? 'Contraer menú de ejercicios' : 'Expandir menú de ejercicios'); $('sidebarToggle').title = open ? 'Contraer menú' : 'Expandir menú'; requestAnimationFrame(drawGraph); }
$('sidebarToggle').addEventListener('click', () => setMenuOpen($('shell').classList.contains('menu-collapsed')));
$('exampleSelect').addEventListener('change', e => { $('input').value = e.target.value; rebuild(); });
function rebuild() { stop(); run = isUnified ? unified(models, data.unification, $('input').value) : simulate(model, $('input').value); step = 0; render(); }
$('input').addEventListener('input', rebuild);
$('reset').addEventListener('click', () => { stop(); step = 0; render(); });
$('prev').addEventListener('click', () => { stop(); step = Math.max(0, step - 1); render(); });
$('next').addEventListener('click', () => { stop(); step = Math.min(run.steps.length - 1, step + 1); render(); });
$('all').addEventListener('click', () => { stop(); step = run.steps.length - 1; render(); });
$('play').addEventListener('click', () => { if (step >= run.steps.length - 1) step = 0; stop(); $('play').disabled = true; $('pause').disabled = false; render(); timer = setInterval(() => { if (step < run.steps.length - 1) { step++; render(); if (step === run.steps.length - 1) stop(); } else stop(); }, Number($('speed').value)); });
$('pause').addEventListener('click', stop);
$('speed').addEventListener('change', () => { if (timer) { stop(); $('play').click(); } });
for (const [id, factor] of [['zoomIn',1.2],['zoomOut',1/1.2]]) $(id).addEventListener('click', () => { zoom = Math.max(.4, Math.min(3, zoom * factor)); drawGraph(); });
$('zoomFit').addEventListener('click', () => { fitZoom = true; zoom = 1; drawGraph(); });
$('zoomReset').addEventListener('click', () => { fitZoom = false; zoom = 1; drawGraph(); });
function render() {
  const s = run.steps[step], done = step === run.steps.length - 1, accepted = run.accepted;
  $('status').className = 'status' + (done ? accepted ? ' accept' : ' reject' : '');
  $('status').textContent = done ? accepted ? 'ACEPTADO' : 'RECHAZADO' : `PASO ${step} / ${run.steps.length - 1}`;
  $('stepCount').textContent = `Paso ${step} / ${run.steps.length - 1}`;
  $('result').textContent = done ? accepted ? 'Aceptado' : 'Rechazado' : 'En curso';
  $('result').className = 'result' + (done ? accepted ? ' accept' : ' reject' : '');
  const chars = Array.from(run.input);
  $('consumed').textContent = formatInput(chars.slice(0, step).join(''));
  $('remaining').textContent = formatInput(chars.slice(step).join(''));
  $('active').textContent = setText(s.after);
  $('progressFill').style.width = `${run.steps.length === 1 ? 100 : step / (run.steps.length - 1) * 100}%`;
  $('prev').disabled = step === 0; $('next').disabled = done;
  const verdict = done ? accepted
    ? ` La cadena completa termina con ${isUnified ? 'uno o más estados finales' : model.finals.join(', ')} en la cerradura: pertenece al lenguaje.${isUnified ? ` Coinciden ${run.candidates.map(m => m.name).join(', ')}; con prioridad de reservadas se elige ${run.chosen?.name}.` : ''}`
    : ` La cadena completa termina sin ${isUnified ? 'ningún final' : model.finals.join(', ')} en la cerradura: se rechaza. Un prefijo aceptado no basta si queda entrada.` : ' La aceptación se decide únicamente al consumir toda la entrada.';
  $('explanation').textContent = `${s.explanation}${verdict}`;
  $('explanation').classList.toggle('reject', done && !accepted);
  drawGraph(); drawTrace();
}
function drawTrace() {
  $('traceRows').replaceChildren();
  run.steps.forEach((s, index) => { const tr = document.createElement('tr'); tr.classList.toggle('current', index === step); tr.innerHTML = `<td>${s.number}</td><td><code>${esc(index ? visible(s.character) : 'ε / inicio')}</code></td><td><code>${esc(index ? setText(s.before) : '—')}</code></td><td><code>${esc(setText(s.move))}</code></td><td><code>${esc(setText(s.after))}</code></td><td>${s.after.some(q => (isUnified ? models.flatMap(m => m.finals) : model.finals).includes(q)) ? 'Sí' : 'No'}</td>`; tr.addEventListener('click', () => { stop(); step = index; render(); }); $('traceRows').append(tr); });
}
const traceText = () => ['Paso\tCarácter\tAntes\tMueve\tCerradura λ\tFinal', ...run.steps.map((s,i) => [i, i ? visible(s.character) : 'ε / inicio', i ? setText(s.before) : '—', setText(s.move), setText(s.after), s.after.some(q => (isUnified ? models.flatMap(m => m.finals) : model.finals).includes(q)) ? 'Sí' : 'No'].join('\t'))].join('\n');
$('copy').addEventListener('click', async () => { try { await navigator.clipboard.writeText(traceText()); $('copy').textContent = 'Copiado'; setTimeout(() => $('copy').textContent = 'Copiar texto', 1700); } catch { alert('El portapapeles no está disponible en este contexto. Usa la exportación CSV.'); } });
$('csv').addEventListener('click', () => { const quote = v => `"${String(v).replaceAll('"','""')}"`; const rows = [['Paso','Carácter','Estados anteriores','Mueve','Nueva λ-cerradura','Final alcanzado'], ...run.steps.map((s,i) => [i, i ? visible(s.character) : 'ε / inicio', i ? setText(s.before) : '—', setText(s.move), setText(s.after), s.after.some(q => (isUnified ? models.flatMap(m => m.finals) : model.finals).includes(q)) ? 'Sí' : 'No'])]; const a = document.createElement('a'), url = URL.createObjectURL(new Blob(['\ufeff' + rows.map(r => r.map(quote).join(',')).join('\r\n')], {type:'text/csv;charset=utf-8'})); a.href = url; a.download = `traza-${isUnified ? 'unificado' : model.id}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); });

const NS = 'http://www.w3.org/2000/svg';
function svg(name, attrs, parent) { const n = document.createElementNS(NS,name); for (const [k,v] of Object.entries(attrs)) n.setAttribute(k,String(v)); parent.append(n); return n; }
const special = {
  id: {q28:[90,150],q29:[255,150],q32:[425,150],q30:[575,325],q31:[790,325],q33:[980,150]},
  float: {q36:[65,150],q34:[190,150],q35:[325,150],q37:[460,150],q38:[585,150],q39:[710,150],q42:[850,150],q40:[850,325],q41:[1010,325],q43:[1130,150]},
  int: {q46:[80,150],q44:[290,150],q45:[515,150],q47:[735,150]},
  string: {q48:[65,150],q49:[200,150],q52:[365,150],q50:[485,325],q51:[685,325],q53:[735,150],q54:[880,150],q55:[1020,150]},
  comment: {q56:[60,150],q57:[190,150],q58:[320,150],q59:[450,150],q62:[600,150],q60:[695,325],q61:[885,325],q63:[1030,150]},
  whitespace: {q70:[80,150],q68:[290,150],q69:[515,150],q71:[735,150]}
};
function layout(m) { if (special[m.id]) return special[m.id]; const nodes = ordered([m.start,...m.finals,...m.edges.flatMap(e => [e.from_state,e.to_state])]); return Object.fromEntries(nodes.map((n,i) => [n,[85+i*135,150]])); }
function sizeDiagram(graph) {
  const bounds = graph.getBBox(), marginX = 26, marginY = 20;
  const width = Math.max(1, bounds.width + marginX * 2), height = Math.max(1, bounds.height + marginY * 2);
  graph.setAttribute('viewBox', `${bounds.x - marginX} ${bounds.y - marginY} ${width} ${height}`);
  const box = $('graph');
  const availableWidth = Math.max(1, box.clientWidth - 24), availableHeight = Math.max(1, box.clientHeight - 20);
  const scale = (fitZoom ? Math.min(availableWidth / width, availableHeight / height) : 1) * zoom;
  graph.setAttribute('width', Math.round(width * scale));
  graph.setAttribute('height', Math.round(height * scale));
}
function drawGraph() {
  const graph = $('diagram'); graph.replaceChildren();
  if (isUnified) { drawUnified(graph); return; }
  const coords = layout(model);
  const defs = svg('defs',{},graph);
  for (const [id,color] of [['arrow','#7f98a8'],['arrowGold','#f6bb70'],['arrowGreen','#79e6a2']]) { const marker = svg('marker',{id,markerWidth:10,markerHeight:10,refX:9,refY:4,orient:'auto',markerUnits:'userSpaceOnUse'},defs); svg('path',{d:'M0 0 L9 4 L0 8 Z',fill:color},marker); }
  const s = run.steps[step];
  for (const [i,e] of model.edges.entries()) {
    const a = coords[e.from_state], b = coords[e.to_state], reverse = b[0] <= a[0], sameRow = Math.abs(a[1]-b[1]) < 25;
    const dx=b[0]-a[0], dy=b[1]-a[1], len=Math.hypot(dx,dy), ux=dx/len, uy=dy/len;
    let x1=a[0]+ux*30,y1=a[1]+uy*30,x2=b[0]-ux*34,y2=b[1]-uy*34;
    let d, lx, ly;
    if (reverse && sameRow) { const arc = 120; d=`M${x1},${y1} C${x1+20},${y1+arc} ${x2-20},${y2+arc} ${x2},${y2}`; lx=(a[0]+b[0])/2; ly=a[1]+arc*.73; }
    else if (!reverse && sameRow && b[0]-a[0]>350) { const arc=-125; d=`M${x1},${y1} Q${(x1+x2)/2},${arc} ${x2},${y2}`; lx=(a[0]+b[0])/2; ly=30; }
    else { d=`M${x1},${y1} L${x2},${y2}`; lx=(x1+x2)/2; ly=(y1+y2)/2-12; if (!sameRow) lx += 24; }
    const cls = s.symbolEdges.includes(i) ? 'edge used-symbol' : s.lambdaEdges.includes(i) ? 'edge used-lambda' : e.symbol===EPSILON ? 'edge lambda' : 'edge';
    svg('path',{d,class:cls},graph); const label=svg('text',{x:lx,y:ly,class:'edge-label'},graph); label.textContent=e.symbol;
  }
  const start = coords[model.start]; svg('path',{d:`M${start[0]-75},${start[1]} L${start[0]-31},${start[1]}`,class:'edge'},graph); const startLabel=svg('text',{x:start[0]-70,y:start[1]-12,class:'start-label'},graph); startLabel.textContent='inicio';
  for (const [id,[x,y]] of Object.entries(coords)) { const g=svg('g',{class:`node${s.after.includes(id) ? ' active':''}`},graph); svg('circle',{cx:x,cy:y,r:29},g); if (model.finals.includes(id)) svg('circle',{cx:x,cy:y,r:23,class:'inner'},g); const t=svg('text',{x,y:y+1},g); t.textContent=id; }
  sizeDiagram(graph);
  graph.setAttribute('aria-label',`${model.name}: ${Object.keys(coords).length} estados y ${model.edges.length} transiciones. ${s.explanation}`);
}
function drawUnified(graph) {
  const defs=svg('defs',{},graph), marker=svg('marker',{id:'uniArrow',markerWidth:10,markerHeight:10,refX:9,refY:4,orient:'auto'},defs); svg('path',{d:'M0 0 L9 4 L0 8 Z',fill:'#79e6a2'},marker);
  const center=[155,300]; const group=svg('g',{class:`node${run.steps[step].after.includes('q72')?' active':''}`},graph); svg('circle',{cx:center[0],cy:center[1],r:30},group); const t=svg('text',{x:center[0],y:center[1]},group); t.textContent='q72';
  models.forEach((m,i) => { const x=435+(i%3)*190,y=60+Math.floor(i/3)*150; const line=svg('path',{d:`M185,300 Q${310},${y} ${x-33},${y}`,fill:'none',stroke:step===0?'#79e6a2':'#7f98a8','stroke-width':2,'stroke-dasharray':'6 5','marker-end':'url(#uniArrow)'},graph); const label=svg('text',{x:x-78,y:y-12,class:'edge-label'},graph); label.textContent='λ'; const g=svg('g',{class:`node${run.steps[step].after.includes(m.start)?' active':''}`},graph); svg('circle',{cx:x,cy:y,r:29},g); const text=svg('text',{x,y},g); text.textContent=m.start; const name=svg('text',{x:x+42,y:y+5,class:'start-label'},graph); name.textContent=m.name; });
  sizeDiagram(graph);
  graph.setAttribute('aria-label','Vista complementaria: q72 tiene doce transiciones λ hacia los estados iniciales originales.');
}
new ResizeObserver(() => { if (run) drawGraph(); }).observe($('graph'));
function drawAux() {
  const literals = model.id === 'op' ? ['+','−','*','/','='] : ['(',')',';','{','}'];
  const root = $('aux'); root.replaceChildren(); const title=document.createElement('strong'); title.textContent='Expansión didáctica de la unión de Thompson'; root.append(title);
  const p=document.createElement('p'); p.textContent=`Los estados auxiliares Aᵢ y Bᵢ pertenecen solo a este esquema. El diagrama original conserva ${model.start} → ${model.finals[0]} con una transición de clase compacta equivalente.`; root.append(p);
  const g=document.createElementNS(NS,'svg'); g.setAttribute('viewBox','0 0 900 380'); root.append(g);
  const defs=svg('defs',{},g), marker=svg('marker',{id:'auxArrow',markerWidth:10,markerHeight:10,refX:9,refY:4,orient:'auto'},defs); svg('path',{d:'M0 0 L9 4 L0 8 Z',fill:'#8bb6bc'},marker);
  const node=(x,y,label) => { const z=svg('g',{class:'node'},g); svg('circle',{cx:x,cy:y,r:22},z); const t=svg('text',{x,y},z); t.textContent=label; };
  const line=(x1,y1,x2,y2,label) => { svg('path',{d:`M${x1},${y1} L${x2-23},${y2}`,stroke:'#8bb6bc','stroke-width':2,fill:'none','marker-end':'url(#auxArrow)'},g); const t=svg('text',{x:(x1+x2)/2,y:(y1+y2)/2-5,class:'edge-label'},g); t.textContent=label; };
  node(65,190,'A'); node(830,190,'B'); literals.forEach((c,i) => { const y=45+i*72; node(285,y,`A${i+1}`); node(590,y,`B${i+1}`); line(87,190,285,y,'λ'); line(307,y,590,y,c); line(612,y,830,190,'λ'); });
}

function lessonStages(m) { const d=details[m.id], yes=m.examples.accept[0], no=m.examples.reject[0]; return [
  ['1. Objetivo del token',`${m.name} reconoce ${d[0].toLowerCase()} como un lexema completo de MathScript. Inicio ${m.start}; final ${m.finals.join(', ')}.`],
  ['2. Expresión regular',`La expresión es ${m.regex}. ${d[1]}`],
  ['3. Operaciones de Thompson',d[1] + ' Las conexiones λ unen fragmentos sin consumir entrada. Las etiquetas de clase abrevian conjuntos finitos de caracteres.'],
  ['4. Diagrama existente',`${d[2]} Se conservan exactamente ${m.edges.length} transiciones del modelo verificado.`, `Transiciones: ${m.edges.map(e=>`${e.from_state} —${e.symbol}→ ${e.to_state}`).join(' · ')}`],
  ['5. Entrada válida',`Analiza ${formatInput(yes)}. El motor alcanza ${m.finals[0]} tras consumir la cadena completa.`, traceSample(m,yes)],
  ['6. Entrada inválida',`Analiza ${formatInput(no)}. Al terminar, el estado final no pertenece a la λ-cerradura.`, traceSample(m,no)],
  ['7. Conclusión matemática',`Para cada carácter c: Siguiente = Cerraduraλ(Mueve(Actual, c)). ${m.name} acepta si, al terminar toda la entrada, ${m.finals[0]} pertenece al conjunto resultante. ${m.id==='id'?'La prioridad de reservadas se aplica en el Lexer unificado.':''}`]
]; }
function traceSample(m,input) { const r=simulate(m,input); return r.steps.map(s=>`${s.number}: ${visible(s.character)} → ${setText(s.after)}`).join('\n'); }
function renderLesson() { const stages=lessonStages(model), [title,body,sample]=stages[lessonIndex]; $('lessonTitle').textContent=`${model.section} · ${model.name}`; $('lessonStep').textContent=`ETAPA ${lessonIndex+1} / 7`; $('lessonBody').innerHTML=`<h3>${esc(title)}</h3><p>${esc(body)}</p>${sample?`<div class="sample">${esc(sample)}</div>`:''}`; $('lessonPrev').disabled=lessonIndex===0; $('lessonNext').disabled=lessonIndex===6; }
$('lessonPrev').addEventListener('click',()=>{ lessonIndex--;renderLesson(); }); $('lessonNext').addEventListener('click',()=>{ lessonIndex++;renderLesson(); });

function questions(m) {
  const yes=m.examples.accept[0], no=m.examples.reject[0], first=m.edges.find(e=>e.symbol!==EPSILON), lambda=m.edges.find(e=>e.symbol===EPSILON);
  return [
    {q:`¿Se acepta ${formatInput(yes)} como ${m.name}?`,choices:['Sí, como lexema completo','No, se rechaza'],answer:0,why:`La simulación termina en ${setText(simulate(m,yes).steps.at(-1).after)}, que contiene ${m.finals[0]}.`},
    {q:`¿Se acepta ${formatInput(no)} como ${m.name}?`,choices:['Sí, como lexema completo','No, se rechaza'],answer:1,why:`Al consumir toda la entrada, la cerradura es ${setText(simulate(m,no).steps.at(-1).after)}. ${m.finals[0]} no está presente.`},
    {q:`¿Cuál es la expresión regular de ${m.name}?`,choices:[m.regex,'Σ* (cualquier cadena)','λ (solo la cadena vacía)'],answer:0,why:`La expresión del capítulo 3 es ${m.regex}. ${details[m.id][1]}`},
    {q:`¿Qué transición aparece realmente en el diagrama?`,choices:[`${first.from_state} —${first.symbol}→ ${first.to_state}`,`${first.to_state} —${first.symbol}→ ${first.from_state}`,'Una transición con cualquier Unicode'],answer:0,why:`El JSON verificado contiene ${first.from_state} —${first.symbol}→ ${first.to_state}. La dirección de la flecha importa.`},
    {q:`¿Qué describe mejor la construcción de ${m.name}?`,choices:[details[m.id][1], 'Toda λ consume un carácter.', 'Aceptar un prefijo equivale a aceptar la cadena completa.'],answer:0,why:`${details[m.id][1]}${lambda?` Por ejemplo, ${lambda.from_state} —λ→ ${lambda.to_state} no consume entrada.`:' El diagrama principal usa una clase compacta equivalente a una unión por λ.'}`}
  ];
}
function renderQuiz() {
  const selected = quizMode === 'general' ? models.map((m,i)=>({m,q:questions(m)[i%5]})) : questions(model).map(q=>({m:model,q}));
  $('practiceCurrent').classList.toggle('primary',quizMode==='current'); $('practiceGeneral').classList.toggle('primary',quizMode==='general');
  $('practiceProgress').textContent = `${Object.values(progress).filter(Boolean).length} respuestas correctas guardadas`;
  const box=$('quiz'); box.replaceChildren(); const heading=document.createElement('h3'); heading.textContent=quizMode==='general'?'Evaluación general · 12 preguntas':'Ejercicio '+model.section+' · '+model.name; box.append(heading);
  selected.forEach(({m,q},i)=> { const id=`${quizMode}-${m.id}-${i}`; const section=document.createElement('div'); section.className='question'; section.innerHTML=`<h3>${i+1}. ${esc(q.q)}</h3><div class="choices">${q.choices.map((c,j)=>`<label><input type="radio" name="${id}" value="${j}"> ${esc(c)}</label>`).join('')}</div><button type="button">Comprobar respuesta</button><div class="feedback" hidden></div>`; const button=section.querySelector('button'), feedback=section.querySelector('.feedback'); button.addEventListener('click',()=>{ const checked=section.querySelector('input:checked'); if(!checked){feedback.hidden=false; feedback.textContent='Selecciona una respuesta antes de consultar la explicación.'; return;} const correct=Number(checked.value)===q.answer; feedback.hidden=false; feedback.classList.toggle('wrong',!correct); feedback.textContent=`${correct?'Correcto.':'Revisa tu respuesta.'} ${q.why}`; section.querySelectorAll('input').forEach(x=>x.disabled=true); button.disabled=true; progress[id]=correct; saveProgress(); $('practiceProgress').textContent=`${Object.values(progress).filter(Boolean).length} respuestas correctas guardadas`; updateScore(); }); box.append(section); }); const score=document.createElement('div'); score.className='callout'; score.id='score'; box.append(score); updateScore();
  function updateScore(){ const answered=[...box.querySelectorAll('.question')].filter(s=>s.querySelector('button').disabled); const correct=answered.filter(s=>!s.querySelector('.feedback').classList.contains('wrong')).length; score.textContent=`Calificación de esta sesión: ${correct}/${selected.length}. Respondidas: ${answered.length}/${selected.length}. Las explicaciones se muestran después de cada respuesta.`; }
}
$('practiceCurrent').addEventListener('click',()=>{quizMode='current';renderQuiz();}); $('practiceGeneral').addEventListener('click',()=>{quizMode='general';renderQuiz();}); $('clearProgress').addEventListener('click',()=>{progress={};try{localStorage.removeItem('thompson-progress-v1')}catch{}renderQuiz();});

const concepts=[
  ['AFND-λ','Autómata finito no determinista que puede mantener varios estados activos y recorrer λ sin consumir entrada.'],
  ['Expresión regular','Descripción algebraica de un lenguaje. Por ejemplo, DÍGITO+ representa uno o más dígitos.'],
  ['Concatenación','R·S exige consumir primero un lexema de R y luego uno de S. Thompson enlaza fragmentos con λ.'],
  ['Unión','R|S permite elegir una rama. La construcción elemental bifurca y reúne mediante λ.'],
  ['Cerradura de Kleene','R* admite cero o más repeticiones; por eso ID_CONT* puede omitirse después del primer carácter.'],
  ['Repetición positiva','R+ requiere al menos una repetición. TOKEN_INT no acepta ε.'],
  ['Transición λ','Paso entre estados sin leer un carácter. ε representa la cadena vacía; λ etiqueta una arista.'],
  ['λ-cerradura','Conjunto de estados alcanzables desde un conjunto mediante cero o más transiciones λ.'],
  ['Aceptación','Se acepta al terminar toda la entrada si algún estado final pertenece a la cerradura actual.'],
  ['AFND-λ y AFD','El AFND-λ puede tener varias rutas y λ; un AFD tiene un único siguiente estado por símbolo y no usa λ.']
];
const glossary=[['Σ','Alfabeto formal: ASCII imprimible (32–126), TAB, CR y LF.'],['Mueve','Estados alcanzados con exactamente un carácter desde el conjunto actual.'],['Lexema','Secuencia completa reconocida por una categoría, como «var» o «12.0».'],['Prioridad léxica','En el Lexer unificado, «var» coincide con TOKEN_VAR y TOKEN_ID; se prioriza la reservada.'],['Clase compacta','OPERADOR y DELIMITADOR resumen cinco alternativas; la expansión por unión se muestra aparte.'],['Prefijo','«va» avanza en TOKEN_VAR, pero no termina en q5; no es el lexema completo.']];
for(const [target,items] of [['concepts',concepts],['glossary',glossary]]) $(target).innerHTML=items.map(([name,description])=>`<article><h3>${esc(name)}</h3><p>${esc(description)}</p></article>`).join('');
chooseModel(models[0]);
