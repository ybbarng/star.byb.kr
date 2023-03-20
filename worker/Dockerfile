### image: build
FROM python:3 AS build

# Install dependencies.
WORKDIR /usr/src/worker
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy all local files into the image.
COPY . .

# Build.
CMD python -u worker.py ${WORKER}
