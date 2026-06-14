import os
import pandas as pd
import yfinance as yf

from datetime import datetime, timezone
from alpaca.data.historical import StockHistoricalDataClient
from alpaca.data.requests import StockBarsRequest
from alpaca.data.timeframe import TimeFrame, TimeFrameUnit

TIMEFRAME_MAP = {
    "1m":  TimeFrame(1,  TimeFrameUnit.Minute), # type: ignore[arg-type]
    "5m":  TimeFrame(5,  TimeFrameUnit.Minute), # type: ignore[arg-type]
    "15m": TimeFrame(15, TimeFrameUnit.Minute), # type: ignore[arg-type]
    "30m": TimeFrame(30, TimeFrameUnit.Minute), # type: ignore[arg-type]
    "1h":  TimeFrame(1,  TimeFrameUnit.Hour), # type: ignore[arg-type]
    "4h":  TimeFrame(4,  TimeFrameUnit.Hour), # type: ignore[arg-type]
    "1d":  TimeFrame(1,  TimeFrameUnit.Day), # type: ignore[arg-type]
}


def _alpaca_client():
    return StockHistoricalDataClient(api_key=os.getenv("ALPACA_API_KEY"), secret_key=os.getenv("ALPACA_SECRET_KEY"))


def _normalize_alpaca_df(df: pd.DataFrame, ticker: str) -> pd.DataFrame:
    """
    Alpaca returns a MultiIndex (symbol, timestamp). Flatten it,
    normalize column names to match yfinance (capital first letter),
    and ensure the index is timezone-aware UTC.
    """
    if isinstance(df.index, pd.MultiIndex):
        result = df.xs(ticker, level="symbol")
        
        if not isinstance(result, pd.DataFrame):
            raise TypeError(f"Expected DataFrame after xs(), got {type(result)}")
        df = result

    df.index.name = "Date"

    # Capitalize column names: open → Open, close → Close, etc.
    df.columns = [c.capitalize() for c in df.columns]

    # Ensure timezone-aware UTC index
    if isinstance(df.index, pd.DatetimeIndex):
        if df.index.tz is None:
            df.index = df.index.tz_localize("UTC")
        else:
            df.index = df.index.tz_convert("UTC")

    return df


def fetch_yfinance(ticker: str, start: str, end: str) -> pd.DataFrame:
    result = yf.download(ticker, start=start, end=end, auto_adjust=True, progress=False)
    if result is None or result.empty:
        raise ValueError(f"yfinance returned no data for {ticker} ({start} to {end})")
    
    df: pd.DataFrame = result

    # Fix 1 — Flatten multi-level columns (yfinance newer versions return
    # ('Close', 'ES') tuples instead of plain 'Close' strings)
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = [col[0] for col in df.columns]

    # Fix 2 — Ensure index is named 'Date' so CSV serialization is consistent
    df.index.name = "Date"

    # Fix 3 — Strip timezone from daily data so it aligns with intraday
    if isinstance(df.index, pd.DatetimeIndex) and df.index.tz is not None:
        df.index = df.index.tz_localize(None)

    return df


def fetch_alpaca(ticker: str, start: str, end: str, timeframe: str) -> pd.DataFrame:
    if timeframe not in TIMEFRAME_MAP:
        raise ValueError(f"Unsupported timeframe: {timeframe}. Choose from {list(TIMEFRAME_MAP)}")

    ac = _alpaca_client()
    request = StockBarsRequest(
        symbol_or_symbols=ticker,
        timeframe=TIMEFRAME_MAP[timeframe],
        start=datetime.strptime(start, "%Y-%m-%d").replace(tzinfo=timezone.utc),
        end=datetime.strptime(end,   "%Y-%m-%d").replace(tzinfo=timezone.utc),
    )
    bars = ac.get_stock_bars(request)
    df = bars.df

    if df.empty:
        raise ValueError(f"Alpaca returned no data for {ticker} ({start} to {end}, {timeframe})")

    return _normalize_alpaca_df(df, ticker)


def fetch_data(
    ticker: str,
    start: str,
    end: str,
    data_profile: dict
) -> tuple[pd.DataFrame, pd.DataFrame | None]:
    """
    Main entry point. Returns (df_primary, df_higher).
    df_higher is None for single-timeframe strategies.
    """
    source      = data_profile["data_source"]
    primary_tf  = data_profile["primary_timeframe"]
    secondary_tf = data_profile.get("secondary_timeframe")
    is_multi    = data_profile.get("requires_multi_timeframe", False)

    # Fetch primary data
    if source == "alpaca":
        df = fetch_alpaca(ticker, start, end, primary_tf)
    else:
        df = fetch_yfinance(ticker, start, end)

    # Fetch secondary (higher timeframe) data if multi-timeframe
    df_higher = None
    if is_multi and secondary_tf:
        if secondary_tf == "1d":
            # Daily context: always use yfinance (full history, no Alpaca needed)
            df_higher = fetch_yfinance(ticker, start, end)
        else:
            df_higher = fetch_alpaca(ticker, start, end, secondary_tf)

    return df, df_higher