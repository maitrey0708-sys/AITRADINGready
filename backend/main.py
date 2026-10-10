from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd

from ml_engine import generate_signal
from backtest import run_backtest
from market_data import market_frame

app = FastAPI(title="AI Trading Dashboard API", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

SYMBOLS = [
    "NIFTY 50", "BANK NIFTY", "SENSEX",
    "RELIANCE", "TCS", "INFOSYS", "HDFC BANK", "ICICI BANK", "SBIN", "ITC", "BHARTI AIRTEL",
    "BTC/USDT", "ETH/USDT",
]

@app.get("/")
def root():
    return {"name": "AI Trading Dashboard API", "status": "online", "market_data": "live when provider is available"}

@app.get("/api/markets")
def markets():
    result = []
    for symbol in SYMBOLS:
        df, live = market_frame(symbol, 80, live=True)
        price = float(df.close.iloc[-1])
        prev = float(df.close.iloc[-2]) if len(df) > 1 else price
        result.append({"symbol": symbol, "price": round(price, 4), "change": round((price / prev - 1) * 100, 2), "live": live})
    return result

@app.get("/api/market/{symbol:path}")
def market(symbol: str):
    df, live = market_frame(symbol, 80, live=True)
    price = float(df.close.iloc[-1])
    prev = float(df.close.iloc[-2]) if len(df) > 1 else price
    return {
        "symbol": symbol,
        "price": price,
        "change": (price / prev - 1) * 100,
        "live": live,
        "updated_at": pd.Timestamp(df.time.iloc[-1]).isoformat(),
        "series": [{"time": pd.Timestamp(x).strftime("%d %b %H:%M"), "open": float(o), "high": float(h), "low": float(l), "close": float(c), "volume": float(v), "sma20": float(sma) if pd.notna(sma) else None} for x,o,h,l,c,v,sma in zip(df.time,df.open,df.high,df.low,df.close,df.volume,df.sma20)],
        "indicators": {"rsi": round(float(df.rsi.iloc[-1]), 2), "macd": round(float(df.macd.iloc[-1]), 4), "sma20": round(float(df.sma20.iloc[-1]), 2)},
    }

@app.get("/api/signal/{symbol:path}")
def signal(symbol: str):
    df, live = market_frame(symbol, 80, live=True)
    result = generate_signal(df)
    return {"symbol": symbol, "live": live, **result}

@app.post("/api/backtest")
def backtest(symbol: str = Query("NIFTY 50"), initial_capital: float = Query(100000)):
    df, live = market_frame(symbol, 250, live=True)
    return {**run_backtest(df, initial_capital), "data_source": "live provider" if live else "demo fallback"}

@app.get("/api/risk")
def risk():
    return {"stop_loss": 2.0, "max_drawdown": 8.0, "daily_loss_limit": 5000, "alert_enabled": True}

@app.post("/api/orders/paper")
def paper_order(symbol: str, side: str, quantity: float, price: float):
    return {"mode": "PAPER", "status": "accepted", "symbol": symbol, "side": side.upper(), "quantity": quantity, "price": price, "message": "Paper order only. No real money was used."}
