/* Real assertions for the deterministic workflow engine.
   Run with: node tests/index.test.js  (also wired to `npm test`) */
'use strict';
const assert=require('assert');
const core=require('../workflow-core.js');
let passed=0;
const tests=[];
function test(name,fn){tests.push([name,fn])}

const NOTES='The local runtime is deterministic. Provider keys are never transmitted. Citations matter for trust.';

test('selectContext returns only sentences matching the lookup phrase',()=>{
  const out=core.selectContext(NOTES,'citation');
  assert.strictEqual(out,'Citations matter for trust','unexpected selection: '+out);
  assert.ok(!/Provider keys/.test(out),'unrelated sentence leaked into context');
});

test('selectContext matches case-insensitively, splits on any term, and ignores an empty phrase',()=>{
  assert.strictEqual(core.selectContext(NOTES,'DETERMINISTIC'),'The local runtime is deterministic');
  assert.strictEqual(core.selectContext(NOTES,''),'','empty phrase must match nothing');
  assert.strictEqual(core.selectContext(NOTES,'zzz-not-present'),'','absent phrase must yield no context');
  assert.strictEqual(core.selectContext(NOTES,'provider orphan-words'),'Provider keys are never transmitted','any term in the phrase is enough');
});

test('interpolate fills {{input}} and {{context}}',()=>{
  const out=core.interpolate('A {{input}} B {{context}} C','IN','CTX');
  assert.strictEqual(out,'A IN B CTX C');
});

test('interpolate never re-scans substituted data for the other token',()=>{
  assert.strictEqual(core.interpolate('{{input}}','keep {{context}} literal','CTX'),'keep {{context}} literal','input data must not be rescanned for {{context}}');
  assert.strictEqual(core.interpolate('{{input}}|{{context}}','IN','ctx has {{input}}'),'IN|ctx has {{input}}','context data must not be rescanned for {{input}}');
});

test('retriever feeds the prompt {{context}} even when placed after the prompt',()=>{
  const nodes=[
    {id:'i',type:'input',name:'Input',x:0,config:{text:'explain'}},
    {id:'p',type:'prompt',name:'Prompt',x:100,config:{template:'Q:{{input}}|C:{{context}}'}},
    {id:'r',type:'retriever',name:'Retriever',x:900,config:{query:'citations'}},
    {id:'o',type:'output',name:'Output',x:1000,config:{prefix:''}}
  ];
  const res=core.runWorkflow(nodes,NOTES);
  const promptTrace=res.trace.find(t=>t.type==='prompt');
  assert.ok(/C:Citations matter for trust/.test(res.output),'prompt did not receive retriever context: '+res.output);
  assert.ok(!/Provider keys/.test(promptTrace.detail),'prompt received raw notes instead of retriever selection');
  assert.ok(!/Context:/.test(res.output)||!/Provider keys/.test(res.output),'raw notes must not be substituted while a retriever exists');
  const retrieverTrace=res.trace.find(t=>t.type==='retriever');
  assert.ok(/Context selected/.test(retrieverTrace.detail),'retriever trace missing: '+retrieverTrace.detail);
});

test('a graph without retrievers falls back to the raw notes',()=>{
  const nodes=[
    {id:'p',type:'prompt',name:'Prompt',x:0,config:{template:'C:{{context}}'}}
  ];
  assert.strictEqual(core.runWorkflow(nodes,NOTES).output,'C:'+NOTES);
});

test('runContext joins the selections of several retrievers',()=>{
  const nodes=[
    {id:'r1',type:'retriever',x:0,config:{query:'citations'}},
    {id:'r2',type:'retriever',x:1,config:{query:'provider'}}
  ];
  assert.strictEqual(core.runContext(nodes,NOTES),'Citations matter for trust Provider keys are never transmitted');
});

test('one failing evaluator fails the whole run',()=>{
  const nodes=[
    {id:'i',type:'input',name:'Input',x:0,config:{text:'citations matter'}},
    {id:'e1',type:'evaluator',name:'E1',x:100,config:{expected:'citation'}},
    {id:'e2',type:'evaluator',name:'E2',x:200,config:{expected:'zzz-absent-phrase'}}
  ];
  const res=core.runWorkflow(nodes,NOTES);
  assert.strictEqual(res.evaluations.length,2);
  assert.deepStrictEqual(res.evaluations.map(e=>e.ok),[true,false]);
  assert.strictEqual(res.passed,false,'run with a failing evaluator must not pass');
});

test('literal [PASS] in input text cannot fake a pass',()=>{
  const nodes=[
    {id:'i',type:'input',name:'Input',x:0,config:{text:'[PASS] but unrelated'}},
    {id:'e',type:'evaluator',name:'E',x:100,config:{expected:'citation'}}
  ];
  const res=core.runWorkflow(nodes,NOTES);
  assert.ok(/\[PASS\]/.test(res.output),'sanity: literal marker is present in output');
  assert.strictEqual(res.passed,false,'substring scan must not decide the verdict');
});

test('passed is null when a run has no evaluators',()=>{
  const nodes=[{id:'i',type:'input',name:'Input',x:0,config:{text:'x'}}];
  assert.strictEqual(core.runWorkflow(nodes,NOTES).passed,null);
});

test('an evaluator with an empty expected phrase fails',()=>{
  assert.strictEqual(core.evaluate('anything',''),false);
  assert.strictEqual(core.runPassed([{ok:false}]),false);
  assert.strictEqual(core.runPassed([{ok:true},{ok:true}]),true);
});

test('median computes a real median, not the latest value',()=>{
  assert.strictEqual(core.median([30,10,20]),20);
  assert.strictEqual(core.median([10,20,30,40]),25);
  assert.strictEqual(core.median([7]),7);
  assert.strictEqual(core.median([]),null);
  assert.strictEqual(core.median(['5',1]),3,'numeric strings should coerce');
});

test('transform operations behave as documented',()=>{
  assert.strictEqual(core.applyTransform('abc','uppercase'),'ABC');
  assert.strictEqual(core.applyTransform('ab', null),'ab','unknown operation summarizes to the first two sentences');
  assert.strictEqual(core.applyTransform('a. b. c. d.','summarize'),'a. b.');
  assert.strictEqual(core.applyTransform('hi','json'),JSON.stringify({text:'hi',length:2}));
});

test('tool count is deterministic and timestamp uses the injected clock',()=>{
  assert.strictEqual(core.applyTool('two words','count'),'two words [words=2]');
  const at=new Date('2026-01-02T03:04:05.000Z');
  assert.strictEqual(core.applyTool('x','timestamp',at),'x @ 2026-01-02T03:04:05.000Z');
});

test('normalizeNodes coerces config values to strings',()=>{
  const nodes=core.normalizeNodes([{id:'p',type:'prompt',name:'P',x:'5',config:{template:5}}]);
  assert.strictEqual(nodes.length,1);
  assert.strictEqual(nodes[0].config.template,'5');
  assert.strictEqual(nodes[0].x,5,'x should coerce to a number');
  assert.doesNotThrow(()=>core.runWorkflow(nodes,NOTES),'a numeric template used to throw on .replace');
});

test('normalizeNodes drops disallowed types and id-less nodes, and rejects oversized graphs',()=>{
  const nodes=core.normalizeNodes([
    {id:'ok',type:'input',config:{text:'a'}},
    {id:'bad',type:'sql',config:{}},
    {type:'input',config:{text:'no id'}}
  ]);
  assert.strictEqual(nodes.length,1,'only the allow-listed, id-bearing node survives');
  assert.throws(()=>core.normalizeNodes(new Array(51).fill({id:'x',type:'input'})),/Invalid graph/);
  assert.throws(()=>core.normalizeNodes(null),/Invalid graph/);
});

test('node order follows the x coordinate',()=>{
  const ordered=core.orderNodes([{id:'b',x:20},{id:'a',x:10}]);
  assert.deepStrictEqual(ordered.map(n=>n.id),['a','b']);
});

test('an unsupported node type stops the run with an error trace row',()=>{
  const nodes=[
    {id:'i',type:'input',name:'Input',x:0,config:{text:'a'}},
    {id:'z',type:'sql',name:'Z',x:5,config:{}},
    {id:'o',type:'output',name:'Output',x:9,config:{prefix:''}}
  ];
  const res=core.runWorkflow(nodes,NOTES);
  assert.strictEqual(res.error,'Unsupported node type: sql');
  assert.strictEqual(res.trace.length,2,'the run must stop at the bad node');
  assert.strictEqual(res.trace[1].detail,'Error: Unsupported node type: sql');
});

for(const [name,fn] of tests){
  try{fn();passed++;console.log('ok - '+name)}
  catch(err){console.error('FAIL - '+name+'\n    '+err.message);process.exitCode=1}
}
console.log(passed+'/'+tests.length+' tests passed');
if(passed!==tests.length)process.exit(1);
