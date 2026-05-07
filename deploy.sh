#!/bin/bash
set -e

IMAGE="sunthornrk/edencolors-track"
TAG="${1:-latest}"
SERVER="${DEPLOY_SERVER:-deploy@your-server-ip}"
REMOTE_DIR="${REMOTE_DIR:-/home/deploy/edencolors-track}"

echo "==> Building image ($IMAGE:$TAG)..."
docker build --platform linux/amd64 -t $IMAGE:$TAG .

echo "==> Pushing to Docker Hub..."
docker push $IMAGE:$TAG

echo "==> Deploying on server..."
ssh $SERVER "
  docker pull $IMAGE:$TAG &&
  cd $REMOTE_DIR &&
  docker compose -f docker-compose.prod.yml up -d &&
  echo '==> Running database migrations...' &&
  docker compose -f docker-compose.prod.yml exec app npx prisma migrate deploy
"

echo "==> Deploy complete!"
