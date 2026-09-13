class_name DayNightCycle
extends CanvasModulate

@export var night_color: Color = Color(0.18, 0.2, 0.35)
@export var day_color: Color = Color(1, 1, 1)

func _ready() -> void:
	GameClock.time_changed.connect(_on_time_changed)
	_on_time_changed(GameClock.time_of_day)

func _on_time_changed(_time_of_day: float) -> void:
	var daylight := GameClock.get_daylight_amount()
	color = night_color.lerp(day_color, daylight)
