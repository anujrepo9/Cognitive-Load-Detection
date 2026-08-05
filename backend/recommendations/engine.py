"""
recommendations/engine.py — Rule-based recommendation engine.
Maps cognitive load level + behavioral signals → actionable suggestions.
"""

from api.schemas import BehaviorPayload, Recommendation


RULES: dict[str, list[dict]] = {
    "high": [
        {"type": "break",    "title": "Take a 5-minute break",
         "reason": "Your typing speed has dropped and idle time is high — a short rest resets focus."},
        {"type": "water",    "title": "Drink some water",
         "reason": "Dehydration worsens cognitive performance. Take a sip."},
        {"type": "notify",   "title": "Mute notifications",
         "reason": "Reducing interruptions lowers cognitive load significantly."},
        {"type": "simplify", "title": "Simplify your current task",
         "reason": "Break the task into smaller steps to reduce mental effort."},
    ],
    "medium": [
        {"type": "focus",    "title": "Enable focus mode",
         "reason": "You're in a moderate-load zone — minimizing distractions can keep you there."},
        {"type": "font",     "title": "Increase font size",
         "reason": "Easier readability reduces unnecessary cognitive strain."},
        {"type": "water",    "title": "Stay hydrated",
         "reason": "A quick water break can prevent load from climbing."},
    ],
    "low": [
        {"type": "difficulty", "title": "Try a harder task",
         "reason": "You're in low-load state — a good time to tackle complex problems."},
        {"type": "focus",      "title": "Batch similar tasks",
         "reason": "Group related work now while your cognitive load is light."},
    ],
}


def get_recommendations(
    load_level: str,
    payload: BehaviorPayload | None = None,
) -> list[Recommendation]:
    """
    Return ordered recommendations for the given load level.
    payload is used for signal-based filtering (future: ML ranking).
    """
    base = RULES.get(load_level, RULES["medium"])

    # Signal-based prioritization
    if payload and load_level == "high":
        ordered = sorted(
            base,
            key=lambda r: _priority(r["type"], payload),
            reverse=True,
        )
        return [Recommendation(**r) for r in ordered[:3]]

    return [Recommendation(**r) for r in base]


def _priority(rec_type: str, p: BehaviorPayload) -> float:
    """Score a recommendation type by how relevant the current signals are."""
    if rec_type == "break"    and p.idle_time_pct > 0.3:  return 3.0
    if rec_type == "break"    and p.typing_wpm < 25:       return 2.5
    if rec_type == "notify"   and p.pause_count > 6:       return 2.0
    if rec_type == "simplify" and p.error_rate > 0.10:     return 1.8
    if rec_type == "water":                                 return 1.0
    return 0.5
