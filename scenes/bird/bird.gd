class_name Bird
extends CharacterBody2D

@export var flap_impulse: float = 220.0
@export var gravity: float = 260.0
@export var max_fall_speed: float = 300.0
@export var steer_accel: float = 320.0
@export var max_air_speed: float = 220.0
@export var water_damping: float = 6.0
@export var thermal_lift: float = 180.0

@onready var _detection_area: Area2D = $DetectionArea

var _touch_controller: TouchController
var _in_water: bool = false
var _thermal_count: int = 0

func _ready() -> void:
	add_to_group("bird")
	_detection_area.area_entered.connect(_on_area_entered)
	_detection_area.area_exited.connect(_on_area_exited)
	_touch_controller = get_tree().get_first_node_in_group("touch_controller")
	if _touch_controller:
		_touch_controller.flap_requested.connect(_on_flap_requested)

func _physics_process(delta: float) -> void:
	if _in_water:
		velocity = velocity.lerp(Vector2.ZERO, clamp(water_damping * delta, 0.0, 1.0))
	else:
		velocity.y += gravity * delta
		if _thermal_count > 0:
			velocity.y -= thermal_lift * delta

	if _touch_controller and _touch_controller.is_steering:
		var steer: Vector2 = _touch_controller.steer_vector
		velocity += steer * steer_accel * delta
		velocity = velocity.limit_length(max_air_speed)
		rotation = lerp_angle(rotation, steer.angle(), 5.0 * delta)

	velocity.y = min(velocity.y, max_fall_speed)
	move_and_slide()

func _on_flap_requested() -> void:
	if not _in_water:
		velocity.y = -flap_impulse
	else:
		velocity.y = -flap_impulse * 0.5

func _on_area_entered(area: Area2D) -> void:
	if area.is_in_group("water"):
		_in_water = true
	elif area.is_in_group("thermal"):
		_thermal_count += 1

func _on_area_exited(area: Area2D) -> void:
	if area.is_in_group("water"):
		_in_water = false
	elif area.is_in_group("thermal"):
		_thermal_count = max(0, _thermal_count - 1)
