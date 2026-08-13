#!/bin/bash

# Create images directory if it doesn't exist
mkdir -p images

# Base URL for images
BASE_URL="https://olo-images-live.imgix.net/"

# Extract all unique image filenames from menu.json
echo "Extracting image filenames from menu.json..."
IMAGE_FILES=$(grep -o '"filename": "[^"]*"' menu.json | cut -d'"' -f4 | sort | uniq)
IMAGEFILENAME_FILES=$(grep -o '"imagefilename": "[^"]*"' menu.json | cut -d'"' -f4 | sort | uniq)

# Combine both sets of filenames
ALL_IMAGE_FILES=$(echo "$IMAGE_FILES
$IMAGEFILENAME_FILES" | sort | uniq)

# Replace IMAGE_FILES with the combined list
IMAGE_FILES="$ALL_IMAGE_FILES"

# Count total images to download
TOTAL_IMAGES=$(echo "$IMAGE_FILES" | wc -l)
echo "Found $TOTAL_IMAGES unique images to download."

# Counter for progress tracking
COUNTER=0

# Download each image
for IMAGE_FILE in $IMAGE_FILES; do
    COUNTER=$((COUNTER + 1))

    # Create the full URL
    IMAGE_URL="${BASE_URL}${IMAGE_FILE}"

    # Extract just the filename part (after the last /)
    FILENAME=$(echo "$IMAGE_FILE" | sed 's/.*\///')

    # Remove query parameters for the local filename
    LOCAL_FILENAME=$(echo "$FILENAME" | cut -d'?' -f1)

    echo "[$COUNTER/$TOTAL_IMAGES] Downloading: $LOCAL_FILENAME"

    # Download the image
    curl -s "$IMAGE_URL" -o "images/$LOCAL_FILENAME"

    # Check if download was successful
    if [ $? -eq 0 ]; then
        echo "  ✓ Downloaded successfully"
    else
        echo "  ✗ Failed to download"
    fi
done

echo "Download complete. Images saved to the 'images' directory."
