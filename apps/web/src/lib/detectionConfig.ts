/**
 * Detection parameters.
 *
 * Every threshold the engine uses lives here. Nothing is tuned to a particular
 * register: the values are chosen from the statistical or control rationale
 * noted against each one, so the same settings hold on a different file with
 * different vendors, amounts and dates. The scenarios in test/engine measure
 * them against routine spend and planted problems.
 */
/** Symbols for the currencies a workspace can report in. */
export const CURRENCY_SYMBOLS: Record<string, string> = { USD: '$', GBP: '£', EUR: '€', CAD: 'C$', AUD: 'A$' }

export interface DetectionConfig {
  /** The currency findings are written in. */
  currency: string

  // ── Materiality ────────────────────────────────────────────────────────────
  /**
   * The smallest excess over a baseline worth a reviewer's time. Amount rules
   * only fire when the payment is this much above what was expected, so a
   * $40 coffee order four times its usual size never reaches the queue.
   */
  minExcess: number

  // ── Duplicate payments ─────────────────────────────────────────────────────
  /** Same vendor and amount further apart than this is never a duplicate. */
  duplicateWindowDays: number
  /**
   * An extra same-amount payment inside a recurring series is a duplicate when
   * it lands sooner than this share of the series' cadence (a second rent
   * payment eight days after the first, against a 30-day rhythm).
   */
  recurringExtraShare: number
  /** Same-amount payments needed before a cadence is trusted as recurring. */
  recurringMinCount: number

  // ── Vendor-relative amount baseline ────────────────────────────────────────
  /** Other payments from the vendor needed before its own baseline is trusted. */
  vendorMinHistory: number
  /** How many times the vendor's median a payment must reach. */
  vendorRatio: number
  /**
   * The ratio that is enough for a vendor whose bills barely move, once there
   * is history to show that: a fixed $14,800 contract billing three times that
   * is news even though a volatile vendor could do so on an ordinary month.
   */
  vendorSteadyRatio: number
  /** Log spread at or below which a vendor counts as steady, and the history needed to say so. */
  vendorSteadySpread: number
  vendorSteadyHistory: number
  /**
   * How far above the vendor's other payments, in units of their own spread on
   * a log scale, a payment must sit. Spend varies by multiples, so a vendor that
   * routinely ranges widely needs a far larger jump than a steady one.
   */
  vendorLogZ: number
  /**
   * With at least `vendorMaxMarginHistory` other payments, a payment this many
   * times the vendor's previous largest is raised even if the vendor is volatile.
   */
  vendorMaxMargin: number
  vendorMaxMarginHistory: number

  // ── Category-relative amount baseline ──────────────────────────────────────
  /** Rows from other vendors in a category before its range is trusted. */
  categoryMinRows: number
  /** Distinct other vendors in a category before its range is trusted. */
  categoryMinVendors: number
  /**
   * Multiple of the category's 95th percentile (other vendors' payments) a
   * payment from a vendor with no history of its own must exceed. Judged
   * against the category's top range, not its median, so a category that
   * legitimately holds both a $50 tool and a $40,000 cloud bill is left alone.
   */
  categoryHighMultiple: number

  // ── Approval control proximity ─────────────────────────────────────────────
  /** The dual-approval limit the organisation enforces. */
  approvalLimit: number
  /** Lower edge of the "just under the limit" band, as a fraction of it. */
  approvalBandLow: number
  /** Window in which near-limit payments to one vendor form a cluster. */
  approvalWindowDays: number
  /** Two near-limit payments only form a cluster when this close together. */
  approvalPairMaxDays: number

  // ── Velocity ───────────────────────────────────────────────────────────────
  /** Window over which payment bursts are measured. */
  velocityWindowDays: number
  /** Payments in a new vendor's first window that make a burst. */
  velocityNewVendorMinCount: number
  /**
   * How many times the vendor's busiest *other* week a burst must reach.
   * Self-calibrating: a courier paid most days needs a far denser week to
   * stand out than a supplier paid like clockwork once a week.
   */
  velocityBurstMultiple: number
  /** An established burst must also exceed that busiest other week by this many payments. */
  velocityMinExcessCount: number
  /** Separate days a burst must span: payment runs post many lines on one day. */
  velocityMinDays: number

  // ── New vendors ────────────────────────────────────────────────────────────
  /**
   * A vendor only counts as new when it first appears this many days after
   * the register begins. Before that, its history may simply sit before the
   * export, and a one-month file would otherwise make every vendor "new".
   */
  newVendorGraceDays: number
  /**
   * Combined surprise at which a new vendor's payment is raised. Each feature
   * scores -log10 of how often it occurs in this company (leaving the payment
   * itself out), so 3.5 is roughly one in three thousand were the features
   * independent.
   */
  newVendorSurprise: number
  /** Surprise at which it is raised as HIGH rather than MEDIUM. */
  newVendorSurpriseHigh: number

  // ── Vendor to category consistency ─────────────────────────────────────────
  /** Payments in the vendor's usual category before the pattern is trusted. */
  categoryConsistencyMinHistory: number
  /** Share of the vendor's payments its usual category must hold. */
  categoryConsistencyShare: number

  // ── Period integrity ───────────────────────────────────────────────────────
  /**
   * Share of rows that must agree on one period-to-date offset before the
   * labels are trusted. That offset becomes the file's own calendar, so a
   * fiscal year starting in July is learned rather than flagged on every row.
   */
  periodConsistencyShare: number
  /** Past this many mismatched rows, they are reported as one finding. */
  periodGroupAbove: number

  // ── Round numbers ──────────────────────────────────────────────────────────
  roundNumberMin: number
  /** Share of a vendor's other payments that must be non-round for a round one to stand out. */
  roundOthersIrregularShare: number

  // ── Coding ──
  /** A miscoding below this does not move a line of the accounts, so it is raised at low priority. */
  categoryMismatchMin: number

  // ── Duplicate payments, continued ──
  /** Repeats with no invoice evidence, from one vendor, at or above which they are one pattern to review. */
  weakRepeatGroupAt: number

  // ── Missing payee ──
  /** Up to this many payments with no payee are each their own finding; beyond it, one finding about the export. */
  missingPayeeGroupAbove: number

  // ── Reporting ──────────────────────────────────────────────────────────────
  /**
   * Confidence below which a finding's amount is excluded from reported risk
   * exposure. Without a floor, exposure sums every speculative finding and
   * approaches total spend, which tells a reviewer nothing.
   */
  exposureConfidenceFloor: number
}

export const DEFAULT_DETECTION_CONFIG: DetectionConfig = {
  currency:                      'USD',

  minExcess:                     1_000,

  duplicateWindowDays:           30,
  recurringExtraShare:           0.6,
  recurringMinCount:             3,

  vendorMinHistory:              4,
  vendorRatio:                   4,
  vendorSteadyRatio:             2.5,
  vendorSteadySpread:            0.2,
  vendorSteadyHistory:           8,
  vendorLogZ:                    3.5,
  vendorMaxMargin:               3,
  vendorMaxMarginHistory:        10,

  categoryMinRows:               8,
  categoryMinVendors:            3,
  categoryHighMultiple:          4,

  approvalLimit:                 10_000,
  approvalBandLow:               0.90,
  approvalWindowDays:            7,
  approvalPairMaxDays:           3,

  velocityWindowDays:            7,
  velocityNewVendorMinCount:     3,
  velocityBurstMultiple:         2,
  velocityMinExcessCount:        4,
  velocityMinDays:               3,

  newVendorGraceDays:            30,
  newVendorSurprise:             3.5,
  newVendorSurpriseHigh:         5,

  categoryConsistencyMinHistory: 5,
  categoryConsistencyShare:      0.85,

  periodConsistencyShare:        0.6,
  periodGroupAbove:              12,

  roundNumberMin:                5_000,
  roundOthersIrregularShare:     0.75,

  categoryMismatchMin:           500,
  weakRepeatGroupAt:             3,
  missingPayeeGroupAbove:        12,

  exposureConfidenceFloor:       70,
}
