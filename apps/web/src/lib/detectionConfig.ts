/**
 * Detection parameters.
 *
 * Every threshold the engine uses lives here. Nothing is tuned to a particular
 * register: the values are chosen from the statistical or control rationale
 * noted against each one, so the same settings hold on a different file with
 * different vendors, amounts and dates.
 */
export interface DetectionConfig {
  // ── Category-relative amount baseline ──────────────────────────────────────
  /**
   * Modified z-score cutoff, computed from the median and median absolute
   * deviation of amounts *within a category*. 3.5 is the common convention
   * (Iglewicz and Hoaglin); 5 is deliberately more conservative because an
   * expense register is heavy-tailed by nature and we would rather miss a
   * marginal case than bury a reviewer. Amount alone is weak evidence.
   */
  categoryMadZ: number
  /**
   * Minimum rows before a category's median/MAD is trusted. Below this the
   * median is unstable and a handful of rows can define their own baseline.
   * Rows in smaller categories are still covered by the vendor-level outlier,
   * duplicate, approval-proximity and new-vendor rules.
   */
  categoryMinRows: number

  // ── Vendor-relative amount baseline ────────────────────────────────────────
  /** Sigma above a vendor's own mean. Retained from the previous engine. */
  vendorSigma: number
  /** Minimum payments before a vendor's own mean/sd is meaningful. */
  vendorMinHistory: number

  // ── Approval control proximity ─────────────────────────────────────────────
  /** The dual-approval limit the organisation enforces. */
  approvalLimit: number
  /** Lower edge of the "just under the limit" band, as a fraction of it. */
  approvalBandLow: number
  /** Upper edge. 1.0 means the band stops at the limit itself. */
  approvalBandHigh: number
  /** Rolling window in which clustered near-limit payments are counted. */
  approvalWindowDays: number
  /** How many near-limit payments to one vendor constitute a cluster. */
  approvalMinCluster: number

  // ── Velocity ───────────────────────────────────────────────────────────────
  /** Window over which payment bursts are measured. */
  velocityWindowDays: number
  /** Payments inside the window from a vendor with no prior history. */
  velocityNewVendorMinCount: number
  /**
   * For a vendor with history, how many times its own busiest historical
   * window the current window must exceed. Self-calibrating, so a vendor with
   * a genuinely dense routine cadence never trips on that cadence.
   */
  velocityBurstMultiple: number

  // ── Vendor to category consistency ─────────────────────────────────────────
  /** Prior transactions before a vendor's modal category is trusted. */
  categoryConsistencyMinHistory: number

  // ── Round numbers ──────────────────────────────────────────────────────────
  roundNumberMin: number

  // ── New vendor composite ───────────────────────────────────────────────────
  /** Combined score at which a new/unfamiliar vendor is worth raising. */
  newVendorScoreThreshold: number
  /** Score at which it is raised as HIGH rather than MEDIUM. */
  newVendorHighScore: number

  // ── Reporting ──────────────────────────────────────────────────────────────
  /**
   * Confidence below which a finding's amount is excluded from reported risk
   * exposure. Without a floor, exposure sums every speculative finding and
   * approaches total spend, which tells a reviewer nothing.
   */
  exposureConfidenceFloor: number
}

export const DEFAULT_DETECTION_CONFIG: DetectionConfig = {
  categoryMadZ:                  5,
  categoryMinRows:               8,

  vendorSigma:                   2.5,
  vendorMinHistory:              3,

  approvalLimit:                 10_000,
  approvalBandLow:               0.90,
  approvalBandHigh:              1.00,
  approvalWindowDays:            7,
  approvalMinCluster:            2,

  velocityWindowDays:            7,
  velocityNewVendorMinCount:     3,
  velocityBurstMultiple:         2,

  categoryConsistencyMinHistory: 5,

  roundNumberMin:                5_000,

  newVendorScoreThreshold:       6,
  newVendorHighScore:            8,

  exposureConfidenceFloor:       70,
}
