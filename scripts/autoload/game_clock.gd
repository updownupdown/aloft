extends Node
## Autoload singleton tracking time-of-day for the day/night cycle.
## Other scenes read `time_of_day` (0.0-1.0, 0 = midnight, 0.5 = noon)
## instead of each maintaining their own clock.

signal time_changed(time_of_day: float)

@export var day_length_seconds: float = 240.0
@export var start_time_of_day: float = 0.3

var time_of_day: float = 0.0

func _ready() -> void:
	time_of_day = start_time_of_day

func _process(delta: float) -> void:
	time_of_day = fmod(time_of_day + delta / day_length_seconds, 1.0)
	time_changed.emit(time_of_day)

## Returns 0.0 at midnight, 1.0 at noon, smoothly interpolated.
func get_daylight_amount() -> float:
	return (cos((time_of_day - 0.5) * TAU) + 1.0) * 0.5
