import time
from datetime import datetime, timedelta
import numpy as np
import pandas as pd

try:
    import yfinance as yf
except ImportError:
    yf = None

SYMBOL_MAP = {
    "NIFTY 50": "^NSEI",
    "BANK NIFTY": "^NSEBANK",
    "SENSEX": "^BSESN",
    "RELIANCE": "RELIANCE.NS",
    "TCS": "TCS.NS",
    "INFOSYS": "INFY.NS",
    "HDFC BANK": "HDFCBANK.NS",
    "ICICI BANK": "ICICIBANK.NS",
    "SBIN": "SBIN.NS",
    "ITC": "ITC.NS",
    "BHARTI AIRTEL": "BHARTIARTL.NS",
    "BTC/USDT": "BTC-USD",
    "ETH/USDT": "ETH-USD",
}

_cache = {}
CACHE_SECONDS = 15


def _demo_frame(symbol="NIFTY 50", periods=80):
    bases = {
        "NIFTY 50": 25842.35,
        "BANK NIFTY": 58320.10,
        "SENSEX": 84500.0,
        "RELIANCE": 1450.0,
        "TCS": 3200.0,
        "INFOSYS": 1500.0,
        "HDFC BANK": 950.0,
        "ICICI BANK": 1400.0,
        "SBIN": 800.0,
        "ITC": 400.0,
        "BHARTI AIRTEL": 1900.0,
        "BTC/USDT": 112640.20,
        "ETH/USDT": 4182.75,
    }
    base = bases.get(symbol, bases["NIFTY 50"])
    rng = np.random.default_rng(abs(hash(symbol)) % (2**32))
    returns = rng.normal(0.0004, 0.008, periods)
    close = base * np.cumprod(1 + returns)
    dates = pd.date_range(datetime.now() - timedelta(hours=periods), periods=periods, freq="h")
    df = pd.DataFrame({"time": dates, "close": close})
    df["open"] = df["close"].shift(1).fillna(df["close"] * 0.998)
    df["high"] = df[["open", "close"]].max(axis=1) * (1 + rng.uniform(0, .003, periods))
    df["low"] = df[["open", "close"]].min(axis=1) * (1 - rng.uniform(0, .003, periods))
    df["volume"] = rng.integers(50000, 400000, periods)
    return df


def _add_indicators(df):
    df = df.copy()
    df["sma20"] = df["close"].rolling(20).mean()
    delta = df["close"].diff()
    gain = delta.clip(lower=0).rolling(14).mean()
    loss = (-delta.clip(upper=0)).rolling(14).mean()
    rs = gain / loss.replace(0, np.nan)
    df["rsi"] = (100 - 100 / (1 + rs)).fillna(50)
    ema12 = df["close"].ewm(span=12, adjust=False).mean()
    ema26 = df["close"].ewm(span=26, adjust=False).mean()
    df["macd"] = ema12 - ema26
    df["signal_line"] = df["macd"].ewm(span=9, adjust=False).mean()
    return df


def market_frame(symbol="NIFTY 50", periods=80, live=True):
    key = (symbol, periods)
    now = time.time()
    if live and key in _cache and now - _cache[key][0] < CACHE_SECONDS:
        return _cache[key][1].copy(), True

    df = None
    if live and yf is not None and symbol in SYMBOL_MAP:
        try:
            ticker = yf.Ticker(SYMBOL_MAP[symbol])
            data = ticker.history(period="5d", interval="5m", auto_adjust=False)
            if data is not None and not data.empty:
                data = data.tail(periods).reset_index()
                time_col = "Datetime" if "Datetime" in data.columns else "Date"
                df = pd.DataFrame({
                    "time": pd.to_datetime(data[time_col]),
                    "open": data["Open"].astype(float),
                    "high": data["High"].astype(float),
                    "low": data["Low"].astype(float),
                    "close": data["Close"].astype(float),
                    "volume": data["Volume"].astype(float),
                }).dropna(subset=["close"])
        except Exception:
            df = None

    is_live = df is not None and not df.empty
    if not is_live:
        df = _demo_frame(symbol, periods)

    df = _add_indicators(df)
    _cache[key] = (now, df.copy())
    return df, is_live
