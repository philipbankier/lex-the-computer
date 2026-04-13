import asyncio
from pathlib import Path

import aiofiles
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel

from app.config import settings
from app.middleware.auth import get_current_user
from app.models.user import User
from app.services import file_manager

router = APIRouter(prefix="/api/files", tags=["files"])

WORKSPACE_DIR = Path(settings.workspace_dir)


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
    try:
        entries = file_manager.list_directory(path)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid path")
    return {"entries": entries}


@router.get("/content")
async def read_file(path: str = Query(""), user: User = Depends(get_current_user)):
    try:
        content, size = file_manager.read_file(path)
    except (FileNotFoundError, ValueError) as e:
        raise HTTPException(status_code=404, detail=str(e))
    snippet = content[:8000]
    return {"path": path, "length": len(content), "snippet": snippet}


@router.post("/content")
async def write_file(body: FileWrite, user: User = Depends(get_current_user)):
    try:
        file_manager.write_file(body.path, body.content)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid path")
    return {"ok": True}


@router.patch("/content")
async def rename_file(body: FileRename, user: User = Depends(get_current_user)):
    try:
        file_manager.rename_file(body.path, body.newPath)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid path")
    return {"ok": True}


@router.delete("/")
async def delete_file(body: FileDelete, user: User = Depends(get_current_user)):
    try:
        file_manager.delete_file(body.path)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid path")
    return {"ok": True}


@router.post("/mkdir")
async def mkdir(body: MkdirRequest, user: User = Depends(get_current_user)):
    try:
        abs_path = (WORKSPACE_DIR / body.path).resolve()
        if not str(abs_path).startswith(str(WORKSPACE_DIR.resolve())):
            raise HTTPException(status_code=400, detail="Invalid path")
        abs_path.mkdir(parents=True, exist_ok=True)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid path")
    return {"ok": True}


@router.post("/upload")
async def upload_files(
    dir: str = Form(""),
    files: list[UploadFile] = File(...),
    user: User = Depends(get_current_user),
):
    results = []
    for f in files:
        content = await f.read()
        rel_path = file_manager.save_upload(f.filename or "upload.bin", content, subdir=dir or "uploads")
        results.append({"name": f.filename, "path": rel_path, "size": len(content)})
    return {"uploaded": results}


@router.get("/download")
async def download_file(path: str = Query(""), user: User = Depends(get_current_user)):
    try:
        abs_path = file_manager.get_download_path(path)
    except (FileNotFoundError, ValueError):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(abs_path, filename=abs_path.name)


@router.get("/download-zip")
async def download_zip(path: str = Query(""), user: User = Depends(get_current_user)):
    abs_path = (WORKSPACE_DIR / path).resolve()
    if not abs_path.is_dir():
        raise HTTPException(status_code=400, detail="Not a directory")

    base = abs_path.name or "archive"
    proc = await asyncio.create_subprocess_exec(
        "tar", "-czf", "-", "-C", str(abs_path.parent), abs_path.name,
        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
    )
    stdout, _ = await proc.communicate()
    return StreamingResponse(
        iter([stdout]),
        media_type="application/gzip",
        headers={"Content-Disposition": f'attachment; filename="{base}.tar.gz"'},
    )


@router.get("/search")
async def search_files_route(
    q: str = Query(""),
    type: str = Query("content"),
    user: User = Depends(get_current_user),
):
    if not q:
        return {"results": []}

    if type == "filename":
        results = file_manager.search_files(q)
        return {"results": [{"path": r["path"]} for r in results]}
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
                try:
                    rel = str(Path(file_path).relative_to(WORKSPACE_DIR))
                except ValueError:
                    continue
                results.append({
                    "path": rel,
                    "line": int(line_no) if line_no.isdigit() else 0,
                    "text": text,
                })
        return {"results": results}
