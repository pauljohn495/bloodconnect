from pathlib import Path
import json
from xml.sax.saxutils import escape
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[2]
scores = json.loads((ROOT/'backend/simulation/output/hybrid-evaluation/scores.json').read_text())
OUT = ROOT/'output/pdf/BloodConnect_Analytics_Scores_Explained.pdf'
OUT.parent.mkdir(parents=True, exist_ok=True)
styles=getSampleStyleSheet()
styles.add(ParagraphStyle(name='TitleBC',fontName='Helvetica-Bold',fontSize=26,leading=31,textColor=colors.HexColor('#18344B'),spaceAfter=14))
styles.add(ParagraphStyle(name='SubBC',fontName='Helvetica',fontSize=13,leading=19,textColor=colors.HexColor('#496174'),spaceAfter=16))
styles.add(ParagraphStyle(name='BodyBC',fontName='Helvetica',fontSize=11,leading=16,spaceAfter=10))
styles.add(ParagraphStyle(name='HeadBC',fontName='Helvetica-Bold',fontSize=15,leading=19,textColor=colors.HexColor('#18344B'),spaceBefore=13,spaceAfter=9,keepWithNext=True))
styles.add(ParagraphStyle(name='SmallBC',fontName='Helvetica',fontSize=9,leading=13,textColor=colors.HexColor('#496174'),spaceAfter=8))
styles.add(ParagraphStyle(name='CellBC',fontName='Helvetica',fontSize=10,leading=14))
styles.add(ParagraphStyle(name='FormulaBC',fontName='Helvetica-Bold',fontSize=11,leading=17,spaceBefore=5,spaceAfter=13,backColor=colors.HexColor('#EDF3F7'),borderPadding=10))
story=[]
def p(text,style='BodyBC'): story.append(Paragraph(text,styles[style]))
def h(text): p(text,'HeadBC')
def formula(text): p(text,'FormulaBC')
def page(n,title):
    if story: story.append(PageBreak())
    p(f'BLOODCONNECT / SCORING GUIDE / {n:02d}','SmallBC')
    p(title,'TitleBC')
def table(headers,rows,widths):
    data=[[Paragraph('<b>'+escape(str(x))+'</b>',styles['CellBC']) for x in headers]]
    data += [[Paragraph(escape(str(x)),styles['CellBC']) for x in row] for row in rows]
    t=Table(data,colWidths=widths,repeatRows=1,hAlign='LEFT')
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#E6EFF5')),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),9),('RIGHTPADDING',(0,0),(-1,-1),9),('TOPPADDING',(0,0),(-1,-1),9),('BOTTOMPADDING',(0,0),(-1,-1),9),('LINEBELOW',(0,0),(-1,0),.8,colors.HexColor('#91AABD')),('LINEBELOW',(0,1),(-1,-1),.35,colors.HexColor('#D4DFE7'))]))
    story.append(t); story.append(Spacer(1,12))
def footer(canvas,doc):
    canvas.saveState(); canvas.setFont('Helvetica',8); canvas.setFillColor(colors.HexColor('#496174'))
    canvas.drawString(48,28,'Exploratory synthetic evaluation | 9 September 2026')
    canvas.drawRightString(A4[0]-48,28,f'{doc.page}'); canvas.restoreState()

page(1,'How the analytics<br/>scores were calculated')
p('A plain-language guide to the data, testing process and formulas.','SubBC')
p('<b>Main limitation:</b> These results describe generated test scenarios. They do not measure accuracy on original daily hospital records. The generated data used published average usage levels, but its variability and operational patterns were not calibrated to actual hospital behavior.')
table(['Analytics module','Reported score','What it means'],[
 ['Demand & Usage Trends','55.33%','1,552 of 2,805 forecasts were within 20% of simulated next-week usage.'],
 ['Blood Shortage Forecast','81.89%','2,297 of 2,805 shortage/no-shortage predictions were correct without incoming supply.'],
 ['Prescriptive recommendations','50.00%','270 of 540 transfer plans satisfied every tested constraint.'],
],[145,82,272])
h('Why there are three different scores')
p('Demand forecasting estimates a <b>quantity</b>. Shortage detection predicts a <b>yes/no outcome</b>. Prescriptive testing checks whether a <b>proposed action is feasible</b>. These are different tasks, so their percentages should not be averaged into one system accuracy.')
h('What was tested?')
p('The existing BloodConnect calculation functions were tested directly, without changing the analytics engine or using the production database. The evaluation did not test every screen, deployed API, clinical decision or donor recommendation.')
h('Reading this guide')
p('Page 2 explains the missing data and generation. Page 3 shows demand calculations. Page 4 explains shortage scoring. Page 5 covers transfer-plan checks. Page 6 explains limitations, earlier scores and the evidence files.')

page(2,'What data was missing?')
p('The two research papers contained averages and summary statistics, not the full dated records needed to compare forecasts with later outcomes.')
table(['Missing information','What we added for testing'],[
 ['Daily usage and future outcomes','Generated daily integer quantities; the next seven days were withheld from each forecast.'],
 ['Stock snapshots and expiry','Generated on-hand quantities, batch sizes and expiration dates.'],
 ['Incoming supply','Generated receipt quantities, arrival dates and delivery delays.'],
 ['Requests and transfer sources','Constructed hospital identities, pending units, priorities and source stock.'],
],[175,324])
h('What came from the papers?')
p('<b>India:</b> seven published weekly issue averages, divided by seven: 39, 25, 51, 34, 25, 38 and 49 units/week.<br/><b>Korea:</b> four published ABO daily usage averages: O = 6.1, A = 7.4, B = 5.8 and AB = 2.4 units/day.')
formula('11 starting rates x 5 patterns x 3 fixed seeds = 165 series<br/>165 series x 180 days = <b>29,700 daily records</b>')
p('The five patterns were stationary demand, weekday variation, demand spikes, level changes and intermittent usage. Daily quantities were random whole-number counts generated around the chosen rates. Fixed seeds (104729, 130363, 155921) reproduce identical records.')
h('Which parts were assumptions?')
p('Weekday multipliers, a 10% daily spike chance, a 55% zero-usage chance in the intermittent pattern, stock coverage, expiry and delivery-delay probabilities were test choices. They were <b>not fitted to the studies\' original records or reported variability</b>.')
p('The records are supported whole-blood test surrogates, not recovered RBC observations. Korean anchor usage includes transfused and wasted units; RhD was unspecified. These limitations prevent a faithful reconstruction of patient demand.','SmallBC')

page(3,'Demand & Usage Trends')
h('1. Calculate a forecast from past usage')
formula('Average daily usage = Previous 30 days\' fulfilled usage / 30<br/>Next 7-day forecast = Average daily usage x 7')
p('Example: if the last 30 days used 150 units, daily average usage is 5 units and the forecast is 35 units for the next week. This is an illustrative calculation, not an additional measured test case.')
h('2. Compare with a separate future outcome')
p('Each series began with 60 days of history. Forecasts then advanced seven days at a time, giving 17 test periods per series. Only past records were passed to the engine; later forecasts could use outcomes that had since become history.')
formula('165 series x 17 periods = <b>2,805 forecasts</b><br/>Actual simulated usage = Sum of the next 7 days\' usage<br/>Absolute error = |Forecast - Actual simulated usage|')
h('3. Calculate the tolerance score')
formula('A forecast qualifies when: Absolute error &lt;= 0.20 x Actual<br/>Within-20% score = 1,552 / 2,805 x 100 = <b>55.33%</b>')
p('The 20% tolerance was a declared benchmark choice, not a clinical acceptance standard. If actual usage is zero, only a zero forecast qualifies.')
table(['Error measure','Formula','Result'],[
 ['MAE','Mean absolute error','9.51 units/week'],
 ['RMSE','Square root of mean squared error','13.52 units/week'],
 ['WAPE','Total absolute error / total actual usage x 100','23.76%'],
 ['MAPE','Mean of absolute error / actual usage x 100','30.41%'],
],[85,303,111])
p('Lower error is better. MAPE used 2,798 nonzero outcomes and excluded seven zero outcomes; the other measures used all 2,805. The last-week-repeat baseline had MAE 10.79 units and WAPE 26.96%. The 55.33% score is NOT 100% minus MAPE.','SmallBC')

page(4,'Blood Shortage Forecast')
h('1. Obtain the engine\'s prediction')
formula('Usable stock = Current stock - Units expiring within 7 days<br/>Estimated days remaining = Usable stock / Average daily usage')
p('The tested engine generally labels less than seven days of supply as critical. For scoring, its critical, critical-out, near-expiry-only and at-risk statuses counted as alerts.')
h('2. Determine what happens independently')
p('A separate seven-day replay removed expired units at the start of each day, used the earliest-expiring valid stock first, and subtracted generated daily demand. <b>Any unmet demand counted as a true shortage.</b> This label was not calculated using the forecast formula.')
table(['Prediction versus simulated outcome','No incoming supply'],[
 ['True positive: alert and shortage',1522],['True negative: no alert and no shortage',775],
 ['False positive: alert but no shortage',456],['False negative: no alert but shortage',52],['Total',2805],
],[359,140])
formula('Accuracy = (True positives + True negatives) / Total x 100<br/>= (1,522 + 775) / 2,805 x 100 = <b>81.89%</b>')
table(['Additional measure','Calculation','Score'],[
 ['Precision','1,522 / (1,522 + 456) x 100','76.95%'],
 ['Recall','1,522 / (1,522 + 52) x 100','96.70%'],
 ['F1','2 x 1,522 / (2 x 1,522 + 456 + 52) x 100','85.70%'],
],[85,329,85])
p('The engine caught most simulated shortages, but also raised 456 false alarms. Accuracy was 71.69% when incoming receipts and delays were replayed. That is a separate stress test: the current engine does not account for incoming supply.','SmallBC')

page(5,'Prescriptive recommendations')
h('1. Construct requests and source stock')
formula('6 scenario types x 30 repetitions x 3 seeds<br/>= <b>540 transfer plans, containing 630 requests</b>')
p('The evaluator checked the <b>whole proposed plan</b>, not merely whether its wording matched an expected answer.')
h('2. Check every required constraint')
p('A plan had to include the expected priority-ordered requests, use nonnegative whole-number quantities, avoid self or incompatible transfers, avoid unnecessary quantities, exclude expired supply, and avoid collectively spending the same source stock twice. Hospital sources had to retain the configured 20-unit reserve; central stock had no reserve.')
table(['Scenario type','Passed / tested'],[
 ['Routine transfer','90 / 90'],['Already-covered requests','0 / 90'],['Competing requests','0 / 90'],
 ['Expired stock with stale available status','0 / 90'],['Fragmented supply','90 / 90'],['No available supply','90 / 90'],
],[359,140])
formula('Feasibility score = Plans passing all checks / All plans x 100<br/>= 270 / 540 x 100 = <b>50.00%</b>')
h('Why did plans fail?')
p('Covered requests could still suggest transfer units. Concurrent recommendations could collectively exceed sendable stock. A past expiry date could be ignored if the status still said available. These failures were not fixed before scoring.')
p('<b>Feasible does not mean fully supplied.</b> A no-supply plan can pass by recommending external coordination while supplying zero units. The six equally weighted scenario families are deliberate stress tests, not a representative hospital case mix.','SmallBC')
p('A separate fulfillment score of 57.04% applied external safety caps to unsafe suggestions. Those caps are part of the evaluator, NOT a safety feature installed in the application.','SmallBC')

page(6,'How to report these results')
h('Use this wording in your capstone')
p('BloodConnect was evaluated using controlled synthetic scenarios informed by published average blood usage values. Testing included 29,700 daily records, 2,805 seven-day forecasts and 540 transfer plans. Demand forecasts had MAE 9.51 units and WAPE 23.76%; 55.33% were within 20% of simulated usage. Shortage detection achieved 81.89% accuracy without incoming supply. Transfer-plan feasibility was 50.00%.')
p('<b>Required limitation:</b> Results are conditional on uncalibrated simulation assumptions. They do not establish real-world predictive accuracy, actual hospital performance or clinical effectiveness.')
h('Why earlier scores were different')
p('The earlier 11/11 demand and 11/11 shortage results were <b>arithmetic checks on constant-rate inputs</b>, not independent future forecasts. Their 100% pass rates cannot be compared directly with the later simulation scores. Likewise, the initial 91.67% figure was 100 minus an 8.33% MAPE from only four controlled comparisons, not overall system accuracy.')
h('Reproduce and inspect the evidence')
p('From the repository root, run:<br/><font name="Courier" size="9">node backend/scripts/evaluateHybridAnalytics.mjs</font>')
p('Saved evidence is in <b>backend/simulation/output/hybrid-evaluation/</b>:<br/><b>synthetic-dataset.json</b> - generated inputs and assumptions.<br/><b>scores.json</b> - overall, pattern-level and seed-level measures.<br/><b>case-results.json</b> - individual forecasts, outcomes and transfer violations.','SmallBC')
p('The evaluation used fixed seeds and reproduced identical score artifacts on rerun. No new test was run for this guide; it explains the saved evaluation results. Source code, exact generation rules and the longer Word report remain in the workspace.','SmallBC')
h('Sources and metric references')
p('[1] Bansal et al. (2023), North India inventory study, Table 1.<br/><link href="https://doi.org/10.1007/s12288-023-01631-8" color="#245A83">doi.org/10.1007/s12288-023-01631-8</link><br/>[2] Park, Lim and Kim (2024; online 2023), Korean stock study, Table 1.<br/><link href="https://doi.org/10.3343/alm.2023.0242" color="#245A83">doi.org/10.3343/alm.2023.0242</link><br/>[3] Forecasting: Principles and Practice, section 5.8.<br/><link href="https://otexts.com/fpp3/accuracy.html" color="#245A83">otexts.com/fpp3/accuracy.html</link><br/>[4] scikit-learn, model evaluation documentation.<br/><link href="https://scikit-learn.org/stable/modules/model_evaluation.html" color="#245A83">scikit-learn.org/stable/modules/model_evaluation.html</link>','SmallBC')

doc=SimpleDocTemplate(str(OUT),pagesize=A4,rightMargin=48,leftMargin=48,topMargin=43,bottomMargin=48,title='BloodConnect Analytics Scores Explained',author='BloodConnect project')
doc.build(story,onFirstPage=footer,onLaterPages=footer)
reader=PdfReader(OUT)
text='\n'.join(page.extract_text() for page in reader.pages)
assert all(x in text for x in ['55.33%','81.89%','50.00%','29,700','2,805','540'])
print(json.dumps({'file':str(OUT),'pages':len(reader.pages),'bytes':OUT.stat().st_size}))
