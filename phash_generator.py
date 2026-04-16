import io
import sys
from pathlib import Path

from PIL import Image
import imagehash


def compute_phash(image_source, hash_size: int = 16) -> str:
    if isinstance(image_source, (str, Path)):
        path = Path(image_source)
        if not path.exists():
            raise FileNotFoundError(f"Image not found: {path}")
        img = Image.open(path)
    elif isinstance(image_source, Image.Image):
        img = image_source
    elif isinstance(image_source, (bytes, bytearray)):
        img = Image.open(io.BytesIO(image_source))
    else:
        raise ValueError(
            f"Unsupported type: {type(image_source)}. Expected str, Path, PIL.Image, or bytes."
        )

    return str(imagehash.phash(img, hash_size=hash_size))


def simulate_compression(image_source, quality: int = 40) -> Image.Image:
    if isinstance(image_source, (str, Path)):
        img = Image.open(image_source)
    elif isinstance(image_source, Image.Image):
        img = image_source
    else:
        raise ValueError("image_source must be a file path or PIL.Image.Image")

    img = img.convert("RGB")
    buffer = io.BytesIO()
    img.save(buffer, format="JPEG", quality=quality)
    buffer.seek(0)
    compressed = Image.open(buffer)
    compressed.load()
    return compressed


def hamming_distance(hash_a: str, hash_b: str) -> int:
    return imagehash.hex_to_hash(hash_a) - imagehash.hex_to_hash(hash_b)


def run_comparison(image_path: str, compression_quality: int = 40) -> None:
    original_hash   = compute_phash(image_path)
    compressed_hash = compute_phash(simulate_compression(image_path, quality=compression_quality))

    distance       = hamming_distance(original_hash, compressed_hash)
    max_bits       = len(imagehash.hex_to_hash(original_hash).hash.flatten())
    similarity_pct = (1 - distance / max_bits) * 100

    if distance <= 10:
        verdict = "MATCH"
    elif distance <= 20:
        verdict = "UNCERTAIN"
    else:
        verdict = "NO MATCH"

    print(f"original   : {original_hash}")
    print(f"compressed : {compressed_hash}")
    print(f"distance   : {distance}/{max_bits} bits ({similarity_pct:.1f}% similar)")
    print(f"verdict    : {verdict}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python phash_generator.py <image_path> [quality]")
        sys.exit(1)

    run_comparison(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 40)
