import PDFDocument from '../frontend/node_modules/pdfkit/js/pdfkit.node.mjs'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const out = path.join(root, 'output', 'pdf', 'BloodConnect_Automated_Testing_Report.pdf')
fs.mkdirSync(path.dirname(out), { recursive: true })
const doc = new PDFDocument({ size: 'A4', margin: 45, bufferPages: true })
doc.pipe(fs.createWriteStream(out))
const red = '#991b1b', slate = '#334155', pale = '#fff7ed'
const footer = () => { doc.fontSize(7).fillColor('#64748b').text('BloodConnect - Automated Testing Evidence', 45, 780); doc.text(`Page ${doc.bufferedPageRange().count}`, 500, 780, { width: 50, align: 'right' }) }
const heading = t => { doc.moveDown(.6).font('Helvetica-Bold').fontSize(14).fillColor(red).text(t); doc.moveDown(.25) }
const body = t => { doc.font('Helvetica').fontSize(9.3).fillColor(slate).text(t, { lineGap: 3 }); doc.moveDown(.45) }
const row = (cells, widths, header=false) => { const x=45, y=doc.y, h=Math.max(...cells.map((c,i)=>doc.heightOfString(c,{width:widths[i]-8})))+10; let at=x; cells.forEach((c,i)=>{ doc.rect(at,y,widths[i],h).fillAndStroke(header?red:(Math.round(y/20)%2?pale:'#ffffff'),'#cbd5e1'); doc.fillColor(header?'white':slate).font(header?'Helvetica-Bold':'Helvetica').fontSize(7.6).text(c,at+4,y+5,{width:widths[i]-8}); at+=widths[i] }); doc.y=y+h; }
doc.font('Helvetica-Bold').fontSize(21).fillColor(red).text('BloodConnect Automated Testing Report', { align:'center' })
doc.font('Helvetica').fontSize(10).fillColor(slate).text('Predictive and Prescriptive Decision Support System for Blood Wastage Reduction and Supply Mapping', { align:'center' }); doc.moveDown(1)
body('Purpose: To test the prototype through unit, integration, and system testing to check whether it processes controlled data and produces outputs correctly and consistently. Report date: 13 October 2026 (Asia/Manila). This report only summarizes tests actually executed locally; it does not claim clinical validity or real-world forecast accuracy.')
heading('1. Prototype scope and implemented rules')
body('BloodConnect is a React/Vite frontend with an Express/MySQL backend. It supports donor, hospital, administrator, and super-administrator portals. Workflows include sign-in, donor scheduling, hospital inventory and requests, and administrative inventory, requests, transfers, donor, partner, and analytics management.')
body('The analytics engine uses completed or partially fulfilled requests as historical demand; forecasts seven-day demand from the 30-day demand window; excludes expired inventory; limits near-expiry inventory to consumption possible before expiry; classifies trends using +/-10 percent change; and applies recovery periods of 90 days for whole blood, 14 for platelets, and 28 for plasma. Backend allocation prioritizes critical, urgent, then normal compatible requests.')
heading('2. Test design and data isolation')
body('Vitest runs deterministic analytics unit tests. Node\'s built-in runner checks Express API routing and validation. Playwright runs browser workflows and intercepts every API call with in-memory responses, so it does not contact MySQL or production services. The separate database simulation workflow only permits names ending in _simulation and disables schedulers in simulation mode.')
body('Expected unit-test values were hand-calculated from fixed records, rather than obtained from the functions under test. The existing controlled simulation separately compares repeated complete outputs against a human-reviewable oracle.')
heading('3. Executed results')
row(['Suite','Actual result','Evidence'],[165,120,220],true);
[['Vitest analytics unit tests','PASS - 8/8','Fixed inputs; unit HTML report'],['Playwright browser workflows','PASS - 6/6','HTML report and screenshots'],['Simulation API/database integration','PASS - 4/4','Real Express + MySQL simulation'],['Express API tests','PASS - 8/8','Node test-runner output'],['Controlled analytics oracle','PASS - 128/128','JSON validation report'],['Database analytics simulation','PASS - 41/41','Guarded MySQL validation'],['Analytics edge-case regression','PASS - 19/19','Node test-runner output'],['Frontend production build','PASS','Vite build output']].forEach(r=>row(r,[165,120,220]))
heading('4. Test register')
row(['ID','Description','Expected result','Actual'],[75,105,265,60],true);
[['BC-UNIT-001','Inventory coverage','20 stock, 30 demand, 7 next-7-day demand, sufficient','PASS'],['BC-UNIT-002','Expired stock boundary','No usable stock; critical out','PASS'],['BC-UNIT-003','Near-expiry boundary','10 units but only 3 usable before expiry','PASS'],['BC-UNIT-004','Usage trend','60 vs 30; +100%; 14 next-7-day; increasing/high/spike','PASS'],['BC-UNIT-005','Donor availability','2 eligible now plus 2 in horizon','PASS'],['BC-UNIT-006','Transfer priority','Critical request receives scarce compatible stock first','PASS'],['BC-UNIT-007','Repeated run','Same output; input remains unchanged','PASS'],['BC-UNIT-008','Invalid inputs','Safe empty/low-availability outputs','PASS'],['BC-E2E-001','Donor workflow','Login routes to /dashboard','PASS'],['BC-E2E-002','Hospital workflow','Inventory route; O+ mock stock renders','PASS'],['BC-E2E-003','Admin workflow','Admin route; dashboard widget renders','PASS'],['BC-INT-001','Admin API/database','Controlled predictive and prescriptive responses','PASS'],['BC-INT-002','Hospital API/database','Hospital data isolation, requests, reports','PASS'],['BC-INT-003','Donor API/database','Donor profile, donations, eligibility, schedules','PASS'],['BC-INT-004','Workflow boundaries','Authorization and invalid request validation','PASS']].forEach(r=>{ if(doc.y>720){doc.addPage(); row(['ID','Description','Expected result','Actual'],[75,105,265,60],true)} row(r,[75,105,265,60]) })
doc.addPage(); heading('5. Browser evidence')
body('The passing Playwright run generated the following real screenshot evidence using intercepted test-only API responses: BC-E2E-001-donor-dashboard.png, BC-E2E-002-hospital-inventory.png, and BC-E2E-003-admin-dashboard.png. The files are retained in frontend/test-results/evidence. The corresponding Playwright HTML report is in frontend/test-results/e2e-html/index.html. These demonstrate UI workflow execution, not production-data behavior.')
doc.addPage(); heading('6. Reproduction and limitations')
body('From frontend, run: npm.cmd run test:unit:report and npm.cmd run test:e2e. From backend, run: npm.cmd test. Evidence is generated under frontend/.vitest, frontend/test-results, and backend/simulation/output. For isolated MySQL integration testing, use the guarded simulation database commands documented in docs/Automated_Testing_Guide.md.')
body('A passing result establishes conformance to implemented rules under controlled conditions. It does not establish forecast accuracy, clinical effectiveness, or behavior against production records.')
for(let i=0;i<doc.bufferedPageRange().count;i++){doc.switchToPage(i); footer()}
doc.end(); console.log(out)
