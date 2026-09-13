class_name TerrainChunk
extends Node2D

const TerrainGeneratorScript = preload("res://scripts/terrain/terrain_generator.gd")

var chunk_index: int = 0

func setup(index: int) -> void:
	chunk_index = index
	var width_px := TerrainGeneratorScript.CHUNK_WIDTH_TILES * TerrainGeneratorScript.TILE_SIZE
	position.x = index * width_px
	_build()

func _build() -> void:
	var heights := TerrainGeneratorScript.generate_heights(chunk_index)
	var width_px := TerrainGeneratorScript.CHUNK_WIDTH_TILES * TerrainGeneratorScript.TILE_SIZE
	var sea_level := TerrainGeneratorScript.SEA_LEVEL_Y
	var tile_size := TerrainGeneratorScript.TILE_SIZE

	var has_water := false
	for h in heights:
		if h > sea_level:
			has_water = true
			break

	var ground_points := PackedVector2Array()
	for i in range(heights.size()):
		ground_points.append(Vector2(i * tile_size, heights[i]))
	ground_points.append(Vector2(width_px, TerrainGeneratorScript.GROUND_BOTTOM_Y))
	ground_points.append(Vector2(0, TerrainGeneratorScript.GROUND_BOTTOM_Y))

	var ground_poly := Polygon2D.new()
	ground_poly.polygon = ground_points
	ground_poly.color = Color(0.42, 0.29, 0.18)
	add_child(ground_poly)

	var ground_body := StaticBody2D.new()
	var ground_shape := CollisionPolygon2D.new()
	ground_shape.polygon = ground_points
	ground_body.add_child(ground_shape)
	add_child(ground_body)

	if has_water:
		var water_points := PackedVector2Array()
		for i in range(heights.size()):
			water_points.append(Vector2(i * tile_size, sea_level))
		for i in range(heights.size() - 1, -1, -1):
			water_points.append(Vector2(i * tile_size, max(heights[i], sea_level)))

		var water_poly := Polygon2D.new()
		water_poly.polygon = water_points
		water_poly.color = Color(0.2, 0.5, 0.8, 0.75)
		add_child(water_poly)

		var water_area := Area2D.new()
		water_area.add_to_group("water")
		var water_shape := CollisionPolygon2D.new()
		water_shape.polygon = water_points
		water_area.add_child(water_shape)
		add_child(water_area)
