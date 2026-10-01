FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY pclbot ./pclbot
COPY run.py .
ENV DB_PATH=/data/pclbot.db
VOLUME /data
EXPOSE 8080
CMD ["python", "run.py"]
