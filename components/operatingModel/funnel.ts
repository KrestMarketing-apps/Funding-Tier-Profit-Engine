import type {
  ModelInputs, TransferBuffer, TransferFunnel, BufferFunnel,
} from './types';

/**
 * Transfer economics.
 *
 * A vendor routes a live call. If the caller hangs up before the buffer
 * elapses, the transfer is a DUD and is never billed. That is the whole reason
 * a 5-minute buffer costs $55 while a 1-minute buffer costs $8 — the longer
 * buffer is insurance against paying for calls that die on contact.
 *
 * Three quantities describe the funnel and only two are independent:
 *
 *     raw transfers × pass rate = billed transfers
 *     deals = raw × close-rate-on-all = billed × close-rate-on-billed
 *   ⇒ close-on-all = close-on-billed × pass rate
 *
 * Everything below normalises to close-on-billed, derives the rest, and
 * reports cost per CLOSED deal — the only figure that lets one buffer be
 * compared with another.
 */

/** Close rate on billed transfers, whichever basis the input was quoted on. */
function closeOnBilled(b: TransferBuffer, basis: 'billed' | 'all'): number {
  const c = b.closeRatePct / 100;
  if (basis === 'billed') return c;
  const p = b.passRatePct / 100;
  return p > 0 ? Math.min(1, c / p) : 0;
}

export function computeFunnel(
  inputs: ModelInputs,
  deals: number,
  openerSuppliedTransfers: number,
): TransferFunnel {
  const ops = inputs.operations;
  const basis = ops.closeRateBasis;
  const buffers = ops.buffers;

  // Share of BILLED transfers coming from each tier. A tier with a low pass
  // rate contributes fewer billed transfers than its raw mix suggests.
  const weights = buffers.map((b) => (b.mixPct / 100) * (b.passRatePct / 100));
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const billedShare = buffers.map((_, i) => (weightSum > 0 ? weights[i] / weightSum : 0));

  const blendedCloseOnBilled = buffers.reduce(
    (s, b, i) => s + billedShare[i] * closeOnBilled(b, basis), 0,
  );

  const requiredBilled = blendedCloseOnBilled > 0 ? deals / blendedCloseOnBilled : 0;
  const openerCoveredBilled = Math.min(requiredBilled, Math.max(0, openerSuppliedTransfers));
  const purchasedBilled = Math.max(0, requiredBilled - openerCoveredBilled);

  const rows: BufferFunnel[] = buffers.map((b, i) => {
    const p = b.passRatePct / 100;
    const billedTransfers = purchasedBilled * billedShare[i];
    const rawTransfers = p > 0 ? billedTransfers / p : 0;
    const dealsHere = billedTransfers * closeOnBilled(b, basis);
    const cost = billedTransfers * b.price;
    return {
      key: b.key, label: b.label, price: b.price, mixPct: b.mixPct,
      passRatePct: b.passRatePct, closeRatePct: b.closeRatePct,
      rawTransfers, duds: rawTransfers - billedTransfers, billedTransfers,
      deals: dealsHere, cost,
      costPerDeal: dealsHere > 0 ? cost / dealsHere : 0,
    };
  });

  const rawTransfers = rows.reduce((s, r) => s + r.rawTransfers, 0);
  const billedTransfers = rows.reduce((s, r) => s + r.billedTransfers, 0);
  const totalCost = rows.reduce((s, r) => s + r.cost, 0);
  const purchasedDeals = rows.reduce((s, r) => s + r.deals, 0);

  // Opener-supplied transfers are qualified in-house, so they are billed at $0
  // but still convert at the blended rate.
  const openerRaw = weightSum > 0 ? openerCoveredBilled / weightSum : 0;
  const totalRaw = rawTransfers + openerRaw;
  const totalBilled = billedTransfers + openerCoveredBilled;

  return {
    buffers: rows,
    rawTransfers: totalRaw,
    duds: totalRaw - totalBilled,
    billedTransfers: totalBilled,
    blendedPassRatePct: totalRaw > 0 ? (totalBilled / totalRaw) * 100 : 0,
    dudRatePct: totalRaw > 0 ? ((totalRaw - totalBilled) / totalRaw) * 100 : 0,
    closeRateOnAllPct: totalRaw > 0 ? (deals / totalRaw) * 100 : 0,
    closeRateOnBilledPct: totalBilled > 0 ? (deals / totalBilled) * 100 : 0,
    blendedPricePerBilled: billedTransfers > 0 ? totalCost / billedTransfers : 0,
    costPerClosedDeal: deals > 0 ? totalCost / deals : 0,
    totalCost,
    openerCoveredRaw: openerRaw,
  };
}

/** Blended close rate on billed transfers — what the capacity model needs. */
export function blendedCloseRateOnBilled(inputs: ModelInputs): number {
  const ops = inputs.operations;
  const weights = ops.buffers.map((b) => (b.mixPct / 100) * (b.passRatePct / 100));
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) return ops.closeRatePct / 100;
  return ops.buffers.reduce(
    (s, b, i) => s + (weights[i] / sum) * closeOnBilled(b, ops.closeRateBasis), 0,
  );
}

/** Blended close rate against every transfer taken, duds included. */
export function blendedCloseRateOnAll(inputs: ModelInputs): number {
  const ops = inputs.operations;
  const onBilled = blendedCloseRateOnBilled(inputs);
  const pass = ops.buffers.reduce((s, b) => s + (b.mixPct / 100) * (b.passRatePct / 100), 0);
  return onBilled * pass;
}
