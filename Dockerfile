FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN apt-get update && apt-get install -y --no-install-recommends fonts-dejavu-core && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir -r requirements.txt
COPY pclbot ./pclbot
COPY run.py .
ENV DB_PATH=/data/pclbot.db
ENV ONC_ASSETS_DIR=/data/onc_assets
VOLUME /data
EXPOSE 8080
CMD ["python", "run.py"]
