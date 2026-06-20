from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend.classifier import classify_strategy
from backend.data import fetch_data
from backend.backtest import generate_code, run_code
from backend.explainer import explain_results

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
            classifier=data_profile,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _parse_equity_curve(stats_text: str) -> list[dict]:
    """
    Parses the equity curve CSV from the sandbox stdout.
    The generated code prints portfolio.value().to_csv() after '---EQUITY---'.
    """
    if "---EQUITY---" not in stats_text:
        return []

    parts = stats_text.split("---EQUITY---")
    if len(parts) < 2:
        return []

    csv_block = parts[1].strip()
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


def _parse_stats_only(stats_text: str) -> str:
    """Strip the equity CSV section — frontend only needs the stats table."""
    if "---EQUITY---" in stats_text:
        return stats_text.split("---EQUITY---")[0].strip()
    return stats_text