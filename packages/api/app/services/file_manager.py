import mimetypes
import os
import zipfile
from io import BytesIO
from pathlib import Path

from app.config import settings


def _workspace() -> Path:
    return Path(settings.workspace_dir)


def _safe_resolve(base: Path, user_path: str) -> Path:
    resolved = (base / user_path).resolve()
    if not str(resolved).startswith(str(base.resolve())):
        raise ValueError("Path traversal detected")
    return resolved


def list_directory(rel_path: str = "") -> list[dict]:
    base = _workspace()
    target = _safe_resolve(base, rel_path)
    if not target.is_dir():
        return []
    entries = []
    for item in sorted(target.iterdir()):
        stat = item.stat()
        entries.append({
            "name": item.name,
            "path": str(item.relative_to(base)),
            "type": "directory" if item.is_dir() else "file",
            "size": stat.st_size if item.is_file() else 0,
            "modified": stat.st_mtime,
        })
    return entries


def read_file(rel_path: str) -> tuple[str, int]:
    base = _workspace()
    target = _safe_resolve(base, rel_path)
    if not target.is_file():
        raise FileNotFoundError(f"File not found: {rel_path}")
    content = target.read_text(encoding="utf-8", errors="replace")
    return content, target.stat().st_size


def write_file(rel_path: str, content: str) -> int:
    base = _workspace()
    target = _safe_resolve(base, rel_path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")
    return target.stat().st_size


def delete_file(rel_path: str) -> bool:
    base = _workspace()
    target = _safe_resolve(base, rel_path)
    if not target.exists():
        return False
    if target.is_dir():
        import shutil
        shutil.rmtree(target)
    else:
        target.unlink()
    return True


def rename_file(old_path: str, new_path: str) -> bool:
    base = _workspace()
    src = _safe_resolve(base, old_path)
    dst = _safe_resolve(base, new_path)
    if not src.exists():
        return False
    dst.parent.mkdir(parents=True, exist_ok=True)
    src.rename(dst)
    return True


def save_upload(filename: str, data: bytes, subdir: str = "uploads") -> str:
    base = _workspace()
    upload_dir = base / subdir
    upload_dir.mkdir(parents=True, exist_ok=True)
    target = _safe_resolve(upload_dir, filename)
    target.write_bytes(data)
    return str(target.relative_to(base))


def get_download_path(rel_path: str) -> Path:
    base = _workspace()
    target = _safe_resolve(base, rel_path)
    if not target.is_file():
        raise FileNotFoundError(f"File not found: {rel_path}")
    return target


def get_mimetype(rel_path: str) -> str:
    mime, _ = mimetypes.guess_type(rel_path)
    return mime or "application/octet-stream"


def create_zip(paths: list[str]) -> BytesIO:
    base = _workspace()
    buf = BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for p in paths:
            target = _safe_resolve(base, p)
            if target.is_file():
                zf.write(target, arcname=target.name)
    buf.seek(0)
    return buf


def search_files(query: str, rel_path: str = "") -> list[dict]:
    base = _workspace()
    target = _safe_resolve(base, rel_path)
    results = []
    if not target.is_dir():
        return results
    query_lower = query.lower()
    for root, dirs, files in os.walk(target):
        for fname in files:
            fpath = Path(root) / fname
            rel = str(fpath.relative_to(base))
            if query_lower in fname.lower():
                results.append({"path": rel, "matches": [f"filename: {fname}"]})
                continue
            if fpath.stat().st_size < 1_000_000:
                try:
                    text = fpath.read_text(encoding="utf-8", errors="ignore")
                    lines = [
                        line.strip()
                        for line in text.splitlines()
                        if query_lower in line.lower()
                    ]
                    if lines:
                        results.append({"path": rel, "matches": lines[:5]})
                except Exception:
                    pass
    return results
