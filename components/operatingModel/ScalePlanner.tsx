import React from 'react';
import type { ModelInputs } from './types';
import { Callout, Field, NumberInput, Panel, Row, T, fmtMoney, fmtMoney2, fmtNum, fmtPct, td, tdNum, th } from './ui';
import { DEFAULT_SCALE_SETTINGS, planScale, planScaleRow, type ScalePlanRow, type ScalePlanSettings } from './scalePlan';
import { BACKEND_KEYS } from './types';

/** Hold the observed first-pay rate and vary the cancel rate, plus one row for better qualifying. */
function retentionCases(firstPay: number, cancel: number): { label: string; firstPay: number; cancel: number }[] {
  const cancels = Array.from(new Set([cancel, 10, 6, 4])).sort((a, b) => b - a);
  const rows = cancels.map((c) => ({ label: `${firstPay}% first pay · ${c}%/mo cancel${c === cancel ? ' (current)' : ''}`, firstPay, cancel: c }));
  rows.push({ label: `${Math.min(95, firstPay + 10)}% first pay (better qualifying) · 6%/mo`, firstPay: Math.min(95, firstPay + 10), cancel: 6 });
  return rows;
}
function withRetention(inputs: ModelInputs, firstPay: number, cancel: number): ModelInputs {
  const curves = { ...inputs.survivalCurves };
  for (const k of BACKEND_KEYS) curves[k] = { firstPayPct: firstPay, cancelPctByMonth: [cancel], steadyStateMonthlyCancelPct: cancel };
  return { ...inputs, survivalCurves: curves };
}

/**
 * 2c · Scale Planner — works backwards from headcount.
 *
 * For each closer headcount: how many transfers the vendors can supply, how
 * much mail must be sent and how much social bought to keep the rest of the
 * closers' time full, and what is left after labor, commission, bonuses,
 * marketing and overhead. Run at a 48-month horizon so Shield / ELP residuals
 * mature; the monthly figures are the run-rate over the final six months.
 */
export default function ScalePlanner({ inputs }: { inputs: ModelInputs }) {
  const [s, setS] = React.useState<ScalePlanSettings>(DEFAULT_SCALE_SETTINGS);
  const [pick, setPick] = React.useState<number>(6);
  const [compare, setCompare] = React.useState(true);

  const rows = React.useMemo(() => planScale(inputs, s), [inputs, s]);
  const transfersOnly = React.useMemo(
    () => (compare ? planScale(inputs, { ...s, transferCapPerMonth: 0 }) : null),
    [inputs, s, compare],
  );
  const sel = rows.find((r) => r.closers === pick) ?? rows[0];
  const selT = transfersOnly?.find((r) => r.closers === sel.closers);

  const dm = inputs.marketing.directMail;
  const dataPerPiece = dm.piecesPerMonth > 0 ? dm.dataCostPerMonth / dm.piecesPerMonth : 0.15;
  const allInPiece = dm.costPerPiece + dataPerPiece;
  const piecesPerDeal = (dm.responsePct / 100) * (dm.qualifiedPct / 100) * (dm.closeRatePct / 100);
  const mailPerDeal = piecesPerDeal > 0 ? allInPiece / piecesPerDeal : 0;
  const netPerDeal = sel.deals > 0 ? (sel.revenue - sel.repCommission) / sel.deals : 0;
  const maxPiece = netPerDeal * piecesPerDeal; // all-in $/piece at which mail breaks even

  const money = (v: number, strong = false) => (
    <span style={{ fontFamily: T.mono, fontWeight: strong ? 800 : 600, color: v < 0 ? T.bad : T.ink }}>{fmtMoney(v)}</span>
  );

  const tile = (label: string, value: React.ReactNode, sub?: string) => (
    <div key={label} style={{ background: '#fff', border: `1px solid ${T.line}`, borderRadius: 8, padding: '8px 10px' }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, fontFamily: T.mono }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: T.muted }}>{sub}</div>}
    </div>
  );

  const anyMarketing = rows.some((r) => r.marketingSpend > 0);
  const marketingPays = anyMarketing && rows.every((r) => r.netProfit >= (transfersOnly?.find((t) => t.closers === r.closers)?.netProfit ?? -Infinity) - 1);

  return (
    <Panel title="2c · Scale Planner — what each headcount needs, and what it earns" accent={T.accent}
      tooltip="Works backwards from closers on the phones. Purchased transfers fill talk time first, up to what vendors can deliver per month; direct mail and paid social are sized to feed everything above that, using the rates in Growth Marketing. Figures are the mature monthly run-rate (months 43–48) with every cost in the model paid.">

      <Row cols={4} gap={12}>
        <Field label="Transfers vendors can deliver / month" tooltip="Billed transfers available at the buffer mix above. This is the real ceiling on cheap calls — set it from what vendors actually fill today. Above it, every extra closer has to be fed by owned marketing. 0 = unlimited.">
          <NumberInput value={s.transferCapPerMonth} min={0} step={50} onChange={(v) => setS({ ...s, transferCapPerMonth: v })} />
        </Field>
        <Field label="Of the marketing-fed calls, share from mail" tooltip="The rest comes from paid social. Mail is the prescreen-targeted channel (bigger debt loads); social retargets the mailed ZIPs.">
          <NumberInput value={s.mailSharePct} min={0} max={100} step={5} suffix="%" onChange={(v) => setS({ ...s, mailSharePct: v })} />
        </Field>
        <Field label="Illustrate headcount">
          <select value={sel.closers} onChange={(e) => setPick(Number(e.target.value))}
            style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${T.line}`, fontSize: 13, fontWeight: 700 }}>
            {rows.map((r) => <option key={r.closers} value={r.closers}>{r.closers} paid closers{r.ownerIncluded ? ' + owner' : ''}</option>)}
          </select>
        </Field>
        <Field label="Compare against transfers only">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '8px 0' }}>
            <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} /> show the same roster fed only by transfers
          </label>
        </Field>
      </Row>

      {/* ── Headline for the picked headcount ── */}
      <div style={{ marginTop: 14, border: `1px solid ${T.line}`, borderRadius: 10, padding: 12, background: '#fafcfb' }}>
        <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 8 }}>
          {sel.closers} paid closers{sel.ownerIncluded ? ' plus the owner-operator' : ''} — {fmtNum(sel.closerHoursPerMonth)} closer hours a month
        </div>
        <Row cols={6} gap={10}>
          {tile('Transfers bought / mo', fmtNum(sel.transfersPurchased), fmtMoney(sel.transferSpend) + ' at the buffer mix')}
          {tile('Mail pieces / mo', fmtNum(sel.mailPieces), fmtMoney(sel.mailSpend) + ' incl. data')}
          {tile('Paid social / mo', fmtMoney(sel.socialSpend), sel.creativeSpend ? '+ ' + fmtMoney(sel.creativeSpend) + ' creative & tracking' : undefined)}
          {tile('Deals / mo', fmtNum(sel.deals, 1), fmtNum(sel.marketingDeals, 1) + ' from owned marketing')}
          {tile('Enrolled debt / mo', fmtMoney(sel.enrolledVolume))}
          {tile('Revenue / mo', fmtMoney(sel.revenue), fmtMoney(sel.revenuePerDeal) + ' per deal, mature')}
        </Row>
        <Row cols={6} gap={10} style={{ marginTop: 10 }}>
          {tile('Labor / mo', fmtMoney(sel.laborCost))}
          {tile('Commission + bonuses', fmtMoney(sel.repCommission + sel.bonusesAndOverride))}
          {tile('Marketing / mo', fmtMoney(sel.marketingSpend))}
          {tile('Other overhead', fmtMoney(sel.otherOverhead), 'telecom, software, credit pulls, fixed')}
          {tile('Net profit / mo', money(sel.netProfit, true), fmtPct(sel.marginPct, 0) + ' margin')}
          {tile('Capital to get there', fmtMoney(sel.peakCapital), sel.firstCashPositiveMonth ? `cash-positive month ${sel.firstCashPositiveMonth}` : 'never cash-positive at these rates')}
        </Row>
        {selT && (
          <div style={{ fontSize: 12.5, color: T.body, marginTop: 10 }}>
            Same {sel.closers} closers fed only by transfers (if vendors could supply {fmtNum(selT.transfersPurchased)} a month):
            revenue <strong>{fmtMoney(selT.revenue)}</strong>, net profit <strong style={{ color: selT.netProfit < 0 ? T.bad : T.good }}>{fmtMoney(selT.netProfit)}</strong> a month,
            {' '}{fmtMoney(selT.peakCapital)} of capital, cash-positive month {selT.firstCashPositiveMonth ?? '—'}.
            Owned marketing changes net profit by <strong style={{ color: sel.netProfit - selT.netProfit < 0 ? T.bad : T.good }}>{fmtMoney(sel.netProfit - selT.netProfit)}</strong> a month at this headcount.
          </div>
        )}
      </div>

      {/* ── Table across headcounts ── */}
      <div style={{ overflowX: 'auto', marginTop: 14 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 1180 }}>
          <thead><tr>
            <th style={th}>Paid closers</th>
            <th style={{ ...th, textAlign: 'right' }}>Transfers / mo</th>
            <th style={{ ...th, textAlign: 'right' }}>Mail pieces / mo</th>
            <th style={{ ...th, textAlign: 'right' }}>Mail + data $</th>
            <th style={{ ...th, textAlign: 'right' }}>Social $</th>
            <th style={{ ...th, textAlign: 'right' }}>Deals / mo</th>
            <th style={{ ...th, textAlign: 'right' }}>Enrolled debt / mo</th>
            <th style={{ ...th, textAlign: 'right' }}>Revenue / mo</th>
            <th style={{ ...th, textAlign: 'right' }}>Labor</th>
            <th style={{ ...th, textAlign: 'right' }}>Comm. + bonus</th>
            <th style={{ ...th, textAlign: 'right' }}>Marketing</th>
            <th style={{ ...th, textAlign: 'right' }}>Transfers + other</th>
            <th style={{ ...th, textAlign: 'right' }}>Net profit / mo</th>
            {compare && <th style={{ ...th, textAlign: 'right' }}>Transfers-only net</th>}
            <th style={{ ...th, textAlign: 'right' }}>Capital needed</th>
            <th style={{ ...th, textAlign: 'right' }}>Cash+ month</th>
          </tr></thead>
          <tbody>
            {rows.map((r: ScalePlanRow) => {
              const t = transfersOnly?.find((x) => x.closers === r.closers);
              const isSel = r.closers === sel.closers;
              return (
                <tr key={r.closers} onClick={() => setPick(r.closers)} style={{ cursor: 'pointer', background: isSel ? T.brandSoft : undefined }}>
                  <td style={{ ...td, fontWeight: 800 }}>{r.closers}{r.ownerIncluded ? ' + owner' : ''}</td>
                  <td style={tdNum}>{fmtNum(r.transfersPurchased)}</td>
                  <td style={tdNum}>{fmtNum(r.mailPieces)}</td>
                  <td style={tdNum}>{fmtMoney(r.mailSpend)}</td>
                  <td style={tdNum}>{fmtMoney(r.socialSpend)}</td>
                  <td style={tdNum}>{fmtNum(r.deals, 1)}</td>
                  <td style={tdNum}>{fmtMoney(r.enrolledVolume)}</td>
                  <td style={{ ...tdNum, fontWeight: 700 }}>{fmtMoney(r.revenue)}</td>
                  <td style={tdNum}>{fmtMoney(r.laborCost)}</td>
                  <td style={tdNum}>{fmtMoney(r.repCommission + r.bonusesAndOverride)}</td>
                  <td style={tdNum}>{fmtMoney(r.marketingSpend)}</td>
                  <td style={tdNum}>{fmtMoney(r.transferSpend + r.otherOverhead)}</td>
                  <td style={tdNum}>{money(r.netProfit, true)}</td>
                  {compare && <td style={tdNum}>{t ? money(t.netProfit) : '—'}</td>}
                  <td style={tdNum}>{fmtMoney(r.peakCapital)}</td>
                  <td style={tdNum}>{r.firstCashPositiveMonth ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 11.5, color: T.muted, marginTop: 6 }}>
        Click a row to illustrate it above. Monthly figures are the mature run-rate (average of the last six of 48 months) so Shield and ELP residuals are counted; "capital needed" is the deepest the cash position goes before the book carries itself.
      </div>

      {/* ── Retention sensitivity ── */}
      <RetentionStrip inputs={inputs} settings={s} closers={sel.closers} />

      {/* ── Profit by headcount — bars ── */}
      <ProfitBars rows={rows} transfersOnly={transfersOnly} />

      {/* ── Unit economics: what the first drop has to prove ── */}
      <div style={{ marginTop: 14, border: `1px solid ${T.line}`, borderRadius: 10, padding: 12 }}>
        <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 8 }}>Cost to acquire one deal, by source — against what a deal earns</div>
        <Row cols={5} gap={10}>
          {tile('Mature revenue per deal', fmtMoney(sel.revenuePerDeal), 'blended across the three partners')}
          {tile('Net of rep commission', fmtMoney(netPerDeal), 'what a deal can afford to cost')}
          {tile('Transfer deal costs', fmtMoney(sel.transferCostPerDeal || (inputs.operations.buffers.reduce((a, b) => a + b.price * b.mixPct, 0) / 100) / (inputs.operations.closeRatePct / 100)), 'buffer mix ÷ close rate')}
          {tile('Mail deal costs', fmtMoney(mailPerDeal), `${fmtNum(1 / Math.max(piecesPerDeal, 1e-9))} pieces × ${fmtMoney2(allInPiece)} all-in`)}
          {tile('Social deal costs', fmtMoney(sel.socialCostPerDeal || inputs.marketing.paidSocial.costPerLead / ((inputs.marketing.paidSocial.qualifiedPct / 100) * (inputs.marketing.paidSocial.closeRatePct / 100))), 'CPL ÷ (qualified × close)')}
        </Row>
        {mailPerDeal > netPerDeal ? (
          <Callout tone="warn">
            At the current assumptions a mail deal costs <strong>{fmtMoney(mailPerDeal)}</strong> to acquire and earns <strong>{fmtMoney(netPerDeal)}</strong> after commission over its life, so mail-fed growth loses money at every headcount. For mail to pay, the first test drop has to show <strong>a response rate of about {fmtNum(sel.breakEvenResponsePct, 2)}%</strong> (vs {fmtNum(dm.responsePct, 2)}% assumed) at today's qualified share and close rate, <strong>or an all-in cost per piece near {fmtMoney2(maxPiece)}</strong> — or a higher average debt / close rate on the people it reaches. Transfers at {fmtMoney(sel.transferCostPerDeal)} a deal remain the cheapest call; the case for mail is that vendors can only supply {fmtNum(s.transferCapPerMonth)} a month, so it is the only way to feed more closers. Change the Growth Marketing assumptions above and this planner recomputes.
          </Callout>
        ) : (
          <Callout tone="good">
            A mail deal costs <strong>{fmtMoney(mailPerDeal)}</strong> and earns <strong>{fmtMoney(netPerDeal)}</strong> after commission over its life, so every closer that mail feeds adds profit{marketingPays ? '' : ' at most headcounts'}. Break-even response rate is {fmtNum(sel.breakEvenResponsePct, 2)}% against {fmtNum(dm.responsePct, 2)}% assumed — the margin of safety for the first drop.
          </Callout>
        )}
      </div>
    </Panel>
  );
}

function RetentionStrip({ inputs, settings, closers }: { inputs: ModelInputs; settings: ScalePlanSettings; closers: number }) {
  const cur = inputs.survivalCurves.LEVEL;
  const rows = React.useMemo(() => retentionCases(cur.firstPayPct, cur.steadyStateMonthlyCancelPct).map((c) => ({
    ...c,
    mk: planScaleRow(withRetention(inputs, c.firstPay, c.cancel), closers, settings),
    tx: planScaleRow(withRetention(inputs, c.firstPay, c.cancel), closers, { ...settings, transferCapPerMonth: 0 }),
  })), [inputs, settings, closers, cur.firstPayPct, cur.steadyStateMonthlyCancelPct]);
  return (
    <div style={{ marginTop: 14, border: `1px solid ${T.warnLine}`, background: T.warnBg, borderRadius: 10, padding: 12 }}>
      <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 2 }}>The assumption that decides this: first-payment clear and monthly cancellation (Risk &amp; Attrition, section 6)</div>
      <div style={{ fontSize: 12, color: T.body, marginBottom: 8 }}>
        The model currently runs at <strong>{cur.firstPayPct}% first pay</strong> and <strong>{cur.steadyStateMonthlyCancelPct}% cancellation a month</strong> for every program. A Level Debt file pays its 8% only if the first payment clears; every Shield and ELP monthly payment is multiplied by the share of files still active, which shrinks by the cancel rate every month. Same {closers} closers, same spend, four retention cases:
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
        <thead><tr>
          <th style={th}>Retention case</th>
          <th style={{ ...th, textAlign: 'right' }}>Mature revenue / deal</th>
          <th style={{ ...th, textAlign: 'right' }}>Mail break-even response</th>
          <th style={{ ...th, textAlign: 'right' }}>Net profit / mo (marketing-fed)</th>
          <th style={{ ...th, textAlign: 'right' }}>Net profit / mo (transfers only)</th>
          <th style={{ ...th, textAlign: 'right' }}>Capital needed</th>
          <th style={{ ...th, textAlign: 'right' }}>Cash+ month</th>
        </tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} style={{ background: r.firstPay === cur.firstPayPct && r.cancel === cur.steadyStateMonthlyCancelPct ? '#fff' : undefined }}>
              <td style={{ ...td, fontWeight: 700 }}>{r.label}</td>
              <td style={tdNum}>{fmtMoney(r.mk.revenuePerDeal)}</td>
              <td style={tdNum}>{fmtNum(r.mk.breakEvenResponsePct, 2)}%</td>
              <td style={{ ...tdNum, fontWeight: 800, color: r.mk.netProfit < 0 ? T.bad : T.good }}>{fmtMoney(r.mk.netProfit)}</td>
              <td style={{ ...tdNum, color: r.tx.netProfit < 0 ? T.bad : T.good }}>{fmtMoney(r.tx.netProfit)}</td>
              <td style={tdNum}>{fmtMoney(r.mk.peakCapital)}</td>
              <td style={tdNum}>{r.mk.firstCashPositiveMonth ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ fontSize: 12, color: T.body, marginTop: 8 }}>
        Set section 6 to the first-pay and cancellation rates the reconciliation engine actually measures and this whole planner moves with it. That number is worth more than any marketing assumption on this page.
      </div>
    </div>
  );
}

function ProfitBars({ rows, transfersOnly }: { rows: ScalePlanRow[]; transfersOnly: ScalePlanRow[] | null }) {
  const W = 1000, H = 220, padL = 70, padB = 28, padT = 16;
  const vals = rows.flatMap((r) => [r.revenue, r.netProfit, ...(transfersOnly ? [transfersOnly.find((t) => t.closers === r.closers)?.netProfit ?? 0] : [])]);
  const max = Math.max(1, ...vals), min = Math.min(0, ...vals);
  const span = max - min || 1;
  const y = (v: number) => padT + ((max - v) / span) * (H - padT - padB);
  const y0 = y(0);
  const gw = (W - padL - 10) / rows.length;
  const bw = Math.min(26, gw / 4);
  const ticks = 4;
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 4 }}>Monthly revenue and net profit by headcount</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="Revenue and net profit by headcount">
        {Array.from({ length: ticks + 1 }, (_, i) => min + (span * i) / ticks).map((v) => (
          <g key={v}>
            <line x1={padL} x2={W - 10} y1={y(v)} y2={y(v)} stroke={T.lineSoft} />
            <text x={padL - 6} y={y(v) + 4} fontSize="10" textAnchor="end" fill={T.muted} fontFamily={T.mono}>{fmtMoney(v)}</text>
          </g>
        ))}
        <line x1={padL} x2={W - 10} y1={y0} y2={y0} stroke={T.muted} />
        {rows.map((r, i) => {
          const cx = padL + gw * i + gw / 2;
          const t = transfersOnly?.find((x) => x.closers === r.closers);
          const bars = [
            { v: r.revenue, c: T.brand, dx: -bw * 1.5 - 3 },
            { v: r.netProfit, c: r.netProfit < 0 ? T.bad : T.good, dx: -bw / 2 },
            ...(t ? [{ v: t.netProfit, c: t.netProfit < 0 ? '#fca5a5' : '#86efac', dx: bw / 2 + 3 }] : []),
          ];
          return (
            <g key={r.closers}>
              {bars.map((b, j) => (
                <rect key={j} x={cx + b.dx} y={Math.min(y(b.v), y0)} width={bw} height={Math.abs(y(b.v) - y0)} fill={b.c} rx={2} />
              ))}
              <text x={cx} y={H - 8} fontSize="11" textAnchor="middle" fill={T.ink} fontWeight={700}>{r.closers} closers</text>
            </g>
          );
        })}
      </svg>
      <div style={{ display: 'flex', gap: 14, fontSize: 11.5, color: T.muted, marginTop: 2 }}>
        <span><i style={{ display: 'inline-block', width: 10, height: 10, background: T.brand, borderRadius: 2, marginRight: 4 }} />Revenue / mo</span>
        <span><i style={{ display: 'inline-block', width: 10, height: 10, background: T.good, borderRadius: 2, marginRight: 4 }} />Net profit / mo (marketing-fed above the transfer cap)</span>
        {transfersOnly && <span><i style={{ display: 'inline-block', width: 10, height: 10, background: '#86efac', borderRadius: 2, marginRight: 4 }} />Net profit / mo if transfers were unlimited</span>}
      </div>
    </div>
  );
}
