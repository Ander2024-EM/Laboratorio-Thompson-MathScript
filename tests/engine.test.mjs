import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { simulate, unified, closure, move, matches, alphabet } from '../docs/laboratorio-thompson/engine.js';

const { models, unification } = JSON.parse(readFileSync(new URL('../docs/laboratorio-thompson/models.json', import.meta.url), 'utf8'));
const byId = Object.fromEntries(models.map(m => [m.id,m]));
const accepts = (id,s) => simulate(byId[id],s).accepted;

test('12 modelos, numeración y 76 entradas de referencia', () => {
  assert.equal(models.length,12);
  const starts=['q0','q6','q16','q20','q28','q36','q46','q48','q56','q64','q66','q70'];
  const finals=['q5','q15','q19','q27','q33','q43','q47','q55','q63','q65','q67','q71'];
  let count=0;
  models.forEach((m,i) => { assert.equal(m.start,starts[i]); assert.deepEqual(m.finals,[finals[i]]); for(const s of m.examples.accept){assert.equal(accepts(m.id,s),true,`${m.name}: ${JSON.stringify(s)} debe aceptarse`);count++;} for(const s of m.examples.reject){assert.equal(accepts(m.id,s),false,`${m.name}: ${JSON.stringify(s)} debe rechazarse`);count++;} });
  assert.equal(count,76);
});
test('cadena vacía, λ múltiples y prefijos', () => {
  for(const m of models) assert.equal(simulate(m,'').accepted,false,m.name);
  assert.deepEqual(closure(byId.id,['q29']).states,['q29','q30','q32','q33']);
  assert.deepEqual(closure(byId.id,['q31']).states,['q30','q31','q33']);
  assert.equal(accepts('var','va'),false); assert.equal(accepts('print','prin'),false);
});
test('prioridad y coincidencia entre ID y reservadas', () => {
  for(const s of ['var','print','if','else']) assert.equal(accepts('id',s),true);
  assert.equal(unified(models,unification,'var').chosen.name,'TOKEN_VAR');
  assert.equal(unified(models,unification,'print').chosen.name,'TOKEN_PRINT');
});
test('números, cadenas, comentarios y blancos', () => {
  for(const s of ['0','007','2026']) assert.equal(accepts('int',s),true);
  for(const s of ['0.5','12.0']) assert.equal(accepts('float',s),true);
  for(const s of ['12.','.5','12.3.4']) assert.equal(accepts('float',s),false);
  assert.equal(accepts('comment','//'),true); assert.equal(accepts('comment','//a\n'),false);
  assert.equal(accepts('string','""'),true); assert.equal(accepts('string','"a\nb"'),false);
  assert.equal(accepts('whitespace','\t\r\n'),true);
});
test('alfabeto formal, operadores y delimitadores', () => {
  assert.equal(alphabet('é'),false); assert.equal(alphabet('😀'),false);
  assert.equal(accepts('id','é'),false); assert.equal(accepts('string','"ñ"'),false);
  assert.equal(accepts('comment','//ñ'),false);
  for(const s of '+-*/=') assert.equal(accepts('op',s),true);
  for(const s of '();{}') assert.equal(accepts('delim',s),true);
  assert.equal(accepts('op','++'),false); assert.equal(accepts('delim','()'),false);
});
test('traza y transiciones efectivamente recorridas', () => {
  const r=simulate(byId.var,'var');
  assert.equal(r.steps.length,4);
  assert.deepEqual(r.steps[1].symbolEdges,[0]);
  assert.deepEqual(r.steps[1].lambdaEdges,[1]);
  assert.deepEqual(r.steps[2].symbolEdges,[2]);
  assert.deepEqual(r.steps[2].lambdaEdges,[3]);
  assert.deepEqual(r.steps[3].symbolEdges,[4]);
  assert.deepEqual(r.steps[3].lambdaEdges,[]);
  for(const s of r.steps.slice(1)) assert.deepEqual(closure(byId.var,s.move).states,s.after);
  assert.deepEqual(move(byId.var,['q0'],'v').states,['q1']);
  assert.equal(matches('OPERADOR','/'),true);
});
test('retroceso y avance: las instantáneas permanecen inmutables y sincronizadas', () => {
  const run=simulate(byId.id,'total2');
  const before=JSON.stringify(run.steps);
  let index=0; index++; index++; index--; index++;
  assert.equal(index,2); assert.equal(run.steps[index].number,2);
  assert.deepEqual(closure(byId.id,run.steps[index].move).states,run.steps[index].after);
  assert.equal(JSON.stringify(run.steps),before);
});
