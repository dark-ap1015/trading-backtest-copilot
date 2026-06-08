import json
import anthropic

from prompts import CLASSIFIER_PROMPT

client = anthropic.Anthropic()

def classify_strategy(strategy: str) -> dict:
    """
    Sends the strategy description to Claude and returns a structured
    data profile as a dict. Handles JSON parsing and markdown fence cleanup.
    """
    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=500,
        messages=[
            {"role": "user", "content": f"{CLASSIFIER_PROMPT}\n\nStrategy: {strategy}"}
        ]
    )
    for block in message.content:
        if block.type == "text":
            raw = block.text.strip()
            
            # Strip markdown fences if Claude adds them despite instructions
            raw = raw.replace("```json", "").replace("```", "").strip()
            try:
                return json.loads(raw)
            except json.JSONDecodeError as e:
                raise ValueError(f"Classifier returned invalid JSON:\n{raw}") from e

    raise ValueError("Classifier returned no text output")