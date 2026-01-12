#!/usr/bin/env python3
"""
Celebrity Training Script
Downloads photos from Supabase Storage and generates face embeddings
"""

import os
import sys
import asyncio
import logging
import tempfile
import shutil
from pathlib import Path

import httpx
from dotenv import load_dotenv

# Add scripts directory to path
sys.path.insert(0, "/opt/face-recognition/scripts")

from face_classifier import adicionar_celebridade, carregar_embeddings

# Load environment variables
load_dotenv("/opt/face-recognition/.env")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
REFERENCIAS_DIR = "/opt/face-recognition/referencias"

logger = logging.getLogger(__name__)


async def download_photos_from_supabase(celebrity_slug: str, celebrity_id: str, target_dir: str) -> list[str]:
    """
    Download all photos for a celebrity from Supabase Storage.

    Args:
        celebrity_slug: The celebrity's slug (folder name in storage)
        celebrity_id: The celebrity's UUID in database
        target_dir: Local directory to save photos

    Returns:
        List of downloaded file paths
    """
    downloaded_files = []

    async with httpx.AsyncClient(timeout=60.0) as client:
        # First, get list of photos from celebrity_photos table
        headers = {
            "apikey": SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            "Content-Type": "application/json"
        }

        # Query celebrity_photos table
        response = await client.get(
            f"{SUPABASE_URL}/rest/v1/celebrity_photos",
            headers=headers,
            params={
                "celebrity_id": f"eq.{celebrity_id}",
                "select": "id,storage_path,file_name"
            }
        )

        if response.status_code != 200:
            logger.error(f"Failed to fetch photos list: {response.text}")
            raise Exception(f"Failed to fetch photos: {response.status_code}")

        photos = response.json()
        logger.info(f"Found {len(photos)} photos for {celebrity_slug}")

        if not photos:
            raise Exception(f"No photos found for celebrity {celebrity_slug}")

        # Download each photo
        for photo in photos:
            storage_path = photo["storage_path"]
            file_name = photo["file_name"]

            # Get signed URL for the file
            sign_response = await client.post(
                f"{SUPABASE_URL}/storage/v1/object/sign/celebrity-training/{storage_path}",
                headers=headers,
                json={"expiresIn": 3600}
            )

            if sign_response.status_code != 200:
                logger.warning(f"Failed to get signed URL for {storage_path}: {sign_response.text}")
                continue

            signed_data = sign_response.json()
            signed_url = f"{SUPABASE_URL}/storage/v1{signed_data['signedURL']}"

            # Download the file
            file_response = await client.get(signed_url)

            if file_response.status_code != 200:
                logger.warning(f"Failed to download {storage_path}")
                continue

            # Save to local file
            local_path = os.path.join(target_dir, file_name)
            with open(local_path, "wb") as f:
                f.write(file_response.content)

            downloaded_files.append(local_path)
            logger.info(f"Downloaded: {file_name}")

    return downloaded_files


async def update_celebrity_status(
    celebrity_id: str,
    status: str,
    embeddings_count: int = 0,
    error: str | None = None
):
    """
    Update celebrity training status in Supabase.

    Args:
        celebrity_id: The celebrity's UUID
        status: New status ('trained', 'failed', etc)
        embeddings_count: Number of embeddings generated
        error: Error message if failed
    """
    async with httpx.AsyncClient(timeout=30.0) as client:
        headers = {
            "apikey": SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal"
        }

        update_data = {
            "training_status": status,
            "last_trained_at": "now()",
        }

        if embeddings_count > 0:
            update_data["embeddings_count"] = embeddings_count

        if error:
            update_data["training_error"] = error
        else:
            update_data["training_error"] = None

        response = await client.patch(
            f"{SUPABASE_URL}/rest/v1/celebrities",
            headers=headers,
            params={"id": f"eq.{celebrity_id}"},
            json=update_data
        )

        if response.status_code not in [200, 204]:
            logger.error(f"Failed to update celebrity status: {response.text}")
        else:
            logger.info(f"Updated celebrity {celebrity_id} status to {status}")


async def download_photos_from_urls(photos: list[dict], target_dir: str) -> list[str]:
    """
    Download photos from pre-signed URLs.

    Args:
        photos: List of dicts with 'filename' and 'url' keys
        target_dir: Local directory to save photos

    Returns:
        List of downloaded file paths
    """
    downloaded_files = []

    async with httpx.AsyncClient(timeout=60.0) as client:
        for photo in photos:
            url = photo.get("url")
            filename = photo.get("filename", f"photo_{len(downloaded_files)}.jpg")

            if not url:
                logger.warning(f"Skipping photo without URL: {photo}")
                continue

            try:
                response = await client.get(url)

                if response.status_code != 200:
                    logger.warning(f"Failed to download {filename}: HTTP {response.status_code}")
                    continue

                # Save to local file
                local_path = os.path.join(target_dir, filename)
                with open(local_path, "wb") as f:
                    f.write(response.content)

                downloaded_files.append(local_path)
                logger.info(f"Downloaded: {filename}")

            except Exception as e:
                logger.warning(f"Error downloading {filename}: {e}")
                continue

    return downloaded_files


async def train_celebrity_from_urls(celebrity_slug: str, celebrity_id: str, photos: list[dict]) -> dict:
    """
    Train celebrity using pre-signed URLs.

    Args:
        celebrity_slug: The celebrity's slug
        celebrity_id: The celebrity's UUID
        photos: List of dicts with 'filename' and 'url' keys

    Returns:
        Dict with training result
    """
    temp_dir = None

    try:
        # Create temp directory for photos
        temp_dir = tempfile.mkdtemp(prefix=f"train_{celebrity_slug}_")
        logger.info(f"Created temp directory: {temp_dir}")

        # Download photos from URLs
        downloaded_files = await download_photos_from_urls(photos, temp_dir)

        if len(downloaded_files) < 1:
            raise Exception("No photos were downloaded successfully")

        logger.info(f"Downloaded {len(downloaded_files)} photos from URLs")

        # Copy to permanent referencias directory
        ref_dir = os.path.join(REFERENCIAS_DIR, celebrity_slug)
        os.makedirs(ref_dir, exist_ok=True)

        for src_file in downloaded_files:
            dst_file = os.path.join(ref_dir, os.path.basename(src_file))
            shutil.copy2(src_file, dst_file)

        logger.info(f"Copied photos to {ref_dir}")

        # Generate embeddings
        success = adicionar_celebridade(celebrity_slug, ref_dir)

        if not success:
            raise Exception("Failed to generate embeddings - no faces detected")

        # Count embeddings
        embeddings_db = carregar_embeddings()
        embeddings_count = len(embeddings_db.get(celebrity_slug, []))

        # Update status to trained (using Supabase API)
        await update_celebrity_status(celebrity_id, "trained", embeddings_count)

        return {
            "success": True,
            "celebrity_slug": celebrity_slug,
            "photos_processed": len(downloaded_files),
            "embeddings_count": embeddings_count
        }

    except Exception as e:
        logger.error(f"Training failed for {celebrity_slug}: {e}")

        # Update status to failed
        await update_celebrity_status(celebrity_id, "failed", error=str(e))

        return {
            "success": False,
            "celebrity_slug": celebrity_slug,
            "error": str(e)
        }

    finally:
        # Cleanup temp directory
        if temp_dir and os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)
            logger.info(f"Cleaned up temp directory: {temp_dir}")


async def train_celebrity_from_supabase(celebrity_slug: str, celebrity_id: str) -> dict:
    """
    Main training function.

    1. Downloads photos from Supabase Storage
    2. Generates face embeddings
    3. Updates celebrity status in database

    Args:
        celebrity_slug: The celebrity's slug
        celebrity_id: The celebrity's UUID

    Returns:
        Dict with training result
    """
    temp_dir = None

    try:
        # Update status to training
        await update_celebrity_status(celebrity_id, "training")

        # Create temp directory for photos
        temp_dir = tempfile.mkdtemp(prefix=f"train_{celebrity_slug}_")
        logger.info(f"Created temp directory: {temp_dir}")

        # Download photos
        downloaded_files = await download_photos_from_supabase(
            celebrity_slug, celebrity_id, temp_dir
        )

        if len(downloaded_files) < 1:
            raise Exception("No photos were downloaded successfully")

        logger.info(f"Downloaded {len(downloaded_files)} photos")

        # Also copy to permanent referencias directory for future use
        ref_dir = os.path.join(REFERENCIAS_DIR, celebrity_slug)
        os.makedirs(ref_dir, exist_ok=True)

        for src_file in downloaded_files:
            dst_file = os.path.join(ref_dir, os.path.basename(src_file))
            shutil.copy2(src_file, dst_file)

        logger.info(f"Copied photos to {ref_dir}")

        # Generate embeddings using existing function
        # This runs synchronously but is CPU-bound, not I/O-bound
        success = adicionar_celebridade(celebrity_slug, ref_dir)

        if not success:
            raise Exception("Failed to generate embeddings - no faces detected")

        # Count embeddings
        embeddings_db = carregar_embeddings()
        embeddings_count = len(embeddings_db.get(celebrity_slug, []))

        # Update status to trained
        await update_celebrity_status(celebrity_id, "trained", embeddings_count)

        return {
            "success": True,
            "celebrity_slug": celebrity_slug,
            "photos_processed": len(downloaded_files),
            "embeddings_count": embeddings_count
        }

    except Exception as e:
        logger.error(f"Training failed for {celebrity_slug}: {e}")

        # Update status to failed
        await update_celebrity_status(celebrity_id, "failed", error=str(e))

        return {
            "success": False,
            "celebrity_slug": celebrity_slug,
            "error": str(e)
        }

    finally:
        # Cleanup temp directory
        if temp_dir and os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)
            logger.info(f"Cleaned up temp directory: {temp_dir}")


# For testing
if __name__ == "__main__":
    import sys

    if len(sys.argv) < 3:
        print("Usage: python train_celebrity.py <celebrity_slug> <celebrity_id>")
        sys.exit(1)

    slug = sys.argv[1]
    cid = sys.argv[2]

    result = asyncio.run(train_celebrity_from_supabase(slug, cid))
    print(f"Result: {result}")
