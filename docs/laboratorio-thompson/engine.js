export const EPSILON = 'λ';
export const alphabet = c => c.length === 1 && ((c.charCodeAt(0) >= 32 && c.charCodeAt(0) <= 126) || '\t\r\n'.includes(c));
export const ordered = states => [...new Set(states)].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
export const visible = c => c === '' ? 'ε (cadena vacía)' : c === ' ' ? 'ESPACIO' : c === '\t' ? 'TAB' : c === '\r' ? 'CR' : c === '\n' ? 'LF' : c;
export const setText = states => states.length ? `{${ordered(states).join(', ')}}` : '∅';

export function matches(label, c) {
  if (!alphabet(c)) return false;
  const code = c.charCodeAt(0);
  const digit = code >= 48 && code <= 57;
  const letter = code >= 65 && code <= 90 || code >= 97 && code <= 122;
  switch (label) {
    case 'DÍGITO': return digit;
    case 'ID_INICIO': return letter || c === '_';
    case 'ID_CONT': return letter || digit || c === '_';
    case 'COMILLA': return c === '"';
    case 'CUERPO_CADENA': return c === '\t' || code >= 32 && code <= 126 && c !== '"';
    case 'CUERPO_COMENTARIO': return c === '\t' || code >= 32 && code <= 126;
    case 'OPERADOR': return '+-*/='.includes(c);
    case 'DELIMITADOR': return '();{}'.includes(c);
    case 'BLANCO': return ' \t\r\n'.includes(c);
    default: return label === c;
  }
}

export function closure(model, seeds) {
  const seen = new Set(seeds), pending = [...seeds], traversed = [];
  while (pending.length) {
    const state = pending.shift();
    model.edges.forEach((edge, index) => {
      if (edge.from_state === state && edge.symbol === EPSILON && !seen.has(edge.to_state)) {
        seen.add(edge.to_state);
        pending.push(edge.to_state);
        traversed.push(index);
      }
    });
  }
  return { states: ordered(seen), edges: traversed };
}

export function move(model, states, character) {
  const reached = new Set(), traversed = [];
  model.edges.forEach((edge, index) => {
    if (states.includes(edge.from_state) && edge.symbol !== EPSILON && matches(edge.symbol, character)) {
      reached.add(edge.to_state);
      traversed.push(index);
    }
  });
  return { states: ordered(reached), edges: traversed };
}

export function simulate(model, input) {
  const chars = Array.from(input);
  const first = closure(model, [model.start]);
  const steps = [{ number: 0, character: '', before: [], move: [model.start], after: first.states,
    symbolEdges: [], lambdaEdges: first.edges, invalid: false,
    explanation: `Inicio en ${model.start}. Su λ-cerradura es ${setText(first.states)}; ningún carácter se ha consumido.` }];
  for (let i = 0; i < chars.length; i++) {
    const character = chars[i], before = steps.at(-1).after;
    const invalid = !alphabet(character);
    const moved = invalid ? { states: [], edges: [] } : move(model, before, character);
    const closed = closure(model, moved.states);
    const explanation = invalid
      ? `${visible(character)} está fuera de Σ (ASCII imprimible, TAB, CR, LF). El conjunto alcanzable queda vacío.`
      : moved.states.length
        ? `Con ${visible(character)}, Mueve(${setText(before)}, ${visible(character)}) = ${setText(moved.states)}. Se recorren ${moved.edges.length} transición(es) de carácter y ${closed.edges.length} transición(es) λ; la nueva cerradura es ${setText(closed.states)}.`
        : `No hay transición aplicable desde ${setText(before)} con ${visible(character)}. Mueve = ∅ y su λ-cerradura también es ∅.`;
    steps.push({ number: i + 1, character, before, move: moved.states, after: closed.states,
      symbolEdges: moved.edges, lambdaEdges: closed.edges, invalid, explanation });
  }
  const accepted = steps.at(-1).after.some(s => model.finals.includes(s));
  return { steps, accepted, input, model };
}

export function unified(models, unification, input) {
  const edges = models.flatMap(m => m.edges).concat(unification.epsilon_to.map(to_state => ({ from_state: unification.start, to_state, symbol: EPSILON })));
  const combined = { start: unification.start, finals: models.flatMap(m => m.finals), edges };
  const run = simulate(combined, input);
  const candidates = models.filter(m => run.steps.at(-1).after.some(s => m.finals.includes(s)));
  const reserved = new Set(['TOKEN_VAR', 'TOKEN_PRINT', 'TOKEN_IF', 'TOKEN_ELSE']);
  const chosen = candidates.find(m => reserved.has(m.name)) || candidates.find(m => m.name === 'TOKEN_COMMENT') || candidates[0] || null;
  return { ...run, candidates, chosen };
}
