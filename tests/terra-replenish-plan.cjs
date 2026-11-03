/* P3-14: purely read-only replenishment planning command.
 * Usage: node tests/terra-replenish-plan.cjs policy.json inventory.json [in-flight.json]
 * A decision is NOT an authorization to spend, publish or assign.
 */
'use strict';
const fs=require('node:fs');
const {plan}=require('../server/worker/src/terra_replenishment_plan.cjs');
function fromFiles(paths){
 if(paths.length<2||paths.length>3)throw Error('usage: node tests/terra-replenish-plan.cjs policy.json inventory.json [in-flight.json]');
 const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
 return plan({policy:read(paths[0]),inventory:read(paths[1]),inFlight:paths[2]?read(paths[2]):[]});
}
if(require.main===module){
 try{const report=fromFiles(process.argv.slice(2));console.log(JSON.stringify(report,null,2));if(!report.ok)process.exitCode=1}
 catch(e){console.error(e.message);process.exitCode=1}
}
module.exports={fromFiles};
