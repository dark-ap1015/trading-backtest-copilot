from classifier import classify_strategy
from data import fetch_data
from backtest import generate_code, run_code
from explainer import explain_results

from dotenv import load_dotenv
load_dotenv()


def main():
    print("=== AI Backtest Co-pilot ===\n")

    strategy = input("Describe your strategy: ")
    ticker = input("Ticker (e.g. SPY): ").upper()
    start = input("Start date (YYYY-MM-DD): ")
    end = input("End date (YYYY-MM-DD): ")

    # ── Step 1: Classify ──────────────────────────────────────────────────────
    print("\n[Classifying strategy...]\n")
    data_profile = classify_strategy(strategy)

    print(f"Timeframe: {data_profile['primary_timeframe']}")
    print(f"Source: {data_profile['data_source']}")
    print(f"Multi-TF: {data_profile['requires_multi_timeframe']}")
    print(f"Reasoning: {data_profile['reasoning']}\n")

    # ── Step 2: Handle ambiguous strategies ───────────────────────────────────
    if data_profile.get("is_ambiguous"):
        print(f"[Clarification needed] {data_profile['clarifying_question']}")
        clarification = input("Your answer: ")
        strategy = f"{strategy}. Clarification: {clarification}"
        print("\n[Re-classifying with clarification...]\n")
        data_profile = classify_strategy(strategy)
        print(f"Timeframe: {data_profile['primary_timeframe']}")
        print(f"Source: {data_profile['data_source']}")
        print(f"Reasoning: {data_profile['reasoning']}\n")

    # ── Step 3: Fetch data ────────────────────────────────────────────────────
    print("[Fetching data...]\n")
    try:
        df, df_higher = fetch_data(ticker, start, end, data_profile)
    except ValueError as e:
        print(f"[Data fetch failed] {e}")
        return

    print(f"Primary: {len(df):,} bars of {data_profile['primary_timeframe']} data")
    if df_higher is not None:
        secondary_tf = data_profile.get("secondary_timeframe", "daily")
        print(f"Secondary: {len(df_higher):,} bars of {secondary_tf} data")
    print()

    df, df_higher = fetch_data(ticker, start, end, data_profile)

    # ── Step 4: Generate code ─────────────────────────────────────────────────
    print("[Generating backtest code...]\n")
    code = generate_code(strategy, ticker, start, end, data_profile)
    # print("--- Generated code ---")
    # print(code)
    # print("----------------------\n")

    # ── Step 5: Run in sandbox ────────────────────────────────────────────────
    print("[Running backtest in E2B sandbox...]\n")
    output = run_code(code, data_profile, df, df_higher)

    # ── Step 6: Explain results ───────────────────────────────────────────────
    if output:
        stats_text = "\n".join(output)
        print("--- Results ---")
        print(stats_text)

        if "Total Return" not in stats_text:
            print("\n[Warning: stats output looks incomplete — skipping explanation]")
            print("Tip: the strategy may have generated no trades in this date range.")
        else:
            print("\n[Generating explanation...]\n")
            explanation = explain_results(strategy, ticker, start, end, stats_text)
            print("--- Analysis ---")
            print(explanation)


if __name__ == "__main__":
    main()