import anthropic

from prompts import EXPLANATION_PROMPT

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