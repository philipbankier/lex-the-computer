import asyncio
import os
import shutil
from pathlib import Path

import aiofiles
from fastapi import APIRouter, Depends, Query, UploadFile, File, Form
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel

from app.config import settings
from app.middleware.auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/api/files", tags=["files"])

WORKSPACE_DIR = Path(settings.workspace_dir)


def safe_resolve(p: str) -> Path:
    abs_path = (WORKSPACE_DIR / (p or ".")).resolve()
    if not str(abs_path).startswith(str(WORKSPACE_DIR.resolve())):
        raise ValueError("invalid path")
    return abs_path


class FileWrite(BaseModel):
    path: str
    content: str = ""


class FileRename(BaseModel):
    path: str
    newPath: str


class FileDelete(BaseModel):
    path: str


class MkdirRequest(BaseModel):
    path: str


@router.get("/")
async def list_directory(path: str = Query(""), user: User = Depends(get_current_user)):
    dir_path = safe_resolve(path)
    entries = []
    try:
        for entry in dir_path.iterdir():
            st = entry.stat()
            entries.append({
                "name": entry.name,
                "path": str(entry.relative_to(WORKSPACE_DIR)),
                "type": "dir" if entry.is_dir() else "file",
                "size": st.st_size,
                "modified": st.st_mtime,
            })
    except Exception as e:
        return {"error": str(e)}, 400
    return {"entries": entries}


@router.get("/content")
async def read_file(path: str = Query(""), user: User = Depends(get_current_user)):
    abs_path = safe_resolve(path)
    try:
        async with aiofiles.open(abs_path, "r") as f:
            data = await f.read()
    except Exception:
        return {"error": "read failed"}, 404
    snippet = data[:8000]
    return {"path": path, "length": len(data), "snippet": snippet}


@router.post("/content")
async def write_file(body: FileWrite, user: User = Depends(get_current_user)):
    abs_path = safe_resolve(body.path)
    abs_path.parent.mkdir(parents=True, exist_ok=True)
    async with aiofiles.open(abs_path, "w") as f:
        await f.write(body.content)
    return {"ok": True}


@router.patch("/content")
async def rename_file(body: FileRename, user: User = Depends(get_current_user)):
    src = safe_resolve(body.path)
    dest = safe_resolve(body.newPath)
    dest.parent.mkdir(parents=True, exist_ok=True)
    await asyncio.to_thread(src.rename, dest)
    return {"ok": True}


@router.delete("/")
async def delete_file(body: FileDelete, user: User = Depends(get_current_user)):
    abs_path = safe_resolve(body.path)
    if abs_path.is_dir():
        shutil.rmtree(abs_path, ignore_errors=True)
    else:
        abs_path.unlink(missing_ok=True)
    return {"ok": True}


@router.post("/mkdir")
async def mkdir(body: MkdirRequest, user: User = Depends(get_current_user)):
    abs_path = safe_resolve(body.path)
    abs_path.mkdir(parents=True, exist_ok=True)
    return {"ok": True}


@router.post("/upload")
async def upload_files(
    dir: str = Form(""),
    files: list[UploadFile] = File(...),
    user: User = Depends(get_current_user),
):
    target_dir = safe_resolve(dir)
    target_dir.mkdir(parents=True, exist_ok=True)
    results = []
    for f in files:
        dest = target_dir / (f.filename or "upload.bin")
        if not str(dest.resolve()).startswith(str(WORKSPACE_DIR.resolve())):
            continue
        content = await f.read()
        async with aiofiles.open(dest, "wb") as out:
            await out.write(content)
        results.append({"name": f.filename, "path": str(dest.relative_to(WORKSPACE_DIR)), "size": len(content)})
    return {"uploaded": results}


@router.get("/download")
async def download_file(path: str = Query(""), user: User = Depends(get_current_user)):
    abs_path = safe_resolve(path)
    if not abs_path.is_file():
        return {"error": "not a file"}, 400
    return FileResponse(abs_path, filename=abs_path.name)


@router.get("/download-zip")
async def download_zip(path: str = Query(""), user: User = Depends(get_current_user)):
    dir_path = safe_resolve(path)
    if not dir_path.is_dir():
        return {"error": "not a directory"}, 400

    base = dir_path.name or "archive"
    proc = await asyncio.create_subprocess_exec(
        "tar", "-czf", "-", "-C", str(dir_path.parent), dir_path.name,
        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
    )
    stdout, _ = await proc.communicate()
    return StreamingResponse(
        iter([stdout]),
        media_type="application/gzip",
        headers={"Content-Disposition": f'attachment; filename="{base}.tar.gz"'},
    )


@router.get("/search")
async def search_files(
    q: str = Query(""),
    type: str = Query("content"),
    user: User = Depends(get_current_user),
):
    if not q:
        return {"results": []}

    if type == "filename":
        results = []
        for root, dirs, files_list in os.walk(WORKSPACE_DIR):
            dirs[:] = [d for d in dirs if not d.startswith(".")]
            for name in files_list:
                if q.lower() in name.lower():
                    full = Path(root) / name
                    results.append({"path": str(full.relative_to(WORKSPACE_DIR))})
        return {"results": results}
    else:
        proc = await asyncio.create_subprocess_exec(
            "grep", "-RIn", "--exclude-dir=.git", q, str(WORKSPACE_DIR),
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await proc.communicate()
        lines = stdout.decode(errors="replace").strip().split("\n")
        results = []
        for line in lines:
            if not line:
                continue
            parts = line.split(":", 2)
            if len(parts) >= 3:
                file_path, line_no, text = parts[0], parts[1], parts[2]
                results.append({
                    "path": str(Path(file_path).relative_to(WORKSPACE_DIR)),
                    "line": int(line_no) if line_no.isdigit() else 0,
                    "text": text,
                })
        return {"results": results}
