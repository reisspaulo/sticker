#!/usr/bin/env python3
"""
Face Recognition Training API
Exposes HTTP endpoints to train celebrity face recognition models
"""

import os
import sys
import asyncio
import logging
from datetime import datetime
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, BackgroundTasks, Header, Depends
from pydantic import BaseModel
from dotenv import load_dotenv

# Add scripts directory to path for imports
sys.path.insert(0, "/opt/face-recognition/scripts")

# Load environment variables
load_dotenv("/opt/face-recognition/.env")

# API Key for authentication
API_KEY = os.getenv("TRAINING_API_KEY", "")


async def verify_api_key(x_api_key: str = Header(..., alias="X-API-Key")):
    """Verify the API key from request header"""
    if not API_KEY:
        raise HTTPException(status_code=500, detail="API key not configured")
    if x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return x_api_key

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler("/opt/face-recognition/logs/api.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Track active training jobs
active_jobs: dict[str, dict] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    logger.info("Face Recognition Training API starting...")
    yield
    logger.info("Face Recognition Training API shutting down...")


app = FastAPI(
    title="Face Recognition Training API",
    description="API for training celebrity face recognition models",
    version="1.0.0",
    lifespan=lifespan
)


class PhotoItem(BaseModel):
    """Photo item with URL"""
    filename: str
    url: str


class TrainRequest(BaseModel):
    """Request body for /train endpoint"""
    celebrity_slug: str
    celebrity_id: str
    callback_url: Optional[str] = None
    photos: Optional[list[PhotoItem]] = None  # Signed URLs from admin panel


class TrainResponse(BaseModel):
    """Response body for /train endpoint"""
    status: str
    message: str
    job_id: Optional[str] = None


class HealthResponse(BaseModel):
    """Response body for /health endpoint"""
    status: str
    timestamp: str
    active_jobs: int


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(
        status="healthy",
        timestamp=datetime.now().isoformat(),
        active_jobs=len([j for j in active_jobs.values() if j["status"] == "training"])
    )


@app.post("/train", response_model=TrainResponse)
async def train_celebrity(
    request: TrainRequest,
    background_tasks: BackgroundTasks,
    api_key: str = Depends(verify_api_key)
):
    """
    Start training for a celebrity.

    If photos with signed URLs are provided, uses those directly.
    Otherwise, downloads photos from Supabase Storage.
    Training runs in background and updates Supabase when complete.
    """
    celebrity_slug = request.celebrity_slug.lower().strip()
    celebrity_id = request.celebrity_id
    photos = request.photos

    # Check if already training
    if celebrity_slug in active_jobs and active_jobs[celebrity_slug]["status"] == "training":
        raise HTTPException(
            status_code=409,
            detail=f"Training already in progress for {celebrity_slug}"
        )

    # Create job entry
    job_id = f"{celebrity_slug}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    active_jobs[celebrity_slug] = {
        "job_id": job_id,
        "status": "training",
        "started_at": datetime.now().isoformat(),
        "celebrity_id": celebrity_id
    }

    # Convert photos to dict format for background task
    photos_dict = None
    if photos:
        photos_dict = [{"filename": p.filename, "url": p.url} for p in photos]
        logger.info(f"Starting training job {job_id} for {celebrity_slug} with {len(photos_dict)} pre-signed URLs")
    else:
        logger.info(f"Starting training job {job_id} for {celebrity_slug} (will fetch from Supabase)")

    # Run training in background
    background_tasks.add_task(
        run_training,
        celebrity_slug=celebrity_slug,
        celebrity_id=celebrity_id,
        job_id=job_id,
        callback_url=request.callback_url,
        photos=photos_dict
    )

    return TrainResponse(
        status="started",
        message=f"Training started for {celebrity_slug}",
        job_id=job_id
    )


@app.get("/status/{celebrity_slug}")
async def get_training_status(celebrity_slug: str):
    """Get training status for a celebrity"""
    celebrity_slug = celebrity_slug.lower().strip()

    if celebrity_slug not in active_jobs:
        raise HTTPException(status_code=404, detail="No training job found")

    return active_jobs[celebrity_slug]


async def run_training(
    celebrity_slug: str,
    celebrity_id: str,
    job_id: str,
    callback_url: Optional[str] = None,
    photos: Optional[list[dict]] = None
):
    """
    Background task to run the training process.

    1. Downloads photos (from signed URLs or Supabase Storage)
    2. Generates face embeddings
    3. Updates Supabase with result
    """
    from train_celebrity import train_celebrity_from_supabase, train_celebrity_from_urls

    try:
        logger.info(f"[{job_id}] Starting training for {celebrity_slug}")

        # Use signed URLs if provided, otherwise fetch from Supabase
        if photos:
            logger.info(f"[{job_id}] Using {len(photos)} pre-signed URLs")
            result = await train_celebrity_from_urls(celebrity_slug, celebrity_id, photos)
        else:
            logger.info(f"[{job_id}] Fetching photos from Supabase")
            result = await train_celebrity_from_supabase(celebrity_slug, celebrity_id)

        # Update job status
        active_jobs[celebrity_slug]["status"] = "completed" if result["success"] else "failed"
        active_jobs[celebrity_slug]["completed_at"] = datetime.now().isoformat()
        active_jobs[celebrity_slug]["result"] = result

        logger.info(f"[{job_id}] Training completed: {result}")

    except Exception as e:
        logger.error(f"[{job_id}] Training failed: {e}")
        active_jobs[celebrity_slug]["status"] = "failed"
        active_jobs[celebrity_slug]["error"] = str(e)
        active_jobs[celebrity_slug]["completed_at"] = datetime.now().isoformat()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8765)
