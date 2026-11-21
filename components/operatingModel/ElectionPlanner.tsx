import React from 'react';
import type { ModelInputs } from './types';
import { Callout, Field, NumberInput, Panel, Row, T, fmtMoney, fmtNum, td, tdNum, th } from './ui';
import { buildSurvivalCurve, legacy, shield } from './backends';
import { runModel } from './simulate';

/**
 * Election Planner — file buyout vs perpetual (Shield), accelerated vs
 * residual (ELP): net to Funding Tier after the rep, by debt band, at the
 * cancellation rate you choose, with the break-even rate and a calculator for
 * how many files to sell when the reserve needs cash now.
 *
 * The perpetual pays more if the client stays; the buyout pays once and ends
 * the exposure. Which one is worth more is a function of one number — the
 * monthly cancellation rate — so that is the knob.
 */
const BANDS = [10000, 15000, 20000, 25000, 30000];

export default function ElectionPlanner({ inputs }: { inputs: ModelInputs }) {
  const cs = inputs.survivalCurves.CS;
  const [cancel, setCancel] = React.useState<number>(cs.steadyStateMonthlyCancelPct);
  const [cashNeeded, setCashNeeded] = React.useState<number>(25000);
  const [band, setBand] = React.useState<number>(20000);
  const firstPay = cs.firstPayPct;

  const curve = (c: number, n: number) => buildSurvivalCurve({ firstPayPct: firstPay, cancelPctByMonth: [c], steadyStateMonthlyCancelPct: c }, n);

  const shieldRow = (debt: number) => {
    const prog = shield.getProgram(debt, inputs.consumerShield);
    if (!prog) return null;
    const rep = shield.agentCommission(debt, inputs.consumerShield);
    const buyout = shield.buyoutPayout(debt, inputs.consumerShield);
    const full = shield.perpetualFullTerm(debt, inputs.consumerShield);
    const expected = (c: number) => {
      const s = curve(c, prog.term + 2); let t = 0;
      for (let m = 1; m <= prog.term; m++) t += ((s[m] ?? 0) / (s[1] || 1)) * shield.perpetualRevenueForDealMonth(debt, m, inputs.consumerShield);
      return t;
    };
    let lo = 0, hi = 80; for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (expected(mid) > buyout) lo = mid; else hi = mid; }
    const s = curve(cancel, prog.term + 2); let cum = 0, cross = 0;
    for (let m = 1; m <= prog.term; m++) { cum += ((s[m] ?? 0) / (s[1] || 1)) * shield.perpetualRevenueForDealMonth(debt, m, inputs.consumerShield); if (!cross && cum >= buyout) cross = m; }
    const perp = expected(cancel), down = expected(Math.max(cancel, 15)), up = expected(Math.min(cancel, 6));
    const per100k = 100000 / debt;
    return { debt, payment: prog.payment, rep, buyout, full, perp, down, up, breakeven: lo, cross, buyoutNet: buyout - rep, perpNet: perp - rep,
      buyoutPer100k: (buyout - rep) * per100k, perpPer100k: (perp - rep) * per100k, rate: shield.buyoutRate(debt, inputs.consumerShield) };
  };
  const elpRow = (debt: number) => {
    const term = legacy.getMaxTerm(debt, inputs.legacy); if (!term) return null;
    const rep = legacy.agentCommission(debt, inputs.legacy);
    const ex = (c: number, model: 'accelerated' | 'residual') => legacy.expected(debt, inputs.legacy, curve(c, term + 2), model);
    const accel = ex(cancel, 'accelerated'), resid = ex(cancel, 'residual');
    const accelFull = legacy.fullTerm(debt, inputs.legacy, 'accelerated'), residFull = legacy.fullTerm(debt, inputs.legacy, 'residual');
    // cash in first 7 months
    const s = curve(cancel, term + 2); let a7 = 0, r7 = 0;
    for (let m = 1; m <= Math.min(7, term); m++) { const w = (s[m] ?? 0) / (s[1] || 1); a7 += w * legacy.acceleratedRevenueForDealMonth(debt, m, inputs.legacy); r7 += w * legacy.residualRevenueForDealMonth(debt, m, inputs.legacy); }
    return { debt, rep, accel, resid, accelFull, residFull, a7, r7, accelNet: accel - rep, residNet: resid - rep };
  };
  const sRows = BANDS.map(shieldRow).filter(Boolean) as NonNullable<ReturnType<typeof shieldRow>>[];
  const eRows = BANDS.map(elpRow).filter(Boolean) as NonNullable<ReturnType<typeof elpRow>>[];

  const sel = sRows.find((r) => r.debt === band) ?? sRows[0];
  const filesToSell = sel ? Math.ceil(cashNeeded / Math.max(1, sel.buyout)) : 0;
  const valueGivenUp = sel ? filesToSell * Math.max(0, sel.perp - sel.buyout) : 0;

  // Whole-plan scenarios: every Shield file perpetual, half, or every file bought out.
  const elections = React.useMemo(() => [0, 50, 100].map((pct) => {
    const inp: ModelInputs = { ...inputs, ramp: { ...inputs.ramp, horizonMonths: Math.max(inputs.ramp.horizonMonths, 48) }, consumerShield: { ...inputs.consumerShield, buyoutSharePct: pct } };
    const r = runModel(inp); const ms = r.months; const tail = ms.slice(-6);
    const avg = (f: (m: typeof ms[number]) => number) => tail.reduce((a, m) => a + f(m), 0) / Math.max(1, tail.length);
    return { pct, net: avg((m) => m.netCashFlow), rev: avg((m) => m.revenue), y1: ms.slice(0, 12).reduce((a, m) => a + m.netCashFlow, 0), y2: ms.slice(12, 24).reduce((a, m) => a + m.netCashFlow, 0), low: r.totals.lowestCash, cashPos: r.totals.firstCashPositiveMonth, bank24: ms[Math.min(23, ms.length - 1)].cashPosition, bank48: ms[ms.length - 1].cashPosition };
  }), [inputs]);
  const curPct = inputs.consumerShield.buyoutSharePct;

  const under = sRows.filter((r) => r.debt < 20000), over = sRows.filter((r) => r.debt >= 20000);
  const beUnder = under.length ? under[0].breakeven : 0, beOver = over.length ? over[0].breakeven : 0;
  const perpWinsUnder = cancel < beUnder, perpWinsOver = cancel < beOver;

  const money = (v: number, strong = false, tone?: 'good' | 'bad') => (
    <span style={{ fontFamily: T.mono, fontWeight: strong ? 800 : 600, color: tone === 'good' ? T.good : tone === 'bad' ? T.bad : T.ink }}>{fmtMoney(v)}</span>
  );

  return (
    <Panel title="4b · Buyout vs perpetual — net commission, risk and when to diversify" accent="#7c3aed"
      tooltip="Expected value weights every future payment by the share of files still paying. The buyout pays once and ends chargeback exposure; the perpetual pays more only if clients stay. Rep commission is the same under either election, so it is netted out of both.">
      <Row cols={4} gap={12}>
        <Field label="Monthly cancellation to test" tooltip={`Section 6 currently runs ${cs.steadyStateMonthlyCancelPct}%. Replace with the measured rate: active paying files this month ÷ last month.`}>
          <NumberInput value={cancel} min={0} max={60} step={0.5} suffix="%" onChange={setCancel} />
        </Field>
        <Field label="First payment clears"><div style={{ fontFamily: T.mono, fontWeight: 800, fontSize: 16, padding: '7px 0' }}>{firstPay}%</div></Field>
        <Field label="Perpetual wins under $20k when cancel is below"><div style={{ fontFamily: T.mono, fontWeight: 800, fontSize: 16, padding: '7px 0', color: perpWinsUnder ? T.good : T.bad }}>{fmtNum(beUnder, 1)}%</div></Field>
        <Field label="Perpetual wins at $20k+ when cancel is below"><div style={{ fontFamily: T.mono, fontWeight: 800, fontSize: 16, padding: '7px 0', color: perpWinsOver ? T.good : T.bad }}>{fmtNum(beOver, 1)}%</div></Field>
      </Row>

      <div style={{ fontWeight: 800, fontSize: 13, margin: '12px 0 6px' }}>The whole plan three ways — every Debt Validation file perpetual, half and half, or every file bought out</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead><tr>
            <th style={th}>Election</th><th style={{ ...th, textAlign: 'right' }}>Revenue / mo, mature</th><th style={{ ...th, textAlign: 'right' }}>Net profit / mo, mature</th>
            <th style={{ ...th, textAlign: 'right' }}>Year-1 net cash</th><th style={{ ...th, textAlign: 'right' }}>Year-2 net cash</th><th style={{ ...th, textAlign: 'right' }}>Lowest bank</th>
            <th style={{ ...th, textAlign: 'right' }}>Cash-positive month</th><th style={{ ...th, textAlign: 'right' }}>Bank at month 24</th><th style={{ ...th, textAlign: 'right' }}>Bank at month 48</th><th style={th}>Pros / cons</th>
          </tr></thead>
          <tbody>
            {elections.map((e) => (
              <tr key={e.pct} style={{ background: e.pct === curPct ? T.brandSoft : undefined }}>
                <td style={{ ...td, fontWeight: 800 }}>{e.pct === 0 ? '100% perpetual' : e.pct === 100 ? '100% buyout' : '50 / 50'}{e.pct === curPct ? ' (current plan)' : ''}</td>
                <td style={tdNum}>{fmtMoney(e.rev)}</td><td style={{ ...tdNum, fontWeight: 800, color: e.net < 0 ? T.bad : T.good }}>{fmtMoney(e.net)}</td>
                <td style={tdNum}>{fmtMoney(e.y1)}</td><td style={tdNum}>{fmtMoney(e.y2)}</td><td style={tdNum}>{fmtMoney(e.low)}</td>
                <td style={tdNum}>{e.cashPos ?? '—'}</td><td style={tdNum}>{fmtMoney(e.bank24)}</td><td style={tdNum}>{fmtMoney(e.bank48)}</td>
                <td style={{ ...td, whiteSpace: 'normal', fontSize: 11.5 }}>{e.pct === 0 ? 'Highest lifetime value and run-rate; slowest cash; every file carries month-by-month cancellation risk and chargeback exposure until it ages.' : e.pct === 100 ? 'Fastest cash and no chargeback tail; gives up the residual book, so the mature run-rate is lowest; the right default only when cancellation runs above break-even.' : 'Half the residual book, half the liquidity; the hedge when measured cancellation sits near break-even or the reserve is still being built.'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 11.5, color: T.muted, marginTop: 4 }}>Set the election for the plan in section 3b (Shield buyout share); this table re-runs the full 48-month model at 0%, 50% and 100% on everything else as entered.</div>

      <div style={{ fontWeight: 800, fontSize: 13, margin: '12px 0 6px' }}>Debt Validation (SS) — per cleared file, after the rep (rep applies to US / owner-closed deals only)</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 1050 }}>
          <thead><tr>
            <th style={th}>Enrolled debt</th><th style={{ ...th, textAlign: 'right' }}>Client payment</th><th style={{ ...th, textAlign: 'right' }}>Rep</th>
            <th style={{ ...th, textAlign: 'right' }}>Buyout lump</th><th style={{ ...th, textAlign: 'right' }}>Buyout net</th>
            <th style={{ ...th, textAlign: 'right' }}>Perpetual payout if never cancels</th><th style={{ ...th, textAlign: 'right' }}>Perpetual expected @ {fmtNum(cancel, 1)}%</th><th style={{ ...th, textAlign: 'right' }}>Perpetual net</th>
            <th style={{ ...th, textAlign: 'right' }}>Downside @15%</th><th style={{ ...th, textAlign: 'right' }}>Upside @6%</th>
            <th style={{ ...th, textAlign: 'right' }}>Break-even cancel</th><th style={{ ...th, textAlign: 'right' }}>Months for perpetual to pass buyout</th>
            <th style={{ ...th, textAlign: 'right' }}>Net per $100k enrolled — buyout / perpetual</th><th style={th}>Call</th>
          </tr></thead>
          <tbody>
            {sRows.map((r) => {
              const perpWins = r.perp > r.buyout;
              return (
                <tr key={r.debt} style={{ background: r.debt === band ? T.brandSoft : undefined, cursor: 'pointer' }} onClick={() => setBand(r.debt)}>
                  <td style={{ ...td, fontWeight: 800 }}>{fmtMoney(r.debt)}<span style={{ color: T.muted, fontWeight: 400 }}> · {fmtNum(r.rate * 100)}% × 6</span></td>
                  <td style={tdNum}>{fmtMoney(r.payment)}</td><td style={tdNum}>{fmtMoney(r.rep)}</td>
                  <td style={tdNum}>{fmtMoney(r.buyout)}</td><td style={tdNum}>{money(r.buyoutNet, true, perpWins ? undefined : 'good')}</td>
                  <td style={tdNum}>{fmtMoney(r.full)}</td><td style={tdNum}>{fmtMoney(r.perp)}</td><td style={tdNum}>{money(r.perpNet, true, perpWins ? 'good' : undefined)}</td>
                  <td style={tdNum}>{fmtMoney(r.down - r.rep)}</td><td style={tdNum}>{fmtMoney(r.up - r.rep)}</td>
                  <td style={tdNum}>{fmtNum(r.breakeven, 1)}%</td><td style={tdNum}>{r.cross ? `month ${r.cross}` : 'never'}</td>
                  <td style={tdNum}>{fmtMoney(r.buyoutPer100k)} / {fmtMoney(r.perpPer100k)}</td>
                  <td style={td}><span style={{ fontSize: 11, fontWeight: 800, padding: '2px 7px', borderRadius: 6, background: perpWins ? T.goodBg : '#fef3c7', color: perpWins ? T.good : '#92400e', whiteSpace: 'nowrap' }}>{perpWins ? `Hold perpetual (+${fmtMoney(r.perp - r.buyout)})` : `Buy out (+${fmtMoney(r.buyout - r.perp)})`}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ fontWeight: 800, fontSize: 13, margin: '12px 0 6px' }}>Debt Resolution (ELP) — accelerated vs residual, per cleared file, after the rep</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 900 }}>
          <thead><tr>
            <th style={th}>Enrolled debt</th><th style={{ ...th, textAlign: 'right' }}>Rep</th>
            <th style={{ ...th, textAlign: 'right' }}>Accelerated payout if never cancels</th><th style={{ ...th, textAlign: 'right' }}>Residual payout if never cancels</th>
            <th style={{ ...th, textAlign: 'right' }}>Accelerated net @ {fmtNum(cancel, 1)}%</th><th style={{ ...th, textAlign: 'right' }}>Residual net @ {fmtNum(cancel, 1)}%</th>
            <th style={{ ...th, textAlign: 'right' }}>Cash in first 7 months — accel / resid</th><th style={{ ...th, textAlign: 'right' }}>Net per $100k — accel / resid</th><th style={th}>Call</th>
          </tr></thead>
          <tbody>
            {eRows.map((r) => (
              <tr key={r.debt}>
                <td style={{ ...td, fontWeight: 800 }}>{fmtMoney(r.debt)}</td><td style={tdNum}>{fmtMoney(r.rep)}</td>
                <td style={tdNum}>{fmtMoney(r.accelFull)}</td><td style={tdNum}>{fmtMoney(r.residFull)}</td>
                <td style={tdNum}>{money(r.accelNet, true)}</td><td style={tdNum}>{money(r.residNet, true, 'good')}</td>
                <td style={tdNum}>{fmtMoney(r.a7)} / {fmtMoney(r.r7)}</td>
                <td style={tdNum}>{fmtMoney(r.accelNet * (100000 / r.debt))} / {fmtMoney(r.residNet * (100000 / r.debt))}</td>
                <td style={td}><span style={{ fontSize: 11, fontWeight: 800, padding: '2px 7px', borderRadius: 6, background: T.goodBg, color: T.good, whiteSpace: 'nowrap' }}>Residual (+{fmtMoney(r.resid - r.accel)}); accelerate for cash only</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Row cols={2} gap={12} style={{ marginTop: 12 }}>
        <div style={{ border: `1px solid ${T.line}`, borderRadius: 10, padding: 12 }}>
          <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 6 }}>When the reserve needs cash now</div>
          <Row cols={2}>
            <Field label="Cash needed this month"><NumberInput value={cashNeeded} min={0} step={1000} prefix="$" onChange={setCashNeeded} /></Field>
            <Field label="Files in band"><select value={band} onChange={(e) => setBand(Number(e.target.value))} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${T.line}`, fontSize: 13, fontWeight: 700 }}>{sRows.map((r) => <option key={r.debt} value={r.debt}>{fmtMoney(r.debt)} Shield files</option>)}</select></Field>
          </Row>
          {sel && (
            <div style={{ fontSize: 12.5, marginTop: 6 }}>
              Sell <strong>{filesToSell}</strong> cleared {fmtMoney(sel.debt)} files as buyouts → <strong>{fmtMoney(filesToSell * sel.buyout)}</strong> arrives in the next remittance.
              {sel.perp > sel.buyout
                ? <> Expected value given up: <strong style={{ color: T.bad }}>{fmtMoney(valueGivenUp)}</strong> over the files' lives ({fmtMoney(sel.perp - sel.buyout)} each) — the price of liquidity at {fmtNum(cancel, 1)}% cancellation.</>
                : <> At {fmtNum(cancel, 1)}% cancellation the buyout is already the higher-value election in this band, so there is nothing given up.</>}
            </div>
          )}
        </div>
        <div style={{ border: `1px solid ${T.line}`, borderRadius: 10, padding: 12 }}>
          <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 6 }}>Diversification rule</div>
          <ol style={{ fontSize: 12.5, paddingLeft: 18, margin: 0, lineHeight: 1.5 }}>
            <li><strong>Measure cancellation monthly by program.</strong> It is the only input that flips the answer.</li>
            <li><strong>$20k+ Shield files:</strong> perpetual when cancellation is under {fmtNum(beOver, 1)}%, buyout above it. Today ({fmtNum(cancel, 1)}%): <strong>{perpWinsOver ? 'hold the perpetual' : 'buy out'}</strong>.</li>
            <li><strong>Under $20k Shield files:</strong> perpetual when cancellation is under {fmtNum(beUnder, 1)}%, buyout above it. Today: <strong>{perpWinsUnder ? 'hold the perpetual' : 'buy out'}</strong>.</li>
            <li><strong>ELP:</strong> residual by default; elect accelerated only when the reserve is short, because it costs {fmtMoney(eRows[1]?.resid - eRows[1]?.accel || 0)} of expected value per $15k file for faster cash.</li>
            <li><strong>Bank below reserve:</strong> sell the number of files the calculator shows, highest-band first (largest lump, smallest give-up); bank above reserve: hold everything that the table says to hold.</li>
            <li><strong>Diversify when cancellation is within ±3 points of break-even</strong> — split the band 50/50 so neither a better nor a worse retention outcome hurts.</li>
          </ol>
        </div>
      </Row>
      {cancel !== cs.steadyStateMonthlyCancelPct && (
        <Callout tone="warn">You are testing {fmtNum(cancel, 1)}% here while section 6 runs the model at {cs.steadyStateMonthlyCancelPct}%. The month-by-month and the verdict above still use section 6; change it there when the measured rate is in.</Callout>
      )}
    </Panel>
  );
}
