/**
 * 簡單線性迴歸（最小平方法）與斜率標準誤
 *
 * 核心概念：單次體重讀數的噪音約 ±1~2 kg，但噪音是隨機的、會互相抵消，
 * 趨勢則會單向累積。用一整段窗口的資料擬合一條直線，斜率就是趨勢，
 * 斜率的標準誤（SE）告訴我們這個趨勢有多可信。
 *
 *   SE(斜率) = σ / √Σ(x − x̄)²  =  σ / (s_x × √n)
 *
 * 其中 σ 是殘差標準差（用 n − 2 自由度估計），s_x 是 x 的母體標準差。
 */

export interface Point {
  x: number;
  y: number;
}

export interface RegressionResult {
  n: number;
  slope: number;
  intercept: number;
  /** 殘差標準差 σ（資料繞著趨勢線的噪音大小） */
  residualSd: number;
  /** 斜率的標準誤 */
  slopeSe: number;
  /** t = slope / SE；|t| ≥ 2 約等於 95% 信心斜率不為 0 */
  t: number;
}

/** 至少需要 3 個點（n − 2 自由度 > 0），且 x 不能全部相同 */
export function linearRegression(points: Point[]): RegressionResult | null {
  const n = points.length;
  if (n < 3) return null;

  const meanX = points.reduce((s, p) => s + p.x, 0) / n;
  const meanY = points.reduce((s, p) => s + p.y, 0) / n;

  let sxx = 0;
  let sxy = 0;
  for (const p of points) {
    sxx += (p.x - meanX) ** 2;
    sxy += (p.x - meanX) * (p.y - meanY);
  }
  if (sxx === 0) return null;

  const slope = sxy / sxx;
  const intercept = meanY - slope * meanX;

  let ssRes = 0;
  for (const p of points) {
    ssRes += (p.y - (intercept + slope * p.x)) ** 2;
  }
  const residualSd = Math.sqrt(ssRes / (n - 2));
  const slopeSe = residualSd / Math.sqrt(sxx);
  // 資料完美落在直線上時 SE = 0，t 視為無限大
  const t = slopeSe === 0 ? (slope === 0 ? 0 : Math.sign(slope) * Infinity) : slope / slopeSe;

  return { n, slope, intercept, residualSd, slopeSe, t };
}

/** "YYYY-MM-DD" → 天數序號（用 UTC 計算，避免日光節約時間造成 23/25 小時的日子） */
export function dayIndex(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}
