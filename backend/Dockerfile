FROM python:3.10-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Adjust command depending on how you run your backend (e.g., Flask vs FastAPI)
CMD ["python", "app.py"]
