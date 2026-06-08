import anthropic

from e2b_code_interpreter import Sandbox
from prompts import (
    CODE_GEN_PROMPT,
    SYSTEM_PROMPT_DAILY,
    SYSTEM_PROMPT_INTRADAY,
    SYSTEM_PROMPT_MULTI_TF,
)

client = anthropic.Anthropic()


def clean_code(code: str) -> str:
    code = code.strip()
    if code.startswith("```"):
        parts = code.split("```")
        if len(parts) >= 2:
            code = parts[1]
    if code.startswith("python"):
        code = code.replace("python", "", 1).lstrip()
    return code.strip()


def _pick_system_prompt(data_profile: dict) -> str:
    if data_profile.get("requires_multi_timeframe"):
        return SYSTEM_PROMPT_MULTI_TF
    elif data_profile.get("data_source") == "alpaca":
        return SYSTEM_PROMPT_INTRADAY
    else:
        return SYSTEM_PROMPT_DAILY


def generate_code(
    strategy: str,
    ticker: str,
    start: str,
    end: str,
    data_profile: dict,
) -> str:
    system = _pick_system_prompt(data_profile)
    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1500,
        system=system,
        messages=[{
            "role": "user",
            "content": CODE_GEN_PROMPT.format(
                strategy=strategy, ticker=ticker, start=start, end=end
            )
        }]
    )
    for block in message.content:
        if block.type == "text":
            return clean_code(block.text.strip())
    raise ValueError("Claude returned no code")


def fix_code(code: str, error: str) -> str:
    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1500,
        messages=[{
            "role": "user",
            "content": (
                "This vectorbt backtest code threw an error.\n"
                "Fix it and return only the corrected Python code, no explanation.\n\n"
                f"Code:\n{code}\n\nError:\n{error}"
            )
        }]
    )
    for block in message.content:
        if block.type == "text":
            return clean_code(block.text.strip())
    raise ValueError("Claude returned no fix")


def _build_setup_code(df, df_higher=None) -> str:
    """
    Serialize DataFrames to CSV strings for injection into the sandbox.
    Returns the Python setup code that recreates them inside E2B.
    """
    df_csv = df.to_csv()
    lines = [
        "import pandas as pd",
        "import io",
        f"df = pd.read_csv(io.StringIO({repr(df_csv)}), index_col='Date', parse_dates=True)",
    ]

    if df_higher is not None:
        df_higher_csv = df_higher.to_csv()
        lines.append(
            f"df_higher = pd.read_csv(io.StringIO({repr(df_higher_csv)}), index_col='Date', parse_dates=True)"
        )

    return "\n".join(lines) + "\n"


def run_code(
    code: str,
    data_profile: dict,
    df,
    df_higher=None,
    retries: int = 2,
) -> list[str] | None:
    """
    Runs the backtest code in an E2B sandbox.
    For intraday strategies, pre-loads DataFrames via CSV injection.
    Returns stdout lines or None on failure.
    """
    is_daily = data_profile.get("data_source") == "yfinance"

    setup: str = ""
    if not is_daily:
        setup = _build_setup_code(df, df_higher)
        
    sandbox = Sandbox.create()
    try:
        sandbox.commands.run("pip install vectorbt yfinance --quiet")

        # For intraday/multi-TF, inject pre-fetched data as setup code
        if is_daily:
            full_code = code
        else:
            setup = _build_setup_code(df, df_higher)
            full_code = setup + code

        for attempt in range(retries + 1):
            result = sandbox.run_code(clean_code(full_code))

            if result.error:
                if attempt < retries:
                    print(f"\n[Attempt {attempt + 1} failed, asking Claude to fix...]\n")
                    code = fix_code(code, result.error.value)
                    full_code = code if is_daily else (setup + code)
                else:
                    print(f"\n[Code failed after {retries + 1} attempts]")
                    print(result.error.value)
                    return None
            else:
                return result.logs.stdout

    finally:
        sandbox.kill()