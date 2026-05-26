import os
import anthropic
from e2b_code_interpreter import Sandbox
from dotenv import load_dotenv

# Provides API keys for Anthropic and E2B from a .env file
load_dotenv()

# Initialize the Anthropic client
client = anthropic.Anthropic()

# Helper function to remove markdown formatting and guarantees only raw Python is passed into the sandbox
def clean_code(code: str) -> str:
    code = code.strip()

    if code.startswith("```"):
        parts = code.split("```")
        if len(parts) >= 2:
            code = parts[1]

    if code.startswith("python"):
        code = code.replace("python", "", 1).lstrip()

    return code.strip()

# System prompt for Claude
SYSTEM_PROMPT = """You are an expert algorithmic trading developer.
When given a strategy description and ticker, write a complete, runnable 
Python backtest using vectorbt (latest stable version).

Rules:
- Data is fetched with yfinance: df = yf.download(ticker, start=start, end=end, auto_adjust=True)
- Use df['Close'] (capital C) as the price series — yfinance returns capital column names
- Generate entry and exit boolean Series separately before calling from_signals()
- Use vbt.Portfolio.from_signals(close, entries, exits, init_cash=10_000, fees=0.001)
- Print portfolio.stats() at the end — nothing else
- Do not use from_order_func, parameterized decorators, or vbt accessors
- Output format is STRICT:
    - Return ONLY raw Python code
    - Do NOT wrap in triple backticks
    - Do NOT use Markdown
    - Do NOT include explanations
    - Do NOT include any extra text
- If you violate these rules, the response is invalid"""

CODE_GEN_PROMPT = """Strategy: {strategy}
Ticker: {ticker}
Start date: {start}
End date: {end}

Write the backtest code now."""

# Generate vectorbt backtest code using Claude based on user's strategy and parameters
def generate_code(strategy, ticker, start, end):
    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1500,
        system=SYSTEM_PROMPT,
        messages=[
            {"role": "user", "content": CODE_GEN_PROMPT.format(
                strategy=strategy, ticker=ticker, start=start, end=end
            )}
        ]
    )
    for block in message.content:
        if block.type == "text":
            return clean_code(block.text.strip())
        
    raise ValueError("Claude returned no text output")

# Execute generated Python code inside an isolated E2B sandbox
def run_code(code, retries=2):
    sandbox = Sandbox.create()

    # Install vectorbt inside the E2B sandbox
    try:
        sandbox.commands.run("pip install vectorbt --quiet")

        for attempt in range(retries + 1):
            if not isinstance(code, str):
                raise TypeError(f"Expected string code, got {type(code)}")

            code = clean_code(code)
            result = sandbox.run_code(code)

            if result.error:
                if attempt < retries:
                    print(f"\n[Attempt {attempt + 1} failed, asking Claude to fix...]\n")
                    code = clean_code(fix_code(code, result.error.value))
                else:
                    print(f"\n[Code failed after {retries + 1} attempts]")
                    print(result.error.value)
                    return None
            else:
                return result.logs.stdout

    finally:
        sandbox.kill()

# Ask Claude to fix code that threw an error, provides error message and original code for context
def fix_code(code, error):
    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1500,
        messages=[
            {"role": "user", "content": f"""This vectorbt backtest code threw an error.
Fix it and return only the corrected Python code, no explanation.

Code:
{code}

Error:
{error}"""}
        ]
    )
    for block in message.content:
        if block.type == "text":
            return clean_code(block.text.strip())
        
    raise ValueError("Claude returned no fix")

def main():
    print("=== AI Backtest Co-pilot ===\n")
    
    strategy = input("Describe your strategy: ")
    ticker = input("Ticker (e.g. SPY): ").upper()
    start = input("Start date (YYYY-MM-DD): ")
    end = input("End date (YYYY-MM-DD): ")
    
    print("\n[Generating code...]\n")
    code = generate_code(strategy, ticker, start, end)
    
    print("--- Generated code ---")
    print(code)
    print("----------------------\n")
    
    print("[Running backtest in E2B sandbox...]\n")
    output = run_code(code)
    
    if output:
        print("--- Results ---")
        print("\n".join(output))

if __name__ == "__main__":
    main()