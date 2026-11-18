FROM python:3.12-slim
WORKDIR /app
COPY panel/requirements.txt panel/requirements.txt
RUN pip install --no-cache-dir -r panel/requirements.txt
COPY panel panel
COPY agent agent
ENV PANEL_DB=sqlite:////data/panel.db
VOLUME /data
WORKDIR /app/panel
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
