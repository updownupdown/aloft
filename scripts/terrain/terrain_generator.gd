class_name TerrainGenerator
extends RefCounted
## Stateless procedural terrain generation. Heights are sampled by *global*
## tile index (not chunk-relative), so adjacent chunks always tile seamlessly.

const TILE_SIZE: int = 16
const CHUNK_WIDTH_TILES: int = 32
const SEA_LEVEL_Y: float = 0.0
const GROUND_BOTTOM_Y: float = 2000.0

static var _noise: FastNoiseLite

static func _get_noise() -> FastNoiseLite:
	if _noise == null:
		_noise = FastNoiseLite.new()
		_noise.seed = 1337
		_noise.noise_type = FastNoiseLite.TYPE_PERLIN
		_noise.frequency = 0.008
		_noise.fractal_octaves = 3
		_noise.fractal_lacunarity = 2.0
		_noise.fractal_gain = 0.5
	return _noise

## Returns world-space surface Y (pixels) for each of CHUNK_WIDTH_TILES + 1
## tile columns in the given chunk. Negative Y = hill above sea level;
## positive Y = basin below sea level (gets filled with water).
static func generate_heights(chunk_index: int) -> PackedFloat32Array:
	var noise := _get_noise()
	var heights := PackedFloat32Array()
	var start_tile := chunk_index * CHUNK_WIDTH_TILES
	for i in range(CHUNK_WIDTH_TILES + 1):
		var global_tile := start_tile + i
		var n := noise.get_noise_1d(float(global_tile))
		var elevation_tiles: float = n * 8.0 + 3.0
		heights.append(-elevation_tiles * TILE_SIZE)
	return heights
