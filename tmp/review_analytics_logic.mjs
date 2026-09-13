// Read-only diagnostic reproductions: no database or application mutation.
import fs from 'node:fs';
import vm from 'node:vm';
import { calculateUsageTrends as trends, calculateShortageForecast as shortage,
  calculateTransferRecommendations as transfers, normalizeComponentType } from '../frontend/src/admin/analyticsEngine.js';
const now = new Date('2026-09-09T12:00:00Z');
const req = (extra={}) => ({id:1,blood_type:'O+',component_type:'whole_blood',status:'delivered',
  request_date:'2026-09-08T12:00:00Z',units_approved:30,...extra});
const inv = (extra={}) => ({id:1,blood_type:'O+',component_type:'whole_blood',available_units:76,
  expiration_date:'2026-10-09',status:'available',hospital_id:1,...extra});
const pending = (id=1,hospital=2) => req({id,status:'pending',hospital_id:hospital,hospital_name:`H${hospital}`,units_requested:39,units_approved:null});
const results=[];
const record=(name,actual,expected)=>results.push({name,actual,expected});
record('Demand without inventory disappears from shortage table',shortage({inventory:[],requests:[req()],now}).rows.length,'1 zero-stock alert row');
record('Delivery yesterday requested 40 days ago is excluded from current usage',trends({requests:[req({request_date:'2026-07-31',delivered_at:'2026-09-08'})],now})[0]?.currentUnits,'30 using delivery event date');
record('Supported fulfilled status is ignored',trends({requests:[req({status:'fulfilled'})],now}).length,'included if fulfilled records represent completed usage');
record('Invalid negative usage produces negative days / Critical',shortage({inventory:[inv()],requests:[req({units_approved:-30})],now}).rows[0].numericDaysRemaining,'reject invalid quantity');
const batchPlan=transfers({inventory:[inv()],requests:[pending(1,2),pending(2,3)]});
record('Source stock overcommit',batchPlan.reduce((s,x)=>s+x.suggestedUnits,0),'at most 56 with 20 reserve');
const destinationPlan=transfers({inventory:[inv({hospital_id:2,available_units:52})],requests:[pending(1,2),pending(2,2)]});
record('Destination stock double-counted across requests',destinationPlan.map(x=>({need:x.unitsNeeded,recommendation:x.recommendation})),'78 requested against 52 stock leaves 26 unmet across plan');
record('Already covered but positive suggested quantity',transfers({inventory:[inv(),inv({hospital_id:2,available_units:52})],requests:[pending()]} )[0].suggestedUnits,0);
record('Expired by date but stale available status',transfers({inventory:[inv({expiration_date:'2000-01-01'})],requests:[pending()]} )[0].suggestedUnits,0);
record('RBC normalization',normalizeComponentType('red_blood_cells'),'reject unsupported component or preserve RBC identity');

const controllerSource=fs.readFileSync(new URL('../backend/controllers/adminAnalyticsController.js',import.meta.url),'utf8');
async function controllerCall(method,queryResults){
  let i=0,answer;
  const context={module:{exports:{}},console,require:name=>{
    if(name!=='../db') throw Error('Unexpected dependency');
    return {pool:{query:async()=>[structuredClone(queryResults[i++] || [])]}};
  }};
  vm.runInNewContext(controllerSource,context);
  await context.module.exports[method]({}, {json:value=>{answer=value},status:()=>({json:value=>{throw Error(JSON.stringify(value))}})});
  return answer;
}
const riskBatch=(id,units)=>inv({id,available_units:units,hospital_id:null,days_until_expiry:5});
const requestRow=(id,units,priority='normal',date='2026-09-01')=>pending(id,2) && {...pending(id,2),units_requested:units,priority,request_date:date};
const partial = await controllerCall('getWastagePrescriptionsController',[
  [riskBatch(1,5),riskBatch(2,10)],[requestRow(1,12)],[],[{blood_type:'O+',component_type:'whole_blood',total_available:15}],[]]);
record('Backend marks partially served request processed',partial.transferRecommendations.reduce((s,r)=>s+r.units,0),'12 available across two batches (actual 5)');
const prioritized = await controllerCall('getWastagePrescriptionsController',[
  [riskBatch(1,5)],[requestRow(1,5,'normal','2026-09-01'),requestRow(2,5,'critical','2026-09-08')],[],[],[]]);
record('Backend allocates scarce stock to oldest rather than critical',prioritized.transferRecommendations.map(x=>x.requestId),'critical request 2 first');
const leftover=await controllerCall('getWastagePrescriptionsController',[[riskBatch(1,10)],[requestRow(1,5)],[],[],[]]);
record('Backend partially matched near-expiry remainder omitted from alert',leftover.priorityActions,'alert for remaining 5 units expiring in 5 days');
const riskInput = asStrings => [[],[inv({available_units:10,days_until_expiry:20})],
  [{blood_type:'O+',component_type:'whole_blood',total_demand:asStrings?'10':10},
    {blood_type:'A+',component_type:'whole_blood',total_demand:asStrings?'10':10}],
  [{blood_type:'O+',component_type:'whole_blood',total_available:10}]];
const numeric=await controllerCall('getWastagePredictionsController',riskInput(false));
const strings=await controllerCall('getWastagePredictionsController',riskInput(true));
record('Backend SUM string values change demand risk', {numberInput:numeric.inventoryWithRisk[0].demandRiskFactor,stringInput:strings.inventoryWithRisk[0].demandRiskFactor},'identical risk for identical quantities');
console.log(JSON.stringify({reproductions:results.length,results},null,2));
