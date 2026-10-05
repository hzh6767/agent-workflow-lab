/* Agent Workflow Lab - pure workflow engine.
   Loaded by index.html as a classic script (works from file://) and required
   directly by tests/index.test.js. Nothing here touches the DOM or the network,
   so every function is deterministic and directly testable. */
(function(global){
'use strict';
const MAX_NODES=50;
const TYPES={
input:{hint:'payload',field:'text',label:'Input text'},
prompt:{hint:'template',field:'template',label:'Prompt template'},
transform:{hint:'shape text',field:'operation',label:'Operation: uppercase, summarize, json'},
retriever:{hint:'local notes',field:'query',label:'Lookup phrase'},
tool:{hint:'safe utility',field:'operation',label:'Tool: count, timestamp'},
evaluator:{hint:'quality check',field:'expected',label:'Expected phrase'},
output:{hint:'publish result',field:'prefix',label:'Output prefix'}
};
function isType(type){return Object.prototype.hasOwnProperty.call(TYPES,type)}
function nodeHint(type){return isType(type)?TYPES[type].hint:String(type)}
function fieldFor(type){return isType(type)?TYPES[type]:{hint:'value',field:'value',label:'Value'}}
function orderNodes(nodes){return (Array.isArray(nodes)?[...nodes]:[]).sort((a,b)=>((Number(a&&a.x)||0)-(Number(b&&b.x)||0)))}
function interpolate(template,input,context){const inText=String(input==null?'':input),ctxText=String(context==null?'':context);return String(template==null?'':template).replace(/{{(input|context)}}/g,(m,key)=>key==='input'?inText:ctxText)}
/* Sentences from the notes panel whose text contains the lookup phrase.
   Matching is case-insensitive; an empty phrase matches nothing. */
function selectContext(notes,query){const words=String(query==null?'':query).toLowerCase().split(/\W+/).filter(Boolean);if(!words.length)return '';return String(notes==null?'':notes).split(/[.!?]+/).map(s=>s.trim()).filter(Boolean).filter(s=>words.some(w=>s.toLowerCase().includes(w))).join('. ')}
function applyTransform(value,operation){const text=String(value==null?'':value);if(operation==='uppercase')return text.toUpperCase();if(operation==='json')return JSON.stringify({text:text,length:text.length});return text.split(/(?<=[.!?])\s+/).slice(0,2).join(' ')}
function applyTool(value,operation,now){const text=String(value==null?'':value);if(operation==='timestamp'){const at=now instanceof Date?now:new Date(now==null?Date.now():now);return text+' @ '+at.toISOString()}return text+' [words='+text.trim().split(/\s+/).filter(Boolean).length+']'}
/* An evaluator with no expected phrase cannot verify anything, so it fails. */
function evaluate(value,expected){const want=String(expected==null?'':expected).trim().toLowerCase();if(!want)return false;return String(value==null?'':value).toLowerCase().includes(want)}
/* A run passes only when it has evaluators and every one of them passed.
   null means "no evaluators", which is neither a pass nor a failure. */
function runPassed(evaluations){return Array.isArray(evaluations)&&evaluations.length>0?evaluations.every(e=>e.ok):null}
function median(values){const sorted=(Array.isArray(values)?values:[]).map(Number).filter(n=>Number.isFinite(n)).sort((a,b)=>a-b);if(!sorted.length)return null;const mid=sorted.length>>1;return sorted.length%2?sorted[mid]:Math.round((sorted[mid-1]+sorted[mid])/2)}
/* Import validation: allow-listed types, string ids, numeric coordinates, and
   every config value coerced to a string so execute() can never call a method
   on a non-string. */
function normalizeNodes(nodes,limit){const max=limit||MAX_NODES;if(!Array.isArray(nodes)||nodes.length>max)throw new Error('Invalid graph');return nodes.filter(n=>n&&isType(n.type)&&typeof n.id==='string'&&n.id.trim()).map(n=>{const src=n.config&&typeof n.config==='object'&&!Array.isArray(n.config)?n.config:{};const config={};for(const key of Object.keys(src)){const v=src[key];config[key]=v==null?'':typeof v==='string'?v:String(v)}return{id:n.id,type:n.type,name:typeof n.name==='string'&&n.name?n.name:n.type,x:Number(n.x)||0,y:Number(n.y)||0,config}})}
/* Retriever nodes produce the {{context}} for Prompt nodes. Their selections are
   resolved before the walk, so a retriever placed to the right of the prompt
   still feeds it. A graph with retriever nodes uses their (possibly empty)
   selection; a graph without one falls back to the raw notes panel. */
function runContext(nodes,notes){const source=typeof notes==='string'?notes:'';const retrievers=(Array.isArray(nodes)?nodes:[]).filter(n=>n&&n.type==='retriever');if(!retrievers.length)return source;return retrievers.map(n=>selectContext(source,(n.config||{}).query)).filter(Boolean).join(' ')}
function runWorkflow(nodes,notes,options){const opts=options||{};const trace=[];const evaluations=[];let value='';let error=null;const ordered=orderNodes(nodes);const source=typeof notes==='string'?notes:'';const context=runContext(ordered,notes);for(const n of ordered){const config=n.config||{};const before=value;let detail=null;try{switch(n.type){case'input':value=String(config.text==null?'':config.text);break;case'prompt':value=interpolate(config.template,before,context);break;case'retriever':{const picked=selectContext(source,config.query);detail=picked?'Context selected: '+picked.slice(0,200):'No matching sentences in notes';break}case'transform':value=applyTransform(value,config.operation);break;case'tool':value=applyTool(value,config.operation,opts.now);break;case'evaluator':{const ok=evaluate(value,config.expected);evaluations.push({name:n.name,expected:String(config.expected==null?'':config.expected),ok:ok});value=value+' '+(ok?'[PASS]':'[REVIEW]');break}case'output':value=String(config.prefix==null?'':config.prefix)+value;break;default:throw new Error('Unsupported node type: '+n.type)}trace.push({name:n.name,type:n.type,detail:detail||(value===before?'No change':value.slice(0,240))})}catch(err){error=err&&err.message?err.message:String(err);trace.push({name:n.name,type:n.type,detail:'Error: '+error});break}}return{output:value,trace:trace,evaluations:evaluations,passed:runPassed(evaluations),error:error}}
const api={MAX_NODES:MAX_NODES,TYPES:TYPES,isType:isType,nodeHint:nodeHint,fieldFor:fieldFor,orderNodes:orderNodes,interpolate:interpolate,selectContext:selectContext,applyTransform:applyTransform,applyTool:applyTool,evaluate:evaluate,runPassed:runPassed,median:median,normalizeNodes:normalizeNodes,runContext:runContext,runWorkflow:runWorkflow};
global.AgentWorkflowCore=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
