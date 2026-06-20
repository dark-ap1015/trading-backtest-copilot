from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend.classifier import classify_strategy
from backend.data import fetch_data
from backend.backtest import generate_code, run_code
from backend.explainer import explain_results, explain_trade

load_dotenv()

app = FastAPI()

# Allow the React dev server to call the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class BacktestRequest(BaseModel):
    strategy: str
    ticker: str
    start: str
    end: str


class BacktestResponse(BaseModel):
    stats: str
    explanation: str
    equity_curve: list[dict]   # [{date: str, value: float}, ...]
    trades: list[dict]
    classifier: dict


@app.post("/backtest", response_model=BacktestResponse)
async def run_backtest(req: BacktestRequest):
    try:
        data_profile = classify_strategy(req.strategy)

        df, df_higher = fetch_data(
            req.ticker, req.start, req.end, data_profile
        )

        code = generate_code(
            req.strategy, req.ticker, req.start, req.end, data_profile
        )
        output = run_code(code, data_profile, df, df_higher)

        if not output:
            raise HTTPException(status_code=500, detail="Backtest produced no output")

        stats_text = "\n".join(output)

        if "Total Return" not in stats_text:
            raise HTTPException(
                status_code=422,
                detail="Backtest ran but generated no trades. Try a different date range or strategy."
            )

        stats_clean = _parse_stats_only(stats_text)

        explanation = explain_results(
            req.strategy, req.ticker, req.start, req.end, stats_clean
        )

        return BacktestResponse(
            stats=stats_clean,
            explanation=explanation,
            equity_curve=_parse_equity_curve(stats_text),
            trades=_parse_trades(stats_text),
            classifier=data_profile,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

class TradeCommentaryRequest(BaseModel):
    strategy: str
    ticker: str
    trade: dict   # one row from the trades list


class TradeCommentaryResponse(BaseModel):
    commentary: str


@app.post("/trade-commentary", response_model=TradeCommentaryResponse)
async def trade_commentary(req: TradeCommentaryRequest):
    try:
        commentary = explain_trade(req.strategy, req.ticker, req.trade)
        return TradeCommentaryResponse(commentary=commentary)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _parse_equity_curve(stats_text: str) -> list[dict]:
    if "---EQUITY---" not in stats_text:
        return []

    after_equity = stats_text.split("---EQUITY---")[1]

    # Equity block ends where the trades sentinel begins (if present)
    if "---TRADES---" in after_equity:
        csv_block = after_equity.split("---TRADES---")[0].strip()
    else:
        csv_block = after_equity.strip()

    rows = []
    for line in csv_block.splitlines():
        line = line.strip()
        if not line or line.startswith("Date") or line.startswith("timestamp"):
            continue
        cols = line.split(",")
        if len(cols) >= 2:
            try:
                rows.append({"date": cols[0].strip(), "value": float(cols[1].strip())})
            except ValueError:
                continue

    return rows


def _parse_trades(stats_text: str) -> list[dict]:
    """
    Parses the trade records CSV from the sandbox stdout.
    The generated code prints portfolio.trades.records_readable.to_csv()
    after the '---TRADES---' sentinel.
    """
    if "---TRADES---" not in stats_text:
        return []

    # Trades block is always last, so split and take everything after
    block = stats_text.split("---TRADES---")[1].strip()

    lines = block.splitlines()
    if len(lines) < 2:
        return []

    headers = [h.strip() for h in lines[0].split(",")]
    trades = []

    for line in lines[1:]:
        if not line.strip():
            continue
        values = line.split(",")
        if len(values) != len(headers):
            continue
        row = dict(zip(headers, values))
        trades.append(row)

    return trades


def _parse_stats_only(stats_text: str) -> str:
    """Strip both the equity and trades CSV sections — frontend only needs the stats table."""
    if "---EQUITY---" in stats_text:
        return stats_text.split("---EQUITY---")[0].strip()
    return stats_text