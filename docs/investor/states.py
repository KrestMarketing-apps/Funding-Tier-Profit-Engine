"""State-by-state hiring data for US-based closers (Nov 2026).

min:   2026 state minimum wage (Paycor, updated Dec 2025; DC from DC DOES). Where a
       state varies by region the standard / most common rate is shown.
test:  worker-classification test the state applies when deciding whether a
       100%-commission closer may be a 1099 contractor: ABC (strict), or
       common-law / economic-realities (flexible).
note:  commission-specific rules that change cost.
talent: debt-relief sales talent concentration: HUB (national debt-relief
       companies employ large sales floors there), SOME, or REMOTE (talent is
       hired remotely only).
"""
STATES = [
 # state, min wage, test, talent, note
 ('Alabama', 7.25, 'Common law', 'REMOTE', ''),
 ('Alaska', 14.00, 'ABC', 'REMOTE', 'Rises to $14.00 July 1, 2026'),
 ('Arizona', 15.15, 'Common law', 'HUB', 'Tempe / Phoenix: Freedom, Beyond floors'),
 ('Arkansas', 11.00, 'Common law', 'REMOTE', ''),
 ('California', 16.90, 'ABC (AB 5)', 'HUB', 'Draw-only pay unlawful; rest breaks paid separately; daily OT; Irvine / OC industry centre'),
 ('Colorado', 15.16, 'Economic realities', 'SOME', 'Denver higher local rate'),
 ('Connecticut', 16.94, 'ABC', 'REMOTE', ''),
 ('Delaware', 15.00, 'Economic realities', 'REMOTE', ''),
 ('District of Columbia', 17.95, 'Common law', 'REMOTE', 'Adjusts every July 1'),
 ('Florida', 15.00, 'Common law', 'HUB', 'Ft Lauderdale / Boca / Tampa floors; $15 from Sept 30, 2026'),
 ('Georgia', 7.25, 'Common law', 'SOME', 'Atlanta call-centre talent'),
 ('Hawaii', 16.00, 'ABC', 'REMOTE', ''),
 ('Idaho', 7.25, 'Common law', 'REMOTE', ''),
 ('Illinois', 15.00, 'ABC (unemployment) / common law', 'SOME', 'Chicago: Beyond Finance'),
 ('Indiana', 7.25, 'Common law', 'REMOTE', ''),
 ('Iowa', 7.25, 'Common law', 'REMOTE', ''),
 ('Kansas', 7.25, 'Common law', 'REMOTE', ''),
 ('Kentucky', 7.25, 'Common law', 'REMOTE', ''),
 ('Louisiana', 7.25, 'Common law', 'REMOTE', ''),
 ('Maine', 15.10, 'ABC', 'REMOTE', ''),
 ('Maryland', 15.00, 'ABC', 'SOME', 'Baltimore: ClearOne Advantage'),
 ('Massachusetts', 15.00, 'ABC (strict)', 'REMOTE', 'Commission-only inside sales owed separate OT and Sunday premium'),
 ('Michigan', 13.73, 'Economic realities', 'REMOTE', ''),
 ('Minnesota', 11.41, 'Common law', 'REMOTE', ''),
 ('Mississippi', 7.25, 'Common law', 'REMOTE', ''),
 ('Missouri', 15.00, 'Common law', 'REMOTE', ''),
 ('Montana', 10.85, 'Common law', 'REMOTE', ''),
 ('Nebraska', 15.00, 'ABC (unemployment)', 'REMOTE', ''),
 ('Nevada', 12.00, 'ABC (modified)', 'SOME', 'Las Vegas call-centre talent'),
 ('New Hampshire', 7.25, 'ABC', 'REMOTE', ''),
 ('New Jersey', 15.92, 'ABC (strict)', 'SOME', '$14.23 for employers under 6 staff'),
 ('New Mexico', 12.00, 'ABC', 'REMOTE', ''),
 ('New York', 16.00, 'Common law', 'HUB', '$17.00 NYC / LI / Westchester; written commission agreement required; NDR HQ'),
 ('North Carolina', 7.25, 'Common law', 'SOME', 'Charlotte call-centre talent'),
 ('North Dakota', 7.25, 'Common law', 'REMOTE', ''),
 ('Ohio', 11.00, 'Common law', 'REMOTE', ''),
 ('Oklahoma', 7.25, 'Common law', 'REMOTE', ''),
 ('Oregon', 15.05, 'Economic realities', 'REMOTE', '$16.30 Portland metro'),
 ('Pennsylvania', 7.25, 'Common law', 'REMOTE', ''),
 ('Rhode Island', 16.00, 'Common law', 'REMOTE', ''),
 ('South Carolina', 7.25, 'Common law', 'REMOTE', ''),
 ('South Dakota', 11.85, 'Common law', 'REMOTE', ''),
 ('Tennessee', 7.25, 'Common law', 'SOME', 'Nashville / Memphis call-centre talent'),
 ('Texas', 7.25, 'Common law', 'HUB', 'Houston / Dallas / San Antonio: Beyond, Americor'),
 ('Utah', 7.25, 'Common law', 'SOME', 'Salt Lake City call-centre talent'),
 ('Vermont', 14.42, 'ABC', 'REMOTE', ''),
 ('Virginia', 12.77, 'Common law', 'REMOTE', ''),
 ('Washington', 17.13, 'Economic realities', 'REMOTE', 'Seattle higher local rate'),
 ('West Virginia', 8.75, 'ABC (unemployment)', 'REMOTE', ''),
 ('Wisconsin', 7.25, 'Common law', 'REMOTE', ''),
 ('Wyoming', 7.25, 'Common law', 'REMOTE', ''),
]

def sorted_states():
    return sorted(STATES, key=lambda s: (s[1], s[0]))

# Employer-side costs on a W-2 closer, as a share of gross pay (planning figures)
EMPLOYER_COSTS = [
    ('Social Security + Medicare (FICA)', '7.65% of gross pay'),
    ('Federal unemployment (FUTA)', '0.6% of first $7,000 ($42 / yr)'),
    ('State unemployment (SUTA)', '1%–4% of the first $7k–$60k wage base, by state and experience rating'),
    ('Workers\' compensation (clerical / telesales class)', '~0.1%–0.4% of payroll'),
    ('Payroll service', '$40–$60 / month per employee'),
    ('Paid sick leave', 'Required in CA, WA, OR, CO, AZ, NY, NJ, MA, MD, MN, IL, MI, NV, CT, VT, RI, ME, NM, DC; typically 1 hr per 30–40 worked'),
    ('Planning total', 'Hourly rate × 1.10–1.14 covers everything above'),
]
