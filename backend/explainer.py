import anthropic

from backend.prompts import EXPLANATION_PROMPT, TRADE_COMMENTARY_PROMPT

client = anthropic.Anthropic()

def explain_results(
    strategy: str,
    ticker: str,
    start: str,
    end: str,
    stats_text: str,
) -> str:
    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1000,
        messages=[{
            "role": "user",
            "content": EXPLANATION_PROMPT.format(
                strategy=strategy,
                ticker=ticker,
                start=start,
                end=end,
                stats=stats_text,
            )
        }]
    )
    for block in message.content:
        if block.type == "text":
            return block.text.strip()
    raise ValueError("Claude returned no explanation")


def explain_trade(strategy: str, ticker: str, trade: dict) -> str:
    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=400,
        messages=[{
            "role": "user",
            "content": TRADE_COMMENTARY_PROMPT.format(
                strategy=strategy,
                ticker=ticker,
                entry_time=trade.get("Entry Timestamp", "unknown"),
                exit_time=trade.get("Exit Timestamp", "unknown"),
                entry_price=trade.get("Avg Entry Price", "unknown"),
                exit_price=trade.get("Avg Exit Price", "unknown"),
                pnl=trade.get("PnL", "unknown"),
                return_pct=trade.get("Return", "unknown"),
                direction=trade.get("Direction", "unknown"),
            )
        }]
    )
    for block in message.content:
        if block.type == "text":
            return block.text.strip()
    raise ValueError("Claude returned no trade commentary")