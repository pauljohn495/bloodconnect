from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, Image
from reportlab.pdfbase.pdfmetrics import stringWidth
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output' / 'pdf' / 'BloodConnect_Automated_Testing_Report.pdf'
OUT.parent.mkdir(parents=True, exist_ok=True)

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name='TitleBC', parent=styles['Title'], fontName='Helvetica-Bold', fontSize=21, leading=26, textColor=colors.HexColor('#991b1b'), alignment=TA_CENTER, spaceAfter=10))
styles.add(ParagraphStyle(name='SubBC', parent=styles['Normal'], fontSize=10, leading=14, alignment=TA_CENTER, textColor=colors.HexColor('#475569'), spaceAfter=18))
styles.add(ParagraphStyle(name='H1BC', parent=styles['Heading1'], fontName='Helvetica-Bold', fontSize=14, leading=18, textColor=colors.HexColor('#991b1b'), spaceBefore=10, spaceAfter=6))
styles.add(ParagraphStyle(name='BodyBC', parent=styles['BodyText'], fontSize=9.3, leading=13, spaceAfter=7))
styles.add(ParagraphStyle(name='SmallBC', parent=styles['BodyText'], fontSize=7.4, leading=9.5))

def p(text, style='BodyBC'):
    return Paragraph(text, styles[style])

def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor('#fecaca')); canvas.line(42, 37, A4[0]-42, 37)
    canvas.setFont('Helvetica', 7.5); canvas.setFillColor(colors.HexColor('#64748b'))
    canvas.drawString(42, 25, 'BloodConnect - Automated Testing Evidence')
    canvas.drawRightString(A4[0]-42, 25, f'Page {doc.page}')
    canvas.restoreState()

doc = SimpleDocTemplate(str(OUT), pagesize=A4, rightMargin=42, leftMargin=42, topMargin=42, bottomMargin=48)
story = []
story += [p('BloodConnect Automated Testing Report', 'TitleBC'), p('Predictive and Prescriptive Decision Support System for Blood Wastage Reduction and Supply Mapping', 'SubBC')]
story += [p('<b>Purpose.</b> To test the prototype through unit, integration, and system testing to check whether it processes controlled data and produces outputs correctly and consistently.'), p('<b>Report date.</b> 13 October 2026 (Asia/Manila). This report summarizes tests that were actually executed in the local project workspace. It does not claim clinical validity or real-world forecast accuracy.')]
story += [p('1. Prototype scope and implemented rules', 'H1BC')]
story += [p('The application consists of a React/Vite frontend and an Express/MySQL backend. It supports donor, hospital, administrator, and super-administrator portals. Workflows include sign-in, donor scheduling, hospital inventory and requests, and administrative inventory, requests, transfers, donor, partner, and analytics management.')]
story += [p('The analytics engine uses completed or partially fulfilled requests as historical demand; forecasts seven-day demand from the 30-day demand window; excludes expired inventory; limits near-expiry inventory to the amount that can be consumed before expiry; classifies usage trends using +/-10 percent change; and uses recovery periods of 90 days for whole blood, 14 for platelets, and 28 for plasma. Backend allocation prioritizes critical, urgent, then normal compatible requests.')]
story += [p('2. Test design and data isolation', 'H1BC')]
story += [p('Vitest runs deterministic unit tests. Node\'s built-in test runner checks Express API routing and validation. Playwright runs browser workflows. Playwright intercepts every API call and provides in-memory test responses, so it does not contact MySQL or production services. A separately guarded database simulation workflow only permits target databases whose names end in <b>_simulation</b> and disables schedulers when SIMULATION_MODE=true.')]
story += [p('Expected values were independently hand-calculated from fixed records in the unit tests, rather than obtained from the functions under test. The existing controlled analytics simulation has a separate human-reviewable oracle and compares complete repeated outputs.')]
story += [p('3. Executed results', 'H1BC')]
summary = [
    ['Suite', 'Actual result', 'Evidence'],
    ['Vitest analytics unit tests', 'PASS - 8/8', 'Fixed inputs; unit HTML report'],
    ['Playwright browser workflows', 'PASS - 3/3', 'HTML report and screenshots'],
    ['Express API tests', 'PASS - 8/8', 'Node test-runner output'],
    ['Controlled analytics oracle', 'PASS - 128/128', 'JSON validation report'],
    ['Analytics edge-case regression', 'PASS - 19/19', 'Node test-runner output'],
    ['Frontend production build', 'PASS', 'Vite build output'],
]
t = Table(summary, colWidths=[1.65*inch, 1.25*inch, 3.0*inch], repeatRows=1)
t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#991b1b')),('TEXTCOLOR',(0,0),(-1,0),colors.white),('FONTNAME',(0,0),(-1,0),'Helvetica-Bold'),('FONTSIZE',(0,0),(-1,-1),8),('LEADING',(0,0),(-1,-1),10),('GRID',(0,0),(-1,-1),0.35,colors.HexColor('#cbd5e1')),('VALIGN',(0,0),(-1,-1),'TOP'),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,colors.HexColor('#f8fafc')]),('LEFTPADDING',(0,0),(-1,-1),5),('RIGHTPADDING',(0,0),(-1,-1),5),('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),5)]))
story += [t, Spacer(1, 10)]
story += [p('4. Test register', 'H1BC')]
register = [
['ID', 'Description', 'Independent expected result', 'Actual'],
['BC-UNIT-001', 'Inventory coverage', '20 stock, 30 demand, 7 next-7-day demand, sufficient', 'PASS'],
['BC-UNIT-002', 'Expired stock boundary', 'No usable stock; critical out', 'PASS'],
['BC-UNIT-003', 'Near-expiry boundary', '10 units but only 3 usable before expiry', 'PASS'],
['BC-UNIT-004', 'Usage trend', '60 vs 30; +100%; 14 next-7-day; increasing/high/spike', 'PASS'],
['BC-UNIT-005', 'Donor availability', '2 eligible now plus 2 in horizon', 'PASS'],
['BC-UNIT-006', 'Transfer priority', 'Critical request receives scarce compatible stock first', 'PASS'],
['BC-UNIT-007', 'Repeated run', 'Same output; input remains unchanged', 'PASS'],
['BC-UNIT-008', 'Invalid inputs', 'Safe empty/low-availability outputs', 'PASS'],
['BC-E2E-001', 'Donor workflow', 'Login routes to /dashboard', 'PASS'],
['BC-E2E-002', 'Hospital workflow', 'Login routes to inventory; O+ mock stock renders', 'PASS'],
['BC-E2E-003', 'Admin workflow', 'Login routes to admin dashboard; widget renders', 'PASS'],
]
rt = Table([[p(c, 'SmallBC') for c in row] for row in register], colWidths=[.78*inch, 1.15*inch, 3.2*inch, .52*inch], repeatRows=1)
rt.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#7f1d1d')),('TEXTCOLOR',(0,0),(-1,0),colors.white),('FONTNAME',(0,0),(-1,0),'Helvetica-Bold'),('GRID',(0,0),(-1,-1),.3,colors.HexColor('#cbd5e1')),('VALIGN',(0,0),(-1,-1),'TOP'),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,colors.HexColor('#fff7ed')]),('LEFTPADDING',(0,0),(-1,-1),4),('RIGHTPADDING',(0,0),(-1,-1),4),('TOPPADDING',(0,0),(-1,-1),4),('BOTTOMPADDING',(0,0),(-1,-1),4)]))
story += [rt, PageBreak(), p('5. Browser evidence', 'H1BC'), p('The following screenshots were generated by the passing Playwright run using intercepted test-only API responses. They demonstrate UI workflow execution, not a production-data test.')]
for image_name, label in [('BC-E2E-001-donor-dashboard.png', 'Figure 1. Donor workflow'), ('BC-E2E-002-hospital-inventory.png', 'Figure 2. Hospital inventory workflow'), ('BC-E2E-003-admin-dashboard.png', 'Figure 3. Administrator workflow')]:
    image_path = ROOT / 'frontend' / 'test-results' / 'evidence' / image_name
    story += [p(label, 'SmallBC')]
    if image_path.exists():
        im = Image(str(image_path)); im._restrictSize(6.8*inch, 3.65*inch); story += [im]
    story += [Spacer(1, 8)]
story += [p('6. Reproduction and limitations', 'H1BC'), p('Run <b>npm.cmd run test:unit:report</b> and <b>npm.cmd run test:e2e</b> from frontend, then <b>npm.cmd test</b> from backend. Evidence is generated under frontend/.vitest, frontend/test-results, and backend/simulation/output. Passing results establish conformance to implemented rules under controlled inputs; they do not establish forecast accuracy, clinical effectiveness, or production database behavior.')]
doc.build(story, onFirstPage=footer, onLaterPages=footer)
print(OUT)
