from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import (
    admin,
    api_keys,
    auth,
    bookmarks,
    datasets,
    domains,
    files,
    health,
    notifications,
    onboarding,
    profile,
    public_api,
    search,
    secrets,
    services,
    settings,
    sites,
    system,
    terminal,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(
    title="Lex the Computer — Product API",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(terminal.router)
app.include_router(secrets.router)
app.include_router(settings.router)
app.include_router(bookmarks.router)
app.include_router(notifications.router)
app.include_router(profile.router)
app.include_router(search.router)
app.include_router(onboarding.router)
app.include_router(system.router)
app.include_router(services.router)
app.include_router(files.router)
app.include_router(datasets.router)
app.include_router(sites.router)
app.include_router(domains.router)
app.include_router(api_keys.router)
app.include_router(admin.router)
app.include_router(public_api.router)
