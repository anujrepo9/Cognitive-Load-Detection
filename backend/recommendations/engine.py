"""
recommendations/engine.py — Rule-based recommendation engine.
Maps cognitive load level + behavioral signals → actionable suggestions.
"""

from api.schemas import BehaviorPayload, Recommendation


RULES: dict[str, list[dict]] = {

    "high": [
        {
            "type": "break",
            "title": "Take a 5-minute break",
            "reason": "Your typing speed has dropped and idle time is high — a short rest resets focus."
        },
        {
            "type": "water",
            "title": "Drink some water",
            "reason": "Dehydration can affect cognitive performance. Take a short hydration break."
        },
        {
            "type": "notify",
            "title": "Mute notifications",
            "reason": "Reducing interruptions can lower cognitive load and improve concentration."
        },
        {
            "type": "simplify",
            "title": "Simplify your current task",
            "reason": "Break the task into smaller steps to reduce mental effort."
        },
        {
            "type": "close_apps",
            "title": "Close unnecessary applications",
            "reason": "Reducing screen clutter and unused applications can make it easier to focus."
        },
        {
            "type": "prioritize",
            "title": "Prioritize your tasks",
            "reason": "Focus on the most important task first instead of handling multiple tasks simultaneously."
        },
        {
            "type": "multitask",
            "title": "Reduce multitasking",
            "reason": "Working on fewer tasks at once reduces mental switching and cognitive effort."
        },
        {
            "type": "task_breakdown",
            "title": "Break the task into smaller steps",
            "reason": "Smaller steps make complex work easier to understand and manage."
        },
        {
            "type": "clutter",
            "title": "Reduce screen clutter",
            "reason": "Removing unnecessary windows and information reduces visual and mental distractions."
        },
    ],

    "medium": [
        {
            "type": "focus",
            "title": "Enable focus mode",
            "reason": "You're in a moderate-load zone — minimizing distractions can keep you there."
        },
        {
            "type": "font",
            "title": "Increase font size",
            "reason": "Easier readability reduces unnecessary cognitive strain."
        },
        {
            "type": "water",
            "title": "Stay hydrated",
            "reason": "A quick water break can help prevent cognitive load from increasing."
        },
        {
            "type": "batch",
            "title": "Batch similar tasks",
            "reason": "Grouping related work reduces unnecessary task switching."
        },
        {
            "type": "organize",
            "title": "Organize information clearly",
            "reason": "A well-organized workspace makes information easier to process."
        },
        {
            "type": "notifications",
            "title": "Reduce unnecessary notifications",
            "reason": "Fewer interruptions help maintain concentration and reduce mental distractions."
        },
        {
            "type": "automation",
            "title": "Automate repetitive tasks",
            "reason": "Automating repetitive work reduces unnecessary mental effort and saves time."
        },
        {
            "type": "goals",
            "title": "Set a clear task goal",
            "reason": "A clear objective helps you stay focused on what needs to be completed."
        },
    ],

    "low": [
        {
            "type": "difficulty",
            "title": "Try a harder task",
            "reason": "You're in a low-load state — a good time to tackle complex problems."
        },
        {
            "type": "focus",
            "title": "Batch similar tasks",
            "reason": "Group related work now while your cognitive load is light."
        },
        {
            "type": "shortcuts",
            "title": "Use keyboard shortcuts",
            "reason": "Keyboard shortcuts can reduce repetitive actions and make workflows more efficient."
        },
        {
            "type": "automation",
            "title": "Automate repetitive tasks",
            "reason": "Use your available mental capacity to improve your workflow through automation."
        },
        {
            "type": "planning",
            "title": "Plan your upcoming tasks",
            "reason": "Low cognitive load is a good time to organize and plan future work."
        },
        {
            "type": "learning",
            "title": "Learn something new",
            "reason": "Your current cognitive load allows you to spend time on learning or skill development."
        },
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
    if rec_type == "break"    and p.idle_time_pct > 0.3:    return 3.0
    if rec_type == "break"    and p.typing_wpm < 25:        return 2.5
    if rec_type == "notify"   and p.pause_count > 6:        return 2.0
    if rec_type == "simplify" and p.error_rate > 0.10:      return 1.8
    if rec_type == "water":                                 return 1.0
    return 0.5
