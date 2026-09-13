class_name World
extends Node2D
## Loads/unloads terrain chunks in a window around the bird as it flies.

const ChunkScene := preload("res://scenes/world/chunk.tscn")
const TerrainGeneratorScript = preload("res://scripts/terrain/terrain_generator.gd")

@export var load_radius_chunks: int = 3

var _loaded_chunks: Dictionary = {}
var _bird: Node2D

func _process(_delta: float) -> void:
	if _bird == null:
		_bird = get_tree().get_first_node_in_group("bird")
		if _bird == null:
			return

	var chunk_width_px := TerrainGeneratorScript.CHUNK_WIDTH_TILES * TerrainGeneratorScript.TILE_SIZE
	var current_index := int(floor(_bird.position.x / chunk_width_px))

	var needed: Dictionary = {}
	for i in range(current_index - load_radius_chunks, current_index + load_radius_chunks + 1):
		needed[i] = true
		if not _loaded_chunks.has(i):
			_spawn_chunk(i)

	for i in _loaded_chunks.keys():
		if not needed.has(i):
			_despawn_chunk(i)

func _spawn_chunk(index: int) -> void:
	var chunk: TerrainChunk = ChunkScene.instantiate()
	add_child(chunk)
	chunk.setup(index)
	_loaded_chunks[index] = chunk

func _despawn_chunk(index: int) -> void:
	var chunk: Node = _loaded_chunks[index]
	chunk.queue_free()
	_loaded_chunks.erase(index)
