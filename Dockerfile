FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p templates static

EXPOSE 8080

ENV PORT=8080

CMD ["python", "app.py"]
