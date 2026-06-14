import io
import sys
from pathlib import Path

from PIL import Image
import imagehash

IMG_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff", ".tif", ".gif"}
PDF_EXTS = {".pdf"}


# load just the first page of a pdf
def _load_pdf_page(file_path: Path, dpi: int = 200) -> Image.Image:
    from pdf2image import convert_from_path
    pages = convert_from_path(file_path, dpi=dpi, first_page=1, last_page=1)
    if not pages:
        raise ValueError(f"Could not render PDF: {file_path}")
    return pages[0]


# load all pages of a pdf as a list of PIL images
def _load_pdf_all(file_path: Path, dpi: int = 200) -> list:
    from pdf2image import convert_from_path
    pages = convert_from_path(file_path, dpi=dpi)
    if not pages:
        raise ValueError(f"Could not render PDF: {file_path}")
    return pages


# compute dual hash (pHash + dHash) for a single image
def _dual_hash_image(img, hash_size: int = 16) -> str:
    ph = str(imagehash.phash(img, hash_size=hash_size))
    dh = str(imagehash.dhash(img, hash_size=hash_size))
    return f"{ph}|{dh}"


# compute dual perceptual hash for an image or pdf
# returns "phash|dhash" for images
# returns "phash1|dhash1:phash2|dhash2:..." for multi-page pdfs
def compute_phash(src, hash_size: int = 16) -> str:
    print(f"[phash] extracting dual hash (hash_size={hash_size})...")

    if isinstance(src, (str, Path)):
        p = Path(src)
        if not p.exists():
            raise FileNotFoundError(f"File not found: {p}")

        ext = p.suffix.lower()
        if ext in PDF_EXTS:
            # pdf: dual hash every page and join with colons
            pages = _load_pdf_all(p)
            result = ":".join(_dual_hash_image(pg, hash_size=hash_size) for pg in pages)
            print(f"[phash] pdf dual hash ({len(pages)} pages): {result}")
            return result
        img = Image.open(p)

    elif isinstance(src, Image.Image):
        img = src
    elif isinstance(src, (bytes, bytearray)):
        img = Image.open(io.BytesIO(src))
    else:
        raise ValueError(f"Unsupported type: {type(src)}")

    result = _dual_hash_image(img, hash_size=hash_size)
    print(f"[phash] dual hash result: {result}")
    return result


# simulate jpeg compression to mimic what whatsapp / social media does
def simulate_compression(src, quality: int = 40) -> Image.Image:
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

    # convert to rgb so jpeg encoding works
    img = img.convert("RGB")
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=quality)
    buf.seek(0)
    compressed = Image.open(buf)
    compressed.load()
    return compressed


# compute hamming distance for a single pair of hex hash strings
def _single_hamming(hex_a: str, hex_b: str) -> int:
    return imagehash.hex_to_hash(hex_a) - imagehash.hex_to_hash(hex_b)


# count the number of differing bits between two dual hashes
# dual hash format: "phash|dhash"
# returns max(phash_distance, dhash_distance)
# for multi-page (colon-separated), returns the worst across all pages
def hamming_distance(hash_a: str, hash_b: str) -> int:
    # split by pages first
    pages_a = hash_a.split(":")
    pages_b = hash_b.split(":")

    # mismatched page counts
    if len(pages_a) != len(pages_b):
        return 9999

    max_dist = 0
    for page_a, page_b in zip(pages_a, pages_b):
        # split each page into phash and dhash components
        parts_a = page_a.split("|")
        parts_b = page_b.split("|")

        if len(parts_a) == 2 and len(parts_b) == 2:
            # dual hash: max of phash distance and dhash distance
            ph_dist = _single_hamming(parts_a[0], parts_b[0])
            dh_dist = _single_hamming(parts_a[1], parts_b[1])
            page_dist = max(ph_dist, dh_dist)
        elif len(parts_a) == 1 and len(parts_b) == 1:
            # legacy single hash (backward compatibility)
            page_dist = _single_hamming(parts_a[0], parts_b[0])
        else:
            # format mismatch
            return 9999

        if page_dist > max_dist:
            max_dist = page_dist

    print(f"[hamming] dual distance is {max_dist}")
    return max_dist


def run_comparison(img_path: str, quality: int = 40) -> None:
    orig_hash = compute_phash(img_path)
    comp_hash = compute_phash(simulate_compression(img_path, quality=quality))

    dist = hamming_distance(orig_hash, comp_hash)

    # extract just the phash part for bit count
    first_ph = orig_hash.split(":")[0].split("|")[0]
    max_bits = len(imagehash.hex_to_hash(first_ph).hash.flatten())

    similarity = (1 - dist / max_bits) * 100

    # thresholds: <=10 match, <=20 uncertain, else no match
    if dist <= 10:
        verdict = "MATCH"
    elif dist <= 20:
        verdict = "UNCERTAIN"
    else:
        verdict = "NO MATCH"

    print(f"original   : {orig_hash}")
    if ":" in orig_hash:
        print(f"  ({orig_hash.count(':') + 1} pages hashed)")
    print(f"compressed : {comp_hash}")
    print(f"distance   : {dist}/{max_bits} bits ({similarity:.1f}% similar)")
    print(f"verdict    : {verdict}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python phash_generator.py <image_or_pdf_path> [quality]")
        sys.exit(1)

    run_comparison(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 40)
