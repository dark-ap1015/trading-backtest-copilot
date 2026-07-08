from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr

import os

from backend.db import get_db, engine, Base
from backend.models import User, Backtest
from backend.auth import create_user, get_user_by_username, get_user_by_email, verify_password

from backend.classifier import classify_strategy
from backend.data import fetch_data
from backend.backtest import generate_code, run_code
from backend.explainer import explain_results, explain_trade

Base.metadata.create_all(bind=engine)

load_dotenv()

app = FastAPI()

app.add_middleware(
    SessionMiddleware,
    secret_key=os.getenv("SESSION_SECRET", "dev-secret-change-this"),
    same_site="lax",
    https_only=False,   # set to True once deployed behind HTTPS
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class SignupRequest(BaseModel):
    username: str
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    email: str


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    user_id = request.session.get("user_id")
    if user_id is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user


@app.post("/auth/signup", response_model=UserResponse)
def signup(req: SignupRequest, request: Request, db: Session = Depends(get_db)):
    if get_user_by_username(db, req.username):
        raise HTTPException(status_code=400, detail="Username already taken")
    if get_user_by_email(db, req.email):
        raise HTTPException(status_code=400, detail="Email already registered")

    user = create_user(db, req.username, req.email, req.password)
    request.session["user_id"] = user.id

    return UserResponse(id=user.id, username=user.username, email=user.email)


@app.post("/auth/login", response_model=UserResponse)
def login(req: LoginRequest, request: Request, db: Session = Depends(get_db)):
    user = get_user_by_username(db, req.username)
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    request.session["user_id"] = user.id
    return UserResponse(id=user.id, username=user.username, email=user.email)


@app.post("/auth/logout")
def logout(request: Request):
    request.session.clear()
    return {"message": "Logged out"}


@app.get("/auth/me", response_model=UserResponse)
def get_me(user: User = Depends(get_current_user)):
    return UserResponse(id=user.id, username=user.username, email=user.email)

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
    ticker: str
    start_date: str
    end_date: str


class BacktestHistoryItem(BaseModel):
    id: int
    strategy: str
    ticker: str
    start_date: str
    end_date: str
    created_at: str


@app.post("/backtest", response_model=BacktestResponse)
async def run_backtest(
    req: BacktestRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        data_profile = classify_strategy(req.strategy)
        df, df_higher = fetch_data(req.ticker, req.start, req.end, data_profile)
        code = generate_code(req.strategy, req.ticker, req.start, req.end, data_profile)
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
        equity_curve = _parse_equity_curve(stats_text)
        trades = _parse_trades(stats_text)
        explanation = explain_results(req.strategy, req.ticker, req.start, req.end, stats_clean)

        # Save to history
        saved = Backtest(
            user_id=user.id,
            strategy=req.strategy,
            ticker=req.ticker,
            start_date=req.start,
            end_date=req.end,
            stats=stats_clean,
            explanation=explanation,
            equity_curve=equity_curve,
            trades=trades,
            classifier=data_profile,
        )
        db.add(saved)
        db.commit()
    
        return BacktestResponse(
            stats=stats_clean,
            explanation=explanation,
            equity_curve=equity_curve,
            trades=trades,
            classifier=data_profile,
            ticker=req.ticker,
            start_date=req.start,
            end_date=req.end,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

@app.get("/backtest/history", response_model=list[BacktestHistoryItem])
def get_history(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    results = (
        db.query(Backtest)
        .filter(Backtest.user_id == user.id)
        .order_by(Backtest.created_at.desc())
        .all()
    )
    return [
        BacktestHistoryItem(
            id=b.id,
            strategy=b.strategy,
            ticker=b.ticker,
            start_date=b.start_date,
            end_date=b.end_date,
            created_at=b.created_at.isoformat(),
        )
        for b in results
    ]


@app.get("/backtest/{backtest_id}", response_model=BacktestResponse)
def get_backtest(
    backtest_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    b = db.query(Backtest).filter(
        Backtest.id == backtest_id, Backtest.user_id == user.id
    ).first()
    if not b:
        raise HTTPException(status_code=404, detail="Backtest not found")

    return BacktestResponse(
        stats=b.stats,
        explanation=b.explanation,
        equity_curve=b.equity_curve,
        trades=b.trades,
        classifier=b.classifier,
        ticker=b.ticker,
        start_date=b.start_date,
        end_date=b.end_date,
    )

class TradeCommentaryRequest(BaseModel):
    strategy: str
    ticker: str
    trade: dict


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