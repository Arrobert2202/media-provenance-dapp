import io
import sys
from pathlib import Path

from PIL import Image
import imagehash

IMG_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff", ".tif", ".gif"}
PDF_EXTS = {".pdf"}


def _load_pdf_page(file_path: Path, dpi: int = 200) -> Image.Image:
    """Render the first page of a PDF as a PIL Image."""
    from pdf2image import convert_from_path
    pages = convert_from_path(file_path, dpi=dpi, first_page=1, last_page=1)
    if not pages:
        raise ValueError(f"Could not render PDF: {file_path}")
    return pages[0]


def _load_pdf_all(file_path: Path, dpi: int = 200) -> list:
    """Render all pages of a PDF as PIL Images."""
    from pdf2image import convert_from_path
    pages = convert_from_path(file_path, dpi=dpi)
    if not pages:
        raise ValueError(f"Could not render PDF: {file_path}")
    return pages


def compute_phash(src, hash_size: int = 16) -> str:
    """
    Compute perceptual hash for an image or PDF.

    PDFs return colon-separated per-page hashes: "h1:h2:...:hN".
    Images return a single hash string.
    """
    if isinstance(src, (str, Path)):
        p = Path(src)
        if not p.exists():
            raise FileNotFoundError(f"File not found: {p}")

        ext = p.suffix.lower()
        if ext in PDF_EXTS:
            pages = _load_pdf_all(p)
            return ":".join(str(imagehash.phash(pg, hash_size=hash_size)) for pg in pages)
        img = Image.open(p)

    elif isinstance(src, Image.Image):
        img = src
    elif isinstance(src, (bytes, bytearray)):
        img = Image.open(io.BytesIO(src))
    else:
        raise ValueError(f"Unsupported type: {type(src)}")

    return str(imagehash.phash(img, hash_size=hash_size))


def simulate_compression(src, quality: int = 40) -> Image.Image:
    """Simulate JPEG compression on an image (or first page of a PDF)."""
    if isinstance(src, (str, Path)):
        p = Path(src)
        if p.suffix.lower() in PDF_EXTS:
            img = _load_pdf_all(p)[0]
        else:
            img = Image.open(src)
    elif isinstance(src, Image.Image):
        img = src
    else:
        raise ValueError("src must be a file path or PIL.Image")

    img = img.convert("RGB")
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=quality)
    buf.seek(0)
    compressed = Image.open(buf)
    compressed.load()
    return compressed


def hamming_distance(hash_a: str, hash_b: str) -> int:
    """
    Hamming distance between two hashes.

    Multi-page (colon-separated) hashes return the max distance across pages.
    Mismatched page counts return 9999.
    """
    parts_a = hash_a.split(":")
    parts_b = hash_b.split(":")

    if len(parts_a) == 1 and len(parts_b) == 1:
        return imagehash.hex_to_hash(hash_a) - imagehash.hex_to_hash(hash_b)

    if len(parts_a) != len(parts_b):
        return 9999

    return max(
        imagehash.hex_to_hash(a) - imagehash.hex_to_hash(b)
        for a, b in zip(parts_a, parts_b)
    )


def run_comparison(img_path: str, quality: int = 40) -> None:
    orig_hash = compute_phash(img_path)
    comp_hash = compute_phash(simulate_compression(img_path, quality=quality))

    first_orig = orig_hash.split(":")[0]
    first_comp = comp_hash.split(":")[0] if ":" in comp_hash else comp_hash

    dist = imagehash.hex_to_hash(first_orig) - imagehash.hex_to_hash(first_comp)
    max_bits = len(imagehash.hex_to_hash(first_orig).hash.flatten())
    similarity = (1 - dist / max_bits) * 100

    if dist <= 10:
        verdict = "MATCH"
    elif dist <= 20:
        verdict = "UNCERTAIN"
    else:
        verdict = "NO MATCH"

    print(f"original   : {orig_hash}")
    if ":" in orig_hash:
        print(f"  ({orig_hash.count(':') + 1} pages hashed)")
    print(f"compressed : {first_comp} (page 1 only)")
    print(f"distance   : {dist}/{max_bits} bits ({similarity:.1f}% similar)")
    print(f"verdict    : {verdict}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python phash_generator.py <image_or_pdf_path> [quality]")
        sys.exit(1)

    run_comparison(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 40)
