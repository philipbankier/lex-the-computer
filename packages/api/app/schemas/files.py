from pydantic import BaseModel


class FileInfo(BaseModel):
    name: str
    path: str
    type: str  # "file" | "directory"
    size: int = 0
    modified: float = 0


class DirectoryListing(BaseModel):
    path: str
    files: list[FileInfo]


class FileContentResponse(BaseModel):
    path: str
    content: str
    size: int


class FileWriteRequest(BaseModel):
    path: str
    content: str


class FileRenameRequest(BaseModel):
    old_path: str
    new_path: str


class FileSearchResult(BaseModel):
    path: str
    matches: list[str]
