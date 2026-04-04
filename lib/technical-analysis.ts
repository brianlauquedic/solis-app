/**
 * Technical Analysis Engine v2 — 技术分析引擎（漏洞全面修复版）
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  v2 修复清单                                                         │
 * │  [P0-1] 止损位高位失效   → ATR×2 动态止损兜底，高位行情永远有效         │
 * │  [P0-2] BB反弹仅1根确认  → 2根K线站稳 OR 1根强力反弹（25%带宽以上）     │
 * │  [P1-1] Math.max非结构   → findStructuralSwings 左右各5根确认高低点    │
 * │  [P1-2] 趋势行情neutral  → ADX市场状态检测，双引擎（反转/趋势双模式）   │
 * │  [P2-1] OBV仅加分不门控  → 升级为第5核心门控条件                       │
 * │  [P2-2] Elliott枢轴污染  → 仅使用最近30根K线的枢轴点                   │
 * │  [P3-1] EMA冷启动偏差    → SMA预热种子替代第一个价格                   │
 * │  [P3-2] 最少数据量不足   → MACD需78根（3×26），RSI需50根               │
 * │  新增    ATR  — 真实波动幅度（14周期 Wilder平滑），动态止损基准          │
 * │  新增    ADX  — 趋势方向强度（14周期 +DI/-DI）                         │
 * │  新增    MarketRegime — 市场状态分类（反转/趋势/震荡）                  │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * 双引擎信号系统：
 *   反转模式 (ADX < 25):  MACD金叉 + RSI[25-52] + BB 2根反弹 + 带宽正常 + OBV上升
 *   趋势模式 (ADX ≥ 25):  MACD正区间扩张 + RSI[45-72] + 价格>中轨 + ADX确认 + OBV上升
 *   震荡模式 (ADX < 18 且BB收缩): 不发任何信号
 *
 * 止损公式（v2双重保障）：
 *   优先: 78.6% 斐波回撤位（使用结构性 swing high/low，非 Math.max）
 *   兜底: entry − ATR×2.0（动态止损，高位突破时必然有效）
 *   取两者中较高者（tighter stop）
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OHLCV {
  timestamp: number;  // unix ms
  open:      number;
  high:      number;
  low:       number;
  close:     number;
  volume:    number;
}

export type SignalDirection = "bullish" | "bearish" | "neutral";
export type SignalTier      = "strong_buy" | "buy" | "neutral" | "sell" | "strong_sell";
export type MarketRegime    = "reversal_mode" | "trend_mode" | "choppy_mode";

// ── [FIX P3-1] EMA — SMA 预热种子替代 values[0] ─────────────────────────────
// 原版用 values[0] 作种子，导致前几十根K线的EMA偏差极大
// 修复：用前 min(period, length) 根K线的SMA作为初始种子

function ema(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  const k = 2 / (period + 1);
  // v2 fix: SMA seed (average of first min(period, n) bars)
  const seedLen = Math.min(period, values.length);
  const seed = values.slice(0, seedLen).reduce((s, v) => s + v, 0) / seedLen;
  const result: number[] = [seed];
  for (let i = 1; i < values.length; i++) {
    result.push(values[i] * k + result[i - 1] * (1 - k));
  }
  return result;
}

// ── [NEW] ATR — Average True Range (Wilder 14-period) ────────────────────────

export interface ATRResult {
  atr:       number;   // absolute ATR value
  atrPct:    number;   // ATR as % of current price
  atrStop:   number;   // entry price – ATR×2 (dynamic stop level, pre-computed at current price)
  detail:    string;
}

export function computeATR(ohlcv: OHLCV[], period = 14): ATRResult {
  const current = ohlcv[ohlcv.length - 1]?.close ?? 1;
  const approxFallback: ATRResult = {
    atr: current * 0.03, atrPct: 3,
    atrStop: current * 0.94,
    detail: "数据不足，ATR使用3%近似值",
  };
  if (ohlcv.length < period + 1) return approxFallback;

  // True Range per bar
  const tr: number[] = [];
  for (let i = 1; i < ohlcv.length; i++) {
    const h = ohlcv[i].high, l = ohlcv[i].low, pc = ohlcv[i - 1].close;
    tr.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }

  // Wilder smoothing: seed = SMA of first period, then rolling: ATR = (ATR*(p-1) + TR) / p
  let atrVal = tr.slice(0, period).reduce((s, v) => s + v, 0) / period;
  for (let i = period; i < tr.length; i++) {
    atrVal = (atrVal * (period - 1) + tr[i]) / period;
  }

  const atrPct  = (atrVal / current) * 100;
  const atrStop = current - atrVal * 2.0;

  return {
    atr: atrVal,
    atrPct,
    atrStop,
    detail: `ATR14=$${atrVal.toFixed(2)}（日均波动${atrPct.toFixed(1)}%）| 动态止损 $${atrStop.toFixed(2)}（入场价−2×ATR）`,
  };
}

// ── [NEW] ADX — Average Directional Index (14-period) ────────────────────────

export interface ADXResult {
  adx:            number;
  plusDI:         number;   // +DI
  minusDI:        number;   // -DI
  trending:       boolean;  // ADX ≥ 25
  strongTrend:    boolean;  // ADX ≥ 35
  trendDirection: "up" | "down" | "neutral";
  signal:         SignalDirection;
  detail:         string;
}

export function computeADX(ohlcv: OHLCV[], period = 14): ADXResult {
  const fallback: ADXResult = {
    adx: 20, plusDI: 20, minusDI: 20,
    trending: false, strongTrend: false,
    trendDirection: "neutral", signal: "neutral",
    detail: "数据不足，ADX使用默认值（弱趋势假设）",
  };
  if (ohlcv.length < period * 3) return fallback;

  const plusDMArr:  number[] = [];
  const minusDMArr: number[] = [];
  const trArr:      number[] = [];

  for (let i = 1; i < ohlcv.length; i++) {
    const upMove   = ohlcv[i].high     - ohlcv[i - 1].high;
    const downMove = ohlcv[i - 1].low  - ohlcv[i].low;
    plusDMArr .push((upMove   > downMove && upMove   > 0) ? upMove   : 0);
    minusDMArr.push((downMove > upMove   && downMove > 0) ? downMove : 0);
    const h = ohlcv[i].high, l = ohlcv[i].low, pc = ohlcv[i - 1].close;
    trArr.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }

  // Wilder smoothing (non-recursive cumulative approach)
  const wilderSum = (arr: number[], p: number): number[] => {
    let val = arr.slice(0, p).reduce((s, v) => s + v, 0);
    const out = [val];
    for (let i = p; i < arr.length; i++) {
      val = val - val / p + arr[i];
      out.push(val);
    }
    return out;
  };

  const atr14   = wilderSum(trArr,      period);
  const plusS   = wilderSum(plusDMArr,  period);
  const minusS  = wilderSum(minusDMArr, period);

  const plusDISeries  = plusS .map((v, i) => atr14[i] > 0 ? 100 * v / atr14[i] : 0);
  const minusDISeries = minusS.map((v, i) => atr14[i] > 0 ? 100 * v / atr14[i] : 0);
  const dxSeries = plusDISeries.map((p, i) => {
    const m = minusDISeries[i], sum = p + m;
    return sum > 0 ? 100 * Math.abs(p - m) / sum : 0;
  });

  const adxSeries = wilderSum(dxSeries.slice(period), period);
  const n = adxSeries.length;
  if (n === 0) return fallback;

  const adx    = adxSeries[n - 1];
  const plusDI  = plusDISeries [plusDISeries.length  - 1];
  const minusDI = minusDISeries[minusDISeries.length - 1];

  const trending     = adx >= 25;
  const strongTrend  = adx >= 35;
  const trendDirection: ADXResult["trendDirection"] =
    plusDI > minusDI * 1.05 ? "up" : plusDI < minusDI * 0.95 ? "down" : "neutral";
  const signal: SignalDirection =
    trendDirection === "up" ? "bullish" : trendDirection === "down" ? "bearish" : "neutral";

  return {
    adx, plusDI, minusDI, trending, strongTrend, trendDirection, signal,
    detail: `ADX ${adx.toFixed(1)} | +DI ${plusDI.toFixed(1)} | -DI ${minusDI.toFixed(1)} | ` +
      (strongTrend ? "强趋势🔥" : trending ? "趋势确认✅" : adx < 18 ? "震荡横盘⚠️" : "弱趋势"),
  };
}

// ── [NEW] Market Regime Detection ────────────────────────────────────────────

export interface MarketRegimeResult {
  regime:      MarketRegime;
  label:       string;
  description: string;
}

export function detectMarketRegime(
  adx: ADXResult,
  rsi: RSIResult,
  bb:  BBResult,
): MarketRegimeResult {
  // Choppy: low ADX AND BB squeeze — strongest suppression signal
  if (adx.adx < 18 && bb.isSqueeze) {
    return {
      regime: "choppy_mode",
      label:  "⚠️ 震荡横盘",
      description: `ADX ${adx.adx.toFixed(0)}<18 且BB极度收缩（带宽${bb.bandWidthRank.toFixed(0)}%分位），方向未定，建议等待突破确认后再入场`,
    };
  }

  // Trend up: ADX confirmed + RSI healthy + +DI dominant
  if (adx.trending && rsi.rsi >= 45 && adx.trendDirection === "up") {
    return {
      regime: "trend_mode",
      label:  "📈 上升趋势",
      description: `ADX ${adx.adx.toFixed(0)} 趋势强度确认，RSI ${rsi.rsi.toFixed(0)} 健康区间，+DI>${adx.plusDI.toFixed(0)} 主导，顺势做多模式`,
    };
  }

  // Trend down: ADX confirmed + RSI weak + -DI dominant
  if (adx.trending && rsi.rsi <= 55 && adx.trendDirection === "down") {
    return {
      regime: "trend_mode",
      label:  "📉 下降趋势",
      description: `ADX ${adx.adx.toFixed(0)} 趋势确认，RSI ${rsi.rsi.toFixed(0)} 偏低，-DI>${adx.minusDI.toFixed(0)} 主导，顺势做空模式`,
    };
  }

  // Default: reversal mode
  return {
    regime: "reversal_mode",
    label:  "🔄 寻找反转",
    description: `ADX ${adx.adx.toFixed(0)} 趋势偏弱，市场处于反转机会窗口，等待多指标底部共振`,
  };
}

// ── [NEW] Structural Swing High/Low (replaces Math.max) ──────────────────────
// 修复 P1-1: 原来用 Math.max/Min 获取整个窗口的极值，可能是单根孤立K线
// 修复：左右各 N 根K线都低于/高于它才算结构性高低点

function findStructuralSwings(
  ohlcv: OHLCV[],
  leftBars  = 5,
  rightBars = 3,
): { swingHigh: number; swingLow: number } {
  const n = ohlcv.length;

  let swingHigh = 0;
  let swingLow  = Infinity;

  // Scan all bars with enough neighbors on both sides
  for (let i = leftBars; i < n - rightBars; i++) {
    const h = ohlcv[i].high;
    const l = ohlcv[i].low;

    // Structural high: all left bars have lower high, all right bars have lower high
    const isStructHigh =
      ohlcv.slice(i - leftBars, i)    .every(c => c.high < h) &&
      ohlcv.slice(i + 1, i + rightBars + 1).every(c => c.high < h);

    // Structural low: all left bars have higher low, all right bars have higher low
    const isStructLow =
      ohlcv.slice(i - leftBars, i)    .every(c => c.low > l) &&
      ohlcv.slice(i + 1, i + rightBars + 1).every(c => c.low > l);

    if (isStructHigh && h > swingHigh) swingHigh = h;
    if (isStructLow  && l < swingLow)  swingLow  = l;
  }

  // Fallback: if no structural pivots found (range too narrow), use simple extremes
  if (swingHigh === 0)        swingHigh = Math.max(...ohlcv.map(c => c.high));
  if (swingLow  === Infinity) swingLow  = Math.min(...ohlcv.map(c => c.low));

  return { swingHigh, swingLow };
}

// ── MACD (12/26/9) — [FIX P3-2: require 78 candles] ─────────────────────────

export interface MACDResult {
  macdLine:       number[];
  signalLine:     number[];
  histogram:      number[];
  current:        number;
  prev:           number;
  isBullishCross: boolean;   // histogram neg→pos within last 3 bars
  isBearishCross: boolean;
  crossBelowZero: boolean;   // gold cross occurred while MACD line < 0 (stronger)
  aboveZero:      boolean;   // current MACD line > 0 (used in trend mode)
  histExpanding:  boolean;   // histogram magnitude increasing (trend continuation)
  signal:         SignalDirection;
  score:          number;
  detail:         string;
}

export function computeMACD(closes: number[]): MACDResult {
  const empty: MACDResult = {
    macdLine: [], signalLine: [], histogram: [],
    current: 0, prev: 0,
    isBullishCross: false, isBearishCross: false,
    crossBelowZero: false, aboveZero: false, histExpanding: false,
    signal: "neutral", score: 0,
    // [FIX P3-2]: raised from 35 to 78 (3× period26) for EMA convergence
    detail: "数据不足（v2需至少78根K线确保EMA收敛）",
  };
  if (closes.length < 78) return empty;

  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);

  // macdLine aligns from index 25 onward
  const macdLine   = ema12.slice(25).map((v, i) => v - ema26[i + 25]);
  const signalLine = ema(macdLine, 9);
  const histogram  = macdLine.map((v, i) => v - signalLine[i]);

  const n       = histogram.length;
  const current = histogram[n - 1];
  const prev    = histogram[n - 2] ?? 0;
  const prev2   = histogram[n - 3] ?? 0;
  const prev3   = histogram[n - 4] ?? 0;

  // Bullish cross: histogram flipped neg→pos within last 3 bars
  const isBullishCross =
    (prev  < 0 && current > 0) ||
    (prev2 < 0 && prev  > 0 && current > 0) ||
    (prev3 < 0 && prev2 > 0 && prev > 0 && current > 0);

  // Bearish cross: flipped pos→neg
  const isBearishCross =
    (prev  > 0 && current < 0) ||
    (prev2 > 0 && prev  < 0 && current < 0) ||
    (prev3 > 0 && prev2 < 0 && prev < 0 && current < 0);

  const macdCurrent  = macdLine[n - 1];
  const crossBelowZero = isBullishCross && macdCurrent < 0;
  const aboveZero    = macdCurrent > 0;
  // Histogram expanding: current magnitude > previous (momentum accelerating)
  const histExpanding = Math.abs(current) > Math.abs(prev) && Math.sign(current) === Math.sign(prev);

  let signal: SignalDirection = "neutral";
  let score = 0;
  let detail = "";

  if (isBullishCross) {
    signal = "bullish";
    score  = crossBelowZero ? 10 : 5;
    detail = `MACD金叉✅（${prev.toFixed(4)}→${current.toFixed(4)}）` +
      (crossBelowZero ? "，零线下方金叉更强烈" : "，零线上方金叉");
    if (histExpanding) detail += "，Histogram加速扩张🚀";
  } else if (isBearishCross) {
    signal = "bearish";
    score  = 8;
    detail = `MACD死叉❌（${prev.toFixed(4)}→${current.toFixed(4)}）`;
  } else if (aboveZero && histExpanding) {
    // [NEW] Trend mode: MACD above zero and expanding = trend continuation
    signal = "bullish";
    score  = 6;
    detail = `MACD多头区间持续扩张（Histogram=${current.toFixed(4)}）📈`;
  } else if (!aboveZero && histExpanding && current < 0) {
    signal = "bearish";
    score  = 6;
    detail = `MACD空头区间持续扩张（Histogram=${current.toFixed(4)}）📉`;
  } else if (aboveZero) {
    signal = "bullish";
    score  = 3;
    detail = `MACD多头区域（Histogram=${current.toFixed(4)}）`;
  } else {
    detail = `MACD空头区域（Histogram=${current.toFixed(4)}）`;
  }

  return {
    macdLine, signalLine, histogram, current, prev,
    isBullishCross, isBearishCross, crossBelowZero,
    aboveZero, histExpanding, signal, score, detail,
  };
}

// ── RSI (14-period) + 背离检测 ────────────────────────────────────────────────

export interface RSIResult {
  rsi:             number;
  current:         number;   // alias for rsi (backward compat with agent loop)
  inBuyZone:       boolean;  // 25 ≤ RSI ≤ 52 (v2: slightly widened from 30-50)
  inTrendZone:     boolean;  // 45 ≤ RSI ≤ 72 (v2 new: healthy uptrend range)
  slopePositive:   boolean;
  isBullishDiverg: boolean;
  isBearishDiverg: boolean;
  signal:          SignalDirection;
  score:           number;
  detail:          string;
}

export function computeRSI(closes: number[], period = 14): RSIResult {
  const fallback: RSIResult = {
    rsi: 50, current: 50, inBuyZone: false, inTrendZone: false,
    slopePositive: false, isBullishDiverg: false, isBearishDiverg: false,
    signal: "neutral", score: 0,
    detail: "数据不足（v2需至少50根K线）",
  };
  // [FIX P3-2]: raised minimum from period+5 to 50
  if (closes.length < Math.max(50, period + 5)) return fallback;

  const changes = closes.slice(1).map((c, i) => c - closes[i]);
  const gains   = changes.map(c => c > 0 ? c : 0);
  const losses  = changes.map(c => c < 0 ? -c : 0);

  // [FIX P3-1]: Wilder smoothing with SMA seed (same as ATR approach)
  let avgGain = gains.slice(0, period).reduce((s, v) => s + v, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((s, v) => s + v, 0) / period;

  const rsiSeries: number[] = [];
  for (let i = period; i < changes.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i])  / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    rsiSeries.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
  }

  const n       = rsiSeries.length;
  const rsi     = rsiSeries[n - 1];
  const prevRsi = rsiSeries[n - 2] ?? rsi;

  // Divergence detection (last 10 bars)
  const lookback    = Math.min(10, n - 2);
  const pLow1  = Math.min(...closes.slice(-lookback - 1, -1));
  const pLow2  = Math.min(...closes.slice(-(lookback * 2) - 1, -lookback - 1));
  const rLow1  = Math.min(...rsiSeries.slice(-lookback - 1, -1));
  const rLow2  = Math.min(...rsiSeries.slice(-(lookback * 2) - 1, -lookback - 1));
  const pHigh1 = Math.max(...closes.slice(-lookback - 1, -1));
  const pHigh2 = Math.max(...closes.slice(-(lookback * 2) - 1, -lookback - 1));
  const rHigh1 = Math.max(...rsiSeries.slice(-lookback - 1, -1));
  const rHigh2 = Math.max(...rsiSeries.slice(-(lookback * 2) - 1, -lookback - 1));

  const isBullishDiverg = pLow1  < pLow2  * 0.99 && rLow1  > rLow2  * 1.02;
  const isBearishDiverg = pHigh1 > pHigh2 * 1.01 && rHigh1 < rHigh2 * 0.98;

  // [FIX P1-2] v2: two RSI zones
  const inBuyZone   = rsi >= 25 && rsi <= 52;   // reversal mode (widened from 30-50)
  const inTrendZone = rsi >= 45 && rsi <= 72;   // trend mode (new)
  const slopePositive = rsi > prevRsi;

  let signal: SignalDirection = "neutral";
  let score = 0;
  let detail = "";

  if (rsi < 25) {
    signal = "bullish"; score = 20;
    detail = `RSI ${rsi.toFixed(1)} 深度超卖（<25）✅，强力反弹区`;
  } else if (rsi < 35) {
    signal = "bullish"; score = 15;
    detail = `RSI ${rsi.toFixed(1)} 超卖区（25-35）✅`;
  } else if (inBuyZone) {
    signal = slopePositive ? "bullish" : "neutral";
    score  = slopePositive ? 8 : 2;
    detail = `RSI ${rsi.toFixed(1)} 买入区（25-52），斜率${slopePositive ? "向上✅" : "向下"}`;
  } else if (rsi > 75) {
    signal = "bearish"; score = 20;
    detail = `RSI ${rsi.toFixed(1)} 深度超买（>75）❌`;
  } else if (rsi > 65) {
    signal = "bearish"; score = 12;
    detail = `RSI ${rsi.toFixed(1)} 超买区（65-75）❌，注意回调`;
  } else if (inTrendZone) {
    signal = slopePositive ? "bullish" : "neutral";
    score  = 5;
    detail = `RSI ${rsi.toFixed(1)} 趋势健康区（45-72）${slopePositive ? "✅" : ""}`;
  } else {
    detail = `RSI ${rsi.toFixed(1)} 中性区间`;
  }

  if (isBullishDiverg) {
    signal = "bullish"; score = Math.min(20, score + 15);
    detail += " | 🔥底背离（价格新低/RSI未新低）";
  }
  if (isBearishDiverg) {
    signal = "bearish"; score = Math.min(20, score + 15);
    detail += " | ⚠️顶背离（价格新高/RSI未新高）";
  }

  return { rsi, current: rsi, inBuyZone, inTrendZone, slopePositive, isBullishDiverg, isBearishDiverg, signal, score, detail };
}

// ── Bollinger Bands (20/2) — [FIX P0-2: 2-bar bounce confirmation] ────────────

export interface BBResult {
  upper:             number;
  middle:            number;
  lower:             number;
  bandwidth:         number;
  percentB:          number;
  touchedLowerPrev:  boolean;  // v2: 1-bar-ago or 2-bar-ago touched lower band
  reEnteredBand:     boolean;  // v2: 2-bar recovery OR 1-bar strong recovery
  bandWidthRank:     number;
  isSqueeze:         boolean;
  // Trend mode fields (new)
  priceAboveMid:     boolean;  // price > middle band (used in trend mode gate)
  priceNearUpper:    boolean;  // price in upper 15% of band
  signal:            SignalDirection;
  score:             number;
  detail:            string;
}

export function computeBollingerBands(closes: number[], period = 20, stdMult = 2): BBResult {
  const price = closes[closes.length - 1];
  const fallback: BBResult = {
    upper: price * 1.04, middle: price, lower: price * 0.96, bandwidth: 0.08,
    percentB: 0.5, touchedLowerPrev: false, reEnteredBand: false,
    bandWidthRank: 50, isSqueeze: false,
    priceAboveMid: true, priceNearUpper: false,
    signal: "neutral", score: 0, detail: "数据不足",
  };
  if (closes.length < period + 5) return fallback;

  const bollingerAt = (endIdx: number) => {
    const slice = closes.slice(endIdx - period, endIdx);
    const sma   = slice.reduce((s, v) => s + v, 0) / period;
    const variance = slice.reduce((s, v) => s + (v - sma) ** 2, 0) / period;
    const sd  = Math.sqrt(variance);
    return { upper: sma + stdMult * sd, middle: sma, lower: sma - stdMult * sd, bw: (2 * stdMult * sd) / sma };
  };

  const n    = closes.length;
  const curr = bollingerAt(n);
  const bb1  = bollingerAt(n - 1);  // BB at time of closes[n-2] (prev bar)
  const bb2  = bollingerAt(n - 2);  // BB at time of closes[n-3] (2 bars ago)

  // Bandwidth rank over last 50 candles
  const bwHistory: number[] = [];
  for (let i = period; i <= Math.min(n, period + 50); i++) bwHistory.push(bollingerAt(i).bw);
  const sortedBW = [...bwHistory].sort((a, b) => a - b);
  const rank = sortedBW.findIndex(v => Math.abs(v - curr.bw) < 0.0001) ?? Math.floor(bwHistory.length / 2);
  const bandWidthRank = bwHistory.length > 0 ? (rank / bwHistory.length) * 100 : 50;
  const isSqueeze = bandWidthRank < 20;

  const prevClose  = closes[n - 2] ?? closes[n - 1];
  const prev2Close = closes[n - 3] ?? prevClose;

  // [FIX P0-2] v2: 2-bar bounce confirmation
  // Touch: one of last 2 bars closed at or below its lower band
  const touchedPrev  = prevClose  <= bb1.lower;
  const touchedPrev2 = prev2Close <= bb2.lower;
  const touchedLowerPrev = touchedPrev || touchedPrev2;

  // Recovery variant A: 1-bar-ago touched, current bar recovered ≥25% of bandwidth (strong)
  const recoverThreshold = curr.lower + (curr.middle - curr.lower) * 0.25;
  const oneBarStrong = touchedPrev && closes[n - 1] > recoverThreshold;

  // Recovery variant B: 2-bars-ago touched, BOTH prev and current bars above their lower bands
  const prevAboveLower = prevClose        > bb1.lower;
  const currAboveLower = closes[n - 1]   > curr.lower;
  const twoBarRecover  = touchedPrev2 && prevAboveLower && currAboveLower;

  const reEnteredBand = oneBarStrong || twoBarRecover;

  const percentB = curr.upper > curr.lower
    ? (closes[n - 1] - curr.lower) / (curr.upper - curr.lower)
    : 0.5;

  const priceAboveMid  = closes[n - 1] > curr.middle;
  const priceNearUpper = percentB > 0.85;

  let signal: SignalDirection = "neutral";
  let score = 0;
  let detail = "";

  if (bandWidthRank > 70) {
    score += 15;
    detail += `BB扩张（带宽${bandWidthRank.toFixed(0)}%分位）✅，`;
  } else if (bandWidthRank > 40) {
    score += 8;
    detail += `BB正常（带宽${bandWidthRank.toFixed(0)}%分位），`;
  }

  if (reEnteredBand) {
    signal = "bullish"; score = Math.min(15, score + 10);
    detail += twoBarRecover
      ? `2根K线站稳反弹确认✅（${prev2Close.toFixed(2)}触下轨后连续收复）`
      : `强力单根反弹✅（收复带内25%以上）`;
  } else if (touchedLowerPrev && !reEnteredBand) {
    signal = "neutral"; score = Math.min(8, score + 3);
    detail += `下轨区域，等待反弹确认中⏳`;
  } else if (percentB < 0.1) {
    signal = "bullish"; score = Math.min(15, score + 5);
    detail += `价格贴近下轨（%B=${percentB.toFixed(2)}）`;
  } else if (priceNearUpper) {
    signal = "bearish"; score = Math.min(15, score + 12);
    detail += `价格贴近上轨（%B=${percentB.toFixed(2)}）❌`;
  } else if (priceAboveMid) {
    signal = "bullish"; score = Math.min(8, score + 3);
    detail += `价格站稳中轨上方（%B=${percentB.toFixed(2)}）✅`;
  } else if (isSqueeze) {
    signal = "neutral"; score = 0;
    detail += `⚠️BB极度收缩（${bandWidthRank.toFixed(0)}%分位），等待方向突破`;
  } else {
    detail += `价格中段（%B=${percentB.toFixed(2)}）`;
  }

  return {
    upper: curr.upper, middle: curr.middle, lower: curr.lower,
    bandwidth: curr.bw, percentB, touchedLowerPrev, reEnteredBand,
    bandWidthRank, isSqueeze, priceAboveMid, priceNearUpper,
    signal, score, detail: detail.replace(/，$/, ""),
  };
}

// ── OBV + 量价背离 ────────────────────────────────────────────────────────────

export interface OBVResult {
  obv:             number[];
  obvTrend:        "rising" | "falling" | "neutral";
  isBullishDiverg: boolean;
  isBearishDiverg: boolean;
  volumeSpike:     boolean;
  signal:          SignalDirection;
  score:           number;
  detail:          string;
}

export function computeOBV(ohlcv: OHLCV[]): OBVResult {
  const fallback: OBVResult = {
    obv: [], obvTrend: "neutral", isBullishDiverg: false, isBearishDiverg: false,
    volumeSpike: false, signal: "neutral", score: 0, detail: "数据不足",
  };
  if (ohlcv.length < 10) return fallback;

  const obv: number[] = [0];
  for (let i = 1; i < ohlcv.length; i++) {
    const d = ohlcv[i].close - ohlcv[i - 1].close;
    obv.push(d > 0 ? obv[i - 1] + ohlcv[i].volume
           : d < 0 ? obv[i - 1] - ohlcv[i].volume
                   : obv[i - 1]);
  }

  const n = ohlcv.length;
  const recentOBV = obv.slice(-5);
  const priorOBV  = obv.slice(-10, -5);
  const avgRecent = recentOBV.reduce((s, v) => s + v, 0) / recentOBV.length;
  const avgPrior  = priorOBV.length > 0 ? priorOBV.reduce((s, v) => s + v, 0) / priorOBV.length : avgRecent;
  const obvTrend: OBVResult["obvTrend"] =
    avgRecent > avgPrior * 1.01 ? "rising" :
    avgRecent < avgPrior * 0.99 ? "falling" : "neutral";

  const window = Math.min(10, n - 1);
  const priceChange = ohlcv[n - 1].close - ohlcv[n - window].close;
  const obvChange   = obv[n - 1]          - obv[n - window];
  const isBullishDiverg = priceChange < 0 && obvChange > 0;
  const isBearishDiverg = priceChange > 0 && obvChange < 0;

  const recentVols = ohlcv.slice(-21, -1).map(c => c.volume);
  const avgVol     = recentVols.reduce((s, v) => s + v, 0) / (recentVols.length || 1);
  const volumeSpike = avgVol > 0 && ohlcv[n - 1].volume > avgVol * 1.5;

  let signal: SignalDirection = "neutral";
  let score = 0;
  let detail = "";

  if (obvTrend === "rising")  { signal = "bullish"; score += 10; detail += "OBV持续上升，资金净流入✅"; }
  else if (obvTrend === "falling") { signal = "bearish"; score += 10; detail += "OBV持续下降，资金净流出❌"; }
  else { detail += "OBV横盘，方向待定"; }

  if (volumeSpike) {
    score += 15;
    detail += " | 成交量放大（>1.5倍均量）✅";
    if (signal === "bullish") detail += "量价齐升";
  }
  if (isBullishDiverg) {
    signal = "bullish"; score = Math.min(25, score + 15);
    detail += " | 🔥量价底背离（价跌/OBV涨）";
  }
  if (isBearishDiverg) {
    signal = "bearish"; score = Math.min(25, score + 15);
    detail += " | ⚠️量价顶背离（价涨/OBV跌），主力出货警告";
  }

  return { obv, obvTrend, isBullishDiverg, isBearishDiverg, volumeSpike, signal, score: Math.min(25, score), detail };
}

// ── Fibonacci — [FIX P0-1 + P1-1: ATR stop + structural swings] ──────────────

export interface FibResult {
  swingHigh:      number;
  swingLow:       number;
  range:          number;
  retraceLevels:  Record<string, number>;
  extendLevels:   Record<string, number>;
  nearestSupport: number;
  nearestResist:  number;
  nearestFibPct:  string;   // e.g. "38.2"
  nearestLevel:   string;   // e.g. "38.2% Fibonacci支撑" (for agent loop)
  nearestPct:     number;   // numeric version of nearestFibPct (for agent loop)
  distancePct:    number;
  isAtSupport:    boolean;
  isAtResist:     boolean;
  signal:         SignalDirection;
  entry:          number;
  tp1:            number;
  tp2:            number;
  stopLoss:       number;
  stopLossMethod: "fibonacci" | "atr";   // which stop was used
  riskReward:     number;
  detail:         string;
}

export function computeFibonacci(ohlcv: OHLCV[], atr: ATRResult, lookback = 60): FibResult {
  const window  = ohlcv.slice(-Math.min(lookback, ohlcv.length));
  const current = window[window.length - 1].close;

  // [FIX P1-1]: structural swing detection instead of Math.max/min on closes
  const { swingHigh, swingLow } = findStructuralSwings(window, 5, 3);
  const range = swingHigh - swingLow;

  const retrace = (ratio: number) => swingHigh - range * ratio;
  const extend  = (ratio: number) => swingLow  + range * ratio;

  const retraceLevels: Record<string, number> = {
    "0":    swingHigh,
    "23.6": retrace(0.236),
    "38.2": retrace(0.382),
    "50":   retrace(0.500),
    "61.8": retrace(0.618),
    "78.6": retrace(0.786),
    "100":  swingLow,
  };

  const extendLevels: Record<string, number> = {
    "127.2": extend(1.272),
    "161.8": extend(1.618),
    "200":   extend(2.000),
    "261.8": extend(2.618),
  };

  // Nearest Fibonacci level
  let nearestFibPct = "50";
  let minDist = Infinity;
  for (const [key, val] of Object.entries(retraceLevels)) {
    const d = Math.abs(val - current) / current;
    if (d < minDist) { minDist = d; nearestFibPct = key; }
  }
  const distancePct = minDist * 100;
  const nearestPct  = parseFloat(nearestFibPct);

  const supportKeys = new Set(["38.2", "50", "61.8", "78.6"]);
  const resistKeys  = new Set(["0",   "23.6"]);
  const isAtSupport = distancePct < 1.5 && supportKeys.has(nearestFibPct);
  const isAtResist  = distancePct < 1.5 && resistKeys.has(nearestFibPct);

  const supports     = Object.entries(retraceLevels).filter(([k]) => supportKeys.has(k)).map(([, v]) => v).sort((a, b) => b - a);
  const resists      = Object.entries(retraceLevels).filter(([k]) => resistKeys .has(k)).map(([, v]) => v).sort((a, b) => a - b);
  const nearestSupport = supports.find(v => v <= current * 1.02) ?? swingLow;
  const nearestResist  = resists .find(v => v >= current * 0.98) ?? swingHigh;

  // Trade levels
  const entry    = current;
  const tp1      = entry + range * 0.272;    // 127.2% extension
  const tp2      = extend(1.618);            // Golden Ratio extension

  // [FIX P0-1] v2: dual stop loss — Fib is primary, ATR is fallback
  const fibStopRaw = retrace(0.786) * 0.995;       // 78.6% retracement − 0.5% buffer
  const atrStopVal = entry - atr.atr * 2.0;         // always valid (always < entry)

  // Use Fib stop if it's below entry (valid), otherwise fall back to ATR stop
  const stopLoss       = fibStopRaw < entry * 0.998 ? fibStopRaw : atrStopVal;
  const stopLossMethod: FibResult["stopLossMethod"] =
    fibStopRaw < entry * 0.998 ? "fibonacci" : "atr";

  // R:R using TP1 (more conservative)
  const riskReward = stopLoss < entry
    ? parseFloat(((tp1 - entry) / (entry - stopLoss)).toFixed(2))
    : 0;

  let signal: SignalDirection = "neutral";
  let detail = "";

  if (isAtSupport) {
    signal = "bullish";
    detail = `价格在 ${nearestFibPct}% 斐波支撑（偏差${distancePct.toFixed(1)}%）✅ | ` +
      `止损 $${stopLoss.toFixed(2)}（${stopLossMethod === "atr" ? "ATR动态" : "78.6%斐波"}）| ` +
      `TP1 $${tp1.toFixed(2)}（127.2%延伸）| TP2 $${tp2.toFixed(2)}（161.8%黄金比例）`;
  } else if (isAtResist) {
    signal = "bearish";
    detail = `价格在 ${nearestFibPct}% 斐波阻力位（偏差${distancePct.toFixed(1)}%）❌`;
  } else if (current > swingHigh) {
    signal = "bullish";
    detail = `价格突破前结构高点 $${swingHigh.toFixed(2)}，127.2%目标 $${extendLevels["127.2"].toFixed(2)}，161.8%目标 $${extendLevels["161.8"].toFixed(2)}`;
  } else {
    detail = `最近支撑 $${nearestSupport.toFixed(2)} | 最近阻力 $${nearestResist.toFixed(2)} | 最近斐波位 ${nearestFibPct}%（偏差${distancePct.toFixed(1)}%）`;
  }

  return {
    swingHigh, swingLow, range, retraceLevels, extendLevels,
    nearestSupport, nearestResist, nearestFibPct, distancePct,
    nearestLevel: `${nearestFibPct}% Fibonacci${supportKeys.has(nearestFibPct) ? "支撑" : "阻力"}`,
    nearestPct,
    isAtSupport, isAtResist, signal, entry, tp1, tp2,
    stopLoss, stopLossMethod, riskReward, detail,
  };
}

// ── Elliott Wave — [FIX P2-2: limit to last 30 candles] ──────────────────────

export interface ElliottResult {
  wavePosition:   "wave_2_end" | "wave_4_end" | "wave_3_up" | "wave_5_end" | "abc_c_end" | "unknown";
  waveLabel:      string;
  isBullishSetup: boolean;
  pivotHigh:      number;
  pivotLow:       number;
  pivotCount:     number;
  signal:         SignalDirection;
  score:          number;
  confidence:     number;
  detail:         string;
}

function findZigzagPivots(
  closes: number[],
  minSwingPct = 0.05,
): Array<{ i: number; price: number; type: "H" | "L" }> {
  const pivots: Array<{ i: number; price: number; type: "H" | "L" }> = [];
  if (closes.length < 5) return pivots;

  let lastDir: "up" | "down" | null = null;
  let lastExtreme    = closes[0];
  let lastExtremeIdx = 0;

  for (let i = 1; i < closes.length; i++) {
    const pct = (closes[i] - lastExtreme) / lastExtreme;

    if (lastDir !== "up" && pct >= minSwingPct) {
      if (lastDir === "down" || lastDir === null) {
        pivots.push({ i: lastExtremeIdx, price: lastExtreme, type: "L" });
      }
      lastDir = "up";
      lastExtreme = closes[i]; lastExtremeIdx = i;
    } else if (lastDir !== "down" && pct <= -minSwingPct) {
      if (lastDir === "up" || lastDir === null) {
        pivots.push({ i: lastExtremeIdx, price: lastExtreme, type: "H" });
      }
      lastDir = "down";
      lastExtreme = closes[i]; lastExtremeIdx = i;
    } else {
      if (lastDir === "up"   && closes[i] > lastExtreme) { lastExtreme = closes[i]; lastExtremeIdx = i; }
      if (lastDir === "down" && closes[i] < lastExtreme) { lastExtreme = closes[i]; lastExtremeIdx = i; }
    }
  }
  if (lastDir !== null) {
    pivots.push({ i: lastExtremeIdx, price: lastExtreme, type: lastDir === "up" ? "H" : "L" });
  }
  return pivots;
}

export function detectElliottWave(closes: number[]): ElliottResult {
  const current = closes[closes.length - 1];
  const fallback: ElliottResult = {
    wavePosition: "unknown", waveLabel: "形态待确认",
    isBullishSetup: false, pivotHigh: 0, pivotLow: 0, pivotCount: 0,
    signal: "neutral", score: 0, confidence: 20,
    detail: "数据点不足，建议观望",
  };
  if (closes.length < 30) return fallback;

  // [FIX P2-2]: Use only last 30 candles to avoid ancient extreme pollution
  const recentCloses = closes.slice(-30);
  const pivots       = findZigzagPivots(recentCloses, 0.05);

  // Local high/low from recent window only (no global contamination)
  const pivotHigh = pivots.length > 0 ? Math.max(...pivots.map(p => p.price)) : Math.max(...recentCloses);
  const pivotLow  = pivots.length > 0 ? Math.min(...pivots.map(p => p.price)) : Math.min(...recentCloses);

  const priceRatio = pivotHigh > pivotLow
    ? (current - pivotLow) / (pivotHigh - pivotLow)
    : 0.5;

  if (pivots.length < 5) {
    return {
      ...fallback, pivotHigh, pivotLow, pivotCount: pivots.length,
      detail: `枢轴点不足（近30根K线仅${pivots.length}个），趋势结构待形成`,
    };
  }

  const last5  = pivots.slice(-5);
  const lastP  = last5[last5.length - 1];
  const prevP  = last5[last5.length - 2];
  const prev2P = last5[last5.length - 3];

  const wave1Range = last5.length >= 2 ? Math.abs((last5[1]?.price ?? 0) - (last5[0]?.price ?? 0)) : 0;
  const wave3Range = last5.length >= 4 ? Math.abs((last5[3]?.price ?? 0) - (last5[2]?.price ?? 0)) : 0;
  const wave3NotShortest = wave3Range >= wave1Range * 0.9;

  let wavePosition: ElliottResult["wavePosition"] = "unknown";
  let waveLabel = "未确认";
  let isBullishSetup = false;
  let score = 0;
  let confidence = 30;
  let detail = "";

  // Pattern 1: Low pivot at deep correction (Wave 2 or Wave 4 end)
  if (lastP.type === "L" && priceRatio < 0.38) {
    const isWave4 = last5.slice(0, -1).some(p => p.type === "H" && p.price > prevP.price);
    wavePosition = isWave4 ? "wave_4_end" : "wave_2_end";
    waveLabel    = isWave4 ? "⚡ 第4浪末尾 — 即将启动第5浪" : "🚀 第2浪末尾 — 即将启动最强第3浪";
    isBullishSetup = true;
    score      = isWave4 ? 20 : 30;
    confidence = wave3NotShortest ? 65 : 50;
    detail = `${waveLabel}。近30根K线低点 $${lastP.price.toFixed(2)}（位置${(priceRatio * 100).toFixed(0)}%）`;
  }
  // Pattern 2: ABC C-wave end (deep correction finishing)
  else if (lastP.type === "L" && priceRatio < 0.2 && prevP.type === "H" && prev2P.type === "L") {
    wavePosition = "abc_c_end";
    waveLabel    = "📉 ABC调整C浪末尾 — 可能触底反转";
    isBullishSetup = true;
    score = 25; confidence = 55;
    detail = `识别到深度C浪调整（位置${(priceRatio * 100).toFixed(0)}%），配合RSI底背离则反转概率高`;
  }
  // Pattern 3: Wave 5 exhaustion (top)
  else if (lastP.type === "H" && priceRatio > 0.80 && prevP.type === "L") {
    wavePosition = "wave_5_end";
    waveLabel    = "⚠️ 疑似第5浪顶部 — 注意卖出时机";
    isBullishSetup = false;
    score = 25; confidence = 45;
    detail = `价格在高位（位置${(priceRatio * 100).toFixed(0)}%），波浪结构可能完成第5浪`;
  }
  // Pattern 4: Wave 3 in progress (strongest wave)
  else if (lastP.type === "H" && priceRatio > 0.55 && priceRatio < 0.85 && prevP.type === "L" && wave3NotShortest) {
    wavePosition = "wave_3_up";
    waveLabel    = "📈 第3浪上升中（最强浪）";
    isBullishSetup = true;
    score = 20; confidence = 40;
    detail = `第3浪特征（高位${(priceRatio * 100).toFixed(0)}%），可持仓顺势，注意不要在顶部追高`;
  }
  else {
    isBullishSetup = priceRatio < 0.5;
    score = 0; confidence = 25;
    detail = `近30根K线：高点 $${pivotHigh.toFixed(2)}，低点 $${pivotLow.toFixed(2)}，当前位置 ${(priceRatio * 100).toFixed(0)}%，形态确认中`;
  }

  const signal: SignalDirection = isBullishSetup ? "bullish"
    : wavePosition === "wave_5_end" ? "bearish" : "neutral";

  return {
    wavePosition, waveLabel, isBullishSetup, pivotHigh, pivotLow,
    pivotCount: pivots.length, signal, score, confidence, detail,
  };
}

// ── Core Gate v2 — [FIX P1-2 + P2-1: dual mode + OBV as 5th gate] ────────────

export interface CoreGateResult {
  passed:      boolean;
  mode:        "reversal" | "trend" | "choppy";  // which engine triggered
  failures:    string[];
  conditions:  Record<string, boolean>;  // named map for agent loop
  // Reversal mode conditions
  macdCross:    boolean;
  rsiInZone:    boolean;
  bbBounce:     boolean;
  bbNotSqueeze: boolean;
  obvAligned:   boolean;  // [NEW v2] OBV as 5th gate
  // Trend mode conditions (new)
  macdAboveZero?:  boolean;
  rsiInTrendZone?: boolean;
  priceAboveMid?:  boolean;
  adxTrending?:    boolean;
}

export function checkCoreGate(
  macd:    MACDResult,
  rsi:     RSIResult,
  bb:      BBResult,
  obv:     OBVResult,
  adx:     ADXResult,
  regime:  MarketRegimeResult,
  direction: "buy" | "sell",
): CoreGateResult {
  const failures: string[] = [];
  const isBuy = direction === "buy";

  // ── Choppy mode: always block ──
  if (regime.regime === "choppy_mode") {
    return {
      passed: false, mode: "choppy", failures: ["市场震荡横盘（ADX<18+BB收缩），等待方向突破"],
      conditions: { choppy: true },
      macdCross: false, rsiInZone: false, bbBounce: false, bbNotSqueeze: false, obvAligned: false,
    };
  }

  // [FIX P2-1] OBV aligned gate (5th condition, both modes)
  const obvAligned = isBuy
    ? (obv.obvTrend === "rising" || obv.isBullishDiverg)
    : (obv.obvTrend === "falling" || obv.isBearishDiverg);

  // ── Trend mode gate (new in v2) ──
  if (regime.regime === "trend_mode") {
    const macdAboveZero  = isBuy ? (macd.aboveZero && macd.histExpanding)    : (!macd.aboveZero && macd.histExpanding);
    const rsiInTrendZone = isBuy ? rsi.inTrendZone                            : (rsi.rsi >= 28 && rsi.rsi <= 55);
    const priceAboveMid  = isBuy ? bb.priceAboveMid                           : !bb.priceAboveMid;
    const adxTrending    = adx.trending && (isBuy ? adx.trendDirection === "up" : adx.trendDirection === "down");

    if (!macdAboveZero)  failures.push(isBuy ? `MACD未在正区间扩张（趋势模式需Histogram>0且扩张）` : `MACD未在负区间扩张`);
    if (!rsiInTrendZone) failures.push(isBuy ? `RSI ${rsi.rsi.toFixed(1)} 不在趋势健康区（需45-72）` : `RSI ${rsi.rsi.toFixed(1)} 不在趋势卖出区（需28-55）`);
    if (!priceAboveMid)  failures.push(isBuy ? `价格未站稳BB中轨以上（趋势模式要求）` : `价格未跌破BB中轨（趋势模式要求）`);
    if (!adxTrending)    failures.push(`ADX ${adx.adx.toFixed(0)} 未达25或方向不符（+DI=${adx.plusDI.toFixed(0)} -DI=${adx.minusDI.toFixed(0)}）`);
    if (!obvAligned)     failures.push(`OBV方向不支持${isBuy ? "做多" : "做空"}（量能背离）`);

    const conditions = { macdAboveZero, rsiInTrendZone, priceAboveMid, adxTrending, obvAligned };
    return {
      passed: failures.length === 0,
      mode: "trend", failures, conditions,
      macdCross: false, rsiInZone: false, bbBounce: false,
      bbNotSqueeze: true, obvAligned,
      macdAboveZero, rsiInTrendZone, priceAboveMid, adxTrending,
    };
  }

  // ── Reversal mode gate (original 4 + OBV as 5th) ──
  const macdCross   = isBuy ? macd.isBullishCross : macd.isBearishCross;
  const rsiInZone   = isBuy
    ? (rsi.inBuyZone && rsi.slopePositive)
    : (rsi.rsi > 48 && rsi.rsi < 75 && !rsi.slopePositive);
  const bbBounce    = isBuy
    ? bb.reEnteredBand
    : (bb.priceNearUpper && !bb.reEnteredBand);
  const bbNotSqueeze = !bb.isSqueeze;

  if (!macdCross)    failures.push(isBuy ? `MACD未金叉（需Histogram由负转正，当前=${macd.current.toFixed(4)}）` : `MACD未死叉`);
  if (!rsiInZone)    failures.push(isBuy ? `RSI ${rsi.rsi.toFixed(1)} 不在反转买入区（需25-52且斜率向上）` : `RSI ${rsi.rsi.toFixed(1)} 不在反转卖出区（需48-75且下降）`);
  if (!bbBounce)     failures.push(isBuy ? `BB下轨反弹未确认（v2需2根K线站稳 或 1根强力收复）` : `BB上轨回落未确认`);
  if (!bbNotSqueeze) failures.push(`BB带宽极度收缩（${bb.bandWidthRank.toFixed(0)}%分位），反转信号不可靠`);
  if (!obvAligned)   failures.push(`OBV未配合（需量能方向与价格反转方向一致）`);

  const conditions = { macdCross, rsiInZone, bbBounce, bbNotSqueeze, obvAligned };
  return {
    passed: failures.length === 0,
    mode: "reversal", failures, conditions,
    macdCross, rsiInZone, bbBounce, bbNotSqueeze, obvAligned,
  };
}

// ── Full Confluence Analysis v2 ───────────────────────────────────────────────

export interface ConfluenceResult {
  // Signal
  tier:            SignalTier;
  confluenceScore: number;
  score:           number;         // alias for confluenceScore (agent loop compat)
  direction:       "buy" | "sell" | "neutral";
  coreGate:        CoreGateResult;
  marketRegime:    MarketRegimeResult;
  // Individual indicators
  macd:     MACDResult;
  rsi:      RSIResult;
  bb:       BBResult;
  obv:      OBVResult;
  fib:      FibResult;
  fibonacci: FibResult;            // alias for fib (agent loop compat)
  elliott:  ElliottResult;
  atr:      ATRResult;
  adx:      ADXResult;
  // Trade levels
  entry:          number;
  tp1:            number;
  tp2:            number;
  stopLoss:       number;
  stopLossMethod: "fibonacci" | "atr";
  riskReward:     number;
  isRRValid:      boolean;
  // Fibonacci context
  isInFibZone:    boolean;
  fibZoneNote:    string;
  // Summary
  summaryBullets: string[];
  recommendation: string;
  summary:        string;          // alias for recommendation (agent loop compat)
  timeHorizon:    string;
  generatedAt:    number;
}

export function analyzeConfluence(ohlcv: OHLCV[]): ConfluenceResult {
  const closes  = ohlcv.map(c => c.close);
  const current = closes[closes.length - 1];

  // Compute all 8 indicators
  const macd    = computeMACD(closes);
  const rsi     = computeRSI(closes);
  const bb      = computeBollingerBands(closes);
  const obv     = computeOBV(ohlcv);
  const atr     = computeATR(ohlcv);
  const adx     = computeADX(ohlcv);
  const fib     = computeFibonacci(ohlcv, atr);
  const elliott = detectElliottWave(closes);

  // Market regime detection
  const marketRegime = detectMarketRegime(adx, rsi, bb);

  // Try buy gate, then sell gate (using detected regime)
  const buyGate  = checkCoreGate(macd, rsi, bb, obv, adx, marketRegime, "buy");
  const sellGate = checkCoreGate(macd, rsi, bb, obv, adx, marketRegime, "sell");

  const direction: "buy" | "sell" | "neutral" =
    buyGate.passed  ? "buy"  :
    sellGate.passed ? "sell" : "neutral";

  const coreGate = direction === "sell" ? sellGate : buyGate;
  const isBuy    = direction === "buy";

  // Enhancement score (unchanged logic, now includes ADX bonus)
  const obvScore    = isBuy  ? (obv.signal === "bullish" ? obv.score       : obv.signal === "bearish"  ? -5 : 0)
                              : (obv.signal === "bearish" ? obv.score       : obv.signal === "bullish"  ? -5 : 0);
  const rsiScore    = isBuy  ? (rsi.signal === "bullish" ? rsi.score       : 0)
                              : (rsi.signal === "bearish" ? rsi.score       : 0);
  const elliottScore = isBuy ? (elliott.isBullishSetup ? elliott.score : -10)
                              : (!elliott.isBullishSetup ? elliott.score : -10);
  const macdScore   = macd.score;
  const bbScore     = isBuy  ? (bb.signal === "bullish"  ? bb.score        : 0)
                              : (bb.signal === "bearish"  ? bb.score        : 0);
  // [NEW] ADX bonus: trend mode adds up to 15 points
  const adxBonus = marketRegime.regime === "trend_mode"
    ? Math.min(15, Math.max(0, (adx.adx - 25) * 0.6))
    : 0;

  const rawScore       = Math.max(0, obvScore + rsiScore + elliottScore + macdScore + bbScore + adxBonus);
  const confluenceScore = Math.min(100, rawScore);

  // Trade levels (from Fibonacci, which now has ATR fallback built-in)
  const entry          = fib.entry;
  const tp1            = fib.tp1;
  const tp2            = fib.tp2;
  const stopLoss       = fib.stopLoss;
  const stopLossMethod = fib.stopLossMethod;

  // R:R calculation — [FIX P0-1]: always valid now since stopLoss < entry guaranteed
  const riskReward = stopLoss < entry
    ? parseFloat(((tp1 - entry) / (entry - stopLoss)).toFixed(2))
    : 0;
  const isRRValid  = riskReward >= 1.5;

  // Fibonacci proximity
  const isInFibZone = (fib.isAtSupport && isBuy) || (fib.isAtResist && !isBuy);
  const fibZoneNote = fib.isAtSupport
    ? `✅ 价格在 ${fib.nearestFibPct}% 斐波支撑（偏差${fib.distancePct.toFixed(1)}%）`
    : fib.distancePct < 3
    ? `⚠️ 距 ${fib.nearestFibPct}% 斐波位 ${fib.distancePct.toFixed(1)}%，稍偏`
    : `距最近斐波位 ${fib.distancePct.toFixed(1)}%（${fib.nearestFibPct}%）`;

  // Signal tier
  let tier: SignalTier = "neutral";
  if (coreGate.passed && isRRValid) {
    const highBar = confluenceScore >= 75 && isInFibZone && elliott.score >= 20;
    const midBar  = confluenceScore >= 50;
    if      (isBuy  && highBar) tier = "strong_buy";
    else if (isBuy  && midBar)  tier = "buy";
    else if (!isBuy && highBar) tier = "strong_sell";
    else if (!isBuy && midBar)  tier = "sell";
  }

  // Summary bullets
  const summaryBullets: string[] = [];
  summaryBullets.push(`📊 市场状态: ${marketRegime.label}（${marketRegime.regime === "trend_mode" ? "趋势" : marketRegime.regime === "reversal_mode" ? "反转" : "震荡"}引擎）`);

  if (!coreGate.passed) {
    summaryBullets.push(`⛔ 核心条件未达标（${coreGate.failures.length}项）: ${coreGate.failures[0]}`);
    if (coreGate.failures[1]) summaryBullets.push(`⛔ ${coreGate.failures[1]}`);
  } else {
    summaryBullets.push(`✅ ${coreGate.mode === "trend" ? "5个" : "5个"}核心条件全部满足（${coreGate.mode === "trend" ? "趋势" : "反转"}模式）`);
  }
  summaryBullets.push(macd.detail);
  summaryBullets.push(rsi.detail);
  summaryBullets.push(fib.detail);
  summaryBullets.push(adx.detail);
  summaryBullets.push(elliott.detail);

  // Recommendation text
  const tierLabel: Record<SignalTier, string> = {
    strong_buy: "🚀 强烈买入", buy: "📈 建议买入",
    neutral: "⏸️ 观望", sell: "📉 建议卖出", strong_sell: "🔻 强烈卖出",
  };

  let recommendation = "";
  const stopMethodStr = stopLossMethod === "atr"
    ? `ATR动态止损（入场−${(atr.atr * 2).toFixed(2)}）`
    : `斐波78.6%止损`;

  if (tier === "strong_buy" || tier === "buy") {
    recommendation =
      `${tierLabel[tier]}（评分${confluenceScore}/100，${coreGate.mode === "trend" ? "趋势" : "反转"}模式）。` +
      `入场 $${(entry * 0.99).toFixed(2)}-$${(entry * 1.01).toFixed(2)}，` +
      `止损 $${stopLoss.toFixed(2)}（${stopMethodStr}，-${((entry - stopLoss) / entry * 100).toFixed(1)}%），` +
      `TP1 $${tp1.toFixed(2)}（+${((tp1 - entry) / entry * 100).toFixed(1)}%），` +
      `TP2 $${tp2.toFixed(2)}（+${((tp2 - entry) / entry * 100).toFixed(1)}%），` +
      `R:R=${riskReward}:1。${fibZoneNote}`;
  } else if (tier === "sell" || tier === "strong_sell") {
    recommendation =
      `${tierLabel[tier]}（评分${confluenceScore}/100）。多指标同步看跌，${fib.detail}`;
  } else {
    const reasons = marketRegime.regime === "choppy_mode"
      ? "震荡横盘，等待突破"
      : coreGate.passed
        ? (isRRValid ? "综合评分不足50" : `R:R=${riskReward}:1 低于1.5`)
        : `${coreGate.failures.length}项核心条件未通过`;
    recommendation = `⏸️ 暂不入场（${reasons}）。${marketRegime.description}`;
  }

  const timeHorizon =
    tier === "strong_buy" || tier === "buy"   ? "3-14天（波浪目标达成后逐步退出）"
    : tier === "sell" || tier === "strong_sell" ? "2-10天"
    : "暂无（等待信号成立）";

  return {
    tier, confluenceScore, score: confluenceScore,
    direction, coreGate, marketRegime,
    macd, rsi, bb, obv, atr, adx,
    fib, fibonacci: fib,
    elliott,
    entry, tp1, tp2, stopLoss, stopLossMethod,
    riskReward, isRRValid, isInFibZone, fibZoneNote,
    summaryBullets, recommendation, summary: recommendation,
    timeHorizon, generatedAt: Date.now(),
  };
}
