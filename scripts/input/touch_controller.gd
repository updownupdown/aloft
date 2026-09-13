class_name TouchController
extends Node
## Full-screen input: a quick tap flaps the wings; a press-and-drag steers.
## Only handles InputEventScreenTouch/Drag — desktop mouse is turned into
## those automatically via the `pointing/emulate_touch_from_mouse` project
## setting, so this one code path drives both touch and mouse.

signal flap_requested()

@export var drag_deadzone_px: float = 12.0
@export var max_drag_px: float = 96.0
@export var tap_max_duration: float = 0.25

var steer_vector: Vector2 = Vector2.ZERO
var is_steering: bool = false

var _touch_index: int = -1
var _start_pos: Vector2 = Vector2.ZERO
var _start_time: float = 0.0
var _dragged_past_deadzone: bool = false

func _ready() -> void:
	add_to_group("touch_controller")

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		_handle_touch(event as InputEventScreenTouch)
	elif event is InputEventScreenDrag:
		_handle_drag(event as InputEventScreenDrag)

func _handle_touch(touch_event: InputEventScreenTouch) -> void:
	if touch_event.pressed:
		if _touch_index == -1:
			_touch_index = touch_event.index
			_start_pos = touch_event.position
			_start_time = Time.get_ticks_msec() / 1000.0
			_dragged_past_deadzone = false
			steer_vector = Vector2.ZERO
			is_steering = false
	else:
		if touch_event.index == _touch_index:
			var duration := Time.get_ticks_msec() / 1000.0 - _start_time
			if not _dragged_past_deadzone and duration <= tap_max_duration:
				flap_requested.emit()
			_touch_index = -1
			steer_vector = Vector2.ZERO
			is_steering = false

func _handle_drag(drag_event: InputEventScreenDrag) -> void:
	if drag_event.index != _touch_index:
		return
	var delta := drag_event.position - _start_pos
	if delta.length() > drag_deadzone_px:
		_dragged_past_deadzone = true
		is_steering = true
		var clamped_len: float = clamp(delta.length(), 0.0, max_drag_px)
		steer_vector = delta.normalized() * (clamped_len / max_drag_px)
